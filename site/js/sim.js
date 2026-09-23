// Simulator page controller: drag handles on the PV loop, intervention buttons,
// animated transitions, a beat cursor, and a step-by-step replay of each change.
import { simulate, NORMAL, WU, DYN, cardiacPhases } from './engine.js';
import { PRESETS, INTERVENTIONS, presetById } from './presets.js';
import { addExport, svgCapture, header, even } from './export.js';
import { drawPlot, niceMax, swatch, svgPoint, svgEl } from './plot.js';
import { REF_INDEX } from './refs.js';

const C = { cur: 'var(--series-current)', ref: 'var(--series-ref)', snap: 'var(--series-snap)' };

// ---------- slider definitions (display units ↔ model units) ----------
const S = (o) => ({ step: 0.01, digits: 2, to: (v) => v, from: (p) => p[o.key], ...o });
const SLIDERS = [
  S({ group: 'global', key: 'hr', label: 'Heart rate', unit: '/min', min: 40, max: 160, step: 1, digits: 0, range: [60, 100] }),
  S({ group: 'global', key: 'vStressed', label: 'Stressed blood volume (preload)', unit: 'mL', min: 450, max: 1400, step: 10, digits: 0,
    hint: 'Volume that actually distends the vessels; changes filling pressures and EDV.' }),

  S({ group: 'lv', key: 'lvEes', label: 'LV Ees (contractility)', unit: 'mmHg/mL', min: 0.3, max: 7, step: 0.05, range: [1.2, 3.0],
    hint: 'Slope of the ESPVR. Normal controls 2.1 ± 0.9 mmHg/mL (Kawaguchi 2003).' }),
  S({ group: 'lv', key: 'lvBeta', label: 'LV diastolic stiffness β', unit: '1/mL', min: 0.012, max: 0.07, step: 0.001, digits: 3,
    hint: 'Exponent of the EDPVR. Higher = stiffer, less compliant chamber (HFpEF, hypertrophy).' }),
  S({ group: 'lv', key: 'lvV0', label: 'LV V₀ (ESPVR intercept)', unit: 'mL', min: 0, max: 100, step: 1, digits: 0, advanced: true,
    hint: 'Rightward shift of the ESPVR, as in a dilated ventricle.' }),

  S({ group: 'sys', key: 'svrTot', label: 'Systemic vascular resistance', unit: 'dyn·s·cm⁻⁵', min: 250, max: 3000, step: 10, digits: 0, range: [800, 1600],
    to: (v, p) => ({ svr: Math.max(0.05, v * DYN - p.zcAo) }), from: (p) => (p.svr + p.zcAo) / DYN,
    hint: 'Steady (resistive) afterload; the main determinant of Ea.' }),
  S({ group: 'sys', key: 'cSys', label: 'Systemic arterial compliance', unit: 'mL/mmHg', min: 0.3, max: 3, step: 0.05,
    hint: 'Pulsatile load. Lower = stiffer arteries, wider pulse pressure.' }),
  S({ group: 'sys', key: 'zcAo', label: 'Aortic characteristic impedance', unit: 'mmHg·s/mL', min: 0.01, max: 0.15, step: 0.005, digits: 3, advanced: true }),

  S({ group: 'rv', key: 'rvEes', label: 'RV Ees (contractility)', unit: 'mmHg/mL', min: 0.15, max: 3, step: 0.05, range: [0.2, 0.8],
    hint: 'Normal about 0.4 ± 0.2 mmHg/mL; rises with homeometric adaptation (Naeije 2014).' }),
  S({ group: 'rv', key: 'rvBeta', label: 'RV diastolic stiffness β', unit: '1/mL', min: 0.01, max: 0.06, step: 0.001, digits: 3 }),
  S({ group: 'rv', key: 'rvV0', label: 'RV V₀ (ESPVR intercept)', unit: 'mL', min: 0, max: 120, step: 1, digits: 0, advanced: true,
    hint: 'Rightward shift with RV dilatation.' }),

  S({ group: 'pul', key: 'pvrTot', label: 'Pulmonary vascular resistance', unit: 'WU', min: 0.5, max: 20, step: 0.1, digits: 1, range: [0, 2],
    to: (v, p) => ({ pvr: Math.max(0.005, v * WU - p.zcPa) }), from: (p) => (p.pvr + p.zcPa) / WU,
    hint: 'PH definition uses PVR > 2 WU (ESC/ERS 2022).' }),
  S({ group: 'pul', key: 'cPa', label: 'Pulmonary arterial compliance', unit: 'mL/mmHg', min: 0.3, max: 6, step: 0.05,
    hint: 'In the pulmonary circulation compliance falls as resistance rises (Lankhaar 2008).' }),
  S({ group: 'pul', key: 'zcPa', label: 'Pulmonary characteristic impedance', unit: 'mmHg·s/mL', min: 0.005, max: 0.08, step: 0.001, digits: 3, advanced: true }),
];

const GROUPS = [
  ['lv', 'Left ventricle'], ['sys', 'Systemic arteries (LV afterload)'],
  ['rv', 'Right ventricle'], ['pul', 'Pulmonary arteries (RV afterload)'], ['global', 'Heart rate and volume'],
];

// ---------- metric rows ----------
const f = (d) => (v) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const METRICS = {
  lv: [
    ['Blood pressure', 'mmHg', (r) => `${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)}`, null],
    ['Mean arterial pressure', 'mmHg', (r) => r.hemo.MAP, [65, 105], 0],
    ['Stroke volume', 'mL', (r) => r.lv.SV, [55, 100], 0],
    ['Cardiac output', 'L/min', (r) => r.hemo.CO, [4, 8], 1],
    ['EDV / ESV', 'mL', (r) => `${r.lv.EDV.toFixed(0)} / ${r.lv.ESV.toFixed(0)}`, null],
    ['Ejection fraction', '%', (r) => r.lv.EF * 100, [50, 75], 0],
    ['Left atrial pressure (≈ PAWP)', 'mmHg', (r) => r.hemo.LAP, [4, 15], 1],
    ['Ees (ESPVR slope)', 'mmHg/mL', (r) => r.lv.Ees, null, 2, true],
    ['Ea = Pes / SV', 'mmHg/mL', (r) => r.lv.Ea, null, 2, true],
    ['Ea/Ees', '', (r) => r.lv.EaEes, [0.3, 1.3], 2, true],
    ['Ea ≈ 0.9·SBP / SV (bedside)', 'mmHg/mL', (r) => r.lv.EaClin, null, 2],
    ['Stroke work', 'J', (r) => r.lv.SWJ, null, 2],
    ['Efficiency SW/PVA', '', (r) => r.lv.eff, null, 2],
    ['SVR', 'dyn·s·cm⁻⁵', (r) => r.hemo.SVR_dyn, [800, 1600], 0],
  ],
  rv: [
    ['PA pressure', 'mmHg', (r) => `${r.hemo.PASP.toFixed(0)}/${r.hemo.PADP.toFixed(0)}`, null],
    ['Mean PA pressure', 'mmHg', (r) => r.hemo.mPAP, [0, 20], 0],
    ['Right atrial pressure', 'mmHg', (r) => r.hemo.RAP, [0, 8], 1],
    ['Stroke volume', 'mL', (r) => r.rv.SV, [55, 100], 0],
    ['Cardiac output', 'L/min', (r) => r.hemo.CO, [4, 8], 1],
    ['RV EDV / ESV', 'mL', (r) => `${r.rv.EDV.toFixed(0)} / ${r.rv.ESV.toFixed(0)}`, null],
    ['RV ejection fraction', '%', (r) => r.rv.EF * 100, [45, 75], 0],
    ['Ees (ESPVR slope)', 'mmHg/mL', (r) => r.rv.Ees, null, 2, true],
    ['Ea = Pes / SV', 'mmHg/mL', (r) => r.rv.Ea, null, 2, true],
    ['Ees/Ea (true)', '', (r) => r.rv.EesEa, [0.805, 99], 2, true],
    ['SV/ESV (volume method)', '', (r) => r.rv.svEsv, [0.515, 99], 2],
    ['PVR', 'WU', (r) => r.hemo.PVR_WU, [0, 2], 1],
    ['PA compliance SV/PP', 'mL/mmHg', (r) => r.hemo.PAC, null, 1],
    ['RC time (PVR × PAC)', 's', (r) => r.hemo.RC, null, 2],
    ['PAPi (PA pulse pressure / RAP)', '', (r) => r.hemo.PAPi, [0.9, 99], 1],
  ],
};


// ---------- state ----------
let params = { ...NORMAL };
let side = 'lv';          // ventricle used by single-ventricle panels
let view = 'lv';          // 'lv' | 'rv' | 'both'
const sidesInView = () => (view === 'both' ? ['lv', 'rv'] : [side]);
let snapshot = null;     // pinned comparison
let result = null;       // current steady state
let prev = null;         // state before the last change (for chips and replay)
let warm = null;
let busy = false;        // an animation owns the plot
let dragAxes = null;     // frozen axis limits while dragging
let showHidden = false;
let map = null;          // current PV plot mapping (primary side)
const maps = {};         // PV mapping per side on screen
const REF = simulate({});
const HIDDEN = {
  lv: [['hfpef', 'HFpEF'], ['vasoplegia', 'Vasoplegia']],
  rv: [['pahComp', 'Compensated PAH']],
};
const hiddenRes = {};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const frame = () => new Promise((r) => requestAnimationFrame(r));
function fmt(sl, v) { return Number(v).toFixed(sl.digits); }
const ratioOf = (r, s = side) => (s === 'lv' ? r.lv.EaEes : r.rv.EesEa);
const ratioName = (s = side) => (s === 'lv' ? 'Ea/Ees' : 'Ees/Ea');
const V0of = (p, s = side) => (s === 'lv' ? p.lvV0 : p.rvV0);

// ---------- simulation ----------
function sim() {
  const t0 = performance.now();
  result = simulate(params, warm ? { state: warm } : {});
  warm = result.state;
  $('#status').textContent = result.converged
    ? `Steady state reached (${result.beats + 1} beat${result.beats ? 's' : ''}) · ${(performance.now() - t0).toFixed(0)} ms`
    : 'No steady state within 200 beats; values approximate.';
  buildPhases(result);
}

function markChange() { prev = result; }

function commit() {
  sim();
  render();
  writeHash();
}

let pending = false;
function schedule() {
  syncSliders();
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; commit(); });
}

async function animateTo(target) {
  if (busy) return;
  busy = true;
  markChange();
  const from = { ...params };
  const steps = reduceMotion ? 1 : Math.round(8 / Math.sqrt(play.speed));   // 8 frames at 1×, 16 at ¼×, 25 at ⅒×
  for (let i = 1; i <= steps; i++) {
    const u = ease(i / steps);
    for (const k of Object.keys(target)) params[k] = lerp(from[k], target[k], u);
    sim(); render(true);
    await frame();
  }
  params = { ...params, ...target };
  busy = false;
  $('#preset').value = '';
  commit();
  syncSliders();
}

// ---------- cardiac phases for the moving cursor ----------
let phases = null, events = null;
function buildPhases(r) {
  const cp = cardiacPhases(r);
  phases = { lv: cp.lv.ph, rv: cp.rv.ph };
  events = { lv: cp.lv.events, rv: cp.rv.events };
}
const PHASE_LABEL = { fill: 'Filling', ivc: 'Isovolumic contraction', eject: 'Ejection', ivr: 'Isovolumic relaxation' };

// Playback: the beat cursor runs in model time scaled by `speed`; it can be paused and stepped.
const play = { on: !reduceMotion, speed: 0.25, t: 0, last: null, dwell: true };
const EVENT_LABELS = { lv: ['MVC', 'AVO', 'AVC', 'MVO'], rv: ['TVC', 'PVO', 'PVC', 'TVO'] };
const EVENT_NAMES = { MVC: 'mitral valve closes', AVO: 'aortic valve opens', AVC: 'aortic valve closes', MVO: 'mitral valve opens', TVC: 'tricuspid valve closes', PVO: 'pulmonic valve opens', PVC: 'pulmonic valve closes', TVO: 'tricuspid valve opens' };
let nextStepResolve = null;           // set while the replay waits for "Next step"

function beatIndex() {
  const n = result.rec.t.length;
  return Math.min(n - 1, Math.floor((play.t / result.T) * n));
}

function drawCursor() {
  if (!result) return;
  const i = beatIndex();
  for (const sd of ['lv', 'rv']) {
    const c = document.getElementById('cursor-' + sd);
    const m = maps[sd];
    if (!c || !m || busy) continue;
    const V = sd === 'lv' ? result.rec.Vlv[i] : result.rec.Vrv[i];
    const P = sd === 'lv' ? result.rec.Plv[i] : result.rec.Prv[i];
    c.setAttribute('cx', m.sx(V)); c.setAttribute('cy', m.sy(P));
  }
  for (const pm of ptMaps) { const x = pm.map.sx(result.rec.t[i] * 1000); pm.line.setAttribute('x1', x); pm.line.setAttribute('x2', x); }
  const strip = $('#phase');
  if (strip) {
    const key = sidesInView().map((sd) => phases[sd][i]).join() + view;
    if (strip.dataset.phase !== key) {
      strip.dataset.phase = key;
      strip.innerHTML = sidesInView().map((sd) => {
        const ph = phases[sd][i];
        const [inV, outV] = sd === 'lv' ? ['Mitral', 'Aortic'] : ['Tricuspid', 'Pulmonic'];
        const iso = ph === 'ivc' || ph === 'ivr';
        return `<span class="ph-name${iso ? ' iso' : ''}">${view === 'both' ? sd.toUpperCase() + ': ' : ''}${PHASE_LABEL[ph]}</span>
          <span class="valve ${ph === 'fill' ? 'open' : ''}">${inV} ${ph === 'fill' ? 'open' : 'closed'}</span>
          <span class="valve ${ph === 'eject' ? 'open' : ''}">${outV} ${ph === 'eject' ? 'open' : 'closed'}</span>`;
      }).join('<span class="ph-sep"></span>');
    }
  }
  const ro = $('#pb-read');
  if (ro) {
    const t = `t ${(result.rec.t[i] * 1000).toFixed(0)} ms`;
    ro.textContent = view === 'both'
      ? `${t} · LV ${result.rec.Plv[i].toFixed(0)} / RV ${result.rec.Prv[i].toFixed(0)} mmHg`
      : `${t} · V ${(side === 'lv' ? result.rec.Vlv[i] : result.rec.Vrv[i]).toFixed(0)} mL · P ${(side === 'lv' ? result.rec.Plv[i] : result.rec.Prv[i]).toFixed(0)} mmHg`;
  }
}

function tick(now) {
  if (result) {
    if (play.on && play.last != null) {
      const i = beatIndex();
      const iso = play.dwell && sidesInView().some((sd) => phases[sd][i] === 'ivc' || phases[sd][i] === 'ivr');
      play.t = (play.t + ((now - play.last) / 1000) * play.speed * (iso ? 0.2 : 1)) % result.T;   // isovolumic phases run 5× slower
    }
    play.last = now;
    drawCursor();
  }
  requestAnimationFrame(tick);
}

// Jump to the start of the next (dir = 1) or previous (dir = -1) phase and pause there.
function stepPhase(dir) {
  const ph = phases[side], n = ph.length;
  let i = beatIndex();
  const cur = ph[i];
  if (dir > 0) {
    let k = 0;
    while (k < n && ph[(i + k) % n] === cur) k++;
    i = (i + k) % n;
  } else {
    let k = 1;
    while (k < n && ph[(i - k + n) % n] === cur) k++;          // back to the start of the current phase
    const prevPh = ph[(i - k + n) % n];
    while (k < n && ph[(i - k - 1 + n) % n] === prevPh) k++;   // then to the start of the one before
    i = (i - k + n) % n;
  }
  play.t = ((i + 0.5) / n) * result.T;   // mid-sample, so rounding cannot fall back into the previous phase
  setPlaying(false);
  drawCursor();
}

function setPlaying(on) {
  play.on = on;
  const b = $('#pb-play');
  if (b) { b.textContent = on ? '❚❚ Pause' : '▶ Play'; b.setAttribute('aria-pressed', String(!on)); }
}

function buildPlayback() {
  $('#pb').innerHTML = `
    <button type="button" class="pb-btn" id="pb-prev" title="Previous phase">⏮ Phase</button>
    <button type="button" class="pb-btn" id="pb-play"></button>
    <button type="button" class="pb-btn" id="pb-next" title="Next phase">Phase ⏭</button>
    <span class="pb-speed" role="group" aria-label="Speed">${[[1, '1×'], [0.5, '½×'], [0.25, '¼×'], [0.1, '⅒×']]
      .map(([v, t]) => `<button type="button" class="pb-btn" data-speed="${v}">${t}</button>`).join('')}</span>
    <button type="button" class="pb-btn" id="pb-dwell" title="Run isovolumic contraction and relaxation 5× slower">Slow isovolumic ×5</button>
    <span class="pb-read" id="pb-read"></span>`;
  const syncSpeed = () => document.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === play.speed)));
  $('#pb').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'pb-play') setPlaying(!play.on);
    else if (b.id === 'pb-next') stepPhase(1);
    else if (b.id === 'pb-prev') stepPhase(-1);
    else if (b.dataset.speed) { play.speed = +b.dataset.speed; syncSpeed(); }
    else if (b.id === 'pb-dwell') { play.dwell = !play.dwell; b.setAttribute('aria-pressed', String(play.dwell)); }
  });
  setPlaying(play.on); syncSpeed();
  $('#pb-dwell').setAttribute('aria-pressed', 'true');
  addExport($('#pb'), exportSpec);
}

// ---------- export for slides ----------
// One beat at the current speed (isovolumic phases slowed if that is on): PV loop(s) left,
// pressure strips right, phase and time in the header.
function exportSpec() {
  const sides = sidesInView(), both = view === 'both';
  const isNormal = Object.keys(NORMAL).every((k) => params[k] === NORMAL[k]);
  const pid = $('#preset').value || (isNormal ? 'normal' : '');
  const patient = pid ? presetById(pid).label : 'Custom settings';
  const name = { lv: 'Left ventricular', rv: 'Right ventricular' };
  const ev = sides.map((sd) => EVENT_LABELS[sd].join(', ')).join('; ');
  const speed = { 1: 'real time', 0.5: '½ speed', 0.25: '¼ speed', 0.1: '⅒ speed' }[play.speed] || `${play.speed}× speed`;
  const r = result, h = r.hemo, f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f0 = (v) => v.toFixed(0);
  const notes = [`Patient: ${patient}. HR ${f0(r.params.hr)}/min, CO ${f1(h.CO)} L/min.`,
    sides.includes('lv') ? `LV: EDV ${f0(r.lv.EDV)} mL, ESV ${f0(r.lv.ESV)} mL, EF ${f0(r.lv.EF * 100)}%, Ees ${f2(r.lv.Ees)} and Ea ${f2(r.lv.Ea)} mmHg/mL, Ea/Ees ${f2(r.lv.EaEes)}. BP ${f0(h.SBP)}/${f0(h.DBP)} (MAP ${f0(h.MAP)}) mmHg, LAP ${f0(h.LAP)} mmHg.` : '',
    sides.includes('rv') ? `RV: EDV ${f0(r.rv.EDV)} mL, ESV ${f0(r.rv.ESV)} mL, EF ${f0(r.rv.EF * 100)}%, Ees ${f2(r.rv.Ees)} and Ea ${f2(r.rv.Ea)} mmHg/mL, Ees/Ea ${f2(r.rv.EesEa)}. PA ${f0(h.PASP)}/${f0(h.PADP)} (mean ${f0(h.mPAP)}) mmHg, RAP ${f0(h.RAP)} mmHg, PVR ${f1(h.PVR_WU)} WU.` : '',
    'Valve events: MVC/TVC inflow valve closes, AVO/PVO outflow valve opens, AVC/PVC outflow valve closes, MVO/TVO inflow valve opens.'].filter(Boolean).join('\n');
  return {
    file: `va-coupling-${view}-${pid || 'custom'}`,
    title: `${both ? 'LV and RV' : name[side]} pressure–volume loop${both ? 's' : ''} · ${patient}`,
    caption: `One beat at ${speed}${play.dwell ? ', isovolumic phases a further 5× slower' : ''}. Dots: valve events (${ev}). Shaded: isovolumic contraction and relaxation. Grey: normal ventricle.`,
    notes,
    async prepare() {
      if (busy) throw new Error('wait for the animation to finish, then export again.');
      const saved = { on: play.on, t: play.t };
      setPlaying(false);
      const pvs = (both ? ['#pv', '#pv2'] : ['#pv']).map((q) => svgCapture($(q)));
      const strips = [['#pt', both ? 'LV · aorta · LA' : side === 'lv' ? 'LV · aorta · LA' : 'RV · pulmonary artery · RA'],
        ['#pt2', 'RV · pulmonary artery · RA'], ['#pt-atr', $('#atr-title').textContent]]
        .filter(([q]) => $(q).getClientRects().length).map(([q, label]) => ({ cap: svgCapture($(q)), label }));
      const card = getComputedStyle($('.pv-card')), cv = (n) => card.getPropertyValue(n).trim();
      const W = 1280, top = 56, lw = 520, rx = 560, rw = W - rx - 20;
      const leftH = pvs.reduce((a, c) => a + lw * c.aspect + 8, 0);
      const rightH = strips.reduce((a, c) => a + 20 + rw * c.cap.aspect + 6, 0) + 30;
      const H = even(top + Math.max(leftH, rightH) + 12);
      // real playback time of each model sample, including the isovolumic slow-down
      const n = r.rec.t.length, cum = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) {
        const iso = play.dwell && sides.some((sd) => phases[sd][i] === 'ivc' || phases[sd][i] === 'ivr');
        cum[i + 1] = cum[i] + (r.T / n) / play.speed * (iso ? 5 : 1);
      }
      const colors = { text: cv('--mon-text') || '#E6EFEC', muted: cv('--mon-muted') || '#A7B8B2' };
      return {
        W, H, duration: cum[n],
        async frame(g, t) {
          let lo = 0, hi = n - 1;
          while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= t) lo = m; else hi = m - 1; }
          play.t = ((lo + 0.5) / n) * r.T;
          drawCursor();
          g.fillStyle = card.backgroundColor; g.fillRect(0, 0, W, H);
          const ph = sides.map((sd) => `${both ? sd.toUpperCase() + ': ' : ''}${PHASE_LABEL[phases[sd][lo]]}`).join('   ');
          header(g, W, patient, `${ph}   ·   t ${(r.rec.t[lo] * 1000).toFixed(0)} ms`, colors);
          let y = top;
          for (const c of pvs) { const img = await c.image(lw); g.drawImage(img, 20, y, lw, lw * c.aspect); y += lw * c.aspect + 8; }
          y = top;
          for (const s2 of strips) {
            g.fillStyle = colors.muted; g.font = '14px system-ui, sans-serif'; g.fillText(s2.label, rx + 56, y + 14);
            const img = await s2.cap.image(rw); g.drawImage(img, rx, y + 20, rw, rw * s2.cap.aspect); y += 20 + rw * s2.cap.aspect + 6;
          }
          // legend
          const items = [['Ventricle', [], 2.4, cv('--series-current')], [both ? 'Aorta / PA' : side === 'lv' ? 'Aorta' : 'PA', [6, 4], 2, cv('--series-current')],
            [both ? 'LA / RA' : side === 'lv' ? 'LA' : 'RA', [2, 3], 2, cv('--series-current')], ['Normal ventricle', [], 1.4, cv('--series-ref')]];
          let x = rx + 56; y += 14;
          g.font = '13px system-ui, sans-serif';
          for (const [lab, dash, lwid, col] of items) {
            g.strokeStyle = col; g.lineWidth = lwid; g.setLineDash(dash); g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 24, y - 4); g.stroke(); g.setLineDash([]);
            g.fillStyle = colors.muted; g.fillText(lab, x + 30, y); x += 42 + g.measureText(lab).width;
          }
        },
        done() { play.t = saved.t; setPlaying(saved.on); drawCursor(); },
      };
    },
  };
}

// ---------- PV plot ----------
function loopPts(r, s = side) {
  const V = s === 'lv' ? r.rec.Vlv : r.rec.Vrv, P = s === 'lv' ? r.rec.Plv : r.rec.Prv;
  const pts = [];
  for (let i = 0; i < V.length; i += 4) pts.push([V[i], P[i]]);
  pts.push(pts[0]);
  return pts;
}

function rel(r, xmax, s = side) {
  const m = r[s], p = r.params;
  const V0 = V0of(p, s), A = s === 'lv' ? p.lvA : p.rvA, b = s === 'lv' ? p.lvBeta : p.rvBeta;
  const edpvr = [];
  for (let v = V0; v <= xmax; v += (xmax - V0) / 60) edpvr.push([v, A * (Math.exp(b * (v - V0)) - 1)]);
  return { V0, Ees: m.Ees, espvr: [[V0, 0], [xmax, m.Ees * (xmax - V0)]], ea: [[m.ESV, m.Pes], [m.EDV, 0]], edpvr, es: [m.ESV, m.Pes] };
}

function relSeries(R, color, strong) {
  return [
    { points: R.edpvr, color, width: 1.1, dash: '2 3' },
    { points: R.espvr, color, width: strong ? 1.8 : 1.2 },
    { points: R.ea, color, width: strong ? 1.8 : 1.2, dash: '6 4' },
  ];
}

function axes(sd = side) {
  if (dragAxes) return dragAxes;
  const all = [REF, result, snapshot, prev, ...(showHidden ? HIDDEN[sd].map(([id]) => hiddenRes[id]) : [])].filter(Boolean);
  const vmax = Math.max(...all.map((r) => r[sd].EDV));
  const pmax = Math.max(...all.map((r) => Math.max(...(sd === 'lv' ? r.rec.Plv : r.rec.Prv))));
  return { xmax: niceMax(vmax * 1.18), ymax: niceMax(pmax * 1.15) };
}

function plotWidth(sel) {
  const w = $(sel).parentElement.clientWidth - 24;
  return Math.max(280, Math.min(760, w || 640));
}

function drawPV(extraSeries = [], opts = {}) {
  maps.lv = maps.rv = null;
  if (view === 'both') { drawPVFor('lv', '#pv', extraSeries, opts); drawPVFor('rv', '#pv2', [], {}); map = maps.lv; }
  else map = drawPVFor(side, '#pv', extraSeries, opts);
}

function drawPVFor(sd, sel, extraSeries = [], opts = {}) {
  const { xmax, ymax } = axes(sd);
  const w = plotWidth(sel);
  const series = [
    { points: loopPts(REF, sd), color: C.ref, width: 1.6 },
    ...relSeries(rel(REF, xmax, sd), C.ref, false),
  ];
  if (showHidden) for (const [id] of HIDDEN[sd]) series.push({ points: loopPts(hiddenRes[id], sd), color: 'var(--flag)', width: 1.4, dash: '4 3' });
  if (snapshot) series.push({ points: loopPts(snapshot, sd), color: C.snap, width: 1.8 }, ...relSeries(rel(snapshot, xmax, sd), C.snap, false));
  series.push(...extraSeries);
  if (!opts.noCurrent) {
    const R = rel(result, xmax, sd);
    series.push(...relSeries(R, C.cur, true), { points: loopPts(result, sd), color: C.cur, width: 3 });
  }
  const name = sd === 'lv' ? 'Left' : 'Right';
  const m = drawPlot($(sel), {
    width: w, height: Math.round(w * (innerWidth < 700 || view === 'both' ? 0.74 : 0.66)),
    title: `${name} ventricular pressure–volume loop`,
    x: { min: 0, max: xmax, label: `${sd.toUpperCase()} volume (mL)` },
    y: { min: 0, max: ymax, label: `${sd.toUpperCase()} pressure (mmHg)` },
    series,
    annotations: showHidden ? HIDDEN[sd].map(([id, nm]) => ({ x: hiddenRes[id][sd].EDV, y: hiddenRes[id][sd].EDP, text: nm, dx: 6, dy: 14, color: 'var(--flag)' })) : [],
  });
  maps[sd] = m;
  if (!opts.noCurrent) {
    addEventMarks(m, sd);
    if (view !== 'both') addHandles(m, xmax, ymax);
    svgEl('circle', { id: 'cursor-' + sd, r: 6, class: 'beat-cursor', cx: -20, cy: -20 }, m.svg);
  }
  return m;
}

// Valve events at the loop corners: inflow closes, outflow opens, outflow closes, inflow opens.
function addEventMarks(m, sd) {
  const ev = events[sd], V = sd === 'lv' ? result.rec.Vlv : result.rec.Vrv, P = sd === 'lv' ? result.rec.Plv : result.rec.Prv;
  const idx = [ev.inClose, ev.outOpen, ev.outClose, ev.inOpen];
  const off = [[8, 16], [8, -8], [-8, -8], [-8, 16]];   // label offsets: MVC lower right, AVO upper right, AVC upper left, MVO lower left
  idx.forEach((i, k) => {
    if (i >= V.length) return;
    const x = m.sx(V[i]), y = m.sy(P[i]), lab = EVENT_LABELS[sd][k];
    const g = svgEl('g', { class: 'ev-mark' }, m.svg);
    svgEl('circle', { cx: x, cy: y, r: 4.5 }, g);
    const t = svgEl('text', { x: x + off[k][0], y: y + off[k][1], 'text-anchor': off[k][0] > 0 ? 'start' : 'end' }, g);
    t.textContent = lab;
    const tt = svgEl('title', {}, g); tt.textContent = `${lab}: ${EVENT_NAMES[lab]}`;
  });
}

// Drag handles: ESPVR (Ees), Ea line (afterload), end-diastolic volume (preload).
function addHandles(pm, xmax, ymax) {
  const m = result[side], V0 = V0of(params);
  const Ph = Math.min(m.Ees * (xmax - V0), ymax * 0.9);
  const hs = [
    { id: 'ees', x: V0 + Ph / m.Ees, y: Ph, label: `Drag to change ${side.toUpperCase()} Ees (contractility)` },
    { id: 'ea', x: (m.ESV + m.EDV) / 2, y: m.Pes / 2, label: `Drag to change ${side === 'lv' ? 'SVR' : 'PVR'} (afterload)` },
    { id: 'edv', x: m.EDV, y: 0, label: 'Drag to change stressed volume (preload)' },
  ];
  for (const h of hs) {
    const g = svgEl('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-label': h.label, 'data-h': h.id }, pm.svg);
    svgEl('circle', { cx: pm.sx(h.x), cy: pm.sy(h.y), r: 16, class: 'hit' }, g);
    svgEl('circle', { cx: pm.sx(h.x), cy: pm.sy(h.y), r: 7.5, class: 'knob' }, g);
    const t = svgEl('title', {}, g); t.textContent = h.label;
  }
}

function applyHandle(id, V, P) {
  const m = result[side], V0 = V0of(params);
  if (id === 'ees' && V > V0 + 3 && P > 0) {
    const k = side === 'lv' ? 'lvEes' : 'rvEes';
    const sl = SLIDERS.find((s) => s.key === k);
    params[k] = clamp(P / (V - V0), sl.min, sl.max);
  } else if (id === 'ea' && V < m.EDV - 3 && P > 0) {
    const f = clamp((P / (m.EDV - V)) / m.Ea, 0.8, 1.25);   // limited step per move keeps the solver stable
    if (side === 'lv') params.svr = clamp(params.svr * f, 250 * DYN, 3000 * DYN);
    else params.pvr = clamp(params.pvr * f, 0.3 * WU, 20 * WU);
  } else if (id === 'edv') {
    params.vStressed = clamp(params.vStressed + (V - m.EDV) * 1.5, 450, 1400);
  }
  $('#preset').value = '';
  schedule();
}

function setupDrag() {
  const svg = $('#pv');
  let active = null;
  svg.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.handle');
    if (!h || busy) return;
    active = h.dataset.h;
    markChange();
    dragAxes = axes();
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!active || !map) return;
    const pt = svgPoint(svg, e);
    applyHandle(active, map.ix(pt.x), map.iy(pt.y));
  });
  const end = () => { if (!active) return; active = null; dragAxes = null; svg.classList.remove('dragging'); render(); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('keydown', (e) => {
    const h = e.target.closest?.('.handle');
    if (!h || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1.05 : 1 / 1.05;
    markChange();
    const t = {};
    if (h.dataset.h === 'ees') { const k = side === 'lv' ? 'lvEes' : 'rvEes'; t[k] = params[k] * up; }
    if (h.dataset.h === 'ea') { const k = side === 'lv' ? 'svr' : 'pvr'; t[k] = params[k] * up; }
    if (h.dataset.h === 'edv') t.vStressed = clamp(params.vStressed + (up > 1 ? 20 : -20), 450, 1400);
    Object.assign(params, t);
    commit(); syncSliders();
    document.querySelector(`.handle[data-h="${h.dataset.h}"]`)?.focus();
  });
}

// ---------- "why did it move?" replay ----------
async function replay() {
  if (!prev || busy) return;
  busy = true;
  const { xmax } = axes();
  const A = rel(prev, xmax), B = rel(result, xmax);
  const a = prev[side], b = result[side];
  const lbl = $('#why-label');
  const f2 = (x) => x.toFixed(2), f0 = (x) => x.toFixed(0);
  const steps = [
    { text: Math.abs(b.Ees / a.Ees - 1) > 0.02 ? `ESPVR ${b.Ees > a.Ees ? 'steeper' : 'flatter'}: Ees ${f2(a.Ees)} → ${f2(b.Ees)} mmHg/mL` : `ESPVR unchanged: Ees ${f2(b.Ees)}`, k: 'espvr' },
    { text: `Ea line: slope ${f2(a.Ea)} → ${f2(b.Ea)} mmHg/mL; EDV ${f0(a.EDV)} → ${f0(b.EDV)} mL`, k: 'ea' },
    { text: `End-systole where they cross: ESV ${f0(a.ESV)} → ${f0(b.ESV)} mL, Pes ${f0(a.Pes)} → ${f0(b.Pes)} mmHg`, k: 'es' },
    { text: `New loop: SV ${f0(a.SV)} → ${f0(b.SV)} mL, ${ratioName()} ${f2(ratioOf(prev))} → ${f2(ratioOf(result))}`, k: 'loop' },
  ];
  const n = reduceMotion ? 1 : Math.round(24 / play.speed ** 0.6);
  let espvr = A.espvr, ea = A.ea, es = A.es;
  for (const [si, st] of steps.entries()) {
    lbl.innerHTML = `<b>${si + 1}/4</b> ${st.text}`;
    for (let i = 1; i <= n; i++) {
      const u = ease(i / n);
      const L = (p, q) => p.map((pt, j) => [lerp(pt[0], q[j][0], u), lerp(pt[1], q[j][1], u)]);
      const cur = {
        espvr: st.k === 'espvr' ? L(A.espvr, B.espvr) : espvr,
        ea: st.k === 'ea' ? L(A.ea, B.ea) : ea,
        es: st.k === 'es' ? [lerp(A.es[0], B.es[0], u), lerp(A.es[1], B.es[1], u)] : es,
      };
      drawPV([
        { points: loopPts(prev), color: C.cur, width: 1.4, dash: '3 3', opacity: 0.6 },
        { points: cur.espvr, color: C.cur, width: 2.2 },
        { points: cur.ea, color: C.cur, width: 2.2, dash: '6 4' },
        ...(st.k === 'loop' ? [{ points: loopPts(result).slice(0, Math.max(2, Math.round(loopPts(result).length * u))), color: C.cur, width: 3 }] : []),
        { points: [cur.es], color: 'var(--flag)', marker: 6 },
      ], { noCurrent: true });
      await frame();
      if (reduceMotion) break;
    }
    espvr = st.k === 'espvr' ? B.espvr : espvr; ea = st.k === 'ea' ? B.ea : ea; es = st.k === 'es' ? B.es : es;
    if (si < steps.length - 1) {
      const btn = $('#why');
      btn.disabled = false; btn.textContent = `Next step (${si + 2}/4) ▶`;
      await new Promise((r) => { nextStepResolve = r; });
      btn.disabled = true;
    }
  }
  busy = false;
  $('#why').textContent = 'Replay: why did it move?';
  render();
  lbl.innerHTML = steps.map((s, i) => `<b>${i + 1}</b> ${s.text}`).join('<br>');
}

// ---------- panels ----------
const TILES = {
  lv: [
    [() => ratioName('lv'), (r) => r.lv.EaEes.toFixed(2), (r) => r.lv.EaEes < 0.3 || r.lv.EaEes > 1.3],
    [() => 'Stroke volume', (r) => `${r.lv.SV.toFixed(0)} mL`, (r) => r.lv.SV < 55],
    [() => 'BP (MAP)', (r) => `${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)} (${r.hemo.MAP.toFixed(0)})`, (r) => r.hemo.MAP < 65 || r.hemo.MAP > 105],
    [() => 'LAP', (r) => `${r.hemo.LAP.toFixed(0)} mmHg`, (r) => r.hemo.LAP > 15],
    [() => 'Cardiac output', (r) => `${r.hemo.CO.toFixed(1)} L/min`, (r) => r.hemo.CO < 4],
  ],
  both: [
    [() => 'LV Ea/Ees', (r) => r.lv.EaEes.toFixed(2), (r) => r.lv.EaEes < 0.3 || r.lv.EaEes > 1.3],
    [() => 'RV Ees/Ea', (r) => r.rv.EesEa.toFixed(2), (r) => r.rv.EesEa < 0.805],
    [() => 'MAP / mPAP', (r) => `${r.hemo.MAP.toFixed(0)} / ${r.hemo.mPAP.toFixed(0)}`, (r) => r.hemo.MAP < 65 || r.hemo.mPAP > 20],
    [() => 'LAP / RAP', (r) => `${r.hemo.LAP.toFixed(0)} / ${r.hemo.RAP.toFixed(0)}`, (r) => r.hemo.LAP > 15 || r.hemo.RAP > 8],
    [() => 'Cardiac output', (r) => `${r.hemo.CO.toFixed(1)} L/min`, (r) => r.hemo.CO < 4],
  ],
  rv: [
    [() => ratioName('rv'), (r) => r.rv.EesEa.toFixed(2), (r) => r.rv.EesEa < 0.805],
    [() => 'Stroke volume', (r) => `${r.rv.SV.toFixed(0)} mL`, (r) => r.rv.SV < 55],
    [() => 'PA (mean)', (r) => `${r.hemo.PASP.toFixed(0)}/${r.hemo.PADP.toFixed(0)} (${r.hemo.mPAP.toFixed(0)})`, (r) => r.hemo.mPAP > 20],
    [() => 'RAP', (r) => `${r.hemo.RAP.toFixed(0)} mmHg`, (r) => r.hemo.RAP > 8],
    [() => 'Cardiac output', (r) => `${r.hemo.CO.toFixed(1)} L/min`, (r) => r.hemo.CO < 4],
  ],
};

function renderTiles() {
  $('#tiles').innerHTML = TILES[view].map(([name, val, bad]) =>
    `<div class="tile${bad(result) ? ' off' : ''}"><div class="tile-v">${val(result)}</div><div class="tile-k">${name()}<span> · normal ${val(REF)}</span></div></div>`).join('');
}

function renderChips() {
  const box = $('#chips');
  if (!prev) { box.innerHTML = '<span class="status">Drag a handle on the loop or press a button.</span>'; $('#chips-m').innerHTML = ''; $('#why').disabled = true; return; }
  const s = side, a = prev, b = result;
  const items = [
    ...(view === 'both' ? [['RV Ees/Ea', a.rv.EesEa, b.rv.EesEa, 2, ''], ['mPAP', a.hemo.mPAP, b.hemo.mPAP, 0, ' mmHg']] : []),
    [(view === 'both' ? 'LV ' : '') + ratioName(), ratioOf(a), ratioOf(b), 2, ''],
    ['SV', a[s].SV, b[s].SV, 0, ' mL'],
    ['ESV', a[s].ESV, b[s].ESV, 0, ' mL'],
    ['EDV', a[s].EDV, b[s].EDV, 0, ' mL'],
    [s === 'lv' ? 'MAP' : 'mPAP', s === 'lv' ? a.hemo.MAP : a.hemo.mPAP, s === 'lv' ? b.hemo.MAP : b.hemo.mPAP, 0, ' mmHg'],
    [s === 'lv' ? 'LAP' : 'RAP', s === 'lv' ? a.hemo.LAP : a.hemo.RAP, s === 'lv' ? b.hemo.LAP : b.hemo.RAP, 0, ' mmHg'],
    ['CO', a.hemo.CO, b.hemo.CO, 1, ' L/min'],
  ].filter(([, x, y]) => Math.abs(y - x) / Math.max(Math.abs(x), 1e-6) > 0.02).slice(0, 5);
  $('#chips-m').innerHTML = items.slice(0, 3).map(([k, x, y, d, u]) => `<span class="chip ${y > x ? 'up' : 'down'}">${k} <b>${y.toFixed(d)}</b>${u}</span>`).join('');
  box.innerHTML = items.length
    ? items.map(([k, x, y, d, u]) => `<span class="chip ${y > x ? 'up' : 'down'}">${k} ${x.toFixed(d)} → <b>${y.toFixed(d)}</b>${u}</span>`).join('')
    : '<span class="status">No measurable change.</span>';
  $('#why').disabled = busy;
}

function renderGauge() {
  const lv = side === 'lv';
  const val = ratioOf(result), refVal = ratioOf(REF);
  const W = plotWidth('#gauge'), H = 74, l = 20, rr = 20, pw = W - l - rr, max = 3;
  const x = (v) => l + clamp(v, 0, max) / max * pw;
  const band = lv ? [0.3, 1.3] : [1.5, 2.0];
  let s = `<rect x="${x(band[0])}" y="20" width="${x(band[1]) - x(band[0])}" height="14" rx="3" class="g-band"/>
    <line x1="${l}" x2="${W - rr}" y1="34" y2="34" style="stroke:var(--axis)"/>`;
  for (let t = 0; t <= max; t += 0.5) s += `<line x1="${x(t)}" x2="${x(t)}" y1="34" y2="39" style="stroke:var(--axis)"/><text x="${x(t)}" y="52" text-anchor="middle" font-size="12" style="fill:var(--axis)">${t}</text>`;
  if (!lv) s += `<line x1="${x(0.805)}" x2="${x(0.805)}" y1="12" y2="38" style="stroke:var(--flag);stroke-dasharray:3 2"/><text x="${x(0.805) - 4}" y="11" text-anchor="end" font-size="11" style="fill:var(--flag)">0.805</text>`;
  s += `<text x="${x(band[0])}" y="68" text-anchor="start" font-size="11" style="fill:var(--text-muted)">${lv ? 'SW and efficiency ≥ 90% of optimum (canine, De Tombe 1993)' : 'Normal 1.5–2 (Tello 2019)'}</text>`;
  const mark = (v, color, lab) => `<path d="M${x(v)},34 l-6,-11 h12 z" style="fill:${color}"/>${lab ? `<text x="${x(v)}" y="17" text-anchor="middle" font-size="10" style="fill:${color}">${lab}</text>` : ''}`;
  s += mark(refVal, C.ref);
  if (showHidden) HIDDEN[side].forEach(([id], i) => { s += mark(ratioOf(hiddenRes[id]), 'var(--flag)', String.fromCharCode(65 + i)); });
  if (snapshot) s += mark(ratioOf(snapshot), C.snap);
  s += mark(val, C.cur);
  const svg = $('#gauge');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  $('#gauge-title').textContent = `${side.toUpperCase()} ${ratioName()} ${val.toFixed(2)}`;
  const hid = $('#hidden-list');
  hid.hidden = !showHidden;
  if (showHidden) {
    hid.innerHTML = HIDDEN[side].map(([id, name]) => {
      const r = hiddenRes[id];
      const extra = side === 'lv' ? `LAP ${r.hemo.LAP.toFixed(0)} · BP ${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)} · Ees ${r.lv.Ees.toFixed(1)} · Ea ${r.lv.Ea.toFixed(2)}`
        : `mPAP ${r.hemo.mPAP.toFixed(0)} · PVR ${r.hemo.PVR_WU.toFixed(1)} WU · RAP ${r.hemo.RAP.toFixed(0)}`;
      return `<span class="chip warn"><b>${String.fromCharCode(65 + HIDDEN[side].findIndex((h) => h[0] === id))} · ${name}</b> ${ratioName()} ${ratioOf(r).toFixed(2)} · ${extra}</span>`;
    }).join('');
  }
}

let ptMaps = [];
// Pressure–time strip for one side: ventricle, great artery and atrium, with valve events.
function drawStrip(sd, sel, atrialOnly = false) {
  const r = result, ms = r.rec.t.map((t) => t * 1000);
  const pick = (arr) => ms.map((t, i) => [t, arr[i]]).filter((_, i) => i % 3 === 0);
  const vent = sd === 'lv' ? r.rec.Plv : r.rec.Prv;
  const art = sd === 'lv' ? r.rec.Pao : r.rec.Ppa;
  const atr = sd === 'lv' ? r.rec.Ppv : r.rec.Psv;
  const refV = sd === 'lv' ? REF.rec.Plv : REF.rec.Prv;
  const refA = sd === 'lv' ? REF.rec.Ppv : REF.rec.Psv;
  const refMs = REF.rec.t.map((t) => t * 1000);
  const xmax = Math.max(ms[ms.length - 1], refMs[refMs.length - 1]);
  const ymax = atrialOnly ? niceMax(Math.max(...atr, ...refA) * 1.35) : niceMax(Math.max(...vent, ...art, ...refV) * 1.1);
  const w = plotWidth(sel);
  const series = atrialOnly
    ? [{ points: refMs.map((t, i) => [t, refA[i]]).filter((_, i) => i % 3 === 0), color: C.ref, width: 1.4 }, { points: pick(atr), color: C.cur, width: 2.2 }]
    : [
      { points: refMs.map((t, i) => [t, refV[i]]).filter((_, i) => i % 3 === 0), color: C.ref, width: 1.4 },
      { points: pick(atr), color: C.cur, width: 1.2, dash: '2 3' },
      { points: pick(art), color: C.cur, width: 1.6, dash: '6 4' },
      { points: pick(vent), color: C.cur, width: 2.4 },
    ];
  const pm = drawPlot($(sel), {
    width: w, height: Math.round(w * (atrialOnly ? 0.26 : 0.36)), yTicks: atrialOnly ? 3 : 4,
    title: atrialOnly ? `${sd === 'lv' ? 'Left' : 'Right'} atrial pressure` : `${sd.toUpperCase()} pressures over one beat`,
    x: { min: 0, max: xmax, label: 'Time (ms)' },
    y: { min: 0, max: ymax, label: atrialOnly ? `${sd === 'lv' ? 'LA' : 'RA'} mmHg` : `${sd.toUpperCase()} mmHg` },
    series,
  });
  // shade isovolumic intervals and mark valve events
  const ev = events[sd], idx = [ev.inClose, ev.outOpen, ev.outClose, ev.inOpen];
  const top = pm.sy(ymax), bot = pm.sy(0);
  const shade = (i0, i1) => { if (i1 > i0 && i1 < ms.length) svgEl('rect', { x: pm.sx(ms[i0]), y: top, width: Math.max(1.5, pm.sx(ms[i1]) - pm.sx(ms[i0])), height: bot - top, class: 'iso-band' }, pm.svg); };
  shade(ev.inClose, ev.outOpen); shade(ev.outClose, ev.inOpen);
  idx.forEach((i, k) => {
    if (i >= ms.length) return;
    const x = pm.sx(ms[i]);
    svgEl('line', { x1: x, x2: x, y1: top, y2: bot, class: 'ev-line' }, pm.svg);
    const t = svgEl('text', { x: x + 3, y: top + 11 + (k % 2) * 11, class: 'ev-text' }, pm.svg);
    t.textContent = EVENT_LABELS[sd][k];
  });
  if (atrialOnly) {
    // v wave: atrial peak while the inflow valve is closed; y descent: fall after the inflow valve opens
    let iv = ev.inClose, iy = ev.inOpen;
    for (let i = ev.inClose; i < Math.min(ev.inOpen, atr.length); i++) if (atr[i] > atr[iv]) iv = i;
    for (let i = ev.inOpen; i < Math.min(atr.length, ev.inOpen + Math.round(0.25 / r.dt)); i++) if (atr[i] < atr[iy]) iy = i;
    for (const [i, lab] of [[iv, 'v'], [iy, 'y']]) {
      const t = svgEl('text', { x: pm.sx(ms[i]), y: pm.sy(atr[i]) + (lab === 'v' ? -7 : 15), class: 'ev-wave', 'text-anchor': 'middle' }, pm.svg);
      t.textContent = lab;
    }
  }
  const line = svgEl('line', { x1: -5, x2: -5, y1: top, y2: bot, class: 't-cursor' }, pm.svg);
  ptMaps.push({ map: pm, line });
}

function renderPT() {
  ptMaps = [];
  const both = view === 'both';
  $('#pt2-wrap').hidden = !both;
  drawStrip(both ? 'lv' : side, '#pt');
  if (both) drawStrip('rv', '#pt2');
  drawStrip(both ? 'lv' : side, '#pt-atr', true);
  const sd = both ? 'lv' : side;
  $('#pt-legend').innerHTML = `<span>${swatch(C.cur, '', 2.4)}Ventricle</span>
    <span>${swatch(C.cur, '6 4')}${both ? 'Aorta / PA' : sd === 'lv' ? 'Aorta' : 'Pulmonary artery'}</span>
    <span>${swatch(C.cur, '2 3')}${both ? 'LA / RA' : sd === 'lv' ? 'LA (pulmonary veins + LA)' : 'RA (systemic veins + RA)'}</span>
    <span>${swatch(C.ref, '', 1.4)}Normal ventricle</span><span class="iso-key"></span>Isovolumic`;
  $('#atr-title').textContent = sd === 'lv' ? 'Left atrial pressure' : 'Right atrial pressure';
  $('#atr-note').textContent = `${sd === 'lv' ? 'LA' : 'RA'} ${ (sd === 'lv' ? result.hemo.LAP : result.hemo.RAP).toFixed(0)} mmHg mean. v wave: atrial filling while the ${sd === 'lv' ? 'mitral' : 'tricuspid'} valve is closed. y descent: emptying after it opens. The model has no atrial contraction, so there is no a wave or x descent.`;
}

function renderLegend() {
  $('#pv-legend').innerHTML = `
    <span>${swatch(C.cur, '', 3)}Current</span><span>${swatch(C.ref, '', 1.6)}Normal</span>
    ${snapshot ? `<span>${swatch(C.snap, '', 1.8)}Snapshot</span>` : ''}
    ${showHidden ? `<span>${swatch('var(--flag)', '4 3', 1.4)}In-range disease</span>` : ''}
    <span>${swatch(C.cur, '', 1.8)}ESPVR</span><span>${swatch(C.cur, '6 4', 1.8)}Ea line</span><span>${swatch(C.cur, '2 3', 1.1)}EDPVR</span>`;
}

function renderMetrics() {
  const list = view === 'both' ? [...METRICS.lv.map((m) => ['LV · ' + m[0], ...m.slice(1)]), ...METRICS.rv.map((m) => ['RV · ' + m[0], ...m.slice(1)])] : METRICS[side];
  const rows = list.map(([label, unit, fn, range, d, key]) => {
    const cur = fn(result), ref = fn(REF), snap = snapshot ? fn(snapshot) : null;
    const flag = typeof cur === 'number' && range && (cur < range[0] || cur > range[1]);
    const show = (v) => (typeof v === 'number' ? f(d ?? 1)(v) : v);
    return `<tr class="${flag ? 'flag' : ''}${key ? ' key' : ''}"><td>${label}${unit ? ` <span class="status">(${unit})</span>` : ''}</td>
      <td class="num cur">${show(cur)}${flag ? ' *' : ''}</td><td class="num">${show(ref)}</td>${snapshot ? `<td class="num">${show(snap)}</td>` : ''}</tr>`;
  }).join('');
  $('#metrics').innerHTML = `<table class="data metrics"><thead><tr><th>Measure</th><th class="num">Current</th><th class="num">Normal</th>${snapshot ? '<th class="num">Snapshot</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
    <p class="status">* outside the usual resting adult range; a teaching aid, not a cut-off.</p>`;
}

function render(light = false) {
  document.body.dataset.view = view;   // before drawing: the RV cell must be laid out to size its plot
  drawPV();
  renderTiles(); renderChips();
  if (light) return;
  renderLegend(); renderGauge(); renderPT(); renderMetrics();
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.side === view));
  $('#pv-title').textContent = view === 'both' ? 'Pressure–volume loops: LV and RV' : `${side === 'lv' ? 'Left' : 'Right'} ventricular pressure–volume loop`;
  $('#clear').disabled = !snapshot;
  $('#hidden-toggle').textContent = showHidden ? 'Hide in-range disease' : `Show disease with an in-range ${ratioName()}`;
}

// ---------- sliders (fine control) ----------
function buildControls() {
  const box = $('#controls');
  box.innerHTML = '';
  for (const [g, title] of GROUPS) {
    const d = document.createElement('fieldset');
    d.innerHTML = `<legend>${title}</legend>`;
    for (const sl of SLIDERS.filter((s) => s.group === g)) {
      const id = 'sl-' + sl.key;
      const w = document.createElement('div');
      w.className = 'slider';
      w.innerHTML = `<div class="row"><label for="${id}">${sl.label}</label><span class="val" id="${id}-v"></span></div>
        <input type="range" id="${id}" min="${sl.min}" max="${sl.max}" step="${sl.step}">
        <div class="hint">Normal ${fmt(sl, sl.from(NORMAL))} ${sl.unit}${sl.hint ? '. ' + sl.hint : ''}</div>`;
      d.appendChild(w);
      const inp = w.querySelector('input');
      inp.addEventListener('pointerdown', markChange);
      inp.addEventListener('keydown', markChange);
      inp.addEventListener('input', () => {
        const upd = sl.to(parseFloat(inp.value), params);
        if (typeof upd === 'object') Object.assign(params, upd); else params[sl.key] = upd;
        $('#preset').value = '';
        schedule();
      });
    }
    box.appendChild(d);
  }
  syncSliders();
}

function syncSliders() {
  for (const sl of SLIDERS) {
    const inp = document.getElementById('sl-' + sl.key);
    if (!inp) continue;
    const v = sl.from(params);
    inp.value = v;
    const out = document.getElementById('sl-' + sl.key + '-v');
    out.textContent = `${fmt(sl, v)} ${sl.unit}`;
    out.classList.toggle('off', !!sl.range && (v < sl.range[0] || v > sl.range[1]));
    inp.setAttribute('aria-valuetext', `${fmt(sl, v)} ${sl.unit}`);
  }
}

// ---------- presets, interventions, tabs, hash ----------
function loadPreset(id, keepSide) {
  const p = presetById(id);
  if (!p) return;
  markChange();
  params = { ...NORMAL, ...p.params };
  if (!keepSide && view !== 'both' && (p.side === 'lv' || p.side === 'rv')) { side = p.side; view = side; }
  warm = null;
  $('#preset').value = id;
  $('#preset-text').innerHTML = `<p>${p.text} <span class="status">Sources: ${p.refs.map((k) => {
    const r = REF_INDEX[k]; return `<a href="references.html#ref-${k}">${r.authors.split(',')[0].split(' ')[0]} ${r.year}</a>`;
  }).join(', ')}</span></p>`;
  commit(); syncSliders();
}

function writeHash() {
  const diff = {};
  for (const [k, v] of Object.entries(params)) if (Math.abs(v - NORMAL[k]) > 1e-9) diff[k] = +v.toPrecision(4);
  const pid = $('#preset').value;
  history.replaceState(null, '', '#' + (pid ? `preset=${pid}&side=${view}` : `side=${view}&p=${encodeURIComponent(JSON.stringify(diff))}`));
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('side')) { view = ['lv', 'rv', 'both'].includes(h.get('side')) ? h.get('side') : 'lv'; side = view === 'rv' ? 'rv' : 'lv'; }
  if (h.get('preset') && presetById(h.get('preset'))) { loadPreset(h.get('preset'), !!h.get('side')); prev = null; render(); return true; }
  if (h.get('p')) {
    try {
      const d = JSON.parse(decodeURIComponent(h.get('p')));
      for (const k of Object.keys(d)) if (k in NORMAL && Number.isFinite(d[k])) params[k] = d[k];
    } catch { /* ignore malformed links */ }
  }
  return false;
}

export function initSimulator() {
  for (const [id] of [...HIDDEN.lv, ...HIDDEN.rv]) hiddenRes[id] = simulate(presetById(id).params);
  const sel = $('#preset');
  sel.innerHTML = '<option value="">Custom</option>' +
    `<optgroup label="Left heart">${PRESETS.filter((p) => p.side !== 'rv').map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>` +
    `<optgroup label="Right heart / pulmonary">${PRESETS.filter((p) => p.side === 'rv').map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>`;
  sel.addEventListener('change', () => { if (sel.value) loadPreset(sel.value); });
  $('#give').innerHTML = INTERVENTIONS.map((x) => `<button type="button" class="give" data-x="${x.id}" title="${x.note}">${x.label}<small>${x.note}</small></button>`).join('');
  $('#give-m').innerHTML = INTERVENTIONS.map((x) => `<button type="button" class="give" data-x="${x.id}" title="${x.note}">${x.label}</button>`).join('');
  $('#give-m').addEventListener('click', (e) => {
    const b = e.target.closest('.give');
    if (!b || busy) return;
    animateTo(INTERVENTIONS.find((i) => i.id === b.dataset.x).apply(params));
  });
  $('#give').addEventListener('click', (e) => {
    const b = e.target.closest('.give');
    if (!b || busy) return;
    const x = INTERVENTIONS.find((i) => i.id === b.dataset.x);
    animateTo(x.apply(params));
  });
  $('#reset').addEventListener('click', () => loadPreset('normal', true));
  $('#pin').addEventListener('click', () => { snapshot = result; render(); });
  $('#clear').addEventListener('click', () => { snapshot = null; render(); });
  $('#why').addEventListener('click', () => { if (nextStepResolve) { const r = nextStepResolve; nextStepResolve = null; r(); } else replay(); });
  buildPlayback();
  $('#hidden-toggle').addEventListener('click', () => { showHidden = !showHidden; render(); });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.side; if (view !== 'both') side = view; render(); writeHash(); }));
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => result && render(), 150); });
  setupDrag();
  buildControls();
  if (!readHash()) commit();
  requestAnimationFrame(tick);
}
