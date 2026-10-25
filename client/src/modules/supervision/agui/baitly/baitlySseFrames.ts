import { BaitlyAgUiError } from './BaitlyAgUiProtocol';

/** Candidate parser: LF, CRLF and CR, comments, multiline data, fragmented UTF-8. */
export async function* baitlySseFrames(
  body: ReadableStream<Uint8Array>, maxFrameBytes: number,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder();
  let line = '';
  let data: string[] = [];
  let size = 0;
  let afterCr = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      let text: string;
      try { text = decoder.decode(value, { stream: !done }); }
      catch { throw new BaitlyAgUiError('INVALID_STREAM'); }
      for (const char of text) {
        if (afterCr && char === '\n') { afterCr = false; continue; }
        afterCr = char === '\r';
        if (char !== '\r' && char !== '\n') {
          // Bound accumulation before JSON/Zod. Four bytes is the largest
          // UTF-8 codepoint; exact frame accounting is checked at line end.
          line += char;
          if (line.length > maxFrameBytes) throw new BaitlyAgUiError('FRAME_LIMIT');
          continue;
        }
        size += encoder.encode(line).byteLength + 1;
        if (size > maxFrameBytes) throw new BaitlyAgUiError('FRAME_LIMIT');
        if (!line) {
          if (data.length) yield data.join('\n');
          data = []; size = 0;
        } else if (line === 'data' || line.startsWith('data:')) {
          const field = line === 'data' ? '' : line.slice(5);
          data.push(field.startsWith(' ') ? field.slice(1) : field);
        }
        line = '';
      }
      if (done) {
        // A partial frame must not be treated as a complete event on EOF.
        if (line || data.length) throw new BaitlyAgUiError('INVALID_STREAM');
        return;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* no diagnostic payload */ }
    reader.releaseLock();
  }
}
