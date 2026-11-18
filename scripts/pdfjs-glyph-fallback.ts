import type { Plugin } from 'vite'

function replaceOnce(source: string, before: string, after: string) {
  const index = source.indexOf(before)
  if (index === -1 || source.indexOf(before, index + before.length) !== -1) {
    throw new Error('PDF.js glyph fallback needs to be reviewed for this PDF.js version')
  }
  return source.slice(0, index) + after + source.slice(index + before.length)
}

// The PDF can map a character to Unicode even when its embedded font has no
// outline for it. PDF.js exposes that text for copying but skips it in showText.
export function pdfjsGlyphFallback(): Plugin {
  return {
    name: 'pdfjs-glyph-fallback',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?worker&url')) return
      const file = id.split('?')[0].replaceAll('\\', '/')
      if (file.endsWith('/pdfjs-dist/build/pdf.worker.mjs')) {
        return replaceOnce(source, 'this.#glyphCache.set(charcode, glyph);', `
    // Ignore a guessed CID or an unmapped character code.
    if (!isInFont && !this.missingFile && !(this.toUnicode instanceof IdentityToUnicodeMap)) {
      const mapped = this.toUnicode.get(charcode);
      if (mapped && /[\\p{L}\\p{N}\\p{P}\\p{S}]/u.test(mapped) && !/[\\p{Cc}\\p{Cs}\\p{Co}\\p{Cn}\\uFFFD]/u.test(mapped)) {
        glyph.fallbackUnicode = mapped;
      }
    }
    this.#glyphCache.set(charcode, glyph);`)
      }
      if (file.endsWith('/pdfjs-dist/build/pdf.mjs')) {
        return replaceOnce(source, '      const charWidth = vertical ? width * widthAdvanceScale', `      if (this.contentVisible && glyph.fallbackUnicode && (needsFill || needsStroke)) {
        ctx.save();
        ctx.font = \`\${font.italic ? "italic" : "normal"} \${font.black ? "900" : font.bold ? "bold" : "normal"} \${fontSize / fontSizeScale}px \${font.fallbackName}\`;
        ctx.textAlign = "left";
        const text = glyph.fallbackUnicode;
        const advance = !vertical && width > 0 ? width * widthAdvanceScale / fontSizeScale : undefined;
        if (needsFill) {
          ctx.fillText(text, scaledX, scaledY, advance);
        }
        if (needsStroke) {
          ctx.strokeText(text, scaledX, scaledY, advance);
        }
        this.dependencyTracker?.recordCharacterBBox(opIdx, ctx, { bbox: null }, fontSize / fontSizeScale,
          scaledX, scaledY, () => ctx.measureText(text));
        ctx.restore();
      }
      const charWidth = vertical ? width * widthAdvanceScale`)
      }
    }
  }
}
