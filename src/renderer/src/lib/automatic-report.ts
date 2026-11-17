import type { AutomaticAnnotationModelResponse } from './automatic-annotation'
import type { TranslationKey } from './i18n'

export function automaticReportSection(title: string, page: string, response: AutomaticAnnotationModelResponse, text: (key: TranslationKey) => string): string {
  const actions = { highlight: 'ui.highlightText', replace: 'ui.replaceText', delete: 'ui.deleteText', underline: 'ui.underlineText', insert: 'ui.insertText', note: 'ui.note' } as const
  const summary = response.contextSummary ? `### ${text('report.summary')}\n\n${response.contextSummary}\n\n` : ''
  const findings = response.findings.map((finding, index) => `### ${index + 1}. ${text(actions[finding.action])}\n\n**${text('report.original')}**\n\n${finding.quote.split('\n').map(line => `> ${line}`).join('\n')}\n\n${finding.replacementText ? `**${text('report.suggestion')}**\n\n${finding.replacementText}\n\n` : ''}**${text('ui.reason')}**\n\n${finding.reason}`).join('\n\n---\n\n')
  return `\n\n## ${title} · ${page}\n\n${summary}${findings || text('report.noFindings')}`
}
