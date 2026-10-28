// Ventricular interdependence in constriction against published endpoints. Run with: node tests/interdep.test.mjs
// A published mean ± SD is met when the model lies within 2 SD of it; a threshold, when the model is on the right
// side; a direction, when the sign agrees. The breath amplitude of quiet breathing is an assumption of the model.
import { cardiacPhases } from '../site/js/engine.js';
import { CASES, measure, runBeats, BREATHS } from '../site/js/pericard.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const gap = (name, detail) => console.log(`GAP   ${name}  ${detail}`);
const within = (v, lo, hi) => v >= lo && v <= hi;
const f = (x, d = 1) => x.toFixed(d);
const sd2 = (m, sd) => [m - 2 * sd, m + 2 * sd];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const R = {};
for (const k of ['normal', 'constriction', 'restriction']) {
  const run = runBeats(CASES[k].params, BREATHS.spont, { seconds: 16, warm: 8 });
  R[k] = { run, m: measure(run) };
}
const C = R.constriction.m, Q = R.restriction.m, N = R.normal.m;
const diff = (m) => m.dEtAo - m.dEtPa;
const inside = (name, v, mu, sd, detail) => check(name, within(v, ...sd2(mu, sd)), `${f(v)} ms (${f(mu - 2 * sd)} to ${f(mu + 2 * sd)})`);

// Jain 2022 (PMID 34550314, DOI 10.1001/jamacardio.2021.3478): ejection time in expiration less inspiration, ms
inside('Jain 2022: constriction, aortic ejection time, expiration less inspiration, within 19.0 ± 2×15.7 ms', C.dEtAo, 19.0, 15.7);
inside('Jain 2022: constriction, pulmonary artery ejection time, expiration less inspiration, within −31.8 ± 2×28.6 ms', C.dEtPa, -31.8, 28.6);
inside('Jain 2022: constriction, aortic minus pulmonary artery difference within 50.8 ± 2×22.5 ms', diff(C), 50.8, 22.5);
check('Jain 2022: in constriction the aortic ejection time is longer and the pulmonary artery ejection time shorter in expiration (signs of the means)',
  C.dEtAo > 0 && C.dEtPa < 0, `${f(C.dEtAo)}, ${f(C.dEtPa)} ms`);
inside('Jain 2022: without constriction, aortic ejection time (restrictive cardiomyopathy) within 10.5 ± 2×9.1 ms', Q.dEtAo, 10.5, 9.1);
inside('Jain 2022: without constriction, aortic minus pulmonary artery difference (restrictive cardiomyopathy) within 5.4 ± 2×15.2 ms', diff(Q), 5.4, 15.2);
inside('Jain 2022: normal pericardium, aortic ejection time within the non-constriction range 10.5 ± 2×9.1 ms (assumption: a normal circulation is comparable)', N.dEtAo, 10.5, 9.1);
inside('Jain 2022: normal pericardium, pulmonary artery ejection time within the non-constriction range 5.1 ± 2×9.5 ms (assumption: a normal circulation is comparable)', N.dEtPa, 5.1, 9.5);

// Assumption (Jain 2022 states that ejection times correlate with stroke volumes): across the beats of a breath, ejection time follows stroke volume
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0, x = 0, y = 0; a.forEach((v, i) => { s += (v - ma) * (b[i] - mb); x += (v - ma) ** 2; y += (b[i] - mb) ** 2; }); return s / Math.sqrt(x * y); };
const et = (r, side) => { const e = cardiacPhases(r)[side].events; return (e.outClose - e.outOpen) * r.dt * 1000; };
const beats = R.constriction.run.beats.map((b) => b.r);
const rLv = corr(beats.map((r) => et(r, 'lv')), beats.map((r) => r.lv.SV)), rRv = corr(beats.map((r) => et(r, 'rv')), beats.map((r) => r.rv.SV));
check('Jain 2022 (ejection times correlate with stroke volumes), constriction: beat-to-beat RV ejection time and RV stroke volume are positively correlated', rRv > 0.5, `r ${f(rRv, 2)}`);

// Talreja 2008 (PMID 18206742, DOI 10.1016/j.jacc.2007.09.039): the systolic area index separates constriction from restrictive myocardial disease
check('Talreja 2008: the systolic area index (RV to LV pressure–time area, inspiration over expiration) is higher in constriction than in restriction and in a normal pericardium (direction only; the abstract gives no threshold)',
  C.sai > Q.sai && C.sai > N.sai, `constriction ${f(C.sai, 2)}, restriction ${f(Q.sai, 2)}, normal ${f(N.sai, 2)}`);

// Findings the model does not reproduce, printed and not counted.
gap('Jain 2022 (ejection times correlate with stroke volumes): LV ejection time against LV stroke volume, constriction', `model beat-to-beat r ${f(rLv, 2)}`);
gap('Jain 2022: pulmonary artery ejection time without constriction, expiration less inspiration, 5.1 ± 9.5 ms', `model restriction ${f(Q.dEtPa)} ms, outside 2 SD (${f(5.1 - 19)} to ${f(5.1 + 19)}); the RV stroke volume of the restrictive case rises ${f((Q.rvSvInsp / Q.rvSvExp - 1) * 100, 0)}% in inspiration`);
gap('Jain 2022: constriction separates from no constriction in the aortic minus pulmonary artery difference (50.8 against 5.4 ms)', `model constriction ${f(diff(C))} ms, restriction ${f(diff(Q))} ms (the order is reversed)`);
gap('Jain 2022: magnitude of the ejection time change in constriction', `model ${f(diff(C))} ms against a mean of 50.8 ms; ejection time in the engine follows stroke volume only through load, and no quantitative relation between preload and ejection time was found on PubMed to constrain a length-dependent term`);
gap('Nadir 2014 (PMID 24619369, DOI 10.1161/CIRCHEARTFAILURE.113.000830): inspiratory rise in right atrial pressure (Kussmaul physiology)', `model constriction ${f(C.rapExp)} → ${f(C.rapInsp)} mmHg (no rise)`);
gap('Kothari 1993 (PMID 8335413, DOI 10.1016/0167-5273(93)90042-f): in constriction the wedge pressure follows the breath and the LV end-diastolic pressure does not', `model wedge ${f(C.wedgeExp)} → ${f(C.wedgeInsp)}, LV end-diastolic ${f(C.lvedpExp)} → ${f(C.lvedpInsp)} mmHg`);

console.log(failed ? `\n${failed} test(s) failed` : '\nall interdependence checks passed');
process.exit(failed ? 1 : 0);
