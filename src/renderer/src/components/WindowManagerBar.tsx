import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { fileDirectory, stablePathColor } from '../lib/document-insights'
import { translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'

interface Props {
  snapshot: DocumentTabsSnapshot
  onFocus(id: number): void
  onCreate(): void
  onClose(id: number): void
}

export function WindowManagerBar({ snapshot, onFocus, onCreate, onClose }: Props) {
  useInterfaceLanguage()
  return <section className="window-manager-bar" aria-label={ui('PDF 文档标签管理', 'PDF document tabs')}>
    <div className="window-manager-heading"><span className="windows-glyph" />{ui('文档标签', 'Document Tabs')}<em>{snapshot.documents.length}</em></div>
    <div className="window-tabs">
      {snapshot.documents.map((document) => {
        const current = document.id === snapshot.currentId
        const directory = fileDirectory(document.filePath)
        const status = document.dirty ? ui('未保存', 'Unsaved') : document.hasDocument ? ui('已保存', 'Saved') : ui('未打开', 'Not Open')
        const title = translateUiText(document.title)
        return <div key={document.id} className={`window-tab${current ? ' current' : ''}`} role="button" tabIndex={0} title={`${title}\n${ui('目录：', 'Folder: ')}${directory || ui('未保存到磁盘', 'Not saved to disk')}\n${ui('状态：', 'Status: ')}${status}`}
          onClick={() => onFocus(document.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFocus(document.id) }}>
          <span className="window-tab-icon" style={{ '--tab-pdf-color': stablePathColor(document.filePath) } as React.CSSProperties}>PDF</span>
          <span className="window-tab-name">{title}</span>
          {document.encrypted && <span className="window-encrypted-badge" title={ui('密码保护的只读文档', 'Password-protected read-only document')}>{ui('加密', 'Encrypted')}</span>}
          {document.dirty && <span className="window-dirty-dot" title={ui('有未保存修改', 'Has unsaved changes')} />}
          <button type="button" className="window-tab-close" aria-label={`${ui('关闭', 'Close')} ${title}`} title={ui('关闭文档标签', 'Close document tab')}
            onClick={(event) => { event.stopPropagation(); onClose(document.id) }}>×</button>
        </div>
      })}
    </div>
    <button type="button" className="new-window-button" onClick={onCreate} title={ui('在当前窗口打开另一份 PDF', 'Open another PDF in this window')}><span>＋</span> {ui('打开 PDF', 'Open PDF')}</button>
  </section>
}
