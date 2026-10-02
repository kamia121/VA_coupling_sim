// Pericardial disease on the engine: the cases, and the measures that separate them. Pure functions
// (no DOM), so the same file runs in the browser and in the node tests.
import { cardiacPhases } from './engine.js';
import { runBeats, beatTable, variation, pleural, BREATHS } from './beats.js';

// Pericardial pressure rises as the exponential of the volume enclosed above a reserve volume V0
// (engine.js). Effusion adds volume to the enclosed total, which uses up the reserve; constriction is a
// shell that is stiff (a large λ) with little reserve, so the pericardial pressure rather than the venous
// return fixes the volume of the heart. Restriction leaves the pericardium alone and stiffens the myocardium.
export const CASES = {
  normal: { label: 'Normal pericardium', params: {} },
  tamponade: { label: 'Pericardial effusion', params: { pcdFluid: 230 } },
  // fluid retention (a larger stressed volume) raises the venous pressure that a stiff shell would otherwise leave near normal
  constriction: { label: 'Constrictive pericarditis', params: { vStressed: 1150, pcdV0: 245, pcdLambda: 0.15, pcdP0: 1.0 } },
  restriction: { label: 'Restrictive cardiomyopathy', params: { lvBeta: 0.075, lvA: 0.6, rvBeta: 0.05 } },
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// Systolic pressure–time area of a ventricle: from the start of isovolumic contraction to the end of ejection.
function systolicArea(r, side) {
  const ph = cardiacPhases(r)[side].events, rec = r.rec, P = side === 'lv' ? rec.Plv : rec.Prv;
  let a = 0;
  for (let i = ph.inClose; i < ph.outClose; i++) a += P[i] * r.dt;
  return a;
}

// Measures from a run of beats under a breath (BREATHS.spont for a spontaneous breath). Inspiratory beats are
// those that start while the pleural pressure is below half its lowest value; expiratory beats those that start
// within a tenth of it; the beats between are left out so the two groups are distinct.
export function measure(run) {
  const rows = beatTable(run), lo = Math.min(...rows.map((x) => x.ppl)), hi = Math.max(...rows.map((x) => x.ppl));
  const swing = lo < -0.5 ? lo : hi;
  const side = (x) => (swing < 0 ? x.ppl < 0.5 * swing : x.ppl > 0.5 * swing);
  const exp = (x) => (swing < 0 ? x.ppl > 0.1 * swing : x.ppl < 0.1 * swing);
  const idx = (f) => rows.map((x, i) => (f(x) ? i : -1)).filter((i) => i >= 0);
  const I = idx(side), E = idx(exp);
  const m = (ix, f) => mean(ix.map((i) => f(rows[i], run.beats[i].r)));
  // wedge pressure is taken as the mean pulmonary venous pressure, which the catheter transmits through the
  // capillary bed; the pericardial pressure is the pressure around the chambers, including the pleural share
  const wedge = (x) => x.Ppv, peri = (x) => x.Ppcd + x.ppl;
  const sai = (ix) => mean(ix.map((i) => systolicArea(run.beats[i].r, 'rv'))) / mean(ix.map((i) => systolicArea(run.beats[i].r, 'lv')));
  return {
    rows, nInsp: I.length, nExp: E.length,
    // inspiratory fall in systolic pressure: the highest to the lowest systolic pressure over whole breaths
    sbpFall: variation(rows, 'SBP').range,
    // mean pressures in expiration and inspiration
    rapExp: m(E, (x) => x.RAP), rapInsp: m(I, (x) => x.RAP),
    wedgeExp: m(E, wedge), wedgeInsp: m(I, wedge),
    lvedpExp: m(E, (x) => x.LVEDP), lvedpInsp: m(I, (x) => x.LVEDP),
    rvedpExp: m(E, (x) => x.RVEDP), rvedpInsp: m(I, (x) => x.RVEDP),
    // wedge minus pericardial pressure: the transmural pulmonary venous pressure (Boltwood 1987)
    wmpExp: m(E, (x) => wedge(x) - peri(x)), wmpInsp: m(I, (x) => wedge(x) - peri(x)),
    // wedge minus LV end-diastolic pressure
    gradExp: m(E, (x) => wedge(x) - x.LVEDP), gradInsp: m(I, (x) => wedge(x) - x.LVEDP),
    // systolic area index (Talreja 2008): RV to LV systolic pressure–time area, inspiration over expiration
    sai: sai(I) / sai(E),
    // ventricular interdependence: the LV fills less and the RV more in inspiration
    lvEdvExp: m(E, (x, r) => r.lv.EDV), lvEdvInsp: m(I, (x, r) => r.lv.EDV),
    rvEdvExp: m(E, (x, r) => r.rv.EDV), rvEdvInsp: m(I, (x, r) => r.rv.EDV),
    lvSvExp: m(E, (x, r) => r.lv.SV), lvSvInsp: m(I, (x, r) => r.lv.SV),
    rvSvExp: m(E, (x, r) => r.rv.SV), rvSvInsp: m(I, (x, r) => r.rv.SV),
    co: run.base.hemo.CO, sv: mean(rows.map((x) => x.SV)),
  };
}

export { runBeats, beatTable, variation, pleural, BREATHS };
