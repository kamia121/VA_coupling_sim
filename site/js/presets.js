// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
// `detail` (Scenarios page): mechanism, bedside findings, management evidence, caveat. HTML with <cite>.
import { WU } from './engine.js';

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'A resting adult. The LV Ea/Ees is 0.62, which matches the Ees/Ea of 1.62 that Starling measured in normal human hearts. The RV Ees/Ea is 2.0, within the normal range of 1.5 to 2.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 880 },
    text: 'Ees and Ea are both high, so the ratio stays in the normal range. Kawaguchi found an Ees of 4.7 mmHg/mL in these patients, compared with 2.1 to 3.3 mmHg/mL in controls. Because the EDPVR is steep, small changes in volume cause large swings in LAP and blood pressure. Try the fluid and vasodilator buttons.',
    refs: ['kawaguchi2003', 'borlaug2008'],
    detail: {
      mech: 'Concentric remodeling stiffens the ventricle in both systole and diastole. Ees and Ea rise together, with an Ees of 4.7 mmHg/mL compared with 2.1 to 3.3 mmHg/mL in controls, so Ea/Ees and EF stay normal <cite data-ref="kawaguchi2003"></cite>. As the EDPVR steepens, the ventricle requires more pressure to fill to the same volume as before. The stiff ventricle also depends more on atrial contraction, and in the model, losing it lowers stroke volume by 14% in this scenario, compared with 9% in the normal heart.',
      see: 'On echo, EF is normal. Because EF is normal, (1 − EF)/EF is also normal, and so is the Ea/Ees estimated from it. However, the absolute Ees, Ea, and filling pressure are all raised. On the catheter, the wedge pressure is raised (see the table). Ventricular–arterial stiffening amplifies the rise in blood pressure under stress <cite data-ref="kawaguchi2003"></cite>.',
      manage: 'Blood pressure and filling pressure are very sensitive to changes in afterload and volume. With nitroprusside, blood pressure fell 2.6-fold more in HFpEF than in HFrEF, patients with HFpEF were four times more likely to lose stroke volume, and the gains in stroke volume and cardiac output were about 60% smaller <cite data-ref="schwartzenberg2012"></cite>. In the simulator, compare the vasodilator and volume-removal buttons in this scenario and in HFrEF.',
      note: 'A normal ratio does not exclude disease.',
    },
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.2, hr: 85, vStressed: 760 },
    text: 'Ees is low, the ESPVR is shifted to the right with a V₀ of 40 mL, and the arteries are constricted. Ea/Ees is above 2 and SW/PVA is low. Because the ESPVR is flat, a 30% reduction in SVR raises stroke volume by about 20% here but by only about 8% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
    detail: {
      mech: 'Ees is low, the ESPVR is shifted to the right (V₀ is 40 mL here), and neurohormonal activation constricts the arteries. Ea/Ees is well above the normal range, EF is low, and SW/PVA falls <cite data-ref="burkhoff1986"></cite>.',
      see: 'On echo, EF is low. The shortcut (1 − EF)/EF equals ESV/SV, whereas the true ratio is (ESV − V₀)/SV, so with a large V₀ the shortcut overstates the degree of uncoupling (compare the table). On the catheter, cardiac output is low and the wedge pressure is raised.',
      manage: 'In acute heart failure, vasodilators lower Ea and inotropes raise Ees <cite data-ref="guarracino2013"></cite>. Vasodilation raised stroke volume and cardiac output more in HFrEF than in HFpEF <cite data-ref="schwartzenberg2012"></cite>. In this model, a 30% reduction in SVR raises stroke volume by about 20% here and by about 8% in the normal heart.',
      note: 'Therapy guided by coupling has not been tested in outcome trials <cite data-ref="guarracino2013"></cite>.',
    },
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock: vasoplegia',
    params: { svr: 0.36, cSys: 1.8, hr: 110, vStressed: 700 },
    text: 'SVR and Ea are low and Ees is normal. Ea/Ees falls below the normal range while MAP is below 70 mmHg.',
    refs: ['guarracino2014', 'ikonomidis2019'],
    detail: {
      mech: 'SVR and Ea fall while Ees stays normal, and Ea/Ees drops below the normal range as MAP falls. The ventricle works normally, but the arterial load is too low to maintain pressure.',
      see: 'On echo, EF and stroke volume are normal or high, and Ea, estimated as 0.9 × SBP/SV, is low. On the catheter, MAP is low and cardiac output is normal or high.',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines recommend norepinephrine as the first-line vasopressor and an initial MAP target of 65 mmHg <cite data-ref="evans2021"></cite>. Norepinephrine raises Ea <cite data-ref="guarracino2019"></cite>. In hypotensive postoperative patients, norepinephrine increased stroke volume only when coupling was altered <cite data-ref="guinot2018"></cite>. Press the norepinephrine button and follow Ea, MAP, and stroke volume.',
      note: 'The model has no baroreflex, so pressures in shock run lower than in patients.',
    },
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock: depressed Ees',
    params: { lvEes: 1.0, svr: 0.62, cSys: 1.6, hr: 110, vStressed: 760 },
    text: 'Ees is low, SVR is low, and the heart rate is fast. Ea stays near normal because Ea ≈ SVR/T and the beat duration T is short, so the high ratio comes from the low Ees. Guarracino found an Ea/Ees of 1.81 in septic shock and 1.07 in non-septic patients. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm.',
    refs: ['guarracino2014', 'whitehouse2023'],
    detail: {
      mech: 'Ees is low, SVR is low, and the heart rate is fast. Ea stays near normal because Ea ≈ SVR/T and the beat duration T is short. Before vasoactive drugs were started, patients in septic shock had an Ea/Ees of 1.81, compared with 1.07 in non-septic patients, with an Ees of 0.7 versus 2.1 mmHg/mL and an Ea of 1.4 versus 2.3 mmHg/mL. Twenty-one of the 25 septic patients had a ratio above 1.36 <cite data-ref="guarracino2014"></cite>. The high ratio came from the low Ees, and Ea was lower rather than higher.',
      see: 'On echo, EF is low and the single-beat Ees is low <cite data-ref="chen2001,guarracino2014"></cite>. On the catheter, MAP is borderline, and cardiac output is well below that of the vasoplegia scenario at a similar SVR (compare the tables).',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines suggest adding dobutamine to norepinephrine, or using epinephrine alone, for cardiac dysfunction with persistent hypoperfusion despite adequate volume and blood pressure. This is a weak recommendation based on low-quality evidence <cite data-ref="evans2021"></cite>. Among patients receiving norepinephrine, those whose cardiac output rose had an increase in Ees, and those whose output did not rise had none <cite data-ref="guarracino2019"></cite>. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm <cite data-ref="whitehouse2023"></cite>.',
      note: 'Whether treatment guided by coupling improves outcomes “remains to be tested” <cite data-ref="guarracino2014"></cite>.',
    },
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness rise while Ees is unchanged. The Ea line steepens, the end-systolic point climbs the same ESPVR, and stroke volume falls by about 15%. Repeat the same change in HFrEF for comparison.',
    refs: ['sunagawa1983', 'chirinos2014'],
    detail: {
      mech: 'SVR and arterial stiffness rise acutely while Ees is unchanged. The Ea line steepens and the end-systolic point climbs the same ESPVR, so stroke volume falls and end-systolic volume rises.',
      see: 'On echo, stroke volume and EF fall, and Ea, estimated as 0.9 × SBP/SV, rises. On the catheter, blood pressure is high, and the wedge pressure rises as the end-systolic and end-diastolic volumes increase.',
      manage: 'In acute heart failure, vasodilators lower Ea, and a rapid reduction of high blood pressure restores Ea and reverses the myocardial dysfunction <cite data-ref="guarracino2013"></cite>. The same rise in pressure costs more stroke volume when Ees is low, which can be seen by repeating the change in HFrEF.',
      note: '',
    },
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 7 * WU, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 820 },
    text: 'PVR is 7 WU, PA compliance is low, and the RV is hypertrophied, with an Ees of 1.05 mmHg/mL. Ees/Ea is about 1.2, and the RV volumes are close to normal. Kuehne found an Emax/Ea of 1.1 ± 0.3 in pulmonary hypertension and 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
    detail: {
      mech: 'High PVR and low PA compliance raise the RV Ea. The RV adapts homeometrically, raising Ees through hypertrophy while its volumes stay close to normal <cite data-ref="vonk2013,naeije2014"></cite>. On MRI, Emax/Ea was 1.1 ± 0.3 in pulmonary hypertension and 1.9 ± 0.4 in controls <cite data-ref="kuehne2004"></cite>.',
      see: 'On echo, the TR velocity is high and TAPSE/PASP is low. On the catheter, mPAP and PVR are high, RAP is at the upper limit of normal, and cardiac output is slightly below normal.',
      manage: 'TAPSE/PASP is one of the variables in the non-invasive risk assessment that the ESC/ERS 2022 guidelines use at follow-up, in which a value above 0.32 indicates low risk and a value below 0.19 indicates high risk <cite data-ref="humbert2022,tello2018,ostermann2023"></cite>. In this scenario Ees/Ea remains above 0.805, the threshold associated with RV dilation and failure <cite data-ref="tello2019hf"></cite>.',
      note: '',
    },
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 12 * WU, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, hr: 95, vStressed: 920 },
    text: 'PVR is 12 WU, the RV Ees is 0.55 mmHg/mL, and the RV ESPVR is shifted to the right. Ees/Ea is below 0.805, the threshold Tello associated with RV dilation and failure, and SV/ESV is below 0.515, the threshold reported by Vanderpool. The RV is dilated and RAP is above 10 mmHg. The LV is underfilled, and blood pressure is low even though the LV Ees is normal.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
    detail: {
      mech: 'The RV has adapted heterometrically and dilates because its Ees can no longer match its Ea <cite data-ref="vonk2013,naeije2014"></cite>. Ees/Ea is below 0.805 <cite data-ref="tello2019hf"></cite>, and SV/ESV is below 0.515 <cite data-ref="vanderpool2015"></cite>. Because the ventricles work in series, the low RV output underfills the LV, and blood pressure falls even though the LV Ees is normal.',
      see: 'On echo, the RV is dilated, TAPSE is low, and TAPSE/PASP is well below 0.31 <cite data-ref="tello2019img"></cite>. On the catheter, RAP is above 10 mmHg, and cardiac output and blood pressure are low.',
      manage: 'In acute RV failure, identifying and treating the cause is the primary strategy, together with judicious fluid management, inotropes and vasopressors, assist devices, and RV-protective ventilation <cite data-ref="harjola2016"></cite>. A rising CVP with a falling MAP calls for inotropic or vasoactive support, careful volume management, and inhaled pulmonary vasodilators <cite data-ref="lloyddonald2025"></cite>. These interventions have not been well studied <cite data-ref="konstam2018"></cite>. In the simulator, compare the effects of fluid, an inotrope, and a pulmonary vasodilator.',
      note: 'The model does not include septal shift or pericardial constraint, which in patients impair LV filling further <cite data-ref="konstam2018"></cite>.',
    },
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 6 * WU, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV suddenly faces a PVR of 6 WU. Ees is unchanged, Ees/Ea falls below 1, and cardiac output drops while mPAP rises only moderately. Compare this with compensated PAH at a similar PVR, in which the RV Ees is higher.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
    detail: {
      mech: 'A normal, thin-walled RV suddenly faces a PVR of 6 WU. Ees is unchanged, Ees/Ea falls below 1, and cardiac output drops. The mPAP rises only moderately because, in the model, an unadapted RV cannot generate more than its isovolumic pressure, Ees × (EDV − V₀). Compare this scenario with compensated PAH at a similar PVR.',
      see: 'On echo, the RV is dilated and TAPSE/PASP is low, while PASP is only moderately raised. On the catheter, RAP is raised, mPAP is moderately raised, and cardiac output is low.',
      manage: 'In acute RV failure, identifying and treating the cause is the primary strategy <cite data-ref="harjola2016"></cite>. For the management of PE, see the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>.',
      note: '',
    },
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 1240, pvr: 3.5 * WU, cPa: 1.8 },
    text: 'An HFpEF left heart is combined with a PVR above 2 WU. A LAP above 15 mmHg raises PA pressure, and the added PVR is a pre-capillary load on the RV. The ESC/ERS 2022 guidelines define combined post- and pre-capillary PH as a PAWP above 15 mmHg with a PVR above 2 WU.',
    refs: ['humbert2022', 'kawaguchi2003'],
    detail: {
      mech: 'The stiff HFpEF left heart raises LA pressure, which pushes PA pressure up passively. The added PVR is a pre-capillary load on the RV.',
      see: 'On the catheter, a PAWP above 15 mmHg with a PVR above 2 WU defines combined post- and pre-capillary PH <cite data-ref="humbert2022"></cite>. PAWP is measured at end-expiration, and in sinus rhythm the end-diastolic value is the mean of the a wave. Large v waves strongly suggest left heart disease <cite data-ref="vachiery2019"></cite>. These measurements can be practiced on the PA catheter page.',
      manage: 'Management follows the underlying left heart disease. The 6th World Symposium maintained a strong recommendation against the use of PAH therapies in group 2 PH <cite data-ref="vachiery2019"></cite>.',
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
