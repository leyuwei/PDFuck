import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
  className?: string
}

/** Render model output as safe GitHub-flavoured Markdown without executing raw HTML. */
export function AiMarkdown({ content, className = '' }: Props) {
  return <article className={`ai-polish-result ai-markdown ${className}`.trim()}>
    <Markdown remarkPlugins={[remarkGfm]} skipHtml>{content}</Markdown>
  </article>
}
