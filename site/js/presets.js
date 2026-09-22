// Teaching scenarios. All parameter sets are synthetic illustrations, not patient data
// and not treatment targets. Keys not listed fall back to NORMAL (engine.js).
// `refs` are keys into refs.js; each scenario text states what the source shows.
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
  },
  {
    id: 'hfref', side: 'lv', label: 'HFrEF (dilated, low Ees)',
    params: { lvEes: 0.8, lvV0: 40, lvBeta: 0.021, lvA: 0.3, svr: 1.2, hr: 85, vStressed: 760 },
    text: 'Low Ees, ESPVR shifted right (V₀ 40 mL), vasoconstriction. Ea/Ees above 2, low SW/PVA. With a flat ESPVR, a 30% SVR reduction raises SV about 20% here and about 8% in the normal heart.',
    refs: ['borlaug2008', 'burkhoff1986'],
  },
  {
    id: 'vasoplegia', side: 'lv', label: 'Septic shock: vasoplegia',
    params: { svr: 0.36, cSys: 1.8, hr: 110, vStressed: 700 },
    text: 'Low SVR and Ea, normal Ees. Ea/Ees falls below the band while MAP is under 70 mmHg.',
    refs: ['guarracino2014', 'ikonomidis2019'],
  },
  {
    id: 'septicCM', side: 'lv', label: 'Septic shock: depressed Ees',
    params: { lvEes: 1.0, svr: 0.62, cSys: 1.6, hr: 110, vStressed: 760 },
    text: 'Low Ees with low SVR and tachycardia. Ea stays near normal because Ea ≈ SVR/T and T is short; the high ratio comes from Ees. Guarracino 2014: Ea/Ees 1.81 in uncoupled septic shock. STRESS-L: landiolol did not reduce organ failure and stopped early for possible harm.',
    refs: ['guarracino2014', 'whitehouse2023'],
  },
  {
    id: 'highAfterload', side: 'lv', label: 'Acute afterload rise (hypertensive)',
    params: { svr: 1.7, cSys: 0.8 },
    text: 'SVR and arterial stiffness up, Ees unchanged. The Ea line steepens, the end-systolic point climbs the same ESPVR, and SV falls about 16%. Repeat the change in HFrEF for comparison.',
    refs: ['sunagawa1983', 'chirinos2014'],
  },
  {
    id: 'pahComp', side: 'rv', label: 'PAH, compensated RV',
    params: { pvr: 7 * WU, cPa: 1.0, zcPa: 0.03, rvEes: 1.05, rvBeta: 0.028, rvA: 0.3, vStressed: 820 },
    text: 'PVR 7 WU, low PA compliance, hypertrophied RV (Ees 1.05). Ees/Ea about 1.2 with near-normal RV volumes. Kuehne 2004: Emax/Ea 1.1 ± 0.3 in PH vs 1.9 ± 0.4 in controls.',
    refs: ['kuehne2004', 'naeije2014', 'tello2019hf'],
  },
  {
    id: 'pahDecomp', side: 'rv', label: 'PAH, decompensated RV',
    params: { pvr: 12 * WU, cPa: 0.7, zcPa: 0.035, rvEes: 0.55, rvV0: 45, rvBeta: 0.024, rvA: 0.3, hr: 95, vStressed: 860 },
    text: 'PVR 12 WU, RV Ees 0.55, ESPVR shifted right. Ees/Ea below 0.805, the Tello 2019 threshold for RV dilatation and failure; SV/ESV below 0.515 (Vanderpool 2015). Dilated RV, RAP above 10 mmHg, underfilled LV and low BP with normal LV Ees.',
    refs: ['tello2019hf', 'vanderpool2015', 'naeije2014'],
  },
  {
    id: 'acutePE', side: 'rv', label: 'Acute massive PE',
    params: { pvr: 6 * WU, cPa: 1.4, zcPa: 0.03 },
    text: 'A normal RV meets PVR 6 WU acutely. Ees is unchanged, Ees/Ea falls below 1, and CO drops while mPAP is only moderately raised. Compare with compensated PAH at similar PVR, where RV Ees is higher.',
    refs: ['konstantinides2020', 'konstam2018', 'naeije2014'],
  },
  {
    id: 'cpcph', side: 'rv', label: 'HFpEF with combined pre-/post-capillary PH',
    params: { lvEes: 4.5, lvBeta: 0.042, lvA: 0.3, svr: 1.5, cSys: 0.7, zcAo: 0.06, vStressed: 1080, pvr: 3.5 * WU, cPa: 1.8 },
    text: 'HFpEF left heart plus PVR above 2 WU. LAP above 15 mmHg raises PA pressure; the added PVR is a pre-capillary load. ESC/ERS 2022: combined post- and pre-capillary PH = PAWP > 15 mmHg and PVR > 2 WU.',
    refs: ['humbert2022', 'kawaguchi2003'],
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
