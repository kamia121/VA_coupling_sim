// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
// `detail` (Scenarios page): mechanism, bedside findings, management evidence, caveat. HTML with <cite>.

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'A resting adult, in whom the LV Ea/Ees is 0.62, matching the Ees/Ea of 1.62 measured by Starling in normal human hearts, and the RV Ees/Ea is 2.0, within the normal range of 1.5 to 2. The baroreflex sits at its set point, and the response of this heart to each intervention button is the reference against which the disease scenarios are compared.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.49, cSys: 0.7, zcAo: 0.06, vStressed: 941, tau: 0.056, lvMass: 1.5, mapSet: 137.7 },
    text: 'Concentric remodeling raises Ees and Ea together, so the ratio remains in the normal range; Kawaguchi reported an Ees of 4.7 mmHg/mL in HFpEF, compared with 2.1 to 3.3 mmHg/mL in controls. Relaxation is slow, with a fitted τ of 59 ms against 36 ms in the normal heart, and the EDPVR is steep. A 150-mL fluid bolus raises LAP by 2.5 mmHg here and by 2.0 mmHg in the normal heart, and removing the same volume lowers it by 2.5 mmHg.',
    refs: ['kawaguchi2003', 'borlaug2008'],
    detail: {
      mech: 'Concentric remodeling stiffens the ventricle in both systole and diastole. Ees and Ea increase in parallel, so Ea/Ees and EF remain normal <cite data-ref="kawaguchi2003"></cite>. Relaxation is prolonged, with a τ of 59 ± 14 ms in HFpEF against 35 ± 10 ms in controls <cite data-ref="zile2004"></cite>, and the EDPVR is steep, so a given filling volume requires a higher diastolic pressure and the ventricle depends more on atrial contraction to complete filling. In the model, loss of atrial contraction reduces stroke volume by 16% in this scenario and by 11% in the normal heart; setting the atrial contraction slider to zero in the simulator reproduces this loss. The baroreflex set point is moved to the prevailing pressure, a simplification of the partial resetting seen in chronic hypertension <cite data-ref="lohmeier2015"></cite>.',
      see: 'Because EF is normal on echo, the estimate (1 − EF)/EF, and the Ea/Ees derived from it, are also normal, whereas the absolute Ees, Ea, and filling pressure are increased. Right heart catheterization shows an increased PAWP (see table). Ventricular–arterial stiffening amplifies the rise in blood pressure during stress <cite data-ref="kawaguchi2003"></cite>.',
      manage: 'With nitroprusside, blood pressure fell 2.6-fold more in HFpEF than in HFrEF, patients with HFpEF were four times more likely to have a fall in stroke volume, and the increases in stroke volume and cardiac output were about 60% smaller <cite data-ref="schwartzenberg2012"></cite>. Applying the arterial vasodilator to this scenario and then to HFrEF reproduces the direction of these differences, with the baroreflex buffering both. MAP falls by 10 mmHg here and by 6 mmHg in HFrEF, and stroke volume rises by 7% here and by 15% in HFrEF.',
      note: 'A normal ratio does not exclude disease. With the baroreflex switched off, the same vasodilator lowers MAP by 30 mmHg in this scenario.',
    },
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.26, hr: 85, vStressed: 917, kFFR: 0, pcdV0: 350 },
    text: 'Ees is reduced, the ESPVR is shifted to the right with a V₀ of 40 mL, and neurohormonal activation constricts the arteries, so Ea/Ees exceeds 2 and SW/PVA is low. Because the ESPVR is flat, stroke volume depends heavily on afterload; the arterial vasodilator (SVR × 0.7) raises it by about 15% here and by about 9% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
    detail: {
      mech: 'A reduced Ees and a rightward-shifted ESPVR (V₀ of 40 mL in this scenario) leave a large end-systolic volume, and neurohormonal activation increases Ea. Ea/Ees is therefore well above the normal range, EF is low, and SW/PVA is reduced <cite data-ref="burkhoff1986"></cite>. Because the ESPVR is flat, a small change in Ea moves the end-systolic point a long way along the volume axis, which the afterload handle on the dashed line of the simulator shows directly. The failing myocardium also loses the positive force–frequency relation <cite data-ref="hasenfuss1994"></cite>, so Ees does not rise with heart rate in this scenario.',
      see: 'EF is low on echo. The estimate (1 − EF)/EF equals ESV/SV, whereas the true ratio is (ESV − V₀)/SV, so with a V₀ of 40 mL the estimate overstates the degree of uncoupling (see table). Right heart catheterization shows a low cardiac output and an increased PAWP.',
      manage: 'In acute heart failure, vasodilators reduce Ea and inotropes increase Ees <cite data-ref="guarracino2013"></cite>. Vasodilation increased stroke volume and cardiac output more in HFrEF than in HFpEF <cite data-ref="schwartzenberg2012"></cite>. In the simulator, the inotrope raises cardiac output from 4.4 to 5.6 L/min and lowers Ea/Ees from 2.74 to 1.83, whereas removing 150 mL of volume lowers LAP from 13.4 to 10.8 mmHg at the cost of 6% of stroke volume.',
      note: 'Therapy guided by coupling has not been tested in outcome trials <cite data-ref="guarracino2013"></cite>.',
    },
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock with vasoplegia',
    params: { svr: 0.336, cSys: 1.8, hr: 87, vStressed: 528 },
    text: 'SVR and Ea are low while Ees is normal, so Ea/Ees falls below the normal range and MAP is 64 mmHg despite a cardiac output of 8.2 L/min. The baroreflex has raised the heart rate to 112/min and recruited venous volume; with the reflex switched off, MAP would be 46 mmHg.',
    refs: ['guarracino2014', 'ikonomidis2019'],
    detail: {
      mech: 'Loss of arterial tone lowers SVR and Ea while Ees remains normal. Ea/Ees falls below the normal range together with MAP; ventricular function is preserved, and the arterial load is too low to sustain perfusion pressure. The baroreflex responds with tachycardia, a rise in Ees, and venoconstriction, which raise MAP from 46 to 64 mmHg.',
      see: 'Echo shows a normal or increased EF and stroke volume, and Ea, estimated as 0.9 × SBP/SV, is low. Invasive monitoring shows a low MAP with a normal or increased cardiac output.',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines recommend norepinephrine as the first-line vasopressor, with an initial MAP target of 65 mmHg <cite data-ref="evans2021"></cite>. Norepinephrine increases Ea <cite data-ref="guarracino2019"></cite>, and in hypotensive postoperative patients it increased stroke volume only when coupling was altered <cite data-ref="guinot2018"></cite>. In the simulator, norepinephrine raises Ea from 0.93 to 1.11 mmHg/mL and MAP from 64 to 75 mmHg, while stroke volume falls slightly, from 74 to 72 mL, and the reflex slows the heart from 112 to 106/min.',
      note: 'The baroreflex in the model acts on heart rate, Ees, SVR, and venous tone; it has no chemoreflex, vasopressin, or renin–angiotensin response.',
    },
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock with depressed Ees',
    params: { lvEes: 0.75, svr: 0.538, cSys: 1.6, hr: 87, vStressed: 573 },
    text: 'Ees and SVR are low and the heart rate is increased. Because Ea ≈ SVR/T and the cardiac period is short, Ea remains near normal, and the high ratio reflects the low Ees; Guarracino reported an Ea/Ees of 1.81 in septic shock and 1.07 in non-septic patients. In the simulator, norepinephrine raises MAP from 69 to 78 mmHg but lowers cardiac output from 6.0 to 5.3 L/min, whereas the inotrope raises cardiac output to 6.9 L/min and lowers Ea/Ees from 1.51 to 1.05.',
    refs: ['guarracino2014', 'whitehouse2023'],
    detail: {
      mech: 'Septic myocardial depression lowers Ees, while vasodilation lowers SVR and tachycardia shortens the cardiac period, so Ea ≈ SVR/T remains near normal. Before vasoactive drugs were started, patients in septic shock had an Ea/Ees of 1.81, compared with 1.07 in non-septic patients, with an Ees of 0.7 versus 2.1 mmHg/mL and an Ea of 1.4 versus 2.3 mmHg/mL; 21 of the 25 septic patients had a ratio above 1.36 <cite data-ref="guarracino2014"></cite>. The high ratio therefore reflected a low Ees, and Ea was lower than in the non-septic patients.',
      see: 'Echo shows a low EF and a low single-beat Ees <cite data-ref="chen2001,guarracino2014"></cite>. MAP is borderline, and cardiac output, at 6.0 L/min, is well below the 8.2 L/min of the vasoplegia scenario at a similar heart rate (see tables).',
      manage: 'The Surviving Sepsis Campaign 2021 guidelines suggest adding dobutamine to norepinephrine, or using epinephrine alone, for cardiac dysfunction with persistent hypoperfusion despite adequate volume status and blood pressure, as a weak recommendation based on low-quality evidence <cite data-ref="evans2021"></cite>. Among patients receiving norepinephrine, Ees increased in those whose cardiac output rose and did not increase in those whose output was unchanged <cite data-ref="guarracino2019"></cite>. In the STRESS-L trial, landiolol did not reduce organ failure, and the trial was stopped early for possible harm <cite data-ref="whitehouse2023"></cite>.',
      note: 'Whether treatment guided by coupling improves outcomes “remains to be tested” <cite data-ref="guarracino2014"></cite>.',
    },
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness increase while Ees is unchanged. The Ea line steepens and the end-systolic point moves up the same ESPVR, so stroke volume falls by about 16%; the same relative change reduces stroke volume by about 26% in HFrEF. The baroreflex slows the heart to 59/min.',
    refs: ['sunagawa1983', 'chirinos2014'],
    detail: {
      mech: 'An acute rise in SVR and arterial stiffness increases Ea without changing the intrinsic Ees. The end-systolic point moves up the ESPVR, so end-systolic volume increases and stroke volume falls. The baroreflex, which has not reset to an acute rise, slows the heart and lowers Ees and venous tone, and MAP settles at 109 mmHg. Dragging the afterload handle on the dashed line of the simulator reproduces the same movement continuously.',
      see: 'Echo shows a fall in stroke volume and EF and an increase in Ea, estimated as 0.9 × SBP/SV. Blood pressure is high, and the PAWP rises with the end-systolic and end-diastolic volumes.',
      manage: 'In acute heart failure, vasodilators reduce Ea, and rapid reduction of an elevated blood pressure restores Ea and reverses the myocardial dysfunction <cite data-ref="guarracino2013"></cite>. When Ees is low, the same relative increase in afterload produces a larger fall in stroke volume, about 26% in the HFrEF scenario compared with 16% in the normal heart. In this scenario, the arterial vasodilator returns stroke volume from 67 to 75 mL and MAP from 109 to 101 mmHg.',
      note: '',
    },
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 0.4, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 806, rvMass: 2 },
    text: 'PVR is 7.3 WU and PA compliance is low, and the hypertrophied RV has an Ees of 1.07 mmHg/mL. Ees/Ea is about 1.2 and the RV volumes are near normal, consistent with the Emax/Ea of 1.1 ± 0.3 reported by Kuehne in chronic pulmonary hypertension, compared with 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
    detail: {
      mech: 'High PVR and low PA compliance increase the RV Ea. The RV adapts homeometrically, increasing Ees through hypertrophy while its volumes remain near normal <cite data-ref="vonk2013,naeije2014"></cite>. On MRI-derived pressure–volume loops, Emax/Ea was 1.1 ± 0.3 in six patients with chronic pulmonary hypertension and 1.9 ± 0.4 in six controls <cite data-ref="kuehne2004"></cite>. The acute PE scenario imposes a similar PVR, 7.7 WU, on an RV without this adaptation, and its cardiac output is 4.3 L/min, compared with 5.2 L/min here.',
      see: 'Echo shows a high TR velocity and a low TAPSE/PASP. Right heart catheterization shows a high mPAP and PVR, a RAP at the upper limit of normal, and a cardiac output slightly below normal.',
      manage: 'TAPSE/PASP is one of the variables in the non-invasive risk assessment used at follow-up in the ESC/ERS 2022 guidelines, in which a value above 0.32 indicates low risk and a value below 0.19 indicates high risk <cite data-ref="humbert2022,tello2018,ostermann2023"></cite>. In this scenario Ees/Ea remains above 0.805, the threshold associated with the onset of RV failure <cite data-ref="tello2019hf"></cite>.',
      note: '',
    },
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 0.622, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, vStressed: 963, rvMass: 2, pcdV0: 340 },
    text: 'PVR is 11 WU, the RV Ees is 0.59 mmHg/mL, and the RV ESPVR is shifted to the right. Ees/Ea is 0.42, below the 0.805 threshold that Tello associated with the onset of RV failure, and SV/ESV is 0.32, below the 0.515 threshold reported by Vanderpool. The dilated RV raises RAP to 12 mmHg, displaces the septum toward the LV, and underfills the LV.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
    detail: {
      mech: 'The RV has adapted heterometrically and dilates because its Ees no longer matches its Ea <cite data-ref="vonk2013,naeije2014"></cite>. Ees/Ea is below 0.805 <cite data-ref="tello2019hf"></cite>, and SV/ESV is below 0.515 <cite data-ref="vanderpool2015"></cite>. Dilation sustains stroke volume only at the cost of a high end-diastolic volume and RAP, and further filling moves the RV up an increasingly steep EDPVR. The raised RV diastolic pressure shifts the septum 16 mL toward the LV, which raises LV diastolic pressure at any given LV volume, and because the ventricles operate in series, the low RV output also underfills the LV.',
      see: 'Echo shows a dilated RV, a flattened septum, a low TAPSE, and a TAPSE/PASP well below 0.31 <cite data-ref="tello2019img"></cite>. Right heart catheterization shows a RAP above 10 mmHg and a low cardiac output.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy, together with judicious fluid management, inotropes and vasopressors, assist devices, and RV-protective ventilation <cite data-ref="harjola2016"></cite>. A rising CVP with a falling MAP calls for inotropic or vasoactive support, careful volume management, and inhaled pulmonary vasodilators <cite data-ref="lloyddonald2025"></cite>, although these interventions have not been well studied <cite data-ref="konstam2018"></cite>. In the simulator, a 150-mL fluid bolus raises RAP from 11.6 to 14.0 mmHg with almost no change in cardiac output. The inotrope raises cardiac output from 4.3 to 5.4 L/min and mPAP from 53 to 65 mmHg, and the pulmonary vasodilator raises cardiac output to 4.7 L/min while lowering mPAP and RAP. The arterial vasodilator lowers aortic pressure, and with it RV coronary perfusion, and the RV becomes ischemic; cardiac output falls to 2.7 L/min.',
      note: 'The model has no pulmonary vasoreactivity and no neurohormonal remodeling; RV ischemia is represented only as a supply–demand balance.',
    },
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 0.42, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV is exposed to an acute PVR of 7.7 WU. Ees cannot rise acutely, so Ees/Ea falls to 0.53 and cardiac output to 4.3 L/min, while mPAP rises only to 37 mmHg. The hypertrophied RV of the compensated PAH scenario maintains a cardiac output of 5.2 L/min at a PVR of 7.3 WU.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
    detail: {
      mech: 'A normal, thin-walled RV cannot raise its Ees acutely. mPAP rises only moderately because an unadapted RV cannot generate more than its isovolumic pressure, Ees × (EDV − V₀), so the added load lowers flow more than it raises pressure. The dilating RV, constrained by the pericardium, shifts the septum 13 mL toward the LV. The baroreflex raises the heart rate to 80/min and holds MAP at 84 mmHg; with the reflex switched off, MAP is 68 mmHg.',
      see: 'Echo shows a dilated RV, a flattened septum, and a low TAPSE/PASP with only a moderately increased PASP. Right heart catheterization shows an increased RAP, a moderately increased mPAP, and a low cardiac output.',
      manage: 'In acute RV failure, identification and treatment of the underlying cause is the primary strategy <cite data-ref="harjola2016"></cite>, and the management of PE follows the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>. In the simulator, norepinephrine raises MAP from 84 to 93 mmHg with a small fall in cardiac output, and the inotrope raises cardiac output from 4.3 to 5.3 L/min. The arterial vasodilator lowers aortic pressure below what the RV coronary circulation needs, and the RV becomes ischemic; the Advanced page follows this mechanism.',
      note: '',
    },
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.54, cSys: 0.7, zcAo: 0.06, vStressed: 1250, tau: 0.056, lvMass: 1.5, pvr: 0.187, cPa: 1.8, mapSet: 138.9 },
    text: 'An HFpEF left heart is combined with a PVR of 3.5 WU. A LAP of 17 mmHg raises PA pressure passively, and the additional PVR imposes a pre-capillary load on the RV, whose Ees/Ea falls to 0.69. The ESC/ERS 2022 guidelines define combined post- and pre-capillary PH as a PAWP above 15 mmHg with a PVR above 2 WU.',
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
    text: 'An aortic valve area of 0.7 cm² produces a mean gradient of 55 mmHg and a peak gradient of 82 mmHg at a cardiac output of 5.3 L/min. The hypertrophied LV has a raised Ees, a steep EDPVR, and a τ of 53 ms, so LVEDP is 20 mmHg while LAP is 12 mmHg.',
    refs: ['baumgartner2017', 'briand2005'],
    detail: {
      mech: 'The stenotic orifice adds a flow-dependent load in series with the arterial tree, so the LV must generate the aortic pressure plus the transvalvular gradient. Ea measured as LV end-systolic pressure divided by stroke volume therefore contains both loads, which Briand and colleagues expressed as the valvulo-arterial impedance; that global afterload was the only hemodynamic variable independently associated with LV dysfunction in 208 patients with at least moderate AS <cite data-ref="briand2005"></cite>. Concentric hypertrophy raises Ees and slows relaxation, and the stiff ventricle depends on atrial contraction to reach its end-diastolic volume.',
      see: 'A mean gradient of 40 mmHg or more, a peak velocity of 4 m/s or more, or a valve area below 1.0 cm² grade the stenosis as severe <cite data-ref="baumgartner2017"></cite>. The gradient depends on flow. In the simulator, the inotrope raises cardiac output from 5.3 to 6.4 L/min and the mean gradient from 55 to 70 mmHg while the orifice area stays at 0.7 cm², which is why a low-flow state can hide severe stenosis behind a modest gradient.',
      manage: 'Valve replacement relieves the fixed load. The hypertrophied ventricle also tolerates tachycardia poorly because the shortened diastole cannot accommodate its slow relaxation; raising the intrinsic heart rate in the simulator shows filling, stroke volume, and pressure falling together.',
      note: 'The model treats the stenosis as a fixed orifice and does not include pressure recovery in the ascending aorta.',
    },
  },
  {
    id: 'mrAcute', side: 'lv', group: 'advanced', label: 'Acute severe mitral regurgitation',
    params: { mrEroa: 0.5, laEmin: 0.6, laEmax: 2.0 },
    text: 'An effective regurgitant orifice of 0.5 cm² opens into a normal-sized, noncompliant LA. The LV ejects 124 mL per beat, but only 57 mL reaches the aorta, a regurgitant fraction of 54%. Mean LAP is 15 mmHg with v waves reaching 24 mmHg, and Ea/Ees falls to 0.23 because the LA offers a low-impedance outlet.',
    refs: ['zoghbi2017'],
    detail: {
      mech: 'During systole the LV empties into two outlets, the aorta and the LA, so the total stroke volume rises while forward flow falls. The regurgitant volume enters an LA that has not had time to enlarge, and its pressure rises steeply during systole, which produces the large v wave. Measured as end-systolic pressure over total stroke volume, Ea falls, and EF rises to 79% even though forward output is reduced; in MR, EF overstates forward pump function.',
      see: 'An EROA of 0.4 cm² or more, a regurgitant volume of 60 mL or more, and a regurgitant fraction of 50% or more grade MR as severe <cite data-ref="zoghbi2017"></cite>. On the PA catheter page, the acute severe MR option applies the same orifice to any patient and shows the wedge v wave.',
      manage: 'Afterload reduction redirects flow toward the aorta. In the simulator, the arterial vasodilator raises forward stroke volume from 57 to 65 mL and cardiac output from 4.5 to 5.5 L/min and lowers the regurgitant fraction from 54% to 49%, while MAP falls from 85 to 77 mmHg.',
      note: 'The model has no mitral annular dilation or LA remodeling, so it represents acute rather than chronic MR.',
    },
  },
  {
    id: 'arChronic', side: 'lv', group: 'advanced', label: 'Chronic severe aortic regurgitation',
    params: { arEroa: 0.3, lvA: 2.07, lvBeta: 0.012, lvV0: 25, vStressed: 776, pcdV0: 480, lvMass: 1.6 },
    text: 'An effective regurgitant orifice of 0.3 cm² returns 44% of the stroke volume to the LV in diastole. The dilated, compliant LV ejects 136 mL per beat to deliver a forward stroke volume of 77 mL, and blood pressure is 132/46 mmHg.',
    refs: ['zoghbi2017'],
    detail: {
      mech: 'Chronic volume overload enlarges the LV and shifts its EDPVR to the right, and the pericardium enlarges with the heart <cite data-ref="freeman1984"></cite>, so the ventricle accommodates the regurgitant volume at a modest filling pressure. The large total stroke volume ejected into the arteries widens the pulse pressure, and the diastolic runoff back into the LV lowers the diastolic pressure. Ea/Ees falls to 0.41 because Ea is calculated from total stroke volume.',
      see: 'An EROA of 0.3 cm² or more, a regurgitant volume of 60 mL or more, and a regurgitant fraction of 50% or more grade AR as severe <cite data-ref="zoghbi2017"></cite>. The wide pulse pressure and low diastolic pressure are visible on the arterial line.',
      manage: 'A faster heart rate shortens diastole, and with it the time available for regurgitation. In the simulator, raising the intrinsic heart rate from 70 to 90/min lowers the regurgitant fraction from 44% to 41% and LVEDP from 18 to 14 mmHg and raises the diastolic pressure from 46 to 56 mmHg.',
      note: 'The model reaches this state through its parameters and does not simulate the years of remodeling that produce it.',
    },
  },
  {
    id: 'hfpefTachy', side: 'lv', group: 'advanced', label: 'HFpEF with tachycardia',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.49, cSys: 0.7, zcAo: 0.06, vStressed: 941, tau: 0.056, lvMass: 1.5, mapSet: 137.7, hr: 110 },
    text: 'The HFpEF ventricle of the standard scenario is driven at an intrinsic rate of 110/min, which the baroreflex slows to 102/min. With a τ of 59 ms, relaxation is incomplete before the next beat, the minimum diastolic LV pressure is 14 mmHg, and stroke volume falls to 54 mL. With a normal τ of 35 ms at the same rate, the minimum is 10 mmHg and stroke volume is 66 mL.',
    refs: ['zile2004'],
    detail: {
      mech: 'Isovolumic pressure decline takes about three to four time constants to complete. With a τ of 59 ± 14 ms in HFpEF, compared with 35 ± 10 ms in controls <cite data-ref="zile2004"></cite>, the ventricle needs about 200 ms to relax, which a resting cycle provides but a fast one does not. The residual activation raises diastolic pressure throughout filling, so less volume enters the ventricle at a higher pressure. At 70/min the same change in τ alters LAP by less than 1 mmHg; at 102/min it raises LAP by 3 mmHg and lowers stroke volume by 12 mL.',
      see: 'Echo shows a small LV cavity, a high E/e′ pattern, and fused E and A waves at the fast rate. Right heart catheterization shows a raised PAWP that rises further with the heart rate.',
      manage: 'Slowing the heart rate lengthens diastole and allows relaxation to complete. In the simulator, lowering the intrinsic heart rate back to 70/min returns stroke volume to 72 mL.',
      note: 'The model represents slow relaxation as a longer activation decay and does not include calcium handling or the effect of ischemia on relaxation.',
    },
  },
  {
    id: 'trSevere', side: 'rv', group: 'advanced', label: 'Severe tricuspid regurgitation',
    params: { trEroa: 0.9, rvBeta: 0.012, rvV0: 40, rvA: 2.37, vStressed: 1160, pcdV0: 420, pvr: 0.15 },
    text: 'An effective regurgitant orifice of 0.9 cm² returns 46% of the RV stroke volume, 62 mL per beat, to the RA. RAP is 12 mmHg with systolic RA waves reaching 20 mmHg, and the dilated RV, with an end-diastolic volume of 230 mL, displaces the septum 12 mL toward the LV.',
    refs: ['zoghbi2017'],
    detail: {
      mech: 'The RV ejects into two outlets, and the low-pressure RA takes a large share of each stroke. The RA pressure rises during systole, which merges the c and v waves into a single systolic wave. The regurgitant volume returns to the RV in diastole, so RV end-diastolic volume grows, the septum shifts toward the LV, and RV Ees/Ea, calculated from total stroke volume, overstates forward RV performance.',
      see: 'An EROA of 0.4 cm² or more and a regurgitant volume of 45 mL or more grade TR as severe <cite data-ref="zoghbi2017"></cite>. With torrential TR, the RA–RV pressure gradient falls and the Doppler estimate 4v² + RAP underestimates PASP.',
      manage: 'In the simulator, removing 150 mL of volume lowers RAP from 11.9 to 10.1 mmHg with a small fall in cardiac output, from 5.2 to 5.0 L/min.',
      note: 'The model has no annular dilation or leaflet tethering, so the orifice does not change with RV size.',
    },
  },
  {
    id: 'peIschemia', side: 'rv', group: 'advanced', label: 'Acute PE with RV ischemia',
    params: { pvr: 0.66, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV faces an acute PVR of about 12 WU. RV pressure and wall tension rise while aortic pressure falls, RV coronary supply falls below demand, and the ischemic RV loses contractility: Ees falls to 0.17 mmHg/mL, cardiac output to 2.0 L/min, and MAP to 51 mmHg. With the coronary mechanism switched off, the same load gives a cardiac output of 3.8 L/min.',
    refs: ['vlahakes1981'],
    detail: {
      mech: 'The RV is perfused through systole and diastole, so its perfusion pressure is the aortic pressure minus the RV pressure. As PVR rises, RV systolic pressure and oxygen demand rise while cardiac output and aortic pressure fall, and supply falls below demand. The ischemic RV contracts less, cardiac output and aortic pressure fall further, and the process feeds on itself. In dogs with pulmonary artery constriction, RV failure coincided with exhausted right coronary reserve and biochemical ischemia of the RV free wall, and raising aortic pressure with phenylephrine reversed both <cite data-ref="vlahakes1981"></cite>.',
      see: 'Echo shows a severely dilated, hypokinetic RV and a septum displaced 18 mL toward an underfilled LV. mPAP is only 26 mmHg, lower than in the less severe PE scenario, because the failing RV cannot generate pressure.',
      manage: 'Norepinephrine raises aortic pressure and with it RV perfusion pressure. In the simulator, it restores RV contractility, raises MAP from 51 to 89 mmHg and cardiac output from 2.0 to 3.5 L/min, and mPAP rises to 45 mmHg as the RV recovers. The inotrope does not reverse the ischemia, because it raises demand and heart rate without restoring perfusion pressure, and a fluid bolus raises RAP to 14 mmHg without improving output. The pulmonary vasodilator also reverses it by lowering the load. The management of PE follows the ESC 2019 guideline <cite data-ref="konstantinides2020"></cite>.',
      note: 'Ischemia in the model is a supply–demand balance with a coronary flow reserve of 5; it has no collateral flow, no infarction, and no time course.',
    },
  },
  {
    id: 'tamponade', side: 'both', group: 'advanced', label: 'Cardiac tamponade',
    params: { pcdFluid: 230 },
    text: '230 mL of pericardial fluid raises the pericardial pressure to 9 mmHg, and diastolic pressures equalize: RAP 11, LAP 12, RV end-diastolic pressure 12, and LV end-diastolic pressure 13 mmHg. Both ventricles fill to about 70 mL, stroke volume falls to 36 mL, and the baroreflex raises the heart rate to 88/min to hold MAP at 70 mmHg.',
    refs: ['spodick2003'],
    detail: {
      mech: 'The pericardium encloses all four chambers, and its pressure–volume relation is flat until its reserve volume is used and then rises steeply. Fluid occupies that reserve, so the pressure outside the heart rises and adds to the pressure inside every chamber. Filling requires a venous pressure above the pericardial pressure, and the chambers fill only to the volume at which their pressures equal it, which equalizes the diastolic pressures <cite data-ref="spodick2003"></cite>.',
      see: 'Echo shows the effusion, small ventricles, and diastolic collapse of the right-sided chambers. Right heart catheterization shows equalization of RAP, RV diastolic pressure, and PAWP <cite data-ref="spodick2003"></cite>. Pulsus paradoxus depends on breathing, which the model does not include.',
      manage: 'Drainage removes the constraint. In the simulator, the pericardial fluid slider shows the steep part of the relation: 100 mL raises pericardial pressure to 3 mmHg with a cardiac output of 4.9 L/min, and 230 mL raises it to 9 mmHg with a cardiac output of 3.1 L/min. A 150-mL fluid bolus raises RAP to 13 mmHg and cardiac output by only 3%.',
      note: 'The model has no breathing, so it cannot show the respiratory variation of ventricular filling that underlies pulsus paradoxus.',
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
