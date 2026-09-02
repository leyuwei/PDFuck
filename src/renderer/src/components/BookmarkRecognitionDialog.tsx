import { useEffect, useMemo, useState } from 'react'
import { bookmarkTreeFromCandidates, DEFAULT_BOOKMARK_RULES, removeRecognizedCandidate, type BookmarkRecognitionOptions, type BookmarkRuleId, type RecognizedBookmark } from '../lib/bookmark-recognition'
import type { PdfBookmark } from '../types'
import { t as message, translateUiText, ui, useInterfaceLanguage, type TranslationKey } from '../lib/i18n'
import './bookmark-recognition-dialog.css'

export type BookmarkWriteMode = 'append' | 'replace'

interface Props {
  existingCount: number
  onPreview(options: BookmarkRecognitionOptions): Promise<RecognizedBookmark[]>
  onCancel(): void
  onApply(bookmarks: PdfBookmark[], mode: BookmarkWriteMode): void | Promise<void>
  onDeleteAll(): void | Promise<void>
}

const RULES: Array<{ id: BookmarkRuleId; title: TranslationKey; description: TranslationKey; sample: TranslationKey }> = [
  { id: 'decimal', title: "ui.multilevelAndRomanNumerals", description: "ui.recognizesArabicDigitsLocalizedDigitCharactersAndMultilevelDecimalNumbering", sample: "ui.message112123Iv" },
  { id: 'localized', title: "ui.localizedWrittenNumbers", description: "ui.recognizesFormalChineseNumeralsParenthesizedIndicesAndJapaneseKoreanAnd", sample: "ui.message2" },
  { id: 'chapters', title: "ui.chaptersPartsAndAppendices", description: "ui.coversCommonChapterFormsInChineseEnglishJapaneseKoreanRussian", sample: "ui.chapter2IvCapTulo5" },
  { id: 'headings', title: "ui.commonHeadingTerms", description: "ui.recognizesMultilingualHeadingsSuchAsAbstractIntroductionMethodsConclusionAnd", sample: "ui.introduction" },
  { id: 'typography', title: "ui.typographyAssistance", description: "ui.conservativelyRecognizesShortNonSentenceHeadingsThatAreClearlyLarger", sample: "ui.shortHeadingInLargeType" }
]

export function BookmarkRecognitionDialog({ existingCount, onPreview, onCancel, onApply, onDeleteAll }: Props) {
  useInterfaceLanguage()
  const [rules, setRules] = useState<BookmarkRuleId[]>(DEFAULT_BOOKMARK_RULES)
  const [maxDepth, setMaxDepth] = useState(3)
  const [customKeywords, setCustomKeywords] = useState('')
  const [mode, setMode] = useState<BookmarkWriteMode>(existingCount ? 'append' : 'replace')
  const [candidates, setCandidates] = useState<RecognizedBookmark[]>()
  const [scannedCandidates, setScannedCandidates] = useState<RecognizedBookmark[]>()
  const [scanning, setScanning] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const options = useMemo<BookmarkRecognitionOptions>(() => ({ rules, maxDepth, customKeywords }), [customKeywords, maxDepth, rules])
  const markStale = () => { setCandidates(undefined); setScannedCandidates(undefined); setError('') }
  const scan = async () => {
    if (!rules.length && !customKeywords.trim()) { setCandidates([]); return }
    setScanning(true); setError('')
    try { const found = await onPreview(options); setScannedCandidates(found); setCandidates(found) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setCandidates(undefined); setScannedCandidates(undefined) } finally { setScanning(false) }
  }
  useEffect(() => { void scan() }, []) // Scan once with safe defaults; later changes are applied explicitly.
  const toggleRule = (id: BookmarkRuleId) => { setRules((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); markStale() }
  const commit = async (action: () => void | Promise<void>) => {
    if (committing) return
    setCommitting(true)
    try { await action() } finally { setCommitting(false) }
  }
  return <div className="modal-backdrop bookmark-recognition-backdrop"><div className="modal bookmark-recognition-dialog" role="dialog" aria-modal="true" aria-labelledby="bookmark-recognition-title">
    <header className="bookmark-recognition-heading"><div><span className="bookmark-recognition-icon" aria-hidden="true">⌑</span><div><h2 id="bookmark-recognition-title">{ui("ui.recognizeBookmarks")}</h2><p>{ui("ui.detectHeadingLevelsFromTextAndTypographyThenWriteStandard")}</p></div></div><button type="button" onClick={onCancel} aria-label={ui("ui.closeBookmarkRecognition")}>×</button></header>
    <div className="bookmark-recognition-body"><section className="bookmark-rule-settings"><div className="bookmark-section-title"><b>{ui("ui.recognitionRules")}</b><small>{ui("ui.combineRulesAsNeededDisableUnsuitableRulesToReduceFalse")}</small></div><div className="bookmark-rule-grid">{RULES.map((rule) => <button type="button" key={rule.id} className={rules.includes(rule.id) ? 'active' : ''} role="switch" aria-checked={rules.includes(rule.id)} onClick={() => toggleRule(rule.id)}><i aria-hidden="true"><span /></i><span><b>{ui(rule.title)}</b><small>{ui(rule.description)}</small><em>{ui(rule.sample)}</em></span></button>)}</div>
      <label className="bookmark-depth-control"><span><b>{ui("ui.maximumBookmarkDepth")}</b><small>{ui("ui.numberedHeadingsDeeperThanThisLevelWillNotBeWritten")}</small></span><input type="range" min={1} max={6} step={1} value={maxDepth} aria-label={ui("ui.maximumBookmarkDepth")} onChange={(event) => { setMaxDepth(Number(event.target.value)); markStale() }} /><output>{message('bookmark.depth', { depth: maxDepth })}</output></label>
      <label className="bookmark-custom-keywords"><span><b>{ui("ui.additionalHeadingTerms")}</b><small>{ui("ui.onePerLineAddRecurringHeadingsUsedBySpecialistDocuments")}</small></span><textarea value={customKeywords} placeholder={ui("ui.forExampleDataAvailabilityEthicsStatementTerminology")} onChange={(event) => { setCustomKeywords(event.target.value); markStale() }} /></label>
      {existingCount > 0 && <div className="bookmark-write-mode"><span><b>{ui("ui.existingBookmarks")}</b><small>{message('bookmark.existing', { count: existingCount })}</small></span><div className="segmented"><button type="button" className={mode === 'append' ? 'active' : ''} onClick={() => setMode('append')}>{ui("ui.keepAndAppend")}</button><button type="button" className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>{ui("ui.replaceExisting")}</button></div></div>}
    </section><section className="bookmark-recognition-preview"><header><div><b>{ui("ui.recognitionPreview")}</b><small>{candidates ? message('bookmark.recognized', { count: candidates.length }) : ui("ui.rulesChangedRunRecognitionAgain")}</small></div><span className="bookmark-preview-actions">{candidates && scannedCandidates && candidates.length < scannedCandidates.length && <button type="button" onClick={() => setCandidates(scannedCandidates)}>{ui("ui.restoreRemoved")}</button>}<button type="button" disabled={scanning} onClick={() => void scan()}>{scanning ? ui("ui.recognizing") : ui("ui.recognizeAgain")}</button></span></header>
      <div className="bookmark-preview-list">{scanning ? <div className="bookmark-scanning"><i /><b>{ui("ui.analyzingHeadingsPageByPage")}</b><small>{ui("ui.largeDocumentsMayTakeAMoment")}</small></div> : error ? <div className="bookmark-preview-empty error">{ui("ui.recognitionFailed")}<small>{translateUiText(error)}</small></div> : candidates?.length ? candidates.map((item) => <div key={item.id} className="bookmark-preview-row" style={{ '--preview-indent': `${Math.max(0, item.level - 1) * 12}px` } as React.CSSProperties}><i>{item.level}</i><span><b>{item.title}</b><small>{message('bookmark.previewPage', { page: item.pageIndex + 1 })}</small></span><button type="button" className="bookmark-preview-remove" onClick={() => setCandidates((current) => removeRecognizedCandidate(current || [], item.id))} aria-label={`${ui("ui.removeFromRecognitionPreview")}“${item.title}”`} title={ui("ui.removeThisItemFromThePreview")}>×</button></div>) : <div className="bookmark-preview-empty"><b>{candidates ? ui("ui.noHeadingsMatchedTheRules") : ui("ui.waitingToRecognizeAgain")}</b><small>{ui("ui.enableMoreRulesIncreaseTheDepthOrAddHeadingTerms")}</small></div>}</div>
    </section></div>
    <footer className="bookmark-recognition-actions"><div>{existingCount > 0 && (deleteArmed ? <span className="bookmark-delete-confirm"><b>{ui("ui.deleteEveryBookmarkInThisDocument")}</b><button type="button" disabled={committing} onClick={() => setDeleteArmed(false)}>{ui("ui.cancel")}</button><button type="button" className="danger" disabled={committing} onClick={() => void commit(onDeleteAll)}>{ui("ui.confirmDelete")}</button></span> : <button type="button" className="bookmark-delete-all" disabled={committing} onClick={() => setDeleteArmed(true)}>{ui("ui.deleteAllBookmarks")}</button>)}</div><div><button type="button" disabled={committing} onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={!candidates?.length || scanning || committing} onClick={() => void commit(() => onApply(bookmarkTreeFromCandidates(candidates || []), mode))}>{committing ? '…' : candidates?.length ? message('bookmark.write', { count: candidates.length }) : ui("ui.writeBookmarks")}</button></div></footer>
  </div></div>
}
