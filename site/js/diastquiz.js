// Predict-then-test questions for the Diastolic lab. Each question is answered by running the model,
// so the correct choice and the numbers in the explanation always follow the model. Pure (no DOM):
// tests/diastolic.test.mjs checks every answer.
//   setup: the state the "show me" button puts in the simulator ({ g, vol, svrX, surge, rhythm, afRate })
//   run(): { key, facts, explain } with key the correct choice
import { GRADES, solveCond, readout, consequences, CUT, CONSEQ } from './diastcore.js';

const cache = new Map();
function state(g, cond = {}) {
  const k = `${g}|${JSON.stringify(cond)}`;
  if (!cache.has(k)) cache.set(k, readout(solveCond(GRADES[g].params, cond)));
  return cache.get(k);
}
const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const pct = (a, b) => (b / a - 1) * 100;
const lungs = (o) => consequences(o).items[0].text;

export const QUESTIONS = [
  {
    id: 'pseudo', topic: 'Echo', setup: { g: 2 },
    prompt: 'The mitral inflow shows E/A 1.4 with a deceleration time of 173 ms, which looks normal. Which finding shows that the LA pressure is raised?',
    choices: [['ea', 'The E/A ratio itself'], ['dt', 'The deceleration time'], ['sup', 'A low e′ with a high E/e′ and an enlarged LA']],
    run() {
      const o = state(2), e = o.echo;
      const key = e.EA > CUT.EA_low && e.EA < CUT.EA_high && e.Eep > CUT.Eep && e.LAVI > CUT.LAVI ? 'sup' : 'ea';
      return { key, explain: `This is grade II (pseudonormal). LA pressure is ${f0(o.LAP)} mmHg, high enough to restore the early gradient that slow relaxation took away, so E/A (${f2(e.EA)}) and DT (${f0(e.DT)} ms) look normal. Relaxation is still slow, so e′ stays low (${f1(e.ep)} cm/s), E/e′ is ${f1(e.Eep)} and the LA volume index is ${f0(e.LAVI)} mL/m². Those supporting criteria, not the E/A ratio, tell you the pressure is up.` };
    },
  },
  {
    id: 'grade1', topic: 'Echo', setup: { g: 1 },
    prompt: 'In grade I, E is low and A is tall. What causes this?',
    choices: [['relax', 'Slow relaxation lowers the early LA–LV gradient, so the atrium does more of the filling'], ['lap', 'LA pressure is high'], ['stiff', 'The LV is so stiff that it cannot fill early']],
    run() {
      const o = state(1), n = state(0);
      const key = o.echo.tauMs > n.echo.tauMs * 1.5 && o.LAP < 12 ? 'relax' : 'lap';
      return { key, explain: `τ is ${f0(o.echo.tauMs)} ms against ${f0(n.echo.tauMs)} ms in the normal heart, while LA pressure is still ${f0(o.LAP)} mmHg. The LV pressure falls slowly after mitral opening, so the early gradient is small: E falls to ${f0(o.echo.E)} cm/s, A rises to ${f0(o.echo.A)} cm/s (E/A ${f2(o.echo.EA)}), IVRT lengthens to ${f0(o.echo.IVRT)} ms and e′ falls to ${f1(o.echo.ep)} cm/s. The chamber is only mildly stiff, which is why the pressure is still normal.` };
    },
  },
  {
    id: 'unmask', topic: 'Echo', setup: { g: 2, vol: -1500 },
    prompt: 'Grade II patient. Remove 1.5 L, the model’s stand-in for preload reduction by Valsalva. What does the E/A ratio become?',
    choices: [['low', 'Below 0.8, an impaired-relaxation pattern'], ['same', 'Still between 0.8 and 2'], ['high', '2 or more, restrictive']],
    run() {
      const a = state(2), b = state(2, { vol: -1500 }), ea = b.echo.EA;
      return { key: ea <= CUT.EA_low ? 'low' : ea < CUT.EA_high ? 'same' : 'high',
        explain: `LA pressure falls from ${f0(a.LAP)} to ${f0(b.LAP)} mmHg and E/A falls from ${f2(a.echo.EA)} to ${f2(ea)}. The pressure had been masking the slow relaxation, and removing it unmasks the grade I pattern. e′ barely moves (${f1(a.echo.ep)} → ${f1(b.echo.ep)} cm/s), because it follows relaxation, not preload.` };
    },
  },
  {
    id: 'fixed', topic: 'Echo', setup: { g: 4, vol: -1500 },
    prompt: 'Grade III and grade IV patients both have E/A above 2. After 1.5 L is removed, which one keeps the restrictive pattern?',
    choices: [['g3', 'Grade III'], ['g4', 'Grade IV'], ['both', 'Both'], ['neither', 'Neither']],
    run() {
      const a = state(3, { vol: -1500 }), b = state(4, { vol: -1500 });
      const r3 = a.echo.EA >= CUT.EA_high, r4 = b.echo.EA >= CUT.EA_high;
      return { key: r3 && r4 ? 'both' : r4 ? 'g4' : r3 ? 'g3' : 'neither',
        explain: `Grade III falls to E/A ${f2(a.echo.EA)} (reversible); grade IV stays at ${f2(b.echo.EA)} (fixed), because its ventricle is stiff even at a lower volume. In the virtual cohort this split is not clean: reversibility is a continuum across patients.` };
    },
  },
  {
    id: 'fluid3', topic: 'Fluid', setup: { g: 3, vol: 500 },
    prompt: 'Grade III patient, LA pressure 21 mmHg. You give 500 mL. What happens?',
    choices: [['both', 'Cardiac output rises and LA pressure rises a little'], ['lap', 'Cardiac output barely changes and LA pressure rises by 3–4 mmHg'], ['none', 'Neither changes much']],
    run() {
      const a = state(3), b = state(3, { vol: 500 }), dco = pct(a.CO, b.CO), dl = b.LAP - a.LAP;
      return { key: Math.abs(dco) < 3 && dl >= 2 && dl <= 6 ? 'lap' : dco >= 3 ? 'both' : 'none',
        explain: `Cardiac output goes from ${f2(a.CO)} to ${f2(b.CO)} L/min, a change of ${f1(Math.abs(dco))}%, and LA pressure goes from ${f1(a.LAP)} to ${f1(b.LAP)} mmHg. The stiff ventricle sits on the flat part of its output curve and the steep part of its pressure curve, so the fluid adds pressure without flow. The patient was already congested, and is now ${f1(Math.max(0, CONSEQ.edema - b.LAP))} mmHg below the alveolar edema range (${CONSEQ.edema} mmHg; lungs: ${lungs(b)}). A second bolus would cross it.` };
    },
  },
  {
    id: 'diur', topic: 'Diuresis', setup: { g: 1, vol: -1000 },
    prompt: 'You remove 1 L from a grade I patient and from a grade III patient. Which one loses more cardiac output?',
    choices: [['g1', 'Grade I'], ['g3', 'Grade III'], ['same', 'About the same']],
    run() {
      const a1 = state(1), b1 = state(1, { vol: -1000 }), a3 = state(3), b3 = state(3, { vol: -1000 });
      const d1 = b1.CO - a1.CO, d3 = b3.CO - a3.CO;
      return { key: Math.abs(d1 - d3) < 0.15 ? 'same' : d1 < d3 ? 'g1' : 'g3',
        explain: `Grade I loses ${f2(-d1)} L/min (LA pressure ${f0(a1.LAP)} → ${f0(b1.LAP)} mmHg); grade III loses ${f2(-d3)} L/min (LA pressure ${f0(a3.LAP)} → ${f0(b3.LAP)} mmHg). Grade I starts at a normal filling pressure and depends on preload and its atrial kick; grade III starts congested, on the flat part of its curve. Diuresis is the treatment for grade III and a hazard in grade I.` };
    },
  },
  {
    id: 'afterload', topic: 'Afterload', setup: { g: 4, svrX: 1.5 },
    prompt: 'Grade IV patient. SVR rises by 50%, with no change in venous tone. By how much does LA pressure rise?',
    choices: [['small', 'Less than 2 mmHg'], ['mid', '2 to 5 mmHg'], ['large', 'More than 5 mmHg']],
    run() {
      const a = state(4), b = state(4, { svrX: 1.5 }), c = state(4, { svrX: 1.5, recruit: 200 });
      const d = b.LAP - a.LAP;
      return { key: d < 2 ? 'small' : d <= 5 ? 'mid' : 'large',
        explain: `LA pressure rises by ${f1(d)} mmHg while stroke volume falls ${f0(-pct(a.SV, b.SV))}%. Afterload alone does not flood the lungs. Add the venoconstriction of a sympathetic surge (200 mL moved into the stressed volume) and LA pressure rises by ${f1(c.LAP - a.LAP)} mmHg, to ${f0(c.LAP)} mmHg. In a stiff ventricle, a small shift of volume becomes a large rise in pressure. Tick “Sympathetic surge” in the simulator to see it.` };
    },
  },
  {
    id: 'afrate', topic: 'Atrial fibrillation', setup: { g: 1, rhythm: 'af', afRate: 130 },
    prompt: 'AF with a ventricular rate of 130/min. Which patient loses more cardiac output: grade I or grade IV?',
    choices: [['g1', 'Grade I'], ['g4', 'Grade IV'], ['same', 'About the same']],
    run() {
      const a1 = state(1), b1 = state(1, { rhythm: 'af', afRate: 130 }), a4 = state(4), b4 = state(4, { rhythm: 'af', afRate: 130 });
      const p1 = pct(a1.CO, b1.CO), p4 = pct(a4.CO, b4.CO);
      return { key: Math.abs(p1 - p4) < 5 ? 'same' : p1 < p4 ? 'g1' : 'g4',
        explain: `Grade I loses ${f0(-p1)}% of its output, and its LA pressure rises from ${f0(a1.LAP)} to ${f0(b1.LAP)} mmHg; grade IV changes by ${f0(p4)}%. Grade I fills by slow relaxation and a strong atrial kick, and AF takes both: the kick, and the diastolic time that a short RR interval cuts off. Grade IV had little atrial contribution left to lose. This is the acute effect only; chronic AF remodels the atrium and worsens congestion over years.` };
    },
  },
  {
    id: 'kick', topic: 'Atrial fibrillation', setup: { g: 1, rhythm: 'af', afRate: 70 },
    prompt: 'Grade I patient goes into AF with the rate held at 70/min, so only the atrial kick and the regular rhythm are lost. By how much does cardiac output fall?',
    choices: [['small', 'Less than 5%'], ['mid', '5% to 20%'], ['large', 'More than 20%']],
    run() {
      const a = state(1), b = state(1, { rhythm: 'af', afRate: 70 }), p = -pct(a.CO, b.CO);
      return { key: p < 5 ? 'small' : p <= 20 ? 'mid' : 'large',
        explain: `Cardiac output falls ${f0(p)}% (${f2(a.CO)} → ${f2(b.CO)} L/min). In sinus rhythm, the atrium delivers ${f0(a.atrialFill * 100)}% of this patient’s filling. Rate control alone does not restore it; only sinus rhythm does.` };
    },
  },
];
