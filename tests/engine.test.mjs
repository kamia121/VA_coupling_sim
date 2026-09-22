// Engine tests. Run with: node tests/engine.test.mjs  (no dependencies)
import { simulate, NORMAL, WU } from '../site/js/engine.js';
import { PRESETS } from '../site/js/presets.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const within = (v, lo, hi) => v >= lo && v <= hi;
const stressed = (s, p) => s[0] - p.lvV0 + s[1] + s[2] + s[3] - p.rvV0 + s[4] + s[5];

// 1. Normal adult calibration targets
const n = simulate({});
check('normal converges', n.converged, `${n.beats} beats`);
check('LV EF 50–65%', within(n.lv.EF, 0.5, 0.65), n.lv.EF.toFixed(3));
check('LV EDV 110–150 mL', within(n.lv.EDV, 110, 150), n.lv.EDV.toFixed(1));
check('SBP 105–130, DBP 60–85', within(n.hemo.SBP, 105, 130) && within(n.hemo.DBP, 60, 85), `${n.hemo.SBP.toFixed(0)}/${n.hemo.DBP.toFixed(0)}`);
check('CO 4.5–6.5 L/min', within(n.hemo.CO, 4.5, 6.5), n.hemo.CO.toFixed(2));
check('LAP 5–12 mmHg', within(n.hemo.LAP, 5, 12), n.hemo.LAP.toFixed(1));
check('RAP 2–8 mmHg', within(n.hemo.RAP, 2, 8), n.hemo.RAP.toFixed(1));
check('LV Ea/Ees 0.5–0.75 (Starling 1993: 0.62)', within(n.lv.EaEes, 0.5, 0.75), n.lv.EaEes.toFixed(3));
check('mPAP 10–20 (Kovacs 2009: 14 ± 3.3)', within(n.hemo.mPAP, 10, 20), n.hemo.mPAP.toFixed(1));
check('PVR 0.7–1.5 WU', within(n.hemo.PVR_WU, 0.7, 1.5), n.hemo.PVR_WU.toFixed(2));
check('RV Ees/Ea 1.5–2.1 (Tello 2019: 1.5–2)', within(n.rv.EesEa, 1.5, 2.1), n.rv.EesEa.toFixed(2));
check('LV and RV stroke volumes equal at steady state', Math.abs(n.lv.SV - n.rv.SV) < 0.5, `${n.lv.SV.toFixed(2)} vs ${n.rv.SV.toFixed(2)}`);

// 2. Volume conservation across one beat
const p = { ...NORMAL };
check('stressed volume conserved (< 0.1 mL)', Math.abs(stressed(n.state, p) - p.vStressed) < 0.1, (stressed(n.state, p) - p.vStressed).toExponential(2));

// 3. ESPVR recovered from a preload sweep equals the input Ees
function espvrSlope(side) {
  const pts = [700, 740, 780, 820].map((v) => { const r = simulate({ vStressed: v }); return [r[side].ESV, r[side].Pes]; });
  const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  const sxy = pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0), sxx = pts.reduce((a, q) => a + (q[0] - mx) ** 2, 0);
  return sxy / sxx;
}
const sL = espvrSlope('lv'), sR = espvrSlope('rv');
check('LV ESPVR slope from preload sweep ≈ Ees (±5%)', Math.abs(sL / NORMAL.lvEes - 1) < 0.05, sL.toFixed(3));
check('RV ESPVR slope from preload sweep ≈ Ees (±5%)', Math.abs(sR / NORMAL.rvEes - 1) < 0.05, sR.toFixed(3));

// 4. Directional responses
const hiSVR = simulate({ svr: NORMAL.svr * 1.5 });
check('↑SVR → ↑Ea, ↓SV, ↑ESV', hiSVR.lv.Ea > n.lv.Ea && hiSVR.lv.SV < n.lv.SV && hiSVR.lv.ESV > n.lv.ESV);
const loEes = simulate({ lvEes: 1.0 });
check('↓LV Ees → ↑ESV, ↑Ea/Ees, ↓EF', loEes.lv.ESV > n.lv.ESV && loEes.lv.EaEes > n.lv.EaEes && loEes.lv.EF < n.lv.EF);
const hiPVR = simulate({ pvr: 8 * WU });
check('↑PVR → ↓RV Ees/Ea, ↑RV EDV, ↓LV EDV (series effect)', hiPVR.rv.EesEa < n.rv.EesEa && hiPVR.rv.EDV > n.rv.EDV && hiPVR.lv.EDV < n.lv.EDV);
const tachy = simulate({ hr: 110 });
check('↑HR at fixed SVR → ↑Ea (Ea ≈ SVR/T)', tachy.lv.Ea > n.lv.Ea, `${n.lv.Ea.toFixed(2)} → ${tachy.lv.Ea.toFixed(2)}`);
const k = (r) => r.lv.Ea / ((r.params.svr + r.params.zcAo) / r.T);
const ks = [n, hiSVR, tachy, simulate({ svr: NORMAL.svr * 0.6 })].map(k);
check('Ea tracks SVR/T across SVR and HR (ratio spread < 25%)', Math.max(...ks) / Math.min(...ks) < 1.25, ks.map((x) => x.toFixed(2)).join(', '));
const stiff = simulate({ lvBeta: 0.045 });
check('↑EDPVR stiffness → ↓EDV, ↑LAP, Ees unchanged', stiff.lv.EDV < n.lv.EDV && stiff.hemo.LAP > n.hemo.LAP);

// 5. Single-beat identity: Pmax/Pes − 1 equals true Ees/Ea in this model
check('single-beat Pmax/Pes − 1 ≈ Ees/Ea (±3%)', Math.abs(n.rv.pmaxRatio / n.rv.EesEa - 1) < 0.03 && Math.abs(hiPVR.rv.pmaxRatio / hiPVR.rv.EesEa - 1) < 0.03);

// 6. Every preset converges and matches its teaching claim
const byId = Object.fromEntries(PRESETS.map((x) => [x.id, simulate(x.params)]));
for (const [id, r] of Object.entries(byId)) check(`preset ${id} converges`, r.converged, `${r.beats} beats`);
check('HFpEF: Ees and Ea both high, ratio 0.4–0.8, LAP > 15', byId.hfpef.lv.Ees > 3.5 && byId.hfpef.lv.Ea > 2 && within(byId.hfpef.lv.EaEes, 0.4, 0.8) && byId.hfpef.hemo.LAP > 15);
check('HFrEF: EF < 35%, Ea/Ees > 1.5', byId.hfref.lv.EF < 0.35 && byId.hfref.lv.EaEes > 1.5);
check('Vasoplegia: Ea/Ees < normal, MAP < 70', byId.vasoplegia.lv.EaEes < n.lv.EaEes && byId.vasoplegia.hemo.MAP < 70);
check('Septic CM: Ea/Ees > 1.3', byId.septicCM.lv.EaEes > 1.3);
check('PAH compensated: RV Ees/Ea 0.9–1.5, mPAP > 20', within(byId.pahComp.rv.EesEa, 0.9, 1.5) && byId.pahComp.hemo.mPAP > 20);
check('PAH decompensated: RV Ees/Ea < 0.805, RAP > 10, SV/ESV < 0.515', byId.pahDecomp.rv.EesEa < 0.805 && byId.pahDecomp.hemo.RAP > 10 && byId.pahDecomp.rv.svEsv < 0.515);
check('Acute PE: RV Ees/Ea < 1, CO < normal', byId.acutePE.rv.EesEa < 1 && byId.acutePE.hemo.CO < n.hemo.CO);
check('CpcPH: LAP > 15, PVR > 2 WU, mPAP > 20', byId.cpcph.hemo.LAP > 15 && byId.cpcph.hemo.PVR_WU > 2 && byId.cpcph.hemo.mPAP > 20);

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
