// Static teaching figures generated from the same engine as the simulator.
import { simulate, cardiacPhases } from './engine.js';
import { addExport, svgCapture, header, even } from './export.js';
import { drawPlot, niceMax, svgEl } from './plot.js';
import { PRESETS, presetById } from './presets.js';

const C = { cur: 'var(--series-current)', ref: 'var(--series-ref)', snap: 'var(--series-snap)' };

function loop(r, side) {
  const V = side === 'lv' ? r.rec.Vlv : r.rec.Vrv, P = side === 'lv' ? r.rec.Plv : r.rec.Prv;
  const pts = [];
  for (let i = 0; i < V.length; i += 4) pts.push([V[i], P[i]]);
  pts.push(pts[0]);
  return pts;
}

function rels(r, side, xmax, color) {
  const m = r[side], p = r.params;
  const V0 = side === 'lv' ? p.lvV0 : p.rvV0, A = side === 'lv' ? p.lvA : p.rvA, b = side === 'lv' ? p.lvBeta : p.rvBeta;
  const ed = [];
  for (let v = V0; v <= xmax; v += (xmax - V0) / 50) ed.push([v, A * (Math.exp(b * (v - V0)) - 1)]);
  return [
    { points: ed, color, width: 1.1, dash: '2 3' },
    { points: [[V0, 0], [xmax, m.Ees * (xmax - V0)]], color, width: 1.3 },
    { points: [[m.ESV, m.Pes], [m.EDV, 0]], color, width: 1.3, dash: '6 4' },
  ];
}

function drawLoopFig() {
  const r = simulate({});
  const m = r.lv;
  const svg = document.getElementById('fig-loop');
  if (!svg) return;
  const W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640));
  loopFig = { r, map: drawPlot(svg, {
    width: W, height: Math.round(W * 0.62), title: 'Annotated left ventricular pressure–volume loop',
    x: { min: 0, max: 200, label: 'LV volume (mL)' }, y: { min: 0, max: 150, label: 'LV pressure (mmHg)' },
    series: [...rels(r, 'lv', 200, C.ref), { points: loop(r, 'lv'), color: C.cur, width: 2.6 }, { points: [[m.ESV, m.Pes]], color: C.cur, marker: 4 }],
    annotations: [
      { x: m.EDV, y: m.EDP, text: 'End-diastole', dx: 6, dy: -6 },
      { x: m.ESV, y: m.Pes, text: 'End-systole (Pes)', dx: -8, dy: -8, anchor: 'end' },
      { x: (m.ESV + m.EDV) / 2, y: 4, text: 'Filling', anchor: 'middle', dy: -8 },
      { x: (m.ESV + m.EDV) / 2, y: m.Pes + 6, text: 'Ejection', anchor: 'middle', dy: -4 },
      { x: m.EDV, y: 55, text: 'Isovolumic contraction', dx: 6 },
      { x: m.ESV, y: 55, text: 'Isovolumic relaxation', dx: -6, anchor: 'end' },
      { x: m.Pes / m.Ees + r.params.lvV0 + 14, y: 140, text: 'ESPVR (slope Ees)' },
      { x: 175, y: 0.22 * (Math.exp(0.029 * 165) - 1) + 4, text: 'EDPVR', anchor: 'end' },
      { x: (m.ESV + m.EDV) / 2, y: m.Pes / 2, text: 'Ea line (slope −Ea)', dx: 8 },
    ],
  }) };
  svgEl('circle', { id: 'fig-cursor', r: 5, class: 'beat-cursor', cx: -9, cy: -9 }, svg);
}

let loopFig = null, exporting = false;
function setLoopCursor(i) {
  const { r, map } = loopFig, c = document.getElementById('fig-cursor');
  c.setAttribute('cx', map.sx(r.rec.Vlv[i])); c.setAttribute('cy', map.sy(r.rec.Plv[i]));
}
function tickLoop(now) {
  const c = document.getElementById('fig-cursor');
  if (c && loopFig && !exporting) {
    const { r, map } = loopFig, n = r.rec.t.length, i = Math.floor(((now / 4000) % r.T) / r.T * n);   // quarter speed
    c.setAttribute('cx', map.sx(r.rec.Vlv[i])); c.setAttribute('cy', map.sy(r.rec.Plv[i]));
  }
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(tickLoop);
}

function drawRange() {
  const svg = document.getElementById('fig-range');
  if (!svg) return;
  const cases = [
    [simulate({}), 'var(--series-ref)', 'Normal'],
    [simulate(presetById('hfpef').params), 'var(--flag)', 'HFpEF'],
    [simulate(presetById('vasoplegia').params), 'var(--series-current)', 'Vasoplegia'],
  ];
  const W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640));
  drawPlot(svg, {
    width: W, height: Math.round(W * 0.6), title: 'Normal, HFpEF, and vasoplegia',
    x: { min: 0, max: 200, label: 'LV volume (mL)' }, y: { min: 0, max: 210, label: 'LV pressure (mmHg)' },
    series: cases.map(([r, color]) => ({ points: loop(r, 'lv'), color, width: 2.4 })),
    annotations: cases.map(([r, color, name], k) => ({
      x: 4, y: 204 - k * 15,
      text: `${name}: Ea/Ees ${r.lv.EaEes.toFixed(2)} · LAP ${r.hemo.LAP.toFixed(0)} · BP ${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)} (MAP ${r.hemo.MAP.toFixed(0)})`, color,
    })),
  });
}

// Ees: loops at three preloads; the end-systolic corners line up on the ESPVR.
function drawEesFig() {
  const svg = document.getElementById('fig-ees');
  if (!svg) return;
  const rs = [480, 700, 1100].map((vStressed) => simulate({ vStressed, baro: 0, coronary: 0 }));   // a caval occlusion: faster than the reflexes
  const p = rs[1].params, m = rs[1].lv, W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640));
  const shades = [C.ref, C.cur, C.ref];
  drawPlot(svg, {
    width: W, height: Math.round(W * 0.58), title: 'Loops at three preloads share one ESPVR',
    x: { min: 0, max: 200, label: 'LV volume (mL)' }, y: { min: 0, max: 160, label: 'LV pressure (mmHg)' },
    series: [
      { points: [[p.lvV0, 0], [p.lvV0 + 160 / m.Ees, 160]], color: C.cur, width: 1.6 },
      ...rs.map((r, k) => ({ points: loop(r, 'lv'), color: shades[k], width: k === 1 ? 2.6 : 1.8 })),
      ...rs.map((r) => ({ points: [[r.lv.ESV, r.lv.Pes]], color: 'var(--flag)', marker: 5 })),
    ],
    annotations: [
      { x: p.lvV0 + 150 / m.Ees, y: 150, text: `ESPVR: slope Ees = ${m.Ees.toFixed(1)} mmHg/mL`, dx: 8 },
      { x: p.lvV0, y: 0, text: 'V₀', dx: -4, dy: -8, anchor: 'end' },
    ],
  });
}

// Ea: loops at three afterloads; Ea lines steepen, the corner slides up the same ESPVR.
function drawEaFig() {
  const svg = document.getElementById('fig-ea');
  if (!svg) return;
  const iso = { baro: 0, coronary: 0 };                   // contractility and volume held constant
  const base = simulate(iso), rs = [0.6, 1, 1.6].map((f) => simulate({ ...iso, svr: base.params.svr * f }));
  const p = base.params, W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640));
  const shades = [C.ref, C.cur, C.ref];
  drawPlot(svg, {
    width: W, height: Math.round(W * 0.58), title: 'Loops at three afterloads',
    x: { min: 0, max: 200, label: 'LV volume (mL)' }, y: { min: 0, max: 160, label: 'LV pressure (mmHg)' },
    series: [
      { points: [[p.lvV0, 0], [p.lvV0 + 160 / p.lvEes, 160]], color: C.cur, width: 1.4 },
      ...rs.map((r, k) => ({ points: loop(r, 'lv'), color: shades[k], width: k === 1 ? 2.6 : 1.8 })),
      ...rs.map((r, k) => ({ points: [[r.lv.ESV, r.lv.Pes], [r.lv.EDV, 0]], color: shades[k], width: 1.6, dash: '6 4' })),
      ...rs.map((r) => ({ points: [[r.lv.ESV, r.lv.Pes]], color: 'var(--flag)', marker: 5 })),
    ],
    annotations: rs.map((r, k) => ({ x: r.lv.ESV, y: r.lv.Pes, text: `Ea ${r.lv.Ea.toFixed(2)} · SV ${r.lv.SV.toFixed(0)} mL`, dx: -10, dy: k === 2 ? -8 : 4, anchor: 'end' })),
  });
}

// The ratio: two lines, EDV and V0 fixed; sliders move Ees and Ea.
const RQ = { EDV: 142, V0: 10 };
function drawRatioFig() {
  const svg = document.getElementById('fig-ratio');
  if (!svg) return;
  const ees = +document.getElementById('rq-ees').value, ea = +document.getElementById('rq-ea').value;
  const { EDV, V0 } = RQ, esv = (ea * EDV + ees * V0) / (ees + ea), pes = ees * (esv - V0), sv = EDV - esv;
  const W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640)), ymax = 200;
  const m = drawPlot(svg, {
    width: W, height: Math.round(W * 0.58), title: 'ESPVR and Ea line: the crossing sets stroke volume',
    x: { min: 0, max: 160, label: 'LV volume (mL)' }, y: { min: 0, max: ymax, label: 'LV pressure (mmHg)' },
    series: [
      { points: [[V0, 0], [Math.min(160, V0 + ymax / ees), Math.min(ymax, ees * (160 - V0))]], color: C.cur, width: 2.2 },
      { points: [[EDV, 0], [Math.max(0, EDV - ymax / ea), Math.min(ymax, ea * EDV)]], color: C.snap, width: 2.2, dash: '6 4' },
      { points: [[esv, pes]], color: 'var(--flag)', marker: 6 },
      { points: [[esv, 0], [esv, pes]], color: 'var(--flag)', width: 1, dash: '2 3' },
    ],
    annotations: [
      { x: V0 + Math.min(ymax * 0.25, pes * 0.4) / ees, y: Math.min(ymax * 0.25, pes * 0.4), text: 'ESPVR', dx: 8 },
      { x: EDV - Math.min(ymax * 0.25, pes * 0.4) / ea, y: Math.min(ymax * 0.25, pes * 0.4), text: 'Ea line', dx: -8, anchor: 'end', color: C.snap },
      { x: esv, y: pes, text: `ESV ${esv.toFixed(0)}, Pes ${pes.toFixed(0)}`, dx: esv > 80 ? -10 : 10, dy: -10, anchor: esv > 80 ? 'end' : 'start' },
    ],
  });
  // bars under the volume axis: V0 | kept (ESV − V0) | ejected (SV)
  const y = m.sy(0) - 14, bar = (x0, x1, cls) => svgEl('rect', { x: m.sx(x0), y, width: Math.max(0, m.sx(x1) - m.sx(x0)), height: 10, class: cls }, m.svg);
  bar(V0, esv, 'rq-kept'); bar(esv, EDV, 'rq-sv');
  document.getElementById('rq-ees-v').textContent = ees.toFixed(2);
  document.getElementById('rq-ea-v').textContent = ea.toFixed(2);
  const share = ees / (ees + ea);
  document.getElementById('rq-read').innerHTML = `Ea/Ees <b>${(ea / ees).toFixed(2)}</b> · ejected share Ees/(Ees + Ea) = <b>${(share * 100).toFixed(0)}%</b> of EDV − V₀ (${EDV - V0} mL) · SV <b>${sv.toFixed(0)} mL</b> · EF <b>${(sv / EDV * 100).toFixed(0)}%</b>`;
}

function drawSweep() {
  const svg = document.getElementById('fig-sweep');
  if (!svg) return;
  const pts = [];
  let state;
  for (let svr = 0.15; svr <= 5; svr *= 1.12) {
    const r = simulate({ svr, baro: 0, coronary: 0 }, state ? { state } : {});   // fixed Ees and volume
    state = r.state;
    pts.push({ q: r.lv.EaEes, sw: r.lv.SW, eff: r.lv.eff });
  }
  const swMax = Math.max(...pts.map((p) => p.sw)), effMax = Math.max(...pts.map((p) => p.eff));
  const qSW = pts.find((p) => p.sw === swMax).q;
  const qN = simulate({}).lv.EaEes;
  const W = Math.max(340, Math.min(720, svg.parentElement.clientWidth || 640));
  drawPlot(svg, {
    width: W, height: Math.round(W * 0.5), title: 'Stroke work and efficiency versus Ea/Ees',
    x: { min: 0, max: Math.min(4, niceMax(Math.max(...pts.map((p) => p.q)))), label: 'Ea/Ees' },
    y: { min: 0, max: 1.05, label: 'Fraction of maximum' },
    series: [
      { points: pts.map((p) => [p.q, p.sw / swMax]), color: C.cur, width: 2.4 },
      { points: pts.map((p) => [p.q, p.eff / effMax]), color: C.snap, width: 2.4, dash: '6 4' },
      { points: [[qN, 0], [qN, 1.05]], color: C.ref, width: 1, dash: '2 3' },
    ],
    annotations: [
      { x: qSW, y: 1.0, text: 'Stroke work', dx: 8, dy: 14, color: C.cur },
      { x: 0.25, y: 0.97, text: 'Efficiency (SW/PVA)', dy: 18, color: C.snap },
      { x: qN, y: 0.1, text: 'normal', dx: 4 },
    ],
  });
}

// One beat at quarter speed, with the phase in the header.
const PHASE = { fill: 'Filling', ivc: 'Isovolumic contraction', eject: 'Ejection', ivr: 'Isovolumic relaxation' };
function loopExportSpec() {
  return {
    file: 'va-coupling-pv-loop-normal-lv',
    title: 'The left ventricular pressure–volume loop',
    caption: 'Simulated normal left ventricle over one beat at quarter speed. The solid line is the ESPVR (slope Ees), the dashed line is the Ea line (slope −Ea), and the dotted line is the EDPVR. The loop runs counter-clockwise, its width is the stroke volume, and its area is the stroke work.',
    notes: `EDV ${loopFig.r.lv.EDV.toFixed(0)} mL, ESV ${loopFig.r.lv.ESV.toFixed(0)} mL, EF ${(loopFig.r.lv.EF * 100).toFixed(0)}%, Ees ${loopFig.r.lv.Ees.toFixed(2)} and Ea ${loopFig.r.lv.Ea.toFixed(2)} mmHg/mL (Ea/Ees ${loopFig.r.lv.EaEes.toFixed(2)}).`,
    async prepare() {
      exporting = true;
      const svg = document.getElementById('fig-loop'), cap = svgCapture(svg), { r } = loopFig, n = r.rec.t.length, ph = cardiacPhases(r).lv.ph;
      const W = 1100, top = 56, H = even(top + W * cap.aspect + 8), bg = getComputedStyle(svg.closest('.monitor')).backgroundColor;
      return {
        W, H, duration: 4 * r.T,
        async frame(g, t) {
          const i = Math.min(n - 1, Math.floor((t / 4) / r.T * n));
          setLoopCursor(i);
          g.fillStyle = bg; g.fillRect(0, 0, W, H);
          header(g, W, 'Normal left ventricle (model)', `${PHASE[ph[i]]}   ·   t ${(r.rec.t[i] * 1000).toFixed(0)} ms`);
          g.drawImage(await cap.image(W), 0, top, W, W * cap.aspect);
        },
        done() { exporting = false; },
      };
    },
  };
}

export function initLearnFigures() {
  drawLoopFig();
  const fig = document.getElementById('fig-loop');
  if (fig) addExport(fig.closest('figure'), loopExportSpec);
  drawEesFig(); drawEaFig(); drawRatioFig();
  for (const id of ['rq-ees', 'rq-ea']) document.getElementById(id)?.addEventListener('input', drawRatioFig);
  drawSweep();
  drawRange();
  requestAnimationFrame(tickLoop);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { drawLoopFig(); drawEesFig(); drawEaFig(); drawRatioFig(); drawSweep(); drawRange(); }, 200); });
  document.addEventListener('themechange', () => {});
}

const ratioLbl = (s) => (s === 'lv' ? 'Ea/Ees' : 'Ees/Ea');

// Scenario thumbnails: normal loop (gray) against the scenario loop (green).
// Details panel: mechanism, bedside findings, management evidence, caveat, then model values vs normal.
function scenarioDetail(p, r, ref, side) {
  const d = p.detail || {};
  const sec = (h, t) => (t ? `<h4>${h}</h4><p>${t}</p>` : '');
  const rows = [
    ['LV Ees / Ea (mmHg/mL)', (x) => `${x.lv.Ees.toFixed(2)} / ${x.lv.Ea.toFixed(2)}`],
    ['LV Ea/Ees', (x) => x.lv.EaEes.toFixed(2)],
    ['LV EDV / ESV (mL), EF', (x) => `${x.lv.EDV.toFixed(0)} / ${x.lv.ESV.toFixed(0)}, ${(x.lv.EF * 100).toFixed(0)}%`],
    ['RV Ees / Ea (mmHg/mL)', (x) => `${x.rv.Ees.toFixed(2)} / ${x.rv.Ea.toFixed(2)}`],
    ['RV Ees/Ea', (x) => x.rv.EesEa.toFixed(2)],
    ['RV EDV / ESV (mL), EF', (x) => `${x.rv.EDV.toFixed(0)} / ${x.rv.ESV.toFixed(0)}, ${(x.rv.EF * 100).toFixed(0)}%`],
    ['BP (MAP) mmHg', (x) => `${x.hemo.SBP.toFixed(0)}/${x.hemo.DBP.toFixed(0)} (${x.hemo.MAP.toFixed(0)})`],
    ['PA (mean) mmHg', (x) => `${x.hemo.PASP.toFixed(0)}/${x.hemo.PADP.toFixed(0)} (${x.hemo.mPAP.toFixed(0)})`],
    ['LAP / RAP mmHg', (x) => `${x.hemo.LAP.toFixed(0)} / ${x.hemo.RAP.toFixed(0)}`],
    ['CO L/min, HR', (x) => `${x.hemo.CO.toFixed(1)}, ${x.eff.hr.toFixed(0)}`],
    ['PVR WU', (x) => x.hemo.PVR_WU.toFixed(1)],
  ];
  const order = side === 'rv' ? [3, 4, 5, 7, 8, 9, 10, 0, 1, 6] : [0, 1, 2, 6, 8, 9, 3, 4, 7];
  // rows that matter only when a lesion or mechanism moves them away from normal
  const extra = [
    ['Regurgitant fraction LV / RV', (x) => `${(x.lv.RF * 100).toFixed(0)}% / ${(x.rv.RF * 100).toFixed(0)}%`, r.lv.RF + r.rv.RF > 0.01],
    ['Forward SV (mL)', (x) => x.lv.fwdSV.toFixed(0), r.lv.RF > 0.01],
    ['Aortic valve mean / peak gradient (mmHg)', (x) => `${x.hemo.avMeanGrad.toFixed(0)} / ${x.hemo.avPeakGrad.toFixed(0)}`, r.hemo.avMeanGrad > 1],
    ['Pericardial pressure (mmHg)', (x) => x.hemo.Ppcd.toFixed(1), r.hemo.Ppcd > 3],
    ['Septal shift at end-diastole (mL)', (x) => x.hemo.VsptED.toFixed(0), r.hemo.VsptED < -5],
    ['Ischemic Ees, LV / RV (% of intrinsic)', (x) => `${(x.hemo.ischL * 100).toFixed(0)} / ${(x.hemo.ischR * 100).toFixed(0)}`, r.hemo.ischL < 0.99 || r.hemo.ischR < 0.99],
    ['Relaxation τ (ms)', (x) => (x.lv.tau * 1000).toFixed(0), Math.abs(r.lv.tau - ref.lv.tau) > 0.008],
  ].filter((e) => e[2]);
  const table = `<table class="data scen-table"><thead><tr><th>Model</th><th class="num">This</th><th class="num">Normal</th></tr></thead><tbody>${
    [...order.map((i) => rows[i]), ...extra].map((row) => `<tr><td>${row[0]}</td><td class="num">${row[1](r)}</td><td class="num">${row[1](ref)}</td></tr>`).join('')}</tbody></table>`;
  return `${d.mech ? '' : `<p>${p.text}</p>`}${sec('Mechanism', d.mech)}${sec('Echo and catheter findings', d.see)}${sec('Evidence on management', d.manage)}${sec('Limitation', d.note)}${table}`;
}

export function initScenarioCards(group = 'basic', boxId = 'scenario-list') {
  const ref = simulate({});
  const box = document.getElementById(boxId);
  if (!box) return;
  for (const p of PRESETS.filter((x) => x.id !== 'normal' && (x.group || 'basic') === group)) {
    const r = simulate(p.params);
    const side = p.side === 'rv' ? 'rv' : 'lv';
    const card = document.createElement('div');
    card.className = 'card';
    const m = r[side];
    const nums = side === 'lv'
      ? [[ratioLbl(side), side === 'lv' ? m.EaEes.toFixed(2) : m.EesEa.toFixed(2)], ['BP', `${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)}`], ['CO', r.hemo.CO.toFixed(1)]]
      : [[ratioLbl(side), m.EesEa.toFixed(2)], ['mPAP', r.hemo.mPAP.toFixed(0)], ['RAP', r.hemo.RAP.toFixed(0)]];
    card.className = 'card scen';
    card.innerHTML = `<h3>${p.label}</h3><div class="monitor mini"><svg aria-hidden="true"></svg></div>
      <div class="scen-nums">${nums.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
      <details><summary><span class="when-closed">Details</span><span class="when-open">Hide details</span></summary>${scenarioDetail(p, r, ref, side)}</details>
      <a class="more" href="simulator.html#preset=${p.id}&side=${side}">Open in simulator →</a>`;
    box.appendChild(card);
    const xmax = niceMax(Math.max(m.EDV, ref[side].EDV) * 1.15);
    const ymax = niceMax(Math.max(...(side === 'lv' ? r.rec.Plv : r.rec.Prv), ...(side === 'lv' ? ref.rec.Plv : ref.rec.Prv)) * 1.1);
    drawPlot(card.querySelector('svg'), {
      title: p.label,
      width: 360, height: 230, xTicks: 4, yTicks: 4,
      x: { min: 0, max: xmax, label: `${side.toUpperCase()} volume (mL)` },
      y: { min: 0, max: ymax, label: 'mmHg' },
      series: [
        { points: loop(ref, side), color: C.ref, width: 1.6 },
        ...rels(r, side, xmax, C.cur).slice(1),
        { points: loop(r, side), color: C.cur, width: 2.4 },
      ],
    });
  }
}


// Landing page: the loop morphs between normal and disease states, with a beat cursor.
function resample(r, side, n = 160) {
  const V = side === 'lv' ? r.rec.Vlv : r.rec.Vrv, P = side === 'lv' ? r.rec.Plv : r.rec.Prv;
  return Array.from({ length: n + 1 }, (_, k) => { const i = Math.floor((k % n) / n * V.length); return [V[i], P[i]]; });
}
export function initHero() {
  const svg = document.getElementById('hero-loop');
  if (!svg) return;
  const seq = [['normal', 'Normal'], ['hfref', 'HFrEF'], ['hfpef', 'HFpEF'], ['vasoplegia', 'Vasoplegia'], ['highAfterload', 'High afterload']]
    .map(([id, name]) => ({ name, pts: resample(simulate(presetById(id).params), 'lv') }));
  const ref = seq[0].pts;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let k = 0, t0 = performance.now();
  const draw = (now) => {
    const hold = 2600, move = 1100, u = Math.min(1, Math.max(0, (now - t0 - hold) / move));
    const a = seq[k].pts, b = seq[(k + 1) % seq.length].pts, e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const cur = a.map((p, i) => [p[0] + (b[i][0] - p[0]) * e, p[1] + (b[i][1] - p[1]) * e]);
    const name = u < 0.5 ? seq[k].name : seq[(k + 1) % seq.length].name;
    const m = drawPlot(svg, {
      width: 420, height: 300, xTicks: 4, yTicks: 4, title: 'Pressure–volume loop',
      x: { min: 0, max: 250, label: 'LV volume (mL)' }, y: { min: 0, max: 180, label: 'LV pressure (mmHg)' },
      series: [{ points: ref, color: 'var(--series-ref)', width: 1.5 }, { points: cur, color: 'var(--series-current)', width: 3 }],
      annotations: [{ x: 240, y: 168, text: name, anchor: 'end', color: 'var(--series-current)' }],
    });
    const j = Math.floor(((now / 1000) % 3.4) / 3.4 * 160);   // quarter speed
    svgEl('circle', { r: 5, class: 'beat-cursor', cx: m.sx(cur[j][0]), cy: m.sy(cur[j][1]) }, svg);
    if (u >= 1) { k = (k + 1) % seq.length; t0 = now; }
    if (!still) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
