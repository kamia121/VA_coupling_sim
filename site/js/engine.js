// Closed-loop time-varying elastance model of the circulation.
// Units: time s, volume mL, pressure mmHg, resistance mmHg·s/mL, compliance mL/mmHg.
// Pure functions only (no DOM) so the same file runs in the browser and in node tests.

export const WU = 0.06;          // 1 Wood unit = 1 mmHg·min/L = 0.06 mmHg·s/mL
export const DYN = 1 / 1333.22;  // 1 dyn·s·cm^-5 = 1/1333.22 mmHg·s/mL
export const MMHG_ML_TO_J = 1.33322e-4;

// Switchable mechanisms. 1 = on (default), 0 = off. With every switch off the model
// reduces to the eight-compartment model without interaction, reflexes, or ischemia.
export const MECHANISMS = [
  ['pericardium', 'Pericardium'],
  ['septum', 'Septal interdependence'],
  ['baseDescent', 'c wave and base descent'],
  ['relax', 'Relaxation time constant'],
  ['ffr', 'Force–frequency relation'],
  ['baro', 'Baroreflex'],
  ['coronary', 'Coronary perfusion'],
];

// Normal adult reference parameters. The comments give the physiological meaning;
// sources for the calibration targets are listed in README.md and on references.html.
export const NORMAL = Object.freeze({
  hr: 70,             // intrinsic heart rate, beats/min (the baroreflex adjusts it)
  // Left ventricle (free wall when the septum is on)
  lvEes: 2.3,         // end-systolic elastance (contractility), mmHg/mL
  lvV0: 10,           // ESPVR volume intercept, mL
  lvA: 0.22,          // EDPVR scale, mmHg
  lvBeta: 0.029,      // EDPVR stiffness, 1/mL
  // Right ventricle
  rvEes: 0.45,
  rvV0: 15,
  rvA: 0.25,
  rvBeta: 0.026,
  // Systemic circulation (3-element Windkessel + venous reservoir)
  svr: 0.95,          // systemic vascular resistance, mmHg·s/mL (~1270 dyn·s·cm^-5)
  cSys: 1.3,          // total systemic arterial compliance, mL/mmHg
  zcAo: 0.035,        // aortic characteristic impedance, mmHg·s/mL
  cSv: 40,            // systemic venous compliance, mL/mmHg
  rSvRa: 0.01,        // caval inflow resistance into the RA (no valve), mmHg·s/mL
  rTv: 0.004,         // tricuspid inflow resistance
  // Pulmonary circulation
  pvr: 0.8 * WU,      // pulmonary vascular resistance, mmHg·s/mL (clinical PVR ≈ 1 WU once Zc is included)
  cPa: 3.4,           // pulmonary arterial compliance, mL/mmHg
  zcPa: 0.012,        // pulmonary characteristic impedance
  cPv: 13,            // pulmonary venous compliance, mL/mmHg
  rPvLa: 0.01,        // pulmonary venous inflow resistance into the LA (no valve)
  rMv: 0.004,         // mitral inflow resistance
  // Atria: time-varying elastance, P = [Emin + a(t)·(Emax − Emin)]·(V − V0)
  laEmax: 1.4, laEmin: 0.2, laV0: 10,
  raEmax: 0.5, raEmin: 0.14, raV0: 10,
  pr: 0.16,           // P-wave onset to QRS (start of ventricular activation), s
  aDelay: 0.05,       // P-wave onset to the start of atrial contraction (tissue Doppler: ~37 ms RA, ~56 ms LA), s
  aDur: 0.17,         // duration of atrial contraction, s
  aKick: 1,           // atrial contraction strength: 1 sinus, 0 none (atrial fibrillation)
  aShift: 0,          // s added to atrial timing; > PR puts atrial systole inside ventricular systole (AV dissociation)
  // Blood volume
  vStressed: 705,     // total stressed volume in the circuit, mL (unstressed volume omitted)

  // ---- Mechanism switches
  pericardium: 1, septum: 1, baseDescent: 1, relax: 1, ffr: 1, baro: 1, coronary: 1,

  // Pericardium: P = P0·(exp(λ·(Vheart + fluid − V0)) − 1), added to all four chambers
  pcdP0: 0.5, pcdLambda: 0.03, pcdV0: 285, pcdFluid: 0, pcdPmax: 50,
  // Septum (Smith et al. 2004): time-varying elastance between the ventricles
  sptEes: 48, sptVd: -2, sptA: 1.11, sptBeta: 0.435, sptBetaL: 0.2, sptV0: -3.5,
  // AV-plane descent and leaflet bulging, as changes in effective atrial volume
  baseAlpha: 0.4,     // mL of atrial capacity gained per mL of ventricular emptying (scaled by activation)
  baseExp: 0.4,       // activation is raised to this power, so the AV plane returns more slowly than the ventricle relaxes
  cBulge: 6,          // mL of leaflet displacement into the atrium while the valve is closed
  cP: 1,              // mmHg gradient that half-saturates the bulge
  cFade: 30,          // mL ejected over which the bulge gives way to the AV-plane descent
  // Relaxation: monoexponential fall of activation after end-systole
  tau: 0.035,         // s
  // Force–frequency: Ees × (1 + kFFR·(HR − 70)/70), bounded to 0.7–1.4
  kFFR: 0.3,
  // Baroreflex (sigmoid on MAP about the set point)
  mapSet: 96.1,         // mmHg, the calibrated normal MAP
  baroSlope: 14,      // mmHg; smaller is steeper
  gHR: 0.35, gSVR: 0.2, gEes: 0.15, gVol: 200,
  hrMax: 160,         // the reflex does not drive the rate above this (or above the intrinsic rate, if higher), /min
  // Coronary supply and demand
  cfr: 5,             // coronary flow reserve (maximal / resting flow)
  lvMass: 1, rvMass: 1,   // muscle mass relative to normal (hypertrophy)
  corL0: 48.15, corR0: 86.55, pvaL0: 10963, pvaR0: 1572,   // perfusion and PVA of the normal heart
  // Valve lesions: stenotic orifice area (cm², 0 = normal) and regurgitant orifice (EROA, cm²)
  avArea: 0, mrEroa: 0, trEroa: 0, arEroa: 0,
  // Effective mitral inflow orifice (cm²) for the Bernoulli term in diastole; 0 = resistance only
  mvArea: 0,
  // Dynamic LVOT obstruction: the outflow orifice narrows as the LV empties below lvoto mL
  // during contraction (0 = off). Area runs from lvotAmax to lvotAmin (cm²) over a width lvotW mL.
  lvoto: 0, lvotW: 5, lvotAmax: 3.5, lvotAmin: 0.2,
});

// Effective LVOT orifice (cm²) at LV volume V and activation e; 0 means unobstructed.
function lvotArea(V, e, p) {
  if (!(p.lvoto > 0)) return 0;
  const closing = Math.min(1, e / 0.25) / (1 + Math.exp((V - p.lvoto) / p.lvotW));
  return p.lvotAmax - (p.lvotAmax - p.lvotAmin) * closing;
}
// Combine two orifices in series (stenotic valve and dynamic LVOT): 1/A² add.
function seriesArea(a, b) {
  if (!(a > 0)) return b; if (!(b > 0)) return a;
  return 1 / Math.sqrt(1 / (a * a) + 1 / (b * b));
}

// Double-Hill activation (Stergiopulos et al. 1996), with the time to peak
// elastance scaled to the cardiac period: Tmax = 0.2 + 0.15·T. With `relax` on, the falling
// limb is replaced by a monoexponential decay with time constant τ, smoothed at the peak,
// and the tail that has not decayed by the next beat carries into it. Tprev is the length of the beat
// before (it differs from T only in an irregular rhythm), which sets how far that tail has decayed.
// w(t) is the share of e(t) that is still the previous beat's tail (1 at the QRS, 0 from the peak on).
function makeActivation(T, p, Tprev = T) {
  const tmax = 0.2 + 0.15 * T;
  const tau1 = 0.67 * tmax, tau2 = 1.13 * tmax, m1 = 1.32, m2 = 27.4;
  const raw = (t) => {
    const g1 = Math.pow(t / tau1, m1), g2 = Math.pow(t / tau2, m2);
    return (g1 / (1 + g1)) * (1 / (1 + g2));
  };
  let peak = 0, tPeak = 0;
  for (let t = 0; t <= T; t += T / 4000) {
    const v = raw(t);
    if (v > peak) { peak = v; tPeak = t; }
  }
  if (!p.relax) return { e: (t) => raw(t) / peak, w: () => 0, tPeak };
  const d = 0.25 * p.tau;
  const decay = (x) => Math.exp(-(Math.sqrt(x * x + d * d) - d) / p.tau);
  const tPeakPrev = Tprev === T ? tPeak : makeActivation(Tprev, { ...p, relax: 0 }).tPeak;
  const e = (t) => {
    const carry = decay(t + Tprev - tPeakPrev);    // previous beat's tail
    if (t < tPeak) { const r = raw(t) / peak; return r + (1 - r) * carry; }
    return decay(t - tPeak);
  };
  const w = (t) => {
    if (t >= tPeak) return 0;
    const r = raw(t) / peak, c = (1 - r) * decay(t + Tprev - tPeakPrev);
    return c > 0 ? c / (r + c) : 0;
  };
  return { e, w, tPeak };
}

// Atrial activation: a raised-cosine pulse of duration aDur that starts aDelay after the P wave,
// PR seconds before the QRS (t = 0), shifted by aShift; periodic in T.
function makeAtrialActivation(T, p) {
  const onset = (((-p.pr + p.aDelay + p.aShift) % T) + T) % T;
  return (t) => {
    const u = ((((t - onset) % T) + T) % T) / p.aDur;
    return u < 1 ? p.aKick * 0.5 * (1 - Math.cos(2 * Math.PI * u)) : 0;
  };
}

// Pericardial pressure for a total enclosed volume (four chambers + fluid). Above pcdPmax the exponential
// continues as a straight line with the same slope: no pericardium holds more, and the exponential
// alone makes the equations too stiff to integrate when a large heart meets a large effusion.
function pericardialP(vol, p) {
  const x = p.pcdLambda * (vol - p.pcdV0), xm = Math.log(1 + p.pcdPmax / p.pcdP0);
  return x <= xm ? p.pcdP0 * (Math.exp(x) - 1) : p.pcdPmax + (p.pcdPmax + p.pcdP0) * (x - xm);
}

function wallP(V, e, Ees, V0, A, beta) {
  return e * Ees * (V - V0) + (1 - e) * A * (Math.exp(beta * (V - V0)) - 1);
}
function wallDP(V, e, Ees, V0, A, beta) {
  return e * Ees + (1 - e) * A * beta * Math.exp(beta * (V - V0));
}

// Flow through a valve: resistance R in series with a Bernoulli orifice of area A (cm²).
// ΔP = R·Q + (Q / (50·A))², from ΔP = 4v² with v in m/s and Q in mL/s.
function valveFlow(dp, R, A) {
  if (dp <= 0) return 0;
  if (!(A > 0)) return dp / R;
  const k = 1 / (2500 * A * A);
  return (-R + Math.sqrt(R * R + 4 * k * dp)) / (2 * k);
}
// Regurgitant flow through an orifice of area A (cm²); smoothed near zero gradient.
function leak(dp, A) {
  return A > 0 && dp > 0 ? 50 * A * (Math.sqrt(dp + 0.25) - 0.5) : 0;
}

// Septal pressure and its slope. The passive part stiffens in both directions, less steeply
// toward the LV (sptBetaL), so a raised RV diastolic pressure flattens and then inverts the septum.
function septP(x, e, p) {
  const u = x - p.sptV0;
  const pas = u >= 0 ? p.sptA * (Math.exp(p.sptBeta * u) - 1) : -p.sptA * (Math.exp(-p.sptBetaL * u) - 1);
  return e * p.sptEes * (x - p.sptVd) + (1 - e) * pas;
}
function septDP(x, e, p) {
  const u = x - p.sptV0;
  const d = u >= 0 ? p.sptA * p.sptBeta * Math.exp(p.sptBeta * u) : p.sptA * p.sptBetaL * Math.exp(-p.sptBetaL * u);
  return e * p.sptEes + (1 - e) * d;
}

// Septal volume that balances the septal pressure against the transseptal gradient.
function solveSeptum(Vlv, Vrv, e, p, x0, lvEes = p.lvEes, rvEes = p.rvEes) {
  let x = x0;
  for (let i = 0; i < 30; i++) {
    const f = septP(x, e, p)
      - wallP(Vlv - x, e, lvEes, p.lvV0, p.lvA, p.lvBeta)
      + wallP(Vrv + x, e, rvEes, p.rvV0, p.rvA, p.rvBeta);
    const df = septDP(x, e, p)
      + wallDP(Vlv - x, e, lvEes, p.lvV0, p.lvA, p.lvBeta)
      + wallDP(Vrv + x, e, rvEes, p.rvV0, p.rvA, p.rvBeta);
    let dx = f / df;
    if (dx > 20) dx = 20; else if (dx < -20) dx = -20;
    x -= dx;
    if (Math.abs(dx) < 1e-6) break;
  }
  return x;
}

// state = [Vlv, Vsa, Vsv, Vrv, Vpa, Vpv, Vra, Vla]; arterial and venous compartments hold
// stressed volume; ventricles and atria hold total volume (their V0 is unstressed).
// `ctx.spt` carries the last septal volume as the Newton starting point. `ctx.w` is the share of e
// that is still the previous beat's relaxation tail; that share keeps the previous beat's Ees
// (ctx.lvEesP, which differs when the force-frequency relation sees a new RR) and its AV-plane
// reference, so nothing steps at the QRS of an irregular rhythm.
function pressures(s, e, ea, p, ctx) {
  const w = ctx.w;
  const lvEes = p.lvEes + w * (ctx.lvEesP - p.lvEes), rvEes = p.rvEes + w * (ctx.rvEesP - p.rvEes);
  let Vspt = 0;
  if (p.septum) { Vspt = solveSeptum(s[0], s[3], e, p, ctx.spt, lvEes, rvEes); ctx.spt = Vspt; }
  const Ppcd = p.pericardium ? pericardialP(s[0] + s[3] + s[6] + s[7] + p.pcdFluid, p) : 0;
  const Plv = wallP(s[0] - Vspt, e, lvEes, p.lvV0, p.lvA, p.lvBeta) + Ppcd;
  const Prv = wallP(s[3] + Vspt, e, rvEes, p.rvV0, p.rvA, p.rvBeta) + Ppcd;
  const Psa = s[1] / p.cSys, Psv = s[2] / p.cSv;
  const Ppa = s[4] / p.cPa, Ppv = s[5] / p.cPv;
  const Era = p.raEmin + ea * (p.raEmax - p.raEmin), Ela = p.laEmin + ea * (p.laEmax - p.laEmin);
  let VraE = s[6], VlaE = s[7];
  if (p.baseDescent) {
    // descent of the AV plane enlarges the atrium as the ventricle empties;
    // the closed leaflets bulge back into the atrium while ventricular pressure exceeds atrial
    // (the gain follows ventricular activation, so the AV plane returns as the ventricle relaxes).
    // The descent (and the fade of the bulge below) is measured from the ventricular volume at the QRS;
    // the tail share w of e keeps the previous beat's volume, so neither restarts at the QRS.
    const eB = Math.pow(e, p.baseExp);
    const refR = ctx.vR0 + w * (ctx.vR0p - ctx.vR0), refL = ctx.vL0 + w * (ctx.vL0p - ctx.vL0);
    VraE -= p.baseAlpha * eB * (refR - s[3]);
    VlaE -= p.baseAlpha * eB * (refL - s[0]);
    const gR = Prv - (Era * (VraE - p.raV0) + Ppcd), gL = Plv - (Ela * (VlaE - p.laV0) + Ppcd);
    // the bulge starts with ventricular contraction and gives way to the AV-plane descent once the
    // ventricle has ejected cFade mL, so the c wave is followed by the x descent
    const fE = Math.min(1, e / 0.05);
    const fR = fE * Math.max(0, 1 - (refR - s[3]) / p.cFade), fL = fE * Math.max(0, 1 - (refL - s[0]) / p.cFade);
    if (gR > 0) VraE += fR * p.cBulge * gR / (gR + p.cP);
    if (gL > 0) VlaE += fL * p.cBulge * gL / (gL + p.cP);
  }
  const Pra = Era * (VraE - p.raV0) + Ppcd;
  const Pla = Ela * (VlaE - p.laV0) + Ppcd;
  const Qao = valveFlow(Plv - Psa, p.zcAo, seriesArea(p.avArea, lvotArea(s[0], e, p)));   // aortic valve + Zc (+ stenotic or dynamic LVOT orifice)
  const Qar = leak(Psa - Plv, p.arEroa);                 // aortic regurgitation
  const Qmv = valveFlow(Pla - Plv, p.rMv, p.mvArea);     // mitral inflow (+ Bernoulli orifice when mvArea > 0)
  const Qmr = leak(Plv - Pla, p.mrEroa);                 // mitral regurgitation
  const Qpv = valveFlow(Prv - Ppa, p.zcPa, 0);           // pulmonic valve + Zc
  const Qtv = valveFlow(Pra - Prv, p.rTv, 0);            // tricuspid inflow
  const Qtr = leak(Prv - Pra, p.trEroa);                 // tricuspid regurgitation
  const Qsys = (Psa - Psv) / p.svr;
  const Qpul = (Ppa - Ppv) / p.pvr;
  const Qra = (Psv - Pra) / p.rSvRa;                     // venae cavae → RA (can reverse during atrial systole)
  const Qla = (Ppv - Pla) / p.rPvLa;                     // pulmonary veins → LA
  return { Plv, Prv, Psa, Psv, Ppa, Ppv, Pra, Pla, Ppcd, Vspt, Qao, Qar, Qmv, Qmr, Qpv, Qtv, Qtr, Qsys, Qpul, Qra, Qla };
}

function deriv(s, e, ea, p, ctx, out) {
  const q = pressures(s, e, ea, p, ctx);
  out[0] = q.Qmv - q.Qmr + q.Qar - q.Qao;
  out[1] = q.Qao - q.Qar - q.Qsys;
  out[2] = q.Qsys - q.Qra;
  out[3] = q.Qtv - q.Qtr - q.Qpv;
  out[4] = q.Qpv - q.Qpul;
  out[5] = q.Qpul - q.Qla;
  out[6] = q.Qra + q.Qtr - q.Qtv;
  out[7] = q.Qla + q.Qmr - q.Qmv;
  return out;
}

// Stressed volume held in a state (unstressed V0 of the chambers excluded).
function stressed(s, p) {
  return s[0] - p.lvV0 + s[1] + s[2] + s[3] - p.rvV0 + s[4] + s[5] + s[6] - p.raV0 + s[7] - p.laV0;
}

function initialState(p) {
  // rough distribution of the stressed volume; the loop converges from here
  const s = [p.lvV0 + 100, 150, 0, p.rvV0 + 110, 60, 0, p.raV0 + 30, p.laV0 + 40];
  const rest = p.vStressed - stressed(s, p);
  s[2] = rest * 0.8; s[5] = rest * 0.2;
  return s;
}

const REC_KEYS = ['t', 'Vlv', 'Plv', 'Pao', 'Vrv', 'Prv', 'Ppa', 'Psv', 'Ppv', 'Pra', 'Pla', 'Vla', 'Vra',
  'Qao', 'Qar', 'Qpv', 'Qmv', 'Qmr', 'Qtv', 'Qtr', 'aAct', 'eAct', 'Ppcd', 'Vspt'];

// One beat. Always accumulates the per-beat quantities the slow controllers need;
// records every sample when `record` is set.
function simulateBeat(s0, p, act, T, dt, record, ctx) {
  const n = Math.round(T / dt);
  let s = s0.slice();
  const rec = record ? Object.fromEntries(REC_KEYS.map((k) => [k, []])) : null;
  const k1 = new Float64Array(8), k2 = new Float64Array(8), k3 = new Float64Array(8), k4 = new Float64Array(8), y = new Float64Array(8);
  const add = (a, k, h) => { for (let j = 0; j < 8; j++) y[j] = a[j] + h * k[j]; return y; };
  const acc = { map: 0, corL: 0, corR: 0, lvEDV: -Infinity, lvESV: Infinity, rvEDV: -Infinity, rvESV: Infinity,
    swL: 0, swR: 0, pesL: 0, pesR: 0 };
  const iEs = Math.round(act.tPeak / dt);
  // ventricular volumes at this QRS and Ees of this beat, with those of the beat before for its tail
  ctx.vL0p = ctx.vL0 ?? s[0]; ctx.vR0p = ctx.vR0 ?? s[3];
  ctx.lvEesP = ctx.lvEes ?? p.lvEes; ctx.rvEesP = ctx.rvEes ?? p.rvEes;
  ctx.vL0 = s[0]; ctx.vR0 = s[3]; ctx.lvEes = p.lvEes; ctx.rvEes = p.rvEes;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const e0 = act.e(t), a0 = act.a(t);
    ctx.w = act.w(t);
    const q = pressures(s, e0, a0, p, ctx);
    const Pao = q.Psa + q.Qao * p.zcAo;
    acc.map += Pao;
    acc.corL += Math.max(0, Pao - q.Plv) * (1 - e0);          // LV perfused while relaxed
    acc.corR += Math.max(0, Pao - q.Prv);                      // RV perfused through the cycle
    if (s[0] > acc.lvEDV) acc.lvEDV = s[0]; if (s[0] < acc.lvESV) acc.lvESV = s[0];
    if (s[3] > acc.rvEDV) acc.rvEDV = s[3]; if (s[3] < acc.rvESV) acc.rvESV = s[3];
    if (prev) { acc.swL += 0.5 * (q.Plv + prev.Plv) * (prev.Vlv - s[0]); acc.swR += 0.5 * (q.Prv + prev.Prv) * (prev.Vrv - s[3]); }
    if (i === iEs) { acc.pesL = q.Plv; acc.pesR = q.Prv; }
    prev = { Plv: q.Plv, Prv: q.Prv, Vlv: s[0], Vrv: s[3] };
    if (rec) {
      rec.t.push(t); rec.Vlv.push(s[0]); rec.Plv.push(q.Plv); rec.Pao.push(Pao);
      rec.Vrv.push(s[3]); rec.Prv.push(q.Prv); rec.Ppa.push(q.Ppa + q.Qpv * p.zcPa);
      rec.Psv.push(q.Psv); rec.Ppv.push(q.Ppv);
      rec.Pra.push(q.Pra); rec.Pla.push(q.Pla); rec.Vra.push(s[6]); rec.Vla.push(s[7]);
      rec.Qao.push(q.Qao); rec.Qar.push(q.Qar); rec.Qpv.push(q.Qpv);
      rec.Qmv.push(q.Qmv); rec.Qmr.push(q.Qmr); rec.Qtv.push(q.Qtv); rec.Qtr.push(q.Qtr);
      rec.aAct.push(a0); rec.eAct.push(e0); rec.Ppcd.push(q.Ppcd); rec.Vspt.push(q.Vspt);
    }
    const e2 = act.e(t + dt / 2), e3 = act.e(t + dt);
    const a2 = act.a(t + dt / 2), a3 = act.a(t + dt);
    const w2 = act.w(t + dt / 2), w3 = act.w(t + dt);
    deriv(s, e0, a0, p, ctx, k1);
    ctx.w = w2;
    deriv(add(s, k1, dt / 2), e2, a2, p, ctx, k2);
    deriv(add(s, k2, dt / 2), e2, a2, p, ctx, k3);
    ctx.w = w3;
    deriv(add(s, k3, dt), e3, a3, p, ctx, k4);
    for (let j = 0; j < 8; j++) s[j] += (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
  }
  acc.map /= n; acc.corL /= n; acc.corR /= n;
  acc.pvaL = Math.abs(acc.swL) + 0.5 * acc.pesL * Math.max(0, acc.lvESV - p.lvV0);
  acc.pvaR = Math.abs(acc.swR) + 0.5 * acc.pesR * Math.max(0, acc.rvESV - p.rvV0);
  return { s, rec, acc };
}

// Slow controllers, updated once per beat: baroreflex effectors and ischemic depression of Ees.
function initialSlow() { return { map: null, sym: 0.5, ischL: 1, ischR: 1 }; }

// Effective parameters for the next beat, from intrinsic parameters and the slow states.
function effective(p, sl) {
  const q = { ...p };
  const u = p.baro ? 2 * sl.sym - 1 : 0;         // −1 … 1, 0 at the set point
  // bounded, or a fast intrinsic rate plus hypotension spirals: less filling, lower MAP, faster still
  q.hr = Math.min(p.hr * (1 + p.gHR * u), Math.max(p.hr, p.hrMax));
  q.svr = p.svr * (1 + p.gSVR * u);
  q.vStressed = p.vStressed + p.gVol * u;
  const ff = p.ffr ? Math.min(1.4, Math.max(0.7, 1 + p.kFFR * (q.hr - 70) / 70)) : 1;
  const gE = 1 + p.gEes * u;
  q.lvEes = p.lvEes * gE * ff * (p.coronary ? sl.ischL : 1);
  q.rvEes = p.rvEes * gE * ff * (p.coronary ? sl.ischR : 1);
  q.reflex = u; q.ffrFactor = ff;
  return q;
}

function updateSlow(sl, acc, p, q) {
  const k = 0.5;
  sl.map = sl.map == null ? acc.map : sl.map + k * (acc.map - sl.map);
  const target = 1 / (1 + Math.exp((sl.map - p.mapSet) / p.baroSlope));
  sl.sym += k * (target - sl.sym);
  // Coronary supply (perfusion-pressure integral × reserve) against demand (Suga: a·PVA + b, per minute)
  const hr0 = 70;
  // demand per unit of muscle: a hypertrophied ventricle carries a proportionally larger vascular bed
  const mL = p.lvMass, mR = p.rvMass;
  const dL = (0.6 * acc.pvaL / p.pvaL0 / mL + 0.4) * q.hr / hr0, sL = p.cfr * acc.corL / p.corL0;
  const dR = (0.6 * acc.pvaR / p.pvaR0 / mR + 0.4) * q.hr / hr0, sR = p.cfr * acc.corR / p.corR0;
  sl.supplyL = sL / dL; sl.supplyR = sR / dR;
  // Ees falls in proportion to the square root of the supply deficit; the square root damps the
  // spiral in which depressed contraction lowers perfusion pressure further
  const tL = p.coronary ? Math.max(0.3, Math.min(1, sl.ischL * Math.sqrt(sL / dL))) : 1;
  const tR = p.coronary ? Math.max(0.3, Math.min(1, sl.ischR * Math.sqrt(sR / dR))) : 1;
  const dI = Math.abs(tL - sl.ischL) + Math.abs(tR - sl.ischR);
  sl.ischL += k * (tL - sl.ischL); sl.ischR += k * (tR - sl.ischR);
  return dI;
}

// Stroke work = loop area (shoelace), mmHg·mL.
function loopArea(V, P) {
  let a = 0;
  for (let i = 0; i < V.length; i++) {
    const j = (i + 1) % V.length;
    a += V[i] * P[j] - V[j] * P[i];
  }
  return Math.abs(a) / 2;
}

function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function integral(a, dt) { return a.reduce((x, y) => x + y, 0) * dt; }

// Time constant of isovolumic pressure decline: log-linear fit of P from the minimum dP/dt
// until pressure has fallen to within 5 mmHg of the end-diastolic pressure.
function relaxationTau(P, t, iEs, pEnd) {
  let iMin = iEs, dMin = 0;
  for (let i = iEs; i < P.length - 1; i++) {
    const d = (P[i + 1] - P[i]) / (t[i + 1] - t[i]);
    if (d < dMin) { dMin = d; iMin = i; }
  }
  const xs = [], ys = [];
  for (let i = iMin; i < P.length && P[i] > pEnd + 5; i++) { xs.push(t[i]); ys.push(Math.log(P[i])); }
  if (xs.length < 4) return NaN;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return -sxx / sxy;
}

function ventricleMetrics(V, P, Part, tIdxEs, Ees, V0, hr, flows, dt) {
  const EDV = Math.max(...V), ESV = Math.min(...V);
  const Ves = V[tIdxEs];                       // volume at end-systole (with MR or AS it exceeds ESV)
  const SV = EDV - ESV;
  const Pes = P[tIdxEs];                       // pressure at peak elastance (end-systole)
  const Ea = Pes / SV;
  const SW = loopArea(V, P);
  const PE = 0.5 * Pes * (ESV - V0);           // potential energy (Suga), EDPVR area neglected
  const PVA = SW + PE;
  const ejected = integral(flows.out, dt);      // volume through the outflow valve
  const backOut = flows.outBack ? integral(flows.outBack, dt) : 0;
  const backIn = flows.inBack ? integral(flows.inBack, dt) : 0;
  const fwdSV = ejected - backOut;             // net forward stroke volume
  return {
    EDV, ESV, SV, EF: SV / EDV, fwdSV, SVout: ejected, CO: fwdSV * hr / 1000,
    RVol: backIn + backOut, RF: (backIn + backOut) / Math.max(SV, 1e-6),
    Pes, Ves, Ees, Ea, EaEes: Ea / Ees, EesEa: Ees / Ea,
    EDP: P[0],                                 // at the QRS (start of activation)
    Pmax: Math.max(...P),
    SW, PVA, eff: SW / PVA,
    SWJ: SW * MMHG_ML_TO_J,
    // single-beat surrogates used clinically
    svEsv: SV / ESV,                           // volume method: assumes V0 = 0
    pIso: Ees * (EDV - V0),                    // isovolumic Pmax this ventricle would generate
    artMax: Math.max(...Part), artMin: Math.min(...Part), artMean: mean(Part),
  };
}

// Mean circulatory filling pressure: the common pressure at which, with flow stopped and the heart
// relaxed, the stressed volume fills every compartment (vessels by compliance, chambers along their
// diastolic curves, with the pericardium). Septal shift is neglected.
export function filling(q) {
  const chamber = (P, A, beta) => (P > -A ? Math.log(1 + P / A) / beta : -50);
  const heldAt = (P) => {
    // pericardial pressure solves Ppcd = f(heart volume at transmural P − Ppcd)
    let lo = 0, hi = q.pericardium ? Math.max(0, P) + 60 : 0, ppcd = 0;
    const heart = (x) => q.lvV0 + chamber(P - x, q.lvA, q.lvBeta) + q.rvV0 + chamber(P - x, q.rvA, q.rvBeta)
      + q.laV0 + (P - x) / q.laEmin + q.raV0 + (P - x) / q.raEmin;
    if (q.pericardium) {
      for (let i = 0; i < 50; i++) {
        const m = (lo + hi) / 2;
        const f = pericardialP(heart(m) + q.pcdFluid, q);
        if (f > m) lo = m; else hi = m;
      }
      ppcd = (lo + hi) / 2;
    }
    const Pt = P - ppcd;
    return P * (q.cSys + q.cSv + q.cPa + q.cPv) + chamber(Pt, q.lvA, q.lvBeta) + chamber(Pt, q.rvA, q.rvBeta)
      + Pt / q.laEmin + Pt / q.raEmin;
  };
  let lo = -5, hi = 80;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (heldAt(m) < q.vStressed) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

function dist(a, b) { return Math.max(...a.map((x, i) => Math.abs(x - b[i]))); }

/**
 * Run the model to beat-to-beat steady state and return the last beat.
 * @param {object} params  parameter set (see NORMAL); missing keys fall back to NORMAL
 * @param {object} [opt]   { dt, maxBeats, tol, state, slow, holdSlow, prev, prevT }
 */
export function simulate(params, opt = {}) {
  const p = { ...NORMAL, ...params };
  const dt = opt.dt ?? 0.0005, maxBeats = opt.maxBeats ?? 400, tol = opt.tol ?? 0.05;
  // a warm start carries the reflex state; ischemia is always recomputed from an unischemic heart,
  // so the result depends only on the parameters. holdSlow keeps the slow state as given (ischemia
  // included), for beat-by-beat sequences run with maxBeats 0 from a converged state.
  const sl = opt.slow ? (opt.holdSlow ? { ...opt.slow } : { ...opt.slow, ischL: 1, ischR: 1 }) : initialSlow();
  let q = effective(p, sl);
  let s = opt.state && opt.state.length === 8 ? opt.state.slice() : initialState(q);
  // opt.prev: the result for the beat before, in irregular sequences run beat by beat. Its length sets how
  // far its relaxation tail has decayed (opt.prevT gives the length alone), and its ventricular volumes
  // at the QRS and its Ees stay with that tail in the first beat; see pressures(). The length is the one
  // integrated (a whole number of steps), so the tail picks up exactly where that beat left it.
  const pv = opt.prev, prevT = opt.prevT ?? (pv ? pv.rec.t.length * pv.dt : undefined);
  const ctx = { spt: p.sptV0, w: 0, vL0: pv?.state[0] ?? null, vR0: pv?.state[3] ?? null,
    lvEes: pv?.eff.lvEes ?? null, rvEes: pv?.eff.rvEes ?? null };
  let beats = 0, converged = false;
  for (; beats < maxBeats; beats++) {
    // carry the reflex change in venous tone as a change of stressed volume
    const dV = q.vStressed - stressed(s, q);
    s[2] += dV * 0.8; s[5] += dV * 0.2;
    const T = 60 / q.hr;
    const act = makeActivation(T, q);
    act.a = makeAtrialActivation(T, q);
    const { s: s1, acc } = simulateBeat(s, q, act, T, Math.max(dt, 0.001), false, ctx);
    const dS = dist(s1, s);
    // hold the controllers until the circulation itself has nearly settled
    const dSlow = dS < 2 || beats > 20 ? updateSlow(sl, acc, p, q) : 1;
    const q1 = effective(p, sl);
    const dQ = Math.abs(q1.hr - q.hr) + Math.abs(q1.vStressed - q.vStressed) + Math.abs(q1.lvEes - q.lvEes) * 10
      + Math.abs(q1.rvEes - q.rvEes) * 10 + Math.abs(q1.svr - q.svr) * 10;
    s = s1; q = q1;
    if (dS < tol && dSlow < 5e-3 && dQ < 0.2) { converged = true; break; }
  }
  const dV = q.vStressed - stressed(s, q);
  s[2] += dV * 0.8; s[5] += dV * 0.2;
  const T = 60 / q.hr;
  const act = makeActivation(T, q, beats === 0 && prevT ? prevT : T);
  act.a = makeAtrialActivation(T, q);
  const startState = s.slice();
  const { s: endState, rec, acc } = simulateBeat(s, q, act, T, dt, true, ctx);
  const iEs = Math.round(act.tPeak / dt);
  const lv = ventricleMetrics(rec.Vlv, rec.Plv, rec.Pao, iEs, q.lvEes, q.lvV0, q.hr,
    { out: rec.Qao, outBack: rec.Qar, inBack: rec.Qmr }, dt);
  const rv = ventricleMetrics(rec.Vrv, rec.Prv, rec.Ppa, iEs, q.rvEes, q.rvV0, q.hr,
    { out: rec.Qpv, inBack: rec.Qtr }, dt);
  const RAP = mean(rec.Pra), LAP = mean(rec.Pla);
  lv.tau = relaxationTau(rec.Plv, rec.t, iEs, lv.EDP);
  // LV filling during atrial systole (mitral flow while the atrium is active), as a share of SV
  let aFill = 0;
  for (let i = 0; i < rec.t.length; i++) if (rec.aAct[i] > 0.02) aFill += rec.Qmv[i] * dt;
  // Outflow gradient (aortic valve and LVOT) during ejection
  let gSum = 0, gN = 0, gMax = 0;
  for (let i = 0; i < rec.t.length; i++) if (rec.Qao[i] > 1) { const g = rec.Plv[i] - rec.Pao[i]; gSum += g; gN++; if (g > gMax) gMax = g; }
  // Mean systemic filling pressure (Guyton): the pressure the systemic arteries and veins would share
  // if their stressed volume were redistributed with flow stopped, averaged over the beat
  let vSys = 0;
  for (let i = 0; i < rec.t.length; i++) vSys += (rec.Pao[i] - rec.Qao[i] * q.zcAo) * q.cSys + rec.Psv[i] * q.cSv;
  const Pmsf = vSys / rec.t.length / (q.cSys + q.cSv);
  const coLmin = lv.CO;
  const hemo = {
    SBP: lv.artMax, DBP: lv.artMin, MAP: lv.artMean,
    PASP: rv.artMax, PADP: rv.artMin, mPAP: rv.artMean,
    RAP, LAP,
    CO: coLmin, CI: coLmin / 1.9,
    SVR_dyn: (lv.artMean - RAP) / coLmin * 80,
    PVR_WU: (rv.artMean - LAP) / rv.CO,
    PAC: rv.SVout / (rv.artMax - rv.artMin),
    SAC: lv.SVout / (lv.artMax - lv.artMin),
    Ppcd: mean(rec.Ppcd),
    VsptED: rec.Vspt[rec.Vlv.indexOf(lv.EDV)],
    avMeanGrad: gN ? gSum / gN : 0, avPeakGrad: gMax,
    // venous return: Pmsf − RAP drives it against the resistance to venous return
    Pmsf, Pmcf: filling(q), vrGrad: Pmsf - RAP, Rvr: (Pmsf - RAP) / (coLmin * 1000 / 60),
    ischL: sl.ischL, ischR: sl.ischR,
    supplyL: sl.supplyL, supplyR: sl.supplyR,
  };
  hemo.RC = hemo.PVR_WU * WU * hemo.PAC;       // pulmonary RC time, s
  hemo.atrialFill = aFill / lv.SV;              // share of LV filling during atrial systole
  hemo.PAPi = (hemo.PASP - hemo.PADP) / Math.max(RAP, 1);
  // Ea as clinicians approximate it: 0.9·SBP / SV (Kelly 1992), with SV through the aortic valve
  lv.EaClin = 0.9 * hemo.SBP / lv.SVout;
  // RV: Ea ≈ mPAP/SV is a common invasive approximation
  rv.EaClin = hemo.mPAP / rv.SVout;
  rv.pmaxRatio = rv.pIso / rv.Pes - 1;          // single-beat Pmax/Pes − 1 (Brimioulle 2003)
  const eff = { hr: q.hr, svr: q.svr, vStressed: q.vStressed, lvEes: q.lvEes, rvEes: q.rvEes, reflex: q.reflex, ffr: q.ffrFactor };
  return { params: p, eff, T, dt, tEs: act.tPeak, beats, converged, rec, lv, rv, hemo, state: startState, endState, slow: { ...sl }, acc };
}

// ESPVR, EDPVR and Ea line of one ventricle as the model's chamber sees them, for plotting.
// The free-wall equations (Ees·(V − V0) and A·(exp(β(V − V0)) − 1)) are not what the loop follows:
// the septum moves with the transseptal gradient and the pericardium adds its pressure to every chamber,
// so a stiff or dilated heart, a pressure-loaded RV or an effusion would leave the loop's corners off
// the free-wall lines. Here the chamber pressure is computed with the model's own equations while the
// ventricle's volume is swept and the other chambers are held where they were: fully activated (e = 1)
// with the volumes at end-systole for the ESPVR, fully relaxed (e = 0) with the volumes at end-diastole
// (the QRS) for the EDPVR. The ESPVR therefore passes through the end-systolic point, and the end-diastolic
// point lies on the EDPVR unless relaxation is still incomplete at the QRS, when it sits above it.
export function pvRelations(r, side, xmax, n = 60) {
  const q = effective(r.params, r.slow), rec = r.rec, m = r[side], lv = side === 'lv';
  const iEs = Math.round(r.tEs / r.dt), V0 = lv ? q.lvV0 : q.rvV0;
  const curve = (i, e) => {
    const s = [rec.Vlv[i], 0, 0, rec.Vrv[i], 0, 0, rec.Vra[i], rec.Vla[i]];
    const ctx = { spt: rec.Vspt[i], w: 0, lvEesP: q.lvEes, rvEesP: q.rvEes, vL0: s[0], vL0p: s[0], vR0: s[3], vR0p: s[3] };
    const P = (v) => { s[lv ? 0 : 3] = v; const pr = pressures(s, e, 0, q, ctx); return lv ? pr.Plv : pr.Prv; };
    // start where the chamber pressure crosses zero, so the line leaves the volume axis; always n + 1
    // points, so two relations can be interpolated point by point
    let a = 0, b = xmax;
    if (P(a) < 0 && P(b) > 0) for (let k = 0; k < 40; k++) { const c = (a + b) / 2; if (P(c) < 0) a = c; else b = c; }
    else b = 0;
    const pts = [];
    for (let k = 0; k <= n; k++) { const v = b + (xmax - b) * k / n; pts.push([v, P(v)]); }
    return pts;
  };
  const espvr = curve(iEs, 1), edpvr = curve(0, 0);
  return { V0, Ees: m.Ees, espvr, edpvr, ea: [[m.Ves, m.Pes], [m.EDV, 0]], es: [m.Ves, m.Pes], ed: [lv ? rec.Vlv[0] : rec.Vrv[0], m.EDP] };
}

// Chamber pressure on a relation at volume V (linear interpolation), for drag handles and labels.
export function relationAt(pts, V) {
  if (V <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (V <= pts[i][0]) {
    const [v1, p1] = pts[i - 1], [v2, p2] = pts[i];
    return p1 + (p2 - p1) * (V - v1) / (v2 - v1);
  }
  return pts[pts.length - 1][1];
}

// ESPVR / Ea line for plotting (see pvRelations), the ESPVR cut short above the end-systolic point.
export function couplingLines(r, side) {
  const R = pvRelations(r, side, r[side].Ves + (r[side].EDV - r[side].Ves) * 0.6, 30);
  return { espvr: R.espvr, ea: R.ea };
}

// Cardiac phases and valve events for one recorded beat.
// ph[i] ∈ fill | ivc | eject | ivr. Events are sample indices:
// inClose (MVC/TVC), outOpen (AVO/PVO), outClose (AVC/PVC), inOpen (MVO/TVO).
export function cardiacPhases(r) {
  const n = r.rec.t.length, res = {};
  for (const s of ['lv', 'rv']) {
    // forward flow while the ventricle is still relaxed (e < 0.05) is driven by atrial contraction in
    // late diastole (a stiff or failing ventricle facing a low diastolic outflow pressure) and counts as filling
    const out = (i) => (s === 'lv' ? r.rec.Qao[i] > 0 : r.rec.Qpv[i] > 0) && (!r.rec.eAct || r.rec.eAct[i] > 0.05 || i > n / 2 && r.rec.eAct[i] > 0.02);
    const inflow = (i) => (s === 'lv' ? r.rec.Pla[i] > r.rec.Plv[i] : r.rec.Pra[i] > r.rec.Prv[i]);
    let outOpen = n, outClose = n;
    for (let i = 0; i < n; i++) if (out(i)) { outOpen = i; break; }
    for (let i = outOpen; i < n; i++) if (!out(i)) { outClose = i; break; }
    const ph = new Array(n);
    for (let i = 0; i < n; i++) {
      if (out(i)) ph[i] = 'eject';
      else if (inflow(i)) ph[i] = 'fill';
      else ph[i] = i < outOpen ? 'ivc' : 'ivr';
    }
    let inClose = 0, inOpen = n;
    for (let i = 0; i < outOpen; i++) if (ph[i] === 'fill') inClose = i + 1;   // last filling sample before contraction
    for (let i = outClose; i < n; i++) if (ph[i] === 'fill') { inOpen = i; break; }
    res[s] = { ph, events: { inClose, outOpen, outClose, inOpen } };
  }
  return res;
}
