import type { ModuleKey, Tool, ViewMode } from '../types'
import { AnnotationIcon } from './AnnotationIcon'

interface Props {
  module: ModuleKey
  activeTool: Tool
  mode: ViewMode
  exportFormat: 'png' | 'jpg' | 'eps'
  exportDpi: number
  disabled: boolean
  onTool(tool: Tool): void
  onMode(mode: ViewMode): void
  onDeletePages(): void
  onSave(saveAs?: boolean): void
  onPrint(): void
  printing: boolean
  onExport(): void
  onExportFormat(value: 'png' | 'jpg' | 'eps'): void
  onExportDpi(value: number): void
}

const ToolButton = ({ tool, activeTool, children, hint, icon, onTool }: { tool: Tool; activeTool: Tool; children: React.ReactNode; hint: string; icon?: React.ReactNode; onTool(tool: Tool): void }) => <button className={`tool-button${activeTool === tool ? ' active' : ''}${icon ? ' with-icon' : ''}`} onClick={() => onTool(activeTool === tool ? 'none' : tool)}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span></button>

export function ToolPanel(props: Props) {
  const { module, activeTool, mode, disabled, onTool } = props
  return <aside className="tool-panel">
    {module === 'view' && <section><h2>查看</h2><p className="subtitle">选择适合当前阅读场景的页面布局。</p><h3>页面布局</h3>
      <div className="segmented"><button className={mode === 'continuous' ? 'active' : ''} onClick={() => props.onMode('continuous')}>连续滚动</button><button className={mode === 'single' ? 'active' : ''} onClick={() => props.onMode('single')}>单页查看</button></div>
      <div className="info-card"><b>阅读提示</b><span>按住 Ctrl 并滚动鼠标滚轮，可以快速缩放页面。</span></div></section>}
    {module === 'edit' && <section><h2>编辑</h2><p className="subtitle">直接调整页面或添加带格式的文字内容。</p><h3>页面</h3>
      <ToolButton tool="crop" activeTool={activeTool} onTool={onTool} hint="拖动框选要保留的页面区域">框选裁切页面</ToolButton>
      <button className="danger wide" disabled={disabled} onClick={props.onDeletePages}>批量删除页面…</button><h3>内容</h3>
      <ToolButton tool="add_text" activeTool={activeTool} onTool={onTool} hint="拖出文本框后设置内容和格式">在页面上添加文字</ToolButton></section>}
    {module === 'annotate' && <section><h2>批注</h2><p className="subtitle">单击定位文字光标，拖动框选 PDF 文字；已有批注可直接右键删除。</p><h3>文本批注</h3>
      <ToolButton tool="highlight" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="highlight" />} hint="框选文字并可填写说明">文本高亮</ToolButton>
      <ToolButton tool="replace" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="replace" />} hint="框选原文并填写替换内容">文本替换标记</ToolButton>
      <ToolButton tool="delete_text" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="delete_text" />} hint="框选文字添加删除线">文本删除</ToolButton>
      <ToolButton tool="underline" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="underline" />} hint="框选文字添加下划线">文本下划线</ToolButton><h3>位置批注</h3>
      <ToolButton tool="note" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="note" />} hint="点击页面任意位置添加便笺">任意位置批注</ToolButton>
      <ToolButton tool="insert" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="insert" />} hint="在单词间点击并填写插入文字">插入文字标记</ToolButton></section>}
    {module === 'save' && <section><h2>保存</h2><p className="subtitle">保存、打印 PDF，或把每一页导出为独立文件。</p><h3>PDF</h3>
      <button className="primary wide" disabled={disabled} onClick={() => props.onSave(false)}>保存 PDF</button><button className="wide" disabled={disabled} onClick={() => props.onSave(true)}>另存为 PDF…</button><h3>打印</h3>
      <button className="wide print-button" disabled={disabled || props.printing} onClick={props.onPrint}><span>{props.printing ? '正在打开打印对话框…' : '打印当前 PDF…'}</span><kbd>Ctrl+P</kbd></button><p className="hint">包含当前尚未保存的编辑和批注。</p><h3>图片 / EPS</h3>
      <label>文件格式<select value={props.exportFormat} onChange={(event) => props.onExportFormat(event.target.value as Props['exportFormat'])}><option value="png">PNG</option><option value="jpg">JPG</option><option value="eps">EPS</option></select></label>
      <label>输出清晰度<div className="input-suffix"><input type="number" min="72" max="600" value={props.exportDpi} onChange={(event) => props.onExportDpi(Math.max(72, Math.min(600, Number(event.target.value))))} /><span>DPI</span></div></label>
      <button className="wide" disabled={disabled} onClick={props.onExport}>导出所有页面…</button><p className="hint">多页文档自动添加 _001、_002 等页码后缀。</p></section>}
  </aside>
}
