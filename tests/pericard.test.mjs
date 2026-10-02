// Pleural pressure, breathing and pericardial disease. Run with: node tests/pericard.test.mjs
// Each clinical endpoint is a published finding (PMID in the name). A published mean ± SD is met when the model
// lies within 2 SD of it (a patient drawn from the same cohort); a published threshold is met when the model
// is on the right side of it. The breath amplitude of quiet breathing is an assumption of the model.
import { simulate } from '../site/js/engine.js';
import { CASES, measure, runBeats, BREATHS, pleural } from '../site/js/pericard.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const within = (v, lo, hi) => v >= lo && v <= hi;
const f = (x, d = 1) => x.toFixed(d);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd2 = (m, sd) => [m - 2 * sd, m + 2 * sd];

// ---------- plumbing ----------
const base = simulate({});
const first = (extra) => simulate({}, { state: base.state, slow: base.slow, holdSlow: true, maxBeats: 0, prev: base, t0: 0, ...extra });
const r0 = first({}), r8 = first({ pplFn: () => -8 });
check('breath: chamber and pulmonary vessel pressures fall by the pleural pressure at the same state',
  Math.abs((r8.rec.Pra[0] - r0.rec.Pra[0]) + 8) < 1e-9 && Math.abs((r8.rec.Ppv[0] - r0.rec.Ppv[0]) + 8) < 1e-9 && Math.abs((r8.rec.Plv[0] - r0.rec.Plv[0]) + 8) < 1e-9,
  `${f(r8.rec.Pra[0] - r0.rec.Pra[0])}, ${f(r8.rec.Ppv[0] - r0.rec.Ppv[0])}, ${f(r8.rec.Plv[0] - r0.rec.Plv[0])}`);
check('breath: the systemic arteries lie outside the thorax and do not follow it', Math.abs(r8.rec.Psv[0] - r0.rec.Psv[0]) < 1e-9);
check('breath: the pleural pressure is recorded with each sample', r8.rec.Ppl.length === r8.rec.t.length && r8.rec.Ppl.every((x) => x === -8) && r0.rec.Ppl.every((x) => x === 0));
const stat = simulate({ ppl: 5 }), constFn = simulate({ ppl: 5 }, { state: stat.state, slow: stat.slow, holdSlow: true, maxBeats: 0, prev: stat, t0: 0 }),
  fnRun = simulate({}, { state: stat.state, slow: stat.slow, holdSlow: true, maxBeats: 0, prev: stat, t0: 0, pplFn: () => 5 });
check('breath: a constant breath function equals the static mean pleural pressure', fnRun.rec.Pra.every((x, i) => Math.abs(x - constFn.rec.Pra[i]) < 1e-9));
check('breath pattern: 0 at end-expiration, lowest value at mid-inspiration, periodic',
  pleural(0, BREATHS.spont) === 0 && Math.abs(pleural(BREATHS.spont.period * BREATHS.spont.insp / 2, BREATHS.spont) - BREATHS.spont.inspSwing) < 1e-9 && Math.abs(pleural(1.3, BREATHS.spont) - pleural(1.3 + 4, BREATHS.spont)) < 1e-9);

// ---------- cases under a spontaneous breath ----------
const R = {};
for (const k of Object.keys(CASES)) { const run = runBeats(CASES[k].params, BREATHS.spont, { seconds: 16, warm: 8 }); R[k] = { run, m: measure(run), h: run.base.hemo }; }
const drained = (() => { const run = runBeats({}, BREATHS.spont, { seconds: 16, warm: 8 }); return { run, m: measure(run), h: run.base.hemo }; })();
const T = R.tamponade, N = R.normal;
check('every case converges', Object.values(R).every((x) => x.run.base.converged));

// Pulsus paradoxus: an inspiratory fall in systolic pressure of more than 10 mmHg (Hamzaoui 2012, PMID 23222878)
check('pulsus paradoxus (Hamzaoui 2012, PMID 23222878): tamponade falls by more than 10 mmHg', T.m.sbpFall > 10, `${f(T.m.sbpFall)} mmHg`);
check('quiet breathing in a normal pericardium falls by less than 10 mmHg (model check)', N.m.sbpFall < 10, `${f(N.m.sbpFall)} mmHg`);
check('tamponade amplifies the respiratory fall in systolic pressure at least twofold', T.m.sbpFall > 2 * N.m.sbpFall, `${f(T.m.sbpFall / N.m.sbpFall, 1)}×`);
check('restriction has no pulsus paradoxus', R.restriction.m.sbpFall < 10, `${f(R.restriction.m.sbpFall)} mmHg`);
const bigBreath = { ...BREATHS.spont, inspSwing: -8 };
const bigN = measure(runBeats({}, bigBreath, { seconds: 16, warm: 8 })).sbpFall, bigT = measure(runBeats(CASES.tamponade.params, bigBreath, { seconds: 16, warm: 8 })).sbpFall;
check('the fall in systolic pressure grows with the breath (−8 against −4 mmHg)', bigT > T.m.sbpFall && bigN > N.m.sbpFall, `${f(bigN)}, ${f(bigT)} mmHg`);
const ppvRun = measure(runBeats(CASES.tamponade.params, BREATHS.ppv, { seconds: 16, warm: 8 }));
check('a positive-pressure breath also varies systolic pressure, in the opposite phase to a spontaneous one',
  ppvRun.sbpFall > 5 && ppvRun.rows.some((x) => x.ppl > 3) && T.m.rows.some((x) => x.ppl < -1.5), `${f(ppvRun.sbpFall)} mmHg`);

// Reddy 1978 (PMID 668074): tamponade before and after pericardiocentesis
const [rapLo, rapHi] = sd2(16, 4), [coLo, coHi] = sd2(3.87, 1.77), [rapPostLo, rapPostHi] = sd2(7, 5), [coPostLo, coPostHi] = sd2(7, 2.2);
check('Reddy 1978 (PMID 668074): RAP in tamponade is within 16 ± 2×4 mmHg', within(T.h.RAP, rapLo, rapHi), `${f(T.h.RAP)} (${rapLo}–${rapHi})`);
check('Reddy 1978: cardiac output in tamponade is within 3.87 ± 2×1.77 L/min', within(T.h.CO, coLo, coHi), `${f(T.h.CO, 2)} (${f(coLo, 1)}–${f(coHi, 1)})`);
check('Reddy 1978: RAP after drainage is within 7 ± 2×5 mmHg', within(drained.h.RAP, rapPostLo, rapPostHi), `${f(drained.h.RAP)}`);
check('Reddy 1978: cardiac output after drainage is within 7 ± 2×2.2 L/min', within(drained.h.CO, coPostLo, coPostHi), `${f(drained.h.CO, 2)}`);
check('Reddy 1978: drainage lowers RAP and raises cardiac output', drained.h.RAP < T.h.RAP - 4 && drained.h.CO > T.h.CO + 1.5, `RAP ${f(T.h.RAP)} → ${f(drained.h.RAP)}, CO ${f(T.h.CO, 2)} → ${f(drained.h.CO, 2)}`);
// Reddy 1978 and Boltwood 1987: the right-sided filling pressure equals the pericardial pressure
check('Boltwood 1987 (PMID 3568311): RAP and pericardial pressure are essentially equal in tamponade (within 3 mmHg)',
  Math.abs(T.h.RAP - T.h.Ppcd) < 3, `${f(T.h.RAP)} and ${f(T.h.Ppcd)}`);
check('Reddy 1978: the mean RAP of every beat, in inspiration as in expiration, stays above the mean pericardial pressure',
  T.run.beats.every(({ r }) => mean(r.rec.Pra) - mean(r.rec.Ppcd.map((x, i) => x + r.rec.Ppl[i])) > 0));
// Boltwood 1987: wedge minus pericardial pressure 4 ± 2 in expiration, 0.2 ± 1.3 in inspiration, 8 ± 4 after drainage
check('Boltwood 1987: wedge minus pericardial pressure in expiration is within 4 ± 2×2 mmHg', within(T.m.wmpExp, ...sd2(4, 2)), `${f(T.m.wmpExp)}`);
check('Boltwood 1987: wedge minus pericardial pressure in inspiration is within 0.2 ± 2×1.3 mmHg', within(T.m.wmpInsp, ...sd2(0.2, 1.3)), `${f(T.m.wmpInsp)}`);
check('Boltwood 1987: it falls in inspiration', T.m.wmpInsp < T.m.wmpExp - 0.5, `${f(T.m.wmpExp)} → ${f(T.m.wmpInsp)}`);
check('Boltwood 1987: after drainage it is within 8 ± 2×4 mmHg', within(drained.m.wmpExp, ...sd2(8, 4)), `${f(drained.m.wmpExp)}`);
check('tamponade equalizes the diastolic pressures: RAP, RV and LV end-diastolic and PA diastolic within 3 mmHg of each other',
  Math.max(T.h.RAP, T.m.rvedpExp, T.m.lvedpExp, T.h.PADP) - Math.min(T.h.RAP, T.m.rvedpExp, T.m.lvedpExp, T.h.PADP) < 3,
  `${f(T.h.RAP)}, ${f(T.m.rvedpExp)}, ${f(T.m.lvedpExp)}, ${f(T.h.PADP)}`);

// Ventricular interdependence in inspiration: the LV fills less and the RV more (Talreja 2008, PMID 18206742)
const C = R.constriction, Q = R.restriction;
const pct = (a, b) => (b / a - 1) * 100;
check('constriction: the diastolic pressures are raised and equalized (RV and LV end-diastolic within 5 mmHg, both above 10)',
  Math.abs(C.m.lvedpExp - C.m.rvedpExp) < 5 && C.m.rvedpExp > 10 && C.m.lvedpExp > 10, `${f(C.m.rvedpExp)}, ${f(C.m.lvedpExp)}`);
check('constriction: output and arterial pressure are preserved while the venous pressure is raised', C.h.CO > 4 && C.h.MAP > 85 && C.h.RAP > 10, `CO ${f(C.h.CO, 2)}, MAP ${f(C.h.MAP, 0)}, RAP ${f(C.h.RAP)}`);
check('constriction (Talreja 2008, enhanced ventricular interaction): the LV fills less and the RV more in inspiration',
  pct(C.m.lvEdvExp, C.m.lvEdvInsp) < -3 && pct(C.m.rvEdvExp, C.m.rvEdvInsp) > 3, `LV ${f(pct(C.m.lvEdvExp, C.m.lvEdvInsp))}%, RV ${f(pct(C.m.rvEdvExp, C.m.rvEdvInsp))}%`);
check('constriction: LV stroke volume falls and RV stroke volume rises in inspiration',
  pct(C.m.lvSvExp, C.m.lvSvInsp) < -3 && pct(C.m.rvSvExp, C.m.rvSvInsp) > 8, `LV ${f(pct(C.m.lvSvExp, C.m.lvSvInsp))}%, RV ${f(pct(C.m.rvSvExp, C.m.rvSvInsp))}%`);
check('restriction: the LV filling does not change with the breath', Math.abs(pct(Q.m.lvEdvExp, Q.m.lvEdvInsp)) < 1.5, `${f(pct(Q.m.lvEdvExp, Q.m.lvEdvInsp))}%`);
check('normal: the LV filling changes less than in constriction', Math.abs(pct(N.m.lvEdvExp, N.m.lvEdvInsp)) < Math.abs(pct(C.m.lvEdvExp, C.m.lvEdvInsp)), `${f(pct(N.m.lvEdvExp, N.m.lvEdvInsp))}%`);
check('restriction: the LV end-diastolic pressure exceeds the RV end-diastolic pressure by more than 5 mmHg (not equalized)', Q.m.lvedpExp - Q.m.rvedpExp > 5, `${f(Q.m.lvedpExp)}, ${f(Q.m.rvedpExp)}`);
check('constriction: the venous pressure does not fall in inspiration (RAP change under 1 mmHg)', Math.abs(C.m.rapInsp - C.m.rapExp) < 1, `${f(C.m.rapExp)} → ${f(C.m.rapInsp)}`);

console.log(failed ? `\n${failed} test(s) failed` : '\nall pericardial checks passed');
process.exit(failed ? 1 : 0);
