// ICU diastology lab: color M-mode flow propagation velocity (Vp), E/Vp, and the patients and interventions
// on which E/Vp and E/e′ are compared. Pure functions, no DOM, so node tests run the same code.
//
// The engine has one LV compartment and no long axis, so Vp is not simulated. It is scaled from the fitted
// relaxation time constant and the ejection fraction, as the Diastolic lab scales lateral e′ from τ:
//   Vp = (τN/τ) · [c0 + c1 · max(0, EF − 30%)]
// Relaxation scales the whole velocity (Vp against τ: r = 0.78 in dogs and 0.86 in patients, Garcia 2000), and
// restoring forces, represented by the ejection fraction, add to it in a ventricle that empties well (LV
// end-systolic volume index explained 46% of the variance of Vp and τ 3%, Ohte 2001). c0 gives the dilated HFrEF
// preset about 38 cm/s (propagation rate 34 ± 14 cm/s with EF < 60% and E/A < 1, Takatsuji 1996) and c1 gives
// the normal ventricle about 70 cm/s (controls 74 ± 17 cm/s, Takatsuji 1996). The design and the two mechanistic formulations that were
// rejected are in docs/vp-design.md. At a fixed τ and EF the surrogate does not change with preload, which
// overstates its preload independence when EF is preserved (Lin 2005, Vignon 2007).
import { NORMAL } from './engine.js';
import { GRADES, solveCond, readout, mapSetFor, MV_AREA } from './diastcore.js';
import { presetById, INTERVENTIONS } from './presets.js';

export const VP = { tauN: 36, c0: 45, c1: 0.93, efBreak: 30 };
export function vpFrom(tauMs, ef) {
  return (VP.tauN / tauMs) * (VP.c0 + VP.c1 * Math.max(0, ef * 100 - VP.efBreak));
}
// Garcia 1997, 45 ICU patients: PCWP = 5.27 × E/Vp + 4.6 (r = 0.80, SEE 3.1 mmHg)
export const garcia = (EVp) => 5.27 * EVp + 4.6;
// Nagueh 1997: PCWP = 1.24 × E/e′ + 1.9 (the regression the Diastolic lab uses)
export const nagueh = (Eep) => 1.24 * Eep + 1.9;
// Vignon 2008, ventilated patients: E/Vp ≤ 1.7 predicted PAOP ≤ 18 mmHg (sensitivity 80%, specificity 100%)
export const EVP_LOW = 1.7;

// Lateral e′. The Diastolic lab scales e′ from the fitted τ alone (12 cm/s at the normal τ of 36 ms, Nagueh 1997).
// Here e′ also falls with systolic function: below an EF of 50% it is reduced by 1% for each percentage point of EF,
// representing the loss of restoring forces (an independent determinant of e′ in dogs, Opdahl 2009) and of
// long-axis function (e′ against EF after a first infarction: r = 0.66, Alam 2000). The HFrEF preset has a normal
// relaxation parameter (fitted τ 43 ms), so the slope is set for that preset: e′ 7.3 cm/s at an EF of 22%, against
// 6.2 ± 1.9 cm/s (mean of four annular sites) in patients hospitalized with an EF of 24.7 ± 7.2% (Olson 2008).
// In patients part of that fall comes from slow relaxation (pacing-induced failure in dogs: e′ against τ,
// R² = 0.85, Hasegawa 2003), so where a low EF and a long τ are combined the two reductions multiply. At an EF of
// 50% or more e′ is the Diastolic lab's. A manual e′ replaces the reading and E/e′ and leaves the hemodynamics,
// E and Vp unchanged.
export const EP = { efBreak: 50, perPoint: 0.01 };
export const epFactor = (ef) => 1 - EP.perPoint * Math.max(0, EP.efBreak - ef * 100);

// Patients. Each runs on the Diastolic lab's solver (mitral orifice on, baroreflex set point at the patient's
// own open-loop MAP), so E, the τ-scaled e′ and the volume steps are those of that lab.
const lab = (id, extra = {}) => ({ ...presetById(id).params, mvArea: MV_AREA, ...extra });
export const PATIENTS = [
  { id: 'normal', label: 'Normal ventricle', params: GRADES[0].params },
  { id: 'septicCM', label: 'Septic cardiomyopathy', params: lab('septicCM') },
  { id: 'hfref', label: 'Dilated cardiomyopathy (HFrEF)', params: lab('hfref') },
  { id: 'vasoTau', label: 'Septic vasoplegia with slow relaxation', params: lab('vasoplegia', { tau: 0.06 }) },
  { id: 'g3', label: 'Restrictive filling, preserved EF (grade III)', params: GRADES[3].params },
];
export const patientById = (id) => PATIENTS.find((p) => p.id === id);
export const VOLS = [-1000, -500, 0, 500, 1000];

// The simulator's standard inotrope dose (Ees × 1.35, heart rate +10/min, SVR × 0.9). It leaves τ unchanged.
// The baroreflex keeps the patient's pre-drug set point, so it responds to the drug as an acute change.
function withInotrope(p) {
  const full = { ...NORMAL, ...p };
  const d = INTERVENTIONS.find((x) => x.id === 'dobut').apply(full);
  return { ...p, ...d, mapSet: p.mapSet ?? mapSetFor(p) };
}

/**
 * One bedside state. opts: { vol (mL, intravascular), ino (boolean), af (boolean, AF at 110/min),
 *   ep (manual lateral e′, cm/s; omitted for e′ scaled from τ and EF) }.
 * Returns the Diastolic lab readout plus Vp and both filling-pressure estimates.
 */
export function icuState(id, opts = {}) {
  return bedState(patientById(id).params, opts);
}
// The same for any parameter set (a patient of this page or another combination of disease)
export function bedState(params, opts = {}) {
  const base = opts.ino ? withInotrope(params) : params;
  const cond = { ...(opts.vol ? { vol: opts.vol } : {}), ...(opts.af ? { rhythm: 'af', afRate: 110 } : {}) };
  const sol = solveCond(base, cond);
  const o = readout(sol), e = o.echo;
  const Vp = vpFrom(e.tauMs, o.EF);
  const EVp = e.E / Vp;
  const s = {
    sol, o, e, Vp, EVp, LAP: o.LAP, EF: o.EF, E: e.E, pcwpVp: garcia(EVp),
    epTau: e.ep, epAuto: e.ep * epFactor(o.EF),
  };
  return withEp(s, opts.ep);
}

// e′, E/e′ and the E/e′ estimate of a solved state, from a manual e′ (cm/s) or, when ep is not a number, from τ and EF
export function withEp(s, ep) {
  const manual = Number.isFinite(ep), v = manual ? ep : s.epAuto;
  return { ...s, ep: v, epManual: manual, Eep: s.E / v, pcwpEep: nagueh(s.E / v) };
}

// ---------- color M-mode ----------
// The display is constructed from the model's mitral velocity and the surrogate Vp; it cannot validate Vp.
// Along the scan line from the mitral tips (x = 0) to the apex (x = L), early inflow travels as a front at speed c
// and atrial inflow at cA, and the jet core loses velocity toward the apex as g(x) = exp(−(x/λ)²). Because the jet
// slows as it advances, the first aliasing contour bends, and its slope over the first 4 cm is less than c and
// depends on the Nyquist limit. c is chosen so that the slope measured with the Nyquist limit at half of E equals
// the surrogate Vp; any other Nyquist limit then gives the reading that setting would give.
// λ = 1.2 × LV length keeps c within about a third of Vp in every patient, so the contour slope reflects the front
// speed and not the shape of the E upstroke (a shorter λ makes a slow upstroke dominate the reading).
// Beyond the measured span the jet core also fades toward the apex (length scale `apical`, cm), which shapes the
// image and leaves the measurement unchanged.
export const MM = { span: 4, nyqShare: 0.5, cA: 150, lambdaShare: 1.2, apical: 2.5, laDepth: 1.5 };

export function mmodeField(r, Vp) {
  const rec = r.rec, dt = r.dt, n = rec.t.length;
  const L = 8.5 * Math.cbrt(r.lv.EDV / 120), lambda = MM.lambdaShare * L;
  let i0 = Math.round(r.tEs / dt); while (i0 < n - 1 && rec.Qao[i0] > 0) i0++;   // aortic valve closure
  let iA = i0; while (iA < n - 1 && rec.aAct[iA] < 0.02) iA++;                    // atrial contraction (end of beat if none)
  const t0 = i0 * dt, tA = iA * dt, T = n * dt;
  const U = (s) => {                                     // mitral velocity at time s, cm/s
    if (s < t0 || s >= T) return 0;
    const k = s / dt, j = Math.floor(k), f = k - j;
    const a = Math.max(0, rec.Qmv[j]), b = Math.max(0, rec.Qmv[Math.min(n - 1, j + 1)]);
    return (a + (b - a) * f) / MV_AREA;
  };
  let E = 0; for (let i = i0; i < iA; i++) E = Math.max(E, Math.max(0, rec.Qmv[i]) / MV_AREA);
  const g = (x) => Math.exp(-((x / lambda) ** 2)) * (x > MM.span ? Math.exp(-(((x - MM.span) / MM.apical) ** 2)) : 1);
  // first time on the early upstroke at which the mitral velocity reaches u (Infinity if never)
  const sFirst = (u) => {
    for (let i = i0; i < iA; i++) if (Math.max(0, rec.Qmv[i]) / MV_AREA >= u) {
      const prev = Math.max(0, rec.Qmv[i - 1]) / MV_AREA, cur = Math.max(0, rec.Qmv[i]) / MV_AREA;
      return (i - 1 + (cur > prev ? (u - prev) / (cur - prev) : 1)) * dt;
    }
    return Infinity;
  };
  const F = { L, lambda, t0, tA, T, E, U, g, sFirst, c: Vp };
  F.c = calibrate(F, Vp);
  F.at = (x, t) => velocity(F, x, t);
  return F;
}

function velocity(F, x, t) {
  if (x < 0) return F.U(t) * Math.max(0, 1 + 0.5 * x / MM.laDepth);
  const sE = t - x / F.c, sA = t - x / MM.cA;
  const vE = sE < F.tA ? F.U(sE) : 0, vA = sA >= F.tA ? F.U(sA) : 0;
  return F.g(x) * Math.max(vE, vA);
}

// Leading edge of the first aliasing contour (early filling) at Nyquist limit N: depth against time, from the
// mitral tips to the first `span` cm or as far as the contour reaches.
export function contour(F, N, c = F.c, span = MM.span) {
  const pts = [];
  for (let x = 0; x <= span + 1e-9; x += 0.1) {
    const s = F.sFirst(N / F.g(x));
    if (!Number.isFinite(s) || s >= F.tA) break;
    pts.push([s + x / c, x]);
  }
  return pts;
}

// Slope of depth on time by least squares, cm/s.
export function fitSlope(pts) {
  if (pts.length < 5) return NaN;
  const mt = pts.reduce((a, p) => a + p[0], 0) / pts.length, mx = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let sxy = 0, stt = 0;
  for (const [t, x] of pts) { sxy += (t - mt) * (x - mx); stt += (t - mt) ** 2; }
  return sxy / stt;
}

export const measuredVp = (F, N, c = F.c) => fitSlope(contour(F, N, c));

// Front speed c whose standard measurement (Nyquist at half of E) equals Vp. The measured slope rises with c
// toward the limit set by the bending of the contour, so the search is a bisection on c.
function calibrate(F, Vp) {
  const N = MM.nyqShare * F.E;
  let lo = Vp, hi = 20 * Vp;
  if (!(measuredVp(F, N, hi) > Vp)) return hi;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (measuredVp(F, N, mid) < Vp) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
