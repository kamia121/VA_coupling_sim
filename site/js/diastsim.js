// Diastolic lab page: one patient of the chosen grade, live (PV loop, monitor numbers and the Doppler
// echocardiogram as volume, afterload and rhythm change), and the virtual cohort (precomputed by
// tools/diastolic_cohort.mjs) for fluid, afterload and AF tolerance and the fluid-then-diuresis course.
import { simulate, NORMAL } from './engine.js';
import { GRADES, MV_AREA, CUT, LAP_WET, SURGE, COURSE, solveCond, readout, condParams } from './diastcore.js';
import { COHORT } from './diastdata.js';
import { drawPlot, niceMax, swatch } from './plot.js';
import { ecgWave } from './ecgwave.js';
import { addExport, header, even } from './export.js';

const $ = (s) => document.querySelector(s);
const GCOL = ['var(--g0)', 'var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)'];
const ROMAN = GRADES.map((g) => g.roman);
const st = { g: 2, vol: 0, svrX: 1, surge: false, rhythm: 'sinus', afRate: 110, base: [], cur: null, curSol: null, timer: null };

// ---------- live patient ----------
function baseline(g) {
  if (!st.base[g]) {
    const sol = solveCond(GRADES[g].params, {});
    st.base[g] = { sol, o: readout(sol) };
  }
  return st.base[g];
}
function cond() {
  const c = {};
  if (st.vol) c.vol = st.vol;
  if (st.svrX !== 1 || st.surge) { c.svrX = st.svrX; if (st.surge) c.recruit = SURGE.recruit; }
  if (st.rhythm === 'af') { c.rhythm = 'af'; c.afRate = st.afRate; }
  return c;
}
function solveNow() {
  const b = baseline(st.g), c = cond();
  st.curSol = Object.keys(c).length ? solveCond(GRADES[st.g].params, c, { state: b.sol.r.state, slow: b.sol.r.slow }) : b.sol;
  st.cur = readout(st.curSol);
}
function update() {
  clearTimeout(st.timer);
  $('#live-status').textContent = 'Solving…';
  st.timer = setTimeout(() => { solveNow(); drawLive(); $('#live-status').textContent = ''; }, 30);
}

const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '–'), f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '–'), f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '–');
const sgn = (v, f = f1) => (v >= 0 ? '+' : '−') + f(Math.abs(v));

function tiles() {
  const o = st.cur, b = baseline(st.g).o;
  const T = [
    ['Cardiac output', f1(o.CO), 'L/min', o.CO - b.CO, false],
    ['Stroke volume', f0(o.SV), 'mL', o.SV - b.SV, false],
    ['Heart rate', f0(o.HR), '/min', o.HR - b.HR, false],
    ['MAP', f0(o.MAP), 'mmHg', o.MAP - b.MAP, o.MAP < 65],
    ['LA pressure (PAWP)', f0(o.LAP), 'mmHg', o.LAP - b.LAP, o.LAP > LAP_WET],
    ['LVEDP', f0(o.EDP), 'mmHg', o.EDP - b.EDP, o.EDP > 16],
    ['Mean PA pressure', f0(o.mPAP), 'mmHg', o.mPAP - b.mPAP, o.mPAP > 20],
    ['RA pressure', f0(o.RAP), 'mmHg', o.RAP - b.RAP, o.RAP > 12],
  ];
  $('#tiles').innerHTML = T.map(([k, v, u, d, off]) => `<div class="tile${off ? ' off' : ''}"><div class="tile-v">${v}</div>
    <div class="tile-k">${k} <span>${u}${Math.abs(d) >= 0.05 ? ` · ${sgn(d, Math.abs(d) < 10 ? f1 : f0)}` : ''}</span></div></div>`).join('');
}

function loopPts(r) {
  const out = [];
  for (let i = 0; i < r.rec.Vlv.length; i += 4) out.push([r.rec.Vlv[i], r.rec.Plv[i]]);
  out.push(out[0]);
  return out;
}
function edpvr(p, vmax) {
  const out = [];
  for (let v = p.lvV0; v <= vmax; v += 2) out.push([v, p.lvA * (Math.exp(p.lvBeta * (v - p.lvV0)) - 1)]);
  return out;
}
const NORM = simulate({ mvArea: MV_AREA });
function drawLoop() {
  const svg = $('#pv'), r = st.curSol.r, b = baseline(st.g).sol.r;
  const W = Math.max(300, Math.min(560, svg.parentElement.clientWidth || 460)), H = Math.round(W * 0.75);
  const xmax = niceMax(Math.max(r.lv.EDV, b.lv.EDV, NORM.lv.EDV) * 1.15);
  const ymax = niceMax(Math.max(...r.rec.Plv, ...b.rec.Plv, ...NORM.rec.Plv) * 1.08);
  drawPlot(svg, {
    width: W, height: H, xTicks: 5, yTicks: 5, title: 'LV pressure–volume loop',
    x: { min: 0, max: xmax, label: 'LV volume (mL)' }, y: { min: 0, max: ymax, label: 'LV pressure (mmHg)' },
    series: [
      { points: edpvr(NORM.params, xmax), color: 'var(--series-ref)', width: 1, dash: '3 3' },
      { points: loopPts(NORM), color: 'var(--series-ref)', width: 1.4 },
      { points: edpvr(r.params, xmax), color: 'var(--series-current)', width: 1, dash: '3 3' },
      ...(st.curSol === baseline(st.g).sol ? [] : [{ points: loopPts(b), color: 'var(--series-snap)', width: 1.4, dash: '5 4' }]),
      { points: loopPts(r), color: 'var(--series-current)', width: 2.4 },
    ],
    annotations: [{ x: xmax * 0.97, y: ymax * 0.93, anchor: 'end', color: 'var(--text)', text: `EDP ${f0(st.cur.EDP)} mmHg · EF ${f0(st.cur.EF * 100)}%` }],
  });
}

// ---------- echo screens ----------
// A sweep of beats (two in sinus rhythm; the irregular run in AF), resampled to the screen width.
function sweep() {
  const beats = st.curSol.beats.length > 1 ? st.curSol.beats.slice(1, 6) : [st.curSol.r, st.curSol.r];
  const T = beats.reduce((a, b) => a + b.T, 0);
  return { beats, T };
}
function sample(sw, n, fn) {
  // fn(beat, index) -> value; returns n samples over the sweep plus ECG phase info
  const out = new Array(n), ph = new Array(n), Ts = new Array(n);
  let t0 = 0, k = 0;
  for (const b of sw.beats) {
    const m = b.rec.t.length, end = t0 + b.T;
    for (; k < n && (k / n) * sw.T < end; k++) {
      const t = (k / n) * sw.T - t0, i = Math.min(m - 1, Math.floor(t / b.dt));
      out[k] = fn(b, i); ph[k] = t; Ts[k] = b.T;
    }
    t0 = end;
  }
  for (; k < n; k++) { out[k] = out[k - 1]; ph[k] = ph[k - 1]; Ts[k] = Ts[k - 1]; }
  return { v: out, ph, Ts };
}
function rand(i) { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }
let off = null;
function screen(id, aspect = 0.4) {
  let c, w, dpr = 1;
  if (off) ({ c, w } = off);
  else {
    c = document.getElementById(id);
    const cs = getComputedStyle(c.parentElement);
    w = Math.floor(Math.min(820, c.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    dpr = window.devicePixelRatio || 1;
  }
  const h = Math.round(w * (w < 520 ? 0.62 : aspect));
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  return { c, g, w, h };
}
// Spectral display: velocity (cm/s) above (+) and below (−) a baseline, with a bright modal envelope.
function spectrum(g, x0, pw, yb, pxPerCm, v) {
  for (let i = 0; i < pw; i++) {
    const d = v[i] * pxPerCm, dir = d >= 0 ? -1 : 1, len = Math.abs(d);
    if (len < 1) continue;
    for (let y = 0; y < len; y += 1.5) {
      const f = y / len, a = f > 0.7 ? 0.5 + 0.5 * rand(i * 31 + y) : 0.1 + 0.15 * rand(i * 17 + y);
      g.fillStyle = `rgba(225,240,236,${a})`; g.fillRect(x0 + i, yb + dir * y - (dir < 0 ? 1.5 : 0), 1, 1.5);
    }
  }
}
function axes(g, x0, pw, yb, pxPerCm, lo, hi, step, label) {
  g.strokeStyle = '#3B4E48'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0 + pw, yb); g.stroke();
  g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
  for (let v = lo; v <= hi + 1e-9; v += step) { const y = yb - v * pxPerCm; g.fillText(String(v), x0 - 6, y + 4); g.fillRect(x0 - 4, y, 4, 1); }
  g.textAlign = 'left'; g.fillText(label, 6, 14);
}
function ecgRow(g, x0, pw, y, s) {
  g.strokeStyle = '#7CE38B'; g.lineWidth = 1.3; g.beginPath();
  const pr = st.rhythm === 'af' ? 0 : 0.16;
  for (let i = 0; i < pw; i++) { const d = ecgWave(s.ph[i], s.Ts[i], pr) * 0.9; i ? g.lineTo(x0 + i, y - d) : g.moveTo(x0 + i, y - d); }
  g.stroke();
}
function mark(g, x, y, text, above = true) {
  g.fillStyle = '#E8B962'; g.font = '600 12px system-ui'; g.textAlign = 'center';
  g.fillText(text, x, above ? y - 6 : y + 16);
}
function peakIdx(v, from, to, sign = 1) {
  let k = -1, m = 0;
  for (let i = from; i < to; i++) if (sign * v[i] > m) { m = sign * v[i]; k = i; }
  return k;
}

function drawMitral() {
  const { g, w, h } = screen('scr-mv');
  const x0 = 40, pw = w - x0 - 10, yb = h - 44, top = 26, vmax = 140, px = (yb - top) / vmax;
  // In AF, a beat that follows a short one starts while the LV is still filling. The model then shows a
  // brief jump in mitral flow at the QRS, because its AV-plane descent term resets its reference volume
  // at each QRS; the display holds the first 40 ms of such a beat to the flow at the end of the one before.
  const sw = sweep(), endQ = new Map(sw.beats.map((b, k) => [b, k ? sw.beats[k - 1].rec.Qmv.at(-1) : Infinity]));
  const s = sample(sw, pw, (b, i) => (b.rec.t[i] < 0.04 ? Math.min(b.rec.Qmv[i], endQ.get(b)) : b.rec.Qmv[i]) / MV_AREA);
  axes(g, x0, pw, yb, px, 0, vmax, 20, 'Mitral inflow, PW at the leaflet tips (cm/s)');
  spectrum(g, x0, pw, yb, px, s.v);
  ecgRow(g, x0, pw, h - 14, s);
  // label E and A in the first beat: the first peak after a flow-free interval is E, and in sinus rhythm the last peak before the next QRS is A
  const b0 = sw.beats[0], n0 = Math.round(b0.T / sw.T * pw);
  const aOn = sample({ beats: [b0], T: b0.T }, n0, (b, i) => b.rec.aAct[i]).v;
  const iE = peakIdx(s.v.map((v, i) => (i < n0 && aOn[i] < 0.02 && s.ph[i] > b0.tEs ? v : 0)), 0, n0);
  if (iE >= 0) mark(g, x0 + iE, yb - s.v[iE] * px, 'E');
  if (st.rhythm !== 'af') { const iA = peakIdx(s.v.map((v, i) => (i < n0 && aOn[i] >= 0.02 ? v : 0)), 0, n0); if (iA >= 0 && s.v[iA] > 5) mark(g, x0 + iA, yb - s.v[iA] * px, 'A'); }
}
// Lateral annular tissue Doppler. The shape of each wave follows the model (s′ with aortic flow, e′ and a′
// with early and atrial mitral flow); the e′ peak is scaled from τ and a′ from the atrial filling volume.
function drawTDI() {
  const { g, w, h } = screen('scr-tdi');
  const x0 = 40, pw = w - x0 - 10, yb = 26 + (h - 70) * 0.45, vmax = 16, px = (h - 70) * 0.5 / vmax;
  const e = st.cur.echo, sw = sweep();
  const shape = (b) => {
    const { Qao, aAct, t } = b.rec, Qmv = b.rec.Qmv.map((q, i) => (t[i] < 0.04 ? 0 : q));   // see drawMitral
    const qa = Math.max(...Qao), eMax = Math.max(1, ...Qmv.map((q, i) => (aAct[i] < 0.02 ? q : 0))), aMax = Math.max(1, ...Qmv.map((q, i) => (aAct[i] >= 0.02 ? q : 0)));
    const sp = 9 * Math.sqrt(b.lv.fwdSV / NORM.lv.fwdSV);
    return (i) => (Qao[i] > 0 ? sp * Qao[i] / qa : 0) - (aAct[i] < 0.02 ? e.ep * Qmv[i] / eMax : (e.ap || 0) * Qmv[i] / aMax);
  };
  const cache = new Map();
  const s = sample(sw, pw, (b, i) => { if (!cache.has(b)) cache.set(b, shape(b)); return cache.get(b)(i); });
  axes(g, x0, pw, yb, px, -vmax, vmax, 8, 'Lateral mitral annulus, tissue Doppler (cm/s)');
  spectrum(g, x0, pw, yb, px, s.v);
  ecgRow(g, x0, pw, h - 14, s);
  const n0 = Math.round(sw.beats[0].T / sw.T * pw);
  const iS = peakIdx(s.v, 0, n0, 1), iE = peakIdx(s.v, 0, Math.round(n0 * 0.8), -1);
  if (iS >= 0) mark(g, x0 + iS, yb - s.v[iS] * px, 's′');
  if (iE >= 0) mark(g, x0 + iE, yb - s.v[iE] * px, 'e′', false);
  if (st.rhythm !== 'af') { const iA = peakIdx(s.v, Math.round(n0 * 0.8), n0, -1); if (iA >= 0 && s.v[iA] < -1) mark(g, x0 + iA, yb - s.v[iA] * px, 'a′', false); }
}
// Pulmonary venous flow into the LA: systolic (S) and diastolic (D) forward waves, atrial reversal (Ar).
const PV_AREA = (() => { let m = 0; const r = NORM; for (let i = 0; i < r.rec.t.length; i++) m = Math.max(m, (r.rec.Ppv[i] - r.rec.Pla[i]) / r.params.rPvLa); return m / 55; })();
function drawPV() {
  const { g, w, h } = screen('scr-pv');
  const x0 = 40, pw = w - x0 - 10, top = 26, yb = top + (h - 70) * 0.72, vmax = 80, px = (yb - top) / vmax;
  const sw = sweep(), s = sample(sw, pw, (b, i) => (b.rec.Ppv[i] - b.rec.Pla[i]) / b.params.rPvLa / PV_AREA);
  axes(g, x0, pw, yb, px, -20, vmax, 20, 'Pulmonary vein, PW (cm/s)');
  spectrum(g, x0, pw, yb, px, s.v.map((v) => Math.max(-40, Math.min(vmax, v))));
  ecgRow(g, x0, pw, h - 14, s);
  const b0 = sw.beats[0], n0 = Math.round(b0.T / sw.T * pw), nS = Math.round((b0.tEs + 0.12) / sw.T * pw);
  const iS = peakIdx(s.v, 0, nS), iD = peakIdx(s.v, nS, n0);
  if (iS >= 0) mark(g, x0 + iS, yb - s.v[iS] * px, 'S');
  if (iD >= 0) mark(g, x0 + iD, yb - s.v[iD] * px, 'D');
  if (st.rhythm !== 'af') { const iR = peakIdx(s.v, Math.round(n0 * 0.75), n0, -1); if (iR >= 0 && s.v[iR] < -3) mark(g, x0 + iR, yb - s.v[iR] * px, 'Ar', false); }
}

function echoTable() {
  const e = st.cur.echo, af = st.rhythm === 'af';
  const rows = [
    ['E velocity', `${f0(e.E)} cm/s`, null],
    ['A velocity', af ? 'none (AF)' : `${f0(e.A)} cm/s`, null],
    ['E/A', af ? '–' : f2(e.EA), af ? null : e.EA <= CUT.EA_low ? 'low' : e.EA >= CUT.EA_high ? 'high' : null],
    ['Deceleration time', Number.isFinite(e.DT) ? `${f0(e.DT)} ms` : 'E–A fused', null],
    ['IVRT', `${f0(e.IVRT)} ms`, null],
    ['Lateral e′', `${f1(e.ep)} cm/s`, e.ep < CUT.ep ? `< ${CUT.ep}` : null],
    ['Lateral E/e′', f1(e.Eep), e.Eep > CUT.Eep ? `> ${CUT.Eep}` : null],
    ['Peak TR velocity', `${f2(e.TRv)} m/s`, e.TRv > CUT.TR ? `> ${CUT.TR}` : null],
    ['LA volume index', `${f0(e.LAVI)} mL/m²`, e.LAVI > CUT.LAVI ? `> ${CUT.LAVI}` : null],
    ['Pulmonary vein S/D', f2(e.SD), e.SD < 1 ? '< 1' : null],
  ];
  const verdict = af
    ? (e.lapHigh ? 'In AF the pattern cannot be graded; two or more supporting criteria point to a raised LA pressure.' : 'In AF the pattern cannot be graded; the supporting criteria do not point to a raised LA pressure.')
    : e.grade === 0 ? 'Normal diastolic function.' : e.grade === 1 ? 'Grade I: impaired relaxation, normal LA pressure.'
      : e.grade === 2 ? 'Grade II: raised LA pressure (pseudonormal).' : 'Grade III: restrictive filling, raised LA pressure.';
  $('#echo-table').innerHTML = `<table class="data metrics"><tbody>${rows.map(([k, v, fl]) => `<tr class="${fl ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}${fl ? ' *' : ''}</td></tr>`).join('')}
    <tr class="key"><td>E/e′ estimate of PAWP (1.24·E/e′ + 1.9)</td><td class="num">${f0(e.pcwpNagueh)} mmHg</td></tr>
    <tr class="key"><td>Model mean LA pressure</td><td class="num">${f0(st.cur.LAP)} mmHg</td></tr></tbody></table>
    <p class="interp"><b>Echo algorithm reads:</b> ${verdict}</p>`;
}

function drawLive() {
  tiles(); drawLoop(); drawMitral(); drawTDI(); drawPV(); echoTable();
  const c = cond(), q = condParams(GRADES[st.g].params, c);
  $('#vol-v').textContent = `${st.vol > 0 ? '+' : st.vol < 0 ? '−' : ''}${Math.abs(st.vol)} mL (stressed ${sgn(0.4 * st.vol, f0)} mL)`;
  $('#svr-v').textContent = `× ${st.svrX.toFixed(2)} (SVR ${f0((q.svr ?? NORMAL.svr) * 1333.22)} dyn·s·cm⁻⁵)`;
  $('#af-v').textContent = `${st.afRate}/min`;
  $('#af-row').hidden = st.rhythm !== 'af';
  $('#grade-text').innerHTML = `<p>${GRADES[st.g].text}</p>`;
  history.replaceState(null, '', `#grade=${st.g}`);
}

// ---------- cohort ----------
const F = Object.fromEntries(COHORT.fields.map((k, i) => [k, i]));
const condIdx = (kind, x) => COHORT.conds.findIndex(([k, v]) => k === kind && v === x);
const xs = (kind) => COHORT.conds.filter(([k]) => k === kind).map(([, x]) => x).sort((a, b) => a - b);
function quant(a, q) { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); }
// Median and IQR across the cohort of a grade, for one field along one protocol, as y = f(row, baseRow)
function stats(g, kind, f) {
  const pts = COHORT.grades[g].patients, b = condIdx('volume', 0);
  return xs(kind).map((x) => {
    const nan = (r) => r.map((v) => v ?? NaN);
    const j = condIdx(kind, x), vals = pts.map((p) => f(nan(p.rows[j]), nan(p.rows[b])));
    // a median over the few patients who could be simulated there would be biased: show it only if most could
    if (vals.filter(Number.isFinite).length < 0.75 * vals.length) return { x, med: NaN, lo: NaN, hi: NaN };
    return { x, med: quant(vals, 0.5), lo: quant(vals, 0.25), hi: quant(vals, 0.75) };
  });
}
function legendHTML() {
  return GRADES.map((g, i) => `<span>${swatch(GCOL[i], null, 3)}${g.short}</span>`).join('');
}
// Direct labels at the right end of each line, pushed apart so they do not overlap (min gap in y units).
function spread(labels, gap) {
  const L = labels.map((l, i) => ({ ...l, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < L.length; k++) if (L[k].y - L[k - 1].y < gap) L[k].y = L[k - 1].y + gap;
  return L.sort((a, b) => a.i - b.i);
}
// Line chart of median ± IQR for each grade, with direct labels and a hover readout.
function cohortChart(id, { kind, f, xl, yl, ref, xfmt = (v) => v, yfmt = (v) => v.toFixed(1), unit = '' }) {
  const svg = document.getElementById(id);
  const S = GRADES.map((_, g) => stats(g, kind, f).filter((p) => Number.isFinite(p.med)));
  const all = S.flat(), X = xs(kind);
  let ymin = Math.min(...all.map((s) => s.lo), ref ?? Infinity), ymax = Math.max(...all.map((s) => s.hi), ref ?? -Infinity);
  const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad;
  if (ymin > 0 && ymin < (ymax - ymin) * 0.6) ymin = 0;
  const W = Math.max(300, Math.min(560, svg.parentElement.clientWidth || 460)), H = Math.round(W * 0.66);
  const xr = [X[0], X[X.length - 1]], xpad = (xr[1] - xr[0]) * 0.07;
  const plot = drawPlot(svg, {
    width: W, height: H, xTicks: 5, yTicks: 5, title: `${yl} against ${xl}`,
    x: { min: xr[0], max: xr[1] + xpad, label: xl }, y: { min: ymin, max: ymax, label: yl },
    series: [
      ...(ref != null ? [{ points: [[xr[0], ref], [xr[1], ref]], color: 'var(--flag)', width: 1, dash: '3 3' }] : []),
      ...S.map((s, g) => ({ points: [...s.map((p) => [p.x, p.hi]), ...s.slice().reverse().map((p) => [p.x, p.lo])], color: 'none', fill: GCOL[g], closed: true, opacity: 0.14 })),
      ...S.map((s, g) => ({ points: s.map((p) => [p.x, p.med]), color: GCOL[g], width: 2 })),
    ],
    annotations: spread(S.map((s, g) => ({ x: xr[1], y: s[s.length - 1].med, dx: 5, dy: 4, text: ROMAN[g], color: 'var(--text-muted)' })), (ymax - ymin) * 0.045),
  });
  hover(svg, plot, X, (x) => `<b>${xfmt(x)}</b>${S.map((s, g) => { const p = s.find((q) => q.x === x); if (!p) return `<div>${swatch(GCOL[g], null, 3)}${GRADES[g].short}: not simulated</div>`; return `<div>${swatch(GCOL[g], null, 3)}${GRADES[g].short}: ${yfmt(p.med)}${unit} <span class="status">(${yfmt(p.lo)}–${yfmt(p.hi)})</span></div>`; }).join('')}`);
}
// Crosshair and tooltip at the nearest protocol step.
function hover(svg, plot, X, html) {
  const fig = svg.parentElement;
  let tip = fig.querySelector('.tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; fig.append(tip); fig.style.position = 'relative'; }
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 't-cursor'); line.style.stroke = 'var(--axis)'; line.style.display = 'none';
  svg.append(line);
  const vb = svg.viewBox.baseVal;
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * vb.width;
    const xv = plot.ix(px);
    const x = X.reduce((a, b) => (Math.abs(b - xv) < Math.abs(a - xv) ? b : a));
    const sx = plot.sx(x);
    line.setAttribute('x1', sx); line.setAttribute('x2', sx); line.setAttribute('y1', 12); line.setAttribute('y2', vb.height - 44); line.style.display = '';
    tip.innerHTML = html(x); tip.hidden = false;
    const left = sx / vb.width * r.width;
    tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12))}px`;
    tip.style.top = '8px';
  };
  svg.onpointermove = move; svg.onpointerdown = move;
  svg.onpointerleave = () => { tip.hidden = true; line.style.display = 'none'; };
}

// Volume window of every patient (thin) and the grade medians (thick), on the volume axis.
function drawWindows() {
  const svg = $('#c-window');
  const W = Math.max(320, Math.min(1000, svg.parentElement.clientWidth || 600)), H = Math.round(W * 0.42);
  const series = [], ann = [];
  GRADES.forEach((gr, g) => {
    const pts = COHORT.grades[g].patients.filter((p) => !p.ref), n = pts.length;
    pts.forEach((p, k) => {
      const y = 4 - g + 0.25 - 0.55 * (k / Math.max(1, n - 1));
      if (p.tol.window > 0) series.push({ points: [[p.tol.winLo, y], [p.tol.winHi, y]], color: GCOL[g], width: 1, opacity: 0.5 });
      else series.push({ points: [[0, y]], color: 'var(--flag)', marker: 1.6 });
    });
    const lo = quant(pts.map((p) => (p.tol.window > 0 ? p.tol.winLo : NaN)), 0.5), hi = quant(pts.map((p) => (p.tol.window > 0 ? p.tol.winHi : NaN)), 0.5);
    if (Number.isFinite(lo)) series.push({ points: [[lo, 4 - g], [hi, 4 - g]], color: GCOL[g], width: 5 });
    const none = pts.filter((p) => !(p.tol.window > 0)).length;
    ann.push({ x: -2000, y: 4 - g + 0.42, dx: 4, dy: 0, text: `${gr.short}${none ? ` · ${none}/${n} no window` : ''}`, color: 'var(--text-muted)' });
  });
  const plot = drawPlot(svg, {
    width: W, height: H, xTicks: 8, yTicks: 1, title: 'Volume window of each patient',
    x: { min: -2000, max: 2000, label: 'Intravascular volume change from the patient as found (mL)' }, y: { min: -0.5, max: 4.7, label: '' },
    series: [{ points: [[0, -0.5], [0, 4.7]], color: 'var(--axis)', width: 1, dash: '2 3' }, ...series], annotations: ann,
  });
  svg.querySelectorAll('text').forEach((t) => { if (/^-?\d+(\.\d+)?$/.test(t.textContent) && +t.getAttribute('x') < 60) t.textContent = ''; });
  void plot;
}

// Summary table: median [IQR] by grade.
function summaryTable() {
  const rows = [
    ['LA pressure as found (mmHg)', (t) => t.LAP, 1], ['Cardiac output as found (L/min)', (t) => t.CO, 2],
    ['Volume window (mL)', (t) => t.window, 0], ['Volume to LAP 18 mmHg (mL)', (t) => t.toWet, 0],
    ['LAP rise with 1 L of fluid (mmHg)', (t) => t.lap1000, 1], ['CO gain with 500 mL (L/min)', (t) => t.co500, 2],
    ['LAP fall with 1 L removed (mmHg)', (t) => t.lapDiur, 1], ['CO change with 1 L removed (L/min)', (t) => t.coDiur, 2],
    ['LAP rise, SVR × 1.5 (mmHg)', (t) => t.aftLAP, 1], ['SV change, SVR × 1.5 (%)', (t) => t.aftSVpct, 0],
    ['LAP rise, sympathetic surge (mmHg)', (t) => t.surgeLAP, 1],
    ['CO change, AF at 70/min (%)', (t) => t.af70CO, 0], ['CO change, AF at 130/min (%)', (t) => t.af130CO, 0],
    ['LAP change, AF at 130/min (mmHg)', (t) => t.af130LAP, 1],
  ];
  const cell = (g, f, d) => {
    const v = COHORT.grades[g].patients.filter((p) => !p.ref).map((p) => f(p.tol));
    const q = [0.5, 0.25, 0.75].map((x) => quant(v, x));
    return `<td class="num">${q[0].toFixed(d)} <span class="status">[${q[1].toFixed(d)}, ${q[2].toFixed(d)}]</span></td>`;
  };
  $('#c-table').innerHTML = `<table class="data metrics"><thead><tr><th></th>${GRADES.map((g) => `<th class="num">${g.short}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([k, f, d]) => `<tr><td>${k}</td>${GRADES.map((_, g) => cell(g, f, d)).join('')}</tr>`).join('')}</tbody></table>`;
}

// How the ASE algorithm, applied to each virtual patient's echo, grades the patients of each true grade.
function confusion() {
  const j = condIdx('volume', 0), jd = condIdx('volume', -1500);
  const count = (idx) => GRADES.map((_, g) => {
    const c = [0, 0, 0, 0, 0];
    for (const p of COHORT.grades[g].patients.filter((q) => !q.ref)) { const e = p.rows[idx][F.echoGrade]; if (e != null) c[e]++; else c[4]++; }
    return c;
  });
  const tbl = (m, cap) => `<div class="table-wrap"><table class="data metrics"><caption class="status">${cap}</caption><thead><tr><th>Model grade</th>${['Normal', 'Grade I', 'Grade II', 'Grade III', 'Not simulated'].map((x) => `<th class="num">${x}</th>`).join('')}</tr></thead>
    <tbody>${m.map((c, g) => `<tr><td>${GRADES[g].short}</td>${c.map((v) => `<td class="num">${v || '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#c-conf').innerHTML = tbl(count(j), 'As found') + tbl(count(jd), 'After 1.5 L removed (the model’s stand-in for the Valsalva test of reversibility)');
}

// Fluid, then diuresis: the reference patient of each grade over five hours.
function courseChart(id, k, yl, ref, yfmt = (v) => v.toFixed(1)) {
  const svg = document.getElementById(id);
  const W = Math.max(300, Math.min(560, svg.parentElement.clientWidth || 460)), H = Math.round(W * 0.62);
  const C = COHORT.grades.map((g) => g.course);
  const vals = C.flat().map((r) => r[k]).filter(Number.isFinite);
  let ymin = Math.min(...vals, ref ?? Infinity), ymax = Math.max(...vals, ref ?? -Infinity);
  const pad = (ymax - ymin) * 0.1; ymin = Math.max(0, ymin - pad); ymax += pad;
  const tEnd = COURSE.end, fl = COURSE.boluses * 15, d0 = COURSE.diureseAt, d1 = d0 + COURSE.diureseFor;
  const plot = drawPlot(svg, {
    width: W, height: H, xTicks: 6, yTicks: 5, title: `${yl} over time`,
    x: { min: 0, max: tEnd + 20, label: 'Minutes' }, y: { min: ymin, max: ymax, label: yl },
    series: [
      { points: [[0, ymin], [fl, ymin], [fl, ymax], [0, ymax]], color: 'none', fill: 'var(--surface-2)', closed: true },
      { points: [[d0, ymin], [d1, ymin], [d1, ymax], [d0, ymax]], color: 'none', fill: 'var(--flag-bg)', closed: true },
      ...(ref != null ? [{ points: [[0, ref], [tEnd, ref]], color: 'var(--flag)', width: 1, dash: '3 3' }] : []),
      ...C.map((c, g) => ({ points: c.filter((r) => Number.isFinite(r[k])).map((r) => [r.t, r[k]]), color: GCOL[g], width: 2 })),
    ],
    annotations: [
      { x: fl / 2, y: ymax, dy: 14, anchor: 'middle', text: '1 L fluid' },
      { x: (d0 + d1) / 2, y: ymax, dy: 14, anchor: 'middle', text: `Diuresis ${COURSE.diureseRate} mL/h` },
      ...spread(C.map((c, g) => { const last = c.filter((r) => Number.isFinite(r[k])).pop(); return { x: last.t, y: last[k], dx: 5, dy: 4, text: ROMAN[g], color: 'var(--text-muted)' }; }), (ymax - ymin) * 0.045),
    ],
  });
  const T = C[0].map((r) => r.t);
  hover(svg, plot, T, (t) => `<b>${t} min</b>${C.map((c, g) => { const r = c.find((q) => q.t === t); if (!Number.isFinite(r[k] ?? NaN)) return `<div>${swatch(GCOL[g], null, 3)}${GRADES[g].short}: not simulated (stressed volume too low)</div>`; return `<div>${swatch(GCOL[g], null, 3)}${GRADES[g].short}: ${yfmt(r[k])} <span class="status">(net ${r.vol >= 0 ? '+' : '−'}${Math.abs(r.vol).toFixed(0)} mL)</span></div>`; }).join('')}`);
}

function drawCohort() {
  const pct = (a, b) => (a / b - 1) * 100;
  document.querySelectorAll('.g-legend').forEach((el) => { el.innerHTML = legendHTML(); });
  cohortChart('c-lap-vol', { kind: 'volume', f: (r) => r[F.LAP], xl: 'Volume given (+) or removed (−), mL', yl: 'LA pressure (mmHg)', ref: LAP_WET, xfmt: (x) => `${x > 0 ? '+' : ''}${x} mL`, unit: ' mmHg' });
  cohortChart('c-co-vol', { kind: 'volume', f: (r) => r[F.CO], xl: 'Volume given (+) or removed (−), mL', yl: 'Cardiac output (L/min)', xfmt: (x) => `${x > 0 ? '+' : ''}${x} mL`, yfmt: (v) => v.toFixed(2), unit: ' L/min' });
  cohortChart('c-lap-svr', { kind: 'afterload', f: (r, b) => r[F.LAP] - b[F.LAP], xl: 'SVR, multiple of baseline', yl: 'Change in LA pressure (mmHg)', xfmt: (x) => `SVR × ${x}`, unit: ' mmHg' });
  cohortChart('c-sv-svr', { kind: 'afterload', f: (r, b) => pct(r[F.SV], b[F.SV]), xl: 'SVR, multiple of baseline', yl: 'Change in stroke volume (%)', xfmt: (x) => `SVR × ${x}`, yfmt: (v) => v.toFixed(0), unit: '%' });
  cohortChart('c-co-af', { kind: 'af', f: (r, b) => pct(r[F.CO], b[F.CO]), xl: 'Ventricular rate in AF (/min)', yl: 'Change in cardiac output from sinus (%)', xfmt: (x) => `AF ${x}/min`, yfmt: (v) => v.toFixed(0), unit: '%' });
  cohortChart('c-lap-af', { kind: 'af', f: (r, b) => r[F.LAP] - b[F.LAP], xl: 'Ventricular rate in AF (/min)', yl: 'Change in LA pressure from sinus (mmHg)', xfmt: (x) => `AF ${x}/min`, unit: ' mmHg' });
  drawWindows(); summaryTable(); confusion();
  courseChart('t-lap', 'LAP', 'LA pressure (mmHg)', LAP_WET);
  courseChart('t-co', 'CO', 'Cardiac output (L/min)', null, (v) => v.toFixed(2));
  courseChart('t-ea', 'EA', 'Mitral E/A', 2, (v) => v.toFixed(2));
  $('#c-n').textContent = COHORT.N;
}

// CSV of the whole cohort, one row per patient per condition.
function downloadCSV() {
  const head = ['id', 'grade', 'protocol', 'x', ...COHORT.fields];
  const lines = [head.join(',')];
  COHORT.grades.forEach((gr) => gr.patients.forEach((p) => p.rows.forEach((r, j) => {
    const [k, x] = COHORT.conds[j];
    lines.push([p.id, gr.g, k, x, ...r.map((v) => (v == null ? 'NA' : v))].join(','));
  })));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  a.download = 'diastolic_cohort.csv'; document.body.append(a); a.click(); a.remove();
}

// ---------- export: the three echo screens as one slide ----------
function echoSpec() {
  const g = GRADES[st.g], c = cond();
  const what = [st.vol ? `${st.vol > 0 ? '+' : ''}${st.vol} mL` : '', st.svrX !== 1 ? `SVR × ${st.svrX}` : '', st.surge ? 'sympathetic surge' : '', st.rhythm === 'af' ? `AF ${st.afRate}/min` : ''].filter(Boolean).join(', ') || 'as found';
  const e = st.cur.echo;
  return {
    file: `va-coupling-diastolic-${g.key}`,
    title: `Diastolic function · ${g.short} · ${what}`,
    caption: `Model-generated mitral inflow, lateral annular tissue Doppler and pulmonary venous flow for ${g.label.toLowerCase()} (${what}). E ${f0(e.E)} cm/s${st.rhythm === 'af' ? '' : `, A ${f0(e.A)} cm/s, E/A ${f2(e.EA)}`}, DT ${Number.isFinite(e.DT) ? f0(e.DT) + ' ms' : 'not measurable'}, lateral e′ ${f1(e.ep)} cm/s, E/e′ ${f1(e.Eep)}; model LA pressure ${f0(st.cur.LAP)} mmHg.`,
    notes: `Cardiac output ${f1(st.cur.CO)} L/min, MAP ${f0(st.cur.MAP)} mmHg, LVEDP ${f0(st.cur.EDP)} mmHg, mPAP ${f0(st.cur.mPAP)} mmHg. e′ is scaled from the fitted τ, not simulated. Conditions: ${JSON.stringify(c)}.`,
    async prepare() {
      const W = 1100, top = 56, cvs = ['mv', 'tdi', 'pv'].map(() => document.createElement('canvas'));
      const draw = [drawMitral, drawTDI, drawPV];
      let y = top;
      const hs = cvs.map((cv, i) => { off = { c: cv, w: W }; draw[i](); off = null; return cv.height; });
      const H = even(top + hs.reduce((a, b) => a + b + 6, 0));
      return {
        W, H, duration: 1,
        async frame(gx) {
          gx.fillStyle = '#05090A'; gx.fillRect(0, 0, W, H);
          header(gx, W, `${g.short} · ${what}`, 'model-generated');
          y = top; cvs.forEach((cv, i) => { gx.drawImage(cv, 0, y); y += hs[i] + 6; });
        },
      };
    },
  };
}

// ---------- controls ----------
export function initDiastolic() {
  $('#grades').innerHTML = GRADES.map((g) => `<button type="button" data-g="${g.id}" aria-pressed="false">${g.short}</button>`).join('');
  const syncGrade = () => $('#grades').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === st.g)));
  $('#grades').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.g = +b.dataset.g; syncGrade(); update(); });
  const vol = $('#vol'), svr = $('#svr'), afr = $('#afrate');
  vol.addEventListener('input', () => { st.vol = +vol.value; update(); });
  svr.addEventListener('input', () => { st.svrX = +svr.value; update(); });
  afr.addEventListener('input', () => { st.afRate = +afr.value; update(); });
  $('#surge').addEventListener('change', (e) => { st.surge = e.target.checked; update(); });
  $('#rhythm').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st.rhythm = b.dataset.v; $('#rhythm').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); update();
  });
  $('#quick').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dv]'); if (!b) return;
    st.vol = Math.max(-2000, Math.min(2000, st.vol + +b.dataset.dv)); vol.value = st.vol; update();
  });
  $('#reset').addEventListener('click', () => {
    Object.assign(st, { vol: 0, svrX: 1, surge: false, rhythm: 'sinus' });
    vol.value = 0; svr.value = 1; $('#surge').checked = false;
    $('#rhythm').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === 'sinus')));
    update();
  });
  $('#csv').addEventListener('click', downloadCSV);
  addExport($('#echo-panel'), echoSpec, { still: true });
  const m = /grade=(\d)/.exec(location.hash);
  if (m) st.g = Math.min(4, +m[1]);
  syncGrade();
  solveNow(); drawLive(); drawCohort();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawLive(); drawCohort(); }, 200); });
  document.addEventListener('themechange', () => { drawLive(); drawCohort(); });
}

export const _diast = { st, solveNow, cond };
