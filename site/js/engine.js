// Closed-loop time-varying elastance model of the circulation.
// Units: time s, volume mL, pressure mmHg, resistance mmHg·s/mL, compliance mL/mmHg.
// Pure functions only (no DOM) so the same file runs in the browser and in node tests.
// The R reference implementation in R/va_model.R mirrors this file line for line.

export const WU = 0.06;          // 1 Wood unit = 1 mmHg·min/L = 0.06 mmHg·s/mL
export const DYN = 1 / 1333.22;  // 1 dyn·s·cm^-5 = 1/1333.22 mmHg·s/mL
export const MMHG_ML_TO_J = 1.33322e-4;

// Normal adult reference parameters. The comments give the physiological meaning;
// sources for the calibration targets are listed in README.md and on references.html.
export const NORMAL = Object.freeze({
  hr: 70,             // beats/min
  // Left ventricle
  lvEes: 2.3,         // end-systolic elastance (contractility), mmHg/mL
  lvV0: 10,           // ESPVR volume intercept, mL
  lvA: 0.22,          // EDPVR scale, mmHg
  lvBeta: 0.029,      // EDPVR stiffness, 1/mL
  // Right ventricle
  rvEes: 0.50,
  rvV0: 15,
  rvA: 0.25,
  rvBeta: 0.026,
  // Systemic circulation (3-element Windkessel + venous reservoir)
  svr: 0.95,          // systemic vascular resistance, mmHg·s/mL (~1270 dyn·s·cm^-5)
  cSys: 1.3,          // total systemic arterial compliance, mL/mmHg
  zcAo: 0.035,        // aortic characteristic impedance, mmHg·s/mL
  cSv: 45,            // systemic venous compliance (incl. RA), mL/mmHg
  rTv: 0.004,         // tricuspid inflow resistance
  // Pulmonary circulation
  pvr: 0.8 * WU,      // pulmonary vascular resistance, mmHg·s/mL (clinical PVR ≈ 1 WU once Zc is included)
  cPa: 3.4,           // pulmonary arterial compliance, mL/mmHg
  zcPa: 0.012,        // pulmonary characteristic impedance
  cPv: 16,            // pulmonary venous compliance (incl. LA), mL/mmHg
  rMv: 0.004,         // mitral inflow resistance
  // Blood volume
  vStressed: 740,     // total stressed volume in the circuit, mL (unstressed volume omitted)
});

// Double-Hill activation (Stergiopulos et al. 1996), with the time to peak
// elastance scaled to the cardiac period: Tmax = 0.2 + 0.15·T.
function makeActivation(T) {
  const tmax = 0.2 + 0.15 * T;
  const tau1 = 0.67 * tmax, tau2 = 1.13 * tmax, m1 = 1.32, m2 = 27.4;
  const raw = (t) => {
    const g1 = Math.pow(t / tau1, m1), g2 = Math.pow(t / tau2, m2);
    return (g1 / (1 + g1)) * (1 / (1 + g2));
  };
  // normalise so that max e(t) = 1 and record the time of peak (= end-systole)
  let peak = 0, tPeak = 0;
  for (let t = 0; t <= T; t += T / 4000) {
    const v = raw(t);
    if (v > peak) { peak = v; tPeak = t; }
  }
  const e = (t) => raw(t) / peak;
  return { e, tPeak };
}

function ventP(V, e, Ees, V0, A, beta) {
  return e * Ees * (V - V0) + (1 - e) * A * (Math.exp(beta * (V - V0)) - 1);
}

// state = [Vlv, Vsa, Vsv, Vrv, Vpa, Vpv]; arterial compartments hold stressed volume.
function pressures(s, e, p) {
  const Plv = ventP(s[0], e, p.lvEes, p.lvV0, p.lvA, p.lvBeta);
  const Prv = ventP(s[3], e, p.rvEes, p.rvV0, p.rvA, p.rvBeta);
  const Psa = s[1] / p.cSys, Psv = s[2] / p.cSv;
  const Ppa = s[4] / p.cPa, Ppv = s[5] / p.cPv;
  const Qao = Plv > Psa ? (Plv - Psa) / p.zcAo : 0;   // aortic valve + Zc
  const Qmv = Ppv > Plv ? (Ppv - Plv) / p.rMv : 0;    // mitral valve
  const Qpv = Prv > Ppa ? (Prv - Ppa) / p.zcPa : 0;   // pulmonic valve + Zc
  const Qtv = Psv > Prv ? (Psv - Prv) / p.rTv : 0;    // tricuspid valve
  const Qsys = (Psa - Psv) / p.svr;
  const Qpul = (Ppa - Ppv) / p.pvr;
  return { Plv, Prv, Psa, Psv, Ppa, Ppv, Qao, Qmv, Qpv, Qtv, Qsys, Qpul };
}

function deriv(s, e, p) {
  const q = pressures(s, e, p);
  return [
    q.Qmv - q.Qao,
    q.Qao - q.Qsys,
    q.Qsys - q.Qtv,
    q.Qtv - q.Qpv,
    q.Qpv - q.Qpul,
    q.Qpul - q.Qmv,
  ];
}

function initialState(p) {
  // rough distribution of the stressed volume; the loop converges from here
  const V = p.vStressed;
  const s = [p.lvV0 + 100, 150, 0, p.rvV0 + 110, 60, 0];
  const rest = V - (s[0] - p.lvV0) - s[1] - (s[3] - p.rvV0) - s[4];
  s[2] = rest * 0.8; s[5] = rest * 0.2;
  // ventricles hold their own unstressed V0, which is not part of vStressed
  return s;
}

function simulateBeat(s0, p, act, T, dt, record) {
  const n = Math.round(T / dt);
  let s = s0.slice();
  const rec = record ? { t: [], Vlv: [], Plv: [], Pao: [], Vrv: [], Prv: [], Ppa: [], Psv: [], Ppv: [], Qao: [], Qpv: [] } : null;
  const add = (a, k, h) => a.map((x, i) => x + h * k[i]);
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    if (rec) {
      const q = pressures(s, act.e(t), p);
      rec.t.push(t); rec.Vlv.push(s[0]); rec.Plv.push(q.Plv);
      rec.Pao.push(q.Psa + q.Qao * p.zcAo);
      rec.Vrv.push(s[3]); rec.Prv.push(q.Prv);
      rec.Ppa.push(q.Ppa + q.Qpv * p.zcPa);
      rec.Psv.push(q.Psv); rec.Ppv.push(q.Ppv);
      rec.Qao.push(q.Qao); rec.Qpv.push(q.Qpv);   // outflow, mL/s (for synthetic Doppler)
    }
    const e1 = act.e(t), e2 = act.e(t + dt / 2), e3 = act.e(t + dt);
    const k1 = deriv(s, e1, p);
    const k2 = deriv(add(s, k1, dt / 2), e2, p);
    const k3 = deriv(add(s, k2, dt / 2), e2, p);
    const k4 = deriv(add(s, k3, dt), e3, p);
    s = s.map((x, j) => x + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return { s, rec };
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

function ventricleMetrics(V, P, Part, tIdxEs, Ees, V0, hr) {
  const EDV = Math.max(...V), ESV = Math.min(...V);
  const SV = EDV - ESV;
  const Pes = P[tIdxEs];                       // pressure at peak elastance (end-systole)
  const Ea = Pes / SV;
  const SW = loopArea(V, P);
  const PE = 0.5 * Pes * (ESV - V0);           // potential energy (Suga), EDPVR area neglected
  const PVA = SW + PE;
  const iED = V.indexOf(EDV);
  return {
    EDV, ESV, SV, EF: SV / EDV, CO: SV * hr / 1000,
    Pes, Ees, Ea, EaEes: Ea / Ees, EesEa: Ees / Ea,
    EDP: P[iED],
    Pmax: Math.max(...P),
    SW, PVA, eff: SW / PVA,
    SWJ: SW * MMHG_ML_TO_J,
    // single-beat surrogates used clinically
    svEsv: SV / ESV,                           // volume method: assumes V0 = 0
    pIso: Ees * (EDV - V0),                    // isovolumic Pmax this ventricle would generate
    artMax: Math.max(...Part), artMin: Math.min(...Part), artMean: mean(Part),
  };
}

/**
 * Run the model to beat-to-beat steady state and return the last beat.
 * @param {object} params  parameter set (see NORMAL); missing keys fall back to NORMAL
 * @param {object} [opt]   { dt, maxBeats, tol, state }
 */
export function simulate(params, opt = {}) {
  const p = { ...NORMAL, ...params };
  const dt = opt.dt ?? 0.0005, maxBeats = opt.maxBeats ?? 200, tol = opt.tol ?? 0.05;
  const T = 60 / p.hr;
  const act = makeActivation(T);
  let s = opt.state ? opt.state.slice() : initialState(p);
  // rescale a warm-start state so it carries exactly this stressed volume
  if (opt.state) {
    const cur = s[0] - p.lvV0 + s[1] + s[2] + s[3] - p.rvV0 + s[4] + s[5];
    const d = p.vStressed - cur;
    s[2] += d * 0.8; s[5] += d * 0.2;
  }
  let beats = 0, converged = false;
  for (; beats < maxBeats; beats++) {
    const { s: s1 } = simulateBeat(s, p, act, T, dt, false);
    const diff = Math.max(...s1.map((x, i) => Math.abs(x - s[i])));
    s = s1;
    if (diff < tol) { converged = true; break; }
  }
  const startState = s.slice();
  const { rec } = simulateBeat(s, p, act, T, dt, true);
  const iEs = Math.round(act.tPeak / dt);
  const lv = ventricleMetrics(rec.Vlv, rec.Plv, rec.Pao, iEs, p.lvEes, p.lvV0, p.hr);
  const rv = ventricleMetrics(rec.Vrv, rec.Prv, rec.Ppa, iEs, p.rvEes, p.rvV0, p.hr);
  const RAP = mean(rec.Psv), LAP = mean(rec.Ppv);
  const coLmin = lv.CO;
  const hemo = {
    SBP: lv.artMax, DBP: lv.artMin, MAP: lv.artMean,
    PASP: rv.artMax, PADP: rv.artMin, mPAP: rv.artMean,
    RAP, LAP,
    CO: coLmin, CI: coLmin / 1.9,
    SVR_dyn: (lv.artMean - RAP) / coLmin * 80,
    PVR_WU: (rv.artMean - LAP) / coLmin,
    PAC: rv.SV / (rv.artMax - rv.artMin),
    SAC: lv.SV / (lv.artMax - lv.artMin),
  };
  hemo.RC = hemo.PVR_WU * WU * hemo.PAC;       // pulmonary RC time, s
  hemo.PAPi = (hemo.PASP - hemo.PADP) / Math.max(RAP, 1);
  // Ea as clinicians approximate it: 0.9·SBP / SV (Kelly 1992)
  lv.EaClin = 0.9 * hemo.SBP / lv.SV;
  // RV: Ea ≈ mPAP/SV is a common invasive approximation
  rv.EaClin = hemo.mPAP / rv.SV;
  rv.pmaxRatio = rv.pIso / rv.Pes - 1;          // single-beat Pmax/Pes − 1 (Brimioulle 2003)
  return { params: p, T, dt, tEs: act.tPeak, beats, converged, rec, lv, rv, hemo, state: startState };
}

// ESPVR / Ea line endpoints for plotting.
export function couplingLines(m, V0) {
  return {
    espvr: [[V0, 0], [m.ESV + (m.EDV - m.ESV) * 0.6, m.Ees * (m.ESV + (m.EDV - m.ESV) * 0.6 - V0)]],
    ea: [[m.ESV, m.Pes], [m.EDV, 0]],
  };
}
