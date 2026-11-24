import type { Plugin } from 'vite'
import { LARGE_PDF_THRESHOLD, PDF_RANGE_CHUNK_SIZE, PDF_RANGE_REQUEST_BYTES } from '../src/shared/contracts'

function replaceOnce(source: string, before: string, after: string) {
  const index = source.indexOf(before)
  if (index === -1 || source.indexOf(before, index + before.length) !== -1) {
    throw new Error('PDF.js build patches need to be reviewed for this PDF.js version')
  }
  return source.slice(0, index) + after + source.slice(index + before.length)
}

// The upstream range reader allocates a contiguous array the size of the PDF.
// This reader is selected only for the app's on-demand large-file path.
function sparsePdfRanges(source: string): string {
  let worker = replaceOnce(source, 'class ChunkedStream extends Stream {', `
class SparsePdfBytes {
  constructor(length, chunkSize) {
    this.length = this.byteLength = length;
    this.chunkSize = chunkSize;
    this.chunks = new Map();
    this.imageChunks = new Set();
  }
  set(bytes, begin) {
    let offset = 0;
    while (offset < bytes.length) {
      const position = begin + offset;
      const index = Math.floor(position / this.chunkSize);
      const start = index * this.chunkSize;
      let chunk = this.chunks.get(index);
      if (!chunk) {
        chunk = new Uint8Array(Math.min(this.chunkSize, this.length - start));
        this.chunks.set(index, chunk);
      }
      const relative = position - start;
      const count = Math.min(bytes.length - offset, chunk.length - relative);
      if (count <= 0) throw new Error("pdf.largeReadFailed");
      chunk.set(bytes.subarray(offset, offset + count), relative);
      offset += count;
    }
  }
  get(position) {
    const index = Math.floor(position / this.chunkSize);
    return this.chunks.get(index)?.[position - index * this.chunkSize];
  }
  subarray(begin, end) {
    if (end <= begin) return new Uint8Array(0);
    if (end - begin > ${PDF_RANGE_REQUEST_BYTES}) throw new Error("pdf.largeReadLimit");
    const first = Math.floor(begin / this.chunkSize);
    const last = Math.floor((end - 1) / this.chunkSize);
    const relative = begin - first * this.chunkSize;
    if (first === last) return this.chunks.get(first).subarray(relative, relative + end - begin);
    const bytes = new Uint8Array(end - begin);
    let offset = 0;
    for (let index = first; index <= last; index++) {
      const chunk = this.chunks.get(index);
      const start = index === first ? relative : 0;
      const count = Math.min(chunk.length - start, bytes.length - offset);
      bytes.set(chunk.subarray(start, start + count), offset);
      offset += count;
    }
    return bytes;
  }
}
class ChunkedStream extends Stream {`)
  worker = replaceOnce(worker, `    super(new Uint8Array(length), 0, length, null);
    this.chunkSize = chunkSize;`, `    const sparse = manager.disableAutoFetch && chunkSize === ${PDF_RANGE_CHUNK_SIZE} && length >= ${LARGE_PDF_THRESHOLD};
    super(new Uint8Array(sparse ? 0 : length), 0, length, null);
    if (sparse) this.bytes = new SparsePdfBytes(length, chunkSize);
    this.chunkSize = chunkSize;`)
  worker = replaceOnce(worker, `    this.stream = new ChunkedStream(this.length, this.chunkSize, this);
    this.pdfStream = pdfStream;
    this.disableAutoFetch = args.disableAutoFetch;`, `    this.disableAutoFetch = args.disableAutoFetch;
    this.stream = new ChunkedStream(this.length, this.chunkSize, this);
    this.pdfStream = pdfStream;`)
  worker = replaceOnce(worker, `    return this.bytes[this.pos++];
  }
  getBytes(length) {
    const pos = this.pos;
    const endPos = !length ? this.end : Math.min(pos + length, this.end);
    if (endPos > this.progressiveDataLength)`, `    this.pos++;
    return this.bytes instanceof SparsePdfBytes ? this.bytes.get(pos) : this.bytes[pos];
  }
  clone() {
    return this.bytes instanceof SparsePdfBytes
      ? this.makeSubStream(this.start, this.length, this.dict?.clone())
      : super.clone();
  }
  getBytes(length) {
    const pos = this.pos;
    const endPos = !length ? this.end : Math.min(pos + length, this.end);
    if (endPos > this.progressiveDataLength)`)
  worker = replaceOnce(worker, `  requestAllChunks(noFetch = false) {
    if (!noFetch) {`, `  requestAllChunks(noFetch = false) {
    if (!noFetch) {
      if (this.stream.bytes instanceof SparsePdfBytes) return Promise.reject(new Error("pdf.largeReadLimit"));`)
  worker = replaceOnce(worker, `  ensureRange(begin, end) {
    if (begin >= end) {`, `  ensureRange(begin, end) {
    if (this.bytes instanceof SparsePdfBytes && end - begin > ${PDF_RANGE_REQUEST_BYTES}) throw new Error("pdf.largeReadLimit");
    if (begin >= end) {`)
  worker = replaceOnce(worker, `    function ChunkedStreamSubstream() {}`, `    if (this.bytes instanceof SparsePdfBytes && length >= 1024 * 1024 && isName(dict?.getRaw("Subtype"), "Image")) {
      const first = Math.ceil(start / this.chunkSize);
      const end = Math.floor((start + length) / this.chunkSize);
      for (let index = first; index < end; index++) this.bytes.imageChunks.add(index);
    }
    function ChunkedStreamSubstream() {}`)
  worker = replaceOnce(worker, `    function finishWorkerTask(task) {
      task.finish();
      WorkerTasks.delete(task);
    }`, `    let sparseTrimTimer;
    function finishWorkerTask(task) {
      task.finish();
      WorkerTasks.delete(task);
      const manager = pdfManager?.streamManager;
      const stream = manager?.stream;
      if (!(stream?.bytes instanceof SparsePdfBytes)) return;
      const keep = Math.floor(64 * 1024 * 1024 / stream.chunkSize);
      if (stream.bytes.chunks.size <= keep) return;
      clearTimeout(sparseTrimTimer);
      sparseTrimTimer = setTimeout(() => {
        if (terminated || WorkerTasks.size || manager._requestsByChunk.size) return;
        for (const index of stream.bytes.chunks.keys()) {
          if (stream.bytes.chunks.size <= keep) break;
          // Resources re-request these image ranges before the next render.
          // Preserve shared chunks and cached content, fonts and page indexes.
          if (!stream.bytes.imageChunks.has(index)) continue;
          stream.bytes.chunks.delete(index);
          stream._loadedChunks.delete(index);
          if (stream._lastSuccessfulEnsureByteChunk === index) stream._lastSuccessfulEnsureByteChunk = -1;
        }
      }, 150);
    }`)
  return replaceOnce(worker, 'new Uint8Array(stream.bytes.buffer, stream.start, stream.end - stream.start);',
    'stream.bytes instanceof SparsePdfBytes ? stream.getByteRange(stream.start, stream.end) : new Uint8Array(stream.bytes.buffer, stream.start, stream.end - stream.start);')
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
        return sparsePdfRanges(replaceOnce(source, 'this.#glyphCache.set(charcode, glyph);', `
    // Ignore a guessed CID or an unmapped character code.
    if (!isInFont && !this.missingFile && !(this.toUnicode instanceof IdentityToUnicodeMap)) {
      const mapped = this.toUnicode.get(charcode);
      if (mapped && /[\\p{L}\\p{N}\\p{P}\\p{S}]/u.test(mapped) && !/[\\p{Cc}\\p{Cs}\\p{Co}\\p{Cn}\\uFFFD]/u.test(mapped)) {
        glyph.fallbackUnicode = mapped;
      }
    }
    this.#glyphCache.set(charcode, glyph);`))
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
