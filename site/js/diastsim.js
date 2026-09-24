// Diastolic lab, two pages that can be open side by side.
//   diastolic.html (text): concept figures, the grade table and the predict-then-test questions.
//   diastolic-sim.html (simulator): one patient of the chosen grade, live (PV loop, values, bedside
//   consequences and the Doppler echocardiogram), and the virtual cohort (precomputed by
//   tools/diastolic_cohort.mjs) with the fluid-then-diuresis course.
// The text page sends a question's case to an open simulator window on a BroadcastChannel; when none
// answers, the link opens the simulator in a named window with the case in the URL hash.
import { simulate, NORMAL, pvRelations } from './engine.js';
import { GRADES, MV_AREA, CUT, LAP_WET, SURGE, SBT, COURSE, BSA, CONSEQ, solveCond, readout, condParams, consequences } from './diastcore.js';
import { QUESTIONS } from './diastquiz.js';
import { COHORT } from './diastdata.js';
import { drawPlot, niceMax, swatch } from './plot.js';
import { ecgWave } from './ecgwave.js';
import { addExport, header, even } from './export.js';

const $ = (s) => document.querySelector(s);
const GCOL = ['var(--g0)', 'var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)'];
const ROMAN = GRADES.map((g) => g.roman);
const st = { g: 2, vol: 0, svrX: 1, surge: false, sbt: false, rhythm: 'sinus', afRate: 110, base: [], cur: null, curSol: null, timer: null };

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
  if (st.sbt) c.sbt = 1;
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
    ['CO', 'Cardiac output', f1(o.CO), 'L/min', o.CO - b.CO, false],
    ['SV', 'Stroke volume', f0(o.SV), 'mL', o.SV - b.SV, false],
    ['HR', 'Heart rate', f0(o.HR), '/min', o.HR - b.HR, false],
    ['MAP', 'Mean arterial pressure', f0(o.MAP), 'mmHg', o.MAP - b.MAP, o.MAP < 65],
    ['LAP', 'LA pressure (PAWP)', f0(o.LAP), 'mmHg', o.LAP - b.LAP, o.LAP > LAP_WET],
    ['LVEDP', 'LV end-diastolic pressure', f0(o.EDP), 'mmHg', o.EDP - b.EDP, o.EDP > 16],
    ['mPAP', 'Mean PA pressure', f0(o.mPAP), 'mmHg', o.mPAP - b.mPAP, o.mPAP > 20],
    ['RAP', 'RA pressure', f0(o.RAP), 'mmHg', o.RAP - b.RAP, o.RAP > 12],
  ];
  // compact tiles for the bar that stays at the top of the screen; the full name is in the tooltip
  $('#tiles').innerHTML = T.map(([k, name, v, u, d, off]) => `<div class="tile${off ? ' off' : ''}" title="${name}${off ? ' (outside the usual range)' : ''}">
    <div class="tile-k">${k} <span>${u}</span></div><div class="tile-v">${v}</div>
    <div class="tile-d">${Math.abs(d) >= 0.05 ? sgn(d, Math.abs(d) < 10 ? f1 : f0) : '&nbsp;'}</div></div>`).join('');
  // what has been done to the patient, since the controls scroll out of view
  const parts = [st.vol ? `${st.vol > 0 ? '+' : '−'}${Math.abs(st.vol)} mL` : '', st.svrX !== 1 ? `SVR × ${st.svrX.toFixed(2)}` : '',
    st.surge ? 'surge' : '', st.sbt ? 'breathing trial' : '', st.rhythm === 'af' ? `AF ${st.afRate}/min` : ''].filter(Boolean);
  $('#cond-sum').innerHTML = parts.length ? `Now: ${parts.join(' · ')}<span class="g-long"> · change from as found below each value</span>` : 'As found';
}

function loopPts(r) {
  const out = [];
  for (let i = 0; i < r.rec.Vlv.length; i += 4) out.push([r.rec.Vlv[i], r.rec.Plv[i]]);
  out.push(out[0]);
  return out;
}
// The chamber EDPVR (septum and pericardium included), so the end of filling lies on it.
function edpvr(r, vmax) { return pvRelations(r, 'lv', vmax).edpvr; }
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
      { points: edpvr(NORM, xmax), color: 'var(--series-ref)', width: 1, dash: '3 3' },
      { points: loopPts(NORM), color: 'var(--series-ref)', width: 1.4 },
      { points: edpvr(r, xmax), color: 'var(--series-current)', width: 1, dash: '3 3' },
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
// Tissue Doppler: the annulus moves as one solid body at low velocity with a strong echo, so the spectrum
// is a narrow bright band that traces the velocity, with no fill between it and the baseline. The band
// joins adjacent columns so the fast upstrokes stay continuous, and a little clutter sits at the baseline.
function tdiSpectrum(g, x0, pw, yb, pxPerCm, v) {
  for (let i = 0; i < pw; i++) {
    const a = v[Math.max(0, i - 1)], b = v[i];
    const w = (0.7 + 0.06 * Math.abs(b)) * pxPerCm;           // narrow spectral width, a little wider at speed
    const top = yb - Math.max(a, b) * pxPerCm - w, bot = yb - Math.min(a, b) * pxPerCm + w;
    for (let y = top; y < bot; y += 1) {
      const edge = Math.min(y - top, bot - y) / w;               // brightest in the middle of the band
      const al = Math.min(1, 0.35 + 0.65 * Math.min(1, edge)) * (0.65 + 0.35 * rand(i * 29 + Math.round(y)));
      g.fillStyle = `rgba(232,244,240,${al.toFixed(3)})`; g.fillRect(x0 + i, y, 1, 1);
    }
    if (rand(i * 7) > 0.55) { g.fillStyle = 'rgba(200,220,215,0.25)'; g.fillRect(x0 + i, yb + (rand(i * 5) - 0.5) * 1.6 * pxPerCm, 1, 1); }
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
  const sw = sweep();
  const s = sample(sw, pw, (b, i) => b.rec.Qmv[i] / MV_AREA);
  axes(g, x0, pw, yb, px, 0, vmax, 20, 'Mitral inflow, PW at the leaflet tips (cm/s)');
  spectrum(g, x0, pw, yb, px, s.v);
  ecgRow(g, x0, pw, h - 14, s);
  // label E and A in the first beat: the first peak after a flow-free interval is E, and in sinus rhythm the last peak before the next QRS is A
  const b0 = sw.beats[0], n0 = Math.round(b0.T / sw.T * pw);
  const aOn = sample({ beats: [b0], T: b0.T }, n0, (b, i) => b.rec.aAct[i]).v;
  const iE = peakIdx(s.v.map((v, i) => (i < n0 && aOn[i] < 0.02 && s.ph[i] > b0.tEs ? v : 0)), 0, n0);
  // when E and A are merged into one wave, the single peak is labeled E+A
  const merged = st.cur?.echo?.merged;
  if (iE >= 0 && !merged) mark(g, x0 + iE, yb - s.v[iE] * px, 'E');
  if (st.rhythm !== 'af') { const iA = peakIdx(s.v.map((v, i) => (i < n0 && aOn[i] >= 0.02 ? v : 0)), 0, n0); if (iA >= 0 && s.v[iA] > 5) mark(g, x0 + iA, yb - s.v[iA] * px, merged ? 'E+A' : 'A'); }
}
// Lateral annular tissue Doppler. The shape of each wave follows the model (s′ with aortic flow, e′ and a′
// with early and atrial mitral flow); the e′ peak is scaled from τ and a′ from the atrial filling volume.
function drawTDI() {
  const { g, w, h } = screen('scr-tdi');
  const x0 = 40, pw = w - x0 - 10, yb = 26 + (h - 70) * 0.45, vmax = 16, px = (h - 70) * 0.5 / vmax;
  const e = st.cur.echo, sw = sweep();
  const shape = (b) => {
    const { Qao, Qmv, aAct } = b.rec;
    const qa = Math.max(...Qao), eMax = Math.max(1, ...Qmv.map((q, i) => (aAct[i] < 0.02 ? q : 0))), aMax = Math.max(1, ...Qmv.map((q, i) => (aAct[i] >= 0.02 ? q : 0)));
    const sp = 9 * Math.sqrt(b.lv.fwdSV / NORM.lv.fwdSV);
    return (i) => (Qao[i] > 0 ? sp * Qao[i] / qa : 0) - (aAct[i] < 0.02 ? e.ep * Qmv[i] / eMax : (e.ap || 0) * Qmv[i] / aMax);
  };
  const cache = new Map();
  const s = sample(sw, pw, (b, i) => { if (!cache.has(b)) cache.set(b, shape(b)); return cache.get(b)(i); });
  axes(g, x0, pw, yb, px, -vmax, vmax, 8, 'Lateral mitral annulus, tissue Doppler (cm/s)');
  tdiSpectrum(g, x0, pw, yb, px, s.v);
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
    ['E/A', af ? '–' : e.merged ? 'E and A merged' : f2(e.EA), af || e.merged ? null : e.EA <= CUT.EA_low ? 'low' : e.EA >= CUT.EA_high ? 'high' : null],
    ['E velocity at A onset', af ? '–' : `${f0(e.EatA)} cm/s`, null],
    ['Deceleration time', Number.isFinite(e.DT) ? `${f0(e.DT)} ms` : 'E–A fused', null],
    ['IVRT', `${f0(e.IVRT)} ms`, null],
    ['Lateral e′', `${f1(e.ep)} cm/s`, e.ep < CUT.ep ? `< ${CUT.ep}` : null],
    ['Lateral E/e′', f1(e.Eep), e.Eep > CUT.Eep ? `> ${CUT.Eep}` : null],
    ['Peak TR velocity', `${f2(e.TRv)} m/s`, e.TRv > CUT.TR ? `> ${CUT.TR}` : null],
    ['LA volume index', `${f0(e.LAVI)} mL/m²`, e.LAVI > CUT.LAVI ? `> ${CUT.LAVI}` : null],
    ['Pulmonary vein S/D', f2(e.SD), e.SD < 1 ? '< 1' : null],
  ];
  const why = af ? 'In AF the pattern cannot be graded' : 'With E and A merged into one wave, the pattern cannot be graded by E/A';
  const verdict = af || e.merged
    ? `${why}; ${e.lapHigh ? 'two or more supporting criteria are consistent with a raised LA pressure.' : 'the supporting criteria are not consistent with a raised LA pressure.'}`
    : e.grade === 0 ? 'Normal diastolic function.' : e.grade === 1 ? 'Grade I: impaired relaxation, normal LA pressure.'
      : e.grade === 2 ? 'Grade II: raised LA pressure (pseudonormal).' : 'Grade III: restrictive filling, raised LA pressure.';
  $('#echo-table').innerHTML = `<table class="data metrics"><tbody>${rows.map(([k, v, fl]) => `<tr class="${fl ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}${fl ? ' *' : ''}</td></tr>`).join('')}
    <tr class="key"><td>E/e′ estimate of PAWP (1.24·E/e′ + 1.9)</td><td class="num">${f0(e.pcwpNagueh)} mmHg</td></tr>
    <tr class="key"><td>Model mean LA pressure</td><td class="num">${f0(st.cur.LAP)} mmHg</td></tr></tbody></table>
    <p class="interp"><b>ASE/EACVI 2016 algorithm:</b> ${verdict}${!af && !e.merged && e.fused ? ' A includes early inflow still running at the onset of atrial contraction (E–A fusion).' : ''}</p>`;
}

// Bedside consequences of the current state, shown under the values in the bar at the top.
function conseqChips() {
  const c = consequences(st.cur), icon = ['✓', '!', '!!'];
  $('#conseq').innerHTML = `<span class="cq cq-sub" title="Forrester hemodynamic subset (cardiac index 2.2, PAWP 18)">${c.subset}</span>` +
    c.items.map((x) => `<span class="cq cq-l${x.level}"><span class="cq-i" aria-hidden="true">${icon[x.level]}</span>${x.label}: ${x.text}</span>`).join('');
}
function drawLive() {
  tiles(); conseqChips(); drawLoop(); drawMitral(); drawTDI(); drawPV(); echoTable();
  const c = cond(), q = condParams(GRADES[st.g].params, c);
  $('#vol-v').textContent = `${st.vol > 0 ? '+' : st.vol < 0 ? '−' : ''}${Math.abs(st.vol)} mL (stressed ${sgn(0.4 * st.vol, f0)} mL)`;
  $('#svr-v').textContent = `× ${st.svrX.toFixed(2)} (SVR ${f0((q.svr ?? NORMAL.svr) * 1333.22)} dyn·s·cm⁻⁵)`;
  $('#af-v').textContent = `${st.afRate}/min`;
  $('#af-row').hidden = st.rhythm !== 'af';
  $('#grade-text').innerHTML = `<p>${GRADES[st.g].text}</p>`;
  history.replaceState(null, '', `#${setupHash({ g: st.g, vol: st.vol, svrX: st.svrX, surge: st.surge, sbt: st.sbt, rhythm: st.rhythm, afRate: st.afRate })}`);
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
    const c = [0, 0, 0, 0, 0, 0];
    for (const p of COHORT.grades[g].patients.filter((q) => !q.ref)) { const e = p.rows[idx][F.echoGrade]; if (e != null) c[e]++; else c[p.rows[idx][F.LAP] == null ? 5 : 4]++; }
    return c;
  });
  const tbl = (m, cap) => `<div class="table-wrap"><table class="data metrics"><caption class="status">${cap}</caption><thead><tr><th>Model grade</th>${['Normal', 'Grade I', 'Grade II', 'Grade III', 'Not graded', 'Not simulated'].map((x) => `<th class="num">${x}</th>`).join('')}</tr></thead>
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
  const what = [st.vol ? `${st.vol > 0 ? '+' : ''}${st.vol} mL` : '', st.svrX !== 1 ? `SVR × ${st.svrX}` : '', st.surge ? 'sympathetic surge' : '', st.sbt ? 'spontaneous breathing trial' : '', st.rhythm === 'af' ? `AF ${st.afRate}/min` : ''].filter(Boolean).join(', ') || 'as found';
  const e = st.cur.echo;
  return {
    file: `va-coupling-diastolic-${g.key}`,
    title: `Diastolic function · ${g.short} · ${what}`,
    caption: `Model-generated mitral inflow, lateral annular tissue Doppler and pulmonary venous flow for ${g.label.toLowerCase()} (${what}). E ${f0(e.E)} cm/s${st.rhythm === 'af' ? '' : e.merged ? ', E and A merged' : `, A ${f0(e.A)} cm/s, E/A ${f2(e.EA)}`}, DT ${Number.isFinite(e.DT) ? f0(e.DT) + ' ms' : 'not measurable'}, lateral e′ ${f1(e.ep)} cm/s, E/e′ ${f1(e.Eep)}; model LA pressure ${f0(st.cur.LAP)} mmHg.`,
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

// ---------- concepts ----------
// The in-vivo EDPVR of each grade: end-diastolic volume and pressure of the reference patient as volume
// is removed or given (the volume protocol), so it includes the pericardium and the septum.
function drawEDPVR() {
  const svg = $('#c-edpvr'), vi = condIdx('volume', 0), v1 = condIdx('volume', 1000);
  const W = Math.max(300, Math.min(760, svg.parentElement.clientWidth || 600)), H = Math.round(W * 0.55);
  const curves = COHORT.grades.map((gr) => {
    const ref = gr.patients.find((p) => p.ref);
    return xs('volume').filter((x) => x <= 2000).map((x) => ref.rows[condIdx('volume', x)]).filter((r) => r[F.EDV] != null).map((r) => [r[F.EDV], r[F.EDP]]);
  });
  const refs = COHORT.grades.map((gr) => gr.patients.find((p) => p.ref).rows);
  const xmax = niceMax(Math.max(...curves.flat().map((p) => p[0])) * 1.05), ymax = Math.min(50, niceMax(Math.max(...curves.flat().map((p) => p[1]))));
  drawPlot(svg, {
    width: W, height: H, xTicks: 6, yTicks: 5, title: 'End-diastolic pressure–volume relation of each grade',
    x: { min: 40, max: xmax, label: 'LV end-diastolic volume (mL)' }, y: { min: 0, max: ymax, label: 'LV end-diastolic pressure (mmHg)' },
    series: [
      ...curves.map((c, g) => ({ points: c, color: GCOL[g], width: 2 })),
      ...refs.map((r, g) => ({ points: [[r[vi][F.EDV], r[vi][F.EDP]]], color: GCOL[g], marker: 5 })),
      ...refs.map((r, g) => ({ points: [[r[v1][F.EDV], r[v1][F.EDP]]], color: 'var(--surface)', marker: 4 })),
    ],
    annotations: [
      ...refs.map((r, g) => ({ x: r[v1][F.EDV], y: r[v1][F.EDP], dx: 8, dy: 4, text: `${ROMAN[g]}: ${f0(r[vi][F.EDP])} → ${f0(r[v1][F.EDP])} mmHg`, color: 'var(--text-muted)' })),
    ],
  });
  // open markers: redraw with a colored ring (drawPlot fills markers with the series color)
  svg.querySelectorAll('circle').forEach((c) => { if (c.style.fill.includes('surface')) c.style.strokeWidth = '2'; });
  const rings = [...svg.querySelectorAll('circle')].filter((c) => c.style.fill.includes('surface'));
  rings.forEach((c, g) => { c.style.stroke = GCOL[g]; });
}
// One mitral inflow beat per grade, at the same scale.
function drawMinis() {
  const box = $('#minis');
  if (!box.children.length) box.innerHTML = GRADES.map((g) => `<div class="mini"><canvas id="mini-${g.id}" role="img" aria-label="Mitral inflow, ${g.short}"></canvas><div class="mini-k"></div></div>`).join('');
  GRADES.forEach((gr, g) => {
    const c = document.getElementById(`mini-${g}`), r = baseline(g).sol.r, e = baseline(g).o.echo;
    const w = Math.floor(c.parentElement.clientWidth || 160), h = Math.round(w * 0.62), dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const gx = c.getContext('2d'); gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.fillStyle = '#05090A'; gx.fillRect(0, 0, w, h);
    const yb = h - 8, px = (h - 26) / 140, n = w - 8, m = r.rec.t.length;
    const v = Array.from({ length: n }, (_, i) => r.rec.Qmv[Math.floor(i / n * m)] / MV_AREA);
    spectrum(gx, 4, n, yb, px, v);
    gx.fillStyle = '#D5E2DE'; gx.font = '600 12px system-ui'; gx.textAlign = 'left'; gx.fillText(gr.short, 6, 15);
    c.nextElementSibling.textContent = `E/A ${f2(e.EA)} · DT ${Number.isFinite(e.DT) ? f0(e.DT) + ' ms' : '–'} · e′ ${f1(e.ep)}`;
  });
}
function gradeTable() {
  const win = (g) => quant(COHORT.grades[g].patients.filter((p) => !p.ref).map((p) => p.tol.window), 0.5);
  const cols = [
    ['τ (ms)', (o) => f0(o.echo.tauMs), () => false],
    ['LAP (mmHg)', (o) => f0(o.LAP), (o) => o.LAP > LAP_WET],
    ['E/A', (o) => f2(o.echo.EA), (o) => o.echo.EA <= CUT.EA_low || o.echo.EA >= CUT.EA_high],
    ['DT (ms)', (o) => f0(o.echo.DT), () => false],
    ['IVRT (ms)', (o) => f0(o.echo.IVRT), () => false],
    ['e′ (cm/s)', (o) => f1(o.echo.ep), (o) => o.echo.ep < CUT.ep],
    ['E/e′', (o) => f1(o.echo.Eep), (o) => o.echo.Eep > CUT.Eep],
    ['LAVI', (o) => f0(o.echo.LAVI), (o) => o.echo.LAVI > CUT.LAVI],
    ['TR (m/s)', (o) => f2(o.echo.TRv), (o) => o.echo.TRv > CUT.TR],
    ['PV S/D', (o) => f2(o.echo.SD), (o) => o.echo.SD < 1],
    ['ASE grade', (o) => ['Normal', 'I', 'II', 'III'][o.echo.grade] ?? '–', () => false],
    ['Volume window', (o, g) => `${f0(win(g))} mL`, () => false],
  ];
  $('#grade-table').innerHTML = `<table class="data metrics"><thead><tr><th></th>${cols.map(([k]) => `<th class="num">${k}</th>`).join('')}</tr></thead><tbody>${
    GRADES.map((gr, g) => { const o = baseline(g).o; return `<tr><td>${gr.short}</td>${cols.map(([, f, fl]) => `<td class="num${fl(o) ? ' flagged' : ''}">${f(o, g)}${fl(o) ? ' *' : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
}

// ---------- predict, then test ----------
const quiz = { i: 0, picked: {} };
function quizNav() {
  $('#quiz-nav').innerHTML = QUESTIONS.map((q, i) => `<button type="button" data-q="${i}" aria-pressed="${i === quiz.i}" title="${q.topic}">${i + 1}${quiz.picked[q.id] ? (quiz.picked[q.id].ok ? ' ✓' : ' ✗') : ''}</button>`).join('');
}
function quizCard() {
  const q = QUESTIONS[quiz.i], p = quiz.picked[q.id];
  $('#quiz-card').innerHTML = `<p class="k">${q.topic} · question ${quiz.i + 1} of ${QUESTIONS.length}</p>
    <p class="quiz-q">${q.prompt}</p>
    <div class="quiz-choices">${q.choices.map(([k, t]) => `<button type="button" class="give quiz-c${p ? (k === p.key ? ' right' : k === p.pick ? ' wrong' : '') : ''}" data-k="${k}"${p ? ' disabled' : ''}>${t}${p && k === p.key ? '<small>correct</small>' : p && k === p.pick ? '<small>your answer</small>' : ''}</button>`).join('')}</div>
    ${p ? `<div class="interp quiz-a"><p><b>${p.ok ? 'Correct.' : 'Not quite.'}</b> ${p.explain}</p></div>
      <div class="btn-row"><a class="btn primary" id="quiz-show" href="${SIM_URL}#${setupHash(q.setup)}" target="${SIM_WIN}">Show this case in the simulator</a>${quiz.i < QUESTIONS.length - 1 ? '<button type="button" class="btn" id="quiz-next">Next question</button>' : ''}</div>` : ''}`;
}
// A case as a URL hash (g=3&vol=500&svr=1.5&surge=1&rhythm=af&rate=130) and back.
function setupHash(su) {
  const q = [`g=${su.g}`];
  if (su.vol) q.push(`vol=${su.vol}`);
  if (su.svrX && su.svrX !== 1) q.push(`svr=${su.svrX}`);
  if (su.surge) q.push('surge=1');
  if (su.sbt) q.push('sbt=1');
  if (su.rhythm === 'af') q.push('rhythm=af', `rate=${su.afRate ?? 110}`);
  return q.join('&');
}
function parseHash(h) {
  const m = Object.fromEntries(h.replace(/^#/, '').split('&').filter(Boolean).map((kv) => kv.split('=')));
  const g = m.g ?? m.grade;
  if (g == null) return null;
  return { g: Math.max(0, Math.min(4, +g || 0)), vol: +m.vol || 0, svrX: +m.svr || 1, surge: m.surge === '1', sbt: m.sbt === '1',
    rhythm: m.rhythm === 'af' ? 'af' : 'sinus', afRate: +m.rate || 110 };
}
function applySetup(su) {
  Object.assign(st, { g: su.g, vol: su.vol ?? 0, svrX: su.svrX ?? 1, surge: !!su.surge, sbt: !!su.sbt, rhythm: su.rhythm ?? 'sinus', afRate: su.afRate ?? 110 });
  $('#vol').value = st.vol; $('#svr').value = st.svrX; $('#afrate').value = st.afRate; $('#surge').checked = st.surge; $('#sbt').checked = st.sbt;
  $('#rhythm').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === st.rhythm)));
  $('#grades').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === st.g)));
  update();
}
// The two pages talk on one channel. The simulator announces itself every 2 s; the text page sends a case
// to it when it has heard from it recently, and otherwise lets the link open the simulator.
const SIM_URL = 'diastolic-sim.html', SIM_WIN = 'vac-dia-sim';
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vac-diastolic') : null;
let simSeen = 0;
function initQuiz() {
  if (channel) channel.addEventListener('message', (e) => { if (e.data?.type === 'sim-here') simSeen = Date.now(); });
  $('#quiz-nav').addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (!b) return; quiz.i = +b.dataset.q; quizNav(); quizCard(); });
  $('#quiz-card').addEventListener('click', (e) => {
    const q = QUESTIONS[quiz.i];
    const c = e.target.closest('button[data-k]');
    if (c && !quiz.picked[q.id]) {
      $('#quiz-card').insertAdjacentHTML('beforeend', '<p class="status">Running the model…</p>');
      setTimeout(() => { const r = q.run(); quiz.picked[q.id] = { pick: c.dataset.k, key: r.key, ok: c.dataset.k === r.key, explain: r.explain }; quizNav(); quizCard(); }, 20);
    }
    // an open simulator window takes the case on the channel; otherwise the link opens one
    if (e.target.closest('#quiz-show') && channel && Date.now() - simSeen < 5000) { e.preventDefault(); channel.postMessage({ type: 'setup', setup: q.setup }); }
    if (e.target.closest('#quiz-next')) { quiz.i++; quizNav(); quizCard(); }
  });
  quizNav(); quizCard();
}

// ---------- clinical consequences across the cohort ----------
const CQ = [
  ['wet', `Congested (PAWP > ${CONSEQ.wet})`, (r) => r[F.LAP] > CONSEQ.wet],
  ['edema', `Alveolar edema range (PAWP > ${CONSEQ.edema})`, (r) => r[F.LAP] > CONSEQ.edema],
  ['cold', `Low output (CI < ${CONSEQ.ci})`, (r) => r[F.CO] / BSA < CONSEQ.ci],
  ['hypo', `Hypotensive (MAP < ${CONSEQ.map})`, (r) => r[F.MAP] < CONSEQ.map],
];
const CQ_ROWS = [['As found', 'volume', 0], ['+500 mL', 'volume', 500], ['+1 L', 'volume', 1000], ['+2 L', 'volume', 2000], ['−1 L', 'volume', -1000], ['−1.5 L', 'volume', -1500],
  ['SVR × 1.5', 'afterload', 1.5], ['Sympathetic surge', 'surge', 1], ['AF 110/min', 'af', 110], ['AF 130/min', 'af', 130]];
let cqPick = 'wet';
function cqTable() {
  const [, , f] = CQ.find(([k]) => k === cqPick);
  const cell = (g, kind, x) => {
    const j = condIdx(kind, x), pts = COHORT.grades[g].patients.filter((p) => !p.ref), ok = pts.filter((p) => p.rows[j][F.LAP] != null);
    if (ok.length < 0.75 * pts.length) return '<td class="num">–</td>';
    const pc = Math.round(100 * ok.filter((p) => f(p.rows[j])).length / ok.length);
    return `<td class="num${pc >= 50 ? ' flagged' : ''}">${pc}%</td>`;
  };
  $('#cq-pick').innerHTML = CQ.map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${k === cqPick}">${t}</button>`).join('');
  $('#cq-table').innerHTML = `<table class="data metrics"><thead><tr><th></th>${GRADES.map((g) => `<th class="num">${g.short}</th>`).join('')}</tr></thead><tbody>${
    CQ_ROWS.map(([t, kind, x]) => `<tr><td>${t}</td>${GRADES.map((_, g) => cell(g, kind, x)).join('')}</tr>`).join('')}</tbody></table>`;
}

// ---------- controls ----------
// Text page: concept figures, the grade table and the questions.
export function initDiastolicText() {
  document.querySelectorAll('.g-legend').forEach((el) => { el.innerHTML = legendHTML(); });
  drawEDPVR(); initQuiz();
  // the reference beat of every grade, for the mitral strips and the table (about a second of model time)
  setTimeout(() => { drawMinis(); gradeTable(); }, 50);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawEDPVR(); drawMinis(); }, 200); });
  document.addEventListener('themechange', () => { drawEDPVR(); drawMinis(); });
}

// Simulator page: the live patient and the cohort.
export function initDiastolicSim() {
  // on phones the buttons show only the numeral (0, I–IV) so the bar fits on one line
  $('#grades').innerHTML = GRADES.map((g) => `<button type="button" data-g="${g.id}" aria-pressed="false" aria-label="${g.short}"><span class="g-long">${g.short}</span><span class="g-short" aria-hidden="true">${g.roman}</span></button>`).join('');
  const syncGrade = () => $('#grades').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === st.g)));
  $('#grades').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.g = +b.dataset.g; syncGrade(); update(); });
  const vol = $('#vol'), svr = $('#svr'), afr = $('#afrate');
  vol.addEventListener('input', () => { st.vol = +vol.value; update(); });
  svr.addEventListener('input', () => { st.svrX = +svr.value; update(); });
  afr.addEventListener('input', () => { st.afRate = +afr.value; update(); });
  $('#surge').addEventListener('change', (e) => { st.surge = e.target.checked; update(); });
  $('#sbt-t').textContent = `Spontaneous breathing trial: venous return rises (${SBT.recruit} mL into the stressed volume), sinus rate ${SBT.hr}/min, SVR × ${SBT.svrX}`;
  $('#sbt').addEventListener('change', (e) => { st.sbt = e.target.checked; update(); });
  $('#rhythm').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st.rhythm = b.dataset.v; $('#rhythm').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); update();
  });
  $('#quick').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dv]'); if (!b) return;
    st.vol = Math.max(-2000, Math.min(2000, st.vol + +b.dataset.dv)); vol.value = st.vol; update();
  });
  $('#reset').addEventListener('click', () => applySetup({ g: st.g }));
  $('#csv').addEventListener('click', downloadCSV);
  addExport($('#echo-panel'), echoSpec, { still: true });
  $('#cq-pick').addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (!b) return; cqPick = b.dataset.k; cqTable(); });
  const su = parseHash(location.hash);
  if (su) Object.assign(st, su);
  vol.value = st.vol; svr.value = st.svrX; afr.value = st.afRate; $('#surge').checked = st.surge; $('#sbt').checked = st.sbt;
  $('#rhythm').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === st.rhythm)));
  syncGrade();
  solveNow(); drawLive(); drawCohort(); cqTable();
  // cases from the text page: by the channel when it is open, or by the hash when the link reuses this window
  window.addEventListener('hashchange', () => { const x = parseHash(location.hash); if (x && setupHash(x) !== setupHash(st)) applySetup(x); });
  if (channel) {
    const hello = () => channel.postMessage({ type: 'sim-here' });
    hello(); setInterval(hello, 2000);
    channel.addEventListener('message', (e) => { if (e.data?.type === 'setup') { applySetup(e.data.setup); window.focus(); } });
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawLive(); drawCohort(); }, 200); });
  document.addEventListener('themechange', () => { drawLive(); drawCohort(); });
}

export const _diast = { st, solveNow, cond };
