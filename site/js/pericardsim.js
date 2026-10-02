// Pericardial disease lab: the four pericardial cases under a breath, as tracings and as a comparison table.
import { CASES, runBeats, measure, BREATHS } from './pericard.js';
import { drawPlot } from './plot.js';

const $ = (s) => document.querySelector(s);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const pct = (a, b) => (b / a - 1) * 100;
const BREATH_LIST = [
  ['spont', 'Quiet spontaneous breathing'],
  ['tachy', 'Labored spontaneous breathing'],
  ['ppv', 'Positive-pressure breath'],
];
const CASE_LIST = Object.entries(CASES).map(([id, c]) => [id, c.label]);
const COLORS = { art: 'var(--mon-art, #3fbf6f)', gray: 'var(--mon-axis)', lv: 'var(--mon-art, #3fbf6f)', rv: '#6fa8dc' };

const cache = new Map();
function compute(caseId, breath) {
  const key = `${caseId}|${breath}`;
  if (!cache.has(key)) {
    const run = runBeats(CASES[caseId].params, BREATHS[breath], { seconds: 16, warm: 8 });
    cache.set(key, { run, m: measure(run), h: run.base.hemo });
  }
  return cache.get(key);
}

function seg(host, items, current, onPick) {
  host.innerHTML = items.map(([id, label]) => `<button type="button" data-id="${id}" aria-pressed="${id === current}">${label}</button>`).join('');
  host.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    host.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.id);
  };
}

export function initPericard() {
  const S = { case: 'tamponade', breath: 'spont' };
  seg($('#pc-case'), CASE_LIST, S.case, (v) => { S.case = v; show(); });
  seg($('#pc-breath'), BREATH_LIST, S.breath, (v) => { S.breath = v; show(); table(); });

  // continuous signals of the recorded beats, thinned for drawing
  function trace(run, key, step = 6) {
    const pts = [];
    for (const b of run.beats) {
      const rec = b.r.rec;
      for (let i = 0; i < rec.t.length; i += step) pts.push([b.t0 + rec.t[i], key === 'Ppl' ? rec.Ppl[i] : key === 'pcd' ? rec.Ppcd[i] + rec.Ppl[i] : rec[key][i]]);
    }
    return pts;
  }

  function show() {
    const { run, m, h } = compute(S.case, S.breath), tEnd = run.beats[run.beats.length - 1].t0 + run.beats[run.beats.length - 1].T;
    const x = { min: 0, max: tEnd, label: 'Time, s' };
    drawPlot($('#pc-ppl'), { width: 560, height: 200, x, y: { min: -14, max: 12, label: 'mmHg' }, series: [{ points: trace(run, 'Ppl', 12), color: COLORS.gray, width: 1.8 }], title: 'Pleural pressure' });
    const art = trace(run, 'Pao'), sys = run.beats.map((b) => [b.t0 + b.r.rec.t[b.r.rec.Pao.indexOf(Math.max(...b.r.rec.Pao))], Math.max(...b.r.rec.Pao)]);
    const aMax = Math.ceil((Math.max(...sys.map((p) => p[1])) + 10) / 20) * 20;
    drawPlot($('#pc-art'), { width: 560, height: 260, x, y: { min: 40, max: aMax, label: 'mmHg' }, series: [{ points: art, color: COLORS.art, width: 1.6 }, { points: sys, color: 'var(--text)', marker: 3 }], title: 'Arterial pressure with the systolic peak of each beat' });
    const ra = trace(run, 'Pra'), pc = trace(run, 'pcd');
    const rMax = Math.ceil(Math.max(...ra.map((p) => p[1]), ...pc.map((p) => p[1])) + 3);
    drawPlot($('#pc-ra'), { width: 560, height: 260, x, y: { min: Math.min(-6, Math.floor(Math.min(...pc.map((p) => p[1])) - 1)), max: rMax, label: 'mmHg' }, series: [{ points: pc, color: COLORS.gray, width: 1.6 }, { points: ra, color: COLORS.art, width: 1.6 }], title: 'Right atrial pressure and the pressure around the heart' });
    const lv = run.beats.map((b) => [b.t0 + b.T / 2, b.r.lv.EDV]), rv = run.beats.map((b) => [b.t0 + b.T / 2, b.r.rv.EDV]);
    const vals = [...lv, ...rv].map((p) => p[1]);
    drawPlot($('#pc-vol'), { width: 560, height: 260, x, y: { min: Math.floor(Math.min(...vals) / 10 - 1) * 10, max: Math.ceil(Math.max(...vals) / 10 + 1) * 10, label: 'mL' }, series: [{ points: lv, color: COLORS.lv, width: 1.8 }, { points: lv, color: COLORS.lv, marker: 3 }, { points: rv, color: COLORS.rv, width: 1.8 }, { points: rv, color: COLORS.rv, marker: 3 }], title: 'End-diastolic volume of each beat, left ventricle (green) and right ventricle (blue)' });
    const tile = (k, v, sub, bad) => `<div class="tile${bad ? ' off' : ''}"><div class="tile-v">${v}</div><div class="tile-k">${k} <span>${sub}</span></div></div>`;
    $('#pc-tiles').innerHTML = [
      tile('Inspiratory fall in systolic pressure', `${f(m.sbpFall)} mmHg`, 'highest to lowest beat', m.sbpFall > 10),
      tile('Right atrial pressure', `${f(h.RAP)} mmHg`, 'mean', h.RAP > 10),
      tile('Cardiac output', `${f(h.CO, 2)} L/min`, 'without a breath', h.CO < 4),
      tile('LV filling in inspiration', `${pct(m.lvEdvExp, m.lvEdvInsp) >= 0 ? '+' : ''}${f(pct(m.lvEdvExp, m.lvEdvInsp))}%`, 'end-diastolic volume against expiration', false),
      tile('RV filling in inspiration', `${pct(m.rvEdvExp, m.rvEdvInsp) >= 0 ? '+' : ''}${f(pct(m.rvEdvExp, m.rvEdvInsp))}%`, 'end-diastolic volume against expiration', false),
    ].join('');
  }

  const ROWS = [
    ['Inspiratory fall in systolic pressure, mmHg', (c) => f(c.m.sbpFall)],
    ['Mean arterial pressure, mmHg', (c) => f(c.h.MAP, 0)],
    ['Cardiac output, L/min', (c) => f(c.h.CO, 2)],
    ['Right atrial pressure, mmHg', (c) => f(c.h.RAP)],
    ['Right atrial pressure, expiration → inspiration, mmHg', (c) => `${f(c.m.rapExp)} → ${f(c.m.rapInsp)}`],
    ['Mean pericardial pressure, mmHg', (c) => f(c.h.Ppcd)],
    ['Wedge pressure in expiration, mmHg', (c) => f(c.m.wedgeExp)],
    ['LV end-diastolic pressure in expiration, mmHg', (c) => f(c.m.lvedpExp)],
    ['RV end-diastolic pressure in expiration, mmHg', (c) => f(c.m.rvedpExp)],
    ['LV minus RV end-diastolic pressure, expiration → inspiration, mmHg', (c) => `${f(c.m.lvRvExp)} → ${f(c.m.lvRvInsp)}`],
    ['LV end-diastolic volume in inspiration', (c) => `${f(pct(c.m.lvEdvExp, c.m.lvEdvInsp))}%`],
    ['RV end-diastolic volume in inspiration', (c) => `${f(pct(c.m.rvEdvExp, c.m.rvEdvInsp))}%`],
  ];
  let token = 0;
  function table() {
    const my = ++token, ids = CASE_LIST.map(([id]) => id), out = {};
    $('#pc-table thead').innerHTML = `<tr><th></th>${CASE_LIST.map(([, l]) => `<th class="num">${l}</th>`).join('')}</tr>`;
    const draw = () => {
      $('#pc-table tbody').innerHTML = ROWS.map(([label, fn]) => `<tr><td>${label}</td>${ids.map((id) => `<td class="num">${out[id] ? fn(out[id]) : '…'}</td>`).join('')}</tr>`).join('');
    };
    draw();
    let i = 0;
    const next = () => {
      if (my !== token || i >= ids.length) return;
      out[ids[i]] = compute(ids[i], S.breath); i++; draw(); setTimeout(next, 0);
    };
    setTimeout(next, 0);
  }

  show(); table();
}
