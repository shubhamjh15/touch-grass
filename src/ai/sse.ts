/**
 * An incremental Server-Sent Events parser following the WHATWG rules: chunks
 * may split anywhere (including inside a UTF-8 sequence or between the CR and
 * LF of a CRLF), lines end in CRLF, LF or CR, several `data:` lines join with
 * newlines, comments start with a colon, and an event is only complete at a
 * blank line.
 */

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface SseParser {
  /** Feed raw bytes or text; returns the events completed by this chunk. */
  push(chunk: Uint8Array | string): SseEvent[];
  /** Signals end of stream. An event cut off before its blank line is discarded, as the spec says. */
  end(): SseEvent[];
}

export function createSseParser(): SseParser {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let started = false;
  let eventName = '';
  let dataLines: string[] = [];
  let lastId: string | undefined;
  let retry: number | undefined;

  const events: SseEvent[] = [];

  const dispatch = (): void => {
    if (dataLines.length > 0) {
      const event: SseEvent = { event: eventName || 'message', data: dataLines.join('\n') };
      if (lastId !== undefined) event.id = lastId;
      if (retry !== undefined) event.retry = retry;
      events.push(event);
    }
    eventName = '';
    dataLines = [];
    retry = undefined;
  };

  const processLine = (line: string): void => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    switch (field) {
      case 'event':
        eventName = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) lastId = value;
        break;
      case 'retry':
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      default:
        break;
    }
  };

  const drain = (final: boolean): void => {
    let start = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const char = buffer[i];
      if (char !== '\n' && char !== '\r') continue;
      // A trailing CR might be the first half of CRLF: wait for the next chunk.
      if (char === '\r' && i === buffer.length - 1 && !final) break;
      processLine(buffer.slice(start, i));
      if (char === '\r' && buffer[i + 1] === '\n') i += 1;
      start = i + 1;
    }
    buffer = buffer.slice(start);
  };

  const take = (): SseEvent[] => events.splice(0, events.length);

  const append = (text: string): void => {
    if (!started && text !== '') {
      started = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    buffer += text;
  };

  return {
    push(chunk) {
      // `stream: true` keeps a split multi-byte sequence until its remaining bytes arrive.
      append(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
      drain(false);
      return take();
    },
    end() {
      append(decoder.decode());
      drain(true);
      buffer = '';
      dataLines = [];
      return take();
    },
  };
}

/** Reads an SSE response body to completion, yielding events as they arrive. */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent, void, undefined> {
  const reader = body.getReader();
  const parser = createSseParser();
  const cancel = (): void => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield* parser.push(value);
    }
    yield* parser.end();
  } finally {
    signal?.removeEventListener('abort', cancel);
    cancel();
  }
}
