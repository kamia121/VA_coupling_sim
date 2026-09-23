// Interfaces page: Guyton venous-return figure and the DO2–VO2 figure, both computed from the model,
// and the bedside calculators (arithmetic only).
import { simulate } from './engine.js';
import { oxygen, O2 } from './oxygen.js';
import { drawPlot, swatch } from './plot.js';
import { SHOCK_BY } from './shockcore.js';

const $ = (id) => document.getElementById(id);
const CUR = 'var(--series-current)', REF = 'var(--series-ref)', SNAP = 'var(--series-snap)', FLAG = 'var(--flag)';

// Cardiac function curves (CO against RAP as stressed volume is swept, reflex off so the heart is
// fixed) and venous return lines (VR = (Pmsf − RAP)/Rvr) through three operating points.
export function guyton() {
  const cs = SHOCK_BY.cardiogenic.params;
  const sweep = (p) => [300, 450, 600, 750, 900, 1050, 1200, 1400].map((v) => simulate({ ...p, vStressed: v, baro: 0 }))
    .map((r) => [r.hemo.RAP, r.hemo.CO]);
  const pts = [['Stressed volume −200 mL', 505], ['Normal', 705], ['Stressed volume +300 mL', 1005]].map(([name, v]) => {
    const r = simulate({ vStressed: v, baro: 0 });
    return { name, rap: r.hemo.RAP, co: r.hemo.CO, pmsf: r.hemo.Pmsf, rvr: r.hemo.Rvr };
  });
  const heart = { lvEes: cs.lvEes, lvV0: cs.lvV0, lvBeta: cs.lvBeta, kFFR: 0 };
  const cs0 = simulate({ ...heart, baro: 0 });
  return { normal: sweep({}), failing: sweep(heart), pts,
    fail: { rap: cs0.hemo.RAP, co: cs0.hemo.CO, pmsf: cs0.hemo.Pmsf } };
}

function drawGuyton(g) {
  const svg = $('fig-guyton'); if (!svg) return;
  const W = Math.max(320, Math.min(640, svg.parentElement.clientWidth || 560)), H = Math.round(W * 0.66);
  const vr = (p, dash, color) => ({ points: [[0, p.pmsf / p.rvr * 60 / 1000], [p.pmsf, 0]], color, width: 1.6, dash });
  drawPlot(svg, {
    width: W, height: H, title: 'Venous return and cardiac function curves',
    x: { min: 0, max: 16, label: 'Right atrial pressure (mmHg)' }, y: { min: 0, max: 12, label: 'Flow (L/min)' },
    series: [
      { points: g.normal, color: CUR, width: 2.4 },
      { points: g.failing, color: SNAP, width: 2.4 },
      vr(g.pts[0], '5 4', REF), vr(g.pts[1], '', REF), vr(g.pts[2], '5 4', REF),
      { points: g.pts.map((p) => [p.rap, p.co]), color: CUR, marker: 5 },
      { points: [[g.fail.rap, g.fail.co]], color: SNAP, marker: 5 },
    ],
    annotations: g.pts.map((p) => ({ x: p.pmsf, y: 0.3, text: `${p.pmsf.toFixed(1)}`, anchor: 'middle', color: 'var(--text-muted)' })),
  });
  $('lg-guyton').innerHTML = `<span>${swatch(CUR, '', 2.4)}Normal heart</span><span>${swatch(SNAP, '', 2.4)}Heart of the cardiogenic shock case</span><span>${swatch(REF, '', 1.6)}Venous return, normal volume</span><span>${swatch(REF, '5 4', 1.6)}Venous return, −200 and +300 mL</span>`;
}

function drawO2() {
  const svg = $('fig-o2'), svg2 = $('fig-svo2'); if (!svg || !svg2) return;
  const W = Math.max(300, Math.min(420, svg.parentElement.clientWidth || 380)), H = Math.round(W * 0.75);
  const vo2 = [], sv = [];
  for (let co = 1.2; co <= 8; co += 0.05) { const o = oxygen(co); vo2.push([o.do2, o.vo2]); sv.push([o.do2, o.svo2 * 100]); }
  const crit = oxygen(5.56).do2crit, x = { min: 0, max: 1200, label: 'O₂ delivery (mL/min)' };
  const line = (ymax) => ({ points: [[crit, 0], [crit, ymax]], color: FLAG, width: 1, dash: '3 3' });
  drawPlot(svg, {
    width: W, height: H, xTicks: 4, title: 'Oxygen consumption against delivery', x, y: { min: 0, max: 300, label: 'VO₂ (mL/min)' },
    series: [line(300), { points: vo2, color: CUR, width: 2.4 }],
    annotations: [{ x: crit + 12, y: 30, text: `critical DO₂ ${crit.toFixed(0)}`, color: FLAG }],
  });
  drawPlot(svg2, {
    width: W, height: H, xTicks: 4, title: 'ScvO₂ against delivery', x, y: { min: 0, max: 100, label: 'ScvO₂ (%)' },
    series: [line(100), { points: sv, color: SNAP, width: 2.4 }],
  });
}

// ---------- calculators ----------
const row = (k, v, note = '', flag = false) => `<tr class="${flag ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}${flag ? ' *' : ''}</td><td class="status">${note}</td></tr>`;

export function calc(v) {
  const map = v.map > 0 ? v.map : (v.sbp + 2 * v.dbp) / 3;
  const lvot = Math.PI * (v.lvotd / 2) ** 2;
  const sv = v.vti * lvot;
  const co = v.co > 0 ? v.co : sv * v.hr / 1000;
  const cao2 = 1.34 * v.hb * v.sao2 / 100 + 0.003 * v.pao2;
  const cvo2 = 1.34 * v.hb * v.scvo2 / 100;
  const do2 = co * cao2 * 10, vo2 = co * (cao2 - cvo2) * 10;
  return {
    map, si: v.hr / v.sbp, pp: map - v.cvp, sv, co, ea: 0.9 * v.sbp / sv,
    cao2, cvo2, do2, vo2, er: (cao2 - cvo2) / cao2, gap: v.pcvco2 - v.paco2,
    tp: v.tapse / v.pasp, vrg: v.pmsf > 0 ? v.pmsf - v.cvp : null, rvr: v.pmsf > 0 ? (v.pmsf - v.cvp) / co : null,
  };
}

const IDS = ['c-hr', 'c-sbp', 'c-dbp', 'c-map', 'c-cvp', 'c-lvotd', 'c-vti', 'c-co', 'c-hb', 'c-sao2', 'c-pao2', 'c-scvo2', 'c-pcvco2', 'c-paco2', 'c-tapse', 'c-pasp', 'c-pmsf'];
function initCalc() {
  const box = $('calc-out'); if (!box) return;
  const read = () => Object.fromEntries(IDS.map((id) => [id.slice(2), parseFloat($(id).value) || 0]));
  const paint = () => {
    const v = read(), r = calc(v), f0 = (x) => x.toFixed(0), f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
    const bad = !(v.sbp > v.dbp) || !(v.vti > 0 && v.lvotd > 0) || !(v.pasp > 0);
    box.innerHTML = (bad ? '<p class="note caution">SBP must exceed DBP, and VTI, LVOT diameter and PASP must be positive.</p>' : '') + `<div class="table-wrap"><table class="data metrics"><tbody>${[
      row('MAP', `${f0(r.map)} mmHg`, v.map > 0 ? 'measured' : '(SBP + 2·DBP)/3', r.map < 65),
      row('Shock index', f2(r.si), 'HR/SBP'),
      row('MAP − CVP', `${f0(r.pp)} mmHg`, 'perfusion pressure'),
      row('Stroke volume', `${f0(r.sv)} mL`, 'VTI × LVOT area'),
      row('LVOT VTI', `${f0(v.vti)} cm`, '', v.vti < 18),
      row('Cardiac output', `${f1(r.co)} L/min`, v.co > 0 ? 'entered' : 'SV × HR'),
      row('Ea ≈ 0.9·SBP/SV', `${f2(r.ea)} mmHg/mL`),
      row('CaO₂ / CcvO₂', `${f1(r.cao2)} / ${f1(r.cvo2)} mL/dL`),
      row('DO₂', `${f0(r.do2)} mL/min`, 'CO × CaO₂ × 10'),
      row('VO₂ (Fick, central venous)', `${f0(r.vo2)} mL/min`, 'CO × (CaO₂ − CcvO₂) × 10'),
      row('O₂ extraction', f2(r.er), '(CaO₂ − CcvO₂)/CaO₂'),
      row('PCO₂ gap', `${f1(r.gap)} mmHg`, 'PcvCO₂ − PaCO₂', r.gap > 6),
      row('CVP', `${f0(v.cvp)} mmHg`, '', v.cvp > 12),
      row('TAPSE/PASP', `${f2(r.tp)} mm/mmHg`, '', r.tp < 0.31),
      ...(r.vrg != null ? [row('Pmsf − CVP', `${f1(r.vrg)} mmHg`, 'venous return gradient'), row('Resistance to venous return', `${f1(r.rvr)} mmHg·min/L`, '(Pmsf − CVP)/CO')] : []),
    ].join('')}</tbody></table></div><p class="status">* Beyond the threshold cited in the text. A starred value describes one interface and is not a treatment target.</p>`;
  };
  IDS.forEach((id) => $(id).addEventListener('input', paint));
  paint();
}

export function initInterfaces() {
  const g = guyton();
  const all = () => { drawGuyton(g); drawO2(); };
  all();
  initCalc();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(all, 200); });
}

export { O2 };
