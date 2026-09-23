// Drugs and fluids for the shock lab. Every effect size here is illustrative: the direction of each
// effect follows the pharmacology, and the sizes were chosen so that a usual dose gives a change of
// the usual clinical order in the model. Nothing here is dosing guidance.
//
// Kinetics: one compartment, C approaches the infusion rate with time constant t½/ln 2, so an
// infusion reaches half of its steady effect after one half-life, and wears off at the same rate.
// Dynamics: Emax model, E = C/(EC50 + C), scaling each target.
//   svr, ees, hr, pvr, tau: fractional change at full effect (×(1 + Emax·E))
//   vol: mL of unstressed volume recruited into stressed volume (+) or released (−)
//   pcc: fractional rise of the vascular waterfall (critical closing pressure above Pmsf)
//   alpha: skin vasoconstriction (0–1), beta2: aerobic lactate production (0–1)

export const DRUGS = [
  { id: 'norepinephrine', name: 'Norepinephrine', group: 'Vasopressors', unit: 'µg/kg/min', max: 1, step: 0.02, typical: 0.1, tHalf: 2.5, ec50: 0.25,
    fx: { svr: 1.4, ees: 0.25, vol: 450, pvr: 0.1, pcc: 0.4, alpha: 0.6 } },
  { id: 'epinephrine', name: 'Epinephrine', group: 'Vasopressors', unit: 'µg/kg/min', max: 0.5, step: 0.01, typical: 0.05, tHalf: 2.5, ec50: 0.1,
    fx: { svr: 0.9, ees: 0.55, hr: 0.3, vol: 350, pcc: 0.3, alpha: 0.5, beta2: 1 } },
  { id: 'vasopressin', name: 'Vasopressin', group: 'Vasopressors', unit: 'U/min', max: 0.06, step: 0.01, typical: 0.03, tHalf: 10, ec50: 0.03,
    fx: { svr: 1.0, vol: 150, pcc: 0.5, alpha: 0.5 } },
  { id: 'phenylephrine', name: 'Phenylephrine', group: 'Vasopressors', unit: 'µg/min', max: 300, step: 10, typical: 100, tHalf: 5, ec50: 120,
    fx: { svr: 1.2, vol: 200, pvr: 0.1, pcc: 0.5, alpha: 0.6 } },
  { id: 'dobutamine', name: 'Dobutamine', group: 'Inotropes and inodilators', unit: 'µg/kg/min', max: 20, step: 1, typical: 5, tHalf: 2.5, ec50: 6,
    fx: { ees: 0.8, hr: 0.25, svr: -0.25, pvr: -0.1 } },
  { id: 'milrinone', name: 'Milrinone', group: 'Inotropes and inodilators', unit: 'µg/kg/min', max: 0.75, step: 0.125, typical: 0.375, tHalf: 120, ec50: 0.4,
    fx: { ees: 0.5, hr: 0.08, svr: -0.35, pvr: -0.35, tau: -0.2, vol: -80 } },
  { id: 'nitroglycerin', name: 'Nitroglycerin', group: 'Vasodilators', unit: 'µg/min', max: 400, step: 10, typical: 50, tHalf: 3, ec50: 80,
    fx: { vol: -300, svr: -0.2, pvr: -0.15 } },
  { id: 'nitroprusside', name: 'Nitroprusside', group: 'Vasodilators', unit: 'µg/kg/min', max: 5, step: 0.1, typical: 0.5, tHalf: 2, ec50: 1,
    fx: { svr: -0.55, vol: -150, pvr: -0.25, pcc: -0.3 } },
  { id: 'ino', name: 'Inhaled nitric oxide', group: 'Pulmonary vasodilators', unit: 'ppm', max: 40, step: 5, typical: 20, tHalf: 1, ec50: 5,
    fx: { pvr: -0.35 } },
  { id: 'epoprostenol', name: 'Epoprostenol', group: 'Pulmonary vasodilators', unit: 'ng/kg/min', max: 20, step: 1, typical: 4, tHalf: 3, ec50: 6,
    fx: { pvr: -0.3, svr: -0.25 } },
  { id: 'esmolol', name: 'Esmolol', group: 'Rate control', unit: 'µg/kg/min', max: 300, step: 25, typical: 50, tHalf: 9, ec50: 100,
    fx: { hr: -0.35, ees: -0.25 } },
];
export const DRUG = Object.fromEntries(DRUGS.map((d) => [d.id, d]));

// Fluids. Crystalloid: a share stays in the vessels and the rest moves to the interstitium with a
// time constant, so that about 50–60% remains at the end of a 15-min infusion and 15–20% half an
// hour later (Hahn 2020). A capillary leak (sepsis) shortens the time constant and lowers the share.
export const FLUIDS = {
  crystalloid: { name: 'Crystalloid 500 mL', vol: 500, over: 15, keep: 0.18, tau: 10 },
  blood: { name: 'Red cells 1 unit', vol: 300, over: 20, keep: 1, tau: Infinity, hbMass: 60 },
};
export const LEAK = { keep: 0.1, tau: 6 };

// Effect-site level after dt minutes.
export function kinetics(ce, rate, dt, tHalf) {
  return rate + (ce - rate) * Math.exp(-dt * Math.LN2 / tHalf);
}

export function drugEffect(d, ce) { return ce > 0 ? ce / (d.ec50 + ce) : 0; }

// Combined targets for the current effect-site levels { id: ce }.
export function combine(levels) {
  const m = { svr: 1, ees: 1, hr: 1, pvr: 1, tau: 1, vol: 0, pcc: 0, alpha: 0, beta2: 0 };
  for (const d of DRUGS) {
    const E = drugEffect(d, levels[d.id] || 0);
    if (!E) continue;
    for (const [k, v] of Object.entries(d.fx)) {
      if (k === 'vol') m.vol += v * E;
      else if (k === 'pcc' || k === 'alpha' || k === 'beta2') m[k] += v * E;
      else m[k] *= 1 + v * E;
    }
  }
  m.alpha = Math.min(1, m.alpha); m.beta2 = Math.min(1, m.beta2);
  return m;
}
