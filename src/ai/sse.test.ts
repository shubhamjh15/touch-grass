import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/lib/rng';
import { createSseParser, readSse, type SseEvent } from './sse';

const encoder = new TextEncoder();

function parseWhole(text: string): SseEvent[] {
  const parser = createSseParser();
  return [...parser.push(encoder.encode(text)), ...parser.end()];
}

function parseSplit(bytes: Uint8Array, cuts: number[]): SseEvent[] {
  const parser = createSseParser();
  const out: SseEvent[] = [];
  let last = 0;
  for (const cut of [...cuts, bytes.length]) {
    out.push(...parser.push(bytes.slice(last, cut)));
    last = cut;
  }
  out.push(...parser.end());
  return out;
}

const SAMPLE =
  ': comment line\r\n' +
  'event: delta\r\n' +
  'data: {"text":"héllo 🌱 日本語"}\r\n' +
  '\r\n' +
  'data: line one\n' +
  'data: line two\n' +
  'data:no space\n' +
  '\n' +
  'event: ping\rdata: cr only\r\r' +
  'id: 7\nretry: 1500\nevent: done\ndata: {"ok":true}\n\n' +
  'data\n\n' +
  'event: nodata\n\n' +
  ': trailing comment\n' +
  'data: last\n\n';

const EXPECTED: SseEvent[] = [
  { event: 'delta', data: '{"text":"héllo 🌱 日本語"}' },
  { event: 'message', data: 'line one\nline two\nno space' },
  { event: 'ping', data: 'cr only' },
  { event: 'done', data: '{"ok":true}', id: '7', retry: 1500 },
  { event: 'message', data: '', id: '7' },
  { event: 'message', data: 'last', id: '7' },
];

describe('createSseParser', () => {
  it('parses CRLF, LF and CR line endings, multi-line data, comments and ids', () => {
    expect(parseWhole(SAMPLE)).toEqual(EXPECTED);
  });

  it('ignores events with no data field', () => {
    expect(parseWhole('event: x\n\n')).toEqual([]);
  });

  it('gives the same events however the bytes are split: every two-way cut', () => {
    const bytes = encoder.encode(SAMPLE);
    for (let cut = 0; cut <= bytes.length; cut += 1) {
      expect(parseSplit(bytes, [cut])).toEqual(EXPECTED);
    }
  });

  it('gives the same events one byte at a time', () => {
    const bytes = encoder.encode(SAMPLE);
    const cuts = Array.from({ length: bytes.length - 1 }, (_, i) => i + 1);
    expect(parseSplit(bytes, cuts)).toEqual(EXPECTED);
  });

  it('gives the same events for many random multi-way splits', () => {
    const bytes = encoder.encode(SAMPLE);
    const random = mulberry32(2026);
    for (let round = 0; round < 200; round += 1) {
      const count = 1 + Math.floor(random() * 8);
      const cuts = [
        ...new Set(Array.from({ length: count }, () => Math.floor(random() * bytes.length))),
      ].sort((a, b) => a - b);
      expect(parseSplit(bytes, cuts)).toEqual(EXPECTED);
    }
  });

  it('keeps a multi-byte character intact when it is split inside its UTF-8 bytes', () => {
    const bytes = encoder.encode('data: 🌱\n\n');
    // The seedling emoji is four bytes: cut after the first, second and third.
    for (const cut of [7, 8, 9]) {
      expect(parseSplit(bytes, [cut])).toEqual([{ event: 'message', data: '🌱' }]);
    }
  });

  it('waits for the LF when a chunk ends in CR, without producing an extra blank line', () => {
    const parser = createSseParser();
    expect(parser.push('data: a\r')).toEqual([]);
    expect(parser.push('\n\r\n')).toEqual([{ event: 'message', data: 'a' }]);
    expect(parser.end()).toEqual([]);
  });

  it('treats a final lone CR as a line end', () => {
    const parser = createSseParser();
    expect(parser.push('data: a\r\r')).toEqual([]);
    expect(parser.end()).toEqual([{ event: 'message', data: 'a' }]);
  });

  it('discards an event cut off before its blank line', () => {
    const parser = createSseParser();
    expect(parser.push('data: partial')).toEqual([]);
    expect(parser.end()).toEqual([]);
  });

  it('strips a leading byte order mark once', () => {
    expect(parseWhole('﻿data: a\n\n')).toEqual([{ event: 'message', data: 'a' }]);
    expect(parseWhole('data: ﻿b\n\n')).toEqual([{ event: 'message', data: '﻿b' }]);
  });

  it('accepts string chunks as well as bytes', () => {
    const parser = createSseParser();
    expect([...parser.push('event: a\nda'), ...parser.push('ta: 1\n\n')]).toEqual([
      { event: 'a', data: '1' },
    ]);
  });

  it('removes only one space after the colon and keeps the rest of the value', () => {
    expect(parseWhole('data:   spaced\n\n')).toEqual([{ event: 'message', data: '  spaced' }]);
  });

  it('ignores unknown fields and invalid retry values', () => {
    expect(parseWhole('foo: bar\nretry: soon\ndata: x\n\n')).toEqual([
      { event: 'message', data: 'x' },
    ]);
  });

  it('handles a very long data line', () => {
    const long = 'x'.repeat(200_000);
    const events = parseSplit(encoder.encode(`data: ${long}\n\n`), [50_000, 120_000]);
    expect(events[0]?.data.length).toBe(200_000);
  });
});

describe('readSse', () => {
  const streamOf = (chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
      cancel: onCancel,
    });

  it('yields events from a stream split mid-character', async () => {
    const bytes = encoder.encode(SAMPLE);
    const stream = streamOf([bytes.slice(0, 40), bytes.slice(40, 41), bytes.slice(41)]);
    const events: SseEvent[] = [];
    for await (const event of readSse(stream)) events.push(event);
    expect(events).toEqual(EXPECTED);
  });

  it('cancels the underlying reader when the consumer stops early', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: one\n\ndata: two\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const event of readSse(stream)) {
      expect(event.data).toBe('one');
      break;
    }
    expect(cancelled).toBe(true);
  });

  it('stops when the signal aborts', async () => {
    let cancelled = false;
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('data: one\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const seen: string[] = [];
    for await (const event of readSse(stream, controller.signal)) {
      seen.push(event.data);
      controller.abort();
    }
    expect(seen).toEqual(['one']);
    expect(cancelled).toBe(true);
  });
});
