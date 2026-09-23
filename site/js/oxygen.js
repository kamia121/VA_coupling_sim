// Oxygen and CO2 transport by the Fick principle, and the illustrative tissue-perfusion markers
// of the shock lab. Pure functions, no DOM.
//
// The Fick relations are identities. Lactate, capillary refill time, and critical closing pressure
// are illustrative teaching functions with the right direction of change; their numbers are not
// calibrated to patients.

export const O2 = Object.freeze({
  weight: 70,          // kg
  hb: 12,              // g/dL
  sao2: 0.97,
  pao2: 90,            // mmHg
  vo2kg: 3.0,          // resting O2 demand, mL/min/kg (sedated ICU patient)
  rq: 0.8,
  erCrit: 0.6,         // O2 extraction ratio above which VO2 becomes supply dependent (Ronco 1993: 0.59–0.61)
  erMax: 0.75,         // maximal extraction ratio (Ronco 1993: 0.74–0.80)
  gapRef: 4,           // PCO2 gap, mmHg, at the normal cardiac output
  coRef: 5.56,         // L/min, the model's normal cardiac output
  lacRef: 1.0,         // mmol/L
  lacHalf: 30,         // min, lactate half-life at normal hepatic flow (illustrative)
  vwRef: 25,           // mmHg, vascular waterfall (Pcc − Pmsf) at normal arteriolar tone (illustrative)
  crtRef: 2.0,         // s
  lvotArea: 3.46,      // cm², LVOT of 2.1 cm diameter
  tapseRef: 22,        // mm at the normal RV stroke volume
});

// Arterial O2 content (mL/dL), delivery (mL/min), and the supply-dependent consumption.
export function oxygen(co, o = {}) {
  const k = { ...O2, ...o };
  const cao2 = 1.34 * k.hb * k.sao2 + 0.003 * k.pao2;
  const do2 = co * cao2 * 10;
  const vo2d = k.vo2kg * k.weight * (k.vo2Factor ?? 1);
  const erNeed = vo2d / do2;
  // biphasic DO2–VO2 relation: consumption is independent of delivery until extraction reaches
  // erCrit, then extraction rises toward erMax and consumption falls with delivery
  const span = k.erMax - k.erCrit;
  const er = erNeed <= k.erCrit ? erNeed : k.erCrit + span * (1 - Math.exp(-(erNeed - k.erCrit) / span));
  const vo2 = er * do2;
  const deficit = Math.max(0, 1 - vo2 / vo2d);       // share of demand not met aerobically
  const svo2 = k.sao2 - vo2 / (co * 1.34 * k.hb * 10);
  // CO2: aerobic production, plus CO2 released by bicarbonate buffering of anaerobic lactic acid
  const vco2 = k.rq * vo2 + k.rq * vo2d * deficit;
  const kGap = k.gapRef * k.coRef / (k.rq * k.vo2kg * k.weight);
  const gap = kGap * vco2 / co;
  return { cao2, do2, do2kg: do2 / k.weight, do2crit: vo2d / k.erCrit, vo2, vo2d, er, deficit, svo2, vco2, gap };
}

// Lactate over dt minutes. Production rises as whole-body extraction climbs past 0.33 (regional
// dysoxia precedes the global critical point), steeply with an O2 deficit, and with β2 stimulation
// (epinephrine); clearance falls with low flow and with hepatic congestion (high CVP).
export function lactateStep(lac, dt, { deficit, er = 0, co, cvp, beta2 = 0, extra = 0 }, o = {}) {
  const k = { ...O2, ...o };
  const kcl0 = Math.LN2 / k.lacHalf;
  const flow = Math.min(1.2, Math.sqrt(co / k.coRef));
  const congest = 1 / (1 + Math.max(0, cvp - 12) / 8);
  const kcl = kcl0 * flow * congest;
  const prod = kcl0 * k.lacRef * (1 + 3 * Math.max(0, er - 0.33) / 0.15 + 40 * deficit + 2.5 * beta2 + extra);
  // exact solution of dL/dt = prod − kcl·L over the step
  const ss = prod / kcl;
  return ss + (lac - ss) * Math.exp(-kcl * dt);
}

// Critical closing pressure: Pmsf plus a vascular waterfall that scales with arteriolar tone.
// Tissue perfusion pressure = MAP − max(Pcc, CVP).
export function perfusion({ map, cvp, pmsf, svrRel, co, pccDrug = 0, alpha = 0 }, o = {}) {
  const k = { ...O2, ...o };
  const pcc = pmsf + k.vwRef * Math.max(0.1, svrRel) * (1 + pccDrug);
  const tpp = map - Math.max(pcc, cvp);
  // skin perfusion index: falls with low flow, low TPP, and strong α-constriction of skin vessels
  const tppRef = 96 - (7.1 + k.vwRef);
  const s = Math.sqrt(Math.max(0.05, co / k.coRef)) * Math.min(1.1, Math.max(0.05, tpp / tppRef)) * (1 - 0.25 * alpha);
  const crt = Math.min(10, k.crtRef * Math.pow(Math.max(0.05, s), -1.3));
  return { pcc, tpp, crt, ppress: map - cvp };
}
