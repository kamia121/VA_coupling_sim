// PA catheter tracing: the pressure the catheter tip sees at each position, generated from the
// model beat of the chosen scenario, with common measurement artifacts applied on top.
import { simulate, cardiacPhases } from './engine.js';
import { PRESETS, presetById } from './presets.js';

const FS = 250;                       // display sample rate, Hz
const WIN = 6;                        // seconds shown
const BREATH = 4;                     // s per breath (15/min); inspiration = first third
const MMHG_PER_10CM = 7.4;            // 10 cmH2O × 0.735 mmHg/cmH2O
const POS = [['ra', 'RA'], ['rv', 'RV'], ['pa', 'PA'], ['wedge', 'Wedge']];
const $ = (s) => document.querySelector(s);
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const st = { preset: 'normal', pos: 'ra', damp: 'ok', level: 0, resp: 'none', t0: performance.now(), playing: !reduce, tFrozen: 0 };
let R = null, beat = null, ev = null;

// One beat of each site's pressure, resampled to FS. Wedge = LA (pulmonary venous) pressure,
// smoothed (τ 50 ms) and delayed 60 ms to mimic transmission through the occluded capillary bed.
function buildBeat() {
  R = simulate(presetById(st.preset).params);
  ev = cardiacPhases(R).rv.events;
  const n = Math.round(R.T * FS), m = R.rec.t.length;
  const pick = (arr) => Array.from({ length: n }, (_, k) => arr[Math.min(m - 1, Math.floor((k / n) * m))]);
  const la = pick(R.rec.Ppv), wedge = new Array(n), d = Math.round(0.06 * FS), a = 1 / (1 + 0.05 * FS);
  let y = la.reduce((s, v) => s + v, 0) / n;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) { y += a * (la[(k - d + n) % n] - y); wedge[k] = y; }
  beat = { n, ra: pick(R.rec.Psv), rv: pick(R.rec.Prv), pa: pick(R.rec.Ppa), wedge };
}

function resp(t) {
  if (st.resp === 'none') return 0;
  const ph = (t % BREATH) / BREATH;
  if (ph > 1 / 3) return 0;                                   // expiration: intrathoracic pressure at baseline
  const s = Math.sin((ph * 3) * Math.PI);
  return st.resp === 'spont' ? -6 * s : 8 * s;                // spontaneous inspiration lowers, positive-pressure breath raises
}

// True tip pressure plus breathing and transducer level, then the catheter–tubing dynamics.
function signal(tEnd) {
  const N = WIN * FS, warm = FS, out = new Array(N), raw = new Array(N), ed = [];
  const kEd = Math.round((ev.inClose / R.rec.t.length) * beat.n);   // RV end-diastole sample within the beat
  const b = beat[st.pos];
  const dyn = st.damp === 'over' ? { wn: 2 * Math.PI * 3, z: 1.6 } : st.damp === 'under' ? { wn: 2 * Math.PI * 9, z: 0.08 } : null;
  let x = null, v = 0;
  const dt = 1 / FS;
  for (let j = -warm; j < N; j++) {
    const t = tEnd - WIN + j / FS;
    const k = ((Math.floor(t * FS) % beat.n) + beat.n) % beat.n;
    const u = b[k] + resp(t) + st.level * MMHG_PER_10CM;
    if (x === null) x = u;
    if (dyn) { for (let s = 0; s < 4; s++) { const acc = dyn.wn ** 2 * (u - x) - 2 * dyn.z * dyn.wn * v; v += acc * dt / 4; x += v * dt / 4; } }
    else x = u;
    if (j >= 0) { out[j] = x; raw[j] = b[k]; if (k === kEd) ed.push(j); }
  }
  return { out, raw, ed };
}

function stats(arr) {
  let mx = -Infinity, mn = Infinity, s = 0;
  for (const v of arr) { if (v > mx) mx = v; if (v < mn) mn = v; s += v; }
  return { max: mx, min: mn, mean: s / arr.length };
}

// Standard reporting per site: RA and wedge as means, RV as systolic/end-diastolic, PA as S/D (M).
function report(arr, kind, ed = [], offset = 0) {
  const s = stats(arr);
  if (kind === 'ra' || kind === 'wedge') return `${s.mean.toFixed(0)} mean`;
  if (kind === 'rv') {
    const idx = ed.map((j) => j - offset).filter((j) => j >= 0 && j < arr.length);
    const edp = idx.length ? idx.reduce((a, j) => a + arr[j], 0) / idx.length : s.min;
    return `${s.max.toFixed(0)}/${edp.toFixed(0)}`;
  }
  return `${s.max.toFixed(0)}/${s.min.toFixed(0)} (${s.mean.toFixed(0)})`;
}

function draw(tEnd) {
  const c = $('#pac-scr'), cs = getComputedStyle(c.parentElement), w = Math.floor(Math.min(800, c.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))), h = Math.round(w * (w < 520 ? 0.75 : 0.42));
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  const { out, raw, ed } = signal(tEnd);
  const x0 = 40, pw = w - x0 - 12, top = 12, ph = h - top - 50;
  const ymax = Math.max(20, Math.ceil(Math.max(...beat.rv, ...out) * 1.15 / 10) * 10);
  const Y = (p) => top + ph - (Math.max(-5, p) / ymax) * ph;
  g.strokeStyle = '#16251F'; g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
  for (let p = 0; p <= ymax; p += ymax > 60 ? 20 : 10) { g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x0 + pw, Y(p)); g.stroke(); g.fillText(p, x0 - 6, Y(p) + 4); }
  g.textAlign = 'left'; g.fillText('mmHg', x0 + 6, top + 14);
  // breathing phases
  if (st.resp !== 'none') {
    for (let t = Math.floor((tEnd - WIN) / BREATH) * BREATH; t < tEnd; t += BREATH) {
      const xa = x0 + ((t - (tEnd - WIN)) / WIN) * pw, xb = xa + (BREATH / 3 / WIN) * pw, xe = xa + (0.95 * BREATH / WIN) * pw;
      g.fillStyle = 'rgba(169,188,242,0.08)'; g.fillRect(Math.max(x0, xa), top, Math.max(0, Math.min(x0 + pw, xb) - Math.max(x0, xa)), ph);
      if (xe > x0 && xe < x0 + pw) { g.fillStyle = '#E8B962'; g.fillText('end-exp ▾', xe + 22, top + 12); g.fillRect(xe, top + 16, 1.5, ph - 16); }
    }
  }
  if (st.damp !== 'ok' || st.level !== 0 || st.resp !== 'none') {      // true tip pressure, faint
    g.strokeStyle = 'rgba(160,175,170,0.45)'; g.lineWidth = 1.2; g.beginPath();
    raw.forEach((p, j) => { const x = x0 + (j / out.length) * pw; j ? g.lineTo(x, Y(p)) : g.moveTo(x, Y(p)); }); g.stroke();
  }
  g.strokeStyle = '#E8D35F'; g.lineWidth = 2; g.beginPath();                 // monitor PA/RA trace colour
  out.forEach((p, j) => { const x = x0 + (j / out.length) * pw; j ? g.lineTo(x, Y(p)) : g.moveTo(x, Y(p)); }); g.stroke();
  // ECG
  g.strokeStyle = '#7CE38B'; g.lineWidth = 1.2; g.beginPath();
  for (let j = 0; j <= pw; j++) {
    const t = tEnd - WIN + (j / pw) * WIN, phs = ((t % R.T) + R.T) % R.T / R.T;
    const d = phs < 0.03 ? Math.sin(phs / 0.03 * Math.PI) * 12 * (phs < 0.015 ? 1 : -0.4) : phs > 0.3 && phs < 0.45 ? Math.sin((phs - 0.3) / 0.15 * Math.PI) * 3.5 : 0;
    j ? g.lineTo(x0 + j, h - 18 - d) : g.moveTo(x0 + j, h - 18 - d);
  }
  g.stroke();
  // readout
  const lastBeats = out.slice(-Math.round(R.T * FS * 2)), trueBeats = raw.slice(-Math.round(R.T * FS * 2));
  const label = POS.find((p) => p[0] === st.pos)[1];
  const off = out.length - lastBeats.length;
  $('#pac-read').innerHTML = `<div class="tile"><div class="tile-v">${report(out, st.pos, ed)}</div><div class="tile-k">Monitor reads (${label}, whole ${WIN}-s screen)</div></div>
    <div class="tile"><div class="tile-v">${report(lastBeats, st.pos, ed, off)}</div><div class="tile-k">Last 2 beats on screen</div></div>
    <div class="tile"><div class="tile-v">${report(trueBeats, st.pos, ed, off)}</div><div class="tile-k">True tip pressure, no artifact (model)</div></div>`;
  drawMap();
}

let mapPos = null;
function drawMap() {
  if (mapPos === st.pos) return;
  mapPos = st.pos;
  const order = POS.map((p) => p[0]), i = order.indexOf(st.pos);
  $('#pac-path').innerHTML = POS.map(([id, t], k) => `<button type="button" class="pp${k === i ? ' on' : ''}${k < i ? ' done' : ''}" data-v="${id}" aria-pressed="${k === i}">${t}</button>`).join('<span class="pp-arrow">→</span>');
}

function loop(now) {
  const t = st.playing ? (now - st.t0) / 1000 : st.tFrozen;
  if (st.playing) st.tFrozen = t;
  draw(t);
  if (st.playing) requestAnimationFrame(loop);
}

function seg(id, opts, get, set) {
  const box = document.getElementById(id);
  box.innerHTML = opts.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('');
  const sync = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))));
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); sync(); if (!st.playing) draw(st.tFrozen); });
  sync();
}

export function initPacSim() {
  const sel = $('#pac-case');
  sel.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
  sel.addEventListener('change', () => { st.preset = sel.value; buildBeat(); if (!st.playing) draw(st.tFrozen); });
  $('#pac-path').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.pos = b.dataset.v; draw(st.tFrozen); });
  seg('pac-damp', [['ok', 'Optimal'], ['over', 'Overdamped'], ['under', 'Underdamped (whip)']], () => st.damp, (v) => { st.damp = v; });
  seg('pac-level', [['0', 'At phlebostatic axis'], ['1', '10 cm below'], ['-1', '10 cm above']], () => st.level, (v) => { st.level = +v; });
  seg('pac-resp', [['none', 'Apnoeic'], ['spont', 'Spontaneous breaths'], ['ppv', 'Positive-pressure breaths']], () => st.resp, (v) => { st.resp = v; });
  $('#pac-float').addEventListener('click', () => {
    const order = POS.map((p) => p[0]);
    st.pos = order[(order.indexOf(st.pos) + 1) % order.length];
    draw(st.tFrozen);
  });
  $('#pac-play').addEventListener('click', () => {
    st.playing = !st.playing;
    $('#pac-play').textContent = st.playing ? '❚❚ Freeze' : '▶ Run';
    if (st.playing) { st.t0 = performance.now() - st.tFrozen * 1000; requestAnimationFrame(loop); }
  });
  $('#pac-play').textContent = st.playing ? '❚❚ Freeze' : '▶ Run';
  buildBeat();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => draw(st.tFrozen), 150); });
  if (st.playing) requestAnimationFrame(loop); else draw(0);
}

// exported for tests
export const _pac = { st, buildBeat, signal, stats, get beat() { return beat; }, MMHG_PER_10CM, FS };
