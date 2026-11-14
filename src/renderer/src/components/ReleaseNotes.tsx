import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ui } from '../lib/i18n'

export function ReleaseNotes({ content, version }: { content?: string; version?: string }) {
  return <section className="release-notes" aria-label={ui('update.releaseNotes')}>
    <h3>{ui('update.releaseNotes')}{version && <bdi> · {version}</bdi>}</h3>
    <div className="release-notes-content ai-markdown" tabIndex={0}>
      {content?.trim() ? <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}>{content}</Markdown> : <p>{ui('update.noReleaseNotes')}</p>}
    </div>
  </section>
}
