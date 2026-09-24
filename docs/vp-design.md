# Flow propagation velocity (Vp) in the Diastolic lab: design proposal

Status: proposal. Nothing on the site changes yet. Every model number below is printed by `node tools/vp_explore.mjs` (about 2 s). Every number quoted from a study was checked against its PubMed abstract. References are at the end.

## Recommendation

Add color M-mode flow propagation velocity (Vp) to the Diastolic lab as a scaled surrogate, the same way the lab already handles lateral e′. The surrogate uses two determinants: the fitted τ and the ejection fraction. Mitral E and mean LA pressure still come from the engine, so the relation between E/Vp and LA pressure is computed rather than written in. That relation is what the reader needs to test.

Vp should not go into the grade table or the grading algorithm, because it is not part of the ASE/EACVI 2016 algorithm. Its place is a new section on estimating LV filling pressure at the bedside in the ICU. That section would show where E/Vp tracks mean LA pressure (the dilated, poorly emptying ventricle) and where it fails (the small, hyperdynamic ventricle and the patient on an inotrope). It would also cover the patient in whom annular velocities cannot be used. The evidence for that last use is indirect.

I tried two mechanistic formulations first, and both reproduce the wrong physiology. They are described below, because they show why a lumped model cannot produce Vp by itself.

## Physiology and measurement

Vp is the slope of the leading edge of early diastolic inflow on a color M-mode recording aligned from the mitral valve to the apex. It is usually measured on the first aliasing isovelocity contour, from the mitral valve plane to about 4 cm into the cavity. The Nyquist limit is lowered so that the central jet aliases. The recorded velocity is the velocity of the inflow jet along one scan line. It is not a pressure wave, and it is not the mean velocity across the cavity. In an axisymmetric Navier–Stokes model, the propagation of the vortex that forms behind the mitral leaflets set the propagation of the maximal velocity on the simulated color M-mode (Vierendeels 2002).

How fast that front advances depends on the early diastolic intraventricular pressure gradient, which draws blood toward the apex. Microembolization in dogs lengthened τ from 31 to 49 ms and lowered the mitral-to-apex gradient from 1.9 to 0.7 mmHg. It also lengthened the delay of apical filling from 5 to 57 ms (Steine 1999). In patients with dilated cardiomyopathy, the peak gradient derived from color M-mode was 1.2 ± 0.6 mmHg, against 2.5 ± 0.8 mmHg in controls (Yotti 2005). The gradient comes from active relaxation and from restoring forces released as the ventricle recoils from a small end-systolic volume. Vp therefore depends on systolic as well as diastolic function.

The clinical data reflect both determinants:

- **Relaxation.** Vp correlated with τ (r = 0.78 in dogs, 0.86 in patients; Garcia 2000). It was about 34 and 30 cm/s in patients with an EF below 60%, against 74 cm/s in controls (Takatsuji 1996).
- **Systolic performance.** Among 150 patients, LV end-systolic volume index (ESVI) explained 46% of the variance of Vp, τ 3% and PCWP 2% (Ohte 2001). Vp fell steeply with ESVI up to 41 mL/m² and less steeply above that value.
- **Preload.** It depends on EF.
  - In reduced-EF ventricles, Vp changed little. During IVC occlusion or partial bypass, E fell from 69 to 53 cm/s while Vp went from 37 to 34 cm/s, which was not significant (Garcia 2000).
  - With an EF above 50%, hemodialysis lowered Vp (Lin 2005). In hemodialysis patients overall, ultrafiltration lowered Vp from 45 to 41 cm/s (Vignon 2007).
- **Inotropic stimulation.** Low-dose dobutamine raised Vp from 45 to 59 cm/s. E, E/A and E/Em did not change, and DT and IVRT shortened (Görgülü 2004).

As a measurement, Vp is less reproducible than e′. Interobserver variability was 14% for Vp and 7% for e′ (Kidawa 2005). Studies that used different methods reported values varying by as much as 250% (Sessoms 2002). In critically ill patients, E/Vp could be obtained in 72%, against 92% for E/Ea (Pieri 2004).

## Use at the bedside, and the ICU evidence

E/Vp rests on the same reasoning as E/e′. Mitral E rises with mean LA pressure and falls as relaxation slows. Dividing E by a surrogate for relaxation leaves a quantity that varies with LA pressure. The original description was in 45 ICU patients with invasive monitoring:

- E/Vp: r = 0.80 with PCWP; PCWP = 5.27 × E/Vp + 4.6, SEE 3.1 mmHg (Garcia 1997).
- E alone: r = 0.62.
- Vp alone: r = −0.34.

Later ICU studies were less favorable.

| Study | Patients | Finding |
|---|---|---|
| Alegret 2002 | 32, cardiac ICU | E/Vp against PWP r = 0.58. Six patients with restrictive filling and preserved systolic function had a Vp of 71 ± 15 cm/s, against 37 ± 10 in the rest, and their PWP was largely underestimated. Excluding them gave r = 0.72. |
| Bouhemad 2003 | 60 ventilated patients with septic shock and acute lung injury (TEE) | Mean bias 0.4 ± 2.2 mmHg for E/Ea and 0.1 ± 2.9 mmHg for E/Vp. Changes in PCWP correlated with changes in E/Ea (ρ = 0.84). |
| D'Souza 2005 | 50 ICU patients | E/Vp against PCWP r = 0.05 with normal septal motion and 0.17 with abnormal septal motion. Lateral E/Ea: r = 0.86 and 0.36. |
| Kidawa 2005 | 71 at catheterization (not ICU) | E/Vp against LVEDP r = 0.77 with EF < 50% and 0.41 (not significant) with normal EF. |
| Vignon 2008 | 88 ventilated patients (TEE) | For PAOP ≤ 18 mmHg, E/Vp ≤ 1.7 had sensitivity 80% and specificity 100%; lateral E/E′ ≤ 8.0 had 83% and 88%. The AUCs were 0.92 and 0.91, and neither differed from the pulsed-wave indices. |
| Papanikolaou 2011 | 50 at a spontaneous breathing trial | For weaning failure, E/Vp > 1.51 had an AUC of 0.74 and lateral E/Em > 7.8 an AUC of 0.86. Only E/Em was independently associated. |
| Bhella 2011 | 47 with PCWP varied from 0.8 to 28.8 mmHg | Individual slopes of PCWP against E/Vp ranged from −16.4 to 25.4, so E/Vp did not track change within a subject. |
| Licker 2010 | 94 before aortic valve replacement | A Vp of 40 cm/s or less predicted LV dysfunction on weaning from cardiopulmonary bypass (sensitivity 72%, specificity 94%). |

In these studies, E/Vp was never better than lateral E/e′. It was less often obtainable and less reproducible. It failed where preserved EF, hyperdynamic function or catecholamines raise Vp independently of LA pressure, and those are common in septic ICU patients. Three uses are defensible.

1. **Filling pressure in the dilated, poorly emptying ventricle.** Vp is least load-dependent there, and E/Vp correlated with filling pressure (Kidawa 2005).
2. **Vp as a marker of global LV dysfunction.** Licker 2010 is the example.
3. **A fallback when annular velocities cannot be used,** such as mitral annular calcification, an annuloplasty ring or regional dysfunction at the annulus. This use is argued rather than shown. The literature review found no study of Vp in annular calcification or after annuloplasty. Abnormal septal motion degraded E/Vp as badly as E/e′ (D'Souza 2005).

The ASE/EACVI 2016 recommendations, the 2009 recommendations and the 2025 ASE update could be checked only against their bibliographic records. None of their statements on Vp has been verified. The E/Vp ≥ 2.5 cutoff that is often attributed to them did not appear in any abstract retrieved; the cutoffs in the studies above were 1.51, 1.7 and 2. The abstract of the 2025 update does not mention Vp. None of these statements should reach the site until the full texts are checked.

## Why the engine cannot produce Vp by itself

The engine represents the LV as one compartment with no long axis, so it has mitral flow over time but no distribution of that flow along the cavity. Two ways of adding one were tried (Table 1, columns A and B).

### Axial model (column A)

The cavity is cut into slices from the mitral plane to the apex. Each slice obeys the engine's wall law, and each is joined to the next by the inertance of the blood between them. The base is filled by the engine's mitral flow.

In this model, flow reaches the apex as a pressure wave. Its speed is √(V·(dP/dV)/ρ), so it rises with chamber stiffness. The computed "Vp" therefore rose from 56 cm/s in the normal ventricle to 234 cm/s in grade IV and was 257 cm/s in HFrEF. In patients, the order is the opposite. The measured propagation is not a pressure wave in a compliant chamber.

### Jet front (column B)

Blood enters at the mitral tips with the engine's inflow velocity. Faster blood that overtakes slower blood merges with it, which is the inviscid form of vortex-ring formation. A free front of this kind advances at about half the jet velocity. Vp therefore scaled with E:

- E/Vp ranged from 1.30 to 1.85 across the cases and did not rise with mean LA pressure (1.55 in the normal ventricle, 1.49 in grade IV).
- In HFrEF, Vp rose from 42 to 59 cm/s between 1 L removed and 1 L added, as E rose from 55 to 83 cm/s. This is the load dependence that Garcia 2000 did not find in reduced-EF ventricles.

Adding an intraventricular pressure gradient taken from the engine's LV pressure changed Vp by 3.6 cm/s at most.

This front reproduces only the diseased pattern. In dogs before ischemia, mitral-to-apical flow propagation "far exceeded the velocity of the individual blood cells". During ischemia it approximated the blood velocity, which the authors described as a shift from column motion to convection (Steine 1999).

### What is missing

What makes Vp informative in patients is wall-driven suction. Relaxation and recoil move blood toward the apex ahead of the jet, and how much they do so depends on τ and on end-systolic volume. The engine has neither regional wall mechanics nor restoring forces below an equilibrium volume. The EDPVR reaches zero pressure only at V0 = 10 mL. Adding both would be a research project of its own, and its parameters would still be calibrated to the same studies.

## Proposed model

### The surrogate

```
Vp = (τN / τ) · [c0 + c1 · max(0, EF − 30%)]      τN = 36 ms, c0 = 45 cm/s, c1 = 0.93 cm/s per % EF
```

The first factor makes Vp fall in proportion to the fitted τ, as the Vp–τ correlations describe (Garcia 2000; Takatsuji 1996). The bracket adds a restoring-force term that grows with EF. It follows Ohte's finding that systolic performance dominates, and it raises Vp in the ventricle that empties well.

The constants are set by two anchors:

- c0 gives the dilated HFrEF preset (EF 22%, τ 43 ms) a Vp of 38 cm/s, in the range of reduced-EF patients (37 ± 12 cm/s, Garcia 2000).
- c1 gives the normal ventricle 69 cm/s, near the control values of 74 ± 17 cm/s (Takatsuji 1996) and 84 ± 11 cm/s (Brun 1992).

The formula encodes three things: the dependence on τ, the dependence on EF, and Vp's independence of preload at a fixed τ and EF. Everything else about E/Vp is computed: E, mean LA pressure, and the τ and EF that the engine produces under each intervention.

**Table 1.** Model state and the three candidate Vp values (cm/s).

| Case | τ, ms | ESVI, mL/m² | EF, % | Mean LAP, mmHg | E, cm/s | A: axial | B: free jet | B: jet with gradient | C: surrogate |
|---|---|---|---|---|---|---|---|---|---|
| Normal | 36 | 31 | 57 | 7.1 | 90 | 56 | 58 | 61 | 69 |
| Grade I | 68 | 28 | 57 | 8.2 | 72 | 63 | 45 | 48 | 37 |
| Grade II | 73 | 27 | 56 | 16.3 | 82 | 107 | 51 | 55 | 34 |
| Grade III | 76 | 22 | 55 | 21.2 | 77 | 149 | 51 | 54 | 32 |
| Grade IV | 80 | 20 | 53 | 29.5 | 80 | 234 | 53 | 57 | 30 |
| Normal, −1 L | 36 | 24 | 55 | 2.9 | 59 | 31 | 42 | 44 | 68 |
| Normal, +1 L | 38 | 33 | 57 | 12.5 | 108 | 72 | 68 | 71 | 67 |
| Normal, inotrope | 36 | 25 | 64 | 7.1 | 95 | 50 | 60 | 63 | 77 |
| HFrEF | 43 | 97 | 22 | 14.2 | 74 | 257 | 54 | 54 | 38 |
| HFrEF, −1 L | 40 | 86 | 20 | 7.4 | 55 | 134 | 42 | 43 | 40 |
| HFrEF, +1 L | 46 | 100 | 23 | 21.2 | 83 | 266 | 59 | 60 | 35 |
| HFrEF, inotrope | 40 | 88 | 27 | 13.5 | 90 | 248 | 61 | 63 | 41 |
| Septic cardiomyopathy | 38 | 44 | 41 | 7.3 | 77 | 72 | 53 | 56 | 52 |
| Septic CM, +1 L | 41 | 49 | 42 | 13.9 | 100 | 115 | 65 | 68 | 49 |
| Septic CM, inotrope | 37 | 35 | 50 | 6.9 | 85 | 57 | 56 | 59 | 62 |
| Vasoplegia | 36 | 15 | 74 | 4.4 | 80 | 35 | 50 | 54 | 86 |
| Vasoplegia, τ 60 ms | 61 | 14 | 73 | 5.4 | 76 | −1 | 41 | 44 | 50 |

Volume changes are intravascular, 40% of which becomes stressed volume, as elsewhere in the lab. "Inotrope" is the simulator's standard dose: Ees × 1.35, heart rate +10/min, SVR × 0.9.

**Table 2.** Surrogate C: E/Vp, E/e′ and mean LA pressure.

| Case | Mean LAP, mmHg | Vp, cm/s | E/Vp | PCWP from E/Vp (Garcia 1997), mmHg | E/e′ | PCWP from E/e′ (Nagueh 1997), mmHg |
|---|---|---|---|---|---|---|
| Normal | 7.1 | 69 | 1.29 | 11.4 | 7.6 | 11.3 |
| Grade I | 8.2 | 37 | 1.94 | 14.8 | 11.3 | 15.9 |
| Grade II | 16.3 | 34 | 2.41 | 17.3 | 14.0 | 19.2 |
| Grade III | 21.2 | 32 | 2.39 | 17.2 | 13.6 | 18.7 |
| Grade IV | 29.5 | 30 | 2.64 | 18.5 | 14.7 | 20.1 |
| Normal, −1 L | 2.9 | 68 | 0.86 | 9.1 | 4.9 | 8.0 |
| Normal, +1 L | 12.5 | 67 | 1.61 | 13.1 | 9.5 | 13.7 |
| Normal, inotrope | 7.1 | 77 | 1.25 | 11.2 | 8.0 | 11.8 |
| HFrEF | 14.2 | 38 | 1.94 | 14.8 | 7.3 | 10.9 |
| HFrEF, −1 L | 7.4 | 40 | 1.36 | 11.8 | 5.1 | 8.2 |
| HFrEF, +1 L | 21.2 | 35 | 2.37 | 17.1 | 8.9 | 12.9 |
| HFrEF, inotrope | 13.5 | 41 | 2.21 | 16.3 | 8.3 | 12.2 |
| Septic cardiomyopathy | 7.3 | 52 | 1.48 | 12.4 | 6.9 | 10.4 |
| Septic CM, +1 L | 13.9 | 49 | 2.04 | 15.4 | 9.5 | 13.7 |
| Septic CM, inotrope | 6.9 | 62 | 1.38 | 11.9 | 7.3 | 11.0 |
| Vasoplegia | 4.4 | 86 | 0.92 | 9.5 | 6.6 | 10.1 |
| Vasoplegia, τ 60 ms | 5.4 | 50 | 1.51 | 12.5 | 10.7 | 15.2 |

### What the surrogate does well

- **Volume changes in the dilated ventricle.** In HFrEF, Vp stays between 35 and 40 cm/s while E follows volume, so E/Vp rises from 1.36 to 2.37 as mean LA pressure rises from 7 to 21 mmHg. The same holds in septic cardiomyopathy with EF 41%: a liter raises E/Vp from 1.48 to 2.04 and mean LA pressure from 7 to 14 mmHg.
- **The hyperdynamic pitfall.** A hyperdynamic ventricle with slow relaxation (vasoplegia with τ set to 60 ms) keeps a Vp of 50 cm/s. Lateral e′ in the same patient is 7.1 cm/s. In the model, e′ therefore shows the slow relaxation and Vp does not.
- **The inotrope pitfall.** The inotrope raises Vp in septic cardiomyopathy from 52 to 62 cm/s with mean LA pressure unchanged.
- **Underestimation at high pressures.** In grades III and IV, the Garcia regression gives 17 to 19 mmHg against a mean LA pressure of 21 to 30 mmHg. The lab already describes this failure for E/e′.

### Four weaknesses

- **Preload independence is overstated with a preserved EF.** Vp does not change when 1 L is removed from the normal ventricle (69 against 68 cm/s). Patients with an EF above 50% show a fall (Lin 2005; Vignon 2007). The lab already states the same limitation for e′ (Opdahl 2009).
- **The E/e′ comparison in HFrEF is distorted.** Lateral e′ is scaled from τ alone, and the HFrEF preset has a τ of only 43 ms, so its e′ is 10 cm/s, too high for a dilated ventricle with an EF of 22%. E/e′ therefore underestimates mean LA pressure in HFrEF (12.9 against 21.2 mmHg with a liter added), while E/Vp comes closer. A reader would conclude that E/Vp outperforms E/e′ in reduced EF for a reason that exists only in the model. Either e′ needs a dependence on systolic function (patients with low EF have low e′) or the HFrEF preset needs a longer τ, before the two indices are compared on the page.
- **The inotrope has no effect on relaxation.** The simulator's inotrope raises Ees but leaves τ unchanged. In HFrEF it raises E from 74 to 90 cm/s while mean LA pressure falls slightly, so E/Vp rises from 1.94 to 2.21 in the wrong direction. Dobutamine shortened DT and IVRT in patients (Görgülü 2004), and in the Shock lab only milrinone shortens τ. A lusitropic effect for the inotrope would correct this, but it changes the numbers quoted on other pages.
- **One of Ohte's findings is not reproduced.** Ohte's end-systolic volume index form of the restoring-force term (Table 3 in the script output) reproduces Alegret's high Vp in the restrictive ventricle with preserved EF (44 cm/s in grades III and IV). In the engine, however, removing a liter from the normal ventricle lowers ESV, and with this form Vp would rise from 69 to 88 cm/s, which is opposite to the patient data. The EF form avoids that artifact, and I recommend it for that reason. The cost is that the model will not reproduce Alegret's finding.

## Display and measurement

The color M-mode should be drawn from the model's mitral velocity curve E(t) and the surrogate Vp. The velocity at depth x and time t is the mitral velocity delayed by x/Vp and attenuated with depth, and it is shown with color aliasing at a Nyquist limit the reader can set. The first aliasing contour then has the slope Vp over the first 4 cm.

The reader measures the slope by dragging a line, as in the question mode of the PA catheter page, and the page reports the measured value next to the model's. The display derives from Vp and cannot be used to validate it. Its purpose is the measurement:

- where the slope is taken;
- which contour is used;
- how the Nyquist setting and cursor alignment change the result.

## An ICU section

The section would use presets that already exist, with the lab's mitral orifice switched on. The cases, and the result the reader would see in each:

- **Septic cardiomyopathy, fluid challenge.** E/Vp rises with mean LA pressure while Vp stays near 50 cm/s. This is the setting in which E/Vp behaves as intended.
- **HFrEF across the volume sweep.** The same behavior over a wider range of LA pressure. It needs the e′ correction above before E/e′ is shown beside it.
- **Hyperdynamic vasoplegia with impaired relaxation.** Vp is in the normal range and e′ is reduced.
- **Inotrope in septic cardiomyopathy.** Vp rises with no change in LA pressure.
- **Grades III and IV.** E/Vp and E/e′ both underestimate mean LA pressure.
- **Annular velocities unavailable.** A switch marks e′ as unmeasurable, as with annular calcification, an annuloplasty ring or abnormal septal motion after cardiac surgery. The page then offers E/Vp and states that its use there is inferred rather than studied.
- **Atrial fibrillation.** E and Vp are averaged over the irregular beats, as the lab already averages E and e′. In AF, E/Vp correlated with filling pressure (r = 0.65, Nagueh 1996).

The consequences panel already covers congestion, low output and hypotension, so each case can connect the index to a bedside decision: give fluid, stop fluid or remove it.

## Tests to add with the model

- Vp falls as τ lengthens at a fixed EF, and rises with EF at a fixed τ.
- In the reduced-EF presets, Vp stays within 10% of its baseline value with 1 L removed or added, while E changes by more than 20% (Garcia 2000).
- Within the HFrEF and septic cardiomyopathy volume sweeps, E/Vp rises with every rise in mean LA pressure.
- The inotrope raises Vp in every preset.
- Every Vp, E/Vp and derived number quoted in the page text is recomputed, as for the existing lab.

## Decisions for you

1. The EF form of the restoring-force term, or the ESVI form. Both are described above.
2. Whether the inotrope should shorten τ, knowing that this moves numbers quoted on the simulator and scenario pages.
3. Whether to give e′ a dependence on systolic function, or lengthen τ in the HFrEF preset, so that E/e′ and E/Vp can be compared honestly.
4. Where the section goes: in `diastolic.html` after the clinical thresholds, or on its own page that the diastolic simulator also serves.
5. Whether the guideline statements on Vp are worth a library request for the full texts, since none could be verified.

## References

Each PMID was checked on PubMed.

- Alegret JM, et al. Restrictive left ventricular filling and preserved ventricular function: a limitation in the noninvasive estimation of pulmonary wedge pressure by Doppler echocardiography. J Am Soc Echocardiogr 2002;15:334–8. PMID 11944011. doi:10.1067/mje.2002.118527
- Bhella PS, et al. Echocardiographic indices do not reliably track changes in left-sided filling pressure in healthy subjects or patients with heart failure with preserved ejection fraction. Circ Cardiovasc Imaging 2011;4:482–9. PMID 21788358. doi:10.1161/CIRCIMAGING.110.960575
- Bouhemad B, et al. Echocardiographic Doppler assessment of pulmonary capillary wedge pressure in surgical patients with postoperative circulatory shock and acute lung injury. Anesthesiology 2003;98:1091–100. PMID 12717130. doi:10.1097/00000542-200305000-00011
- Brun P, et al. Left ventricular flow propagation during early filling is related to wall relaxation: a color M-mode Doppler analysis. J Am Coll Cardiol 1992;20:420–32. PMID 1634681. doi:10.1016/0735-1097(92)90112-z
- D'Souza KA, et al. Abnormal septal motion affects early diastolic velocities at the septal and lateral mitral annulus, and impacts on estimation of the pulmonary capillary wedge pressure. J Am Soc Echocardiogr 2005;18:445–53. PMID 15891754. doi:10.1016/j.echo.2005.01.005
- Garcia MJ, et al. An index of early left ventricular filling that combined with pulsed Doppler peak E velocity may estimate capillary wedge pressure. J Am Coll Cardiol 1997;29:448–54. PMID 9015003. doi:10.1016/s0735-1097(96)00496-2
- Garcia MJ, et al. Color M-mode Doppler flow propagation velocity is a preload insensitive index of left ventricular relaxation: animal and human validation. J Am Coll Cardiol 2000;35:201–8. PMID 10636281. doi:10.1016/s0735-1097(99)00503-3
- Görgülü S, et al. Assessing the effect of low dose dobutamine on various diastolic function indexes. Anadolu Kardiyol Derg 2004;4:227–30. PMID 15355825
- Kidawa M, et al. Comparative value of tissue Doppler imaging and m-mode color Doppler mitral flow propagation velocity for the evaluation of left ventricular filling pressure. Chest 2005;128:2544–50. PMID 16236921. doi:10.1378/chest.128.4.2544
- Licker M, et al. Preoperative diastolic function predicts the onset of left ventricular dysfunction following aortic valve replacement in high-risk patients with aortic stenosis. Crit Care 2010;14:R101. PMID 20525242. doi:10.1186/cc9040
- Lin SK, et al. Color M-mode flow propagation velocity: is it really preload independent? Echocardiography 2005;22:636–41. PMID 16174116. doi:10.1111/j.1540-8175.2005.40078.x
- Nagueh SF, Kopelen HA, Quiñones MA. Assessment of left ventricular filling pressures by Doppler in the presence of atrial fibrillation. Circulation 1996;94:2138–45. PMID 8901664. doi:10.1161/01.cir.94.9.2138
- Ohte N, et al. Striking effect of left ventricular systolic performance on propagation velocity of left ventricular early diastolic filling flow. J Am Soc Echocardiogr 2001;14:1070–4. PMID 11696830. doi:10.1067/mje.2001.114136
- Papanikolaou J, et al. New insights into weaning from mechanical ventilation: left ventricular diastolic dysfunction is a key player. Intensive Care Med 2011;37:1976–85. PMID 21976188. doi:10.1007/s00134-011-2368-0
- Pieri B, et al. [Novel Doppler indexes of estimation of pulmonary capillary pressure: influence of age, feasibility in the acute setting and reproducibility]. Ann Cardiol Angeiol 2004;53:314–9. PMID 15603173. doi:10.1016/j.ancard.2004.09.008
- Sessoms MW, Lisauskas J, Kovács SJ. The left ventricular color M-mode Doppler flow propagation velocity V(p): in vivo comparison of alternative methods including physiologic implications. J Am Soc Echocardiogr 2002;15:339–48. PMID 11944012. doi:10.1067/mje.2002.117899
- Steine K, Stugaard M, Smiseth OA. Mechanisms of retarded apical filling in acute ischemic left ventricular failure. Circulation 1999;99:2048–54. PMID 10209011. doi:10.1161/01.cir.99.15.2048
- Takatsuji H, et al. A new approach for evaluation of left ventricular diastolic function: spatial and temporal analysis of left ventricular filling flow propagation by color M-mode Doppler echocardiography. J Am Coll Cardiol 1996;27:365–71. PMID 8557907. doi:10.1016/0735-1097(96)81240-x
- Vierendeels JA, Dick E, Verdonck PR. Hydrodynamics of color M-mode Doppler flow wave propagation velocity V(p): a computer study. J Am Soc Echocardiogr 2002;15:219–24. PMID 11875384. doi:10.1067/mje.2002.115456
- Vignon P, et al. Diagnosis of left ventricular diastolic dysfunction in the setting of acute changes in loading conditions. Crit Care 2007;11:R43. PMID 17428322. doi:10.1186/cc5736
- Vignon P, et al. Echocardiographic assessment of pulmonary artery occlusion pressure in ventilated patients: a transoesophageal study. Crit Care 2008;12:R18. PMID 18284668. doi:10.1186/cc6792
- Yotti R, et al. A noninvasive method for assessing impaired diastolic suction in patients with dilated cardiomyopathy. Circulation 2005;112:2921–9. PMID 16275881. doi:10.1161/CIRCULATIONAHA.105.561340

Checked only against the bibliographic record: Nagueh SF, et al. J Am Soc Echocardiogr 2016;29:277–314 (PMID 27037982); Nagueh SF, et al. J Am Soc Echocardiogr 2009;22:107–33 (PMID 19187853). The 2025 ASE update (J Am Soc Echocardiogr 2025;38:537–69, PMID 40617625) was checked against its abstract only.
