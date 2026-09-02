import type { AiResponse } from '../../../shared/contracts'
import { translateMessage, type TranslationKey } from '../../../shared/i18n-catalogue'

export type AiProvider = 'openai' | 'claude' | 'bigmodel' | 'doubao' | 'deepseek' | 'kimi' | 'custom'

export const DEFAULT_AI_TIMEOUT_SECONDS = 120
export const MIN_AI_TIMEOUT_SECONDS = 5
export const MAX_AI_TIMEOUT_SECONDS = 3600

export interface AiSettings { provider: AiProvider; baseUrl: string; apiKey: string; model: string; timeoutSeconds: number }
export type AiLanguage = 'zh' | 'en' | 'ja' | 'ru' | 'es'
export interface AiPromptPreset { id: string; label: TranslationKey; prompt: string; promptEn: string; promptJa?: string; promptRu?: string; promptEs?: string }
export interface LocalizedAiPromptPreset { id: string; label: TranslationKey; prompts: Record<AiLanguage, string> }
export interface AiProviderPreset { baseUrl: string; model: string }

export type FullReviewSendMode = 'text' | 'file'
export interface FullReviewDocument { name: string; bytes: Uint8Array; text?: string }

export const MAX_AI_PDF_BYTES = 40 * 1024 * 1024

export const AI_PRESETS: AiPromptPreset[] = [
  { id: 'plain', label: "ui.plainLanguageExplanation", prompt: '请用通俗、准确且简洁的语言直接改写原文，保留关键事实。只返回改写后的文本，不要解释。', promptEn: 'Rewrite the text in clear, accurate, concise language while preserving key facts. Return only the rewritten text; do not explain.' },
  { id: 'logic', label: "ui.improveLogic", prompt: '请修正逻辑断裂、重复和衔接问题，直接返回简洁连贯的改写文本，不要分析或解释。', promptEn: 'Fix logical gaps, repetition, and transitions. Return only a concise, coherent rewrite; do not analyze or explain.' },
  { id: 'grammar', label: "ui.grammarOnly", prompt: '请仅修正语法、拼写、标点和明显格式错误，不改变原意与文风。只返回修正后的文本，不要解释。', promptEn: 'Correct only grammar, spelling, punctuation, and obvious formatting errors without changing meaning or style. Return only the corrected text; do not explain.' },
  { id: 'human', label: "ui.naturalPhrasing", prompt: '请在保持原意的前提下改写得自然、专业、简洁，去除机械和空泛措辞。只返回改写后的文本，不要解释。', promptEn: 'Rewrite the text to sound natural, professional, and concise while preserving its meaning. Remove mechanical or vague wording. Return only the rewrite; do not explain.' },
  { id: 'inconsistent', label: "ui.resolveInconsistencies", prompt: '请统一原文中不一致的术语、事实、时态和指代，直接返回修正后的完整文本，不要逐项说明。', promptEn: 'Resolve inconsistent terminology, facts, tense, and references. Return only the complete corrected text; do not list or explain the changes.' },
  { id: 'highlights', label: "ui.highlightStrengths", prompt: '请在不夸张、不新增事实的前提下突出核心贡献和结果，直接返回简洁有力的改写文本，不要解释。', promptEn: 'Highlight the core contribution and results without exaggeration or new facts. Return only a concise, compelling rewrite; do not explain.' }
]

export const FULL_REVIEW_PRESETS: LocalizedAiPromptPreset[] = [
  {
    id: 'comprehensive', label: "ui.comprehensiveReviewRecommended", prompts: {
      zh: '请对整个文档进行严格、专业且基于证据的审稿。先用恰好三句话概括文档做了什么、采用了什么方法或结构、得到什么结论或目标。然后以分点清单罗列具体问题，每点注明所在章节、页码或可识别的原文片段（如果能够判断），并给出可执行的修改建议。至少检查：整体结构和论述是否通顺；章节标题和前后安排是否合理；错别字、语法、标点及格式；术语、事实、数据、指代和结论前后是否一致；是否存在上下文不搭、突兀或意义不明的句子；晦涩概念是否充分解释；亮点、贡献和核心结论是否突出明确；是否存在逻辑错误、论证漏洞或推导错误。不得虚构文档中没有的信息；无法判断时请明确说明。',
      en: 'Review the entire document rigorously, professionally, and with evidence. Begin with exactly three sentences summarizing what the document does, the method or structure it uses, and its conclusion or objective. Then list specific issues as bullets; when possible, identify the section, page, or recognizable excerpt and give an actionable revision. At minimum, assess overall structure and flow; section titles and ordering; typos, grammar, punctuation, and formatting; consistency of terms, facts, data, references, and conclusions; abrupt, irrelevant, or unclear sentences; unexplained difficult concepts; whether strengths, contributions, and conclusions are explicit; and logical, argumentative, or derivation errors. Do not invent information absent from the document; state clearly when something cannot be determined.',
      ja: '文書全体を、根拠に基づいて厳密かつ専門的に査読してください。まず、文書が何を行い、どの方法・構成を採用し、どの結論・目的に至るかを、ちょうど3文で要約してください。続いて具体的な問題を箇条書きにし、判断できる場合は章・ページ・識別可能な原文を示して、実行可能な修正案を提示してください。少なくとも、全体構成と論述の流れ、章見出しと順序、誤字・文法・句読点・書式、用語・事実・データ・指示語・結論の一貫性、文脈に合わない唐突または不明瞭な文、未説明の難解な概念、強み・貢献・主要結論の明確さ、論理・論証・導出の誤りを確認してください。文書にない情報を作らず、判断不能な点は明記してください。',
      ru: 'Проведите строгую, профессиональную и основанную на тексте рецензию всего документа. Сначала ровно тремя предложениями опишите, что делает документ, какой метод или структуру использует и к какому выводу или цели приходит. Затем перечислите конкретные проблемы по пунктам; по возможности укажите раздел, страницу или узнаваемый фрагмент и предложите выполнимое исправление. Обязательно оцените общую структуру и связность, названия и порядок разделов, опечатки, грамматику, пунктуацию и оформление, согласованность терминов, фактов, данных, ссылок и выводов, внезапные, неуместные или непонятные фразы, недостаточно объяснённые сложные понятия, ясность сильных сторон, вклада и выводов, а также логические ошибки, пробелы в аргументации и ошибки вывода. Не выдумывайте отсутствующие сведения; прямо отмечайте, что невозможно определить.',
      es: 'Revise todo el documento de forma rigurosa, profesional y basada en evidencias. Empiece con exactamente tres frases que resuman qué hace el documento, qué método o estructura utiliza y qué conclusión u objetivo alcanza. Después enumere problemas concretos en viñetas; cuando sea posible, indique la sección, página o fragmento reconocible y proponga una corrección aplicable. Evalúe como mínimo la estructura y fluidez globales; los títulos y el orden de las secciones; erratas, gramática, puntuación y formato; la coherencia de términos, hechos, datos, referencias y conclusiones; frases abruptas, fuera de contexto o poco claras; conceptos difíciles sin suficiente explicación; la claridad de los puntos fuertes, aportaciones y conclusiones; y errores lógicos, argumentativos o de derivación. No invente información ausente del documento; indique claramente lo que no pueda determinar.'
    }
  },
  {
    id: 'structure', label: "ui.structureAndLogic", prompts: {
      zh: '请审查整个文档的结构和逻辑。先用恰好三句话概括文档内容，再按严重程度分点指出章节标题、章节顺序、论证衔接、前后矛盾、逻辑错误和推导漏洞，并给出明确的调整方案。引用可识别的章节、页码或原文，不要虚构。',
      en: 'Review the structure and logic of the entire document. Begin with exactly three summary sentences, then list issues by severity covering section titles, ordering, argumentative transitions, contradictions, logical errors, and derivation gaps, with concrete restructuring advice. Cite identifiable sections, pages, or excerpts and do not invent evidence.',
      ja: '文書全体の構成と論理を査読してください。最初にちょうど3文で要約し、その後、章見出し、章順、論証のつながり、矛盾、論理的誤り、導出の欠落を重大度順に列挙し、具体的な再構成案を示してください。識別可能な章・ページ・原文を引用し、根拠を作らないでください。',
      ru: 'Проверьте структуру и логику всего документа. Начните с ровно трёх предложений-резюме, затем по степени серьёзности перечислите проблемы с названиями и порядком разделов, переходами аргументации, противоречиями, логическими ошибками и пробелами вывода, предложив конкретную перестройку. Ссылайтесь на узнаваемые разделы, страницы или фрагменты и не выдумывайте доказательства.',
      es: 'Revise la estructura y la lógica de todo el documento. Empiece con exactamente tres frases de resumen y después enumere por gravedad los problemas de títulos y orden de secciones, transiciones argumentales, contradicciones, errores lógicos y lagunas de derivación, con propuestas concretas de reorganización. Cite secciones, páginas o fragmentos identificables y no invente evidencias.'
    }
  },
  {
    id: 'language', label: "ui.languageAndConsistency", prompts: {
      zh: '请审查整个文档的语言质量和一致性。先用恰好三句话概括文档，再分点指出错别字、语法、标点、格式、术语与数据不一致、上下文不搭、表达晦涩、概念解释不足以及亮点不明确的问题，并逐项给出可直接执行的修改建议。请标注位置或原文片段，不要虚构。',
      en: 'Review language quality and consistency throughout the document. Begin with exactly three summary sentences, then identify typos, grammar, punctuation, formatting, inconsistent terminology or data, context breaks, obscure wording, underexplained concepts, and unclear strengths, giving an actionable correction for each. Identify locations or excerpts and do not invent content.',
      ja: '文書全体の言語品質と一貫性を査読してください。最初にちょうど3文で要約し、その後、誤字、文法、句読点、書式、用語・データの不一致、文脈の断絶、難解な表現、説明不足の概念、強みの不明確さを指摘し、それぞれ実行可能な修正案を示してください。位置または原文を明示し、内容を作らないでください。',
      ru: 'Проверьте качество языка и согласованность всего документа. Начните с ровно трёх предложений-резюме, затем укажите опечатки, грамматику, пунктуацию, оформление, несогласованные термины или данные, разрывы контекста, неясные формулировки, недостаточно объяснённые понятия и невыраженные сильные стороны, предложив конкретное исправление для каждого пункта. Укажите место или фрагмент и не выдумывайте содержание.',
      es: 'Revise la calidad lingüística y la coherencia de todo el documento. Empiece con exactamente tres frases de resumen y después señale erratas, gramática, puntuación, formato, terminología o datos incoherentes, rupturas de contexto, redacción oscura, conceptos poco explicados y fortalezas poco claras, con una corrección aplicable para cada punto. Indique ubicaciones o fragmentos y no invente contenido.'
    }
  }
]

export const ANNOTATION_SUGGESTION_PRESETS: LocalizedAiPromptPreset[] = [
  {
    id: 'professional', label: "ui.professionalRevisionAdvice", prompts: {
      zh: '请结合批注要求和用户提供的全部上下文，给出专业、具体、可直接执行的修改建议。先准确解释批注希望解决的问题，再给出推荐改写或调整步骤；不得忽略批注，不得虚构上下文之外的事实。',
      en: 'Use the annotation request and all supplied context to give professional, specific, directly actionable revision advice. First explain precisely what the annotation asks to fix, then provide a recommended rewrite or concrete revision steps. Do not ignore the annotation or invent facts outside the context.',
      ja: '批注の要求と提示されたすべての文脈を組み合わせ、専門的で具体的、直ちに実行できる修正案を示してください。まず批注が解決を求める問題を正確に説明し、その後に推奨する書き換えまたは修正手順を提示してください。批注を無視したり、文脈外の事実を作ったりしないでください。',
      ru: 'С учётом требования аннотации и всего предоставленного контекста дайте профессиональный, конкретный и непосредственно применимый совет по исправлению. Сначала точно объясните, какую проблему требует решить аннотация, затем предложите рекомендуемую формулировку или последовательность правок. Не игнорируйте аннотацию и не выдумывайте факты вне контекста.',
      es: 'Combine el requisito de la anotación con todo el contexto proporcionado para dar una recomendación profesional, concreta y directamente aplicable. Explique primero con precisión qué problema pide resolver la anotación y después proponga una redacción recomendada o pasos de revisión. No ignore la anotación ni invente hechos ajenos al contexto.'
    }
  },
  {
    id: 'rewrite', label: "ui.provideARecommendedRewrite", prompts: {
      zh: '请根据批注要求和全部上下文，直接给出一版专业、准确、连贯的推荐改写，并用不超过三点简要说明关键修改。不得新增原文没有的事实。',
      en: 'Based on the annotation and all context, provide a professional, accurate, coherent recommended rewrite, followed by no more than three brief points explaining the key changes. Do not add facts absent from the source.',
      ja: '批注とすべての文脈に基づき、専門的で正確かつ一貫した推奨書き換えを提示し、主要な変更を3点以内で簡潔に説明してください。原文にない事実を追加しないでください。',
      ru: 'На основе аннотации и всего контекста предложите профессиональную, точную и связную новую формулировку, а затем не более чем в трёх пунктах кратко объясните ключевые изменения. Не добавляйте отсутствующие в исходнике факты.',
      es: 'A partir de la anotación y de todo el contexto, proponga una redacción profesional, precisa y coherente, seguida de no más de tres puntos breves que expliquen los cambios clave. No añada hechos ausentes del original.'
    }
  }
]

export function detectAiLanguage(text: string, fallback: AiLanguage = 'en'): AiLanguage {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja'
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru'
  if (/[áéíóúüñ¿¡]/iu.test(text)) return 'es'
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(text)) return 'zh'
  if (/[A-Za-z]/u.test(text)) return 'en'
  return fallback
}

export function promptForLanguage(preset: AiPromptPreset, language: AiLanguage): string {
  if (language === 'ja') return preset.promptJa || preset.promptEn
  if (language === 'ru') return preset.promptRu || preset.promptEn
  if (language === 'es') return preset.promptEs || preset.promptEn
  return language === 'en' ? preset.promptEn : preset.prompt
}

export function localizedPrompt(preset: LocalizedAiPromptPreset, language: AiLanguage): string { return preset.prompts[language] }

export const PROVIDER_PRESETS: Record<Exclude<AiProvider, 'custom'>, AiProviderPreset> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  bigmodel: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5-air' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-250615' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
}

const KEY = 'pdfuck.ai-settings.v1'
export const defaultSettings: AiSettings = { provider: 'openai', ...PROVIDER_PRESETS.openai, apiKey: '', timeoutSeconds: DEFAULT_AI_TIMEOUT_SECONDS }

export function normalizeAiTimeoutSeconds(value: unknown): number {
  const timeout = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(timeout)) return DEFAULT_AI_TIMEOUT_SECONDS
  return Math.round(Math.max(MIN_AI_TIMEOUT_SECONDS, Math.min(MAX_AI_TIMEOUT_SECONDS, timeout)))
}

export function providerSettings(current: AiSettings, provider: AiProvider): AiSettings {
  if (provider === 'custom') return { ...current, provider }
  const oldPreset = current.provider === 'custom' ? undefined : PROVIDER_PRESETS[current.provider]
  const untouched = !current.baseUrl.trim() || !current.model.trim() || (oldPreset && current.baseUrl.trim() === oldPreset.baseUrl && current.model.trim() === oldPreset.model)
  return { ...current, provider, ...(untouched ? PROVIDER_PRESETS[provider] : {}) }
}

export function loadAiSettings(): AiSettings {
  try {
    const parsed = { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as AiSettings
    parsed.timeoutSeconds = normalizeAiTimeoutSeconds(parsed.timeoutSeconds)
    // 1.16.8 could store BigModel with the OpenAI defaults after provider switching.
    if (parsed.provider !== 'openai' && parsed.provider !== 'custom' && parsed.baseUrl === PROVIDER_PRESETS.openai.baseUrl && parsed.model === PROVIDER_PRESETS.openai.model) return { ...parsed, ...PROVIDER_PRESETS[parsed.provider] }
    return parsed
  } catch { return defaultSettings }
}

export function saveAiSettings(value: AiSettings): void { localStorage.setItem(KEY, JSON.stringify({ ...value, timeoutSeconds: normalizeAiTimeoutSeconds(value.timeoutSeconds) })) }

export function endpoint(settings: AiSettings): string {
  const raw = settings.baseUrl.trim()
  if (!raw) throw new Error('请先填写接口地址。')
  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('接口地址无效，请填写完整的 http:// 或 https:// 地址。') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('接口地址只支持 http:// 或 https://。')
  parsed.pathname = parsed.pathname.replace(/\/+$/u, '')
  if (settings.provider === 'claude') {
    if (!parsed.pathname.endsWith('/messages')) parsed.pathname = parsed.pathname.endsWith('/v1') ? `${parsed.pathname}/messages` : `${parsed.pathname}/v1/messages`
  } else if (!parsed.pathname.endsWith('/chat/completions')) parsed.pathname += '/chat/completions'
  return parsed.toString()
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '')).join('')
  return ''
}

function parseJson(body: string): Record<string, unknown> {
  try { return JSON.parse(body) as Record<string, unknown> } catch { return {} }
}

const FRIENDLY_HTTP_ERRORS: Partial<Record<number, TranslationKey>> = {
  400: "ui.theRequestParametersOrModelAreIncompatibleCheckTheModel",
  401: "ui.authenticationFailedCheckTheApiKeyAccountPermissionsAndApi",
  403: "ui.theServiceRejectedTheRequestCheckTheApiKeyPermissions",
  404: "ui.theModelOrApiRouteWasNotFoundCheckThe",
  408: "ui.theAiServiceOrRelayGatewayTimedOutShortenThe",
  413: "ui.theContentExceedsTheProviderLimitShortenTheInputFor",
  422: "ui.theRequestParametersOrModelAreIncompatibleCheckTheModel",
  429: "ui.requestsAreTooFrequentOrTheAccountHasInsufficientQuota",
  500: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  502: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  503: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  504: "ui.theAiServiceOrRelayGatewayTimedOutShortenThe",
  520: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  521: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  522: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  523: "ui.theAiServiceOrRelayGatewayIsTemporarilyUnavailableTry",
  524: "ui.theAiServiceOrRelayGatewayTimedOutWhileWaiting",
  525: "ui.theRelayGatewayCouldNotEstablishASecureConnectionTo",
  526: "ui.theRelayGatewayCouldNotEstablishASecureConnectionTo"
}

function responseDetail(response: Pick<AiResponse, 'statusText' | 'body'>): string {
  const payload = parseJson(response.body)
  const error = payload.error
  const jsonDetail = typeof error === 'string'
    ? error
    : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : typeof payload.message === 'string' ? payload.message : ''
  if (jsonDetail.trim()) return jsonDetail.trim().replace(/\s+/gu, ' ').slice(0, 300)
  const body = response.body.trim()
  const plainBody = /<(?:!doctype|html|head|body)\b/iu.test(body) ? '' : body.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim()
  return (plainBody || response.statusText || '服务未返回详细原因').slice(0, 300)
}

function responseError(response: Pick<AiResponse, 'status' | 'statusText' | 'body'>): Error {
  const key = FRIENDLY_HTTP_ERRORS[response.status]
  return new Error(`请求失败（${response.status}）：${key ? translateMessage('zh', key) : responseDetail(response)}`)
}

async function sendRequest(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<AiResponse> {
  const desktop = typeof window !== 'undefined' ? window.desktop : undefined
  if (desktop?.aiRequest) return desktop.aiRequest({ url, headers, body, timeoutMs })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal })
    return { status: response.status, statusText: response.statusText, body: await response.text() }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('已达到模型设置中的响应超时时间，软件已停止等待。请缩短输入、改用更快的模型，或在确认服务商允许更长请求后调大超时。')
    throw error
  } finally { clearTimeout(timeout) }
}

function requestCredentials(settings: AiSettings): { model: string; claude: boolean; headers: Record<string, string> } {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) throw new Error('请先在模型设置中填写 API Key。')
  const model = settings.model.trim()
  if (!model) throw new Error('请先选择或填写模型名称。')
  const claude = settings.provider === 'claude'
  const headers: Record<string, string> = claude
    ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  return { model, claude, headers }
}

function streamedContent(body: string): string {
  let output = ''
  for (const rawLine of body.split(/\r?\n/gu)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(':') || line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) continue
    const data = line.startsWith('data:') ? line.slice(5).trim() : line
    if (!data || data === '[DONE]' || !data.startsWith('{')) continue
    const chunk = parseJson(data)
    const choice = (chunk.choices as Array<{ delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown }> | undefined)?.[0]
    const delta = chunk.delta as { text?: unknown } | undefined
    const text = contentText(choice?.delta?.content)
      || contentText(delta?.text)
      || contentText(choice?.message?.content)
      || contentText(choice?.text)
    output += text
  }
  return output
}

function streamUnsupported(response: AiResponse): boolean {
  if (response.status !== 400 && response.status !== 422) return false
  const detail = responseDetail(response)
  return /stream/iu.test(detail) && /unsupported|not supported|not support|must be false|only false|disabled|unknown|unrecognized|invalid|unexpected|extra|additional|不支持|必须为 false|未知|无效|未识别/iu.test(detail)
}

async function requestOutput(settings: AiSettings, payload: Record<string, unknown>, claude: boolean, headers: Record<string, string>): Promise<string> {
  let response: AiResponse
  const url = endpoint(settings)
  const timeoutMs = normalizeAiTimeoutSeconds(settings.timeoutSeconds) * 1000
  try {
    response = await sendRequest(url, { ...headers, accept: 'text/event-stream' }, JSON.stringify({ ...payload, stream: true }), timeoutMs)
    // Some older OpenAI-compatible relays reject the stream field instead of ignoring it.
    // Fall back only after an explicit, immediate compatibility error; never replay a timed-out or billable request.
    if (streamUnsupported(response)) response = await sendRequest(url, { ...headers, accept: 'application/json' }, JSON.stringify(payload), timeoutMs)
  } catch (error) {
    if (error instanceof Error && /failed to fetch|networkerror|load failed/iu.test(error.message)) throw new Error('无法连接模型服务，请检查接口地址、网络或证书。')
    if (error instanceof Error && error.message) throw error
    throw new Error('无法连接模型服务，请检查接口地址、网络或证书。')
  }
  if (response.status < 200 || response.status >= 300) throw responseError(response)
  const responsePayload = parseJson(response.body)
  const output = claude
    ? contentText(responsePayload.content)
    : contentText((responsePayload.choices as Array<{ message?: { content?: unknown }; text?: unknown }> | undefined)?.[0]?.message?.content ?? (responsePayload.choices as Array<{ text?: unknown }> | undefined)?.[0]?.text)
  const normalizedOutput = output || streamedContent(response.body)
  if (!normalizedOutput.trim()) throw new Error('模型未返回可显示的内容，请检查模型、额度或接口兼容性。')
  return normalizedOutput.trim()
}

function systemInstruction(language: AiLanguage): string {
  const messages: Record<AiLanguage, string> = {
    zh: '你是严谨的写作、学术表达与文档审稿助手。必须依据用户提供的文档和上下文回答，不得虚构内容。',
    en: 'You are a rigorous writing, academic editing, and document-review assistant. Base every answer on the supplied document and context; never invent content.',
    ja: 'あなたは厳密な文章・学術表現・文書査読アシスタントです。提供された文書と文脈だけに基づいて回答し、内容を作らないでください。',
    ru: 'Вы — строгий помощник по письму, академическому редактированию и рецензированию документов. Основывайте ответы только на предоставленном документе и контексте и не выдумывайте содержание.',
    es: 'Es un asistente riguroso de redacción, edición académica y revisión documental. Base cada respuesta únicamente en el documento y el contexto proporcionados; no invente contenido.'
  }
  return messages[language]
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}

function safePdfName(value: string): string {
  const normalized = value.trim().replace(/[\u0000-\u001f<>:"/\\|?*]+/gu, '_') || 'document.pdf'
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`
}

export async function polishText(settings: AiSettings, instruction: string, text: string): Promise<string> {
  const { model, claude, headers } = requestCredentials(settings)
  const language = detectAiLanguage(text)
  return requestOutput(settings, claude
    ? { model, max_tokens: 1800, messages: [{ role: 'user', content: `${instruction}\n\n${language === 'zh' ? '原文' : 'Original text'}：\n${text}` }] }
    : { model, messages: [{ role: 'system', content: systemInstruction(language) }, { role: 'user', content: `${instruction}\n\n${language === 'zh' ? '原文' : 'Original text'}：\n${text}` }], temperature: 0.25 }, claude, headers)
}

export async function reviewDocument(settings: AiSettings, instruction: string, document: FullReviewDocument, mode: FullReviewSendMode, language: AiLanguage): Promise<string> {
  const { model, claude, headers } = requestCredentials(settings)
  const name = safePdfName(document.name)
  if (mode === 'text') {
    const text = document.text?.trim()
    if (!text) throw new Error('没有提取到可发送的文档文字。若文档是扫描件，请改用直接发送 PDF 文件。')
    const label = language === 'zh' ? '文档全文' : 'Full document text'
    return requestOutput(settings, claude
      ? { model, max_tokens: 6000, messages: [{ role: 'user', content: `${instruction}\n\n${label}：\n${text}` }] }
      : { model, messages: [{ role: 'system', content: systemInstruction(language) }, { role: 'user', content: `${instruction}\n\n${label}：\n${text}` }], temperature: 0.15 }, claude, headers)
  }
  if (!document.bytes.length) throw new Error('当前 PDF 文件内容为空，无法发送。')
  if (document.bytes.length > MAX_AI_PDF_BYTES) throw new Error('PDF 文件超过 40 MB，无法直接发送。请选择发送转换后的文档文字。')
  const base64 = bytesToBase64(document.bytes)
  const content = claude
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }, { type: 'text', text: instruction }]
    : [{ type: 'file', file: { filename: name, file_data: `data:application/pdf;base64,${base64}` } }, { type: 'text', text: instruction }]
  return requestOutput(settings, claude
    ? { model, max_tokens: 6000, messages: [{ role: 'user', content }] }
    : { model, messages: [{ role: 'system', content: systemInstruction(language) }, { role: 'user', content }], temperature: 0.15 }, claude, headers)
}

export async function suggestForAnnotation(settings: AiSettings, instruction: string, annotation: string, contexts: string[], language: AiLanguage): Promise<string> {
  const normalizedAnnotation = annotation.trim()
  const normalizedContexts = contexts.map((context) => context.trim()).filter(Boolean)
  if (!normalizedAnnotation) throw new Error('当前批注没有可用于生成建议的内容。')
  if (!normalizedContexts.length) throw new Error('请至少加入一段正文上下文。')
  const { model, claude, headers } = requestCredentials(settings)
  const labels: Record<AiLanguage, { annotation: string; contexts: string }> = {
    zh: { annotation: '批注要求', contexts: '正文上下文' }, en: { annotation: 'Annotation request', contexts: 'Document context' },
    ja: { annotation: '批注の要求', contexts: '本文の文脈' }, ru: { annotation: 'Требование аннотации', contexts: 'Контекст документа' }, es: { annotation: 'Requisito de la anotación', contexts: 'Contexto del documento' }
  }
  const label = labels[language]
  const input = `${instruction}\n\n${label.annotation}：\n${normalizedAnnotation}\n\n${normalizedContexts.map((context, index) => `${label.contexts} ${index + 1}：\n${context}`).join('\n\n')}`
  return requestOutput(settings, claude
    ? { model, max_tokens: 2800, messages: [{ role: 'user', content: input }] }
    : { model, messages: [{ role: 'system', content: systemInstruction(language) }, { role: 'user', content: input }], temperature: 0.2 }, claude, headers)
}
