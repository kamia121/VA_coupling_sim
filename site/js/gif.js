// Minimal animated-GIF (GIF89a) encoder. One global palette for every frame (no color flicker),
// LZW compression, and delta frames: pixels unchanged from the previous frame are written as the
// transparent index, so a moving cursor costs a few bytes. The LZW coder follows omggif (MIT).

const TRANSPARENT = 255;                  // palette slot reserved for "unchanged"

// Palette of up to 255 colors from RGBA samples: 15-bit histogram, most frequent colors first,
// skipping near-duplicates so antialiased edges do not crowd out the distinct plot colors.
export function buildPalette(samples, maxColors = 255) {
  const n = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  for (const d of samples) {
    for (let i = 0; i < d.length; i += 4) {
      const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      n[k]++; sr[k] += d[i]; sg[k] += d[i + 1]; sb[k] += d[i + 2];
    }
  }
  const keys = [];
  for (let k = 0; k < 32768; k++) if (n[k]) keys.push(k);
  keys.sort((a, b) => n[b] - n[a]);
  const cols = [], skipped = [];
  const near = (c) => cols.some((p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 < 100);
  for (const k of keys) {
    const c = [sr[k] / n[k], sg[k] / n[k], sb[k] / n[k]].map(Math.round);
    if (cols.length >= maxColors) break;
    (near(c) ? skipped : cols).push(c);
  }
  for (const c of skipped) { if (cols.length >= maxColors) break; cols.push(c); }
  const pal = new Uint8Array(768);
  cols.forEach((c, i) => pal.set(c, i * 3));
  return { pal, count: Math.max(cols.length, 1) };
}

// RGBA -> palette indices, with a lazily filled 15-bit lookup table.
export function makeIndexer({ pal, count }) {
  const lut = new Int16Array(32768).fill(-1);
  const nearest = (r, g, b) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < count; i++) {
      const d = (pal[i * 3] - r) ** 2 + (pal[i * 3 + 1] - g) ** 2 + (pal[i * 3 + 2] - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  return (rgba, out) => {
    for (let i = 0, j = 0; j < out.length; i += 4, j++) {
      const k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
      let v = lut[k];
      if (v < 0) v = lut[k] = nearest((rgba[i] & 0xf8) | 4, (rgba[i + 1] & 0xf8) | 4, (rgba[i + 2] & 0xf8) | 4);
      out[j] = v;
    }
    return out;
  };
}

class Bytes {
  constructor() { this.chunks = []; this.buf = new Uint8Array(1 << 16); this.p = 0; }
  byte(b) { if (this.p === this.buf.length) this.flush(); this.buf[this.p++] = b; }
  u16(v) { this.byte(v & 255); this.byte((v >> 8) & 255); }
  bytes(a) { for (const b of a) this.byte(b); }
  flush() { this.chunks.push(this.buf.slice(0, this.p)); this.p = 0; }
  blob() { this.flush(); return new Blob(this.chunks, { type: 'image/gif' }); }
}

function lzw(out, minCode, idx) {
  out.byte(minCode);
  let cur = 0, bits = 0, block = [];
  const emit = (code, size) => {
    cur |= code << bits; bits += size;
    while (bits >= 8) {
      block.push(cur & 255); cur >>= 8; bits -= 8;
      if (block.length === 255) { out.byte(255); out.bytes(block); block = []; }
    }
  };
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1;
  const table = new Int16Array(4096 << 8).fill(-1);   // key = prefix code * 256 + index
  emit(clear, size);
  let code = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = (code << 8) | k, hit = table[key];
    if (hit >= 0) { code = hit; continue; }
    emit(code, size);
    if (next === 4096) { emit(clear, size); next = eoi + 1; size = minCode + 1; table.fill(-1); }
    else { if (next >= 1 << size) size++; table[key] = next++; }
    code = k;
  }
  emit(code, size); emit(eoi, size);
  if (bits > 0) block.push(cur & 255);
  for (let i = 0; i < block.length; i += 255) { const b = block.slice(i, i + 255); out.byte(b.length); out.bytes(b); }
  out.byte(0);
}

export class GifWriter {
  constructor(w, h, { pal }) {
    this.w = w; this.h = h; this.prev = null; this.pending = null;
    const o = this.out = new Bytes();
    o.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);        // GIF89a
    o.u16(w); o.u16(h); o.byte(0xf7); o.byte(0); o.byte(0); // 256-entry global color table
    o.bytes(pal);
    o.bytes([0x21, 0xff, 0x0b, ...'NETSCAPE2.0'].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c)));
    o.bytes([3, 1, 0, 0, 0]);                              // loop forever
  }
  // idx: palette indices for the whole frame; delay in 1/100 s.
  addFrame(idx, delay) {
    const { w, h, prev } = this;
    if (!prev) { this.pending = { x: 0, y: 0, w, h, data: idx.slice(), delay, trans: false }; this.prev = idx.slice(); return; }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const r = y * w;
      for (let x = 0; x < w; x++) if (idx[r + x] !== prev[r + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    if (x1 < 0) { this.pending.delay += delay; return; }  // identical frame: hold the previous one longer
    this.write();
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1, data = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const s = (y + y0) * w + x + x0;
        data[y * rw + x] = idx[s] === prev[s] ? TRANSPARENT : idx[s];
      }
    }
    this.pending = { x: x0, y: y0, w: rw, h: rh, data, delay, trans: true };
    this.prev.set(idx);
  }
  write() {
    const f = this.pending, o = this.out;
    if (!f) return;
    o.bytes([0x21, 0xf9, 4, (1 << 2) | (f.trans ? 1 : 0)]); o.u16(Math.min(65535, f.delay)); o.byte(f.trans ? TRANSPARENT : 0); o.byte(0);
    o.byte(0x2c); o.u16(f.x); o.u16(f.y); o.u16(f.w); o.u16(f.h); o.byte(0);
    lzw(o, 8, f.data);
    this.pending = null;
  }
  finish() { this.write(); this.out.byte(0x3b); return this.out.blob(); }
}
