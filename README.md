# Ventricular–Arterial Coupling: Simulator and Tutorial

This is a teaching website for left ventricular–arterial (LV–Ea) and right ventricular–pulmonary arterial (RV–PA) coupling. It is written for medical students, residents, and fellows and attendings in pulmonary and critical care medicine. Each simulated pressure–volume loop is drawn over the normal ventricle so the reader can see what changed. The site also covers how echocardiography and the pulmonary artery catheter estimate coupling at the bedside.

The site is static HTML and JavaScript, so there is no server to maintain. It works on any device with a browser and is deployed with GitHub Pages.

## Pages

| Page | Content |
|---|---|
| `index.html` | Overview and a suggested learning path |
| `learn.html` | Concepts: the PV loop, Ees, Ea, Ea/Ees, stroke work and efficiency, RV vs LV, and how the model works |
| `advanced.html` | Advanced: pericardium, septal interdependence, c wave and base descent, relaxation τ, force–frequency, baroreflex, coronary perfusion, and valve lesions, each drawn on and off; seven advanced scenarios |
| `interfaces.html` | Shock as four interfaces (LV–arterial, arteriole–capillary, capillary–venular, RV–PA; Rola et al. 2025): critical closing pressure and tissue perfusion pressure, capillary refill, PCO₂ gap and the DO₂–VO₂ relation, Pmsf and venous return (Guyton figure from the model), congestion, and bedside calculators |
| `simulator.html` | LV, RV and side-by-side LV + RV simulator: valve-event marks (MVC/AVO/AVC/MVO, TVC/PVO/PVC/TVO) on loops and pressure strips, isovolumic phases slowed ×5, LA pressure strip (v wave, y descent), drag handles on the loop (Ees, afterload, preload), treatment sliders (fluid or volume removal, norepinephrine, arterial vasodilator, inotrope, pulmonary vasodilator; one standard dose each is the change the scenario texts describe, and the effect saturates), animated transitions, beat cursor with valve/phase strip, step-by-step "why did it move?" replay, normal-reference overlay, in-range-disease overlay, snapshot comparison, shareable URLs |
| `shock.html` | Shock lab: an accelerated clock (1 simulated minute per second, ×2, ×5) on which vasopressors, inotropes, vasodilators, pulmonary vasodilators and esmolol are infused with first-order kinetics, and crystalloid, red cells, bleeding and fluid removal change blood volume; bedside monitor, four-interface panel, live LV and RV loops, oxygen transport, trends and a flow–congestion (VTI–CVP) diagram, for nine patients including hemorrhagic, cardiogenic and obstructive shock and dynamic LVOT obstruction |
| `diastolic.html` | Diastolic dysfunction, the text: relaxation and chamber stiffness, pseudonormalization and the echocardiographic indices that resolve it, grades 0 to IV (grade IV being fixed restrictive filling), clinical thresholds, predict-then-test questions, and tolerance to volume, afterload and AF in a virtual cohort of 40 patients per grade. The questions load their case into the simulator window. |
| `diastolic-sim.html` | Diastolic simulator, to be opened beside the text. It has live model-generated mitral inflow, tissue Doppler and pulmonary venous Doppler, a PV loop, values and bedside consequences pinned while scrolling, controls for volume, afterload, sympathetic surge, a spontaneous breathing trial and AF, and the cohort charts and tables with the fluid-then-diuresis course. |
| `scenarios.html` | HFpEF (hypertensive and normotensive), HFrEF, septic vasoplegia, septic cardiomyopathy, acute afterload rise, compensated and decompensated PAH, acute PE and CpcPH |
| `echo.html` | Echo lab: model-generated PW Doppler (trace LVOT VTI), CW Doppler (TR peak velocity → PASP), M-mode (TAPSE) and RV volume frames (SV/ESV), with acquisition steps and pitfall toggles (Doppler angle, LVOT diameter, weak signal, IVC-based RAP); pressure overlays on each echo screen and an overview of what each station contributes |
| `pac.html` | Float-the-catheter tracing (RA → RV → PA → wedge, every scenario) or all four positions at once, on a sweep display with a catheter diagram; dotted guides for where each pressure is read and where that falls on the ECG; a question mode (drag a horizontal line to where you would read it); fluid (500 mL) and inhaled NO challenges with before/after tables; 6, 12 or 24 s on screen, slowed playback, and a vertical scale fitted to the site; artifacts: over/underdamping, transducer height, spontaneous, tachypneic and positive-pressure breathing; PA catheter indices (TPG, DPG, PVR, PAC, RC time, PAPi, single-beat Ees/Ea), with a hemodynamic calculator |
| `references.html` | Full bibliography with PubMed and DOI links |

## Exporting animations for slides

Every animation has an **Export for slides** menu: the simulator (current view, patient and speed), the annotated PV loop on the Concepts page, each echo screen, and the PA catheter tracing. Frames are rendered from the model one at a time, not screen-recorded, so each export is exactly one cycle and loops without a seam.

- **PowerPoint slide (.pptx):** a 16:9 slide with the animation, a caption, a link back to the exact model state, and speaker notes with the key values. The animation is an embedded GIF, which plays in PowerPoint on Windows, Mac, the web and mobile, in edit and slide-show view, with no click.
- **Animated GIF:** the same animation on its own (Insert → Pictures in PowerPoint, Keynote or Google Slides).
- **MP4 (H.264):** shown only in browsers that can encode H.264 through WebCodecs (current Chrome, Edge and Safari). Sharper than the GIF; in PowerPoint set Playback → Loop until stopped.

The GIF encoder (`site/js/gif.js`) has no dependencies. PptxGenJS and mp4-muxer are vendored in `site/vendor/` and load only when you export.

## Model

The model is a closed-loop lumped circulation with eight compartments, including two contracting atria. Each ventricle is a time-varying elastance with an exponential EDPVR:

```
P(V,t) = e(t)·Ees·(V − V0) + [1 − e(t)]·A·(exp(β(V − V0)) − 1)
```

Activation e(t) rises as a normalized double-Hill function, with time to peak 0.2 + 0.15·T s, and falls as a monoexponential with the relaxation time constant τ. The systemic and pulmonary arterial beds are three-element Windkessels (Zc, C, R). Each atrium is a time-varying elastance whose contraction starts at the P wave, 160 ms before ventricular activation, and lasts 140 ms. The venous compartments are passive compliances. The equations are integrated with fixed-step RK4 until the state changes by less than 0.05 mL per beat, and the recorded beat uses 0.5 ms steps. Ea is measured from the simulated beat as Pes/SV, with Pes taken at peak elastance. It is not an input.

The ESPVR, EDPVR and Ea line drawn on the loops are the chamber's relations, not the free-wall equation above: `pvRelations()` in `engine.js` sweeps the ventricle's volume through the model's own pressure equations (septum and pericardium included), fully activated with the other chambers held at their end-systolic volumes for the ESPVR, and fully relaxed with them held at their end-diastolic volumes for the EDPVR. The end-systolic point therefore lies on the ESPVR and the end-diastolic point on the EDPVR, except when relaxation is still incomplete at the QRS, which the simulator labels. Pericardial pressure continues linearly above 50 mmHg, and the baroreflex does not raise the heart rate above 160/min (or the intrinsic rate if higher), so large slider changes stay stable. A fully activated wall is never more compliant than a relaxed one: the end-systolic pressure is at least the passive pressure at the same volume, so however low Ees is set on a stiff or overfilled ventricle the ESPVR meets the EDPVR rather than falling below it. If a beat still goes non-finite (an extreme resistance), the engine restarts from a relaxed state with half the time step, and a parameter set with no finite circulation is flagged `failed`; the simulator then keeps the last good state.

Seven mechanisms are on by default and each can be switched off (`site/advanced.html` explains each):

| Mechanism | Representation |
|---|---|
| Pericardium | Exponential pressure–volume relation of the whole heart, added to all four chambers; pericardial fluid for tamponade |
| Septal interdependence | Time-varying septal elastance between the ventricles, solved by Newton iteration at every step (after Smith et al. 2004) |
| c wave and base descent | Effective atrial volume changes with leaflet bulging and with AV-plane descent during ventricular activation |
| Relaxation time constant | Monoexponential fall of activation with τ; the reported τ is fitted to the isovolumic pressure decline |
| Force–frequency relation | Ees × (1 + kFFR·(HR − 70)/70), flat in the HFrEF scenario |
| Baroreflex | Sigmoid on MAP acting on HR, Ees, SVR and venous tone (after Ursino 1998); set point is the normal MAP, reset in chronic hypertension |
| Coronary perfusion | Supply (perfusion-pressure integral × flow reserve) against demand (Suga's PVA); a deficit depresses Ees |

Valve lesions (aortic stenosis, and mitral, aortic and tricuspid regurgitation) are orifice flows from ΔP = 4v². Dynamic LVOT obstruction (`lvoto`) narrows the outflow orifice as the contracting LV empties below a critical volume. The engine also reports the mean systemic filling pressure (the pressure of the systemic stressed volume with flow stopped), the venous return gradient Pmsf − RAP and the resistance to venous return, and the whole-circulation stop-flow pressure (Pmcf).

The Shock lab adds three modules on top of the engine. `pharm.js` gives each drug a half-life and Emax effects on SVR, Ees, heart rate, venous tone, PVR, τ and critical closing pressure; the sizes are illustrative. `oxygen.js` holds the Fick relations (DO₂, supply-dependent VO₂ with a critical extraction of 0.6, ScvO₂, PCO₂ gap) and illustrative lactate, capillary refill and critical closing pressure functions. `shockcore.js` holds the patients, fluid kinetics (crystalloid: 18% retained, the rest leaving with τ 10 min, faster with a capillary leak), bleeding with transcapillary refill, and re-solves the circulation from a warm start at every tick.

### Normal calibration (tests/engine.test.mjs checks each; tests/quoted_numbers.test.mjs checks every number quoted in the text)

| Quantity | Model | Target / source |
|---|---|---|
| LV EF | 57% | 50–65% |
| BP | 117/71 mmHg | resting adult |
| CO | 5.6 L/min | resting adult |
| LAP | 7 mmHg | resting adult |
| LV Ea/Ees | 0.62 | Ees/Ea 1.62 in normal human hearts (Starling 1993) |
| mPAP | 13 mmHg | 14.0 ± 3.3 mmHg (Kovacs 2009) |
| PVR | 1.2 WU | < 2 WU (ESC/ERS 2022) |
| RV Ees/Ea | 2.0 | 1.5–2 (Tello 2019) |
| τ | 36 ms | 35 ± 10 ms in controls (Zile 2004) |
| Baroreflex | neutral at MAP 96 mmHg | set point |
| Coronary supply / demand | 5 | flow reserve |

Scenario parameter sets are synthetic. They were chosen to reproduce the direction and approximate size of the changes reported in the cited studies. They are not patient data or treatment targets.

### Diastolic lab and its virtual cohort

`diastcore.js` defines grades 0–IV as parameter sets on the same engine: grade by grade, a longer relaxation time constant, a steeper EDPVR, a larger and stiffer LA (whose contraction first strengthens and then fails), more stressed volume, stiffer arteries and, in the late grades, a higher PVR. The engine gains three opt-in parameters, all 0 by default so every other page is unchanged. `mvArea` is a Bernoulli orifice on mitral inflow; the lab sets it to 4 cm², which gives a normal E of 89 cm/s and a deceleration time of 226 ms. `laPiso` and `laKej` limit LA contraction: a length–tension plateau on the pressure the atrium develops, and a force–velocity limit, an internal resistance proportional to developed pressure while the atrium empties (the ejection effect described for the LV by Shroff 1983). Without them the atrial kick grows in proportion to atrial stretch: in the grade I patient during the breathing trial, A reaches 167 cm/s with a linear atrium and 124 cm/s with the limits. A late-diastolic mitral wave with no deceleration between E and A is reported as merged and is not graded by E/A. The breathing trial (`sbt`) adds 500 mL to the stressed volume, sets the sinus rate to 85/min and lowers SVR by 20% with the baroreflex open. Mitral and pulmonary venous velocities are model flows divided by an orifice area. The lateral e′ is not simulated: it is scaled from the fitted τ (12 × 36/τ cm/s). The echo is graded with the ASE/EACVI 2016 algorithm, applied to lateral e′ and lateral E/e′.

The cohort is generated offline, because each patient takes about 2 s to run through its 30 conditions:

```sh
node tools/diastolic_cohort.mjs 40 2026   # N per grade, seed; about 100 s on 4 cores
Rscript R/diastolic_microsim.R            # figures and tables from the CSVs, in R/outputs/
```

The generator writes `site/js/diastdata.js` (read by the page) and `R/diastolic_cohort_long.csv`, `R/diastolic_cohort_summary.csv` and `R/diastolic_course.csv`. `tests/diastolic.test.mjs` fails if the shipped data no longer match the code, so rerun the generator after changing `diastcore.js` or the engine.

## Writing rules

`CLAUDE.md` holds the rules for all prose on the site, with model paragraphs. Every number that the text quotes from the model is recomputed in a test.

## Verifying the numbers

```sh
node tests/engine.test.mjs          # calibration, conservation, ESPVR recovery, mechanisms, scenario and quoted-number checks
node tests/shock.test.mjs           # drug directions and kinetics, Fick identities, venous return, LVOT obstruction, course of each shock case
node tests/diastolic.test.mjs       # echo pattern of each grade, reversibility, tolerance directions, quoted numbers, cohort data current
```

## Evidence

Every reference was checked against its PubMed record: PMID, title, authors, journal, year, pages and DOI. Every number quoted from a source was checked against its abstract or PMC full text. A few statements could only be checked against the bibliographic record, because the source has no open abstract or text. These are the ESC/ERS 2022 hemodynamic definitions and TAPSE/sPAP risk thresholds, the ASE recommendations, the ASE/EACVI 2016 diastolic cutoffs, the four-grade scheme with a fixed restrictive grade IV (Nishimura 1997, whose abstract does not list the grades), Guyton and Lindsey 1959 (no abstract; cited only for the dependence of the edema threshold on plasma protein, which its title states) and the ESC 2019 PE guideline. They are flagged on `references.html`.

## Running locally

```sh
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

## Deployment

`.github/workflows/pages.yml` runs the engine tests on every push and pull request, and deploys `site/` to GitHub Pages on pushes to `main`. Two one-time settings are needed:

1. The repository must be public, unless the account has a plan that allows Pages on private repositories.
2. In Settings → Pages → Build and deployment, set Source to **GitHub Actions**.

## Design

All colors are defined in `site/css/tokens.css`. MCW green (`#2F6E66`) and navy (`#0E2B73`) were sampled from the mcw.edu header. Replace them there if MCW Marketing supplies official values. Light and dark themes follow the system setting, and the header has a manual toggle.

This project is not an official Medical College of Wisconsin publication.
