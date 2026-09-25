// Exploration for a color M-mode flow propagation velocity (Vp) in the Diastolic lab. Not used by the site.
// It prints the tables quoted in docs/vp-design.md, so every number there can be regenerated:
//
//   node tools/vp_explore.mjs
//
// The engine has one LV compartment and no long axis, so Vp cannot be read from it directly. Three
// ways of producing it are compared on the same cases:
//   A. an axial model: the cavity cut into slices along the long axis, each obeying the engine's wall law,
//      joined by the inertance of the blood between them and filled at the base by the engine's mitral flow;
//   B. a jet front: fluid enters at the mitral tips with the engine's inflow velocity, is accelerated by an
//      intraventricular pressure gradient, and faster fluid that overtakes slower fluid merges with it
//      (a forced inviscid Burgers flow, whose front is the leading vortex ring);
//   C. a surrogate scaled from the fitted τ and the ejection fraction, as the lab already scales e′ from τ.
import { GRADES, solveCond, readout, BSA, MV_AREA } from '../site/js/diastcore.js';
import { presetById, INTERVENTIONS } from '../site/js/presets.js';

const MMHG = 1333.22, RHO = 1.06;   // dyn/cm² per mmHg; blood density, g/cm³
const TAU_N = 36;                   // ms, fitted τ of the normal ventricle
const L_N = 8.5, EDV_N = 120;       // cm, LV long axis at an end-diastolic volume of 120 mL

// ---------- cases ----------
const lab = (id) => ({ ...presetById(id).params, mvArea: MV_AREA });
const dobut = (p) => ({ ...p, ...INTERVENTIONS.find((x) => x.id === 'dobut').apply({ lvEes: 2.3, rvEes: 0.45, hr: 70, svr: 0.95, ...p }) });
const CASES = [
  ...GRADES.map((g) => [g.short, g.params, {}]),
  ['Normal, −1 L', GRADES[0].params, { vol: -1000 }],
  ['Normal, +1 L', GRADES[0].params, { vol: 1000 }],
  ['Normal, inotrope', dobut(GRADES[0].params), {}],
  ['HFrEF', lab('hfref'), {}],
  ['HFrEF, −1 L', lab('hfref'), { vol: -1000 }],
  ['HFrEF, +1 L', lab('hfref'), { vol: 1000 }],
  ['HFrEF, inotrope', dobut(lab('hfref')), {}],
  ['Septic cardiomyopathy', lab('septicCM'), {}],
  ['Septic CM, +1 L', lab('septicCM'), { vol: 1000 }],
  ['Septic CM, inotrope', dobut(lab('septicCM')), {}],
  ['Vasoplegia', lab('vasoplegia'), {}],
  ['Vasoplegia, τ 60 ms', { ...lab('vasoplegia'), tau: 0.06 }, {}],
];

// ---------- A. axial model ----------
function wallP(V, e, Ees, V0, A, beta) {
  const act = Ees * (V - V0), pas = A * (Math.exp(beta * (V - V0)) - 1), d = act - pas;
  return e * (act + pas + Math.sqrt(d * d + 0.25)) / 2 + (1 - e) * pas;
}
// Half-prolate cavity, N slices from the mitral plane (x = 0) to the apex. Slice j holds the share w[j] of
// the volume and has the engine's wall law at the normalized volume V_j/w[j], so a uniformly filled cavity
// has the engine's LV pressure everywhere. Returns Vp as the slope of distance against the time of the
// early-filling flow peak, 0.5 to 4 cm from the mitral plane.
function axial(r, N = 24) {
  const rec = r.rec, dt = r.dt, n = rec.t.length, p = r.params;
  const L = L_N * Math.cbrt(r.lv.EDV / EDV_N), dx = L / N;
  const F = (x) => x - x ** 3 / 3, w = [];
  for (let j = 0; j < N; j++) w.push((F((j + 1) / N) - F(j / N)) / (2 / 3));
  const area = (xi, V) => 1.5 * V / L * (1 - xi * xi);
  let i0 = Math.round(r.tEs / dt); while (i0 < n - 1 && rec.Qao[i0] > 0) i0++;     // aortic valve closure
  let iA = i0; while (iA < n - 1 && rec.aAct[iA] < 0.02) iA++;                      // atrial contraction
  const V = w.map((x) => x * rec.Vlv[i0]), Q = new Float64Array(N + 1), sub = 4, h = dt / sub;
  const tPk = new Array(N + 1).fill(NaN), qPk = new Array(N + 1).fill(-1);
  for (let i = i0; i < iA; i++) for (let k = 0; k < sub; k++) {
    const f = k / sub, e = rec.eAct[i] * (1 - f) + rec.eAct[i + 1] * f;
    const Vt = V.reduce((a, b) => a + b, 0);
    const P = V.map((v, j) => wallP(v / w[j] - rec.Vspt[i], e, r.eff.lvEes, p.lvV0, p.lvA, p.lvBeta));
    Q[0] = rec.Qmv[i] * (1 - f) + rec.Qmv[i + 1] * f;
    for (let j = 1; j < N; j++) {
      const A = area(j / N, Vt), Lj = RHO * dx / A / MMHG;
      Q[j] += h * (P[j - 1] - P[j] - 0.0008 * dx / (A * A) * Q[j] * 1000) / Lj;
      if (k === 0 && Q[j] > qPk[j]) { qPk[j] = Q[j]; tPk[j] = rec.t[i]; }
    }
    for (let j = 0; j < N; j++) V[j] += h * (Q[j] - Q[j + 1]);
  }
  const pts = [];
  for (let j = 1; j < N; j++) if (j * dx >= 0.5 && j * dx <= 4) pts.push([tPk[j], j * dx]);
  return slope(pts);
}

// ---------- B. jet front ----------
// Particles enter at the mitral tips with velocity Qmv/A_mv and move with it, accelerated by the gradient
// G = [P(t) − P(t + lead)]/(ρL): the apex taken to lead the base in the pressure time course by `lead` s,
// so G > 0 while LV pressure is falling (suction) and < 0 once it rises. lead = 0 is a free jet.
// A particle that overtakes the one ahead merges with it, conserving momentum. Vp is the slope of the
// isovelocity contour at vc (a share of E) over the first 4 cm, as on a color M-mode.
function jet(r, lead, vcShare = 0.5) {
  const rec = r.rec, dt = r.dt, n = rec.t.length;
  const L = L_N * Math.cbrt(r.lv.EDV / EDV_N), k = Math.round(lead / dt);
  let iO = Math.round(r.tEs / dt); while (iO < n - 1 && !(rec.Qmv[iO] > 0.5)) iO++;
  let iA = iO; while (iA < n - 1 && rec.aAct[iA] < 0.02) iA++;
  let E = 0; for (let i = iO; i < iA; i++) E = Math.max(E, rec.Qmv[i] / MV_AREA);
  const vc = vcShare * E, pts = [];
  let parts = [], reach = 0;
  for (let i = iO; i < iA; i++) {
    const U = rec.Qmv[i] / MV_AREA;
    if (U > 0) parts.push({ x: 0, v: U, m: rec.Qmv[i] * dt });
    const G = (rec.Plv[i] - rec.Plv[Math.min(n - 1, i + k)]) * MMHG / (RHO * L);
    for (const q of parts) { q.v += dt * G; q.x += dt * q.v; }
    parts = parts.filter((q) => q.x >= 0 && q.x < L).sort((a, b) => b.x - a.x);
    const merged = [];
    for (const q of parts) {
      const last = merged[merged.length - 1];
      if (last && q.x >= last.x) { const m = last.m + q.m; last.v = (last.v * last.m + q.v * q.m) / m; last.m = m; }
      else merged.push(q);
    }
    parts = merged;
    const front = parts.find((q) => q.v >= vc);
    const x = front ? front.x : 0;
    if (x > reach && x <= 4) pts.push([rec.t[i], x]);
    reach = Math.max(reach, x);
    if (reach > 4) break;
  }
  return { vp: slope(pts), E };
}

// ---------- C. surrogate ----------
// Vp = (τN/τ)·(c0 + c1·max(0, EF − 30%)): relaxation scales the whole velocity, and restoring forces,
// represented by the ejection fraction, add to it in the ventricle that empties well (Ohte 2001).
// c0 is set so that the dilated HFrEF ventricle has the Vp of reduced-EF patients (about 37 cm/s,
// Garcia 2000) and c1 so that the normal ventricle has about 70 cm/s (controls 74 cm/s in Takatsuji 1996).
export const SURR = { c0: 45, c1: 0.93, efBreak: 30 };
export function vpSurrogate(tauMs, ef) {
  return (TAU_N / tauMs) * (SURR.c0 + SURR.c1 * Math.max(0, ef * 100 - SURR.efBreak));
}
// The alternative restoring-force term: end-systolic volume index below Ohte's break point of 41 mL/m²
function vpSurrogateESVI(tauMs, esvi) {
  return (TAU_N / tauMs) * (45 + 2.5 * Math.max(0, 41 - esvi));
}

function slope(pts) {
  if (pts.length < 3) return NaN;
  const mt = pts.reduce((a, q) => a + q[0], 0) / pts.length, mx = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  let sxy = 0, stt = 0;
  for (const [t, x] of pts) { sxy += (t - mt) * (x - mx); stt += (t - mt) ** 2; }
  return sxy / stt;
}

// ---------- tables ----------
const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const rows = CASES.map(([name, p, cond]) => {
  const sol = solveCond(p, cond), o = readout(sol), e = o.echo, r = sol.r;
  const vpC = vpSurrogate(e.tauMs, o.EF), vpD = vpSurrogateESVI(e.tauMs, r.lv.ESV / BSA);
  const jFree = jet(r, 0), jLead = jet(r, 0.02);
  return { name, tau: e.tauMs, esvi: r.lv.ESV / BSA, ef: o.EF * 100, lap: o.LAP, E: e.E, ep: e.ep, Eep: e.Eep,
    vpA: axial(r), vpB0: jFree.vp, vpB: jLead.vp, vpC, vpD };
});

console.log('\nTable 1. Model state and the three candidate Vp values (cm/s)\n');
console.log('| Case | τ, ms | ESVI, mL/m² | EF, % | Mean LAP, mmHg | E, cm/s | A: axial | B: free jet | B: jet with gradient | C: surrogate |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const x of rows) console.log(`| ${x.name} | ${f(x.tau)} | ${f(x.esvi)} | ${f(x.ef)} | ${f(x.lap, 1)} | ${f(x.E)} | ${f(x.vpA)} | ${f(x.vpB0)} | ${f(x.vpB)} | ${f(x.vpC)} |`);

const ratio = (k) => rows.map((x) => x.E / x[k]);
const span = (a) => `${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)}`;
console.log(`\nE/Vp across all cases: free jet ${span(ratio('vpB0'))}, jet with gradient ${span(ratio('vpB'))}, surrogate ${span(ratio('vpC'))}`);
console.log(`Free jet E/Vp: normal ${ratio('vpB0')[0].toFixed(2)}, grade IV ${ratio('vpB0')[4].toFixed(2)}`);
console.log(`Largest effect of the gradient on the jet front: ${Math.max(...rows.map((x) => Math.abs(x.vpB - x.vpB0))).toFixed(1)} cm/s`);

console.log('\nTable 2. Surrogate C: E/Vp against E/e′ and mean LA pressure\n');
console.log('| Case | Mean LAP, mmHg | Vp, cm/s | E/Vp | PCWP from E/Vp (Garcia 1997), mmHg | E/e′ | PCWP from E/e′ (Nagueh 1997), mmHg |');
console.log('|---|---|---|---|---|---|---|');
for (const x of rows) {
  const r = x.E / x.vpC;
  console.log(`| ${x.name} | ${f(x.lap, 1)} | ${f(x.vpC)} | ${f(r, 2)} | ${f(5.27 * r + 4.6, 1)} | ${f(x.Eep, 1)} | ${f(1.24 * x.Eep + 1.9, 1)} |`);
}

console.log('\nTable 3. The ESVI form of the restoring-force term, where it differs\n');
console.log('| Case | ESVI, mL/m² | Vp, EF form | Vp, ESVI form | E/Vp, ESVI form |');
console.log('|---|---|---|---|---|');
for (const x of rows) console.log(`| ${x.name} | ${f(x.esvi)} | ${f(x.vpC)} | ${f(x.vpD)} | ${f(x.E / x.vpD, 2)} |`);
