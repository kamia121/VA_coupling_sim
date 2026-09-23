// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
// `detail` (Scenarios page): mechanism, bedside findings, management evidence, caveat. HTML with <cite>.
import { WU } from './engine.js';

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'Resting adult. The LV Ea/Ees is 0.62, which corresponds to the Ees/Ea of 1.62 measured by Starling in normal human hearts, and the RV Ees/Ea is 2.0, within the normal range of 1.5 to 2.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 880 },
    text: 'Ees and Ea are both increased, and the ratio remains within the normal range. Kawaguchi reported an Ees of 4.7 mmHg/mL in HFpEF, compared with 2.1 to 3.3 mmHg/mL in controls. Because the EDPVR is steep, small changes in volume produce large changes in LAP and blood pressure; the fluid and vasodilator buttons show this effect.',
    refs: ['kawaguchi2003', 'borlaug2008'],
    detail: {
      mech: 'Concentric remodeling increases the stiffness of the ventricle in both systole and diastole. Ees and Ea increase together, with an Ees of 4.7 mmHg/mL compared with 2.1 to 3.3 mmHg/mL in controls, so Ea/Ees and EF remain normal <cite data-ref="kawaguchi2003"></cite>. As the EDPVR steepens, the ventricle requires more pressure to fill to the same volume. The stiff ventricle also depends more on atrial contraction; in the model, loss of atrial contraction reduces stroke volume by 14% in this scenario and by 9% in the normal heart.',
      see: 'EF is normal on echo, so the estimate (1 − EF)/EF, and the Ea/Ees derived from it, are also normal. The absolute Ees, Ea, and filling pressure are all increased. The wedge pressure is increased on right heart catheterization (see table). Ventricular–arterial stiffening amplifies the rise in blood pressure during stress <cite data-ref="kawaguchi2003"></cite>.',
      manage: 'Blood pressure and filling pressure are sensitive to small changes in afterload and volume. With nitroprusside, blood pressure fell 2.6-fold more in HFpEF than in HFrEF, patients with HFpEF were four times more likely to have a fall in stroke volume, and the increases in stroke volume and cardiac output were about 60% smaller <cite data-ref="schwartzenberg2012"></cite>. The vasodilator and volume-removal buttons can be compared between this scenario and HFrEF.',
      note: 'A normal ratio does not exclude disease.',
    },
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.2, hr: 85, vStressed: 760 },
    text: 'Ees is reduced, the ESPVR is shifted to the right with a V₀ of 40 mL, and the arteries are constricted. Ea/Ees is above 2 and SW/PVA is low. Because the ESPVR is flat, a 30% reduction in SVR increases stroke volume by about 20% here and by about 8% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
    detail: {
      mech: 'Ees is reduced and the ESPVR is shifted to the right (V₀ of 40 mL in this scenario), and neurohormonal activation constricts the arteries. Ea/Ees is well above the normal range, EF is low, and SW/PVA is reduced <cite data-ref="burkhoff1986"></cite>.',
      see: 'EF is low on echo. The estimate (1 − EF)/EF equals ESV/SV, whereas the true ratio is (ESV − V₀)/SV, so with a large V₀ the estimate overstates the degree of uncoupling (see table). Cardiac output is low and the wedge pressure is increased on right heart catheterization.',
      manage: 'In acute heart failure, vasodilators reduce Ea and inotropes increase Ees <cite data-ref="guarracino2013"></cite>. Vasodilation increased stroke volume and cardiac output more in HFrEF than in HFpEF <cite data-ref="schwartzenberg2012"></cite>. In the model, a 30% reduction in SVR increases stroke volume by about 20% in this scenario and by about 8% in the normal heart.',
      note: 'Therapy guided by coupling has not been tested in outcome trials <cite data-ref="guarracino2013"></cite>.',
    },
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock with vasoplegia',
    params: { svr: 0.36, cSys: 1.8, hr: 110, vStressed: 700 },
    text: 'SVR and Ea are low and Ees is normal. Ea/Ees falls below the normal range, and MAP is below 70 mmHg.',
    refs: ['guarracino2014', 'ikonomidis2019'],
    detail: {
      mech: 'SVR and Ea fall while Ees remains normal, and Ea/Ees falls below the normal range together with MAP. Ventricular function is preserved, and the arterial load is too low to maintain blood pressure.',
      see: 'EF and stroke volume are normal or increased on echo, and Ea, estimated as 0.9 × SBP/SV, is low. Invasive monitoring shows a low MAP and a normal or increased cardiac output.',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines recommend norepinephrine as the first-line vasopressor, with an initial MAP target of 65 mmHg <cite data-ref="evans2021"></cite>. Norepinephrine increases Ea <cite data-ref="guarracino2019"></cite>. In hypotensive postoperative patients, norepinephrine increased stroke volume only when coupling was altered <cite data-ref="guinot2018"></cite>. The norepinephrine button shows the corresponding changes in Ea, MAP, and stroke volume.',
      note: 'The model has no baroreflex, so pressures in shock are lower than in patients.',
    },
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock with depressed Ees',
    params: { lvEes: 1.0, svr: 0.62, cSys: 1.6, hr: 110, vStressed: 760 },
    text: 'Ees and SVR are low, and the heart rate is increased. Ea remains near normal because Ea ≈ SVR/T and the cardiac period T is short, so the high ratio reflects the low Ees. Guarracino reported an Ea/Ees of 1.81 in septic shock and 1.07 in non-septic patients. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm.',
    refs: ['guarracino2014', 'whitehouse2023'],
    detail: {
      mech: 'Ees and SVR are low, and the heart rate is increased. Ea remains near normal because Ea ≈ SVR/T and the cardiac period T is short. Before vasoactive drugs were started, patients in septic shock had an Ea/Ees of 1.81, compared with 1.07 in non-septic patients, with an Ees of 0.7 versus 2.1 mmHg/mL and an Ea of 1.4 versus 2.3 mmHg/mL; 21 of the 25 septic patients had a ratio above 1.36 <cite data-ref="guarracino2014"></cite>. The high ratio therefore reflected a low Ees, and Ea was lower than in the non-septic patients.',
      see: 'EF and the single-beat Ees are low on echo <cite data-ref="chen2001,guarracino2014"></cite>. MAP is borderline, and cardiac output is well below that of the vasoplegia scenario at a similar SVR (see tables).',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines suggest adding dobutamine to norepinephrine, or using epinephrine alone, for cardiac dysfunction with persistent hypoperfusion despite adequate volume status and blood pressure, as a weak recommendation based on low-quality evidence <cite data-ref="evans2021"></cite>. Among patients receiving norepinephrine, Ees increased in those whose cardiac output rose and did not increase in those whose output was unchanged <cite data-ref="guarracino2019"></cite>. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm <cite data-ref="whitehouse2023"></cite>.',
      note: 'Whether treatment guided by coupling improves outcomes “remains to be tested” <cite data-ref="guarracino2014"></cite>.',
    },
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness increase while Ees is unchanged. The Ea line steepens, the end-systolic point moves up the same ESPVR, and stroke volume falls by about 15%. The same relative change reduces stroke volume by about 29% in HFrEF.',
    refs: ['sunagawa1983', 'chirinos2014'],
    detail: {
      mech: 'SVR and arterial stiffness increase acutely while Ees is unchanged. The Ea line steepens and the end-systolic point moves up the same ESPVR, so stroke volume falls and end-systolic volume increases.',
      see: 'Stroke volume and EF fall on echo, and Ea, estimated as 0.9 × SBP/SV, increases. Blood pressure is high, and the wedge pressure rises with the end-systolic and end-diastolic volumes.',
      manage: 'In acute heart failure, vasodilators reduce Ea, and rapid reduction of an elevated blood pressure restores Ea and reverses the myocardial dysfunction <cite data-ref="guarracino2013"></cite>. When Ees is low, the same relative increase in afterload produces a larger fall in stroke volume, about 29% in the HFrEF scenario compared with 15% in the normal heart.',
      note: '',
    },
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 7 * WU, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 820 },
    text: 'PVR is 7 WU, PA compliance is low, and the RV is hypertrophied, with an Ees of 1.05 mmHg/mL. Ees/Ea is about 1.2 and the RV volumes are near normal. Kuehne reported an Emax/Ea of 1.1 ± 0.3 in pulmonary hypertension and 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
    detail: {
      mech: 'High PVR and low PA compliance increase the RV Ea. The RV adapts homeometrically, increasing Ees by hypertrophy while its volumes remain near normal <cite data-ref="vonk2013,naeije2014"></cite>. On MRI, Emax/Ea was 1.1 ± 0.3 in pulmonary hypertension and 1.9 ± 0.4 in controls <cite data-ref="kuehne2004"></cite>.',
      see: 'The TR velocity is high and TAPSE/PASP is low on echo. mPAP and PVR are high, RAP is at the upper limit of normal, and cardiac output is slightly below normal on right heart catheterization.',
      manage: 'TAPSE/PASP is one of the variables in the non-invasive risk assessment used at follow-up in the ESC/ERS 2022 guidelines, in which a value above 0.32 indicates low risk and a value below 0.19 indicates high risk <cite data-ref="humbert2022,tello2018,ostermann2023"></cite>. In this scenario Ees/Ea remains above 0.805, the threshold associated with RV dilation and failure <cite data-ref="tello2019hf"></cite>.',
      note: '',
    },
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 12 * WU, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, hr: 95, vStressed: 920 },
    text: 'PVR is 12 WU, the RV Ees is 0.55 mmHg/mL, and the RV ESPVR is shifted to the right. Ees/Ea is below 0.805, the threshold Tello associated with RV dilation and failure, and SV/ESV is below 0.515, the threshold reported by Vanderpool. The RV is dilated and RAP is above 10 mmHg. The LV is underfilled, and blood pressure is low despite a normal LV Ees.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
    detail: {
      mech: 'The RV has adapted heterometrically and dilates because its Ees no longer matches its Ea <cite data-ref="vonk2013,naeije2014"></cite>. Ees/Ea is below 0.805 <cite data-ref="tello2019hf"></cite>, and SV/ESV is below 0.515 <cite data-ref="vanderpool2015"></cite>. Because the ventricles are in series, the low RV output underfills the LV, and blood pressure falls despite a normal LV Ees.',
      see: 'The RV is dilated, TAPSE is low, and TAPSE/PASP is well below 0.31 on echo <cite data-ref="tello2019img"></cite>. RAP is above 10 mmHg and cardiac output is low on right heart catheterization, and systemic blood pressure is low.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy, together with judicious fluid management, inotropes and vasopressors, assist devices, and RV-protective ventilation <cite data-ref="harjola2016"></cite>. A rising CVP with a falling MAP calls for inotropic or vasoactive support, careful volume management, and inhaled pulmonary vasodilators <cite data-ref="lloyddonald2025"></cite>. These interventions have not been well studied <cite data-ref="konstam2018"></cite>. The fluid, inotrope, and pulmonary vasodilator buttons can be compared in this scenario.',
      note: 'The model does not include septal shift or pericardial constraint, which in patients further impair LV filling <cite data-ref="konstam2018"></cite>.',
    },
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 6 * WU, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV is exposed to an acute PVR of 6 WU. Ees is unchanged, Ees/Ea falls below 1, and cardiac output falls while mPAP rises only moderately. In compensated PAH at a similar PVR, the RV Ees is higher.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
    detail: {
      mech: 'A normal, thin-walled RV is exposed to an acute PVR of 6 WU. Ees is unchanged, Ees/Ea falls below 1, and cardiac output falls. mPAP rises only moderately because, in the model, an unadapted RV cannot generate more than its isovolumic pressure, Ees × (EDV − V₀). Compensated PAH at a similar PVR provides the comparison.',
      see: 'The RV is dilated and TAPSE/PASP is low on echo, while PASP is only moderately increased. RAP is increased, mPAP is moderately increased, and cardiac output is low on right heart catheterization.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy <cite data-ref="harjola2016"></cite>. The management of PE is described in the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>.',
      note: '',
    },
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 1240, pvr: 3.5 * WU, cPa: 1.8 },
    text: 'An HFpEF left heart is combined with a PVR above 2 WU. A LAP above 15 mmHg raises PA pressure, and the additional PVR is a pre-capillary load on the RV. The ESC/ERS 2022 guidelines define combined post- and pre-capillary PH as a PAWP above 15 mmHg with a PVR above 2 WU.',
    refs: ['humbert2022', 'kawaguchi2003'],
    detail: {
      mech: 'The stiff HFpEF left ventricle raises LA pressure, which increases PA pressure passively. The additional PVR is a pre-capillary load on the RV.',
      see: 'A PAWP above 15 mmHg with a PVR above 2 WU defines combined post- and pre-capillary PH <cite data-ref="humbert2022"></cite>. PAWP is measured at end-expiration, and in sinus rhythm the end-diastolic value is the mean of the a wave. Large v waves strongly suggest left heart disease <cite data-ref="vachiery2019"></cite>. These measurements can be practiced on the PA catheter page.',
      manage: 'Management is directed at the underlying left heart disease. The 6th World Symposium maintained a strong recommendation against the use of PAH therapies in group 2 PH <cite data-ref="vachiery2019"></cite>.',
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
