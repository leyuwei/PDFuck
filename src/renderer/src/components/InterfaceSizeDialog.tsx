import { useLayoutEffect, useState } from 'react'
import { ScrollWindow } from './ScrollWindow'
import { useFloatingWindow } from '../lib/floating-window'
import { applyInterfaceSize, interfaceFontSizes, INTERFACE_SIZES, INTERFACE_SIZE_LABELS, savedInterfaceSize, saveInterfaceSize } from '../lib/interface-size'
import { ui, useInterfaceLanguage } from '../lib/i18n'

export function InterfaceSizeDialog({ theme, onClose }: { theme: 'light' | 'dark'; onClose(): void }) {
  useInterfaceLanguage()
  const [size, setSize] = useState(savedInterfaceSize)
  const fonts = interfaceFontSizes(size)
  const floating = useFloatingWindow(true)
  useLayoutEffect(() => { applyInterfaceSize(size); return () => applyInterfaceSize(savedInterfaceSize()) }, [size])
  return <div className={`modal-backdrop interface-size-backdrop theme-${theme}`} onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="modal interface-size-dialog" role="dialog" aria-modal="true" aria-labelledby="interface-size-title">
      <header {...floating.dragHandlers}><h2 id="interface-size-title">{ui('ui.interfaceFontSize')}</h2><button type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
      <p>{ui('ui.interfaceFontPreviewHint')}</p>
      <div className="segmented interface-size-options" role="group" aria-label={ui('ui.interfaceFontSize')}>{INTERFACE_SIZES.map((value, index) => <button autoFocus={size === value} type="button" key={value} aria-pressed={size === value} className={size === value ? 'active' : ''} onClick={() => setSize(value)}>{ui(INTERFACE_SIZE_LABELS[index])}</button>)}</div>
      <div className="interface-size-preview"><h3>{ui('ui.typographyTitle')} · {fonts.title}</h3><p>{ui('ui.typographyBody')} · {fonts.body}</p><small>{ui('ui.typographyCaption')} · {fonts.small}</small></div>
      <div className="modal-actions"><button type="button" onClick={onClose}>{ui('ui.cancel')}</button><button type="button" className="primary" onClick={() => { saveInterfaceSize(size); onClose() }}>{ui('ui.confirm')}</button></div>
    </ScrollWindow>
  </div>
}
