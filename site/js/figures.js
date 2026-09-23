// Static teaching figures generated from the same engine as the simulator.
import { simulate } from './engine.js';
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

let loopFig = null;
function tickLoop(now) {
  const c = document.getElementById('fig-cursor');
  if (c && loopFig) {
    const { r, map } = loopFig, n = r.rec.t.length, i = Math.floor(((now / 1000) % r.T) / r.T * n);
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
    width: W, height: Math.round(W * 0.6), title: 'Three ventricles with in-range Ea/Ees',
    x: { min: 0, max: 200, label: 'LV volume (mL)' }, y: { min: 0, max: 210, label: 'LV pressure (mmHg)' },
    series: cases.map(([r, color]) => ({ points: loop(r, 'lv'), color, width: 2.4 })),
    annotations: cases.map(([r, color, name], k) => ({
      x: 4, y: 204 - k * 15,
      text: `${name}: Ea/Ees ${r.lv.EaEes.toFixed(2)} · LAP ${r.hemo.LAP.toFixed(0)} · BP ${r.hemo.SBP.toFixed(0)}/${r.hemo.DBP.toFixed(0)} (MAP ${r.hemo.MAP.toFixed(0)})`, color,
    })),
  });
}

function drawSweep() {
  const svg = document.getElementById('fig-sweep');
  if (!svg) return;
  const pts = [];
  let state;
  for (let svr = 0.15; svr <= 5; svr *= 1.12) {
    const r = simulate({ svr }, state ? { state } : {});
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

export function initLearnFigures() {
  drawLoopFig();
  drawSweep();
  drawRange();
  requestAnimationFrame(tickLoop);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { drawLoopFig(); drawSweep(); drawRange(); }, 200); });
  document.addEventListener('themechange', () => {});
}

const ratioLbl = (s) => (s === 'lv' ? 'Ea/Ees' : 'Ees/Ea');

// Scenario thumbnails: normal loop (grey) against the scenario loop (green).
export function initScenarioCards() {
  const ref = simulate({});
  const box = document.getElementById('scenario-list');
  for (const p of PRESETS.filter((x) => x.id !== 'normal')) {
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
      <details><summary>Details</summary><p>${p.text}</p></details>
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
    const j = Math.floor(((now / 1000) % 0.857) / 0.857 * 160);
    svgEl('circle', { r: 5, class: 'beat-cursor', cx: m.sx(cur[j][0]), cy: m.sy(cur[j][1]) }, svg);
    if (u >= 1) { k = (k + 1) % seq.length; t0 = now; }
    if (!still) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
