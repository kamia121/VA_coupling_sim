// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
// `detail` (Scenarios page): mechanism, bedside findings, management evidence, caveat. HTML with <cite>.

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'A resting adult, in whom the LV Ea/Ees is 0.62, matching the Ees/Ea of 1.62 measured by Starling in normal human hearts, and the RV Ees/Ea is 2.0, within the normal range of 1.5 to 2. The response of this heart to each intervention button is the reference against which the disease scenarios are compared.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.49, cSys: 0.7, zcAo: 0.06, vStressed: 941, tau: 0.056, lvMass: 1.5, mapSet: 137.7 },
    text: 'Concentric remodeling raises Ees and Ea together, so the ratio remains in the normal range; Kawaguchi reported an Ees of 4.7 mmHg/mL in HFpEF, compared with 2.1 to 3.3 mmHg/mL in controls. Because the EDPVR is steep, filling pressure responds strongly to volume. A 150-mL fluid bolus raises LAP by 3.2 mmHg here and by 2.3 mmHg in the normal heart, and removing the same volume lowers it by 3.5 mmHg.',
    refs: ['kawaguchi2003', 'borlaug2008'],
    detail: {
      mech: 'Concentric remodeling stiffens the ventricle in both systole and diastole. Ees and Ea increase in parallel, so Ea/Ees and EF remain normal <cite data-ref="kawaguchi2003"></cite>. Because the EDPVR is steep, a given filling volume requires a higher diastolic pressure, and the ventricle depends more on atrial contraction to complete filling. In the model, loss of atrial contraction reduces stroke volume by 14% in this scenario and by 9% in the normal heart; setting the atrial contraction slider to zero in the simulator reproduces this loss.',
      see: 'Because EF is normal on echo, the estimate (1 − EF)/EF, and the Ea/Ees derived from it, are also normal, whereas the absolute Ees, Ea, and filling pressure are increased. Right heart catheterization shows an increased wedge pressure (see table). Ventricular–arterial stiffening amplifies the rise in blood pressure during stress <cite data-ref="kawaguchi2003"></cite>.',
      manage: 'With nitroprusside, blood pressure fell 2.6-fold more in HFpEF than in HFrEF, patients with HFpEF were four times more likely to have a fall in stroke volume, and the increases in stroke volume and cardiac output were about 60% smaller <cite data-ref="schwartzenberg2012"></cite>. Applying the arterial vasodilator to this scenario and then to HFrEF reproduces the direction of these differences. MAP falls by 30 mmHg here and by 13 mmHg in HFrEF, and stroke volume rises by 8% here and by 19% in HFrEF.',
      note: 'A normal ratio does not exclude disease.',
    },
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.26, hr: 85, vStressed: 917, kFFR: 0, pcdV0: 350 },
    text: 'Ees is reduced, the ESPVR is shifted to the right with a V₀ of 40 mL, and neurohormonal activation constricts the arteries, so Ea/Ees exceeds 2 and SW/PVA is low. Because the ESPVR is flat, stroke volume depends heavily on afterload; the arterial vasodilator (SVR × 0.7) raises it by about 19% here and by about 8% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
    detail: {
      mech: 'A reduced Ees and a rightward-shifted ESPVR (V₀ of 40 mL in this scenario) leave a large end-systolic volume, and neurohormonal activation increases Ea. Ea/Ees is therefore well above the normal range, EF is low, and SW/PVA is reduced <cite data-ref="burkhoff1986"></cite>. Because the ESPVR is flat, a small change in Ea moves the end-systolic point a long way along the volume axis, which the afterload handle on the dashed line of the simulator shows directly.',
      see: 'EF is low on echo. The estimate (1 − EF)/EF equals ESV/SV, whereas the true ratio is (ESV − V₀)/SV, so with a V₀ of 40 mL the estimate overstates the degree of uncoupling (see table). Right heart catheterization shows a low cardiac output and an increased wedge pressure.',
      manage: 'In acute heart failure, vasodilators reduce Ea and inotropes increase Ees <cite data-ref="guarracino2013"></cite>. Vasodilation increased stroke volume and cardiac output more in HFrEF than in HFpEF <cite data-ref="schwartzenberg2012"></cite>. In the simulator, the inotrope raises cardiac output from 4.5 to 5.8 L/min and lowers Ea/Ees from 2.65 to 1.95, whereas removing 150 mL of volume lowers LAP from 10.6 to 7.4 mmHg at the cost of 11% of stroke volume.',
      note: 'Therapy guided by coupling has not been tested in outcome trials <cite data-ref="guarracino2013"></cite>.',
    },
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock with vasoplegia',
    params: { svr: 0.336, cSys: 1.8, hr: 87, vStressed: 528 },
    text: 'SVR and Ea are low while Ees is normal, so Ea/Ees falls below the normal range and MAP is below 70 mmHg despite a cardiac output of 8.1 L/min.',
    refs: ['guarracino2014', 'ikonomidis2019'],
    detail: {
      mech: 'Loss of arterial tone lowers SVR and Ea while Ees remains normal. Ea/Ees falls below the normal range together with MAP; ventricular function is preserved, and the arterial load is too low to sustain perfusion pressure.',
      see: 'Echo shows a normal or increased EF and stroke volume, and Ea, estimated as 0.9 × SBP/SV, is low. Invasive monitoring shows a low MAP with a normal or increased cardiac output.',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines recommend norepinephrine as the first-line vasopressor, with an initial MAP target of 65 mmHg <cite data-ref="evans2021"></cite>. Norepinephrine increases Ea <cite data-ref="guarracino2019"></cite>, and in hypotensive postoperative patients it increased stroke volume only when coupling was altered <cite data-ref="guinot2018"></cite>. In the simulator, norepinephrine raises Ea from 0.88 to 1.12 mmHg/mL and MAP from 60 to 75 mmHg, while stroke volume falls slightly, from 74 to 72 mL.',
      note: 'The model has no baroreflex, so pressures in shock are lower than in patients.',
    },
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock with depressed Ees',
    params: { lvEes: 0.75, svr: 0.538, cSys: 1.6, hr: 87, vStressed: 573 },
    text: 'Ees and SVR are low and the heart rate is increased. Because Ea ≈ SVR/T and the cardiac period is short, Ea remains near normal, and the high ratio reflects the low Ees; Guarracino reported an Ea/Ees of 1.81 in septic shock and 1.07 in non-septic patients. In the simulator, norepinephrine raises MAP to 88 mmHg but lowers cardiac output from 6.2 to 5.8 L/min, whereas the inotrope raises cardiac output to 7.4 L/min and lowers Ea/Ees from 1.48 to 1.06.',
    refs: ['guarracino2014', 'whitehouse2023'],
    detail: {
      mech: 'Septic myocardial depression lowers Ees, while vasodilation lowers SVR and tachycardia shortens the cardiac period, so Ea ≈ SVR/T remains near normal. Before vasoactive drugs were started, patients in septic shock had an Ea/Ees of 1.81, compared with 1.07 in non-septic patients, with an Ees of 0.7 versus 2.1 mmHg/mL and an Ea of 1.4 versus 2.3 mmHg/mL; 21 of the 25 septic patients had a ratio above 1.36 <cite data-ref="guarracino2014"></cite>. The high ratio therefore reflected a low Ees, and Ea was lower than in the non-septic patients.',
      see: 'Echo shows a low EF and a low single-beat Ees <cite data-ref="chen2001,guarracino2014"></cite>. MAP is borderline, and cardiac output, at 6.2 L/min, is well below the 8.1 L/min of the vasoplegia scenario at the same heart rate (see tables).',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines suggest adding dobutamine to norepinephrine, or using epinephrine alone, for cardiac dysfunction with persistent hypoperfusion despite adequate volume status and blood pressure, as a weak recommendation based on low-quality evidence <cite data-ref="evans2021"></cite>. Among patients receiving norepinephrine, Ees increased in those whose cardiac output rose and did not increase in those whose output was unchanged <cite data-ref="guarracino2019"></cite>. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm <cite data-ref="whitehouse2023"></cite>.',
      note: 'Whether treatment guided by coupling improves outcomes “remains to be tested” <cite data-ref="guarracino2014"></cite>.',
    },
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness increase while Ees is unchanged. The Ea line steepens and the end-systolic point moves up the same ESPVR, so stroke volume falls by about 15%; the same relative change reduces stroke volume by about 29% in HFrEF.',
    refs: ['sunagawa1983', 'chirinos2014'],
    detail: {
      mech: 'An acute rise in SVR and arterial stiffness increases Ea without changing Ees. The end-systolic point moves up the unchanged ESPVR, so end-systolic volume increases and stroke volume falls. Dragging the afterload handle on the dashed line of the simulator reproduces the same movement continuously.',
      see: 'Echo shows a fall in stroke volume and EF and an increase in Ea, estimated as 0.9 × SBP/SV. Blood pressure is high, and the wedge pressure rises with the end-systolic and end-diastolic volumes.',
      manage: 'In acute heart failure, vasodilators reduce Ea, and rapid reduction of an elevated blood pressure restores Ea and reverses the myocardial dysfunction <cite data-ref="guarracino2013"></cite>. When Ees is low, the same relative increase in afterload produces a larger fall in stroke volume, about 29% in the HFrEF scenario compared with 15% in the normal heart. In this scenario, the arterial vasodilator returns stroke volume from 69 to 78 mL and MAP from 144 to 116 mmHg.',
      note: '',
    },
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 0.4, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 806, rvMass: 2 },
    text: 'PVR is 7 WU and PA compliance is low, and the hypertrophied RV has an Ees of 1.05 mmHg/mL. Ees/Ea is about 1.2 and the RV volumes are near normal, consistent with the Emax/Ea of 1.1 ± 0.3 reported by Kuehne in chronic pulmonary hypertension, compared with 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
    detail: {
      mech: 'High PVR and low PA compliance increase the RV Ea. The RV adapts homeometrically, increasing Ees through hypertrophy while its volumes remain near normal <cite data-ref="vonk2013,naeije2014"></cite>. On MRI-derived pressure–volume loops, Emax/Ea was 1.1 ± 0.3 in six patients with chronic pulmonary hypertension and 1.9 ± 0.4 in six controls <cite data-ref="kuehne2004"></cite>. The acute PE scenario imposes a similar PVR on an RV without this adaptation, and its cardiac output is 3.9 L/min, compared with 5.2 L/min here.',
      see: 'Echo shows a high TR velocity and a low TAPSE/PASP. Right heart catheterization shows a high mPAP and PVR, a RAP at the upper limit of normal, and a cardiac output slightly below normal.',
      manage: 'TAPSE/PASP is one of the variables in the non-invasive risk assessment used at follow-up in the ESC/ERS 2022 guidelines, in which a value above 0.32 indicates low risk and a value below 0.19 indicates high risk <cite data-ref="humbert2022,tello2018,ostermann2023"></cite>. In this scenario Ees/Ea remains above 0.805, the threshold associated with the onset of RV failure <cite data-ref="tello2019hf"></cite>.',
      note: '',
    },
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 0.622, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, vStressed: 963, rvMass: 2, pcdV0: 340 },
    text: 'PVR is 12 WU, the RV Ees is 0.55 mmHg/mL, and the RV ESPVR is shifted to the right. Ees/Ea is below the 0.805 threshold that Tello associated with the onset of RV failure, and SV/ESV is below the 0.515 threshold reported by Vanderpool. The dilated RV raises RAP above 10 mmHg and underfills the LV, so blood pressure is low despite a normal LV Ees.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
    detail: {
      mech: 'The RV has adapted heterometrically and dilates because its Ees no longer matches its Ea <cite data-ref="vonk2013,naeije2014"></cite>. Ees/Ea is below 0.805 <cite data-ref="tello2019hf"></cite>, and SV/ESV is below 0.515 <cite data-ref="vanderpool2015"></cite>. Dilation sustains stroke volume only at the cost of a high end-diastolic volume and RAP, and further filling moves the RV up an increasingly steep EDPVR. Because the ventricles operate in series, the low RV output underfills the LV, and blood pressure falls despite a normal LV Ees.',
      see: 'Echo shows a dilated RV, a low TAPSE, and a TAPSE/PASP well below 0.31 <cite data-ref="tello2019img"></cite>. Right heart catheterization shows a RAP above 10 mmHg and a low cardiac output, and systemic blood pressure is low.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy, together with judicious fluid management, inotropes and vasopressors, assist devices, and RV-protective ventilation <cite data-ref="harjola2016"></cite>. A rising CVP with a falling MAP calls for inotropic or vasoactive support, careful volume management, and inhaled pulmonary vasodilators <cite data-ref="lloyddonald2025"></cite>, although these interventions have not been well studied <cite data-ref="konstam2018"></cite>. In the simulator, a 150-mL fluid bolus raises RAP from 10.7 to 13.2 mmHg but cardiac output by only 0.3 L/min. The inotrope raises cardiac output to 5.1 L/min and also raises mPAP from 54 to 68 mmHg, whereas the pulmonary vasodilator raises cardiac output to 4.8 L/min while lowering both mPAP and RAP.',
      note: 'The model does not include septal shift or pericardial constraint, which in patients further impair LV filling <cite data-ref="konstam2018"></cite>.',
    },
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 0.42, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV is exposed to an acute PVR of 6 WU. Ees is unchanged, so Ees/Ea falls to 0.6 and cardiac output to 3.9 L/min, while mPAP rises only to 29 mmHg. The hypertrophied RV of the compensated PAH scenario maintains a cardiac output of 5.2 L/min at a PVR of 7 WU.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
    detail: {
      mech: 'A normal, thin-walled RV cannot raise its Ees acutely. mPAP rises only moderately because, in the model, an unadapted RV cannot generate more than its isovolumic pressure, Ees × (EDV − V₀), so the added load lowers flow more than it raises pressure.',
      see: 'Echo shows a dilated RV and a low TAPSE/PASP with only a moderately increased PASP. Right heart catheterization shows an increased RAP, a moderately increased mPAP, and a low cardiac output.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy <cite data-ref="harjola2016"></cite>, and the management of PE follows the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>. In the simulator, norepinephrine raises MAP from 71 to 93 mmHg with little change in cardiac output, and the inotrope raises cardiac output from 3.9 to 4.9 L/min.',
      note: '',
    },
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.54, cSys: 0.7, zcAo: 0.06, vStressed: 1250, tau: 0.056, lvMass: 1.5, pvr: 0.187, cPa: 1.8, mapSet: 138.9 },
    text: 'An HFpEF left heart is combined with a PVR of 3.5 WU. A LAP of 16 mmHg raises PA pressure passively, and the additional PVR imposes a pre-capillary load on the RV, whose Ees/Ea falls to 0.69. The ESC/ERS 2022 guidelines define combined post- and pre-capillary PH as a PAWP above 15 mmHg with a PVR above 2 WU.',
    refs: ['humbert2022', 'kawaguchi2003'],
    detail: {
      mech: 'The stiff HFpEF left ventricle raises LA pressure, which increases PA pressure passively. The additional PVR imposes a pre-capillary load on an RV of normal contractility, and RV Ees/Ea falls to 0.69, compared with 2.0 in the normal heart.',
      see: 'A PAWP above 15 mmHg with a PVR above 2 WU defines combined post- and pre-capillary PH <cite data-ref="humbert2022"></cite>. PAWP is measured at end-expiration, and in sinus rhythm the end-diastolic value is the mean of the a wave. Large v waves strongly suggest left heart disease <cite data-ref="vachiery2019"></cite>. These measurements can be practiced on the PA catheter page with this patient selected.',
      manage: 'Management is directed at the underlying left heart disease. The 6th World Symposium maintained a strong recommendation against the use of PAH therapies in group 2 PH <cite data-ref="vachiery2019"></cite>.',
      note: '',
    },
  },
  // ---- Advanced scenarios: the mechanisms on the Advanced page change what these look like
  {
    id: 'asSevere', side: 'lv', group: 'advanced', label: 'Severe aortic stenosis',
    params: { avArea: 0.7, lvEes: 3.2, lvBeta: 0.036, lvA: 0.28, tau: 0.05, lvMass: 1.6, vStressed: 831 },
    text: '', refs: ['baumgartner2017', 'briand2005'],
  },
  {
    id: 'mrAcute', side: 'lv', group: 'advanced', label: 'Acute severe mitral regurgitation',
    params: { mrEroa: 0.5, laEmin: 0.6, laEmax: 2.0 },
    text: '', refs: ['zoghbi2017'],
  },
  {
    id: 'arChronic', side: 'lv', group: 'advanced', label: 'Chronic severe aortic regurgitation',
    params: { arEroa: 0.3, lvA: 2.07, lvBeta: 0.012, lvV0: 25, vStressed: 776, pcdV0: 480, lvMass: 1.6 },
    text: '', refs: ['zoghbi2017'],
  },
  {
    id: 'hfpefTachy', side: 'lv', group: 'advanced', label: 'HFpEF with tachycardia',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.49, cSys: 0.7, zcAo: 0.06, vStressed: 941, tau: 0.056, lvMass: 1.5, mapSet: 137.7, hr: 110 },
    text: '', refs: ['zile2004'],
  },
  {
    id: 'trSevere', side: 'rv', group: 'advanced', label: 'Severe tricuspid regurgitation',
    params: { trEroa: 0.9, rvBeta: 0.012, rvV0: 40, rvA: 2.37, vStressed: 1160, pcdV0: 420, pvr: 0.15 },
    text: '', refs: ['zoghbi2017'],
  },
  {
    id: 'peIschemia', side: 'rv', group: 'advanced', label: 'Acute PE with RV ischemia',
    params: { pvr: 0.54, cPa: 1.4, zcPa: 0.03 },
    text: '', refs: ['vlahakes1981'],
  },
  {
    id: 'tamponade', side: 'both', group: 'advanced', label: 'Cardiac tamponade',
    params: { pcdFluid: 230 },
    text: '', refs: ['spodick2003'],
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
