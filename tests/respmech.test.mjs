// Respiratory mechanics. Run with: node tests/respmech.test.mjs
// Each clinical endpoint is a published finding (PMID in the name). A published median with an interquartile range is
// met when the model lies inside the range; a direction is met when the model moves the same way.
import { LUNGS, timeConstant, emptied, runLung, lastBreath, pleuralFn, breathPattern } from '../site/js/respmech.js';
import { runBeats, beatTable, BREATHS } from '../site/js/beats.js';
import { simulate } from '../site/js/engine.js';
import { MMHG_PER_CMH2O } from '../site/js/pressurecore.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const f = (x, d = 1) => x.toFixed(d);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const within = (v, lo, hi) => v >= lo && v <= hi;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// ---------- time constants ----------
// Arnal 2017 (PMID 29042486), 359 passively ventilated adults: expiratory time constant 0.60 (0.51–0.71) s with normal
// lungs, 1.07 (0.68–2.14) s in COPD and 0.46 (0.40–0.55) s in ARDS; static compliance 54, 59 and 39 mL/cmH2O and
// inspiratory resistance 13, 22 and 12 cmH2O/L/s. The model takes the compliance and resistance and returns the time constant.
const tau = Object.fromEntries(Object.entries(LUNGS).map(([k, l]) => [k, timeConstant(l)]));
check('Arnal 2017 (PMID 29042486): the time constant of normal lungs, resistance times compliance, lies in the interquartile range 0.51–0.71 s', within(tau.normal, 0.51, 0.71), f(tau.normal, 2));
check('Arnal 2017: the time constant in COPD lies in 0.68–2.14 s', within(tau.copd, 0.68, 2.14), f(tau.copd, 2));
check('Arnal 2017: the time constant in ARDS lies in 0.40–0.55 s', within(tau.ards, 0.40, 0.55), f(tau.ards, 2));
check('Arnal 2017: the time constants fall in the order ARDS, normal, COPD', tau.ards < tau.normal && tau.normal < tau.copd);

// the simulated expiration follows the time constant
const passive = runLung(LUNGS.normal, { mode: 'pcv', rate: 6, ti: 1, peep: 0, dp: 15 }, { seconds: 40 });
{
  const T = 60 / 6, dt = passive.dt, i0 = Math.round((T * 2 + 1) / dt);                  // start of expiration in the third breath
  const v0 = passive.vol[i0], vEnd = passive.vol[i0 + Math.round(9 / dt) - 1];
  const at = (s) => (passive.vol[i0 + Math.round(s / dt)] - vEnd) / (v0 - vEnd);
  check('after one time constant 37% of the expired volume is still in the lung, after three 5%', near(at(tau.normal), Math.exp(-1), 0.01) && near(at(3 * tau.normal), Math.exp(-3), 0.01), `${f(100 * at(tau.normal), 1)}%, ${f(100 * at(3 * tau.normal), 1)}%`);
  check('63% of the volume has gone after one time constant, 86% after two and 95% after three', near(emptied(1), 0.632, 0.001) && near(emptied(2), 0.865, 0.001) && near(emptied(3), 0.950, 0.001));
}

// Al-Rawas 2013 (PMID 23384402): in 92 adults with respiratory failure the expiratory time constant, measured as the exhaled
// volume over the flow, gave the compliance and total resistance as well as the end-inspiratory pause method did
// (r² 0.90–0.99 for compliance). The model recovers the compliance and the resistance from one passive breath by both methods.
{
  const L = LUNGS.normal, set = { mode: 'vcv', rate: 12, ti: 1.2, vt: 500, pause: 0.3, peep: 5 };
  const r = runLung(L, set, { seconds: 40 }), T = 5, dt = r.dt, i0 = Math.round(3 * T / dt);
  const iPeak = i0 + Math.round(0.89 / dt), iPlat = i0 + Math.round(1.15 / dt);
  const q = set.vt / (set.ti - set.pause);
  const rPause = (r.paw[iPeak] - r.paw[iPlat]) / (q / 1000);
  const cPause = set.vt / (r.paw[iPlat] - set.peep);
  // time constant of the exhaled volume over the flow: V/V′ at each instant of the passive expiration
  const iE = i0 + Math.round(set.ti / dt), taus = [];
  for (let i = iE + 50; i < iE + 400; i += 25) { const v = r.vol[i] - set.peep * L.Crs, fl = -r.flow[i]; if (fl > 1) taus.push(v / fl); }
  const tauE = mean(taus);
  const cFromTau = (tauE * 1000) / rPause;
  check('Al-Rawas 2013 (PMID 23384402): the expiratory time constant, exhaled volume over flow, equals the resistance times the compliance of the system', near(tauE, timeConstant(L), 0.01 * timeConstant(L)), `${f(tauE, 3)} against ${f(timeConstant(L), 3)} s`);
  check('Al-Rawas 2013: the end-inspiratory pause gives the compliance (tidal volume over plateau less PEEP) within 2% of the true compliance', near(cPause, L.Crs, 0.02 * L.Crs), `${f(cPause, 1)} against ${L.Crs} mL/cmH2O`);
  check('Al-Rawas 2013: the difference between the peak and plateau pressure over the flow gives the resistance within 2%', near(rPause, L.R, 0.02 * L.R), `${f(rPause, 1)} against ${L.R} cmH2O/L/s`);
  check('Al-Rawas 2013: the compliance from the time constant and the resistance agrees with the pause compliance within 2%', near(cFromTau, cPause, 0.02 * cPause), `${f(cFromTau, 1)} against ${f(cPause, 1)} mL/cmH2O`);
}

// ---------- auto-PEEP ----------
const ap = (lung, rate, ti) => lastBreath(runLung(lung, { mode: 'pcv', rate, ti, peep: 0, dp: 15 }, { seconds: 90 })).autoPeep;
check('an expiratory time of five time constants leaves no auto-PEEP (under 0.2 cmH2O)', ap(LUNGS.normal, 60 / (5 * tau.normal + 1), 1) < 0.2, f(ap(LUNGS.normal, 60 / (5 * tau.normal + 1), 1), 2));
check('shortening the expiratory time to one time constant traps gas: auto-PEEP of 3 cmH2O or more', ap(LUNGS.normal, 60 / (tau.normal + 1), 1) >= 3, f(ap(LUNGS.normal, 60 / (tau.normal + 1), 1), 2));
check('at the same rate COPD traps more gas than normal lungs, ARDS less', ap(LUNGS.copd, 20, 1) > ap(LUNGS.normal, 20, 1) && ap(LUNGS.normal, 20, 1) > ap(LUNGS.ards, 20, 1), `${f(ap(LUNGS.copd, 20, 1), 2)}, ${f(ap(LUNGS.normal, 20, 1), 2)}, ${f(ap(LUNGS.ards, 20, 1), 2)}`);

// ---------- pressure transmitted to the pleural space ----------
// Jardin 1985 (PMID 3902386): 24% of the airway pressure reached the pleural space in patients with total compliance under 30 mL/cmH2O
// and 37% above 45 mL/cmH2O. The share is the chest wall's share of the elastance of the respiratory system.
{
  const L = LUNGS.normal, peepRun = (peep) => lastBreath(runLung(L, { mode: 'pcv', rate: 6, ti: 1, peep, dp: 10 }, { seconds: 60 }));
  const swing = (peepRun(10).pplEnd - peepRun(0).pplEnd) / 10;
  check('the pleural pressure at end-expiration rises by the chest wall share of the PEEP (model value 0.30, inside the 24–37% of Jardin 1985, PMID 3902386)', near(swing, L.cwShare, 0.005) && within(swing, 0.24, 0.37), `${f(100 * swing, 1)}%`);
  const inSpan = (cw) => { const l = { ...L, cwShare: cw }; const b = lastBreath(runLung(l, { mode: 'pcv', rate: 6, ti: 1, peep: 10, dp: 10 }, { seconds: 60 })); return b.pplEnd / 10; };
  check('a stiffer chest wall transmits more of the airway pressure (24%, 37% and 62%, the values of Jardin 1985 and Venus 1988, PMID 3286121)', inSpan(0.24) < inSpan(0.37) && inSpan(0.37) < inSpan(0.62) && near(inSpan(0.62), 0.62, 0.005));
}

// ---------- the circulation under a ventilator breath ----------
// Georgopoulos 1995 (PMID 8636519): in nine ventilated patients with COPD and dynamic hyperinflation, with the tidal volume and breath length
// constant, a higher inspiratory flow (a longer expiratory time) lowered the intrinsic PEEP and the mean airway pressure and raised the stroke
// volume index (flows 0.93, 0.72 and 0.55 L/s). The model uses a severe COPD lung at the upper quartile of Arnal 2017 (compliance 75, resistance 30).
{
  const sev = { Crs: 75, R: 30, cwShare: 0.3 };
  const rows = [0.93, 0.72, 0.55].map((flow) => {
    const vt = 600, ti = vt / (flow * 1000), r = runLung(sev, { mode: 'vcv', rate: 12, ti, vt, peep: 0 }, { seconds: 80 }), b = lastBreath(r);
    const t = beatTable(runBeats({}, { fn: pleuralFn(r) }, { seconds: 10, warm: 5 }));
    return { flow, ti, autoPeep: b.autoPeep, meanPaw: b.meanPaw, sv: mean(t.map((x) => x.SV)) };
  });
  check('Georgopoulos 1995 (PMID 8636519): a higher inspiratory flow lowers the intrinsic PEEP', rows[0].autoPeep < rows[1].autoPeep && rows[1].autoPeep < rows[2].autoPeep, rows.map((x) => f(x.autoPeep, 2)).join(' < '));
  check('Georgopoulos 1995: a higher inspiratory flow lowers the mean airway pressure', rows[0].meanPaw < rows[1].meanPaw && rows[1].meanPaw < rows[2].meanPaw, rows.map((x) => f(x.meanPaw, 2)).join(' < '));
  check('Georgopoulos 1995: a higher inspiratory flow raises the stroke volume', rows[0].sv > rows[1].sv && rows[1].sv > rows[2].sv, rows.map((x) => f(x.sv, 2)).join(' > ') + ' mL');
}

// Jozwiak and Teboul 2024 (PMID 39133379), review of heart-lung interactions: in a spontaneous breath inspiration raises the right ventricular
// preload and afterload, lowers the left ventricular preload and raises its afterload; during mechanical insufflation the right ventricular preload
// falls and its afterload rises, and the left ventricular preload rises and its afterload falls. Preload is the end-diastolic volume and afterload the
// systolic pressure across the ventricular wall (the systolic pressure less the pleural pressure at the time of the peak).
{
  const mean2 = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const phases = (run, spont) => {
    const rows = beatTable(run), lo = Math.min(...rows.map((x) => x.ppl)), hi = Math.max(...rows.map((x) => x.ppl)), sw = spont ? lo : hi;
    const rg = hi - lo, I = rows.map((x, i) => i).filter((i) => (spont ? rows[i].ppl < 0.5 * sw : rows[i].ppl > lo + 0.7 * rg));
    const E = rows.map((x, i) => i).filter((i) => (spont ? rows[i].ppl > 0.1 * sw : rows[i].ppl < lo + 0.2 * rg));
    const m = (ix, fn) => mean2(ix.map((i) => fn(run.beats[i].r)));
    const tm = (P, Q) => (r) => { const i = r.rec[P].indexOf(Math.max(...r.rec[P])); return r.rec[P][i] - r.rec[Q][i]; };
    const q = (fn) => ({ exp: m(E, fn), insp: m(I, fn) });
    return { rvEdv: q((r) => r.rv.EDV), lvEdv: q((r) => r.lv.EDV), lvAfter: q(tm('Pao', 'Ppl')), rvAfter: q(tm('Ppa', 'Ppl')), n: [I.length, E.length] };
  };
  const sp = phases(runBeats({}, BREATHS.spont, { seconds: 16, warm: 8 }), true);
  check('Jozwiak 2024 (PMID 39133379): in a spontaneous breath inspiration raises the right ventricular end-diastolic volume and lowers the left', sp.rvEdv.insp > sp.rvEdv.exp && sp.lvEdv.insp < sp.lvEdv.exp, `RV ${f(sp.rvEdv.exp, 0)} → ${f(sp.rvEdv.insp, 0)}, LV ${f(sp.lvEdv.exp, 0)} → ${f(sp.lvEdv.insp, 0)} mL`);
  check('Jozwiak 2024: in a spontaneous breath inspiration raises the afterload of both ventricles (systolic pressure across the wall)', sp.lvAfter.insp > sp.lvAfter.exp && sp.rvAfter.insp > sp.rvAfter.exp, `LV ${f(sp.lvAfter.exp)} → ${f(sp.lvAfter.insp)}, RV ${f(sp.rvAfter.exp)} → ${f(sp.rvAfter.insp)} mmHg`);
  // insufflation by a pleural pressure rise alone (BREATHS.ppv, +8 mmHg): preloads and the left ventricular afterload
  const pp = phases(runBeats({}, BREATHS.ppv, { seconds: 24, warm: 8 }), false);
  check('Jozwiak 2024: during mechanical insufflation the right ventricular preload falls and the left ventricular preload rises', pp.rvEdv.insp < pp.rvEdv.exp && pp.lvEdv.insp > pp.lvEdv.exp, `RV ${f(pp.rvEdv.exp, 0)} → ${f(pp.rvEdv.insp, 0)}, LV ${f(pp.lvEdv.exp, 0)} → ${f(pp.lvEdv.insp, 0)} mL`);
  check('Jozwiak 2024: during mechanical insufflation the left ventricular afterload falls', pp.lvAfter.insp < pp.lvAfter.exp, `${f(pp.lvAfter.exp)} → ${f(pp.lvAfter.insp)} mmHg`);
  // insufflation by a modeled lung with PEEP 10 and a driving pressure of 15 cmH2O: the alveolar pressure compresses the pulmonary capillaries
  const lungRun = runLung(LUNGS.normal, { mode: 'pcv', rate: 20, ti: 1.5, peep: 10, dp: 15 }, { seconds: 60 });
  const mv = phases(runBeats({}, breathPattern(lungRun), { seconds: 24, warm: 8 }), false);
  check('Jozwiak 2024: during mechanical insufflation of a modeled lung the right ventricular preload falls and its afterload rises', mv.rvEdv.insp < mv.rvEdv.exp && mv.rvAfter.insp > mv.rvAfter.exp, `RV ${f(mv.rvEdv.exp, 0)} → ${f(mv.rvEdv.insp, 0)} mL, afterload ${f(mv.rvAfter.exp)} → ${f(mv.rvAfter.insp)} mmHg`);
  // the waterfall: alveolar pressure above the pulmonary venous pressure raises the mean pulmonary artery pressure and lowers the stroke volume
  const z3 = simulate({ palv: 0 }), z2 = simulate({ palv: 14 });
  check('alveolar pressure above the pulmonary venous pressure (14 mmHg) raises the mean pulmonary artery pressure and lowers the cardiac output', z2.hemo.mPAP > z3.hemo.mPAP + 2 && z2.hemo.CO < z3.hemo.CO, `mPAP ${f(z3.hemo.mPAP)} → ${f(z2.hemo.mPAP)} mmHg, CO ${f(z3.hemo.CO, 2)} → ${f(z2.hemo.CO, 2)} L/min`);
  check('alveolar pressure below the pulmonary venous pressure changes nothing', near(simulate({ palv: 3 }).hemo.mPAP, z3.hemo.mPAP, 0.01));
}

// positive-pressure ventilation raises the pleural pressure and a spontaneous breath lowers it
{
  const pcv = lastBreath(runLung(LUNGS.normal, { mode: 'pcv', rate: 12, ti: 1, peep: 5, dp: 12 }, { seconds: 60 }));
  const spont = runLung(LUNGS.normal, { mode: 'pcv', rate: 15, ti: 1.2, peep: 0, dp: 0, pmus: 8 }, { seconds: 40 });
  const min = Math.min(...spont.ppl.slice(-Math.round(4 / spont.dt)));
  check('a positive-pressure breath raises the pleural pressure above zero throughout the cycle', pcv.pplMean > 0 && pcv.pplEnd > 0, `${f(pcv.pplMean * MMHG_PER_CMH2O, 2)} mmHg mean`);
  check('a spontaneous inspiratory effort lowers the pleural pressure below zero', min < -3, `${f(min * MMHG_PER_CMH2O, 1)} mmHg`);
}

console.log(failed ? `\n${failed} test(s) failed` : '\nall respiratory mechanics checks passed');
process.exit(failed ? 1 : 0);
