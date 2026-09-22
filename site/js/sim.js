// Simulator page controller.
import { simulate, NORMAL, WU, DYN } from './engine.js';
import { PRESETS, presetById } from './presets.js';
import { drawPlot, niceMax, swatch } from './plot.js';
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
let side = 'lv';
let showAdvanced = false;
let snapshot = null;
let result = null;
let warm = null;
const REF = simulate({});

const $ = (s) => document.querySelector(s);

function fmt(sl, v) { return Number(v).toFixed(sl.digits); }

function buildControls() {
  const box = $('#controls');
  box.innerHTML = '';
  for (const [g, title] of GROUPS) {
    const d = document.createElement('details');
    d.dataset.group = g;
    d.open = g === 'global' || (side === 'lv' ? g === 'lv' || g === 'sys' : g === 'rv' || g === 'pul');
    d.innerHTML = `<summary>${title}</summary><div class="group-body"></div>`;
    const body = d.querySelector('.group-body');
    for (const sl of SLIDERS.filter((s) => s.group === g)) {
      if (sl.advanced && !showAdvanced) continue;
      const id = 'sl-' + sl.key;
      const w = document.createElement('div');
      w.className = 'slider';
      const refV = sl.from(NORMAL);
      w.innerHTML = `<div class="row"><label for="${id}">${sl.label}</label>
        <span class="val" id="${id}-v"></span></div>
        <input type="range" id="${id}" min="${sl.min}" max="${sl.max}" step="${sl.step}">
        <div class="hint">Normal model value ${fmt(sl, refV)} ${sl.unit}${sl.hint ? '. ' + sl.hint : ''}</div>`;
      body.appendChild(w);
      const inp = w.querySelector('input');
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        const upd = sl.to(v, params);
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

let pending = false;
function schedule() {
  syncSliders();
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; run(); });
}

function run() {
  const t0 = performance.now();
  result = simulate(params, warm ? { state: warm } : {});
  warm = result.state;
  $('#status').textContent = result.converged
    ? `Steady state after ${result.beats + 1} simulated beats (${(performance.now() - t0).toFixed(0)} ms).`
    : 'Did not reach a steady state within 200 beats; values shown are approximate.';
  render();
  writeHash();
}

// ---------- drawing ----------
// Match the viewBox to the rendered width so axis text stays legible on phones.
function plotWidth(sel) {
  const w = $(sel).parentElement.clientWidth - 24;
  return Math.max(340, Math.min(720, w || 640));
}

function loopPts(r, s) {
  const V = s === 'lv' ? r.rec.Vlv : r.rec.Vrv, P = s === 'lv' ? r.rec.Plv : r.rec.Prv;
  const pts = [];
  for (let i = 0; i < V.length; i += 4) pts.push([V[i], P[i]]);
  pts.push(pts[0]);
  return pts;
}

function relations(r, s, xmax) {
  const m = r[s], p = r.params;
  const V0 = s === 'lv' ? p.lvV0 : p.rvV0, A = s === 'lv' ? p.lvA : p.rvA, b = s === 'lv' ? p.lvBeta : p.rvBeta;
  const espvr = [[V0, 0], [xmax, m.Ees * (xmax - V0)]];
  const ea = [[m.ESV, m.Pes], [m.EDV, 0]];
  const edpvr = [];
  for (let v = V0; v <= xmax; v += (xmax - V0) / 60) edpvr.push([v, A * (Math.exp(b * (v - V0)) - 1)]);
  return { espvr, ea, edpvr, es: [[m.ESV, m.Pes]] };
}

function seriesFor(r, s, color, xmax, strong) {
  const rel = relations(r, s, xmax);
  return [
    { points: rel.edpvr, color, width: 1.2, dash: '2 3' },
    { points: rel.espvr, color, width: 1.4 },
    { points: rel.ea, color, width: 1.4, dash: '6 4' },
    { points: loopPts(r, s), color, width: strong ? 2.8 : 1.8 },
    { points: rel.es, color, marker: strong ? 4.5 : 3.5 },
  ];
}

function renderLoop() {
  const all = [REF, result, snapshot].filter(Boolean);
  const vmax = Math.max(...all.map((r) => r[side].EDV));
  const pmax = Math.max(...all.map((r) => Math.max(...(side === 'lv' ? r.rec.Plv : r.rec.Prv))));
  const xmax = niceMax(vmax * 1.15), ymax = niceMax(pmax * 1.12);
  const series = [
    ...seriesFor(REF, side, C.ref, xmax, false),
    ...(snapshot ? seriesFor(snapshot, side, C.snap, xmax, false) : []),
    ...seriesFor(result, side, C.cur, xmax, true),
  ];
  const w = plotWidth('#pv');
  drawPlot($('#pv'), {
    width: w, height: Math.round(w * 0.68),
    title: `${side === 'lv' ? 'Left' : 'Right'} ventricular pressure–volume loop`,
    x: { min: 0, max: xmax, label: `${side.toUpperCase()} volume (mL)` },
    y: { min: 0, max: ymax, label: `${side.toUpperCase()} pressure (mmHg)` },
    series,
  });
  $('#pv-title').textContent = `${side === 'lv' ? 'Left' : 'Right'} ventricular pressure–volume loop`;
}

function renderPT() {
  const r = result, ms = r.rec.t.map((t) => t * 1000);
  const pick = (arr) => ms.map((t, i) => [t, arr[i]]).filter((_, i) => i % 3 === 0);
  const vent = side === 'lv' ? r.rec.Plv : r.rec.Prv;
  const art = side === 'lv' ? r.rec.Pao : r.rec.Ppa;
  const atr = side === 'lv' ? r.rec.Ppv : r.rec.Psv;
  const refV = side === 'lv' ? REF.rec.Plv : REF.rec.Prv;
  const refMs = REF.rec.t.map((t) => t * 1000);
  const ymax = niceMax(Math.max(...vent, ...art, ...refV) * 1.1);
  const xmax = Math.max(ms[ms.length - 1], refMs[refMs.length - 1]);
  const w = plotWidth('#pt');
  drawPlot($('#pt'), {
    width: w, height: Math.round(w * 0.42), yTicks: 4,
    title: 'Pressure over one cardiac cycle',
    x: { min: 0, max: xmax, label: 'Time (ms)' },
    y: { min: 0, max: ymax, label: 'Pressure (mmHg)' },
    series: [
      { points: refMs.map((t, i) => [t, refV[i]]).filter((_, i) => i % 3 === 0), color: C.ref, width: 1.4 },
      { points: pick(atr), color: C.cur, width: 1.2, dash: '2 3' },
      { points: pick(art), color: C.cur, width: 1.6, dash: '6 4' },
      { points: pick(vent), color: C.cur, width: 2.4 },
    ],
  });
  $('#pt-legend').innerHTML = `
    <span>${swatch(C.cur, '', 2.4)}${side.toUpperCase()} pressure</span>
    <span>${swatch(C.cur, '6 4')}${side === 'lv' ? 'Aortic' : 'Pulmonary arterial'} pressure</span>
    <span>${swatch(C.cur, '2 3')}${side === 'lv' ? 'Left' : 'Right'} atrial pressure</span>
    <span>${swatch(C.ref, '', 1.4)}Normal ${side.toUpperCase()} pressure</span>`;
}

function renderLegend() {
  $('#pv-legend').innerHTML = `
    <span>${swatch(C.cur, '', 2.8)}Current ventricle</span>
    <span>${swatch(C.ref, '', 1.8)}Normal reference</span>
    ${snapshot ? `<span>${swatch(C.snap, '', 1.8)}Pinned snapshot</span>` : ''}
    <span>${swatch('var(--text-muted)', '')}ESPVR (slope Ees)</span>
    <span>${swatch('var(--text-muted)', '6 4')}Ea line (slope −Ea)</span>
    <span>${swatch('var(--text-muted)', '2 3')}EDPVR</span>`;
}

function renderGauge() {
  const r = result, lv = side === 'lv';
  const val = lv ? r.lv.EaEes : r.rv.EesEa;
  const refVal = lv ? REF.lv.EaEes : REF.rv.EesEa;
  const snapVal = snapshot ? (lv ? snapshot.lv.EaEes : snapshot.rv.EesEa) : null;
  const max = lv ? 3 : 3;
  const W = plotWidth('#gauge'), H = 70, l = 20, rr = 20, pw = W - l - rr;
  const x = (v) => l + Math.min(Math.max(v, 0), max) / max * pw;
  const band = lv ? [0.3, 1.3] : [1.5, 2.0];
  const bandLabel = lv ? 'SW and efficiency ≥ 90% of optimum (canine, De Tombe 1993)' : 'Normal 1.5–2 (Tello 2019)';
  let s = `<rect x="${x(band[0])}" y="18" width="${x(band[1]) - x(band[0])}" height="14" style="fill:var(--surface-2);stroke:var(--border)"/>
    <line x1="${l}" x2="${W - rr}" y1="32" y2="32" style="stroke:var(--axis)"/>`;
  for (let t = 0; t <= max; t += 0.5) s += `<line x1="${x(t)}" x2="${x(t)}" y1="32" y2="37" style="stroke:var(--axis)"/><text x="${x(t)}" y="50" text-anchor="middle" font-size="12" style="fill:var(--axis)">${t}</text>`;
  if (!lv) s += `<line x1="${x(0.805)}" x2="${x(0.805)}" y1="12" y2="36" style="stroke:var(--flag);stroke-dasharray:3 2"/><text x="${x(0.805) - 4}" y="10" text-anchor="end" font-size="11" style="fill:var(--flag)">0.805 uncoupling threshold</text>`;
  s += `<text x="${x((band[0] + band[1]) / 2)}" y="66" text-anchor="middle" font-size="11" style="fill:var(--text-muted)">${bandLabel}</text>`;
  const mark = (v, color, h) => `<path d="M${x(v)},${32 - h} l-6,-10 h12 z" style="fill:${color}"/>`;
  s += mark(refVal, C.ref, 1);
  if (snapVal != null) s += mark(snapVal, C.snap, 1);
  s += mark(val, C.cur, 0);
  const svg = $('#gauge');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  $('#gauge-title').textContent = lv ? `LV Ea/Ees = ${val.toFixed(2)}  (normal model ${refVal.toFixed(2)})` : `RV Ees/Ea = ${val.toFixed(2)}  (normal model ${refVal.toFixed(2)})`;
}

function renderMetrics() {
  const rows = METRICS[side].map(([label, unit, fn, range, d, key]) => {
    const cur = fn(result), ref = fn(REF), snap = snapshot ? fn(snapshot) : null;
    const num = typeof cur === 'number';
    const flag = num && range && (cur < range[0] || cur > range[1]);
    const show = (v) => (typeof v === 'number' ? f(d ?? 1)(v) : v);
    return `<tr class="${flag ? 'flag' : ''}${key ? ' key' : ''}"><td>${label}${unit ? ` <span class="status">(${unit})</span>` : ''}</td>
      <td class="num cur">${show(cur)}${flag ? ' *' : ''}</td><td class="num">${show(ref)}</td>${snapshot ? `<td class="num">${show(snap)}</td>` : ''}</tr>`;
  }).join('');
  $('#metrics').innerHTML = `<table class="data metrics"><thead><tr><th>Measure</th><th class="num">Current</th><th class="num">Normal</th>${snapshot ? '<th class="num">Snapshot</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
    <p class="status">* outside the usual resting adult range. These ranges are teaching aids, not diagnostic cut-offs.</p>`;
}

function interpret() {
  const r = result, out = [];
  if (side === 'lv') {
    const q = r.lv.EaEes, ees = r.lv.Ees, ea = r.lv.Ea;
    if (q > 1.3) out.push(`Ea/Ees is ${q.toFixed(2)}. Arterial load is high relative to contractility, so the end-systolic point sits far up and to the right on the ESPVR. Stroke work and efficiency (SW/PVA ${r.lv.eff.toFixed(2)}) are below their optimum; the ventricle is spending energy on pressure rather than flow.`);
    else if (q < 0.3) out.push(`Ea/Ees is ${q.toFixed(2)}. Load is low relative to contractility. Mechanical efficiency is high, but a low ratio says nothing about whether pressure is adequate.`);
    else out.push(`Ea/Ees is ${q.toFixed(2)}, within the range where stroke work and efficiency stay close to optimal in experimental data. Check the absolute values as well: a normal ratio can hide abnormal Ees and Ea.`);
    if (ees > 3.3 && ea > 2.0) out.push(`Both Ees (${ees.toFixed(1)}) and Ea (${ea.toFixed(2)}) are high. This combined ventricular–arterial stiffening is the HFpEF pattern: the ratio looks preserved, but small changes in volume or load cause large swings in pressure.`);
    if (ees < 1.2) out.push(`Ees ${ees.toFixed(1)} mmHg/mL is depressed. With a flat ESPVR, stroke volume becomes very sensitive to afterload: small increases in Ea produce large increases in ESV.`);
    if (r.hemo.MAP < 65) out.push(`MAP is ${r.hemo.MAP.toFixed(0)} mmHg. Hypotension can coexist with an "efficient" ratio when Ea is low (vasoplegia); coupling does not replace an assessment of perfusion.`);
    if (r.hemo.LAP > 15) out.push(`Left atrial pressure is ${r.hemo.LAP.toFixed(0)} mmHg. On the EDPVR this ventricle needs a high filling pressure to reach its end-diastolic volume.`);
  } else {
    const q = r.rv.EesEa;
    if (q < 0.805) out.push(`RV Ees/Ea is ${q.toFixed(2)}, below 0.805, the value Tello and colleagues associated with RV dilatation and the onset of RV failure. Contractility no longer matches pulmonary arterial load.`);
    else if (q < 1.5) out.push(`RV Ees/Ea is ${q.toFixed(2)}: coupling is maintained, but below the normal 1.5–2, so contractile reserve is limited.`);
    else out.push(`RV Ees/Ea is ${q.toFixed(2)}, in the normal range: the RV ejects into a low-impedance circulation with ample reserve.`);
    if (r.rv.svEsv < 0.515) out.push(`SV/ESV is ${r.rv.svEsv.toFixed(2)}, below the 0.515 cut-off Vanderpool and colleagues linked to worse outcome. SV/ESV assumes V₀ = 0 and so reads lower than the true Ees/Ea when the ESPVR is shifted right.`);
    if (r.hemo.mPAP > 20) out.push(`Mean PA pressure is ${r.hemo.mPAP.toFixed(0)} mmHg (PH: > 20 mmHg). PVR ${r.hemo.PVR_WU.toFixed(1)} WU and left atrial pressure ${r.hemo.LAP.toFixed(0)} mmHg separate a pre-capillary from a post-capillary cause.`);
    if (r.hemo.RAP > 10) out.push(`Right atrial pressure is ${r.hemo.RAP.toFixed(0)} mmHg. The RV is operating on the steep part of its EDPVR; further volume will raise filling pressure more than stroke volume.`);
    if (r.lv.EDV < REF.lv.EDV * 0.8) out.push(`LV end-diastolic volume has fallen to ${r.lv.EDV.toFixed(0)} mL. The ventricles are in series, so a failing RV underfills the LV and systemic pressure falls even though LV contractility is unchanged. (Septal shift, which worsens this further, is not modelled.)`);
  }
  $('#interp').innerHTML = out.map((t) => `<p>${t}</p>`).join('');
}

function render() {
  renderLoop(); renderLegend(); renderPT(); renderGauge(); renderMetrics(); interpret();
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.side === side));
  $('#clear').disabled = !snapshot;
}

// ---------- presets, tabs, hash ----------
function loadPreset(id) {
  const p = presetById(id);
  if (!p) return;
  params = { ...NORMAL, ...p.params };
  if (p.side === 'lv' || p.side === 'rv') side = p.side;
  warm = null;
  $('#preset').value = id;
  $('#preset-text').innerHTML = `<p><strong>${p.label}.</strong> ${p.text}</p><p class="status">Sources: ${p.refs.map((k) => {
    const r = REF_INDEX[k]; return `<a href="references.html#ref-${k}">${r.authors.split(',')[0]} ${r.year}</a>`;
  }).join('; ')}</p>`;
  buildControls();
  run();
}

function writeHash() {
  const diff = {};
  for (const [k, v] of Object.entries(params)) if (Math.abs(v - NORMAL[k]) > 1e-9) diff[k] = +v.toPrecision(4);
  const pid = $('#preset').value;
  const h = pid ? `preset=${pid}&side=${side}` : `side=${side}&p=${encodeURIComponent(JSON.stringify(diff))}`;
  history.replaceState(null, '', '#' + h);
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('side')) side = h.get('side') === 'rv' ? 'rv' : 'lv';
  if (h.get('preset') && presetById(h.get('preset'))) { const s = h.get('side'); loadPreset(h.get('preset')); if (s) { side = s === 'rv' ? 'rv' : 'lv'; render(); } return true; }
  if (h.get('p')) {
    try {
      const d = JSON.parse(decodeURIComponent(h.get('p')));
      for (const k of Object.keys(d)) if (k in NORMAL && Number.isFinite(d[k])) params[k] = d[k];
    } catch { /* ignore malformed links */ }
  }
  return false;
}

export function initSimulator() {
  const sel = $('#preset');
  sel.innerHTML = '<option value="">Custom</option>' +
    `<optgroup label="Left heart">${PRESETS.filter((p) => p.side !== 'rv').map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>` +
    `<optgroup label="Right heart / pulmonary">${PRESETS.filter((p) => p.side === 'rv').map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}</optgroup>`;
  sel.addEventListener('change', () => { if (sel.value) loadPreset(sel.value); });
  $('#reset').addEventListener('click', () => loadPreset('normal'));
  $('#pin').addEventListener('click', () => { snapshot = result; render(); });
  $('#clear').addEventListener('click', () => { snapshot = null; render(); });
  $('#adv').addEventListener('change', (e) => { showAdvanced = e.target.checked; buildControls(); });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    side = b.dataset.side; buildControls(); render(); writeHash();
  }));
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => result && render(), 150); });
  if (!readHash()) { buildControls(); run(); $('#preset-text').innerHTML = '<p>Choose a scenario, or move any slider. The grey loop is always the normal ventricle, so every change is read against it.</p>'; }
}
