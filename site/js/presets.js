// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
import { WU } from './engine.js';

export const PRESETS = [
  {
    id: 'normal', side: 'both', label: 'Normal adult at rest',
    params: {},
    text: 'Reference ventricle. Left ventricular Ea/Ees sits near 0.6, the value Starling measured in normal human hearts (Ees/Ea 1.62). The right ventricle operates with Ees/Ea near 2, inside the 1.5–2 range reported for normal pulmonary circulation. Both ventricles eject into their loads with stroke work close to its maximum and high mechanical efficiency.',
    refs: ['starling1993', 'tello2019hf', 'naeije2014'],
  },
  {
    id: 'hfpef', side: 'lv', label: 'Hypertensive heart / HFpEF',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 820 },
    text: 'Ventricular systolic stiffness (Ees) and arterial elastance (Ea) are both raised, as Kawaguchi and colleagues measured in HFpEF (Ees 4.7 vs 2.1–3.3 mmHg/mL in controls). Because the numerator and denominator rise together, the ratio can look normal. The steep ESPVR and stiff EDPVR make pressure very sensitive to small volume shifts, so compare this loop with the reference after moving the volume slider.',
    refs: ['kawaguchi2003', 'borlaug2008'],
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.2, hr: 85, vStressed: 760 },
    text: 'Contractility is depressed and the ESPVR is shifted rightward. With vasoconstriction raising Ea, the ratio climbs well above 1. Stroke work and efficiency both fall, and the ventricle depends on a larger end-diastolic volume (heterometric compensation) to keep a stroke volume. Lowering SVR by 30% raises stroke volume by about 20% in this ventricle but by only about 8% in the normal heart. This is the afterload sensitivity of the failing ventricle.',
    refs: ['borlaug2008', 'burkhoff1986'],
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock: vasoplegia',
    params: { svr: 0.36, cSys: 1.8, hr: 110, vStressed: 700 },
    text: 'Arterial elastance is low because resistance is low. Ees is preserved, so Ea/Ees falls below the usual range and the loop is wide with a low end-systolic pressure. A normal or low ratio does not mean the circulation is adequate: MAP can be unacceptable while coupling looks "efficient". Pressure, flow and perfusion have to be read together.',
    refs: ['guarracino2014', 'ikonomidis2019'],
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock: depressed Ees',
    params: { lvEes: 1.0, svr: 0.62, cSys: 1.6, hr: 110, vStressed: 760 },
    text: 'Guarracino and colleagues found ventriculo-arterial uncoupling in septic shock, with Ea/Ees 1.81 in the uncoupled group, driven largely by low Ees. Here contractility is depressed and SVR is low, yet Ea is close to normal because tachycardia shortens the heart period and Ea ≈ SVR/T. The high ratio comes from the low Ees, which is why the absolute values of Ea and Ees matter as much as the ratio. STRESS-L found no benefit, and possible harm, from landiolol in established septic shock, so heart-rate control is not taught here as a way to "recouple".',
    refs: ['guarracino2014', 'whitehouse2023'],
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'Contractility is normal but SVR and arterial stiffness increase acutely. Ea climbs, end-systolic volume rises along the unchanged ESPVR, and stroke volume falls. Here stroke volume falls by about 16%. Make the same change in the HFrEF scenario and compare how far end-systolic volume moves along the flatter ESPVR.',
    refs: ['sunagawa1983', 'chirinos2014'],
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 7 * WU, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 820 },
    text: 'Pulmonary vascular resistance is high and compliance low. The RV has adapted homeometrically: Ees has risen with hypertrophy, so Ees/Ea stays near 1, similar to the 1.1 ± 0.3 Kuehne measured by MRI in pulmonary hypertension. RV volumes remain close to normal and cardiac output is preserved at rest, but the reserve is small.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 12 * WU, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, hr: 95, vStressed: 860 },
    text: 'Contractility can no longer match load and Ees/Ea falls below 0.8, the threshold Tello and colleagues linked to RV dilatation and failure. The RV dilates (heterometric adaptation), right atrial pressure rises, and the LV is underfilled because the two ventricles are in series. The low LV end-diastolic volume, not LV contractility, is what drops systemic pressure.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 6 * WU, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal, unadapted RV meets a sudden rise in PVR. It cannot raise its Ees acutely, so Ees/Ea falls and cardiac output drops even though mean PA pressure is only moderately raised. Compare this loop with compensated PAH at similar PVR: the difference is the higher Ees of the hypertrophied RV.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 1080, pvr: 3.5 * WU, cPa: 1.8 },
    text: 'The stiff left heart raises left atrial pressure, which is transmitted back to the pulmonary circulation. With an added pre-capillary component (PVR above 2 WU) the RV faces both a higher downstream pressure and a higher resistance. Note that PA pressure rises partly because of left atrial pressure alone. This is why the diastolic and transpulmonary gradients are used to separate the two components.',
    refs: ['humbert2022', 'kawaguchi2003'],
  },
];

export function presetById(id) { return PRESETS.find((p) => p.id === id); }
