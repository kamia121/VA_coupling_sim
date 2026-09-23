// PA catheter tracing: the pressure the catheter tip sees at each position, generated from the
// model beat of the chosen scenario, with common measurement artifacts applied on top.
import { simulate, cardiacPhases } from './engine.js';
import { PRESETS, presetById } from './presets.js';
import { addExport, header, even } from './export.js';

const FS = 250;                       // display sample rate, Hz
const WIN = 6;                        // seconds shown
const BREATH_TARGET = 4;              // s per breath (≈15/min); inspiration = first third
const MMHG_PER_10CM = 7.4;            // 10 cmH2O × 0.735 mmHg/cmH2O
const POS = [['ra', 'RA'], ['rv', 'RV'], ['pa', 'PA'], ['wedge', 'Wedge']];
const $ = (s) => document.querySelector(s);
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const st = { preset: 'normal', pos: 'ra', damp: 'ok', level: 0, resp: 'none', atr: 'sinus', showLA: true, labels: true, t0: performance.now(), playing: !reduce, tFrozen: 0 };
let R = null, beat = null, ev = null, evs = null, BREATH = BREATH_TARGET, TB = 1;   // TB: beat period as sampled

// ---------- atrial waves ----------
// The model's atria contract (engine.js), so the a wave, the fall in pressure as the atrium
// relaxes, the loss of the a wave in atrial fibrillation, and cannon a waves in AV dissociation
// all come from the physics. What the lumped model cannot produce is added from a template
// timed to its valve events: the small c wave (the valve bulging into the atrium), the part of
// the x descent caused by descent of the base in systole, and the large systolic waves of
// severe mitral or tricuspid regurgitation. t = 0 is QRS onset (start of ventricular activation).
const PR = 0.16;                      // s, P-wave onset to QRS (engine default)
export const ATRIAL = {
  sinus: 'Sinus rhythm',
  af: 'Atrial fibrillation',
  junc: 'AV dissociation (cannon a)',
  mr: 'Severe mitral regurgitation',
  tr: 'Severe tricuspid regurgitation',
};
// Engine settings for each rhythm: no atrial contraction in AF; in AV dissociation the atrium
// contracts 50 ms after the QRS, against closed AV valves.
const RHYTHM = { af: { aKick: 0 }, junc: { aShift: PR + 0.05 } };

function waveTimes(side) {            // side: 'ra' (right heart events) or 'la' (left heart events)
  const e = evs[side === 'ra' ? 'rv' : 'lv'].events, m = R.rec.t.length, T = R.T;
  const at = (i) => (i / m) * T;
  const tIn = at(e.inClose), tOpen = at(e.outOpen), tClose = at(e.outClose), tIO = at(e.inOpen);
  let ia = 0;                         // peak of atrial activation
  for (let i = 1; i < m; i++) if (R.rec.aAct[i] > R.rec.aAct[ia]) ia = i;
  return { a: at(ia), c: tIn + 0.03, x: tOpen + 0.35 * (tClose - tOpen), v: tIO - 0.02, y: tIO + 0.09, tOpen, tClose, tIO };
}
function atrialWaves(side, n) {
  const T = n / FS, w = waveTimes(side), out = new Array(n);
  const g = (t, mu, sd) => { let d = (((t - mu) % T) + T) % T; if (d > T / 2) d -= T; return Math.exp(-0.5 * (d / sd) ** 2); };
  const sys = (t) => {                // systolic regurgitant wave: rises through ejection, falls with the y descent
    if (t >= w.tOpen && t < w.tIO) return Math.sin(((t - w.tOpen) / (w.tIO - w.tOpen)) * Math.PI / 2) ** 1.5;
    return t >= w.tIO ? Math.exp(-(t - w.tIO) / 0.05) : 0;
  };
  const la = side === 'la', A = st.atr;
  const big = A === 'mr' && la ? 18 : A === 'tr' && !la ? 9 : 0;
  const cAmp = A === 'junc' ? 0 : la ? 0.8 : 1.2;
  // systolic x descent from descent of the base (atrial relaxation is already in the model);
  // filled in by the regurgitant wave in severe MR or TR
  const xAmp = big ? 0 : la ? 1.5 : 2;
  for (let k = 0; k < n; k++) {
    const t = k / FS;
    out[k] = cAmp * g(t, w.c, 0.015) - xAmp * g(t, w.x, 0.3 * (w.tClose - w.tOpen)) + big * sys(t);
  }
  return out;
}

// One beat of each site's pressure, resampled to FS. Wedge = LA pressure,
// smoothed (τ 50 ms) and delayed 60 ms to mimic transmission through the occluded capillary bed.
function buildBeat() {
  R = simulate({ ...presetById(st.preset).params, ...(RHYTHM[st.atr] || {}) });
  evs = cardiacPhases(R); ev = evs.rv.events;
  const n = Math.round(R.T * FS), m = R.rec.t.length;
  const pick = (arr) => Array.from({ length: n }, (_, k) => arr[Math.min(m - 1, Math.floor((k / n) * m))]);
  const addA = (arr, side) => { const a = atrialWaves(side, n); return arr.map((v, k) => v + a[k]); };
  const la = addA(pick(R.rec.Pla), 'la'), wedge = new Array(n), d = Math.round(0.06 * FS), a = 1 / (1 + 0.05 * FS);
  let y = la.reduce((s, v) => s + v, 0) / n;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) { y += a * (la[(k - d + n) % n] - y); wedge[k] = y; }
  beat = { n, ra: addA(pick(R.rec.Pra), 'ra'), rv: pick(R.rec.Prv), pa: pick(R.rec.Ppa), wedge, la };
  TB = n / FS;
  BREATH = Math.max(2, Math.round(BREATH_TARGET / TB)) * TB;   // whole number of beats, so the pattern repeats exactly
}
const WEDGE_LAG = 0.06 + 0.05;        // s: transmission delay + filter time constant

// ECG in mV-ish screen units at time t (s); rhythm follows st.atr.
function ecg(t) {
  const ph = (((t % TB) + TB) % TB), u = ph / TB;
  let d = u < 0.03 ? Math.sin(u / 0.03 * Math.PI) * 12 * (u < 0.015 ? 1 : -0.4) : u > 0.3 && u < 0.45 ? Math.sin((u - 0.3) / 0.15 * Math.PI) * 3.5 : 0;
  const tp = ph - (TB - PR);                         // P wave: 0–0.09 s after its onset
  if ((st.atr === 'sinus' || st.atr === 'mr' || st.atr === 'tr') && tp >= 0 && tp < 0.09) d += 2 * Math.sin(tp / 0.09 * Math.PI);
  if (st.atr === 'af') {                             // fibrillatory baseline; frequencies fit the beat so the loop repeats
    const f1 = Math.round(6.3 * TB) / TB, f2 = Math.round(8.7 * TB) / TB;
    d += 0.9 * Math.sin(2 * Math.PI * f1 * t) + 0.6 * Math.sin(2 * Math.PI * f2 * t + 1);
  }
  return d;
}

function resp(t) {
  if (st.resp === 'none') return 0;
  const ph = (((t % BREATH) + BREATH) % BREATH) / BREATH;
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
  const s0 = Math.round(tEnd * FS) - N;                 // whole sample numbers, so the pattern repeats exactly
  for (let j = -warm; j < N; j++) {
    const t = (s0 + j) / FS;
    const k = (((s0 + j) % beat.n) + beat.n) % beat.n;
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

// target (export only): { g, w, h } of an off-page canvas; the page readout is left alone.
function draw(tEnd, target) {
  let g, w, h;
  if (target) ({ g, w, h } = target);
  else {
    const c = $('#pac-scr'), cs = getComputedStyle(c.parentElement);
    w = Math.floor(Math.min(800, c.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))); h = Math.round(w * (w < 520 ? 0.75 : 0.42));
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; }
    g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  const { out, raw, ed } = signal(tEnd);
  const N = out.length, s0 = Math.round(tEnd * FS) - N;
  const laTrue = st.pos === 'wedge' && st.showLA
    ? Array.from({ length: N }, (_, j) => beat.la[(((s0 + j) % beat.n) + beat.n) % beat.n] + resp((s0 + j) / FS)) : null;
  const x0 = 40, pw = w - x0 - 12, top = 12, ph = h - top - 50;
  const ymax = Math.max(20, Math.ceil(Math.max(...beat.rv, ...out, ...(laTrue || [])) * 1.15 / 10) * 10);
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
  if (laTrue) {                                                               // true LA pressure, as a second catheter would show it
    g.strokeStyle = '#A9BCF2'; g.lineWidth = 1.6; g.setLineDash([5, 4]); g.beginPath();
    laTrue.forEach((p, j) => { const x = x0 + (j / N) * pw; j ? g.lineTo(x, Y(p)) : g.moveTo(x, Y(p)); }); g.stroke(); g.setLineDash([]);
  }
  g.strokeStyle = '#E8D35F'; g.lineWidth = 2; g.beginPath();                 // monitor PA/RA trace color
  out.forEach((p, j) => { const x = x0 + (j / out.length) * pw; j ? g.lineTo(x, Y(p)) : g.moveTo(x, Y(p)); }); g.stroke();
  if (laTrue) {
    g.font = '12px system-ui'; g.textAlign = 'right';
    g.fillStyle = '#E8D35F'; g.fillText('— wedge (catheter)', x0 + pw - 6, top + 14);
    g.fillStyle = '#A9BCF2'; g.fillText('- - true LA pressure', x0 + pw - 6, top + 30);
    g.textAlign = 'left';
  }
  if (st.labels && (st.pos === 'ra' || st.pos === 'wedge')) labelWaves(g, out, s0, (j) => x0 + (j / N) * pw, Y);
  // ECG
  g.strokeStyle = '#7CE38B'; g.lineWidth = 1.2; g.beginPath();
  for (let j = 0; j <= pw; j++) {
    const d = ecg(tEnd - WIN + (j / pw) * WIN);
    j ? g.lineTo(x0 + j, h - 18 - d) : g.moveTo(x0 + j, h - 18 - d);
  }
  g.stroke();
  // readout
  const lastBeats = out.slice(-beat.n * 2), trueBeats = raw.slice(-beat.n * 2);
  const label = POS.find((p) => p[0] === st.pos)[1];
  const off = out.length - lastBeats.length;
  const read = { label, monitor: report(out, st.pos, ed), last: report(lastBeats, st.pos, ed, off), truth: report(trueBeats, st.pos, ed, off) };
  if (laTrue) read.la = `${stats(laTrue.slice(-beat.n * 2)).mean.toFixed(0)} mean`;
  if (st.pos === 'wedge') read.ed = endDiastolicWedge(out, s0);
  if (target) return read;
  $('#pac-read').innerHTML = (read.ed ? `<div class="tile"><div class="tile-v">${read.ed.value.toFixed(0)}</div><div class="tile-k">Wedge at end-diastole (${read.ed.how}). Model LVEDP ${R.lv.EDP.toFixed(0)}</div></div>` : '')
    + (laTrue ? `<div class="tile la"><div class="tile-v">${read.la}</div><div class="tile-k">True LA pressure (model), last 2 beats</div></div>` : '') + `<div class="tile"><div class="tile-v">${report(out, st.pos, ed)}</div><div class="tile-k">Monitor reads (${label}, whole ${WIN}-s screen)</div></div>
    <div class="tile"><div class="tile-v">${report(lastBeats, st.pos, ed, off)}</div><div class="tile-k">Last 2 beats on screen</div></div>
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

// Letters on the last complete beat on screen, placed on the trace's own peaks and troughs.
function labelWaves(g, out, s0, X, Y) {
  const wedge = st.pos === 'wedge', side = wedge ? 'la' : 'ra', lag = wedge ? WEDGE_LAG : 0, A = st.atr;
  const w = waveTimes(side), n = beat.n, N = out.length;
  const bs = (Math.floor((s0 + N) / n) - 2) * n - s0;          // index in `out` of the last complete beat's QRS
  const idx = (t) => bs + Math.round((t + lag) * FS);
  const find = (t0, t1, max) => {
    let best = -1;
    for (let j = Math.max(0, idx(t0)); j <= Math.min(N - 1, idx(t1)); j++) if (best < 0 || (max ? out[j] > out[best] : out[j] < out[best])) best = j;
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
  g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillStyle = '#F2C66D';
  for (const [txt, j, up] of items) if (j >= 0) g.fillText(txt, X(j), Y(out[j]) + (up ? -8 : 17));
  g.textAlign = 'left';
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

// ---------- export for slides ----------
// One breath cycle (a whole number of beats) or, without breathing, whole beats filling ≥ 3 s.
const DAMP = { ok: '', over: 'overdamped', under: 'underdamped (whip)' };
const LEVEL = { 0: '', 1: 'transducer 10 cm below the phlebostatic axis', '-1': 'transducer 10 cm above the phlebostatic axis' };
const RESP = { none: '', spont: 'spontaneous breaths', ppv: 'positive-pressure breaths' };
function pacSpec() {
  const label = POS.find((p) => p[0] === st.pos)[1], patient = presetById(st.preset).label;
  const faults = [DAMP[st.damp], LEVEL[st.level], RESP[st.resp]].filter(Boolean);
  const rhythm = st.atr === 'sinus' ? '' : ATRIAL[st.atr].toLowerCase();
  const fault = faults.length ? faults.join(', ') : 'no artifact';
  return {
    file: `va-coupling-pac-${st.pos}-${st.preset}${st.atr === 'sinus' ? '' : '-' + st.atr}${faults.length ? '-artifact' : ''}`,
    title: `PA catheter, ${label} tracing · ${patient}`,
    caption: `Pressure at the catheter tip in the ${label} position, generated from the model beat${rhythm ? ` with ${rhythm}` : ''} (${fault}).${st.pos === 'ra' || st.pos === 'wedge' ? ' The a wave comes from atrial contraction in the model; the c wave and the systolic part of the x descent come from an illustrative template timed to the model beat.' : ''}${st.pos === 'wedge' && st.showLA ? ' The dashed line is the true LA pressure.' : ''}${faults.length ? ' The gray line is the true tip pressure without the artifact.' : ''}${st.resp !== 'none' ? ' The shaded bands mark inspiration, and pressures are read at end-expiration, which is marked.' : ''}`,
    notes: '',
    async prepare() {
      const W = 1100, h = Math.round(W * 0.42), top = 56, band = 44, H = even(top + h + band);
      const c = document.createElement('canvas'); c.width = W; c.height = h;
      const cg = c.getContext('2d'), t0 = 100 * BREATH;          // well past start-up, on a whole breath and beat
      const duration = st.resp === 'none' ? Math.ceil(3 / TB) * TB : BREATH;
      const first = draw(t0 + duration, { g: cg, w: W, h });
      this.notes = `Monitor reads ${first.monitor} (whole screen), last 2 beats ${first.last}; true tip pressure ${first.truth} mmHg. Artifact: ${fault}.`;
      return {
        W, H, duration,
        async frame(g, t) {
          const r = draw(t0 + t, { g: cg, w: W, h });
          g.fillStyle = '#05090A'; g.fillRect(0, 0, W, H);
          header(g, W, `${label} · ${patient}`, [rhythm, faults.length ? fault : ''].filter(Boolean).join(' · ') || 'no artifact');
          g.drawImage(c, 0, top);
          g.font = '600 17px system-ui, sans-serif'; g.textAlign = 'left';
          const items = [['Monitor reads', r.monitor, '#E8D35F'], ...(r.ed ? [[r.ed.how === 'mean of the a wave' ? 'At the a wave (end-diastole)' : 'End-diastole (AF)', r.ed.value.toFixed(0), '#E8D35F']] : []),
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
  seg('pac-atr', Object.entries(ATRIAL), () => st.atr, (v) => { st.atr = v; buildBeat(); });
  seg('pac-lbl', [['1', 'Label waves'], ['0', 'No labels']], () => (st.labels ? '1' : '0'), (v) => { st.labels = v === '1'; });
  seg('pac-la', [['1', 'Show true LA at wedge'], ['0', 'Hide']], () => (st.showLA ? '1' : '0'), (v) => { st.showLA = v === '1'; });
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
  addExport($('#pac-scr').parentElement, pacSpec);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => draw(st.tFrozen), 150); });
  if (st.playing) requestAnimationFrame(loop); else draw(0);
}

// exported for tests
export const _pac = { st, buildBeat, signal, stats, waveTimes, get beat() { return beat; }, get breath() { return BREATH; }, get tb() { return TB; }, MMHG_PER_10CM, FS };
