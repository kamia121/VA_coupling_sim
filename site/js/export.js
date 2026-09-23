// Export an animation as a PowerPoint slide, an animated GIF or an MP4 video.
// Frames are rendered from the model one by one (not screen-recorded), so every export is exactly
// one repeating cycle and loops without a seam. The slide embeds the GIF: PowerPoint plays animated
// GIFs on Windows, Mac, the web and mobile, in edit and slide-show view, without a click.
import { buildPalette, makeIndexer, GifWriter } from './gif.js';

const NS = 'http://www.w3.org/2000/svg';
const GIF_DELAY = 7;          // 1/100 s per GIF frame (≈14 fps)
const MP4_FPS = 30;
const VENDOR = new URL('../vendor/', import.meta.url);
const SVG_STYLE = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'dominant-baseline', 'visibility', 'display', 'paint-order'];

// ---------- SVG -> image, with the page's CSS baked in ----------
// Computed styles are copied once; each frame then only copies changed attributes (cursor positions).
// Elements matching `hide` (e.g. drag handles) are left out of the picture.
export function svgCapture(svg, hide = '.handle') {
  let live, copy, clone;
  const snap = () => {
    clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    live = [svg, ...svg.querySelectorAll('*')]; copy = [clone, ...clone.querySelectorAll('*')];
    live.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const off = hide && el.matches(hide) ? ';display:none' : '';
      copy[i].setAttribute('style', SVG_STYLE.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';') + off);
      copy[i].removeAttribute('class');
    });
  };
  snap();
  const vb = svg.viewBox.baseVal;
  return {
    aspect: vb && vb.width ? vb.height / vb.width : svg.clientHeight / svg.clientWidth,
    async image(w) {
      if (svg.querySelectorAll('*').length + 1 !== live.length) snap();
      live.forEach((el, i) => {
        for (const a of el.attributes) if (a.name !== 'style' && a.name !== 'class' && copy[i].getAttribute(a.name) !== a.value) copy[i].setAttribute(a.name, a.value);
      });
      clone.setAttribute('width', w); clone.setAttribute('height', Math.round(w * this.aspect));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      try { await img.decode(); } finally { URL.revokeObjectURL(url); }
      return img;
    },
  };
}

// ---------- composing helpers for page renderers ----------
export function header(g, W, title, right, colors = {}) {
  g.fillStyle = colors.text || '#E6EFEC'; g.font = '600 22px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(title, 20, 36);
  if (right) { g.fillStyle = colors.muted || '#A7B8B2'; g.font = '15px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(right, W - 20, 36); g.textAlign = 'left'; }
}
export const even = (v) => Math.ceil(v / 2) * 2;

// ---------- encoders ----------
function newCanvas(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return { c, g: c.getContext('2d', { willReadFrequently: true }) };
}

// Frame k of n covers real time k·duration/n, so frame n would equal frame 0: a seamless loop.
async function encodeGif(job, progress) {
  const { W, H } = job, n = Math.max(2, Math.round(job.duration * 100 / GIF_DELAY)), dt = job.duration / n;
  const { g } = newCanvas(W, H);
  const samples = [];
  for (const k of [0, Math.floor(n / 3), Math.floor((2 * n) / 3)]) { await job.frame(g, k * dt); samples.push(g.getImageData(0, 0, W, H).data); }
  const P = buildPalette(samples), index = makeIndexer(P), gif = new GifWriter(W, H, P), idx = new Uint8Array(W * H);
  let shown = 0;
  for (let k = 0; k < n; k++) {
    await job.frame(g, k * dt);
    index(g.getImageData(0, 0, W, H).data, idx);
    const until = Math.round((k + 1) * dt * 100);   // cumulative rounding keeps total duration exact
    gif.addFrame(idx, until - shown); shown = until;
    progress((k + 1) / n);
    if (k % 4 === 3) await new Promise((r) => setTimeout(r));
  }
  return gif.finish();
}

const AVC = ['avc1.640028', 'avc1.4d0028', 'avc1.420028'];   // High, Main, Baseline @ level 4.0
async function avcConfig(W, H, codecs = AVC) {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of codecs) {
    const cfg = { codec, width: W, height: H, bitrate: 6e6, framerate: MP4_FPS, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { /* try the next profile */ }
  }
  return null;
}
export const mp4Supported = () => avcConfig(1280, 720).then(Boolean);

async function encodeMp4(job, progress, codecs = AVC) {
  const { W, H } = job, cfg = await avcConfig(W, H, codecs);
  if (!cfg) throw new Error('This browser cannot encode H.264 video. Use the GIF or the slide.');
  if (!cfg.codec.startsWith('avc')) delete cfg.avc;
  const { Muxer, ArrayBufferTarget } = await import(new URL('mp4-muxer.mjs', VENDOR).href);
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: cfg.codec.startsWith('avc') ? 'avc' : 'vp9', width: W, height: H, frameRate: MP4_FPS }, fastStart: 'in-memory' });
  let failed = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  enc.configure(cfg);
  const n = Math.max(2, Math.round(job.duration * MP4_FPS)), dt = job.duration / n, us = 1e6 / MP4_FPS;
  const { c, g } = newCanvas(W, H);
  for (let k = 0; k < n; k++) {
    if (failed) throw failed;
    await job.frame(g, k * dt);
    const vf = new VideoFrame(c, { timestamp: Math.round(k * us), duration: Math.round(us) });
    enc.encode(vf, { keyFrame: k % MP4_FPS === 0 });
    vf.close();
    while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    progress((k + 1) / n);
  }
  await enc.flush(); enc.close();
  if (failed) throw failed;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

// ---------- PowerPoint ----------
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('pptxgen.bundle.js', VENDOR).href; s.onload = res; s.onerror = () => rej(new Error('Could not load the PowerPoint library.'));
    document.head.append(s);
  });
}
const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

async function writePptx(spec, job, gif) {
  await loadPptx();
  const pptx = new window.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';                                    // 13.33 × 7.5 in
  pptx.title = spec.title;
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addText(spec.title, { x: 0.5, y: 0.25, w: 12.33, h: 0.6, fontFace: 'Calibri', fontSize: 26, bold: true, color: '0E2B73', margin: 0 });
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.9, w: 1.4, h: 0.06, fill: { color: '2F6E66' }, line: { color: '2F6E66' } });
  const boxW = 12.33, boxH = 5.35, a = job.H / job.W;
  const w = Math.min(boxW, boxH / a), h = w * a;
  s.addImage({ data: (await toDataUrl(gif)).replace(/^data:/, ''), x: 0.5 + (boxW - w) / 2, y: 1.1, w, h, altText: spec.caption });
  s.addText(spec.caption, { x: 0.5, y: 6.5, w: 12.33, h: 0.45, fontFace: 'Calibri', fontSize: 13, color: '333333', margin: 0, valign: 'top' });
  s.addText([{ text: 'Model output from the VA Coupling Simulator, not patient data. Open this state: ', options: {} },
    { text: 'link', options: { hyperlink: { url: location.href } } }],
  { x: 0.5, y: 7.0, w: 12.33, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: '666666', margin: 0 });
  s.addNotes(`${spec.caption}\n\n${spec.notes || ''}\n\nSource: ${location.href}`.trim());
  await pptx.writeFile({ fileName: `${spec.file}.pptx` });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---------- menu ----------
// getSpec() -> { file, title, caption, notes, prepare: async () => job }
// job: { W, H (even), duration (s of one loop), frame: async (g, t) => void, done?: () => void }
export function addExport(host, getSpec, { still = false } = {}) {
  const box = document.createElement('details');
  box.className = 'export';
  box.innerHTML = `<summary>Export for slides</summary>
    <div class="export-menu">
      <button type="button" class="pb-btn" data-f="pptx">PowerPoint slide (.pptx)</button>
      <button type="button" class="pb-btn" data-f="gif">Animated GIF</button>
      <button type="button" class="pb-btn" data-f="mp4" hidden>MP4 video</button>
      <p class="export-note">${still ? 'This screen as it is now, including your measurements.' : 'One cycle of the current view, rendered from the model; it loops. The slide and the GIF play in PowerPoint without a click.'}</p>
      <p class="export-status" aria-live="polite"></p>
    </div>`;
  host.append(box);
  const status = box.querySelector('.export-status');
  mp4Supported().then((ok) => {
    box.querySelector('[data-f="mp4"]').hidden = !ok || still;
    if (ok && !still) box.querySelector('.export-note').textContent += ' For MP4, set Playback → Loop until stopped in PowerPoint.';
  });
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b || box.dataset.busy) return;
    box.dataset.busy = '1';
    box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    const f = b.dataset.f, spec = getSpec();
    let job = null;
    try {
      job = await spec.prepare();
      const progress = (u) => { status.textContent = `Rendering… ${Math.round(u * 100)}%`; };
      if (f === 'mp4') download(await encodeMp4(job, progress), `${spec.file}.mp4`);
      else {
        const gif = await encodeGif(job, progress);
        if (f === 'gif') download(gif, `${spec.file}.gif`);
        else { status.textContent = 'Building the slide…'; await writePptx(spec, job, gif); }
      }
      status.textContent = 'Done. Check your downloads.';
    } catch (err) {
      status.textContent = `Export failed: ${err.message || err}`;
    } finally {
      if (job && job.done) job.done();
      delete box.dataset.busy;
      box.querySelectorAll('button').forEach((x) => { x.disabled = false; });
    }
  });
}

// For tests: the MP4 path with another codec, where the test browser has no H.264 encoder.
export const _test = { encodeMp4 };
