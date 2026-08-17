/** Tiny PNG encoder + bitmap text for 1200×630 share cards. */

const W = 1200;
const H = 630;

const PAPER = [0xf4, 0xf0, 0xe6] as const;
const INK = [0x1b, 0x1a, 0x17] as const;
const STAMP = [0xc4, 0x49, 0x2c] as const;
const GRAPHITE = [0xa3, 0x9e, 0x93] as const;

// 5×7 glyphs, bits top-to-bottom then left-to-right columns packed in bytes.
const GLYPHS: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0],
  A: [0x3e, 0x09, 0x09, 0x09, 0x3e],
  B: [0x3f, 0x25, 0x25, 0x25, 0x1a],
  C: [0x1e, 0x21, 0x21, 0x21, 0x12],
  D: [0x3f, 0x21, 0x21, 0x21, 0x1e],
  E: [0x3f, 0x25, 0x25, 0x21, 0x21],
  F: [0x3f, 0x05, 0x05, 0x01, 0x01],
  G: [0x1e, 0x21, 0x25, 0x25, 0x1d],
  H: [0x3f, 0x04, 0x04, 0x04, 0x3f],
  I: [0x21, 0x21, 0x3f, 0x21, 0x21],
  J: [0x10, 0x20, 0x20, 0x20, 0x1f],
  K: [0x3f, 0x04, 0x0a, 0x11, 0x20],
  L: [0x3f, 0x20, 0x20, 0x20, 0x20],
  M: [0x3f, 0x02, 0x04, 0x02, 0x3f],
  N: [0x3f, 0x02, 0x04, 0x08, 0x3f],
  O: [0x1e, 0x21, 0x21, 0x21, 0x1e],
  P: [0x3f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x1e, 0x21, 0x29, 0x11, 0x2e],
  R: [0x3f, 0x09, 0x19, 0x29, 0x26],
  S: [0x22, 0x25, 0x25, 0x25, 0x19],
  T: [0x01, 0x01, 0x3f, 0x01, 0x01],
  U: [0x1f, 0x20, 0x20, 0x20, 0x1f],
  V: [0x0f, 0x10, 0x20, 0x10, 0x0f],
  W: [0x3f, 0x10, 0x0c, 0x10, 0x3f],
  X: [0x31, 0x0a, 0x04, 0x0a, 0x31],
  Y: [0x03, 0x04, 0x38, 0x04, 0x03],
  Z: [0x31, 0x29, 0x25, 0x23, 0x21],
  "0": [0x1e, 0x29, 0x25, 0x23, 0x1e],
  "1": [0x00, 0x22, 0x3f, 0x20, 0x00],
  "2": [0x32, 0x29, 0x25, 0x25, 0x22],
  "3": [0x11, 0x21, 0x25, 0x25, 0x1b],
  "4": [0x0c, 0x0a, 0x09, 0x3f, 0x08],
  "5": [0x17, 0x25, 0x25, 0x25, 0x19],
  "6": [0x1e, 0x25, 0x25, 0x25, 0x18],
  "7": [0x01, 0x31, 0x09, 0x05, 0x03],
  "8": [0x1a, 0x25, 0x25, 0x25, 0x1a],
  "9": [0x06, 0x29, 0x29, 0x29, 0x1e],
  ".": [0x00, 0x20, 0x00, 0x00, 0x00],
  ":": [0x00, 0x00, 0x14, 0x00, 0x00],
  "/": [0x20, 0x10, 0x08, 0x04, 0x02],
  "-": [0x04, 0x04, 0x04, 0x04, 0x04],
  "_": [0x20, 0x20, 0x20, 0x20, 0x20],
  "@": [0x1e, 0x21, 0x2d, 0x2d, 0x0e],
  "!": [0x00, 0x00, 0x2f, 0x00, 0x00],
};

export interface OgInput {
  dateStamp: string;
  username: string;
  streak: number;
  origin: string;
}

export async function renderOgPng(input: OgInput): Promise<Uint8Array> {
  const px = new Uint8Array(W * H * 4);
  fill(px, PAPER);
  rect(px, 0, 0, W, 8, INK);
  rect(px, 0, H - 8, W, 8, INK);
  rect(px, 0, 0, 8, H, INK);
  rect(px, W - 8, 0, 8, H, INK);

  text(px, 56, 48, "HUMANE", INK, 8);
  text(px, W - 56 - textWidth(input.dateStamp, 6), 56, input.dateStamp, STAMP, 6);

  const colW = 220;
  const colH = 280;
  const gap = 72;
  const leftX = Math.floor((W - (colW * 2 + gap)) / 2);
  const colY = 160;
  frame(px, leftX, colY, colW, colH, GRAPHITE, 4);
  frame(px, leftX + colW + gap, colY, colW, colH, GRAPHITE, 4);
  deckle(px, leftX + colW + Math.floor(gap / 2), colY - 8, colH + 16, INK);

  fillCircle(px, Math.floor(W / 2), colY + colH + 48, 14, STAMP);

  const name = `@${input.username}`.toUpperCase();
  text(px, 56, H - 92, name, INK, 4);
  const tally = input.streak > 0 ? `STREAK ${input.streak}` : "STREAK 0";
  text(px, W - 56 - textWidth(tally, 4), H - 92, tally, STAMP, 4);

  const url = input.origin.replace(/^https?:\/\//, "").toUpperCase();
  text(px, 56, H - 52, url, GRAPHITE, 3);

  return encodePng(W, H, px);
}

function idx(x: number, y: number): number {
  return (y * W + x) * 4;
}

function fill(px: Uint8Array, c: readonly [number, number, number]): void {
  for (let i = 0; i < px.length; i += 4) {
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  }
}

function plot(px: Uint8Array, x: number, y: number, c: readonly [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x, y);
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function rect(
  px: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  c: readonly [number, number, number],
): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) plot(px, xx, yy, c);
  }
}

function frame(
  px: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  c: readonly [number, number, number],
  t: number,
): void {
  rect(px, x, y, w, t, c);
  rect(px, x, y + h - t, w, t, c);
  rect(px, x, y, t, h, c);
  rect(px, x + w - t, y, t, h, c);
}

function fillCircle(px: Uint8Array, cx: number, cy: number, r: number, c: readonly [number, number, number]): void {
  const r2 = r * r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r2) plot(px, cx + x, cy + y, c);
    }
  }
}

function deckle(px: Uint8Array, x: number, y: number, h: number, c: readonly [number, number, number]): void {
  for (let i = 0; i < h; i++) {
    const wobble = Math.round(Math.sin(i * 0.35) * 6 + Math.sin(i * 0.11) * 4);
    const xx = x + wobble;
    rect(px, xx - 2, y + i, 5, 1, c);
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * (5 * scale + scale);
}

function text(
  px: Uint8Array,
  x: number,
  y: number,
  s: string,
  c: readonly [number, number, number],
  scale: number,
): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "]!;
    for (let col = 0; col < 5; col++) {
      const bits = g[col] ?? 0;
      for (let row = 0; row < 7; row++) {
        if (bits & (1 << row)) {
          rect(px, cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 5 * scale + scale;
  }
}

async function encodePng(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const dest = y * (width * 4 + 1);
    raw[dest] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), dest + 1);
  }
  const compressed = await deflate(raw);
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", new Uint8Array(0))];
  return concat(chunks);
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcSrc = out.subarray(4, 8 + data.length);
  writeU32(out, 8 + data.length, crc32(crcSrc));
  return out;
}

function writeU32(buf: Uint8Array, off: number, n: number): void {
  buf[off] = (n >>> 24) & 255;
  buf[off + 1] = (n >>> 16) & 255;
  buf[off + 2] = (n >>> 8) & 255;
  buf[off + 3] = n & 255;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
