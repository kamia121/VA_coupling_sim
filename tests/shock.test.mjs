// Shock lab: drug directions, kinetics, Fick identities, venous return, dynamic LVOT obstruction,
// and the course of each case. Run with: node tests/shock.test.mjs
import { simulate } from '../site/js/engine.js';
import { DRUGS, DRUG, combine, kinetics } from '../site/js/pharm.js';
import { oxygen, lactateStep, perfusion, O2 } from '../site/js/oxygen.js';
import { SHOCK, createPatient, advance, setDrug, give, setBleed, action, interfaces } from '../site/js/shockcore.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!cond) failed++;
}
const f2 = (v) => v.toFixed(2);
const run = (id, plan = () => {}, minutes = 20) => { const pt = createPatient(id); const o0 = pt.out; plan(pt); for (let t = 0; t < minutes; t += 5) advance(pt, Math.min(5, minutes - t)); return { o0, o: pt.out, pt }; };

// ---------- pharmacology ----------
for (const d of DRUGS) {
  const m = combine({ [d.id]: d.typical });
  const dir = (k) => Math.sign(d.fx[k] || 0);
  for (const k of ['svr', 'ees', 'hr', 'pvr', 'tau']) if (d.fx[k]) check(`${d.name}: ${k} ${dir(k) > 0 ? 'up' : 'down'}`, Math.sign(m[k] - 1) === dir(k), f2(m[k]));
  if (d.fx.vol) check(`${d.name}: venous volume ${dir('vol') > 0 ? 'recruited' : 'released'}`, Math.sign(m.vol) === dir('vol'), m.vol.toFixed(0));
}
for (const d of DRUGS) {
  const half = kinetics(0, 1, d.tHalf, d.tHalf), off = kinetics(1, 0, d.tHalf, d.tHalf);
  check(`${d.name}: 50% of steady level after one half-life, 50% left after stopping`, Math.abs(half - 0.5) < 1e-9 && Math.abs(off - 0.5) < 1e-9);
}
check('Milrinone half-life about 2 h (Edelson 1986)', DRUG.milrinone.tHalf === 120);

// ---------- oxygen ----------
const on = oxygen(O2.coRef);
check('Fick: DO2 = CO × CaO2 × 10', Math.abs(on.do2 - O2.coRef * on.cao2 * 10) < 1e-9);
check('Fick: VO2 = CO × (CaO2 − CvO2) × 10', Math.abs(on.vo2 - O2.coRef * 1.34 * O2.hb * (O2.sao2 - on.svo2) * 10) < 1e-6);
check('normal ScvO2 70–78%', on.svo2 > 0.7 && on.svo2 < 0.78, f2(on.svo2));
check('normal PCO2 gap 4 mmHg', Math.abs(on.gap - 4) < 1e-9);
check('VO2 supply independent above the critical DO2', Math.abs(oxygen(3.5).vo2 - on.vo2) < 1e-9);
check('VO2 falls below the critical DO2', oxygen(2).vo2 < on.vo2 - 1 && oxygen(2).deficit > 0);
check('PCO2 gap widens as flow falls', oxygen(3).gap > 6 && oxygen(8).gap < on.gap);
check('lactate normal at normal flow', Math.abs(lactateStep(1, 600, { deficit: 0, er: on.er, co: O2.coRef, cvp: 4 }) - 1) < 0.01);
check('lactate rises with an O2 deficit', lactateStep(1, 60, { deficit: 0.1, er: 0.65, co: 2, cvp: 4 }) > 3);
check('lactate rises with β2 stimulation at normal flow', lactateStep(1, 120, { deficit: 0, er: 0.25, co: O2.coRef, cvp: 4, beta2: 1 }) > 2);
const pn = perfusion({ map: 96, cvp: 4, pmsf: 7.8, svrRel: 1, co: O2.coRef });
check('normal capillary refill 2 s', Math.abs(pn.crt - 2) < 0.1, f2(pn.crt));
check('capillary refill prolonged by low flow and low perfusion pressure', perfusion({ map: 60, cvp: 10, pmsf: 10, svrRel: 1.3, co: 2.5 }).crt > 3);

// ---------- engine: venous return and LVOT ----------
const n = simulate({}), nV = simulate({ vStressed: 1005, baro: 0 }), nL = simulate({ vStressed: 505, baro: 0 });
check('normal Pmsf 7–10 mmHg (Rola 2025)', n.hemo.Pmsf > 7 && n.hemo.Pmsf < 10, f2(n.hemo.Pmsf));
check('Pmsf rises with volume and falls with loss', nV.hemo.Pmsf > n.hemo.Pmsf + 3 && nL.hemo.Pmsf < n.hemo.Pmsf - 2);
check('venous return = (Pmsf − RAP)/Rvr', Math.abs(n.hemo.vrGrad / n.hemo.Rvr * 60 / 1000 - n.hemo.CO) < 1e-9);
check('Rvr is independent of volume at fixed tone', Math.abs(nV.hemo.Rvr - n.hemo.Rvr) / n.hemo.Rvr < 0.02 && Math.abs(nL.hemo.Rvr - n.hemo.Rvr) / n.hemo.Rvr < 0.02);
check('mean circulatory filling pressure reported', n.hemo.Pmcf > 5 && n.hemo.Pmcf < 10, f2(n.hemo.Pmcf));
check('no LVOT gradient without obstruction', n.hemo.avPeakGrad < 5);
const L = { lvEes: 3.5, lvV0: 5, lvA: 0.35, lvBeta: 0.045, lvMass: 1.6, hr: 85, lvoto: 72, vStressed: 560, svr: 0.8 };
const g = (p) => simulate(p).hemo.avPeakGrad, g0 = g(L);
check('LVOTO: gradient present', g0 > 30, g0.toFixed(0));
check('LVOTO: inotrope raises the gradient', g({ ...L, lvEes: L.lvEes * 1.35, hr: L.hr + 10 }) > g0 + 10);
check('LVOTO: vasoconstrictor lowers it', g({ ...L, svr: L.svr * 1.5 }) < g0 - 10);
check('LVOTO: volume lowers it', g({ ...L, vStressed: L.vStressed + 150 }) < g0 - 5);
check('LVOTO: β-blockade lowers it', g({ ...L, hr: L.hr * 0.8, lvEes: L.lvEes * 0.85 }) < g0 - 10);
check('LVOTO: venodilator raises it', g({ ...L, vStressed: L.vStressed - 100 }) > g0 + 5);

// ---------- cases ----------
for (const s of SHOCK) { const pt = createPatient(s.id); check(`${s.label}: starts converged`, pt.r.converged && Number.isFinite(pt.out.map) && Number.isFinite(pt.out.lac)); }
check('healthy adult: all four interfaces coupled', interfaces(createPatient('normal').out).every((x) => x.ok));
{
  const { o0, o } = run('vasoplegia', (p) => setDrug(p, 'norepinephrine', 0.1), 15);
  check('vasoplegia: norepinephrine raises MAP past 65', o0.map < 65 && o.map > 75);
  check('vasoplegia: norepinephrine raises Pmsf', o.pmsf > o0.pmsf + 0.5);
  check('vasoplegia: interface II uncoupled at the start', !interfaces(o0)[1].ok);
}
{
  const t = createPatient('septicCM'); setDrug(t, 'norepinephrine', 0.1); advance(t, 15); const ne = t.out;
  setDrug(t, 'dobutamine', 5); advance(t, 15);
  check('septic CM: norepinephrine alone lowers CO', ne.co < createPatient('septicCM').out.co);
  check('septic CM: adding dobutamine raises CO and lowers Ea/Ees', t.out.co > ne.co + 0.5 && t.out.lvEaEes < ne.lvEaEes);
  const e = run('septicCM', (p) => setDrug(p, 'epinephrine', 0.05), 60), c = run('septicCM', () => {}, 60);
  check('septic CM: epinephrine raises lactate above the untreated course', e.o.lac > c.o.lac + 0.4, `${f2(e.o.lac)} vs ${f2(c.o.lac)}`);
}
{
  const d = run('cardiogenic', (p) => setDrug(p, 'dobutamine', 5), 15), ne = run('cardiogenic', (p) => setDrug(p, 'norepinephrine', 0.1), 15);
  const ntg = run('cardiogenic', (p) => setDrug(p, 'nitroglycerin', 50), 15), mil = run('cardiogenic', (p) => setDrug(p, 'milrinone', 0.375), 15);
  check('cardiogenic: LAP high with a normal CVP', d.o0.lap > 18 && d.o0.cvp < 8);
  check('cardiogenic: dobutamine raises CO and VTI', d.o.co > d.o0.co + 0.5 && d.o.vti > d.o0.vti);
  check('cardiogenic: norepinephrine raises MAP, lowers CO, raises LAP', ne.o.map > ne.o0.map && ne.o.co < ne.o0.co && ne.o.lap > ne.o0.lap);
  check('cardiogenic: nitroglycerin lowers LAP', ntg.o.lap < ntg.o0.lap - 2);
  check('cardiogenic: milrinone is slow (small change at 15 min)', mil.o.co - mil.o0.co < 0.4 * (d.o.co - d.o0.co));
}
{
  const pt = createPatient('hemorrhage'); const o0 = pt.out; advance(pt, 45); const o45 = pt.out;
  check('hemorrhage: MAP, CO and Pmsf fall', o45.map < o0.map - 15 && o45.co < o0.co - 1 && o45.pmsf < o0.pmsf - 3);
  check('hemorrhage: reflex tachycardia', o45.hr > o0.hr + 10);
  check('hemorrhage: Hb nearly unchanged during bleeding', o0.hb - o45.hb < 0.5);
  setBleed(pt, 0); give(pt, 'blood'); give(pt, 'blood'); advance(pt, 30);
  check('hemorrhage: blood restores MAP', pt.out.map > o45.map + 10);
}
{
  const f = run('peIschemia', (p) => give(p, 'crystalloid'), 15), ne = run('peIschemia', (p) => setDrug(p, 'norepinephrine', 0.1), 15);
  check('PE: fluid raises CVP without much CO', f.o.cvp > f.o0.cvp + 1 && f.o.co - f.o0.co < 0.3);
  check('PE: norepinephrine reverses the ischemic spiral', ne.o.ischR > 0.9 && ne.o.co > ne.o0.co + 1);
}
{
  const pt = createPatient('tamponade'); const o0 = pt.out; action(pt, 'drain'); advance(pt, 1);
  check('tamponade: drainage restores CO and lowers CVP', pt.out.co > o0.co + 1.5 && pt.out.cvp < o0.cvp - 3);
}
{
  const up = run('lvoto', (p) => setDrug(p, 'dobutamine', 10), 15), off = run('lvoto', (p) => { setDrug(p, 'dobutamine', 0); setDrug(p, 'phenylephrine', 100); }, 15);
  check('LVOTO case: more dobutamine raises gradient and lowers MAP', up.o.grad > up.o0.grad && up.o.map < up.o0.map);
  check('LVOTO case: stop dobutamine + phenylephrine lowers gradient and raises MAP', off.o.grad < off.o0.grad - 30 && off.o.map > off.o0.map + 10);
}

console.log(failed ? `\n${failed} test(s) failed` : '\nall shock tests passed');
process.exit(failed ? 1 : 0);
