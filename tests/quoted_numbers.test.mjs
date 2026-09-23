// Every number the prose quotes from the model, recomputed. If the model changes, this test names the
// sentence that has to change with it. Run with: node tests/quoted_numbers.test.mjs
import { simulate, NORMAL, cardiacPhases } from '../site/js/engine.js';
import { PRESETS, INTERVENTIONS, presetById } from '../site/js/presets.js';

let failed = 0;
function q(where, value, target, tol) {
  const ok = Math.abs(value - target) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${where}: ${value.toFixed(3)} (quoted ${target})`);
  if (!ok) failed++;
}
const P = (id) => presetById(id).params;
const iv = (id, base) => ({ ...base, ...INTERVENTIONS.find((x) => x.id === id).apply({ ...NORMAL, ...base }) });
const S = {};
const sim = (key, p) => (S[key] ??= simulate(p));
const pct = (a, b) => (b / a - 1) * 100;

const n = sim('n', {}), hfpef = sim('hfpef', P('hfpef')), hfref = sim('hfref', P('hfref'));

// Concepts: calibration panel
q('Concepts: normal EF %', n.lv.EF * 100, 57, 0.8);
q('Concepts: normal SBP', n.hemo.SBP, 117, 1); q('Concepts: normal DBP', n.hemo.DBP, 71, 1);
q('Concepts: normal CO', n.hemo.CO, 5.6, 0.06); q('Concepts: normal LAP', n.hemo.LAP, 7, 0.5);
q('Concepts: normal LV Ea/Ees', n.lv.EaEes, 0.62, 0.006); q('Concepts: normal mPAP', n.hemo.mPAP, 13, 0.5);
q('Concepts: normal PVR', n.hemo.PVR_WU, 1.2, 0.05); q('Concepts: normal RV Ees/Ea', n.rv.EesEa, 2.0, 0.06);
q('Concepts: normal τ ms', n.lv.tau * 1000, 36, 0.6); q('Concepts: atrial filling %', n.hemo.atrialFill * 100, 17, 0.6);
q('Concepts: AF lowers SV, normal %', -pct(n.lv.SV, sim('nAF', { aKick: 0 }).lv.SV), 11, 0.6);
q('Concepts: AF lowers SV, HFpEF %', -pct(hfpef.lv.SV, sim('hfAF', { ...P('hfpef'), aKick: 0 }).lv.SV), 16, 0.6);
q('Concepts: model Pes / SBP', n.lv.Pes / n.hemo.SBP, 0.97, 0.006);
// Concepts: afterload, HFpEF, RV
q('Concepts/HFrEF: vasodilator SV gain HFrEF %', pct(hfref.lv.SV, sim('hfrefD', iv('dilate', P('hfref'))).lv.SV), 15, 0.6);
q('Concepts/HFrEF: vasodilator SV gain normal %', pct(n.lv.SV, sim('nD', iv('dilate', {})).lv.SV), 9, 0.6);
q('Concepts: HFpEF Ea/Ees', hfpef.lv.EaEes, 0.51, 0.006); q('Concepts: HFpEF LAP', hfpef.hemo.LAP, 16, 0.5); q('Concepts: HFpEF MAP', hfpef.hemo.MAP, 137, 0.6);
q('Concepts/HFpEF: fluid raises LAP, HFpEF', sim('hfF', iv('fluid', P('hfpef'))).hemo.LAP - hfpef.hemo.LAP, 2.5, 0.06);
q('Concepts/HFpEF: fluid raises LAP, normal', sim('nF', iv('fluid', {})).hemo.LAP - n.hemo.LAP, 2.0, 0.06);
q('HFpEF: fluid removal lowers LAP', hfpef.hemo.LAP - sim('hfR', iv('diurese', P('hfpef'))).hemo.LAP, 2.5, 0.06);
const dropHF = hfpef.hemo.MAP - sim('hfD', iv('dilate', P('hfpef'))).hemo.MAP, dropN = n.hemo.MAP - S.nD.hemo.MAP;
q('Concepts/HFpEF: vasodilator MAP drop HFpEF', dropHF, 10, 0.6); q('Concepts: vasodilator MAP drop normal', dropN, 8, 0.6);
q('HFpEF: vasodilator MAP drop HFrEF', hfref.hemo.MAP - S.hfrefD.hemo.MAP, 6, 0.6);
q('Concepts: HFpEF / HFrEF MAP drop ratio', dropHF / (hfref.hemo.MAP - S.hfrefD.hemo.MAP), 1.7, 0.1);
q('Concepts/HFpEF: vasodilator MAP drop, reflex off, HFpEF', sim('hf0', { ...P('hfpef'), baro: 0 }).hemo.MAP - sim('hfD0', { ...iv('dilate', P('hfpef')), baro: 0 }).hemo.MAP, 30, 0.6);
q('Concepts/Advanced: vasodilator MAP drop, reflex off, normal', sim('n0', { baro: 0 }).hemo.MAP - sim('nD0', { ...iv('dilate', {}), baro: 0 }).hemo.MAP, 21, 0.6);
q('HFpEF: vasodilator SV gain %', pct(hfpef.lv.SV, S.hfD.lv.SV), 7, 0.6);
const pahC = sim('pahC', P('pahComp')), pe = sim('pe', P('acutePE'));
q('Concepts/PAH: PVR', pahC.hemo.PVR_WU, 7.3, 0.06); q('Concepts/PAH: RV Ees/Ea', pahC.rv.EesEa, 1.2, 0.03); q('Concepts/PAH: CO', pahC.hemo.CO, 5.2, 0.06);
q('PAH: RV Ees', pahC.rv.Ees, 1.07, 0.006);
q('Concepts/PE: PVR', pe.hemo.PVR_WU, 7.7, 0.06); q('Concepts/PE: RV Ees/Ea', pe.rv.EesEa, 0.53, 0.006); q('Concepts/PE: CO', pe.hemo.CO, 4.3, 0.06);
q('Concepts/PE: septal shift mL', -pe.hemo.VsptED, 13, 0.6);
{ let st, best = [0, 0];
  for (let svr = 0.15; svr <= 5; svr *= 1.12) { const r = simulate({ svr, baro: 0, coronary: 0 }, st ? { state: st } : {}); st = r.state; if (r.lv.SW > best[1]) best = [r.lv.EaEes, r.lv.SW]; }
  q('Concepts: stroke work peaks near Ea/Ees', best[0], 1.3, 0.06); }

// Scenario texts
q('HFpEF: τ ms', hfpef.lv.tau * 1000, 59, 0.6);
q('HFrEF: inotrope CO', sim('hfrefI', iv('dobut', P('hfref'))).hemo.CO, 5.6, 0.06);
q('HFrEF: CO', hfref.hemo.CO, 4.4, 0.06); q('HFrEF: Ea/Ees', hfref.lv.EaEes, 2.74, 0.006); q('HFrEF: inotrope Ea/Ees', S.hfrefI.lv.EaEes, 1.83, 0.006);
q('HFrEF: diuresis LAP', sim('hfrefR', iv('diurese', P('hfref'))).hemo.LAP, 10.8, 0.06); q('HFrEF: LAP', hfref.hemo.LAP, 13.4, 0.06);
q('HFrEF: diuresis SV loss %', -pct(hfref.lv.SV, S.hfrefR.lv.SV), 6, 0.6);
const vas = sim('vas', P('vasoplegia')), vasN = sim('vasN', iv('norepi', P('vasoplegia')));
q('Vasoplegia: MAP', vas.hemo.MAP, 64, 0.6); q('Vasoplegia: CO', vas.hemo.CO, 8.2, 0.06); q('Vasoplegia: HR', vas.eff.hr, 112, 0.6);
q('Vasoplegia: MAP with reflex off', sim('vas0', { ...P('vasoplegia'), baro: 0 }).hemo.MAP, 46, 0.6);
q('Vasoplegia: norepi Ea before', vas.lv.Ea, 0.93, 0.006); q('Vasoplegia: norepi Ea after', vasN.lv.Ea, 1.11, 0.006);
q('Vasoplegia: norepi MAP', vasN.hemo.MAP, 75, 0.6); q('Vasoplegia: norepi SV before', vas.lv.SV, 74, 0.6); q('Vasoplegia: norepi SV after', vasN.lv.SV, 72, 0.6);
q('Vasoplegia: norepi HR', vasN.eff.hr, 106, 0.6); q('Advanced: vasoplegia reflex fraction of range', vas.eff.reflex, 0.81, 0.006);
q('Advanced: vasoplegia vasodilator MAP drop', vas.hemo.MAP - sim('vasD', iv('dilate', P('vasoplegia'))).hemo.MAP, 12, 0.6);
const sep = sim('sep', P('septicCM')), sepN = sim('sepN', iv('norepi', P('septicCM'))), sepI = sim('sepI', iv('dobut', P('septicCM')));
q('Septic CM: MAP', sep.hemo.MAP, 69, 0.6); q('Septic CM: CO', sep.hemo.CO, 6.0, 0.06); q('Septic CM: Ea/Ees', sep.lv.EaEes, 1.51, 0.006);
q('Septic CM: norepi MAP', sepN.hemo.MAP, 78, 0.6); q('Septic CM: norepi CO', sepN.hemo.CO, 5.3, 0.06);
q('Septic CM: inotrope CO', sepI.hemo.CO, 6.9, 0.06); q('Septic CM: inotrope Ea/Ees', sepI.lv.EaEes, 1.05, 0.006);
const ha = sim('ha', P('highAfterload'));
q('Afterload: SV fall normal %', -pct(n.lv.SV, ha.lv.SV), 16, 0.6);
{ const p = P('hfref'), r = simulate({ ...p, svr: p.svr * 1.7 / NORMAL.svr, cSys: 0.8 * (p.cSys ?? NORMAL.cSys) / NORMAL.cSys });
  q('Afterload: SV fall HFrEF %', -pct(hfref.lv.SV, r.lv.SV), 26, 0.6); }
q('Afterload: HR', ha.eff.hr, 59, 0.6); q('Afterload: MAP', ha.hemo.MAP, 109, 0.6);
const haD = sim('haD', iv('dilate', P('highAfterload')));
q('Afterload: vasodilator SV before', ha.lv.SV, 67, 0.6); q('Afterload: vasodilator SV after', haD.lv.SV, 75, 0.6); q('Afterload: vasodilator MAP', haD.hemo.MAP, 101, 0.6);
const pahD = sim('pahD', P('pahDecomp'));
q('PAH decomp: PVR', pahD.hemo.PVR_WU, 11, 0.2); q('PAH decomp: RV Ees', pahD.rv.Ees, 0.59, 0.006); q('PAH decomp: Ees/Ea', pahD.rv.EesEa, 0.42, 0.006);
q('PAH decomp: SV/ESV', pahD.rv.svEsv, 0.32, 0.006); q('PAH decomp: RAP', pahD.hemo.RAP, 11.6, 0.06); q('PAH decomp: septal shift', -pahD.hemo.VsptED, 16, 0.6);
q('PAH decomp: fluid RAP', sim('pahDF', iv('fluid', P('pahDecomp'))).hemo.RAP, 14.0, 0.06);
const pahDI = sim('pahDI', iv('dobut', P('pahDecomp')));
q('PAH decomp: CO', pahD.hemo.CO, 4.3, 0.06); q('PAH decomp: inotrope CO', pahDI.hemo.CO, 5.4, 0.06);
q('PAH decomp: mPAP', pahD.hemo.mPAP, 53, 0.6); q('PAH decomp: inotrope mPAP', pahDI.hemo.mPAP, 65, 0.6);
q('PAH decomp: pulmonary vasodilator CO', sim('pahDP', iv('pvd', P('pahDecomp'))).hemo.CO, 4.7, 0.06);
q('PAH decomp: arterial vasodilator CO', sim('pahDD', iv('dilate', P('pahDecomp'))).hemo.CO, 2.7, 0.06);
q('PE: mPAP', pe.hemo.mPAP, 37, 0.6); q('PE: HR', pe.eff.hr, 80, 0.6); q('PE: MAP', pe.hemo.MAP, 84, 0.6);
q('PE: MAP with reflex off', sim('pe0', { ...P('acutePE'), baro: 0 }).hemo.MAP, 68, 0.6);
q('PE: norepi MAP', sim('peN', iv('norepi', P('acutePE'))).hemo.MAP, 93, 0.6);
q('PE: inotrope CO', sim('peI2', iv('dobut', P('acutePE'))).hemo.CO, 5.3, 0.06);
q('PE/Advanced: arterial vasodilator MAP', sim('peD', iv('dilate', P('acutePE'))).hemo.MAP, 49, 0.6);
q('Advanced: PE RV supply / demand', pe.hemo.supplyR, 1.5, 0.05);
const cpc = sim('cpc', P('cpcph'));
q('CpcPH: LAP', cpc.hemo.LAP, 17, 0.5); q('CpcPH: RV Ees/Ea', cpc.rv.EesEa, 0.69, 0.006); q('CpcPH: PVR', cpc.hemo.PVR_WU, 3.5, 0.06);

// Advanced scenarios and mechanisms
const tp = sim('tp', P('tamponade'));
q('Tamponade: Ppcd', tp.hemo.Ppcd, 9, 0.5); q('Tamponade: RAP', tp.hemo.RAP, 11, 0.5); q('Tamponade: LAP', tp.hemo.LAP, 12, 0.5);
q('Tamponade: RVEDP', tp.rv.EDP, 12, 0.5); q('Tamponade: LVEDP', tp.lv.EDP, 13, 0.5); q('Tamponade: SV', tp.lv.SV, 36, 0.6);
q('Tamponade: CO', tp.hemo.CO, 3.1, 0.06); q('Tamponade: HR', tp.eff.hr, 88, 0.6); q('Tamponade: MAP', tp.hemo.MAP, 70, 0.6);
const tp100 = sim('tp100', { pcdFluid: 100 });
q('Tamponade: 100 mL Ppcd', tp100.hemo.Ppcd, 3, 0.15); q('Tamponade: 100 mL CO', tp100.hemo.CO, 4.9, 0.06);
const tpF = sim('tpF', iv('fluid', P('tamponade')));
q('Tamponade: fluid RAP', tpF.hemo.RAP, 13, 0.5); q('Tamponade: fluid CO gain %', pct(tp.hemo.CO, tpF.hemo.CO), 3, 0.6);
{ const r = n; q('Advanced: normal Ppcd min', Math.min(...r.rec.Ppcd), -0.4, 0.06); q('Advanced: normal Ppcd max', Math.max(...r.rec.Ppcd), 1.5, 0.06); }
const peS0 = sim('peS0', { ...P('acutePE'), septum: 0 });
q('Advanced: PE LVEDP septum on', pe.lv.EDP, 5.5, 0.06); q('Advanced: PE LVEDP septum off', peS0.lv.EDP, 3.9, 0.06);
q('Advanced: PE LV EDV', pe.lv.EDV, 100, 0.6); q('Advanced: PE CO septum off', peS0.hemo.CO, 4.25, 0.006);
{ const on = n, off = sim('nb0', { baseDescent: 0 });
  const w = (r) => { const e = cardiacPhases(r).rv.events, p = r.rec.Pra;
    return { c: Math.max(...p.slice(e.inClose, e.outOpen + 20)) - p[e.inClose], x: Math.min(...p.slice(e.outOpen, e.outClose)), v: Math.max(...p.slice(e.outClose, e.inOpen + 5)) }; };
  const a = w(on), b = w(off);
  q('Advanced: c wave rise', a.c, 0.6, 0.1); q('Advanced: c wave from bulging', a.c - b.c, 0.1, 0.06);
  q('Advanced: x trough on', a.x, 3.4, 0.06); q('Advanced: x trough off', b.x, 3.9, 0.06); q('Advanced: v on', a.v, 6.1, 0.06); q('Advanced: v off', b.v, 5.3, 0.06);
  q('Advanced: RV isovolumic contraction ms', (cardiacPhases(on).rv.events.outOpen - cardiacPhases(on).rv.events.inClose) * on.dt * 1000, 17, 1.5); }
const hT = sim('hT', P('hfpefTachy')), hT35 = sim('hT35', { ...P('hfpefTachy'), tau: 0.035 });
q('HFpEF tachy: HR', hT.eff.hr, 102, 0.6); q('HFpEF tachy: min LVP', Math.min(...hT.rec.Plv), 14, 0.5); q('HFpEF tachy: τ35 min LVP', Math.min(...hT35.rec.Plv), 10, 0.5);
q('HFpEF tachy: SV', hT.lv.SV, 54, 0.6); q('HFpEF tachy: τ35 SV', hT35.lv.SV, 66, 0.6); q('HFpEF tachy: EDV', hT.lv.EDV, 97, 0.6); q('HFpEF tachy: τ35 EDV', hT35.lv.EDV, 115, 0.6);
q('HFpEF tachy: LAP', hT.hemo.LAP, 16.8, 0.06); q('HFpEF tachy: τ35 LAP', hT35.hemo.LAP, 13.8, 0.06);
q('HFpEF 70/min: τ effect on LAP', hfpef.hemo.LAP - sim('hf35', { ...P('hfpef'), tau: 0.035 }).hemo.LAP, 0.3, 0.1);
q('HFpEF tachy: SV back at 70/min', hfpef.lv.SV, 72, 0.6);
const f1 = sim('f1', { hr: 130, baro: 0 }), f0 = sim('f0', { hr: 130, baro: 0, ffr: 0 });
q('Advanced: FFR Ees at 130', f1.lv.Ees, 2.89, 0.006); q('Advanced: FFR CO on', f1.hemo.CO, 6.2, 0.06); q('Advanced: FFR CO off', f0.hemo.CO, 5.8, 0.06);
q('Advanced: HFrEF CO at 70/min', sim('h70', { ...P('hfref'), hr: 70, baro: 0 }).hemo.CO, 4.1, 0.06);
q('Advanced: HFrEF CO at 130/min', sim('h130', { ...P('hfref'), hr: 130, baro: 0 }).hemo.CO, 4.4, 0.06);
q('Advanced: baroreflex vasodilator HR', S.nD.eff.hr, 77, 0.6);
q('Advanced: normal coronary supply / demand', n.hemo.supplyL, 5, 0.1);
const pI = sim('pI', P('peIschemia')), pI0 = sim('pI0', { ...P('peIschemia'), coronary: 0 }), pIN = sim('pIN', iv('norepi', P('peIschemia')));
q('PE ischemia: PVR (about 12 WU)', pI.hemo.PVR_WU, 12, 0.4); q('PE ischemia: RV Ees', pI.rv.Ees, 0.17, 0.006); q('PE ischemia: CO', pI.hemo.CO, 2.0, 0.06);
q('PE ischemia: MAP', pI.hemo.MAP, 51, 0.6); q('PE ischemia: CO coronary off', pI0.hemo.CO, 3.8, 0.06); q('PE ischemia: septal shift', -pI.hemo.VsptED, 18, 0.6);
q('PE ischemia: mPAP', pI.hemo.mPAP, 26, 0.6); q('PE ischemia: norepi MAP', pIN.hemo.MAP, 89, 0.6); q('PE ischemia: norepi CO', pIN.hemo.CO, 3.5, 0.06);
q('PE ischemia: norepi mPAP', pIN.hemo.mPAP, 45, 0.6); q('PE ischemia: norepi RV ischemia resolved', pIN.hemo.ischR, 1, 0.001);
q('PE ischemia: fluid RAP', sim('pIF', iv('fluid', P('peIschemia'))).hemo.RAP, 14, 0.5);
q('PE ischemia: inotrope does not reverse', sim('pII', iv('dobut', P('peIschemia'))).hemo.ischR, 0.3, 0.05);
q('PE ischemia: pulmonary vasodilator reverses', sim('pIP', iv('pvd', P('peIschemia'))).hemo.ischR, 1, 0.001);
const as = sim('as', P('asSevere')), asI = sim('asI', iv('dobut', P('asSevere')));
q('AS: mean gradient', as.hemo.avMeanGrad, 55, 0.6); q('AS: peak gradient', as.hemo.avPeakGrad, 82, 0.6); q('AS: CO', as.hemo.CO, 5.3, 0.06);
q('AS: LVEDP', as.lv.EDP, 20, 0.5); q('AS: LAP', as.hemo.LAP, 12, 0.5); q('AS: τ', as.lv.tau * 1000, 53, 0.6);
q('AS: inotrope CO', asI.hemo.CO, 6.4, 0.06); q('AS: inotrope mean gradient', asI.hemo.avMeanGrad, 70, 0.6);
const mr = sim('mr', P('mrAcute')), mrD = sim('mrD', iv('dilate', P('mrAcute')));
q('MR: total SV', mr.lv.SV, 124, 0.6); q('MR: forward SV', mr.lv.fwdSV, 57, 0.6); q('MR: RF %', mr.lv.RF * 100, 54, 0.6);
q('MR: LAP', mr.hemo.LAP, 15, 0.5); q('MR: v wave peak', Math.max(...mr.rec.Pla), 24, 0.6); q('MR: Ea/Ees', mr.lv.EaEes, 0.23, 0.006); q('MR: EF %', mr.lv.EF * 100, 79, 0.6);
q('MR: vasodilator forward SV', mrD.lv.fwdSV, 65, 0.6); q('MR: vasodilator CO before', mr.hemo.CO, 4.5, 0.06); q('MR: vasodilator CO', mrD.hemo.CO, 5.5, 0.06);
q('MR: vasodilator RF %', mrD.lv.RF * 100, 49, 0.6); q('MR: MAP', mr.hemo.MAP, 85, 0.6); q('MR: vasodilator MAP', mrD.hemo.MAP, 77, 0.6);
const ar = sim('ar', P('arChronic')), ar90 = sim('ar90', { ...P('arChronic'), hr: 90 });
q('AR: RF %', ar.lv.RF * 100, 44, 0.6); q('AR: total SV', ar.lv.SV, 136, 0.6); q('AR: forward SV', ar.lv.fwdSV, 77, 0.6);
q('AR: SBP', ar.hemo.SBP, 132, 0.6); q('AR: DBP', ar.hemo.DBP, 46, 0.6); q('AR: Ea/Ees', ar.lv.EaEes, 0.41, 0.006);
q('AR: 90/min RF %', ar90.lv.RF * 100, 41, 0.6); q('AR: LVEDP', ar.lv.EDP, 18, 0.5); q('AR: 90/min LVEDP', ar90.lv.EDP, 14, 0.5); q('AR: 90/min DBP', ar90.hemo.DBP, 56, 0.6);
const tr = sim('tr', P('trSevere')), trR = sim('trR', iv('diurese', P('trSevere')));
q('TR: RV RF %', tr.rv.RF * 100, 46, 0.6); q('TR: regurgitant volume', tr.rv.RVol, 62, 0.6); q('TR: RAP', tr.hemo.RAP, 11.9, 0.06);
q('TR: RA peak', Math.max(...tr.rec.Pra), 20, 0.6); q('TR: RV EDV', tr.rv.EDV, 230, 0.6); q('TR: septal shift', -tr.hemo.VsptED, 12, 0.6);
q('TR: diuresis RAP', trR.hemo.RAP, 10.1, 0.06); q('TR: CO', tr.hemo.CO, 5.2, 0.06); q('TR: diuresis CO', trR.hemo.CO, 5.0, 0.06);
q('Index tour: PE ischemia norepi CO', pIN.hemo.CO, 3.5, 0.06);

console.log(failed ? `\n${failed} quoted number(s) out of date` : '\nall quoted numbers match the model');
process.exit(failed ? 1 : 0);
