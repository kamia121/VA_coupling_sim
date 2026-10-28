// ICU diastology lab: the Vp surrogate against the directions of published findings, the color M-mode
// measurement, every number quoted on icu.html, and the citation keys of that page.
// Run with: node tests/vp.test.mjs
import { readFileSync } from 'node:fs';
import { VP, vpFrom, garcia, nagueh, PATIENTS, VOLS, icuState, mmodeField, measuredVp, MM, EF_EEP_INVALID } from '../site/js/vpcore.js';
import { CUT } from '../site/js/diastcore.js';
import { REF_INDEX } from '../site/js/refs.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failed++;
}
function q(where, value, target, tol) {
  const ok = Math.abs(value - target) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${where}: ${value.toFixed(3)} (quoted ${target})`);
  if (!ok) failed++;
}
const r0 = (x) => Math.round(x);

// ---------- the surrogate ----------
check('Vp falls as τ lengthens at a fixed EF (Garcia 2000: Vp against τ, r = 0.78 and 0.86)', vpFrom(40, 0.55) > vpFrom(60, 0.55) && vpFrom(60, 0.55) > vpFrom(80, 0.55));
check('Vp rises with EF at a fixed τ above an EF of 30% and is flat below it (Ohte 2001)',
  vpFrom(40, 0.6) > vpFrom(40, 0.45) && vpFrom(40, 0.45) > vpFrom(40, 0.31) && vpFrom(40, 0.2) === vpFrom(40, 0.3));
check('the constants quoted on icu.html', VP.tauN === 36 && VP.c0 === 45 && VP.c1 === 0.93 && VP.efBreak === 30 && EF_EEP_INVALID === 0.5);
check('Garcia 1997 and Nagueh 1997 regressions', Math.abs(garcia(1) - 9.87) < 1e-9 && Math.abs(nagueh(10) - 14.3) < 1e-9);

// ---------- each patient ----------
const S = {};
for (const p of PATIENTS) {
  S[p.id] = { vol: Object.fromEntries(VOLS.map((v) => [v, icuState(p.id, { vol: v })])), ino: icuState(p.id, { ino: true }), af: icuState(p.id, { af: true }) };
}
const base = (id) => S[id].vol[0];

for (const id of ['hfref', 'septicCM']) {
  const b = base(id), lo = S[id].vol[-1000], hi = S[id].vol[1000];
  // Garcia 2000 reduced preload (caval occlusion, partial bypass): E fell by 23% in patients and Vp did not change significantly
  check(`${id}: with 1 L removed, E falls by more than 20% while Vp changes by less than 10%; with 1 L added, Vp changes by less than 10% (Garcia 2000)`,
    Math.abs(lo.Vp / b.Vp - 1) < 0.1 && Math.abs(hi.Vp / b.Vp - 1) < 0.1 && lo.E / b.E - 1 < -0.2,
    `Vp ${lo.Vp.toFixed(0)}/${b.Vp.toFixed(0)}/${hi.Vp.toFixed(0)}, E ${lo.E.toFixed(0)}/${b.E.toFixed(0)}/${hi.E.toFixed(0)}`);
  const seq = VOLS.map((v) => S[id].vol[v]);
  check(`${id}: E/Vp rises with every rise in mean LA pressure across the volume steps`,
    seq.every((s, i) => i === 0 || (s.LAP > seq[i - 1].LAP && s.EVp > seq[i - 1].EVp)), seq.map((s) => `${s.LAP.toFixed(1)}:${s.EVp.toFixed(2)}`).join(' '));
}
check('the inotrope raises Vp in every patient (Görgülü 2004)', PATIENTS.every((p) => S[p.id].ino.Vp > base(p.id).Vp), PATIENTS.map((p) => `${base(p.id).Vp.toFixed(0)}→${S[p.id].ino.Vp.toFixed(0)}`).join(' '));
check('the inotrope leaves the τ parameter unchanged', PATIENTS.every((p) => S[p.id].ino.sol.q.tau === base(p.id).sol.q.tau || (S[p.id].ino.sol.q.tau === undefined && base(p.id).sol.q.tau === undefined)));
check('hyperdynamic ventricle with slow relaxation: Vp at least 45 cm/s while lateral e′ is below the ASE/EACVI cutoff',
  base('vasoTau').Vp >= 45 && base('vasoTau').ep < CUT.ep, `${base('vasoTau').Vp.toFixed(0)}, ${base('vasoTau').ep.toFixed(1)}`);
check('E/e′ is withheld as a comparator in the reduced-EF ventricles only',
  base('hfref').eepInvalid && base('septicCM').eepInvalid && !base('normal').eepInvalid && !base('vasoTau').eepInvalid && !base('g3').eepInvalid);
check('AF is solved for every patient', PATIENTS.every((p) => Number.isFinite(S[p.id].af.Vp) && Number.isFinite(S[p.id].af.EVp)));

// ---------- color M-mode ----------
for (const p of PATIENTS) {
  const s = base(p.id), F = mmodeField(s.sol.r, s.Vp);
  const at = [0.3, 0.4, 0.5, 0.6, 0.7].map((k) => measuredVp(F, k * F.E));
  check(`${p.id}: the slope of the first aliasing contour with the Nyquist limit at half of E equals Vp`, Math.abs(measuredVp(F, MM.nyqShare * F.E) / s.Vp - 1) < 0.005,
    `${measuredVp(F, MM.nyqShare * F.E).toFixed(1)} against ${s.Vp.toFixed(1)}`);
  check(`${p.id}: the measured slope does not rise with the Nyquist limit, and the front speed is within 1.4 × Vp`,
    at.every((v, i) => i === 0 || v <= at[i - 1] + 0.5) && F.c >= s.Vp && F.c <= 1.4 * s.Vp, `${at.map((v) => v.toFixed(0)).join('/')}, c ${F.c.toFixed(0)}`);
}

// ---------- numbers quoted in icu.html ----------
{
  const h = S.hfref.vol, c = S.septicCM.vol, g = base('g3'), v = base('vasoTau');
  // reduced ejection fraction
  q('dilated ventricle EF, %', base('hfref').EF * 100, 22, 0.5);
  q('dilated ventricle Vp with 1 L removed', h[-1000].Vp, 40, 0.5);
  q('dilated ventricle Vp with 1 L added', h[1000].Vp, 35, 0.5);
  q('dilated ventricle E/Vp with 1 L removed', h[-1000].EVp, 1.36, 0.005);
  q('dilated ventricle E/Vp with 1 L added', h[1000].EVp, 2.37, 0.005);
  q('dilated ventricle LAP with 1 L removed', h[-1000].LAP, 7, 0.5);
  q('dilated ventricle LAP with 1 L added', h[1000].LAP, 21, 0.5);
  q('septic cardiomyopathy EF, %', base('septicCM').EF * 100, 41, 0.5);
  q('septic cardiomyopathy LAP as found', c[0].LAP, 7, 0.5);
  q('septic cardiomyopathy LAP with 1 L', c[1000].LAP, 14, 0.5);
  q('septic cardiomyopathy E/Vp as found', c[0].EVp, 1.48, 0.005);
  q('septic cardiomyopathy E/Vp with 1 L', c[1000].EVp, 2.04, 0.005);
  q('septic cardiomyopathy change in Vp with 1 L, cm/s (rounded values)', r0(c[0].Vp) - r0(c[1000].Vp), 3, 0);
  // restrictive filling, preserved EF
  q('grade III EF, %', g.EF * 100, 55, 0.5);
  q('grade III estimate from E/Vp', g.pcwpVp, 16.7, 0.05);
  q('grade III estimate from E/e′', g.pcwpEep, 18.0, 0.05);
  q('grade III mean LAP', g.LAP, 20.8, 0.05);
  check('grade III: both ratios underestimate mean LA pressure', g.pcwpVp < g.LAP && g.pcwpEep < g.LAP);
  // confounding
  q('vasoplegia fitted τ, ms', v.e.tauMs, 61, 0.5);
  q('vasoplegia Vp', v.Vp, 50, 0.5);
  q('vasoplegia lateral e′', v.ep, 7.1, 0.05);
  q('ASE/EACVI lateral e′ cutoff', CUT.ep, 10, 0);
  q('septic cardiomyopathy Vp as found', c[0].Vp, 52, 0.5);
  q('septic cardiomyopathy Vp with the inotrope', S.septicCM.ino.Vp, 62, 0.5);
  check('septic cardiomyopathy with the inotrope: LAP falls by less than 1 mmHg and E/Vp falls',
    c[0].LAP - S.septicCM.ino.LAP > 0 && c[0].LAP - S.septicCM.ino.LAP < 1 && S.septicCM.ino.EVp < c[0].EVp, `${c[0].LAP.toFixed(2)} → ${S.septicCM.ino.LAP.toFixed(2)}`);
  // limitations
  q('dilated ventricle Vp as found', h[0].Vp, 38, 0.5);
  q('normal ventricle Vp', base('normal').Vp, 69, 0.5);
  q('dilated ventricle E as found', h[0].E, 74, 0.5);
  q('dilated ventricle E with the inotrope', S.hfref.ino.E, 89, 0.5);
  q('dilated ventricle LAP as found', h[0].LAP, 14, 0.5);
  q('dilated ventricle LAP with the inotrope', S.hfref.ino.LAP, 12, 0.5);
  check('dilated ventricle with the inotrope: E/Vp rises while LAP falls', S.hfref.ino.EVp > h[0].EVp && S.hfref.ino.LAP < h[0].LAP);
}

// ---------- citations ----------
const html = readFileSync(new URL('../site/icu.html', import.meta.url), 'utf8');
const keys = [...html.matchAll(/data-ref="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((k) => k.trim()));
const missing = keys.filter((k) => !REF_INDEX[k]);
check('every reference cited on icu.html is in the bibliography', missing.length === 0, missing.join(', '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall Vp checks passed');
process.exit(failed ? 1 : 0);
