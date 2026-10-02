// Respiratory mechanics: a single-compartment lung with a chest wall, driven by the ventilator or by the respiratory
// muscles. It produces the airway pressure, the flow, the lung volume and the pleural pressure that the circulation
// sees (engine.js takes the pleural pressure through `pplFn`). Pure functions (no DOM), so the same file runs in the
// browser and in the node tests.
import { MMHG_PER_CMH2O } from './pressurecore.js';

// Pressures in cmH2O, volumes in mL, flows in mL/s, resistance in cmH2O/(mL/s), compliance in mL/cmH2O.
// Equation of motion of the respiratory system:  Paw + Pmus = V/Crs + R·V′
// with V the volume above the relaxation volume of the respiratory system (FRC when no pressure is applied) and Pmus the
// pressure of the inspiratory muscles. The chest wall carries a share of the elastance, so the pleural pressure is
//   Ppl = Ecw·V − Pmus,  Ecw = cwShare / Crs,
// and a change in airway pressure moves the pleural pressure by the same share of itself (cwShare = Crs/Ccw).

// Lung conditions in passively ventilated adults, from the medians of Arnal 2017 (PMID 29042486): static compliance
// and inspiratory resistance. The share of the elastance that belongs to the chest wall is an assumption.
export const LUNGS = {
  normal: { label: 'Normal lungs', Crs: 54, R: 13, cwShare: 0.30 },
  ards: { label: 'ARDS', Crs: 39, R: 12, cwShare: 0.30 },
  copd: { label: 'COPD', Crs: 59, R: 22, cwShare: 0.30 },
};

// Expiratory time constant (s) of the passive respiratory system: resistance (cmH2O/L/s) times compliance (mL/cmH2O).
export const timeConstant = (lung) => (lung.R * lung.Crs) / 1000;

// Share of the lung that has emptied after n time constants.
export const emptied = (n) => 1 - Math.exp(-n);

// Ventilator settings: mode 'pcv' (pressure control) or 'vcv' (constant inspiratory flow), rate (breaths/min),
// inspiratory time ti (s), PEEP (cmH2O), driving pressure dp for pcv, tidal volume vt (mL) for vcv, and an optional
// end-inspiratory pause (s) for vcv. Spontaneous breathing is a muscle pressure of amplitude pmus (cmH2O, positive
// is inspiratory effort) that rises and falls as a half sine over the inspiratory time.
export const DEFAULTS = { mode: 'pcv', rate: 14, ti: 1.0, peep: 5, dp: 12, vt: 450, pause: 0, pmus: 0 };

function drive(set, t, state) {
  const T = 60 / set.rate, ph = ((t % T) + T) % T;
  const insp = ph < set.ti;
  const mus = set.pmus && insp ? set.pmus * Math.sin((ph / set.ti) * Math.PI) : 0;
  return { insp, mus, ph, T };
}

// Run the lung for `seconds` and return the sampled signals. State is carried from breath to breath, so gas that is
// still in the lung at the end of expiration (auto-PEEP) carries into the next breath. V starts at the relaxation
// volume plus the volume that the set PEEP holds, unless v0 is given.
export function runLung(lung, setIn = {}, { seconds = 30, dt = 0.002, v0 = null } = {}) {
  const set = { ...DEFAULTS, ...setIn };
  const C = lung.Crs, R = lung.R / 1000, E = 1 / C, cw = lung.cwShare;
  const n = Math.round(seconds / dt), out = { dt, set, t: [], paw: [], flow: [], vol: [], ppl: [], palv: [], pmus: [], recoil: [] };
  let V = v0 ?? set.peep * C;
  const tFlow = Math.max(1e-6, set.ti - set.pause), q = set.vt / tFlow;
  for (let i = 0; i < n; i++) {
    const t = i * dt, d = drive(set, t);
    let paw, flow;
    if (!d.insp) { paw = set.peep; flow = (paw + d.mus - V * E) / R; }
    else if (set.mode === 'vcv') {
      flow = d.ph < tFlow ? q : 0;                                  // constant inspiratory flow, then the pause
      paw = V * E + R * flow - d.mus;
    } else { paw = set.peep + set.dp; flow = (paw + d.mus - V * E) / R; }
    out.t.push(t); out.paw.push(paw); out.flow.push(flow); out.vol.push(V); out.pmus.push(d.mus);
    out.recoil.push(V * E);                                          // elastic recoil pressure of the respiratory system
    out.ppl.push(cw * V * E - d.mus);
    out.palv.push(V * E - d.mus);                                    // alveolar pressure: the airway pressure less the resistive drop
    V += flow * dt;
  }
  return out;
}

// Quantities of the last full breath of a run: tidal volume (mL), peak and plateau airway pressure, end-expiratory
// recoil pressure above the set PEEP (auto-PEEP), mean pleural pressure, and the share of the expiratory flow that is
// still running when the next breath starts.
export function lastBreath(run) {
  const { dt, set } = run, T = 60 / set.rate, nb = Math.round(T / dt), n = run.t.length;
  const i0 = n - nb, sl = (a) => a.slice(i0, n);
  const V = sl(run.vol), paw = sl(run.paw), ppl = sl(run.ppl), flow = sl(run.flow);
  const vmax = Math.max(...V), vmin = Math.min(...V);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    vt: vmax - vmin, vEnd: V[V.length - 1], peak: Math.max(...paw),
    autoPeep: run.recoil[n - 1] - set.peep, pplMean: mean(ppl), pplEnd: ppl[ppl.length - 1],
    flowEnd: flow[flow.length - 1], meanPaw: mean(paw),
  };
}

// Pleural and alveolar pressure (mmHg) as functions of time for the circulation: the last breath of a run, looped, for the
// engine's pplFn and palvFn. `breathPattern` returns both as the pattern that beats.js runs.
function looped(run, sig) {
  const T = 60 / run.set.rate, nb = Math.round(T / run.dt), i0 = run.t.length - nb;
  return (t) => run[sig][i0 + Math.min(nb - 1, Math.floor((((t % T) + T) % T) / run.dt))] * MMHG_PER_CMH2O;
}
export const pleuralFn = (run) => looped(run, 'ppl');
export const alveolarFn = (run) => looped(run, 'palv');
export const breathPattern = (run) => ({ fn: pleuralFn(run), palvFn: alveolarFn(run), period: 60 / run.set.rate });
