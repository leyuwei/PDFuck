import type { DocumentTabsSnapshot } from '../../../shared/contracts'

interface Props {
  snapshot: DocumentTabsSnapshot
  onFocus(id: number): void
  onCreate(): void
  onClose(id: number): void
}

export function WindowManagerBar({ snapshot, onFocus, onCreate, onClose }: Props) {
  return <section className="window-manager-bar" aria-label="PDF 文档标签管理">
    <div className="window-manager-heading"><span className="windows-glyph" />文档标签<em>{snapshot.documents.length}</em></div>
    <div className="window-tabs">
      {snapshot.documents.map((document) => {
        const current = document.id === snapshot.currentId
        return <div key={document.id} className={`window-tab${current ? ' current' : ''}`} role="button" tabIndex={0} title={`${document.title}${document.dirty ? '（未保存）' : ''}`}
          onClick={() => onFocus(document.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFocus(document.id) }}>
          <span className="window-tab-icon">PDF</span>
          <span className="window-tab-name">{document.title}</span>
          {document.encrypted && <span className="window-encrypted-badge" title="密码保护的只读文档">加密</span>}
          {document.dirty && <span className="window-dirty-dot" title="有未保存修改" />}
          <button type="button" className="window-tab-close" aria-label={`关闭 ${document.title}`} title="关闭文档标签"
            onClick={(event) => { event.stopPropagation(); onClose(document.id) }}>×</button>
        </div>
      })}
    </div>
    <button type="button" className="new-window-button" onClick={onCreate} title="在当前窗口打开另一份 PDF"><span>＋</span> 打开 PDF</button>
  </section>
}
