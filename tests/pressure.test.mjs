// Pressure measurement. Run with: node tests/pressure.test.mjs
// Each clinical endpoint is a published finding (PMID in the name). A published mean ± SD is met when the model lies
// within 2 SD of it; where a source gives a standard error, the SD is the standard error times √n.
import { simulate } from '../site/js/engine.js';
import {
  MMHG_PER_CMH2O, MMHG_CM, BODY, POSTURES, siteHeight, transducerHeight, arterialAt, venousAt, capillaryP, reading,
  pleuralFromPeep, secondOrder, flushTest, slowTimeConstant, respond, beatStats,
} from '../site/js/pressurecore.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const f = (x, d = 1) => x.toFixed(d);
const within = (v, lo, hi) => v >= lo && v <= hi;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const posture = (id) => POSTURES.find((p) => p.id === id);

// ---------- the column ----------
check('1 cmH2O is 0.7356 mmHg', near(MMHG_PER_CMH2O, 0.7356, 1e-4), f(MMHG_PER_CMH2O, 4));
check('a leveling error of 10 cm of saline is 7.4 mmHg (the figure used for the PA catheter transducer height)', near(10 * MMHG_CM.saline, 7.4, 0.1), f(10 * MMHG_CM.saline, 2));
check('blood is denser than saline, so a column of blood exerts more pressure per cm', MMHG_CM.blood > MMHG_CM.saline && near(MMHG_CM.blood, 0.78, 0.01), f(MMHG_CM.blood, 3));

// ---------- the patient at the heart ----------
const r = simulate({});
const heart = { sbp: r.hemo.SBP, dbp: r.hemo.DBP, map: r.hemo.MAP, rap: r.hemo.RAP };
check('normal patient at the heart: MAP 96, RAP 4 mmHg (engine)', near(heart.map, 96, 1) && near(heart.rap, 4.1, 0.5), `${f(heart.map)}, ${f(heart.rap)}`);

// ---------- heights ----------
check('supine: every site lies at the level of the heart', ['aorta', 'brain', 'radial', 'foot', 'ra', 'footvein'].every((s) => siteHeight(s, posture('supine')) === 0));
check('standing: the circle of Willis is above the heart and the foot is below it',
  siteHeight('brain', posture('standing')) === BODY.hipToBrain - BODY.hipToHeart && siteHeight('foot', posture('standing')) === -(BODY.hipToHeart + BODY.hipToAnkle));
check('sitting up in bed with the legs flat: the foot lies at the level of the hip, below the heart by the hip-to-heart length', siteHeight('foot', posture('sitting')) === -BODY.hipToHeart);
check('the head-up angle sets the height as the sine of the angle',
  near(siteHeight('brain', posture('hob30')), 0.5 * (BODY.hipToBrain - BODY.hipToHeart), 1e-9));

// ---------- pressure in the vessel ----------
const brain = arterialAt(heart, siteHeight('brain', posture('standing')));
check('standing: the arterial pressure at the circle of Willis is lower than at the heart by the blood column, and the pulse pressure is unchanged',
  near(heart.map - brain.map, MMHG_CM.blood * 25, 1e-9) && near((brain.sbp - brain.dbp), (heart.sbp - heart.dbp), 1e-9), `${f(brain.map)} against ${f(heart.map)}`);
check('standing: the veins of the head collapse, so their pressure is no lower than the atmosphere', venousAt(heart, 25) === 0);
check('a venous column below the heart is supported', near(venousAt(heart, -100), heart.rap + 100 * MMHG_CM.blood, 1e-9));

// Perry 1986 (PMID 3722075): standing foot venous pressure 95.2 ± 1.5 (SE, n = 6) and capillary pressure 112.8 ± 3.1 (SE, n = 6)
const sd = (se) => se * Math.sqrt(6);
const hFoot = siteHeight('foot', posture('standing'));
const paFoot = arterialAt(heart, hFoot).map, pvFoot = venousAt(heart, hFoot), pcFoot = capillaryP(paFoot, pvFoot);
check('Perry 1986 (PMID 3722075): standing foot venous pressure is within 95.2 ± 2 SD', within(pvFoot, 95.2 - 2 * sd(1.5), 95.2 + 2 * sd(1.5)), `${f(pvFoot)} (${f(95.2 - 2 * sd(1.5))}–${f(95.2 + 2 * sd(1.5))})`);
check('Perry 1986: standing foot capillary pressure is within 112.8 ± 2 SD (resistance ratio 4, an assumption)', within(pcFoot, 112.8 - 2 * sd(3.1), 112.8 + 2 * sd(3.1)), `${f(pcFoot)} (${f(112.8 - 2 * sd(3.1))}–${f(112.8 + 2 * sd(3.1))})`);
check('Perry 1986: the capillary pressure follows the fitted relation Pc = 1.2 Pv + 1.6 in the foot within 6 mmHg', near(pcFoot, 1.2 * pvFoot + 1.6, 6), `${f(pcFoot)} against ${f(1.2 * pvFoot + 1.6)}`);
check('capillary pressure lies between the venous and the arterial pressure and rises with the venous pressure',
  pcFoot > pvFoot && pcFoot < paFoot && capillaryP(100, 20) > capillaryP(100, 10));
check('Perry 1986: standing raises the capillary pressure of the foot more than fivefold against the heart-level value',
  pcFoot > 5 * capillaryP(heart.map, heart.rap), `${f(pcFoot)} against ${f(capillaryP(heart.map, heart.rap))}`);

// ---------- the reading ----------
check('transducer at the vessel: the reading is the pressure in the vessel', near(reading(150, -40, -40, 0), 150, 1e-9));
check('transducer 10 cm below the vessel: the reading is 7.4 mmHg too high; 10 cm above it, 7.4 too low',
  near(reading(100, 0, -10), 100 + 10 * MMHG_CM.saline, 1e-9) && near(reading(100, 0, 10), 100 - 10 * MMHG_CM.saline, 1e-9));
check('zero offset adds to every reading', near(reading(100, 0, 0, 5), 105, 1e-9));
const sit = posture('sitting');
check('transducer left at the supine height in a sitting patient: the reading of the heart-level pressure is too high by the column',
  near(reading(heart.map, 0, transducerHeight('bed', sit, 'aorta')) - heart.map, MMHG_CM.saline * BODY.hipToHeart, 1e-9), `${f(MMHG_CM.saline * BODY.hipToHeart)} mmHg`);
check('radial line leveled to the heart: the reading is the heart-level pressure within the blood-saline density difference',
  (() => { const st = posture('standing'), h = siteHeight('radial', st), pa = arterialAt(heart, h).map; return near(reading(pa, h, 0), heart.map, 0.05 * Math.abs(h)); })());
check('arterial line leveled to the heart in a sitting patient overstates the pressure at the circle of Willis by the column above the heart',
  (() => { const h = siteHeight('brain', sit), pBrain = arterialAt(heart, h).map; return near(heart.map - pBrain, MMHG_CM.blood * h, 1e-9) && h > 0; })());

// Kovacs 2013 (PMID 23794468): zero levels 8.0 mmHg apart (median) misclassify patients
check('Kovacs 2013 (PMID 23794468): a median difference of 8.0 mmHg between two zero levels is a distance of 10.8 cm of saline',
  near(8.0 / MMHG_CM.saline, 10.8, 0.1), `${f(8.0 / MMHG_CM.saline)} cm`);

// ---------- pressure around the vessels ----------
check('PEEP: the pleural pressure rises by the transmitted fraction of the airway pressure', near(pleuralFromPeep(10, 0.32), 0.32 * 10 * 0.7356, 1e-3), `${f(pleuralFromPeep(10, 0.32), 2)} mmHg`);
const base = simulate({}), peep10 = simulate({ ppl: pleuralFromPeep(10, 0.32) }), peep20 = simulate({ ppl: pleuralFromPeep(20, 0.32) });
const pl10 = pleuralFromPeep(10, 0.32), pl20 = pleuralFromPeep(20, 0.32);
check('PEEP raises the measured RAP and lowers the transmural RAP',
  peep10.hemo.RAP > base.hemo.RAP + 0.5 * pl10 && peep10.hemo.RAP - pl10 < base.hemo.RAP, `${f(base.hemo.RAP)} → measured ${f(peep10.hemo.RAP)}, transmural ${f(peep10.hemo.RAP - pl10)}`);
check('PEEP lowers cardiac output, more at 20 than at 10 cmH2O', base.hemo.CO > peep10.hemo.CO && peep10.hemo.CO > peep20.hemo.CO, `${f(base.hemo.CO, 2)}, ${f(peep10.hemo.CO, 2)}, ${f(peep20.hemo.CO, 2)} L/min`);
check('a larger transmitted fraction lowers cardiac output more at the same PEEP',
  simulate({ ppl: pleuralFromPeep(15, 0.62) }).hemo.CO < simulate({ ppl: pleuralFromPeep(15, 0.34) }).hemo.CO);
check('PEEP raises the measured wedge pressure (LA pressure) with the pleural pressure', peep10.hemo.LAP > base.hemo.LAP);

// ---------- dynamic response ----------
// the fast-flush analysis recovers the set natural frequency and damping coefficient
for (const [fn, z] of [[17.89, 0.234], [7.35, 0.356], [25, 0.15], [12, 0.45]]) {
  const t = flushTest(fn, z);
  check(`fast flush: natural frequency ${fn} Hz and damping ${z} are recovered`, t.oscillates && near(t.fn, fn, 0.03 * fn) && near(t.zeta, z, 0.03), t.oscillates ? `fn ${f(t.fn, 2)}, ζ ${f(t.zeta, 3)}` : 'no oscillation');
}
check('fast flush: a well-damped system (ζ 0.65) shows no oscillation to measure', !flushTest(17.89, 0.65).oscillates);
check('an overdamped system has no oscillation and a time constant that grows with damping', slowTimeConstant(17.89, 1.6) > slowTimeConstant(17.89, 1.2) && slowTimeConstant(17.89, 0.5) === null);
check('overdamped time constant is about 2ζ/ωn for large ζ', near(slowTimeConstant(20, 5) * 2 * Math.PI * 20, 2 * 5, 0.05 * 10));
const step = secondOrder(new Array(4000).fill(100), 0.0005, 15, 0.5, 50);
check('a step in pressure is reported correctly once the transient has gone', near(step[step.length - 1], 100, 1e-6));
check('a constant pressure is reported unchanged', near(secondOrder(new Array(400).fill(80), 0.0005, 10, 0.3, 80)[399], 80, 1e-9));

// Promonet 2000 (PMID 10638918) and Hersh 2014 (PMID 25516162): resonance in the arterial pressure
const wave = (hr) => { const q = simulate({ hr, baro: 0 }); return { beat: q.rec.Pao, dt: q.dt, st: beatStats(q.rec.Pao) }; };
const sbpErr = (hr, fn, z) => { const w = wave(hr), s = beatStats(respond(w.beat, w.dt, fn, z)); return { sbp: s.sbp - w.st.sbp, dbp: s.dbp - w.st.dbp, map: s.map - w.st.map }; };
const E = { 60: sbpErr(60, 7.35, 0.356), 100: sbpErr(100, 7.35, 0.356), 120: sbpErr(120, 7.35, 0.356) };
check('Promonet 2000 (PMID 10638918): a catheter-transducer system distorts the pressure wave by overestimating systolic pressure (natural frequency 7.35 Hz, damping 0.356)',
  E[60].sbp > 2 && E[100].sbp > 2, `${f(E[60].sbp)}, ${f(E[100].sbp)} mmHg`);
check('the mean arterial pressure is not changed by the distortion (within 0.1 mmHg)', Math.abs(E[100].map) < 0.1, `${f(E[100].map, 2)}`);
check('the systolic error grows with heart rate as a harmonic nears the natural frequency (60 → 100 per minute)', E[100].sbp > E[60].sbp + 2, `${f(E[60].sbp)} → ${f(E[100].sbp)} mmHg`);
check('Hersh 2014 (PMID 25516162): damping below 0.4 with this natural frequency produces a systolic resonance artifact of 7 mmHg or more at 100 to 120 per minute (the paper, with theoretical systems built from measured damping coefficients below 0.4 gave artifacts of 8 mmHg or more)',
  E[100].sbp >= 7 && E[120].sbp >= 7, `${f(E[100].sbp)}, ${f(E[120].sbp)} mmHg`);
check('Hersh 2014: a damping coefficient of 0.65 removes the artifact (systolic error under 1 mmHg at 100 per minute)', Math.abs(sbpErr(100, 17.89, 0.65).sbp) < 1, `${f(sbpErr(100, 17.89, 0.65).sbp, 2)} mmHg`);
check('a higher natural frequency lowers the systolic error at the same damping (17.89 against 7.35 Hz, ζ 0.234 against 0.356)',
  sbpErr(100, 17.89, 0.234).sbp < E[100].sbp);
check('overdamping rounds the pulse: the systolic reading falls and the diastolic reading rises, the mean is unchanged',
  (() => { const e = sbpErr(80, 17.89, 1.6); return e.sbp < 0 && e.dbp > 1 && Math.abs(e.map) < 0.1; })(), (() => { const e = sbpErr(80, 17.89, 1.6); return `${f(e.sbp)}, ${f(e.dbp)}`; })());

// ---------- numbers quoted in pressure.html ----------
check('prose: 10 cm of saline is 7.4 mmHg and 10 cm of blood is 7.8 mmHg', f(10 * MMHG_CM.saline) === '7.4' && f(10 * MMHG_CM.blood) === '7.8', `${f(10 * MMHG_CM.saline)}, ${f(10 * MMHG_CM.blood)}`);
check('prose: 25 cm of blood is 19 mmHg', f(25 * MMHG_CM.blood, 0) === '19', f(25 * MMHG_CM.blood));

console.log(failed ? `\n${failed} test(s) failed` : '\nall pressure checks passed');
process.exit(failed ? 1 : 0);
