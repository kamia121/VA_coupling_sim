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
      return { key, explain: `This is the pseudonormal pattern of grade II. A mean LA pressure of ${f0(o.LAP)} mmHg restores the early transmitral gradient that slow relaxation had narrowed, so that E/A (${f2(e.EA)}) and the deceleration time (${f0(e.DT)} ms) fall in the normal range. Relaxation remains slow, and the relatively preload-independent indices remain abnormal, with an e′ of ${f1(e.ep)} cm/s, an E/e′ of ${f1(e.Eep)} and an LA volume index of ${f0(e.LAVI)} mL/m². These indices, and not the E/A ratio, identify the raised filling pressure.` };
    },
  },
  {
    id: 'grade1', topic: 'Echo', setup: { g: 1 },
    prompt: 'In grade I, E is reduced and A is increased. What causes this pattern?',
    choices: [['relax', 'Slow relaxation lowers the early LA–LV gradient, so the atrium does more of the filling'], ['lap', 'LA pressure is high'], ['stiff', 'The LV is so stiff that it cannot fill early']],
    run() {
      const o = state(1), n = state(0);
      const key = o.echo.tauMs > n.echo.tauMs * 1.5 && o.LAP < 12 ? 'relax' : 'lap';
      return { key, explain: `With a relaxation time constant of ${f0(o.echo.tauMs)} ms, against ${f0(n.echo.tauMs)} ms in the normal ventricle, LV pressure is still falling when the mitral valve opens. The early transmitral gradient narrows, E falls and the atrial kick carries more of the filling, giving an E/A ratio of ${f2(o.echo.EA)}. Chamber stiffness is only mildly increased, and mean LA pressure remains ${f0(o.LAP)} mmHg.` };
    },
  },
  {
    id: 'unmask', topic: 'Echo', setup: { g: 2, vol: -1500 },
    prompt: 'A grade II patient has 1.5 L removed, a preload reduction standing in for the Valsalva maneuver. What does the E/A ratio become?',
    choices: [['low', 'Below 0.8, an impaired-relaxation pattern'], ['same', 'Still between 0.8 and 2'], ['high', '2 or more, restrictive']],
    run() {
      const a = state(2), b = state(2, { vol: -1500 }), ea = b.echo.EA;
      return { key: ea <= CUT.EA_low ? 'low' : ea < CUT.EA_high ? 'same' : 'high',
        explain: `Mean LA pressure falls from ${f0(a.LAP)} to ${f0(b.LAP)} mmHg and E/A from ${f2(a.echo.EA)} to ${f2(ea)}. Without the raised filling pressure that had restored the early gradient, the slow relaxation of the ventricle again determines the mitral pattern. Lateral e′, a relatively preload-independent surrogate of relaxation, changes from ${f1(a.echo.ep)} to ${f1(b.echo.ep)} cm/s.` };
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
        explain: `E/A falls to ${f2(a.echo.EA)} in grade III and remains ${f2(b.echo.EA)} in grade IV, whose ventricle stays on the steep limb of its EDPVR even at a lower volume. Among the 40 simulated patients of each grade, reversibility varies continuously and the two grades overlap.` };
    },
  },
  {
    id: 'fluid3', topic: 'Fluid', setup: { g: 3, vol: 500 },
    prompt: 'A grade III patient with a mean LA pressure of 21 mmHg receives 500 mL of fluid. What happens?',
    choices: [['both', 'Cardiac output rises and LA pressure rises a little'], ['lap', 'Cardiac output barely changes and LA pressure rises by 3–4 mmHg'], ['none', 'Neither changes much']],
    run() {
      const a = state(3), b = state(3, { vol: 500 }), dco = pct(a.CO, b.CO), dl = b.LAP - a.LAP;
      return { key: Math.abs(dco) < 3 && dl >= 2 && dl <= 6 ? 'lap' : dco >= 3 ? 'both' : 'none',
        explain: `${Math.abs(dco) < 0.5 ? `Cardiac output is unchanged at ${f2(b.CO)} L/min` : `Cardiac output changes by ${f1(Math.abs(dco))}%, from ${f2(a.CO)} to ${f2(b.CO)} L/min,`} while mean LA pressure rises from ${f1(a.LAP)} to ${f1(b.LAP)} mmHg. The stiff ventricle operates on the plateau of its Frank–Starling relation and the steep limb of its EDPVR, so the added volume raises filling pressure without raising stroke volume. Already congested at baseline, the patient now sits ${f1(Math.max(0, CONSEQ.edema - b.LAP))} mmHg below the ${CONSEQ.edema} mmHg edema threshold, which a second bolus would exceed.` };
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
        explain: `Cardiac output falls by ${f2(-d1)} L/min in grade I, as mean LA pressure falls from ${f0(a1.LAP)} to ${f0(b1.LAP)} mmHg, and by ${f2(-d3)} L/min in grade III, as it falls from ${f0(a3.LAP)} to ${f0(b3.LAP)} mmHg. Starting from a normal filling pressure, the slowly relaxing ventricle of grade I depends on preload and the atrial kick to reach its end-diastolic volume. The congested grade III ventricle operates on the plateau of its Frank–Starling relation and gives up pressure with little loss of volume.` };
    },
  },
  {
    id: 'afterload', topic: 'Afterload', setup: { g: 4, svrX: 1.5 },
    prompt: 'In a grade IV patient, SVR rises by 50% with no change in venous tone. By how much does mean LA pressure rise?',
    choices: [['small', 'Less than 2 mmHg'], ['mid', '2 to 5 mmHg'], ['large', 'More than 5 mmHg']],
    run() {
      const a = state(4), b = state(4, { svrX: 1.5 }), c = state(4, { svrX: 1.5, recruit: 200 });
      const d = b.LAP - a.LAP;
      return { key: d < 2 ? 'small' : d <= 5 ? 'mid' : 'large',
        explain: `Mean LA pressure rises by ${f1(d)} mmHg while stroke volume falls by ${f0(-pct(a.SV, b.SV))}%. When the rise in SVR is accompanied by sympathetic venoconstriction that moves 200 mL into the stressed volume, mean LA pressure rises by ${f1(c.LAP - a.LAP)} mmHg, to ${f0(c.LAP)} mmHg, because the stiff ventricle converts a small central shift of volume into a large rise in filling pressure. The “Sympathetic surge” option in the simulator adds this recruitment.` };
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
        explain: `Grade I loses ${f0(-p1)}% of its cardiac output, and its mean LA pressure rises from ${f0(a1.LAP)} to ${f0(b1.LAP)} mmHg; in grade IV, cardiac output ${p4 < 0 ? 'falls' : 'rises'} by ${f0(Math.abs(p4))}%. Filling in grade I depends on slow relaxation and on a strong atrial kick, and AF removes the kick while the short RR interval cuts off the time that slow relaxation needs. In grade IV, the atrium was contributing little before AF began. Over years, chronic AF also remodels the atrium, which the acute simulation does not include.` };
    },
  },
  {
    id: 'kick', topic: 'Atrial fibrillation', setup: { g: 1, rhythm: 'af', afRate: 70 },
    prompt: 'Grade I patient goes into AF with the rate held at 70/min, so only the atrial kick and the regular rhythm are lost. By how much does cardiac output fall?',
    choices: [['small', 'Less than 5%'], ['mid', '5% to 20%'], ['large', 'More than 20%']],
    run() {
      const a = state(1), b = state(1, { rhythm: 'af', afRate: 70 }), p = -pct(a.CO, b.CO);
      return { key: p < 5 ? 'small' : p <= 20 ? 'mid' : 'large',
        explain: `Cardiac output falls by ${f0(p)}%, from ${f2(a.CO)} to ${f2(b.CO)} L/min. In sinus rhythm, the atrial kick supplies ${f0(a.atrialFill * 100)}% of LV filling in this patient, a share that rate control cannot restore.` };
    },
  },
];
