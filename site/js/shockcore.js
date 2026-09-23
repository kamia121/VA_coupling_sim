// Shock lab: a patient whose circulation is re-solved every tick of an accelerated clock while
// drugs, fluids, bleeding and lactate evolve over minutes. Pure functions, no DOM, so node tests
// run the same code. Drug kinetics act over minutes and the circulation settles within beats, so
// each tick solves the quasi-steady state from a warm start.
import { simulate, NORMAL } from './engine.js';
import { presetById } from './presets.js';
import { DRUG, DRUGS, FLUIDS, LEAK, kinetics, combine } from './pharm.js';
import { O2, oxygen, lactateStep, perfusion } from './oxygen.js';

const FS = 0.4;            // share of an intravascular volume change that becomes stressed volume (the rest fills or empties unstressed veins)
const BV0 = 70 * O2.weight; // mL, blood volume
const P = (id) => presetById(id).params;

// Scenarios. `params`: engine parameters. `sepsis`: capillary leak, higher O2 demand, and lactate
// production independent of hypoxia. `bleed`: mL/min until controlled. `drugs`: infusions running
// at the start, at steady state. `actions`: scenario-specific bedside actions.
export const SHOCK = [
  { id: 'normal', label: 'Healthy adult', params: {}, hb: 13.5,
    text: 'A resting adult with normal coupling at every interface. Each drug and fluid can be tried here first, so that its effect on a normal circulation is known before it is given to a patient in shock.' },
  { id: 'hemorrhage', label: 'Hemorrhagic shock', params: {}, hb: 13.5, bleed: 30,
    actions: [['control', 'Control the bleeding']],
    text: 'A previously healthy adult bleeding 30 mL/min. The clock starts at the moment of injury. The baroreflex holds MAP by tachycardia, arteriolar constriction and venous recruitment while stressed volume, Pmsf and cardiac output fall, and hypotension appears late.' },
  { id: 'vasoplegia', label: 'Septic shock with vasoplegia', params: P('vasoplegia'), hb: 11, sepsis: true,
    text: 'Low arteriolar tone with a normal Ees. Cardiac output is high, MAP is low, and ScvO₂ is high although lactate is raised.' },
  { id: 'septicCM', label: 'Septic shock with depressed Ees', params: P('septicCM'), hb: 11, sepsis: true,
    text: 'Vasoplegia with septic myocardial depression. MAP is borderline and cardiac output is lower than in pure vasoplegia, so ScvO₂ is lower and the PCO₂ gap is wider.' },
  { id: 'cardiogenic', label: 'Cardiogenic shock (acute LV failure)',
    params: { lvEes: 0.6, lvV0: 15, lvBeta: 0.035, svr: 1.0, hr: 95, vStressed: 850, kFFR: 0 }, hb: 12.5,
    text: 'An acute fall in LV Ees after a large infarction. Ea/Ees is high, cardiac output is low, and the LA pressure is high, so the LV–arterial interface uncouples and the congestion reaches the lungs.' },
  { id: 'peIschemia', label: 'Acute PE with RV ischemia', params: P('peIschemia'), hb: 13,
    text: 'An acute rise in PVR on an RV without hypertrophy. The RV dilates, the septum shifts, RV perfusion falls short of demand, and the RV Ees falls. The RV–PA interface uncouples and the venous side congests.' },
  { id: 'pahDecomp', label: 'Decompensated PAH', params: P('pahDecomp'), hb: 13,
    text: 'Chronic pulmonary vascular disease with a hypertrophied RV that can no longer match its load. RAP is high and cardiac output is low.' },
  { id: 'tamponade', label: 'Cardiac tamponade', params: P('tamponade'), hb: 13,
    actions: [['drain', 'Drain 200 mL of pericardial fluid']],
    text: 'Pericardial fluid limits filling of every chamber, so diastolic pressures rise and equalize while the ventricles stay small.' },
  { id: 'lvoto', label: 'Dynamic LVOT obstruction',
    params: { lvEes: 3.5, lvV0: 5, lvA: 0.35, lvBeta: 0.045, lvMass: 1.6, hr: 85, lvoto: 72, vStressed: 460, svr: 0.72 }, hb: 12,
    drugs: { dobutamine: 5 },
    text: 'A small, hypertrophied, hyperdynamic LV whose outflow narrows as it empties. Dobutamine was started for hypotension before an echo was done.' },
];
export const SHOCK_BY = Object.fromEntries(SHOCK.map((s) => [s.id, s]));

export function createPatient(id) {
  const sc = SHOCK_BY[id] || SHOCK[0];
  const base = { ...NORMAL, ...sc.params };
  const drugs = Object.fromEntries(DRUGS.map((d) => [d.id, { rate: 0, ce: 0 }]));
  for (const [k, v] of Object.entries(sc.drugs || {})) drugs[k] = { rate: v, ce: v };
  const pt = {
    sc, base, t: 0, drugs,
    boluses: [],                        // { kind, left (mL), rate (mL/min) }
    transient: 0, retained: 0, bled: 0, refill: 0, removed: 0, given: 0,
    bleed: sc.bleed || 0, ufRate: 0,    // mL/min, mL/h
    pcdFluid: base.pcdFluid,
    hbMass: (sc.hb ?? O2.hb) * BV0 / 100,
    lac: null, warm: null, r: null, out: null,
    log: [], hist: [],
  };
  solve(pt);
  // lactate starts as if the patient had been in this state for an hour
  pt.lac = lactateStep(1, 60, lacInput(pt));
  pt.out = readout(pt);
  record(pt);
  return pt;
}

function dBV(pt) { return pt.transient + pt.retained + pt.refill - pt.bled - pt.removed; }

function params(pt) {
  const m = combine(Object.fromEntries(Object.entries(pt.drugs).map(([k, v]) => [k, v.ce])));
  const b = pt.base;
  return {
    q: {
      ...b,
      svr: b.svr * m.svr, lvEes: b.lvEes * m.ees, rvEes: b.rvEes * m.ees,
      hr: Math.min(180, Math.max(35, b.hr * m.hr)), pvr: b.pvr * m.pvr, tau: b.tau * m.tau,
      vStressed: Math.max(120, b.vStressed + FS * dBV(pt) + m.vol),
      pcdFluid: pt.pcdFluid,
    },
    m,
  };
}

function solve(pt) {
  const { q, m } = params(pt);
  pt.m = m; pt.q = q;
  pt.r = simulate(q, pt.warm ? { state: pt.warm.state, slow: pt.warm.slow } : {});
  pt.warm = { state: pt.r.state, slow: pt.r.slow };
}

function o2opts(pt) {
  return { hb: pt.hbMass / (BV0 + dBV(pt)) * 100, vo2Factor: pt.sc.sepsis ? 1.2 : 1 };
}

function lacInput(pt) {
  const h = pt.r.hemo, ox = oxygen(h.CO, o2opts(pt));
  return { deficit: ox.deficit, er: ox.er, co: h.CO, cvp: h.RAP, beta2: pt.m.beta2, extra: pt.sc.sepsis ? 2 : 0 };
}

// Advance the clock by dt minutes (sub-stepped at ≤ 1 min), then re-solve the circulation.
export function advance(pt, dt) {
  const n = Math.max(1, Math.ceil(dt / 1)), h = dt / n;
  const leak = pt.sc.sepsis ? LEAK : null;
  const lin = lacInput(pt);
  for (let i = 0; i < n; i++) {
    for (const d of DRUGS) { const s = pt.drugs[d.id]; s.ce = kinetics(s.ce, s.rate, h, d.tHalf); }
    // fluids
    const tauC = leak ? leak.tau : FLUIDS.crystalloid.tau;
    pt.transient *= Math.exp(-h / tauC);
    for (const b of pt.boluses) {
      const v = Math.min(b.left, b.rate * h);
      b.left -= v; pt.given += v;
      const f = FLUIDS[b.kind];
      const keep = b.kind === 'crystalloid' && leak ? leak.keep : f.keep;
      pt.retained += keep * v; pt.transient += (1 - keep) * v;
      if (f.hbMass) pt.hbMass += f.hbMass * v / f.vol;
    }
    pt.boluses = pt.boluses.filter((b) => b.left > 1e-6);
    // bleeding (at the current Hb), transcapillary refill of 30% of the loss over about 1.5 h, and removal
    const hb = pt.hbMass / (BV0 + dBV(pt));
    const lost = pt.bleed * h;
    pt.bled += lost; pt.hbMass -= lost * hb;
    pt.refill += (0.3 * pt.bled - pt.refill) * (1 - Math.exp(-h / 90));
    pt.removed += pt.ufRate / 60 * h;
    pt.lac = lactateStep(pt.lac, h, lin);
    pt.t += h;
  }
  solve(pt);
  pt.out = readout(pt);
  record(pt);
  return pt.out;
}

export function setDrug(pt, id, rate) {
  const d = DRUG[id]; if (!d) return;
  const v = Math.max(0, Math.min(d.max, +rate || 0));
  if (v === pt.drugs[id].rate) return;
  pt.drugs[id].rate = v;
  logEvent(pt, v ? `${d.name} ${fmtDose(v)} ${d.unit}` : `${d.name} stopped`);
}
export function give(pt, kind) {
  const f = FLUIDS[kind];
  pt.boluses.push({ kind, left: f.vol, rate: f.vol / f.over });
  logEvent(pt, `${f.name} over ${f.over} min`);
}
export function setBleed(pt, v) { pt.bleed = Math.max(0, v); logEvent(pt, pt.bleed ? `Bleeding ${pt.bleed} mL/min` : 'Bleeding controlled'); }
export function setUF(pt, v) { pt.ufRate = Math.max(0, v); logEvent(pt, pt.ufRate ? `Fluid removal ${pt.ufRate} mL/h` : 'Fluid removal stopped'); }
export function action(pt, id) {
  if (id === 'control') setBleed(pt, 0);
  if (id === 'drain') { pt.pcdFluid = Math.max(0, pt.pcdFluid - 200); logEvent(pt, `Pericardial drainage 200 mL (${pt.pcdFluid.toFixed(0)} mL left)`); }
}
function fmtDose(v) { return v < 0.1 ? v.toFixed(3).replace(/0+$/, '') : v < 10 ? String(+v.toFixed(3)) : v.toFixed(0); }
function logEvent(pt, text) { pt.log.push({ t: pt.t, text }); }

// Everything the monitor, the interface panel, and the trends read.
export function readout(pt) {
  const r = pt.r, h = r.hemo, lv = r.lv, rv = r.rv;
  const o = o2opts(pt), ox = oxygen(h.CO, o);
  const pf = perfusion({ map: h.MAP, cvp: h.RAP, pmsf: h.Pmsf, svrRel: r.eff.svr / NORMAL.svr, co: h.CO, pccDrug: pt.m.pcc, alpha: pt.m.alpha });
  const tapse = O2.tapseRef * rv.SV / NORMAL_RV_SV;
  return {
    t: pt.t, hr: r.eff.hr, sbp: h.SBP, dbp: h.DBP, map: h.MAP, cvp: h.RAP, lap: h.LAP,
    pasp: h.PASP, padp: h.PADP, mpap: h.mPAP, co: h.CO, ci: h.CI, sv: lv.fwdSV, ef: lv.EF,
    lvEaEes: lv.EaEes, rvEesEa: rv.EesEa, lvEes: lv.Ees, rvEes: rv.Ees,
    vti: lv.SVout / O2.lvotArea, tapse, tapsePasp: tapse / h.PASP,
    grad: h.avPeakGrad, pmsf: h.Pmsf, vrGrad: h.vrGrad, rvr: h.Rvr,
    hb: o.hb, do2: ox.do2, do2kg: ox.do2kg, do2crit: ox.do2crit, vo2: ox.vo2, er: ox.er, svo2: ox.svo2, gap: ox.gap,
    lac: pt.lac ?? 1, ...pf,
    reflex: r.eff.reflex, ischR: h.ischR, ischL: h.ischL,
    balance: dBV(pt), given: pt.given, bled: pt.bled,
  };
}
const NORMAL_RV_SV = simulate({}).rv.SV;

function record(pt) {
  const o = pt.out;
  pt.hist.push({ t: pt.t, map: o.map, hr: o.hr, co: o.co, cvp: o.cvp, svo2: o.svo2 * 100, lac: o.lac, vti: o.vti, gap: o.gap, crt: o.crt });
}

// Four-interface assessment against the thresholds of Rola 2025 and the sources on the page.
// Each check: [label, value text, ok]; ok is null for a value shown without a threshold.
export function interfaces(o) {
  const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
  return [
    { id: 'I', name: 'LV–arterial', checks: [
      ['LV Ea/Ees', f2(o.lvEaEes), o.lvEaEes <= 1.36],
      ['LVOT VTI (cm)', f0(o.vti), o.vti >= 18],
      ['Stroke volume (mL)', f0(o.sv), null],
      ...(o.grad > 30 ? [['LVOT peak gradient (mmHg)', f0(o.grad), false]] : []),
    ] },
    { id: 'II', name: 'Arteriole–capillary', checks: [
      ['MAP (mmHg)', f0(o.map), o.map >= 65],
      ['Tissue perfusion pressure (mmHg)', f0(o.tpp), null],
      ['Capillary refill (s)', f1(o.crt), o.crt <= 3],
      ['PCO₂ gap (mmHg)', f1(o.gap), o.gap <= 6],
      ['ScvO₂ (%)', f0(o.svo2 * 100), null],
    ] },
    { id: 'III', name: 'Capillary–venular', checks: [
      ['CVP (mmHg)', f0(o.cvp), o.cvp <= 12],
      ['MAP − CVP (mmHg)', f0(o.ppress), null],
      ['Pmsf − CVP (mmHg)', f1(o.vrGrad), null],
    ] },
    { id: 'IV', name: 'RV–PA', checks: [
      ['RV Ees/Ea', f2(o.rvEesEa), o.rvEesEa >= 0.805],
      ['TAPSE/PASP (mm/mmHg)', f2(o.tapsePasp), o.tapsePasp >= 0.31],
    ] },
  ].map((x) => ({ ...x, ok: x.checks.every((c) => c[2] !== false) }));
}
