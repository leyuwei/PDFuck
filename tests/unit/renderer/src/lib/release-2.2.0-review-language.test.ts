import { afterEach, expect, it, vi } from 'vitest'
import { AI_PRESETS, FULL_REVIEW_PRESETS, PROVIDER_PRESETS, autoAnnotatePage, defaultSettings, localizedPrompt, polishText, reviewDocument, suggestForAnnotation, translateText } from '../../../../../src/renderer/src/lib/ai-polish'
import { responseLanguageInstruction, sourceAiLanguage, withResponseLanguage } from '../../../../../src/renderer/src/lib/ai-response-language'
import type { AutomaticAnnotationBlock } from '../../../../../src/renderer/src/lib/automatic-annotation'
import { INTERFACE_LANGUAGES } from '../../../../../src/shared/i18n-catalogue'

const samples = {
  en: 'The manuscript studies wireless networks. It gives new evidence about the effect of the method and discusses the results in a separate section.',
  zh: '本文讨论网络中流量分配的条件及其理论依据，并用实验说明方法在不同强度下的实际表现。',
  ja: '本研究では、通信ネットワークの性能を調べます。実験結果とその限界を別の節で説明しています。',
  ru: 'В этой статье рассматриваются результаты исследования беспроводной связи и ограничения предложенного метода.',
  es: 'El documento presenta los resultados de una investigación sobre el sistema y compara su rendimiento con los datos de las pruebas.',
  fr: 'Le document explique les effets du système et les preuves de cette conclusion. Les résultats sont comparés avec les données de la première étude.',
  de: 'Der Bericht untersucht die Ergebnisse und die Grenzen des Verfahrens. Die Daten aus der Studie werden im nächsten Abschnitt verglichen.',
  pt: 'O documento apresenta os resultados e os limites do método. Os dados da pesquisa são comparados com os valores dos testes e discutidos na conclusão.',
  ko: '이 논문은 통신 시스템의 성능을 평가하고 그 결과를 설명합니다. 연구 방법의 한계도 함께 검토합니다.',
  ar: 'تقدم هذه الدراسة نتائج تحليل النظام وتقارن بين الأدلة التجريبية والنتائج النظرية وتشرح أوجه القصور.'
}
const settings = { ...defaultSettings, apiKey:'test-local' }
const claude = { ...settings, provider:'claude' as const, baseUrl:PROVIDER_PRESETS.claude.baseUrl }
const mock = (text='Result', mode:'claude'|'compatible'='compatible') => {
  const body = mode==='claude' ? {content:[{type:'text',text}]} : {choices:[{message:{content:text}}]}
  const aiRequest = vi.fn().mockResolvedValue({status:200,statusText:'OK',body:JSON.stringify(body)})
  vi.stubGlobal('window',{desktop:{aiRequest}})
  return () => JSON.parse(aiRequest.mock.calls[0][0].body)
}
afterEach(()=>vi.unstubAllGlobals())

it.each(INTERFACE_LANGUAGES)('localizes the recommendation and recognizes the predominant language %s', language => {
  const prompt = localizedPrompt(FULL_REVIEW_PRESETS[0],language,'source')
  expect(prompt).toContain('accept as it is / minor revision / major revision / reject')
  expect(prompt).toContain(responseLanguageInstruction('source',language))
  expect(localizedPrompt(FULL_REVIEW_PRESETS[1],language,'source')).not.toContain('accept as it is')
  const quote = language==='en' ? '短引语。' : 'One short quote.'
  expect(sourceAiLanguage(samples[language].repeat(4)+'\n'+quote)).toBe(language)
})

it('does not default to interface language for an unreadable scan or an unsupported script', () => {
  expect(sourceAiLanguage('--- Page 1 ---\n\n--- Page 2 ---\n 123 😀')).toBeUndefined()
  expect(sourceAiLanguage('Η έκθεση παρουσιάζει συγκριτικά αποτελέσματα.')).toBeUndefined()
  expect(withResponseLanguage('Analyze.\n最后用中文来回答。\nRespond in English.','ja')).toBe('Analyze.\n\n日本語で回答してください。')
})

it('answers in the dominant text language through compatible and Claude providers', async () => {
  const get = mock()
  const instruction = localizedPrompt(FULL_REVIEW_PRESETS[0],'zh')
  await reviewDocument(settings,instruction,{name:'test.pdf',bytes:new Uint8Array([1]),text:samples.en+'\n简短引文'},'text','zh')
  const compatible = get()
  expect(compatible.messages[0].content).toContain('Respond in English.')
  expect(compatible.messages[1].content).toContain('Respond in English.')
  expect(compatible.messages[1].content).not.toContain('请用中文回答。')
  expect(compatible.messages[1].content).toContain('accept as it is / minor revision / major revision / reject')
  const getClaude = mock('Result','claude')
  await reviewDocument(claude,'Review. 最后用中文回答。',{name:'test.pdf',bytes:new Uint8Array([1]),text:samples.fr},'file','zh')
  const direct = getClaude().messages[0].content
  expect(direct[0].type).toBe('document')
  expect(direct[1].text).toContain('Répondez en français.')
  expect(direct[1].text).not.toContain(samples.fr)
})

it('asks the model to infer language from the PDF when local text is unavailable', async () => {
  const get = mock()
  await reviewDocument(settings,'Inspect the scan. Respond in English.',{name:'scan.pdf',bytes:new Uint8Array([1])},'file','zh')
  expect(get().messages[1].content[1].text).toContain('请使用待处理内容的主要语言回答。')
  expect(get().messages[1].content[1].text).not.toContain('Respond in English.')
})

it('uses the actual selection for polish and explicit recorded context for suggestions', async () => {
  let get = mock()
  await polishText(settings,AI_PRESETS[0].prompt+' 最后用中文回答。',samples.ko+' Short reference.')
  const polishPrompt = get().messages[1].content
  expect(polishPrompt).toContain('한국어로 답변하세요.')
  expect(polishPrompt).not.toContain('最后用中文回答。')
  get = mock()
  await suggestForAnnotation(settings,'Clarify the argument. Respond in English.','中文审稿意见',[samples.en.repeat(6),samples.zh],'en',undefined,samples.zh)
  expect(get().messages[1].content).toContain('请用中文回答。')
  expect(get().messages[1].content).not.toContain('Respond in English.')
})

it('uses the page language for automatic findings and retains translation targets', async () => {
  const text = samples.es
  const block = {id:'p1',pageIndex:0,text,words:[]} as AutomaticAnnotationBlock
  let get = mock(JSON.stringify({version:1,findings:[],contextSummary:''}))
  await autoAnnotatePage(settings,{pageIndex:0,blocks:[block],issueType:'custom',customIssue:'Proofread. Respond in English.',detail:'brief',language:'zh'})
  expect(get().messages[1].content).toContain('Responda en español.')
  expect(get().messages[1].content).not.toContain('Respond in English.')
  get = mock('Bonjour')
  await translateText(settings,'fr',samples.ja)
  expect(get().messages[1].content).toContain('into Français')
})
