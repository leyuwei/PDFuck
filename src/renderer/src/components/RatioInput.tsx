import { useState, type CSSProperties } from 'react'
import { isImeCompositionKey } from '../lib/keyboard-input'
import { parseLocalizedRatio } from '../lib/rendering'

interface RatioInputProps {
  value: number
  min: number
  max: number
  onCommit(value: number): void
  decimals?: number
  suffix?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  'aria-label'?: string
}

export function RatioInput({value,min,max,onCommit,decimals,suffix='',className,style,disabled,'aria-label': label}: RatioInputProps) {
  const [draft,setDraft] = useState<string>()
  const factor = 10 ** (decimals ?? 0)
  const format = (number: number) => decimals === undefined ? number : Math.round(number * factor) / factor
  return <input type="text" inputMode="decimal" dir="ltr" aria-label={label} className={className} style={style} disabled={disabled}
    value={draft ?? `${format(value)}${suffix}`}
    onFocus={event=>event.currentTarget.select()}
    onChange={event=>setDraft(event.currentTarget.value)}
    onBlur={()=>{
      const number = draft === undefined ? undefined : parseLocalizedRatio(draft)
      if (number !== undefined) onCommit(format(Math.max(min,Math.min(max,number))))
      setDraft(undefined)
    }}
    onKeyDown={event=>{
      if (isImeCompositionKey(event.nativeEvent)) return
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.blur()
      } else if (event.key === 'Escape' && draft !== undefined) {
        event.preventDefault()
        event.stopPropagation()
        setDraft(undefined)
      }
    }} />
}
