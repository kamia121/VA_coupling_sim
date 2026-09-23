// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
// `detail` (Scenarios page): mechanism, bedside findings, management evidence, caveat. HTML with <cite>.
import { WU } from './engine.js';

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'Resting adult. LV Ea/Ees 0.62; Starling measured Ees/Ea 1.62 in normal human hearts. RV Ees/Ea 2.0; normal range 1.5–2.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 820 },
    text: 'Ees and Ea both high; the ratio sits in the normal band. Kawaguchi 2003: Ees 4.7 vs 2.1–3.3 mmHg/mL in controls. The stiff EDPVR turns small volume changes into large LAP and BP swings. Try the fluid and vasodilator buttons.',
    refs: ['kawaguchi2003', 'borlaug2008'],
    detail: {
      mech: 'Concentric remodelling stiffens the ventricle in systole and in diastole. Ees and Ea rise together (Ees 4.7 mmHg/mL vs 2.1–3.3 in controls), so Ea/Ees and EF stay normal <cite data-ref="kawaguchi2003"></cite>. The steep EDPVR makes each extra millilitre of filling cost more pressure.',
      see: '<b>Echo:</b> normal EF, so (1 − EF)/EF reads a normal Ea/Ees and hides the problem; the abnormality is in the absolute Ees, Ea and filling pressure. <b>Catheter:</b> raised wedge pressure (table). Ventricular–arterial stiffening amplifies blood-pressure rises under stress <cite data-ref="kawaguchi2003"></cite>.',
      manage: 'Pressure and filling are very sensitive to afterload and volume. With nitroprusside, blood pressure fell 2.6-fold more in HFpEF than in HFrEF; HFpEF patients were four times more likely to lose stroke volume, and stroke volume and output gains were about 60% smaller <cite data-ref="schwartzenberg2012"></cite>. In the simulator, compare the vasodilator and volume-removal buttons here and in HFrEF.',
      note: 'A normal ratio does not exclude disease.',
    },
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.2, hr: 85, vStressed: 760 },
    text: 'Low Ees, ESPVR shifted right (V₀ 40 mL), vasoconstriction. Ea/Ees above 2, low SW/PVA. With a flat ESPVR, a 30% SVR reduction raises SV about 20% here and about 8% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
    detail: {
      mech: 'Low Ees with the ESPVR shifted right (V₀ 40 mL here), and neurohormonal vasoconstriction. Ea/Ees is well above the band, EF is low and SW/PVA falls <cite data-ref="burkhoff1986"></cite>.',
      see: '<b>Echo:</b> low EF. (1 − EF)/EF equals ESV/SV, while the true ratio is (ESV − V₀)/SV, so with a large V₀ the EF shortcut overstates uncoupling: compare the table. <b>Catheter:</b> low output, raised wedge.',
      manage: 'In acute heart failure, vasodilators lower Ea and inotropes raise Ees <cite data-ref="guarracino2013"></cite>. Vasodilation raised stroke volume and output more in HFrEF than in HFpEF <cite data-ref="schwartzenberg2012"></cite>. In this model a 30% SVR reduction raises SV about 20% here and about 8% in the normal heart.',
      note: 'Coupling-guided therapy has not been tested in outcome trials <cite data-ref="guarracino2013"></cite>.',
    },
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock: vasoplegia',
    params: { svr: 0.36, cSys: 1.8, hr: 110, vStressed: 700 },
    text: 'Low SVR and Ea, normal Ees. Ea/Ees falls below the band while MAP is under 70 mmHg.',
    refs: ['guarracino2014', 'ikonomidis2019'],
    detail: {
      mech: 'SVR and Ea fall; Ees is normal. Ea/Ees drops below the band while MAP is low: the ventricle is fine, but the load is too low to hold pressure.',
      see: '<b>Echo:</b> normal or high EF and stroke volume, low Ea = 0.9 × SBP/SV. <b>Catheter:</b> low MAP with normal or high output.',
      manage: 'Surviving Sepsis 2021: norepinephrine as first-line vasopressor and an initial MAP target of 65 mmHg <cite data-ref="evans2021"></cite>. Norepinephrine raises Ea <cite data-ref="guarracino2019"></cite>. In hypotensive postoperative patients, norepinephrine raised stroke volume only when coupling was altered <cite data-ref="guinot2018"></cite>. Try the norepinephrine button and watch Ea, MAP and SV.',
      note: 'The model has no baroreflex, so shock pressures run lower than in patients.',
    },
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock: depressed Ees',
    params: { lvEes: 1.0, svr: 0.62, cSys: 1.6, hr: 110, vStressed: 760 },
    text: 'Low Ees with low SVR and tachycardia. Ea stays near normal because Ea ≈ SVR/T and T is short; the high ratio comes from Ees. Guarracino 2014: Ea/Ees 1.81 in septic shock vs 1.07 in non-septic patients. STRESS-L: landiolol did not reduce organ failure and stopped early for possible harm.',
    refs: ['guarracino2014', 'whitehouse2023'],
    detail: {
      mech: 'Low Ees with low SVR and tachycardia. Ea stays near normal because Ea ≈ SVR/T and T is short. Before vasoactive drugs, septic shock patients had Ea/Ees 1.81 vs 1.07 in non-septic patients (Ees 0.7 vs 2.1, Ea 1.4 vs 2.3 mmHg/mL); 21 of 25 were above 1.36 <cite data-ref="guarracino2014"></cite>. The high ratio came from low Ees; Ea was lower, not higher.',
      see: '<b>Echo:</b> low EF and a low single-beat Ees <cite data-ref="chen2001,guarracino2014"></cite>. <b>Catheter:</b> borderline MAP, and output well below the pure vasoplegia scenario at a similar SVR (compare the tables).',
      manage: 'Surviving Sepsis 2021 suggests adding dobutamine to norepinephrine, or using epinephrine alone, for cardiac dysfunction with persistent hypoperfusion despite adequate volume and blood pressure (weak recommendation, low-quality evidence) <cite data-ref="evans2021"></cite>. On norepinephrine, patients whose output rose had increased Ees; non-responders did not <cite data-ref="guarracino2019"></cite>. STRESS-L: landiolol did not reduce organ failure and was stopped early for possible harm <cite data-ref="whitehouse2023"></cite>.',
      note: 'Treatment guided by coupling “remains to be tested” <cite data-ref="guarracino2014"></cite>.',
    },
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness up, Ees unchanged. The Ea line steepens, the end-systolic point climbs the same ESPVR, and SV falls about 16%. Repeat the change in HFrEF for comparison.',
    refs: ['sunagawa1983', 'chirinos2014'],
    detail: {
      mech: 'SVR and arterial stiffness rise acutely; Ees is unchanged. The Ea line steepens, end-systole climbs the same ESPVR, stroke volume falls and ESV rises.',
      see: '<b>Echo:</b> SV down, 0.9 × SBP/SV up, EF down. <b>Catheter:</b> high BP; wedge rises as ESV and EDV climb.',
      manage: 'In acute heart failure, vasodilators lower Ea; rapid reduction of elevated blood pressure restores Ea and reverses the myocardial dysfunction <cite data-ref="guarracino2013"></cite>. The same pressure rise costs more stroke volume when Ees is low: repeat it in HFrEF.',
      note: '',
    },
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 7 * WU, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 820 },
    text: 'PVR 7 WU, low PA compliance, hypertrophied RV (Ees 1.05). Ees/Ea about 1.2 with near-normal RV volumes. Kuehne 2004: Emax/Ea 1.1 ± 0.3 in PH vs 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
    detail: {
      mech: 'High PVR and low PA compliance raise RV Ea. The RV adapts homeometrically: hypertrophy raises Ees and volumes stay near normal <cite data-ref="vonk2013,naeije2014"></cite>. MRI: Emax/Ea 1.1 ± 0.3 in PH vs 1.9 ± 0.4 in controls <cite data-ref="kuehne2004"></cite>.',
      see: '<b>Echo:</b> high TR velocity and a low TAPSE/PASP. <b>Catheter:</b> high mPAP and PVR, upper-normal RAP, output slightly below normal.',
      manage: 'TAPSE/PASP is part of the ESC/ERS 2022 non-invasive risk assessment at follow-up: above 0.32 low risk, below 0.19 high risk <cite data-ref="humbert2022,tello2018,ostermann2023"></cite>. Here Ees/Ea is above 0.805, the threshold for RV dilatation and failure <cite data-ref="tello2019hf"></cite>.',
      note: '',
    },
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 12 * WU, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, hr: 95, vStressed: 860 },
    text: 'PVR 12 WU, RV Ees 0.55, ESPVR shifted right. Ees/Ea below 0.805, the Tello 2019 threshold for RV dilatation and failure; SV/ESV below 0.515 (Vanderpool 2015). Dilated RV, RAP above 10 mmHg, underfilled LV and low BP with normal LV Ees.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
    detail: {
      mech: 'Heterometric adaptation: the RV dilates because Ees can no longer match Ea <cite data-ref="vonk2013,naeije2014"></cite>. Ees/Ea is below 0.805 <cite data-ref="tello2019hf"></cite> and SV/ESV below 0.515 <cite data-ref="vanderpool2015"></cite>. The ventricles are in series, so low RV output underfills the LV and blood pressure falls with a normal LV Ees.',
      see: '<b>Echo:</b> dilated RV, low TAPSE, TAPSE/PASP well below 0.31 <cite data-ref="tello2019img"></cite>. <b>Catheter:</b> RAP above 10 mmHg, low output, low BP.',
      manage: 'In acute RV failure, identifying and treating the cause is the primary strategy, with judicious fluid management, inotropes and vasopressors, assist devices and RV-protective ventilation <cite data-ref="harjola2016"></cite>. A rising CVP with a falling MAP calls for inotropic or vasoactive support, careful volume management and inhaled pulmonary vasodilators <cite data-ref="lloyddonald2025"></cite>. These interventions have not been well investigated <cite data-ref="konstam2018"></cite>. In the simulator, compare fluid, inotrope and pulmonary vasodilator.',
      note: 'Septal shift and pericardial constraint are not modelled; in patients they worsen LV filling further <cite data-ref="konstam2018"></cite>.',
    },
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 6 * WU, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV meets PVR 6 WU acutely. Ees is unchanged, Ees/Ea falls below 1, and CO drops while mPAP is only moderately raised. Compare with compensated PAH at similar PVR, where RV Ees is higher.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
    detail: {
      mech: 'A normal, thin RV meets an acute PVR of 6 WU. Ees is unchanged, Ees/Ea falls below 1 and output drops. mPAP rises only moderately: in the model the unadapted RV cannot generate more than its isovolumic pressure, Ees × (EDV − V₀). Compare compensated PAH at a similar PVR.',
      see: '<b>Echo:</b> dilated RV and low TAPSE/PASP with only a moderately raised PASP. <b>Catheter:</b> raised RAP, moderate mPAP, low output.',
      manage: 'In acute RV failure, identifying and treating the cause is the primary strategy <cite data-ref="harjola2016"></cite>; for PE see the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>.',
      note: '',
    },
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 1080, pvr: 3.5 * WU, cPa: 1.8 },
    text: 'HFpEF left heart plus PVR above 2 WU. LAP above 15 mmHg raises PA pressure; the added PVR is a pre-capillary load. ESC/ERS 2022: combined post- and pre-capillary PH = PAWP > 15 mmHg and PVR > 2 WU.',
    refs: ['humbert2022', 'kawaguchi2003'],
    detail: {
      mech: 'An HFpEF left heart raises LA pressure, which pushes PA pressure up passively; the added PVR is a pre-capillary load on the RV.',
      see: '<b>Catheter:</b> PAWP above 15 mmHg with PVR above 2 WU defines combined post- and pre-capillary PH <cite data-ref="humbert2022"></cite>. Measure PAWP at end-expiration; in sinus rhythm the end-diastolic value is the mean of the a wave, and large v waves strongly suggest left heart disease <cite data-ref="vachiery2019"></cite>. Practise this on the PA catheter page.',
      manage: 'Management follows the underlying left heart disease; the 6th World Symposium maintained a strong recommendation against PAH therapies in group 2 PH <cite data-ref="vachiery2019"></cite>.',
      note: '',
    },
  },
];

// Illustrative interventions: fixed parameter changes, not doses or predicted drug responses.
export const INTERVENTIONS = [
  { id: 'fluid', label: 'Fluid bolus', icon: '💧', note: '+150 mL stressed volume', apply: (p) => ({ vStressed: p.vStressed + 150 }) },
  { id: 'diurese', label: 'Remove volume', icon: '⤓', note: '−150 mL stressed volume', apply: (p) => ({ vStressed: Math.max(450, p.vStressed - 150) }) },
  { id: 'norepi', label: 'Norepinephrine', icon: '▲', note: 'SVR ×1.35, Ees ×1.1', apply: (p) => ({ svr: p.svr * 1.35, lvEes: p.lvEes * 1.1, rvEes: p.rvEes * 1.1 }) },
  { id: 'dilate', label: 'Arterial vasodilator', icon: '▽', note: 'SVR ×0.7', apply: (p) => ({ svr: p.svr * 0.7 }) },
  { id: 'dobut', label: 'Inotrope', icon: '♥', note: 'Ees ×1.35 (LV and RV), HR +10, SVR ×0.9', apply: (p) => ({ lvEes: p.lvEes * 1.35, rvEes: p.rvEes * 1.35, hr: Math.min(160, p.hr + 10), svr: p.svr * 0.9 }) },
  { id: 'pvd', label: 'Pulmonary vasodilator', icon: '◌', note: 'PVR ×0.7, PA compliance ×1.2', apply: (p) => ({ pvr: p.pvr * 0.7, cPa: p.cPa * 1.2 }) },
];

export function presetById(id) { return PRESETS.find((p) => p.id === id); }
