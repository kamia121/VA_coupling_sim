// Diastolic lab: each grade reproduces its echo pattern, the directions of the tolerance results,
// every number quoted on diastolic.html, and that the shipped cohort data match the code.
// Run with: node tests/diastolic.test.mjs
import { simulate } from '../site/js/engine.js';
import { GRADES, solveCond, readout, protocol, tolerance, gradeFromEcho, CUT, SBT, VENT, ISCHEMIA, CONSEQ } from '../site/js/diastcore.js';
import { COHORT } from '../site/js/diastdata.js';
import { QUESTIONS } from '../site/js/diastquiz.js';
import { consequences } from '../site/js/diastcore.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!cond) failed++;
}
function q(where, value, target, tol) {
  const ok = Math.abs(value - target) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${where}: ${value.toFixed(3)} (quoted ${target})`);
  if (!ok) failed++;
}
const f2 = (v) => v.toFixed(2);

// ---------- engine: the mitral orifice is opt-in ----------
const n0 = simulate({}), nA = simulate({ mvArea: 0 });
check('mvArea 0 (default) leaves the engine unchanged', Math.abs(n0.hemo.CO - nA.hemo.CO) < 1e-12 && Math.abs(n0.hemo.LAP - nA.hemo.LAP) < 1e-12);
const nL = simulate({ laPiso: 0, laKej: 0, ppl: 0 });
check('laPiso, laKej and ppl 0 (default) leave the engine unchanged', Math.abs(n0.hemo.CO - nL.hemo.CO) < 1e-12 && Math.abs(n0.hemo.LAP - nL.hemo.LAP) < 1e-12);

// ---------- each grade as found ----------
const O = GRADES.map((g) => readout(solveCond(g.params, {})));
const D = GRADES.map((g) => readout(solveCond(g.params, { vol: -1500 })));
const e = O.map((o) => o.echo);
check('normal: E/A 0.8–2, DT 160–240 ms, E/e′ < 8', e[0].EA > 0.8 && e[0].EA < 2 && e[0].DT > 160 && e[0].DT < 240 && e[0].Eep < 8, `${f2(e[0].EA)}, ${e[0].DT.toFixed(0)}, ${e[0].Eep.toFixed(1)}`);
check('grade I: E/A ≤ 0.8, DT > 200 ms, IVRT longer, LAP normal', e[1].EA <= CUT.EA_low && e[1].DT > 200 && e[1].IVRT > e[0].IVRT + 40 && O[1].LAP < 12);
check('grade II: E/A 0.8–2 with E/e′ > 13 and LAVI > 34', e[2].EA > CUT.EA_low && e[2].EA < CUT.EA_high && e[2].Eep > CUT.Eep && e[2].LAVI > CUT.LAVI);
check('grade III: E/A ≥ 2, DT < 160 ms', e[3].EA >= CUT.EA_high && e[3].DT < 160);
check('grade IV: E/A ≥ 2, DT shorter than grade III, TR > 2.8 m/s, S/D < 1', e[4].EA >= CUT.EA_high && e[4].DT < e[3].DT && e[4].TRv > CUT.TR && e[4].SD < 1);
check('echo algorithm grades the reference patients 0, I, II, III, III', e.map((x) => x.grade).join() === '0,1,2,3,3', e.map((x) => x.grade).join());
check('LAP rises with grade', O.every((o, i) => i === 0 || o.LAP > O[i - 1].LAP + 1), O.map((o) => o.LAP.toFixed(1)).join(' '));
check('e′ falls from normal to every grade', e.slice(1).every((x) => x.ep < CUT.ep));
check('grade II unmasks to a relaxation pattern after preload reduction', D[2].echo.grade === 1 && D[2].echo.EA < e[2].EA - 0.4);
check('grade III is reversible: E/A < 2 after preload reduction', D[3].echo.EA < CUT.EA_high, f2(D[3].echo.EA));
check('grade IV is fixed: E/A ≥ 2 after preload reduction', D[4].echo.EA >= CUT.EA_high, f2(D[4].echo.EA));
check('AF: no A wave, not graded', readout(solveCond(GRADES[2].params, { rhythm: 'af', afRate: 90 })).echo.grade === null);
check('gradeFromEcho: E/A ≥ 2 is grade III', gradeFromEcho({ E: 90, A: 30, EA: 3, Eep: 10, TRv: 2, LAVI: 20, ep: 8 }) === 3);

// ---------- tolerance directions (reference patients) ----------
const T = GRADES.map((g) => tolerance(protocol(g.params)));
check('volume window narrows with grade', T.every((t, i) => i === 0 || t.window < T[i - 1].window), T.map((t) => t.window).join(' '));
check('fluid: CO gain with 500 mL is smaller from grade II on', T.slice(2).every((t) => t.co500 < 0.05) && T[0].co500 > 0.05);
check('fluid: LAP rise per litre grows from grade I on', T.slice(1).every((t, i) => t.lap1000 > T[i].lap1000));
check('diuresis: grade I loses more CO than normal; grades III–IV lose little', T[1].coDiur < T[0].coDiur && T[3].coDiur > -0.2 && T[4].coDiur > -0.2);
check('afterload: LAP rise grows from grade I to IV', T.slice(2).every((t, i) => t.aftLAP > T[i + 1].aftLAP));
check('surge raises LAP more than afterload alone, more in the late grades', T.every((t) => t.surgeLAP > t.aftLAP + 2) && T[4].surgeLAP > T[0].surgeLAP + 2);
check('AF at the same rate lowers CO in every grade', T.every((t) => t.af70CO < -5));
check('AF at 130/min: grade I is least tolerant', T[1].af130CO < Math.min(T[0].af130CO, T[2].af130CO, T[3].af130CO, T[4].af130CO));

// ---------- the shipped cohort matches the code ----------
for (const [g, t] of T.entries()) {
  const ref = COHORT.grades[g].patients.find((p) => p.ref).tol;
  check(`cohort data current: grade ${g} reference patient`, Math.abs(ref.LAP - t.LAP) < 0.05 && Math.abs(ref.window - t.window) < 1 && Math.abs(ref.af130CO - t.af130CO) < 0.1,
    `${ref.LAP} vs ${t.LAP.toFixed(2)}`);
}
check('cohort has 40 patients per grade plus a reference', COHORT.grades.every((g) => g.patients.length === 41));

// ---------- AF: nothing steps at the QRS ----------
// Each beat of an irregular run starts while the previous beat's relaxation tail is still up. That tail keeps
// its own AV-plane reference and Ees, so LA pressure is continuous across the QRS and mitral flow has no spike
// there. A spike is a maximum at t = 0 above the previous beat's flow carried on at its last slope; the allowance
// is 2 mL/s (0.5 cm/s through 4 cm²). A valve that opens at the QRS gives a flow that keeps rising, not a spike.
for (const [g, rate] of [[4, 110], [4, 150], [2, 110], [3, 130], [0, 150]]) {
  const { beats } = solveCond(GRADES[g].params, { rhythm: 'af', afRate: rate });
  let dQ = 0, dP = 0;
  for (let k = 1; k < beats.length; k++) {
    const a = beats[k - 1].rec, b = beats[k].rec;
    const carried = a.Qmv.at(-1) + Math.max(0, a.Qmv.at(-1) - a.Qmv.at(-2));
    if (b.Qmv[0] >= b.Qmv[1]) dQ = Math.max(dQ, b.Qmv[0] - carried);
    dP = Math.max(dP, Math.abs(b.Pla[0] - a.Pla.at(-1)));
  }
  check(`AF ${rate}/min, grade ${GRADES[g].roman}: no mitral flow spike at the QRS`, dQ < 2, `${f2(dQ)} mL/s`);
  check(`AF ${rate}/min, grade ${GRADES[g].roman}: LA pressure continuous at the QRS`, dP < 0.1, `${f2(dP)} mmHg`);
}

// ---------- reference-patient values (grade table, simulator and question explanations) ----------
q('normal E', e[0].E, 89, 0.6); q('normal A', e[0].A, 77, 0.6); q('normal E/A', e[0].EA, 1.16, 0.006); q('normal DT', e[0].DT, 226, 0.6);
q('normal e′', e[0].ep, 11.8, 0.06); q('normal E/e′', e[0].Eep, 7.5, 0.06); q('normal LAP', O[0].LAP, 7, 0.5);
q('grade I τ', e[1].tauMs, 68, 0.6); q('normal τ', e[0].tauMs, 36, 0.6);
q('grade I E', e[1].E, 71, 0.6); q('grade I A', e[1].A, 102, 0.6); q('grade I E/A', e[1].EA, 0.70, 0.006);
q('normal IVRT', e[0].IVRT, 92, 0.6); q('grade I IVRT', e[1].IVRT, 174, 0.6); q('grade I e′', e[1].ep, 6.4, 0.06); q('grade I LAP', O[1].LAP, 8, 0.5);
q('grade II LAP', O[2].LAP, 16, 0.5); q('grade II E/A', e[2].EA, 1.37, 0.006); q('grade II e′', e[2].ep, 5.9, 0.06); q('grade II E/e′', e[2].Eep, 13.9, 0.06);
q('grade II LAVI', e[2].LAVI, 38, 0.6); q('grade II −1.5 L LAP', D[2].LAP, 7, 0.5); q('grade II −1.5 L E/A', D[2].echo.EA, 0.76, 0.006);
q('grade III E/A', e[3].EA, 2.24, 0.006); q('grade III DT', e[3].DT, 141, 0.6); q('grade III LAP', O[3].LAP, 21, 0.5); q('grade III −1.5 L E/A', D[3].echo.EA, 1.42, 0.006);
q('grade IV E/A', e[4].EA, 5.72, 0.006); q('grade IV DT', e[4].DT, 125, 0.6); q('grade IV S/D', e[4].SD, 0.93, 0.006); q('grade IV TR', e[4].TRv, 3.13, 0.006);
q('grade IV mPAP', O[4].mPAP, 39, 0.5); q('grade IV LAP', O[4].LAP, 29, 0.5); q('grade IV −1.5 L E/A', D[4].echo.EA, 2.16, 0.006);
q('grade III Nagueh estimate', e[3].pcwpNagueh, 19, 0.5); q('grade IV Nagueh estimate', e[4].pcwpNagueh, 20, 0.5);
q('LAP rise 1 L, normal', T[0].lap1000, 5.3, 0.06); q('LAP rise 1 L, grade IV', T[4].lap1000, 7.9, 0.06);
q('CO gain 500 mL, normal', T[0].co500, 0.12, 0.006); q('CO gain 500 mL, grade I', T[1].co500, 0.18, 0.006); q('CO gain 500 mL, grade II', T[2].co500, 0.02, 0.006);
q('CO gain 500 mL, grade III', T[3].co500, 0, 0.006); q('CO gain 500 mL, grade IV', T[4].co500, 0, 0.006);
q('LAP fall 1 L removed, grade III', -T[3].lapDiur, 7.7, 0.06); q('LAP fall 1 L removed, grade IV', -T[4].lapDiur, 9.5, 0.06);
q('CO fall 1 L removed, grade III', -T[3].coDiur, 0.1, 0.02); q('CO fall 1 L removed, grade IV', -T[4].coDiur, 0.1, 0.02);
q('CO fall 1 L removed, grade I', -T[1].coDiur, 1.26, 0.006); q('CO fall 1 L removed, normal', -T[0].coDiur, 1.02, 0.006);
q('window normal', T[0].window, 2530, 10); q('window normal lo', T[0].winLo, -570, 10); q('window normal hi', T[0].winHi, 1970, 10);
q('window grade I', T[1].window, 2090, 10); q('window grade II', T[2].window, 1440, 10);
q('window grade III', T[3].window, 1060, 10); q('window grade III lo', T[3].winLo, -1500, 10); q('window grade III hi', T[3].winHi, -440, 10);
q('window grade IV', T[4].window, 370, 10); q('window grade IV lo', T[4].winLo, -1560, 10); q('window grade IV hi', T[4].winHi, -1190, 10);
q('grade IV patients with no window', COHORT.grades[4].patients.filter((p) => !p.ref && !(p.tol.window > 0)).length, 3, 0);
check('afterload SV fall 11–13% in every grade', T.every((t) => t.aftSVpct < -10.5 && t.aftSVpct > -13.5), T.map((t) => t.aftSVpct.toFixed(1)).join(' '));
q('afterload LAP, normal', T[0].aftLAP, 0.4, 0.06); q('afterload LAP, grade IV', T[4].aftLAP, 1.6, 0.06);
q('surge LAP, normal', T[0].surgeLAP, 3.5, 0.06); q('surge LAP, grade II', T[2].surgeLAP, 4.9, 0.06); q('surge LAP, grade IV', T[4].surgeLAP, 6.4, 0.06);
check('AF at 70/min lowers CO by 10–14%', T.every((t) => t.af70CO <= -9.5 && t.af70CO >= -14.5), T.map((t) => t.af70CO.toFixed(1)).join(' '));
q('AF 130 CO, normal', T[0].af130CO, -1, 0.6); q('AF 130 LAP, normal', T[0].af130LAP, 3.0, 0.06);
q('AF 130 CO, grade I', T[1].af130CO, -28, 0.6); q('AF 130 LAP, grade I', T[1].af130LAP, 7.8, 0.06);
q('AF 130 CO, grade II', T[2].af130CO, -17, 0.6); q('AF 130 LAP, grade II', T[2].af130LAP, 6.6, 0.06);
q('AF 110 CO, grade III', T[3].af110CO, 2, 0.6); q('AF 110 CO, grade IV', T[4].af110CO, 1, 0.6);
check('AF 130 CO, grades III–IV: −6 to −8%', [3, 4].every((g) => T[g].af130CO <= -5.5 && T[g].af130CO >= -8.5), `${T[3].af130CO.toFixed(1)} ${T[4].af130CO.toFixed(1)}`);
q('AF 130 LAP, grade III', T[3].af130LAP, 1.9, 0.06); check('AF 130: LAP falls in grade IV', T[4].af130LAP < 0);
// cohort classification by the echo algorithm (as found, and after 1.5 L removed)
{
  const F = COHORT.fields.indexOf('echoGrade'), i0 = COHORT.conds.findIndex(([k, x]) => k === 'volume' && x === 0), i1 = COHORT.conds.findIndex(([k, x]) => k === 'volume' && x === -1500);
  const n = (g, idx, v) => COHORT.grades[g].patients.filter((p) => !p.ref && p.rows[idx][F] === v).length;
  q('cohort: grade II read as II', n(2, i0, 2), 31, 0); q('cohort: grade II read as I', n(2, i0, 1), 9, 0);
  q('cohort: grade III read as III', n(3, i0, 3), 24, 0); q('cohort: grade III read as II', n(3, i0, 2), 16, 0);
  q('cohort: grade III reverting', n(3, i1, 1) + n(3, i1, 2), 28, 0); q('cohort: grade III staying', n(3, i1, 3), 10, 0);
  q('cohort: grade IV reverting', n(4, i1, 1) + n(4, i1, 2), 14, 0); q('cohort: grade IV staying', n(4, i1, 3), 21, 0);
}
const C = (g, t) => COHORT.grades[g].course.find((r) => r.t === t);
q('course grade III LAP 0', C(3, 0).LAP, 21, 0.5); q('course grade III LAP 30', C(3, 30).LAP, 24, 0.5); q('course grade III LAP 60', C(3, 60).LAP, 22.5, 0.5);
q('course grade IV LAP 0', C(4, 0).LAP, 29, 0.5); q('course grade IV LAP 30', C(4, 30).LAP, 33, 0.5); q('course grade IV LAP 60', C(4, 60).LAP, 31, 0.5);
q('course volume left at 60 min', C(3, 60).vol, 194, 0.6);
check('course: CO unchanged by the fluid in grades III–IV', Math.abs(C(3, 30).CO - C(3, 0).CO) < 0.02 && Math.abs(C(4, 30).CO - C(4, 0).CO) < 0.02);
q('course grade III LAP 240', C(3, 240).LAP, 11, 0.5); q('course grade IV LAP 240', C(4, 240).LAP, 17, 0.5);
check('course: diuresis costs about 0.2 L/min in grades III–IV', [3, 4].every((g) => Math.abs(C(g, 0).CO - C(g, 240).CO - 0.22) < 0.05));
q('course grade III E/A 240', C(3, 240).EA, 1.66, 0.006); q('course grade IV E/A 240', C(4, 240).EA, 2.89, 0.006);
q('course grade II E/A 0', C(2, 0).EA, 1.37, 0.006); q('course grade II E/A 240', C(2, 240).EA, 0.84, 0.006);
check('course: normal and grade I stop at the stressed-volume floor', C(0, 240).LAP == null && C(1, 240).LAP == null);

q('limits: grade III cardiac index', O[3].CO / 1.9, 1.8, 0.06); q('limits: grade IV cardiac index', O[4].CO / 1.9, 1.8, 0.06);
check('grades III–IV sit in the cold, wet subset at rest (stated in the limits)', [3, 4].every((g) => consequences(O[g]).subset === 'Cold and wet'));
// ---------- ranges and rounded values quoted in the rewritten text of diastolic.html ----------
{
  const r4 = COHORT.grades[4].patients.find((p) => p.ref).rows, F = Object.fromEntries(COHORT.fields.map((k, i) => [k, i]));
  const i0 = COHORT.conds.findIndex(([k, x]) => k === 'volume' && x === 0), i1 = COHORT.conds.findIndex(([k, x]) => k === 'volume' && x === 1000);
  q('EDPVR caption: grade IV EDP rise with 1 L', r4[i1][F.EDP] - r4[i0][F.EDP], 8, 0.5);
  check('E/e′ (Nagueh) underestimates LAP more in grade IV than in grade III', O[4].LAP - e[4].pcwpNagueh > O[3].LAP - e[3].pcwpNagueh + 3 && O[3].LAP - e[3].pcwpNagueh > 0);
  check('grade IV: post-capillary PH at rest', O[4].mPAP > 20 && O[4].LAP > 15);
  check('500 mL adds 0.1–0.2 L/min in normal and grade I', [0, 1].every((g) => T[g].co500 >= 0.1 && T[g].co500 <= 0.2));
  check('500 mL raises LAP by 3–4 mmHg in grades II–IV with no gain in output', [2, 3, 4].every((g) => T[g].lap500 >= 2.95 && T[g].lap500 <= 4.49 && T[g].co500 < 0.05));
  check('1 L raises LAP by about 5 in normal and 7–8 in grades III–IV', Math.abs(T[0].lap1000 - 5) < 0.5 && [3, 4].every((g) => T[g].lap1000 >= 6.95 && T[g].lap1000 <= 8.49));
  check('1 L removed lowers LAP by 8–9 in grades III–IV', [3, 4].every((g) => -T[g].lapDiur >= 7.5 && -T[g].lapDiur <= 9.5));
  check('grade I loses more than 1.2 L/min with 1 L removed, more than normal', -T[1].coDiur > 1.2 && T[1].coDiur < T[0].coDiur);
  q('window normal (L)', T[0].window / 1000, 2.5, 0.05); q('window grade II (L)', T[2].window / 1000, 1.45, 0.006);
  q('grade IV must lose about 1.2 L', -T[4].winHi / 1000, 1.2, 0.05);
  check('SVR × 1.5 alone raises LAP by less than 2 in every grade', T.every((t) => t.aftLAP < 2));
  check('surge LAP rise grows with grade', T.every((t, g) => g === 0 || t.surgeLAP > T[g - 1].surgeLAP - 0.05));
  check('AF 130: LAP rises 6–8 in grades I–II', [1, 2].every((g) => T[g].af130LAP >= 5.95 && T[g].af130LAP <= 8.49));
  check('AF: grades III–IV maintain output up to 110/min', [3, 4].every((g) => T[g].af110CO > -1));
  const C = (g, t) => COHORT.grades[g].course.find((r) => r.t === t);
  check('course: 1 L raises LAP by 3–4 in grades III–IV', [3, 4].every((g) => C(g, 30).LAP - C(g, 0).LAP >= 2.95 && C(g, 30).LAP - C(g, 0).LAP <= 4.49));
}

// ---------- atrial contraction limits, E–A fusion and the breathing trial ----------
{
  const lin = { ...GRADES[1].params, laPiso: 0, laKej: 0, laEmax: 2.0 };   // the linear atrium the limits replaced
  const s1 = readout(solveCond(GRADES[1].params, { breath: 'sbt' })), s1lin = readout(solveCond(lin, { breath: 'sbt' }));
  const s2 = readout(solveCond(GRADES[2].params, { breath: 'sbt' })), v1 = readout(solveCond(GRADES[1].params, { vol: 1000 }));
  q('README: grade I A in the breathing trial', s1.echo.A, 124, 0.6);
  q('limitations: linear atrium, grade I A in the breathing trial', s1lin.echo.A, 164, 0.6);
  check('limits: 1 L raises grade I E/A more than the linear atrium does', v1.echo.EA > readout(solveCond(lin, { vol: 1000 })).echo.EA + 0.05);
  // the LA a wave is kept: pressure rise during atrial systole (onset of the late-diastolic activation block to its peak)
  const aw = (r) => { const { aAct, Pla } = r.rec, n = aAct.length; let on = n - 1; while (on > 0 && aAct[on - 1] > 0.02) on--; let off = 0; while (aAct[off] > 0.02) off++;
    let pk = -Infinity; for (let k = on; k < n; k++) pk = Math.max(pk, Pla[k]); for (let k = 0; k < off; k++) pk = Math.max(pk, Pla[k]); return pk - Pla[on]; };
  check('limits: LA a wave of 5 mmHg or more in grade I, as found and in the breathing trial', aw(solveCond(GRADES[1].params).r) > 5 && aw(solveCond(GRADES[1].params, { breath: 'sbt' }).r) > 5);
  // ventilator and breathing trial (text of diastolic.html and the sbt question)
  const v1v = readout(solveCond(GRADES[1].params, { breath: 'vent' })), v2v = readout(solveCond(GRADES[2].params, { breath: 'vent' }));
  const s2i = readout(solveCond(GRADES[2].params, { breath: 'sbt', ischemia: true }));
  q('extubation: ventilator pleural pressure', VENT.ppl, 7, 0); q('extubation: trial pleural pressure', SBT.ppl, -4, 0);
  q('extubation: trial rate', SBT.hr, 85, 0); q('extubation: trial venoconstriction (mL)', SBT.recruit, 200, 0); q('extubation: SVR fall (%)', (1 - SBT.svrX) * 100, 15, 1e-9);
  q('extubation: ischemia τ factor', ISCHEMIA.tauX, 1.6, 0); q('extubation: ischemia Ees fall (%)', (1 - ISCHEMIA.eesX) * 100, 15, 1e-9);
  q('extubation: grade I E/A on the ventilator', v1v.echo.EA, 0.53, 0.006); q('extubation: grade I E/e′ on the ventilator', v1v.echo.Eep, 8.2, 0.06);
  q('extubation: grade I LAP on the ventilator', v1v.LAP, 5, 0.5); q('extubation: grade I LAP in the trial', s1.LAP, 14, 0.5);
  q('extubation: grade II LAP on the ventilator', v2v.LAP, 11, 0.5); q('extubation: grade II LAP in the trial', s2.LAP, 23, 0.5);
  q('extubation: grade II LAP in the trial with ischemia', s2i.LAP, 25, 0.5);
  check('extubation: ischemia merges E and A in grade II during the trial', s2i.echo.merged);
  check('extubation: both classified grade I on the ventilator', v1v.echo.grade === 1 && v2v.echo.grade === 1);
  check('extubation: grade II passes the congestion threshold in the trial', s2.LAP > CONSEQ.wet);
  check('extubation: grade I E/A stays below 0.8, with fusion (not merged)', s1.echo.EA < CUT.EA_low && s1.echo.fused && !s1.echo.merged, `${f2(s1.echo.EA)}, ${s1.echo.EatA.toFixed(0)} cm/s`);
  check('pleural pressure: LAP reported transmural (ventilator lowers transmural LAP in grade I)', v1v.LAP < O[1].LAP - 2);
  check('pleural pressure: τ fit unchanged by the ventilator', Math.abs(v1v.echo.tauMs - e[1].tauMs) < 2, `${v1v.echo.tauMs.toFixed(1)} vs ${e[1].tauMs.toFixed(1)}`);
  check('extubation: E/e′ rises with LA pressure in grade I', s1.echo.Eep > v1v.echo.Eep + 3);
  // a single merged wave is not graded by E/A
  const m = readout(solveCond(GRADES[1].params, { vol: -1000 })).echo;
  check('fusion: grade I after 1 L removed has merged E and A, E/A not measured, not graded', m.merged && Number.isNaN(m.EA) && m.grade === null);
  check('fusion: the reference patients as found are not merged', e.every((x) => !x.merged));
  q('limitations: normal LAVI', e[0].LAVI, 24, 0.5);
}

// ---------- predict-then-test answers (the model decides; these are the answers the page teaches) ----------
const EXPECT = { pseudo: 'sup', grade1: 'relax', unmask: 'low', fixed: 'g4', fluid3: 'lap', diur: 'g1', afterload: 'small', sbt: 'hidden', afrate: 'g1', kick: 'mid' };
for (const q of QUESTIONS) {
  const r = q.run();
  check(`question ${q.id}: model answer is ${EXPECT[q.id]}`, r.key === EXPECT[q.id], r.key);
  check(`question ${q.id}: answer is one of its choices`, q.choices.some(([k]) => k === r.key));
  check(`question ${q.id}: explanation has no NaN`, !/NaN|undefined/.test(r.explain));
}
check('every question has an expected answer', QUESTIONS.every((q) => q.id in EXPECT) && QUESTIONS.length === Object.keys(EXPECT).length);

// ---------- bedside consequences ----------
const cq = (o) => Object.fromEntries(consequences(o).items.map((x) => [x.id, x.level]));
check('normal heart: warm and dry, no flags', consequences(O[0]).subset === 'Warm and dry' && Object.values(cq(O[0])).every((l) => l === 0));
check('grade IV: wet, alveolar edema range, post-capillary PH', cq(O[4]).lungs === 2 && consequences(O[4]).items[3].text === 'post-capillary PH');
check('grade III: congested, not yet in the edema range', cq(O[3]).lungs === 1);
check('low output flagged below CI 2.2', cq({ ...O[0], CO: 3.9 }).perf === 1 && cq({ ...O[0], CO: 3.9, MAP: 60 }).perf === 2);

console.log(failed ? `\n${failed} check(s) failed` : '\nall diastolic checks passed');
process.exit(failed ? 1 : 0);
