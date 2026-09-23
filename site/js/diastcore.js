// Diastolic dysfunction lab: grades 0–IV of LV diastolic dysfunction on the same circulation model,
// their Doppler echocardiogram, and how each tolerates volume, afterload and atrial fibrillation.
// Pure functions, no DOM, so node tests and the cohort generator run the same code.
//
// All parameter sets are synthetic. They were chosen so that each grade reproduces the mitral inflow
// pattern and the filling pressure that define it (Nishimura 1997, Nagueh 2016); they are not patient data.
import { simulate, NORMAL } from './engine.js';

export const BSA = 1.9;          // m², for indexed values
export const MV_AREA = 4;        // cm², effective mitral inflow orifice (Bernoulli term and Doppler velocity)
export const FS = 0.4;
export const V_MIN = 250;       // mL, the smallest stressed volume simulated (about a 1-L loss from normal)           // share of an intravascular volume change that becomes stressed volume (as in the Shock lab)
const TAU_N = 0.036;             // s, fitted τ of the normal heart
const EP_N = 12;                 // cm/s, lateral e′ of the normal heart (Nagueh 1997: 12 ± 2.8)
const LA_SCALE = 0.6;            // echo LA volume per model LA volume (the model atrium holds more than an echo LA)

// Grades. Each one adds to the grade before it: slower relaxation (τ), a steeper EDPVR (β, A), atrial
// remodeling (larger LA, stiffer LA, first a stronger then a weaker atrial kick), volume retention,
// arterial stiffening and, in the late grades, pulmonary vascular disease.
const G1 = { tau: 0.065, lvBeta: 0.033, lvA: 0.24, lvEes: 2.8, lvMass: 1.2, laV0: 16, laEmax: 2.0, laEmin: 0.2,
  vStressed: 650, svr: 1.15, cSys: 1.0 };
export const GRADES = [
  { id: 0, key: 'g0', roman: '0', label: 'Normal diastolic function', short: 'Normal', params: { mvArea: MV_AREA },
    text: 'Normal relaxation and chamber stiffness. Most of the LV fills in early diastole, driven by LV suction, so E exceeds A and the lateral e′ is brisk.' },
  { id: 1, key: 'g1', roman: 'I', label: 'Grade I: impaired relaxation', short: 'Grade I', params: { ...G1, mvArea: MV_AREA },
    text: 'Relaxation is slow (τ about 70 ms), so the early transmitral gradient is small and E falls; the atrium contracts harder and A rises. The E/A ratio falls below 0.8 and the deceleration time lengthens. LA pressure is still normal at rest.' },
  { id: 2, key: 'g2', roman: 'II', label: 'Grade II: pseudonormal', short: 'Grade II',
    params: { ...G1, mvArea: MV_AREA, tau: 0.068, lvBeta: 0.04, lvA: 0.27, lvEes: 3.1, lvMass: 1.35, laV0: 50, laEmax: 1.2, laEmin: 0.34,
      vStressed: 950, svr: 1.25, cSys: 0.85, pvr: 0.06 },
    text: 'Relaxation is still slow and the chamber is stiffer, and LA pressure has risen enough to restore the early gradient. The E/A ratio looks normal, but e′ stays low, so E/e′ is high, and the LA has enlarged. Preload reduction unmasks the impaired-relaxation pattern.' },
  { id: 3, key: 'g3', roman: 'III', label: 'Grade III: restrictive, reversible', short: 'Grade III',
    params: { ...G1, mvArea: MV_AREA, tau: 0.068, lvBeta: 0.055, lvA: 0.3, lvEes: 3.2, lvMass: 1.45, laV0: 75, laEmax: 0.9, laEmin: 0.4,
      vStressed: 1000, svr: 1.3, cSys: 0.8, pvr: 0.09, cPa: 2.6 },
    text: 'A stiff LV filling from a high-pressure, stiff LA. E is tall and decelerates quickly as LV pressure rises steeply; A is small because the atrium contracts against a full, stiff ventricle. Removing volume still returns the pattern toward pseudonormal.' },
  { id: 4, key: 'g4', roman: 'IV', label: 'Grade IV: restrictive, fixed', short: 'Grade IV',
    params: { ...G1, mvArea: MV_AREA, tau: 0.07, lvBeta: 0.065, lvA: 0.34, lvEes: 3.2, lvMass: 1.5, laV0: 80, laEmax: 0.7, laEmin: 0.5,
      vStressed: 1110, svr: 1.3, cSys: 0.8, pvr: 0.14, cPa: 2.0, rvEes: 0.6, rvMass: 1.3, hr: 78 },
    text: 'The ventricle is so stiff that the restrictive pattern persists after preload reduction. LA pressure is high at rest, pulmonary hypertension has developed, and the atrium adds little. This is the end of the continuum and the grade with the narrowest volume window.' },
];

// Chronic hypertension resets the baroreflex: the set point is the MAP the grade has without the reflex.
const setPoints = new Map();
export function mapSetFor(p) {
  const k = JSON.stringify(p);
  if (!setPoints.has(k)) setPoints.set(k, simulate({ ...p, baro: 0 }).hemo.MAP);
  return setPoints.get(k);
}

/**
 * Parameters for a grade (or an individual) under a set of interventions.
 * cond: { vol: intravascular volume change, mL; svrX: afterload multiplier; rhythm: 'sinus' | 'af'; afRate: /min }
 */
export function condParams(base, cond = {}) {
  const p = { ...NORMAL, ...base };
  const q = { ...base, mapSet: base.mapSet ?? mapSetFor(base) };
  if (cond.vol) q.vStressed = Math.max(V_MIN, p.vStressed + FS * cond.vol);
  // An acute afterload rise is run with the baroreflex open (baro 0), as in a hypertensive crisis in
  // which sympathetic activation overrides it; with the reflex closed, the venous arm would release
  // volume as MAP rises and mask the rise in LAP. At the set point the reflex is neutral, so svrX = 1
  // is the same state as baseline.
  if (cond.svrX) { q.svr = p.svr * cond.svrX; q.baro = 0; }
  if (cond.recruit) q.vStressed = (q.vStressed ?? p.vStressed) + cond.recruit;
  // AF: no atrial contraction, and a ventricular rate fixed by the AV node (the reflex keeps its other arms)
  if (cond.rhythm === 'af') { q.aKick = 0; q.hr = cond.afRate ?? 110; q.gHR = 0; }
  return q;
}

// RR intervals in AF as multiples of the mean (as on the PA catheter page): irregularly irregular.
export const AF_RR = [0.78, 1.21, 0.92, 1.34, 0.84, 1.07, 0.72, 1.16, 0.95, 1.27, 0.81, 1.02];

// Solve one condition. In AF the steady state at the mean rate is followed by a run of irregular beats,
// each started from the end of the one before, and the hemodynamics are the average over the run
// (a short RR fills less, and the next beat ejects less).
export function solveCond(base, cond = {}, warm) {
  const q = condParams(base, cond);
  const r = simulate(q, warm ? { state: warm.state, slow: warm.slow } : {});
  if (cond.rhythm !== 'af' || cond.regular) return { r, q, beats: [r] };
  const beats = [];
  // the run starts from the steady state, so the beat before the first is the steady beat itself
  let s = r.state, prev = r;
  for (const f of AF_RR) {
    const b = simulate({ ...q, hr: q.hr / f }, { state: s, slow: r.slow, holdSlow: true, maxBeats: 0, dt: 0.001, prev });
    beats.push(b); s = b.endState; prev = b;
  }
  return { r, q, beats };
}

// Mean over irregular beats, weighted by beat length (a minute is made of time, not of beats).
function beatAverage(beats) {
  if (beats.length === 1) return null;
  let T = 0, sv = 0, map = 0, lap = 0, mpap = 0, rap = 0, edp = 0;
  for (const b of beats) {
    T += b.T; sv += b.lv.fwdSV; map += b.hemo.MAP * b.T; lap += b.hemo.LAP * b.T; mpap += b.hemo.mPAP * b.T;
    rap += b.hemo.RAP * b.T; edp += b.lv.EDP * b.T;
  }
  return { CO: sv / T * 60 / 1000, SV: sv / beats.length, MAP: map / T, LAP: lap / T, mPAP: mpap / T, RAP: rap / T, EDP: edp / T, HR: beats.length / T * 60 };
}

// Doppler indices from one simulated beat.
//   Mitral inflow: velocity = flow / MV_AREA (the orifice that also sets the Bernoulli gradient).
//   E = peak before atrial contraction, A = peak during it; DT from the E peak to the zero intercept of
//   the deceleration slope (fitted from 90% to 40% of E). IVRT = aortic closure to mitral opening.
//   Lateral e′ is not produced by the model, which has no long axis: it is scaled from the fitted τ,
//   e′ = 12 × τ_normal/τ cm/s, because e′ tracks relaxation and is relatively preload independent
//   (Sohn 1997, Nagueh 1997). The model therefore holds e′ fixed when only volume changes, which
//   overstates its preload independence (Opdahl 2009).
//   a′ scales with the volume the atrium moves into the LV. Pulmonary venous flow: peak systolic (S)
//   and diastolic (D) inflow into the LA. TR velocity from the peak RV–RA gradient (4v²).
export function echo(r) {
  const { t, Qmv, aAct, Pla, Ppv, Vla, Prv, Pra, Qao } = r.rec;
  const n = t.length, dt = r.dt, pr = r.params;
  let iE = -1, E = 0, A = 0, aVol = 0;
  let iAVC = -1, iMVO = -1;
  for (let i = 0; i < n; i++) {
    if (aAct[i] < 0.02 && t[i] > r.tEs && Qmv[i] > E) { E = Qmv[i]; iE = i; }
    if (aAct[i] > 0.02) { if (Qmv[i] > A) A = Qmv[i]; aVol += Qmv[i] * dt; }
    if (iAVC < 0 && t[i] > r.tEs && Qao[i] <= 0 && i > 0 && Qao[i - 1] > 0) iAVC = i;
    if (iAVC >= 0 && iMVO < 0 && Qmv[i] > 0) iMVO = i;
  }
  let i9 = iE, i4;
  while (i9 < n - 1 && Qmv[i9] > 0.9 * E) i9++;
  i4 = i9;
  while (i4 < n - 1 && Qmv[i4] > 0.4 * E && aAct[i4] < 0.02) i4++;
  const slope = i4 > i9 ? (Qmv[i9] - Qmv[i4]) / ((i4 - i9) * dt) : NaN;
  // A may start before E has fallen to 40%; the slope is then fitted to the part before A, and DT
  // is not measured if E has not fallen below 70% (E and A fused, as at fast rates)
  const DT = Qmv[i4] > 0.7 * E || !(slope > 0) ? NaN : (Qmv[i9] / slope + (i9 - iE) * dt) * 1000;
  let S = 0, D = 0;
  const tS = r.tEs + 0.12;
  for (let i = 0; i < n; i++) {
    const q = (Ppv[i] - Pla[i]) / pr.rPvLa;
    if (t[i] < tS) { if (q > S) S = q; } else if (aAct[i] < 0.02 && q > D) D = q;
  }
  let rvra = 0;
  for (let i = 0; i < n; i++) rvra = Math.max(rvra, Prv[i] - Pra[i]);
  const tauMs = r.lv.tau * 1000;
  const ep = EP_N * (TAU_N * 1000) / tauMs;
  const Ev = E / MV_AREA, Av = A / MV_AREA;
  const out = {
    E: Ev, A: Av, EA: A > 1 ? Ev / Av : Infinity, DT,
    IVRT: iAVC >= 0 && iMVO >= 0 ? (iMVO - iAVC) * dt * 1000 : NaN,
    ep, ap: 9 * aVol / AVOL_N, Eep: Ev / ep,
    LAVI: LA_SCALE * Math.max(...Vla) / BSA,
    TRv: Math.sqrt(Math.max(0, rvra) / 4), SD: D > 0 ? S / D : Infinity,
    pcwpNagueh: 1.24 * (Ev / ep) + 1.9,        // Nagueh 1997 regression, PCWP = 1.24·E/Ea + 1.9
    tauMs,
  };
  out.grade = gradeFromEcho(out);
  // raised LAP by the three supporting criteria (the only route when there is no A wave)
  out.lapHigh = [out.Eep > CUT.Eep, out.TRv > CUT.TR, out.LAVI > CUT.LAVI].filter(Boolean).length >= 2;
  return out;
}
let AVOL_N = 1;
{
  const r = simulate({ mvArea: MV_AREA });
  let v = 0;
  for (let i = 0; i < r.rec.t.length; i++) if (r.rec.aAct[i] > 0.02) v += r.rec.Qmv[i] * r.dt;
  AVOL_N = v;
}

// ASE/EACVI 2016 cutoffs, applied to the model's echo (lateral e′ and lateral E/e′ only, since the model
// has one e′). Returns 0 (normal), 1, 2, 3 and whether the pattern could be graded.
export const CUT = { EA_low: 0.8, E_low: 50, EA_high: 2, Eep: 13, ep: 10, TR: 2.8, LAVI: 34 };
export function gradeFromEcho(d) {
  const n = [d.Eep > CUT.Eep, d.TRv > CUT.TR, d.LAVI > CUT.LAVI].filter(Boolean).length;
  if (!(d.A > 5)) return null;               // no A wave (AF): not graded; see lapHigh
  if (d.EA >= CUT.EA_high) return 3;
  if (d.EA <= CUT.EA_low && d.E <= CUT.E_low) return 1;
  // E/A ≤ 0.8 with E > 50, or E/A between 0.8 and 2: two or three positive criteria mean raised LAP
  if (n >= 2) return 2;
  // normal LAP: grade I if the relaxation marker (low e′) is abnormal, normal otherwise
  return d.ep < CUT.ep ? 1 : 0;
}

// Everything the page and the cohort read, for one solved condition. In AF the Doppler values are
// averaged over the irregular beats (E, e′ and E/e′ are averaged over several cycles in AF, Nagueh 2016).
export function readout(sol) {
  const { r, beats } = sol, h = r.hemo, lv = r.lv;
  const avg = beatAverage(beats);
  let e;
  if (beats.length > 1) {
    const all = beats.map(echo).filter((x) => x.E > 1);
    const m = (k) => { const v = all.map((x) => x[k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
    e = { ...all[0] };
    for (const k of ['E', 'A', 'DT', 'IVRT', 'ep', 'ap', 'LAVI', 'TRv', 'SD', 'tauMs']) e[k] = m(k);
    e.EA = Infinity; e.Eep = e.E / e.ep; e.pcwpNagueh = 1.24 * e.Eep + 1.9; e.grade = null;
    e.lapHigh = [e.Eep > CUT.Eep, e.TRv > CUT.TR, e.LAVI > CUT.LAVI].filter(Boolean).length >= 2;
  } else e = echo(r);
  const o = {
    HR: r.eff.hr, CO: h.CO, SV: lv.fwdSV, EF: lv.EF, MAP: h.MAP, SBP: h.SBP, DBP: h.DBP, LAP: h.LAP, EDP: lv.EDP,
    EDV: lv.EDV, ESV: lv.ESV, mPAP: h.mPAP, PASP: h.PASP, RAP: h.RAP, PVR: h.PVR_WU, rvEesEa: r.rv.EesEa,
    atrialFill: h.atrialFill, echo: e,
  };
  if (avg) Object.assign(o, avg);
  return o;
}

// Individual variation for the cohort: each patient's parameters are the grade's, each multiplied by a
// log-normal factor (coefficient of variation cv). A seeded generator makes the cohort reproducible.
export const JITTER = { tau: 0.12, lvBeta: 0.1, lvA: 0.1, lvEes: 0.12, laEmax: 0.15, laEmin: 0.12, laV0: 0.15,
  vStressed: 0.06, svr: 0.12, cSys: 0.12, pvr: 0.2, hr: 0.08 };
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(u) { const a = Math.max(1e-12, u()), b = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
export function individual(grade, u) {
  const base = { ...NORMAL, ...GRADES[grade].params }, p = { ...GRADES[grade].params };
  for (const [k, cv] of Object.entries(JITTER)) {
    const sd = Math.sqrt(Math.log(1 + cv * cv));
    p[k] = base[k] * Math.exp(sd * gauss(u) - sd * sd / 2);
  }
  return p;
}

// Protocols run on every patient. Volumes are intravascular (mL) at the end of a rapid infusion or of
// diuresis; afterload is a multiple of the patient's SVR; AF is at a fixed mean ventricular rate.
// The surge adds, to SVR × 1.5, the recruitment of 200 mL of unstressed splanchnic volume into the
// stressed pool that sympathetic venoconstriction produces (an illustrative size, as for the pressors
// in the Shock lab).
export const VOL_STEPS = [-2000, -1500, -1000, -750, -500, -250, 0, 250, 500, 750, 1000, 1500, 2000];
export const SVR_STEPS = [0.7, 0.85, 1, 1.25, 1.5, 1.75];
export const AF_RATES = [70, 90, 110, 130, 150];
export const SURGE = { svrX: 1.5, recruit: 200 };
export const LAP_WET = 18;       // mmHg, the PCWP above which the patient is congested (Forrester 1976)
export const LAP_EDEMA = 25;     // mmHg, roughly where hydrostatic alveolar edema begins
export const CO_DRY = 0.9;       // share of the plateau cardiac output below which the patient is underfilled

// Full protocol on one parameter set. Returns rows (one per condition) for the tables and CSV.
export function protocol(base) {
  const rows = [];
  let warm = null;
  const vS = { ...NORMAL, ...base }.vStressed;
  const run = (kind, x, cond) => {
    // removing more volume than the patient can spare (stressed volume below V_MIN) is not simulated
    if (cond.vol && vS + FS * cond.vol < V_MIN) { rows.push({ kind, x, ...Object.fromEntries(FIELDS.map((k) => [k, NaN])) }); return; }
    const sol = solveCond(base, cond, warm);
    if (kind === 'volume' && x === 0) warm = { state: sol.r.state, slow: sol.r.slow };
    rows.push({ kind, x, ...flat(readout(sol)) });
  };
  run('volume', 0, {});
  for (const v of VOL_STEPS) if (v !== 0) run('volume', v, { vol: v });
  for (const s of SVR_STEPS) run('afterload', s, { svrX: s });
  run('surge', 1, { svrX: SURGE.svrX, recruit: SURGE.recruit });
  for (const hr of AF_RATES) run('af', hr, { rhythm: 'af', afRate: hr });
  return rows;
}
export const FIELDS = ['HR', 'CO', 'SV', 'EF', 'MAP', 'LAP', 'EDP', 'EDV', 'mPAP', 'RAP', 'E', 'A', 'EA', 'DT', 'ep', 'Eep', 'LAVI', 'TRv', 'SD', 'echoGrade', 'lapHigh'];
export function flat(o) {
  const e = o.echo;
  return {
    HR: o.HR, CO: o.CO, SV: o.SV, EF: o.EF, MAP: o.MAP, LAP: o.LAP, EDP: o.EDP, EDV: o.EDV, mPAP: o.mPAP, RAP: o.RAP,
    E: e.E, A: e.A, EA: Number.isFinite(e.EA) ? e.EA : NaN, DT: e.DT, ep: e.ep, Eep: e.Eep, LAVI: e.LAVI, TRv: e.TRv, SD: e.SD,
    echoGrade: e.grade ?? NaN, lapHigh: e.lapHigh ? 1 : 0,
  };
}

// Linear interpolation of y at x, and of the x where y crosses a target, along rows sorted by x.
function interp(rows, f, x) {
  for (let i = 1; i < rows.length; i++) if (x <= rows[i].x) {
    const a = rows[i - 1], b = rows[i];
    return f(a) + (f(b) - f(a)) * (x - a.x) / (b.x - a.x);
  }
  return f(rows[rows.length - 1]);
}

// Tolerance summaries from one patient's protocol rows.
//   Volume window: the range of intravascular volume change (mL, relative to the patient as found)
//   over which LAP stays below LAP_WET and cardiac output stays within 10% of its plateau (the largest
//   CO reached in the volume sweep). lo and hi are its edges; width 0 means there is no such range,
//   that is, the patient cannot be both decongested and adequately filled.
//   Fluid: LAP rise and CO gain with 500 mL and 1 L. Diuresis: LAP fall and CO loss with 1 L removed.
//   Afterload: changes with SVR × 1.5. AF: changes at the same rate (70/min, loss of the atrial kick)
//   and at 110 and 130/min.
export function tolerance(rows) {
  const vol = rows.filter((r) => r.kind === 'volume' && Number.isFinite(r.LAP)).sort((a, b) => a.x - b.x);
  const b = vol.find((r) => r.x === 0);
  const coMax = Math.max(...vol.map((r) => r.CO));
  let lo = NaN, hi = NaN;
  for (let x = vol[0].x; x <= vol[vol.length - 1].x; x += 10) {
    const ok = interp(vol, (r) => r.LAP, x) < LAP_WET && interp(vol, (r) => r.CO, x) >= CO_DRY * coMax;
    if (ok) { if (Number.isNaN(lo)) lo = x; hi = x; }
  }
  const at = (k, x) => rows.find((r) => r.kind === k && r.x === x);
  const aft = at('afterload', 1.5), surge = at('surge', 1), a1 = at('afterload', 1);
  const af70 = at('af', 70), af110 = at('af', 110), af130 = at('af', 130);
  const p500 = at('volume', 500), p1000 = at('volume', 1000), m1000 = at('volume', -1000);
  return {
    LAP: b.LAP, CO: b.CO, SV: b.SV, MAP: b.MAP, coMax,
    winLo: lo, winHi: hi, window: Number.isNaN(lo) ? 0 : hi - lo,
    toWet: b.LAP >= LAP_WET ? 0 : (hi > 0 ? hi : 0),
    lap500: p500.LAP - b.LAP, lap1000: p1000.LAP - b.LAP, co500: p500.CO - b.CO, co1000: p1000.CO - b.CO,
    lapDiur: m1000.LAP - b.LAP, coDiur: m1000.CO - b.CO,
    aftLAP: aft.LAP - a1.LAP, aftSVpct: (aft.SV / a1.SV - 1) * 100, aftMAP: aft.MAP - a1.MAP,
    surgeLAP: surge.LAP - a1.LAP, surgeMAP: surge.MAP - a1.MAP,
    af70CO: (af70.CO / b.CO - 1) * 100, af70LAP: af70.LAP - b.LAP,
    af110CO: (af110.CO / b.CO - 1) * 100, af110LAP: af110.LAP - b.LAP,
    af130CO: (af130.CO / b.CO - 1) * 100, af130LAP: af130.LAP - b.LAP,
  };
}

// Time course: crystalloid, then diuresis, on the Shock lab's fluid kinetics. Each crystalloid bolus is
// 500 mL over 15 min; 18% stays in the vessels and the rest moves to the interstitium with a time
// constant of 10 min (Hahn 2020). Diuresis removes intravascular volume at a set rate (net of refill).
// Returns samples every `step` minutes.
export const COURSE = { boluses: 2, diureseAt: 60, diureseRate: 500, diureseFor: 180, end: 300, step: 5 };
export function course(base, plan = COURSE) {
  const keep = 0.18, tau = 10, bolus = 500, over = 15;
  let transient = 0, retained = 0, removed = 0, warm = null;
  const out = [];
  const infusing = (t) => t < plan.boluses * over;
  const vS = { ...NORMAL, ...base }.vStressed;
  for (let t = 0; t <= plan.end + 1e-9; t += plan.step) {
    const vol = transient + retained - removed;
    const given = Math.min(t, plan.boluses * over) / over * bolus;
    if (vS + FS * vol < V_MIN) out.push({ t, vol, given, removed, ...Object.fromEntries(FIELDS.map((k) => [k, NaN])) });
    else {
      const sol = solveCond(base, { vol }, warm);
      warm = { state: sol.r.state, slow: sol.r.slow };
      out.push({ t, vol, given, removed, ...flat(readout(sol)) });
    }
    // advance plan.step minutes in 1-min substeps
    for (let k = 0; k < plan.step; k++) {
      const tm = t + k;
      transient *= Math.exp(-1 / tau);
      if (infusing(tm)) { const v = bolus / over; retained += keep * v; transient += (1 - keep) * v; }
      if (tm >= plan.diureseAt && tm < plan.diureseAt + plan.diureseFor) removed += plan.diureseRate / 60;
    }
  }
  return out;
}

// Bedside consequences of a hemodynamic state, by thresholds (not simulated lung water or kidneys).
//   Lungs: PAWP > 18 mmHg congestion (Forrester 1976); > 25 mmHg the range in which alveolar edema
//   develops with a normal plasma protein (Guyton 1959). Perfusion: cardiac index < 2.2 L/min/m²
//   (Forrester 1976), MAP < 65 mmHg (Evans 2021). Venous congestion: CVP > 12 mmHg (Rola 2025).
//   Pulmonary hypertension: mPAP > 20 mmHg, post-capillary when PAWP > 15 mmHg (Humbert 2022).
// level: 0 none, 1 present, 2 severe. Each item carries its own label so it is never color alone.
export const CONSEQ = { wet: LAP_WET, edema: LAP_EDEMA, ci: 2.2, map: 65, cvp: 12, mpap: 20, pawpPH: 15 };
export function consequences(o) {
  const ci = o.CO / BSA;
  const wet = o.LAP > CONSEQ.wet, cold = ci < CONSEQ.ci;
  return {
    ci,
    subset: `${cold ? 'Cold' : 'Warm'} and ${wet ? 'wet' : 'dry'}`,
    items: [
      { id: 'lungs', label: 'Lungs', level: o.LAP > CONSEQ.edema ? 2 : wet ? 1 : 0,
        text: o.LAP > CONSEQ.edema ? 'alveolar edema range' : wet ? 'congested' : 'dry' },
      { id: 'perf', label: 'Perfusion', level: cold && o.MAP < CONSEQ.map ? 2 : cold || o.MAP < CONSEQ.map ? 1 : 0,
        text: `${cold ? `low output (CI ${ci.toFixed(1)})` : `adequate (CI ${ci.toFixed(1)})`}${o.MAP < CONSEQ.map ? ', hypotensive' : ''}` },
      { id: 'veins', label: 'Systemic veins', level: o.RAP > CONSEQ.cvp ? 1 : 0, text: o.RAP > CONSEQ.cvp ? 'congested (CVP > 12)' : 'not congested' },
      { id: 'ph', label: 'Pulmonary circulation', level: o.mPAP > CONSEQ.mpap ? (o.mPAP > 35 ? 2 : 1) : 0,
        text: o.mPAP > CONSEQ.mpap ? (o.LAP > CONSEQ.pawpPH ? 'post-capillary PH' : 'PH') : 'no PH' },
    ],
  };
}
