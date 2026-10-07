import { expect, it } from 'vitest'
import { inlineMarkdownImages, renderMarkdownPdf } from './markdown'
import { MARKDOWN_PRESETS, type MarkdownRenderRequest } from '../shared/markdown'

it('renders unsaved text without a filesystem path and refuses relative disk images until saved', async () => {
  expect(await inlineMarkdownImages('<p>Blank</p>', 'missing/Untitled.md', true)).toBe('<p>Blank</p>')
  expect(await inlineMarkdownImages('<img src="image.png" alt="local">', 'missing/Untitled.md', true)).toBe('<span class="image-unavailable">local</span>')
})

it('rejects malformed unsaved flags at the render boundary', async () => {
  await expect(renderMarkdownPdf({ html: '', sourcePath: 'Untitled.md', options: MARKDOWN_PRESETS.clean, unsaved: 'yes' } as unknown as MarkdownRenderRequest)).rejects.toThrow('md.invalid')
})
