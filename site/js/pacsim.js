// PA catheter tracing: the pressure the catheter tip sees at each position, generated from the
// model beat of the chosen scenario, with common measurement artifacts applied on top.
import { simulate, cardiacPhases } from './engine.js';
import { PRESETS, presetById } from './presets.js';
import { combine, FLUIDS } from './pharm.js';
import { addExport, header, even } from './export.js';

const FS = 250;                       // display sample rate, Hz
const MMHG_PER_10CM = 7.4;            // 10 cmH2O × 0.735 mmHg/cmH2O
const POS = [['ra', 'RA'], ['rv', 'RV'], ['pa', 'PA'], ['wedge', 'Wedge']];
const $ = (s) => document.querySelector(s);
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Breathing patterns: breath length (s), share of the breath that is inspiration, and the swing in
// intrathoracic pressure during inspiration and (tachypnea: active expiration) during expiration.
const BREATHING = {
  none: null,
  spont: { period: 4, insp: 1 / 3, inspSwing: -6, expSwing: 0 },
  tachy: { period: 2, insp: 0.45, inspSwing: -12, expSwing: 4 },
  ppv: { period: 4, insp: 1 / 3, inspSwing: 8, expSwing: 0 },
};

// Bedside challenges, applied as a new steady state.
// Fluid: 500 mL of saline over 5 min. With the crystalloid kinetics of the Shock lab (18% kept, the rest
// leaving with τ 10 min), 83% is still in the vessels when the infusion ends, and 0.4 mL of each
// intravascular mL is stressed volume, so the challenge adds about 165 mL of stressed volume.
// Inhaled NO 20 ppm: the pulmonary vasodilator effect of the Shock lab's drug table (PVR only).
const FLUID_STRESSED = (() => {
  const f = FLUIDS.crystalloid, r = 5 / f.tau;
  return Math.round(500 * (f.keep + (1 - f.keep) * (1 - Math.exp(-r)) / r) * 0.4);
})();
const CHALLENGES = {
  fluid: { name: 'Fluid challenge (500 mL saline over 5 min)', apply: (p) => ({ vStressed: p.vStressed + FLUID_STRESSED }) },
  ino: { name: 'Inhaled nitric oxide 20 ppm', apply: (p) => ({ pvr: p.pvr * combine({ ino: 20 }).pvr }) },
};

const st = {
  preset: 'normal', pos: 'ra', damp: 'ok', level: 0, resp: 'none', atr: 'sinus', showLA: true, showLVEDP: true, labels: true, view: 'tip',
  // a phone shows 3 s so the waves are wide enough to read; wider screens show 6 s
  win: typeof window !== 'undefined' && window.innerWidth < 600 ? 3 : 6, rate: 0.5, guide: true, tipH: -5, peep: 0, scale: 'auto', challenge: null, t0: 0, last: null, playing: !reduce, tFrozen: 0,
  quiz: { on: false, y: null, revealed: false },
};
let R = null, R0 = null, beat = null, ev = null, evs = null, BREATH = 4, TB = 1;   // TB: beat period as sampled
let lastY = null;                                          // screen mapping of the last tip-view frame (for the quiz)

// ---------- atrial waves ----------
// Every atrial wave comes from the model (engine.js): the a wave from atrial contraction, the c wave
// from filling and leaflet bulging against the closed valve, the x descent from atrial relaxation and descent
// of the AV plane, the v wave from atrial filling against the closed valve, and the y descent from
// atrial emptying. Atrial fibrillation removes atrial contraction; in AV dissociation the atrium
// contracts against closed valves; the regurgitant lesions open a regurgitant orifice in the model.
// t = 0 is QRS onset (start of ventricular activation).
const PR = 0.16;                      // s, P-wave onset to QRS (engine default)
export const ATRIAL = {
  sinus: 'Sinus rhythm',
  af: 'Atrial fibrillation',
  junc: 'AV dissociation (cannon a)',
  mr: 'Acute severe mitral regurgitation',
  tr: 'Severe tricuspid regurgitation',
};
// Engine settings for each option. Acute MR opens a 0.5 cm² orifice into a normal-sized, stiffer LA.
// AV dissociation: atrial contraction starts with the QRS (P wave buried in it), against closing valves.
const RHYTHM = { af: { aKick: 0 }, junc: { aShift: PR - 0.05 }, mr: { mrEroa: 0.5, laEmin: 0.6, laEmax: 2.0 }, tr: { trEroa: 1.2 } };

function waveTimes(side) {            // side: 'ra' (right heart events) or 'la' (left heart events)
  const e = evs[side === 'ra' ? 'rv' : 'lv'].events, m = R.rec.t.length, T = R.T;
  const at = (i) => (i / m) * T;
  const tIn = at(e.inClose), tOpen = at(e.outOpen), tClose = at(e.outClose), tIO = at(e.inOpen);
  // a wave: the pressure peaks about a third of the way into atrial contraction, before activation peaks
  let ia = 0;
  for (let i = 1; i < m; i++) if (R.rec.aAct[i] > R.rec.aAct[ia]) ia = i;
  const aT = at(ia) - 0.2 * R.params.aDur;
  return { a: aT, c: tIn + 0.02, x: tOpen + 0.35 * (tClose - tOpen), v: tIO - 0.02, y: tIO + 0.09, tIn, tOpen, tClose, tIO };
}

function params(challenge) {
  const p = { ...presetById(st.preset).params, ...(RHYTHM[st.atr] || {}) };
  if (!challenge) return p;
  const full = simulate(p).params;                      // intrinsic values with defaults filled in
  return { ...p, ...CHALLENGES[challenge].apply(full) };
}
// One beat of each site's pressure, resampled to FS. Wedge = LA pressure,
// smoothed (τ 50 ms) and delayed 60 ms to mimic transmission through the occluded capillary bed.
function buildBeat() {
  R0 = simulate(params(null));
  R = st.challenge ? simulate(params(st.challenge), { state: R0.state, slow: R0.slow }) : R0;
  evs = cardiacPhases(R); ev = evs.rv.events;
  const n = Math.round(R.T * FS), m = R.rec.t.length;
  const pick = (arr) => Array.from({ length: n }, (_, k) => arr[Math.min(m - 1, Math.floor((k / n) * m))]);
  const la = pick(R.rec.Pla), wedge = new Array(n), d = Math.round(0.06 * FS), a = 1 / (1 + 0.05 * FS);
  let y = la.reduce((s, v) => s + v, 0) / n;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) { y += a * (la[(k - d + n) % n] - y); wedge[k] = y; }
  beat = { n, ra: pick(R.rec.Pra), rv: pick(R.rec.Prv), pa: pick(R.rec.Ppa), wedge, la };
  TB = n / FS;
  setBreath();
}
function setBreath() {
  const b = BREATHING[st.resp];
  BREATH = Math.max(1, Math.round((b ? b.period : 4) / TB)) * TB;   // whole number of beats, so the pattern repeats exactly
}
const WEDGE_LAG = 0.06 + 0.05;        // s: transmission delay + filter time constant

// ECG in mV-ish screen units at time t (s); rhythm follows st.atr.
function ecg(t) {
  const ph = (((t % TB) + TB) % TB), u = ph / TB;
  let d = u < 0.03 ? Math.sin(u / 0.03 * Math.PI) * 12 * (u < 0.015 ? 1 : -0.4) : u > 0.3 && u < 0.45 ? Math.sin((u - 0.3) / 0.15 * Math.PI) * 3.5 : 0;
  const tp = ph - (TB - PR);                         // P wave: 0–0.09 s after its onset
  if ((st.atr === 'sinus' || st.atr === 'mr' || st.atr === 'tr') && tp >= 0 && tp < 0.09) d += 2 * Math.sin(tp / 0.09 * Math.PI);
  if (st.atr === 'af') {
    // fibrillatory baseline, 4.7–8.9 Hz with a slowly varying amplitude. The frequencies fit the breath cycle
    // (a whole number of beats, about 4 s), so the loop still repeats, but no pattern recurs from beat to
    // beat, which would read as an organized atrial wave.
    const fit = (f) => Math.round(f * BREATH) / BREATH, mod = 0.7 + 0.3 * Math.sin(2 * Math.PI * fit(1.3) * t);
    d += mod * (0.55 * Math.sin(2 * Math.PI * fit(4.7) * t) + 0.45 * Math.sin(2 * Math.PI * fit(6.1) * t + 1.1)
      + 0.35 * Math.sin(2 * Math.PI * fit(7.3) * t + 2.3) + 0.3 * Math.sin(2 * Math.PI * fit(8.9) * t + 0.4));
  }
  return d;
}

function resp(t) {
  const b = BREATHING[st.resp];
  if (!b) return 0;
  const ph = (((t % BREATH) + BREATH) % BREATH) / BREATH;
  if (ph < b.insp) return b.inspSwing * Math.sin((ph / b.insp) * Math.PI);
  return b.expSwing * Math.sin(((ph - b.insp) / (1 - b.insp)) * Math.PI);   // active expiration (tachypnea) raises it
}
const endExp = () => 0.95 * BREATH;   // time within each breath at which pressures are read

// ---------- PEEP and West zones ----------
// About half of PEEP reaches the pleural space and the heart in a normal lung, so every intrathoracic
// pressure rises by half of it (the circulation itself is not changed by PEEP in this model).
// Alveolar pressure is PEEP plus the breath: positive-pressure breaths add more at the alveolus than in the
// pleural space; spontaneous breaths move it by about 1 mmHg.
const CM_BLOOD = 0.74;                // mmHg per cm of vertical blood column
const CMH2O = 0.735;                  // mmHg per cmH2O
const pleuralPeep = () => 0.5 * st.peep * CMH2O;
function palv(t) {
  const sw = st.resp === 'ppv' ? 1.5 * resp(t) : 0.15 * resp(t);
  return st.peep * CMH2O + sw;
}
// With the balloon inflated, the tip reads pulmonary venous pressure through a static column, as long as the
// vessel between the tip and the left atrium stays open. Where alveolar pressure exceeds the local venous
// pressure (the LA pressure less the height of the tip above it), the vessel collapses and the tip reads
// alveolar pressure, carried to the transducer through the catheter's own fluid column.
const tipReading = (pLA, t) => Math.max(pLA, palv(t) + CM_BLOOD * st.tipH);
// West zone at the tip at end-expiration and at the peak of a breath, from mean PA and LA pressures.
function westZone() {
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const h = CM_BLOOD * st.tipH, pl = pleuralPeep();
  const pa = mean(beat.pa) + pl - h, la = mean(beat.la) + pl - h, laMin = Math.min(...beat.la) + pl - h;
  // vascular pressures move with the pleural swing of each breath; alveolar pressure moves more
  const zoneAt = (t) => { const alv = palv(t), sh = resp(t); return alv > pa + sh ? 1 : alv > la + sh ? 2 : alv > laMin + sh ? '2–3' : 3; };
  const rank = { 1: 0, 2: 1, '2–3': 2, 3: 3 };
  let pk = zoneAt(0);
  for (let t = 0; t < BREATH; t += 0.02) { const z = zoneAt(t); if (rank[z] < rank[pk]) pk = z; }
  return { ee: zoneAt(endExp()), peak: pk, pa, la };
}

// True tip pressure plus breathing and transducer level, then the catheter–tubing dynamics.
function signal(tEnd, pos = st.pos) {
  const N = st.win * FS, warm = FS, out = new Array(N), raw = new Array(N), ed = [];
  const kEd = Math.round((ev.inClose / R.rec.t.length) * beat.n);   // RV end-diastole sample within the beat
  const b = beat[pos];
  const dyn = st.damp === 'over' ? { wn: 2 * Math.PI * 3, z: 1.6 } : st.damp === 'under' ? { wn: 2 * Math.PI * 9, z: 0.08 } : null;
  let x = null, v = 0;
  const dt = 1 / FS;
  const s0 = Math.round(tEnd * FS) - N;                 // whole sample numbers, so the pattern repeats exactly
  for (let j = -warm; j < N; j++) {
    const t = (s0 + j) / FS;
    const k = (((s0 + j) % beat.n) + beat.n) % beat.n;
    const p = b[k] + resp(t) + pleuralPeep();
    const u = (pos === 'wedge' ? tipReading(p, t) : p) + st.level * MMHG_PER_10CM;
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

// ---------- screen mapping ----------
// Live display sweeps like a bedside monitor: the sample at absolute time s is always drawn at the same
// x, (s mod N), so nothing already on screen moves, and an erase bar runs ahead of the cursor. The slide
// export scrolls instead, so that its frames loop.
const GAP = 0.25;                     // s, erase bar (shorter on short windows)
function mapping(s0, N, x0, pw, sweep) {
  const G = sweep ? Math.round(Math.min(GAP, 0.06 * N / FS) * FS) : 0;
  const pos = sweep ? (j) => (((s0 + j) % N) + N) % N : (j) => j;
  return { G, pos, X: (j) => x0 + (pos(j) / N) * pw, visible: (j) => j >= G };
}
// Each pixel column drawn from the lowest to the highest sample it covers, so narrow peaks (QRS,
// c wave) keep their full height; columns are fixed to screen positions, so nothing shimmers.
function drawTrace(g, vals, map, N, x0, pw, Y) {
  const scr = new Float32Array(N).fill(NaN);
  for (let j = map.G; j < N; j++) scr[map.pos(j)] = vals(j);
  const per = N / pw;
  g.beginPath();
  let pen = false;
  for (let c = 0; c < pw; c++) {
    const k0 = Math.floor(c * per), k1 = Math.max(k0 + 1, Math.floor((c + 1) * per));
    let lo = Infinity, hi = -Infinity, first = NaN, last = NaN;
    for (let k = k0; k < k1; k++) { const v = scr[k]; if (Number.isNaN(v)) continue; if (Number.isNaN(first)) first = v; last = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (Number.isNaN(first)) { pen = false; continue; }
    const x = x0 + c + 0.5;
    if (pen) g.lineTo(x, Y(first)); else g.moveTo(x, Y(first));
    if (hi - lo > 0.05) { g.lineTo(x, Y(hi)); g.lineTo(x, Y(lo)); }
    g.lineTo(x, Y(last)); pen = true;
  }
  g.stroke();
}
function drawEcg(g, s0, map, N, x0, pw, base, gain = 2) {
  g.strokeStyle = '#7CE38B'; g.lineWidth = 1.2;
  drawTrace(g, (j) => ecg((s0 + j) / FS), map, N, x0, pw, (v) => base - gain * v);
}

// The tracing takes the full width of its panel; its height follows the width, up to a share of the window
// (maxFrac) so a wide screen does not make it taller than the screen.
function sizeCanvas(ratioWide, ratioNarrow, maxFrac, minH) {
  const c = $('#pac-scr'), cs = getComputedStyle(c.parentElement);
  const w = Math.floor(Math.min(1800, c.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
  const h = Math.round(Math.min(w * (w < 520 ? ratioNarrow : ratioWide), Math.max(minH, window.innerHeight * maxFrac)));
  const dpr = window.devicePixelRatio || 1;
  // whole-pixel backing store: with a fractional devicePixelRatio (125%, 150%) w·dpr is not an integer,
  // so comparing it with c.width never matched and the canvas was cleared and resized on every frame
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; c.style.width = w + 'px'; c.style.height = h + 'px'; }
  const g = c.getContext('2d'); g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
  return { g, w, h };
}

// Inspiration bands and end-expiration markers, split where the sweep wraps.
function drawBreathing(g, s0, N, map, x0, pw, top, ph) {
  if (st.resp === 'none') return;
  const b = BREATHING[st.resp], tStart = s0 / FS, tEnd = (s0 + N) / FS;
  const span = (ta, tb, fn) => {                       // times → one or two screen intervals
    const ja = Math.max(map.G, Math.round(ta * FS) - s0), jb = Math.min(N - 1, Math.round(tb * FS) - s0);
    if (jb <= ja) return;
    const xa = map.X(ja), xb = map.X(jb);
    if (xb >= xa) fn(xa, xb); else { fn(xa, x0 + pw); fn(x0, xb); }
  };
  g.fillStyle = 'rgba(169,188,242,0.08)';
  for (let t = Math.floor(tStart / BREATH) * BREATH; t < tEnd; t += BREATH) {
    span(t, t + b.insp * BREATH, (xa, xb) => g.fillRect(xa, top, xb - xa, ph));
    const je = Math.round((t + endExp()) * FS) - s0;
    if (je >= map.G && je < N) {
      const xe = map.X(je);
      g.fillStyle = '#E8B962'; g.font = '11px system-ui'; g.textAlign = 'right'; g.fillText('end-exp ▾', xe - 2, top + 12); g.fillRect(xe, top + 16, 1.5, ph - 16);
      g.fillStyle = 'rgba(169,188,242,0.08)'; g.textAlign = 'left';
    }
  }
}

// ---------- where to read ----------
// Returns, for the beat to be read, the sample (or band of samples) at which the pressure is read, the
// value, and where that falls on the ECG. With breathing, the beat read is the last one before an
// end-expiration marker; without, the last complete beat on screen.
// how: completes "read at …"; ecg: short label on the tracing; ecgLong: completes "on the ECG, …".
const READ = {
  ra: { name: 'RAP (CVP)', how: 'the base of the c wave, at end-expiration', ecg: 'R wave', ecgLong: 'at the R wave, just before the c wave' },
  rv: { name: 'RVEDP', how: 'end-diastole, just before the systolic upstroke', ecg: 'QRS', ecgLong: 'at the QRS' },
  pa: { name: 'PADP', how: 'end-diastole, just before the systolic upstroke', ecg: 'end of QRS', ecgLong: 'at the end of the QRS' },
  wedge: { name: 'PAWP', how: 'the mean of the a wave, at end-expiration', ecg: 'a wave just after QRS', ecgLong: 'just after the QRS, because the a wave reaches the tip through the capillary bed' },
};
// Reading point on every complete beat on screen (with its value), newest first.
function readPoints(pos, out, s0, minJ = 0) {
  const n = beat.n, N = out.length, A = st.atr;
  const beats = [];
  for (let bi = 1; bi <= Math.ceil(N / n) + 1; bi++) beats.push((Math.floor((s0 + N) / n) - bi) * n - s0);
  const at = (bs, t) => bs + Math.round(t * FS);
  const argmin = (a, b) => { let k = -1; for (let j = Math.max(0, a); j <= Math.min(N - 1, b); j++) if (k < 0 || out[j] < out[k]) k = j; return k; };
  const one = (bs) => {
    const wr = waveTimes('ra'), wl = waveTimes('la');
    if (pos === 'ra') {
      if (A === 'junc') { const j = at(bs, 0); return { j, band: null, how: 'the onset of the QRS, before the cannon a wave, because atrial and ventricular contraction coincide', ecg: 'QRS onset', ecgLong: 'at the onset of the QRS' }; }
      if (A === 'tr') { const j = at(bs, wr.tIn); return { j, band: null, how: 'the QRS, before the regurgitant cv wave begins, because the c wave merges into it', ecg: 'QRS', ecgLong: 'at the QRS' }; }
      // base of the c wave: the low point between the a-wave downslope and the c-wave upstroke
      return { j: argmin(at(bs, wr.tIn - 0.01), at(bs, wr.c)), band: null };
    }
    if (pos === 'rv') return { j: at(bs, wr.tIn), band: null };
    if (pos === 'pa') return { j: argmin(at(bs, wr.tIn - 0.01), at(bs, wr.tOpen + 0.01)), band: null };
    if (A === 'junc') return null;                           // cannon a in systole: no end-diastolic a wave
    const ta = wl.a > TB / 2 ? wl.a - TB : wl.a;
    const [t0, t1] = A === 'af' ? [0.13, 0.16] : [ta + WEDGE_LAG - 0.05, ta + WEDGE_LAG + 0.05];
    const band = [at(bs, t0), at(bs, t1)];
    return { j: Math.round((band[0] + band[1]) / 2), band, ...(A === 'af' ? { how: '130–160 ms after QRS onset, at end-expiration, because there is no a wave in AF', ecg: '130–160 ms after QRS', ecgLong: '130–160 ms after the onset of the QRS' } : {}) };
  };
  const cands = beats.map(one).filter((r) => r && (r.band ? r.band[0] >= minJ && r.band[1] < N : r.j >= minJ && r.j < N));
  const pts = cands.map((r) => ({ ...READ[pos], ...r, value: r.band ? stats(out.slice(r.band[0], r.band[1] + 1)).mean : out[r.j] }));
  if (st.resp === 'none') return pts;
  // with breathing, only the beat read at each end-expiration: the last one before the marker
  const keep = new Set();
  for (let t = Math.floor(s0 / FS / BREATH) * BREATH; t <= (s0 + N) / FS; t += BREATH) {
    const je = Math.round((t + endExp()) * FS) - s0;
    let best = null;
    for (const r of pts) { const d = je - r.j; if (d >= 0 && d < BREATH * FS && (!best || d < best.d)) best = { d, r }; }
    if (best) keep.add(best.r);
  }
  return pts.filter((r) => keep.has(r));
}
function reading(pos, out, s0, minJ = 0) { return readPoints(pos, out, s0, minJ)[0] || null; }
// The value to read, which changes only when the patient or a setting changes: taken from a reference
// window that ends on a whole breath, so it does not move as the sweep advances.
const stableCache = new Map();
function stableReading(pos) {
  const key = JSON.stringify([st.preset, st.atr, st.resp, st.damp, st.level, st.challenge, st.tipH, st.peep, pos]);
  if (!stableCache.has(key)) {
    const tRef = Math.ceil(60 / BREATH) * BREATH, win = st.win;
    st.win = 6; const { out } = signal(tRef, pos); st.win = win;
    stableCache.set(key, reading(pos, out, Math.round(tRef * FS) - out.length));
  }
  return stableCache.get(key);
}
function dotted(g, x1, y1, x2, y2, color, width = 1.2) {
  g.save(); g.setLineDash([3, 4]); g.strokeStyle = color; g.lineWidth = width;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
}
// A horizontal line at the value to read, fixed unless a setting changes, and on each beat that is read
// a marker at its reading point carried down to the ECG. Beats do not move on the sweep, so neither do
// the markers.
function drawGuide(g, rd, pts, map, Y, x0, pw, yTop, yEcg, label = true) {
  const col = '#F2C66D';
  for (const p of pts) {
    if (p.band) {
      const xa = map.X(p.band[0]), xb = map.X(p.band[1]);
      if (xb > xa) { g.fillStyle = 'rgba(242,198,109,0.16)'; g.fillRect(xa, Y(p.value) - 14, xb - xa, yEcg - Y(p.value) + 14); }
    }
    const x = map.X(p.j), y = Y(p.value);
    dotted(g, x, y, x, yEcg + 10, col);
    g.fillStyle = col; g.beginPath(); g.arc(x, y, 3.5, 0, 2 * Math.PI); g.fill();
  }
  if (!rd) return;
  const y = Y(rd.value);
  dotted(g, x0, y, x0 + pw, y, col, 1.4);
  if (!label) return;
  const tag = (text, tx, ty, font, right) => {                    // text on a dark backing, so it stays legible over traces
    g.font = font; const wT = g.measureText(text).width, lx = right ? tx - wT : tx;
    g.fillStyle = 'rgba(5,9,10,0.85)'; g.fillRect(lx - 3, ty - 11, wT + 6, 15);
    g.fillStyle = col; g.textAlign = 'left'; g.fillText(text, lx, ty);
  };
  tag(`${rd.name} ${rd.value.toFixed(0)} mmHg`, x0 + pw - 6, y - 7, '600 12px system-ui', true);
  tag(`Read at: ${rd.ecg} on the ECG`, x0 + 6, yEcg - 12, '11px system-ui', false);
}

// The model's true LVEDP (LV pressure at the QRS), which the end-diastolic wedge estimates.
function lvedpLine(g, Y, x0, pw) {
  const v = R.lv.EDP, y = Y(v), col = '#F08CB4';
  g.save(); g.setLineDash([8, 4]); g.strokeStyle = col; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); g.restore();
  const text = `LVEDP ${v.toFixed(0)} mmHg (model)`;
  g.font = '600 12px system-ui'; const wT = g.measureText(text).width;
  g.fillStyle = 'rgba(5,9,10,0.85)'; g.fillRect(x0 + 4, y + 3, wT + 6, 15);
  g.fillStyle = col; g.textAlign = 'left'; g.fillText(text, x0 + 7, y + 14);
}

// ---------- all four positions ----------
// RA, RV, PA and wedge from the same beats, stacked over one ECG, as if four catheters sat in the four
// positions at the same moment. RV and PA share a scale, so the RV systolic peak can be seen to equal
// the PA systolic pressure; RA and wedge share a lower one.
const ALL_ROWS = [['ra', 'RA'], ['rv', 'RV'], ['pa', 'PA'], ['wedge', 'Wedge']];
function drawAll(tEnd, target) {
  const { g, w, h } = target || sizeCanvas(0.95, 1.6, 0.9, 420);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  const sig = Object.fromEntries(ALL_ROWS.map(([k]) => [k, signal(tEnd, k)]));
  const N = sig.ra.out.length, s0 = Math.round(tEnd * FS) - N;
  const x0 = w < 420 ? 30 : 40, pw = w - x0 - (w < 420 ? 6 : 12), ecgH = 44, rows = ALL_ROWS.length, rh = (h - ecgH - 8) / rows;
  const map = mapping(s0, N, x0, pw, !target && !reduce);
  const la = st.showLA ? Array.from({ length: N }, (_, j) => beat.la[(((s0 + j) % beat.n) + beat.n) % beat.n] + resp((s0 + j) / FS)) : null;
  const hiMax = Math.max(40, Math.ceil(Math.max(...sig.rv.out, ...sig.pa.out) * 1.12 / 10) * 10);
  const loMax = Math.max(20, Math.ceil(Math.max(...sig.ra.out, ...sig.wedge.out, ...(la || [])) * 1.2 / 5) * 5);
  const read = {};
  ALL_ROWS.forEach(([k, name], i) => {
    const top = 14 + i * rh, bot = top + rh - 22, ymax = k === 'rv' || k === 'pa' ? hiMax : loMax;
    const Y = (p) => bot - (Math.max(-5, p) / ymax) * (bot - top);
    g.strokeStyle = '#16251F'; g.lineWidth = 1; g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
    for (const p of [0, ymax / 2, ymax]) { g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x0 + pw, Y(p)); g.stroke(); g.fillText(p, x0 - 6, Y(p) + 4); }
    const { out, ed } = sig[k];
    if (k === 'wedge' && la) { g.strokeStyle = 'rgba(169,188,242,0.75)'; g.lineWidth = 1.3; drawTrace(g, (j) => la[j], map, N, x0, pw, Y); }
    if (k === 'wedge' && st.showLVEDP) lvedpLine(g, Y, x0, pw);
    g.strokeStyle = '#E8D35F'; g.lineWidth = 1.8; drawTrace(g, (j) => out[j], map, N, x0, pw, Y);
    if (st.labels && (k === 'ra' || (k === 'wedge' && westZone().ee === 3))) labelWaves(g, out, s0, map, Y, k);
    if (st.guide) drawGuide(g, stableReading(k), readPoints(k, out, s0, map.G), map, Y, x0, pw, top, bot, false);
    read[k] = report(out.slice(-beat.n * 2), k, ed, N - beat.n * 2);
    g.textAlign = 'left'; g.font = '600 12px system-ui'; g.fillStyle = '#E6EFEC';
    g.fillText(`${name}  ${read[k]}${k === 'wedge' && la ? '   (lavender: true LA)' : ''}`, x0 + 6, top + 4);
  });
  drawEcg(g, s0, map, N, x0, pw, h - 14, 1.6);
  if (target) return { all: true, ...read };
  $('#pac-read').innerHTML = ALL_ROWS.map(([k, name]) => `<div class="tile"><div class="tile-v">${read[k]}</div><div class="tile-k">${name}, last 2 beats</div></div>`).join('');
}

// ---------- catheter tip ----------
// target (export only): { g, w, h } of an off-page canvas; the page readout is left alone.
function draw(tEnd, target) {
  if (st.view === 'all') return drawAll(tEnd, target);
  const { g, w, h } = target || sizeCanvas(0.42, 0.95, 0.55, 300);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  const { out, raw, ed } = signal(tEnd);
  const N = out.length, s0 = Math.round(tEnd * FS) - N;
  const laTrue = st.pos === 'wedge' && st.showLA
    ? Array.from({ length: N }, (_, j) => beat.la[(((s0 + j) % beat.n) + beat.n) % beat.n] + resp((s0 + j) / FS)) : null;
  const x0 = w < 420 ? 30 : 40, pw = w - x0 - (w < 420 ? 6 : 12), top = 12, ph = h - top - 50;
  const map = mapping(s0, N, x0, pw, !target && !reduce);
  // vertical scale: fitted to the site on screen (auto), or a fixed range
  const peak = Math.max(...out, ...raw, ...(laTrue || []), st.pos === 'wedge' && st.showLVEDP ? R.lv.EDP : 0), low = Math.min(...out, ...raw, ...(laTrue || []));
  const ymax = st.scale === 'auto' ? Math.max(10, Math.ceil(peak * 1.15 / 5) * 5) : +st.scale;
  const ymin = low < 0 ? Math.floor(low / 5) * 5 : 0;
  const Y = (p) => top + ph - ((Math.max(ymin, p) - ymin) / (ymax - ymin)) * ph;
  if (!target) lastY = { toP: (y) => ymin + (top + ph - y) / ph * (ymax - ymin), Y, x0, pw, top, ph };
  g.strokeStyle = '#16251F'; g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
  const step = ymax - ymin > 60 ? 20 : ymax - ymin > 30 ? 10 : 5;
  for (let p = ymin; p <= ymax; p += step) { g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x0 + pw, Y(p)); g.stroke(); g.fillText(p, x0 - 6, Y(p) + 4); }
  g.textAlign = 'left'; g.fillText('mmHg', x0 + 6, top + 14);
  drawBreathing(g, s0, N, map, x0, pw, top, ph);
  if (st.damp !== 'ok' || st.level !== 0 || st.resp !== 'none') {      // true tip pressure, faint
    g.strokeStyle = 'rgba(160,175,170,0.45)'; g.lineWidth = 1.2; drawTrace(g, (j) => raw[j], map, N, x0, pw, Y);
  }
  if (laTrue) {                                                         // true LA pressure, as a second catheter would show it
    g.strokeStyle = 'rgba(169,188,242,0.75)'; g.lineWidth = 1.4; drawTrace(g, (j) => laTrue[j], map, N, x0, pw, Y);
  }
  g.strokeStyle = '#E8D35F'; g.lineWidth = 2; drawTrace(g, (j) => out[j], map, N, x0, pw, Y);
  if (laTrue) {
    // legend top left, clear of the end-expiration labels along the top edge
    const lx = x0 + 46;
    g.font = '12px system-ui'; g.textAlign = 'left';
    g.fillStyle = 'rgba(5,9,10,0.8)'; g.fillRect(lx - 4, top + 2, 128, 34);
    g.fillStyle = '#E8D35F'; g.fillText('— PAWP (catheter)', lx, top + 14);
    g.fillStyle = '#A9BCF2'; g.fillText('— true LA pressure', lx, top + 30);
  }
  if (st.pos === 'wedge' && st.showLVEDP && !(st.quiz.on && !st.quiz.revealed)) lvedpLine(g, Y, x0, pw);
  if (st.pos === 'wedge') {                                            // West zone of the tip
    const z = westZone().ee;
    g.font = '600 12px system-ui'; g.textAlign = 'right'; g.fillStyle = ZONE_COLOR[z];
    g.fillText(`West zone ${z}`, x0 + pw - 6, top + ph - 6); g.textAlign = 'left';
  }
  // outside zone 3 the wedge trace is alveolar pressure, so there are no atrial waves to label
  if (st.labels && (st.pos === 'ra' || (st.pos === 'wedge' && westZone().ee === 3))) labelWaves(g, out, s0, map, Y);
  const rd = stableReading(st.pos);
  const showGuide = st.quiz.on ? st.quiz.revealed : st.guide;
  if (showGuide) drawGuide(g, rd, readPoints(st.pos, out, s0, map.G), map, Y, x0, pw, top, h - 30);
  if (st.quiz.on && st.quiz.y != null) {                                // the learner's line
    const y = Y(st.quiz.y);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke();
    g.fillStyle = '#FFFFFF'; g.font = '600 12px system-ui'; g.fillText(`your reading ${st.quiz.y.toFixed(0)}`, x0 + 6, y - 6);
  }
  if (st.challenge) { g.fillStyle = '#E8B962'; g.font = '600 12px system-ui'; g.fillText(`after: ${CHALLENGES[st.challenge].name}`, x0 + 60, top + 14); }
  drawEcg(g, s0, map, N, x0, pw, h - 12);
  // readout
  const lastBeats = out.slice(-beat.n * 2), trueBeats = raw.slice(-beat.n * 2);
  const label = POS.find((p) => p[0] === st.pos)[1];
  const off = out.length - lastBeats.length;
  const read = { label, monitor: report(out, st.pos, ed), last: report(lastBeats, st.pos, ed, off), truth: report(trueBeats, st.pos, ed, off), reading: rd };
  if (laTrue) read.la = `${stats(laTrue.slice(-beat.n * 2)).mean.toFixed(0)} mean`;
  if (st.pos === 'wedge') read.ed = endDiastolicWedge(out, s0);
  if (target) return read;
  st.lastReading = rd;
  const quizHide = st.quiz.on && !st.quiz.revealed;
  $('#pac-read').innerHTML = quizHide ? '<div class="tile"><div class="tile-v">?</div><div class="tile-k">Readings hidden during the question</div></div>'
    : (rd ? `<div class="tile"><div class="tile-v">${rd.value.toFixed(0)}</div><div class="tile-k">${rd.name}, read at ${rd.how}</div></div>` : '')
    + (read.ed ? `<div class="tile"><div class="tile-v">${read.ed.value.toFixed(0)}</div><div class="tile-k">PAWP at end-diastole (${read.ed.how}). Model LVEDP ${R.lv.EDP.toFixed(0)}</div></div>` : '')
    + (laTrue ? `<div class="tile la"><div class="tile-v">${read.la}</div><div class="tile-k">True LA pressure (model), last 2 beats</div></div>` : '') + `<div class="tile"><div class="tile-v">${report(out, st.pos, ed)}</div><div class="tile-k">Monitor reads (${label}, whole ${st.win}-s screen)</div></div>
    <div class="tile"><div class="tile-v">${report(trueBeats, st.pos, ed, off)}</div><div class="tile-k">True tip pressure, no artifact (model)</div></div>`;
  drawMap();
}

// End-diastolic wedge (the LVEDP estimate), read the way Vachiéry 2019 describes: the mean of
// the a wave in sinus rhythm; 130–160 ms after QRS onset in AF. Averaged over the last 2 beats.
function endDiastolicWedge(out, s0) {
  const n = beat.n, N = out.length, w = waveTimes('la');
  const vals = [];
  for (let b = 1; b <= 2; b++) {
    const bs = (Math.floor((s0 + N) / n) - b) * n - s0;          // QRS onset of this beat, as an index into `out`
    const [t0, t1] = st.atr === 'af' ? [0.13, 0.16] : [w.a - TB + WEDGE_LAG - 0.05, w.a - TB + WEDGE_LAG + 0.05];
    for (let j = bs + Math.round(t0 * FS); j <= bs + Math.round(t1 * FS); j++) if (j >= 0 && j < N) vals.push(out[j]);
  }
  if (st.atr === 'junc' || !vals.length) return null;              // cannon a falls in systole: no end-diastolic a wave to read
  return { value: vals.reduce((a, v) => a + v, 0) / vals.length, how: st.atr === 'af' ? '130–160 ms after QRS (AF)' : 'mean of the a wave' };
}

// Letters on every complete beat on screen, placed on the trace's own peaks and troughs.
function labelWaves(g, out, s0, map, Y, pos = st.pos) {
  const wedge = pos === 'wedge', side = wedge ? 'la' : 'ra', lag = wedge ? WEDGE_LAG : 0, A = st.atr;
  const w = waveTimes(side), n = beat.n, N = out.length;
  g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillStyle = '#F2C66D';
  for (let bi = 1; bi <= Math.ceil(N / n) + 1; bi++) {
    const bs = (Math.floor((s0 + N) / n) - bi) * n - s0;       // index in `out` of this beat's QRS
    const idx = (t) => bs + Math.round((t + lag) * FS);
    const find = (t0, t1, max) => {
      const a = idx(t0), b = idx(t1);
      if (a < map.G || b > N - 1) return -1;                   // whole search window on screen, clear of the erase bar
      let best = -1;
      for (let j = a; j <= b; j++) if (best < 0 || (max ? out[j] > out[best] : out[j] < out[best])) best = j;
      return best;
    };
    const T = TB, ta = w.a > T / 2 && A !== 'junc' ? w.a - T : w.a;
    const big = (A === 'mr' && wedge) || (A === 'tr' && !wedge);
    const items = [];
    if (A !== 'af') items.push([A === 'junc' ? 'cannon a' : 'a', find(ta - 0.06, ta + 0.06, true), true]);
    if (!wedge && !big && A !== 'junc') items.push(['c', find(w.c - 0.02, w.c + 0.04, true), true]);
    if (!big) items.push(['x', find(w.c + 0.05, w.v - 0.08, false), false]);
    items.push([big ? (wedge ? 'giant v' : 'cv') : 'v', find(w.v - 0.12, w.v + 0.04, true), true]);
    items.push(['y', find(w.tIO + 0.02, w.tIO + 0.25, false), false]);
    for (const [txt, j, up] of items) if (j >= 0) g.fillText(txt, map.X(j), Y(out[j]) + (up ? -8 : 17));
  }
  g.textAlign = 'left';
}

// ---------- catheter diagram ----------
// Schematic heart with the catheter entering from the SVC; the tip sits in the chosen position, and the
// balloon is inflated in a PA branch at the wedge. In the all-positions view every site is marked.
const TIP = { ra: [118, 128], rv: [150, 176], pa: [168, 72], wedge: [226, 48] };
function drawHeart() {
  const svg = $('#pac-heart'); if (!svg) return;
  const all = st.view === 'all', i = POS.findIndex((p) => p[0] === st.pos);
  const path = [[110, 8], [112, 70], [118, 128], [138, 170], [150, 176], [160, 150], [162, 110], [168, 72], [200, 55], [226, 48]];
  const upto = all ? path.length : [3, 5, 8, 10][i];
  const pts = path.slice(0, upto).map((p) => p.join(',')).join(' ');
  const mark = (k, on) => { const [x, y] = TIP[k]; return `<circle cx="${x}" cy="${y}" r="${on ? 5.5 : 3.5}" class="${on ? 'tip on' : 'tip'}"/>`; };
  svg.innerHTML = `
    <path class="ch" d="M96 92 C70 96 66 150 96 162 C112 168 126 158 128 140 C130 116 118 92 96 92 Z"/>
    <path class="ch" d="M104 150 C112 186 150 214 178 204 C196 196 190 150 172 128 C156 112 128 120 116 136 Z"/>
    <path class="ch" d="M150 120 C150 90 160 70 176 62 L232 40 M176 62 L210 90"/>
    <path class="ch lh" d="M186 110 C206 96 238 104 240 128 C242 148 222 156 204 150 C190 144 182 126 186 110 Z"/>
    <path class="ch lh" d="M178 204 C214 212 250 180 246 150 C236 176 206 190 180 170"/>
    <line class="ch" x1="110" y1="0" x2="110" y2="92"/>
    <text x="72" y="130">RA</text><text x="130" y="196">RV</text><text x="178" y="56">PA</text><text x="214" y="132">LA</text><text x="222" y="186">LV</text><text x="116" y="16">SVC</text>
    <polyline class="cath" points="${pts}"/>
    ${all ? POS.map(([k]) => mark(k, true)).join('') : mark(st.pos, true)}
    ${(all || st.pos === 'wedge') ? '<ellipse class="balloon" cx="222" cy="49" rx="6" ry="4.5"/>' : ''}`;
  $('#pac-heart-cap').textContent = all ? 'All four sites at once (four catheters in the model).'
    : { ra: 'Tip in the right atrium: RA pressure (CVP).', rv: 'Tip across the tricuspid valve in the RV.', pa: 'Tip past the pulmonic valve in the main PA.', wedge: 'Balloon inflated in a PA branch: the tip sees LA pressure through the capillary bed.' }[st.pos];
}

let mapPos = null;
function drawMap() {
  if (mapPos === st.pos) return;
  mapPos = st.pos;
  const order = POS.map((p) => p[0]), i = order.indexOf(st.pos);
  $('#pac-path').innerHTML = POS.map(([id, t], k) => `<button type="button" class="pp${k === i ? ' on' : ''}${k < i ? ' done' : ''}" data-v="${id}" aria-pressed="${k === i}">${t}</button>`).join('<span class="pp-arrow">→</span>');
  drawHeart();
}

// ---------- challenges ----------
function hemoRow(r) {
  const h = r.hemo, tpg = h.mPAP - h.LAP, pvr = tpg / h.CO;
  return { rap: h.RAP, mpap: h.mPAP, pawp: h.LAP, co: h.CO, tpg, pvr };
}
function challengePanel() {
  const box = $('#pac-chal-out'); if (!box) return;
  if (!st.challenge) { box.innerHTML = '<p class="status">No challenge given. The table compares the steady state before and after.</p>'; return; }
  const a = hemoRow(R0), b = hemoRow(R), f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1);
  const rows = [['RAP (mmHg)', a.rap, b.rap, f0], ['mPAP (mmHg)', a.mpap, b.mpap, f0], ['PAWP (mmHg)', a.pawp, b.pawp, f0], ['Cardiac output (L/min)', a.co, b.co, f1], ['TPG (mmHg)', a.tpg, b.tpg, f0], ['PVR (WU)', a.pvr, b.pvr, f1]];
  let verdict = '';
  if (st.challenge === 'fluid') {
    verdict = b.pawp > 18 ? `PAWP rose from ${f0(a.pawp)} to ${f0(b.pawp)} mmHg, above 18 mmHg, which after 500 mL of saline points to left heart disease (see Fluid challenge below).`
      : `PAWP rose from ${f0(a.pawp)} to ${f0(b.pawp)} mmHg and stayed at or below 18 mmHg.`;
  } else {
    const drop = a.mpap - b.mpap, pos = drop >= 10 && b.mpap <= 40 && b.co >= a.co * 0.97;
    verdict = `mPAP fell by ${f0(drop)} mmHg to ${f0(b.mpap)} mmHg with cardiac output ${b.co >= a.co ? 'unchanged or higher' : 'lower'}. ${pos ? 'This meets' : 'This does not meet'} the definition of acute vasoreactivity: a fall of at least 10 mmHg to 40 mmHg or less with unchanged or increased cardiac output.`;
  }
  box.innerHTML = `<table class="data metrics"><thead><tr><th></th><th class="num">Before</th><th class="num">After</th></tr></thead><tbody>${rows.map(([k, x, y, f]) => `<tr><td>${k}</td><td class="num">${f(x)}</td><td class="num cur">${f(y)}</td></tr>`).join('')}</tbody></table><p>${verdict}</p>`;
}

// ---------- West zone ----------
const ZONE_COLOR = { 1: '#E0605A', 2: '#E8B962', '2–3': '#E8B962', 3: '#7BC47F' };
function zonePanel() {
  const box = $('#pac-zone'); if (!box || !beat) return;
  const z = westZone(), f0 = (v) => v.toFixed(0);
  const tEE = endExp(), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const pawp = mean(beat.wedge.map((v) => tipReading(v + resp(tEE) + pleuralPeep(), tEE)));
  const laTrue = mean(beat.la) + pleuralPeep(), padp = Math.min(...beat.pa) + pleuralPeep();
  const where = st.tipH < 0 ? `${-st.tipH} cm below the LA` : st.tipH === 0 ? 'level with the LA' : `${st.tipH} cm above the LA`;
  const text = {
    3: 'Alveolar pressure stays below the pulmonary venous pressure at the tip, so the column to the left atrium stays open and the PAWP follows LA pressure.',
    '2–3': 'Alveolar pressure exceeds the pulmonary venous pressure at the tip during the lowest part of each beat, so the trough of the PAWP is clipped at alveolar pressure.',
    2: 'Alveolar pressure exceeds the pulmonary venous pressure at the tip, so the vessel between the tip and the left atrium collapses and the tip reads alveolar pressure, which is higher than LA pressure and swings with each breath.',
    1: 'Alveolar pressure exceeds even the pulmonary arterial pressure at the tip. The tip reads alveolar pressure throughout, with no a or v waves and a large swing with each breath.',
  }[z.ee];
  const brk = st.resp !== 'none' && z.peak !== z.ee ? ` During each breath the tip passes into zone ${z.peak}.` : '';
  box.innerHTML = `<p><b style="color:${ZONE_COLOR[z.ee]}">West zone ${z.ee}</b> at end-expiration, with the tip ${where} and PEEP ${st.peep} cmH₂O. ${text}${brk}</p>`
    + `<table class="data metrics"><tbody><tr><td>PAWP read at end-expiration</td><td class="num cur">${f0(pawp)}</td></tr><tr><td>True mean LA pressure</td><td class="num">${f0(laTrue)}</td></tr><tr><td>PADP</td><td class="num">${f0(padp)}</td></tr></tbody></table>`
    + (pawp > padp + 0.5 ? '<p>A PAWP above the PADP is a sign that the tip is not in zone 3.</p>' : '');
}

// ---------- quiz ----------
const QUIZ_CASES = ['normal', 'hfpef', 'hfref', 'pahComp', 'pahDecomp', 'cpcph', 'acutePE', 'trSevere', 'mrAcute'];
function newQuestion() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ids = PRESETS.map((p) => p.id).filter((id) => QUIZ_CASES.includes(id));
  st.preset = pick(ids); st.pos = pick(['ra', 'ra', 'wedge', 'wedge', 'rv', 'pa']); st.resp = pick(['none', 'spont', 'spont', 'ppv', 'tachy']);
  // no second valve lesion on a valve case
  st.atr = pick(['trSevere', 'mrAcute'].includes(st.preset) ? ['sinus', 'sinus', 'af'] : ['sinus', 'sinus', 'sinus', 'af', 'mr', 'tr']);
  st.view = 'tip'; st.challenge = null; st.damp = 'ok'; st.level = 0; st.tipH = -5; st.peep = 0;
  Object.assign(st.quiz, { on: true, y: null, revealed: false });
  $('#pac-case').value = st.preset;
  buildBeat(); syncSegs(); zonePanel(); mapPos = null;
  st.playing = false; $('#pac-play').textContent = '▶ Run';
  const rdName = READ[st.pos].name;
  $('#pac-quiz-out').innerHTML = `<p><b>Question.</b> ${presetById(st.preset).label}, ${ATRIAL[st.atr].toLowerCase()}, ${st.resp === 'none' ? 'no breathing' : { spont: 'spontaneous breathing', tachy: 'tachypnea with active expiration', ppv: 'positive-pressure ventilation' }[st.resp]}. Drag a horizontal line on the tracing to where you would read the ${rdName}, then check your answer.</p>`;
  $('#pac-quiz-check').disabled = false;
  draw(st.tFrozen);
}
function checkAnswer() {
  if (!st.quiz.on) return;
  st.quiz.revealed = true;
  draw(st.tFrozen);
  const rd = st.lastReading;
  const out = $('#pac-quiz-out');
  if (!rd) { out.innerHTML += '<p>There is no end-diastolic a wave to read in this rhythm; the cannon a falls in systole.</p>'; return; }
  const yours = st.quiz.y, diff = yours == null ? null : yours - rd.value;
  out.innerHTML += `<p><b>Answer.</b> ${rd.name} is read at ${rd.how}; on the ECG, that is ${rd.ecgLong}. On this tracing it is ${rd.value.toFixed(0)} mmHg. ${yours == null ? 'No line was placed.' : `Your line was at ${yours.toFixed(0)} mmHg, ${Math.abs(diff) < 1.5 ? 'within 1.5 mmHg.' : `${Math.abs(diff).toFixed(0)} mmHg ${diff > 0 ? 'high' : 'low'}.`}`}</p>`;
  $('#pac-quiz-check').disabled = true;
}
function endQuiz() { Object.assign(st.quiz, { on: false, y: null, revealed: false }); $('#pac-quiz-out').innerHTML = ''; draw(st.tFrozen); }

function loop(now) {
  if (st.last == null) st.last = now;
  if (st.playing) st.tFrozen += ((now - st.last) / 1000) * st.rate;
  st.last = now;
  draw(st.tFrozen);
  if (st.playing) requestAnimationFrame(loop); else st.last = null;
}

// ---------- export for slides ----------
// One breath cycle (a whole number of beats) or, without breathing, whole beats filling ≥ 3 s.
const DAMP = { ok: '', over: 'overdamped', under: 'underdamped (whip)' };
const LEVEL = { 0: '', 1: 'transducer 10 cm below the phlebostatic axis', '-1': 'transducer 10 cm above the phlebostatic axis' };
const RESP = { none: '', spont: 'spontaneous breaths', tachy: 'tachypnea with active expiration', ppv: 'positive-pressure breaths' };
function pacSpec() {
  const all = st.view === 'all';
  const label = all ? 'All four positions' : POS.find((p) => p[0] === st.pos)[1], patient = presetById(st.preset).label;
  const faults = [DAMP[st.damp], LEVEL[st.level], RESP[st.resp]].filter(Boolean);
  const rhythm = st.atr === 'sinus' ? '' : ATRIAL[st.atr].toLowerCase();
  const fault = faults.length ? faults.join(', ') : 'no artifact';
  return {
    file: `va-coupling-pac-${all ? 'all' : st.pos}-${st.preset}${st.atr === 'sinus' ? '' : '-' + st.atr}${faults.length ? '-artifact' : ''}`,
    title: `PA catheter, ${label} · ${patient}`,
    caption: all ? `RA, RV, PA and wedge (PAWP) pressures from the same model beats, stacked over one ECG${rhythm ? `, with ${rhythm}` : ''} (${fault}). RV and PA share a scale, as do RA and wedge.` : `Pressure at the catheter tip in the ${label} position, generated from the model beat${rhythm ? ` with ${rhythm}` : ''} (${fault}).${st.pos === 'ra' || st.pos === 'wedge' ? ' Every atrial wave comes from the model beat.' : ''}${st.pos === 'wedge' && st.showLA ? ' The lavender line is the true LA pressure.' : ''}${st.guide ? ' The dotted lines mark where the pressure is read and where that falls on the ECG.' : ''}${faults.length ? ' The gray line is the true tip pressure without the artifact.' : ''}${st.resp !== 'none' ? ' The shaded bands mark inspiration, and pressures are read at end-expiration, which is marked.' : ''}`,
    notes: '',
    async prepare() {
      const W = 1100, h = Math.round(W * (all ? 0.95 : 0.42)), top = 56, band = 44, H = even(top + h + band);
      const c = document.createElement('canvas'); c.width = W; c.height = h;
      const cg = c.getContext('2d'), t0 = 100 * BREATH;          // well past start-up, on a whole breath and beat
      const duration = st.resp === 'none' ? Math.ceil(3 / TB) * TB : BREATH;
      const first = draw(t0 + duration, { g: cg, w: W, h });
      this.notes = all ? `Last 2 beats: RA ${first.ra}, RV ${first.rv}, PA ${first.pa}, PAWP ${first.wedge} mmHg. Artifact: ${fault}.` : `Monitor reads ${first.monitor} (whole screen), last 2 beats ${first.last}; true tip pressure ${first.truth} mmHg.${first.reading ? ` ${first.reading.name} read at ${first.reading.how}: ${first.reading.value.toFixed(0)} mmHg.` : ''} Artifact: ${fault}.`;
      return {
        W, H, duration,
        async frame(g, t) {
          const r = draw(t0 + t, { g: cg, w: W, h });
          g.fillStyle = '#05090A'; g.fillRect(0, 0, W, H);
          header(g, W, `${label} · ${patient}`, [rhythm, faults.length ? fault : ''].filter(Boolean).join(' · ') || 'no artifact');
          g.drawImage(c, 0, top);
          g.font = '600 17px system-ui, sans-serif'; g.textAlign = 'left';
          const items = all ? ALL_ROWS.map(([k, n]) => [n, r[k], '#E8D35F']) : [['Monitor reads', r.monitor, '#E8D35F'], ...(r.ed ? [[r.ed.how === 'mean of the a wave' ? 'PAWP at the a wave (end-diastole)' : 'End-diastole (AF)', r.ed.value.toFixed(0), '#E8D35F']] : []),
            [r.la ? 'True LA' : 'True pressure (model)', r.la || r.truth, '#A7B8B2'], [r.ed ? 'Model LVEDP' : 'Last 2 beats', r.ed ? R.lv.EDP.toFixed(0) : r.last, '#A7B8B2']];
          let x = 20;
          for (const [k, v, col] of items) {
            g.fillStyle = '#A7B8B2'; g.font = '14px system-ui, sans-serif'; g.fillText(k, x, top + h + 28);
            x += g.measureText(k).width + 8;
            g.fillStyle = col; g.font = '600 17px system-ui, sans-serif'; g.fillText(v, x, top + h + 28);
            x += g.measureText(v).width + 32;
          }
        },
      };
    },
  };
}

const SEGS = [];
function seg(id, opts, get, set) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = opts.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('');
  const sync = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))));
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); sync(); if (!st.playing) draw(st.tFrozen); });
  SEGS.push(sync);
  sync();
}
// Independent on/off buttons: each press flips one st flag.
function toggles(id, opts) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = opts.map(([k, t]) => `<button type="button" data-k="${k}">${t}</button>`).join('');
  const sync = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(!!st[b.dataset.k])));
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st[b.dataset.k] = !st[b.dataset.k]; sync(); if (!st.playing) draw(st.tFrozen); });
  SEGS.push(sync);
  sync();
}
function syncSegs() {
  SEGS.forEach((f) => f());
  $('#pac-path').hidden = st.view === 'all'; $('#pac-float').hidden = st.view === 'all';
}

export function initPacSim() {
  const sel = $('#pac-case');
  sel.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
  sel.addEventListener('change', () => { st.preset = sel.value; buildBeat(); challengePanel(); zonePanel(); if (!st.playing) draw(st.tFrozen); });
  $('#pac-path').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.pos = b.dataset.v; draw(st.tFrozen); });
  seg('pac-damp', [['ok', 'Optimal'], ['over', 'Overdamped'], ['under', 'Underdamped (whip)']], () => st.damp, (v) => { st.damp = v; });
  seg('pac-level', [['0', 'At phlebostatic axis'], ['1', '10 cm below'], ['-1', '10 cm above']], () => st.level, (v) => { st.level = +v; });
  seg('pac-atr', Object.entries(ATRIAL), () => st.atr, (v) => { st.atr = v; buildBeat(); challengePanel(); zonePanel(); });
  seg('pac-view', [['tip', 'Catheter tip'], ['all', 'All four positions']], () => st.view, (v) => { st.view = v; syncSegs(); mapPos = null; drawMap(); drawHeart(); });
  seg('pac-lbl', [['1', 'Label waves'], ['0', 'No labels']], () => (st.labels ? '1' : '0'), (v) => { st.labels = v === '1'; });
  toggles('pac-quick', [['guide', 'Where to read'], ['showLA', 'True LA at wedge'], ['showLVEDP', 'LVEDP at wedge']]);
  seg('pac-tip', [['-5', '5 cm below the LA'], ['0', 'Level with the LA'], ['5', '5 cm above'], ['10', '10 cm above']], () => st.tipH, (v) => { st.tipH = +v; zonePanel(); });
  seg('pac-peep', [['0', '0'], ['5', '5'], ['10', '10'], ['15', '15'], ['20', '20 cmH₂O']], () => st.peep, (v) => { st.peep = +v; zonePanel(); });
  seg('pac-resp', [['none', 'Apneic'], ['spont', 'Spontaneous, 15/min'], ['tachy', 'Tachypnea, 30/min'], ['ppv', 'Positive-pressure breaths']], () => st.resp, (v) => { st.resp = v; setBreath(); zonePanel(); });
  seg('pac-win', [['2', '2 s'], ['3', '3 s'], ['6', '6 s'], ['12', '12 s'], ['24', '24 s']], () => st.win, (v) => { st.win = +v; });
  seg('pac-scale', [['auto', 'Fit this site'], ['20', '0–20'], ['40', '0–40'], ['80', '0–80']], () => st.scale, (v) => { st.scale = v; });
  seg('pac-rate', [['0.25', '¼ speed'], ['0.5', '½ speed'], ['1', 'Real time']], () => st.rate, (v) => { st.rate = +v; });
  $('#pac-float').addEventListener('click', () => {
    const order = POS.map((p) => p[0]);
    st.pos = order[(order.indexOf(st.pos) + 1) % order.length];
    draw(st.tFrozen);
  });
  $('#pac-play').addEventListener('click', () => {
    st.playing = !st.playing;
    $('#pac-play').textContent = st.playing ? '❚❚ Freeze' : '▶ Run';
    if (st.playing) { st.last = null; requestAnimationFrame(loop); }
  });
  $('#pac-play').textContent = st.playing ? '❚❚ Freeze' : '▶ Run';
  // challenges
  $('#pac-chal')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]'); if (!b) return;
    st.challenge = b.dataset.c === 'none' ? null : b.dataset.c;
    buildBeat(); challengePanel(); zonePanel(); if (!st.playing) draw(st.tFrozen);
  });
  // quiz: drag a horizontal line on the tracing
  const cv = $('#pac-scr');
  const setY = (e) => {
    if (!st.quiz.on || st.quiz.revealed || !lastY || st.view !== 'tip') return;
    const r = cv.getBoundingClientRect(), y = e.clientY - r.top;
    st.quiz.y = Math.max(0, lastY.toP(y));
    if (!st.playing) draw(st.tFrozen);
  };
  let dragging = false;
  cv.addEventListener('pointerdown', (e) => { if (!st.quiz.on) return; dragging = true; cv.setPointerCapture(e.pointerId); setY(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) setY(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  $('#pac-quiz-new')?.addEventListener('click', newQuestion);
  $('#pac-quiz-check')?.addEventListener('click', checkAnswer);
  $('#pac-quiz-end')?.addEventListener('click', endQuiz);
  buildBeat();
  challengePanel(); zonePanel();
  drawHeart();
  addExport($('#pac-scr').parentElement, pacSpec);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => draw(st.tFrozen), 150); });
  if (st.playing) requestAnimationFrame(loop); else draw(0);
}

// exported for tests
export const _pac = { st, buildBeat, signal, stats, waveTimes, reading, get beat() { return beat; }, get breath() { return BREATH; }, get tb() { return TB; }, get R() { return R; }, get R0() { return R0; }, MMHG_PER_10CM, FS, FLUID_STRESSED };
