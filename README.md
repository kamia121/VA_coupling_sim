# Ventricular–Arterial Coupling: Simulator and Tutorial

This is a teaching website for left ventricular–arterial (LV–Ea) and right ventricular–pulmonary arterial (RV–PA) coupling. It is written for medical students, residents, and fellows and attendings in pulmonary and critical care medicine. Each simulated pressure–volume loop is drawn over the normal ventricle so the reader can see what changed. The site also covers how echocardiography and the pulmonary artery catheter estimate coupling at the bedside.

The site is static HTML and JavaScript, so there is no server to maintain. It works on any device with a browser and is deployed with GitHub Pages.

## Pages

| Page | Content |
|---|---|
| `index.html` | Overview and a suggested learning path |
| `learn.html` | Concepts: the PV loop, Ees, Ea, Ea/Ees, stroke work and efficiency, RV vs LV, and how the model works |
| `advanced.html` | Advanced: pericardium, septal interdependence, c wave and base descent, relaxation τ, force–frequency, baroreflex, coronary perfusion, and valve lesions, each drawn on and off; seven advanced scenarios |
| `simulator.html` | LV, RV and side-by-side LV + RV simulator: valve-event marks (MVC/AVO/AVC/MVO, TVC/PVO/PVC/TVO) on loops and pressure strips, isovolumic phases slowed ×5, LA pressure strip (v wave, y descent), drag handles on the loop (Ees, afterload, preload), intervention buttons, animated transitions, beat cursor with valve/phase strip, step-by-step "why did it move?" replay, normal-reference overlay, in-range-disease overlay, snapshot comparison, shareable URLs |
| `scenarios.html` | HFpEF, HFrEF, septic vasoplegia, septic cardiomyopathy, acute afterload rise, compensated and decompensated PAH, acute PE and CpcPH |
| `echo.html` | Echo lab: model-generated PW Doppler (trace LVOT VTI), CW Doppler (TR peak velocity → PASP), M-mode (TAPSE) and RV volume frames (SV/ESV), with acquisition steps and pitfall toggles (Doppler angle, LVOT diameter, weak signal, IVC-based RAP); pressure overlays on each echo screen and an overview of what each station contributes |
| `pac.html` | Float-the-catheter tracing (RA → RV → PA → wedge, every scenario) with artifacts: over/underdamping, transducer height, spontaneous and positive-pressure breathing; PA catheter indices (TPG, DPG, PVR, PAC, RC time, PAPi, single-beat Ees/Ea), with a hemodynamic calculator |
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

Valve lesions (aortic stenosis, and mitral, aortic and tricuspid regurgitation) are orifice flows from ΔP = 4v².

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

## Verifying the numbers

```sh
node tests/engine.test.mjs          # calibration, conservation, ESPVR recovery, mechanisms, scenario and quoted-number checks
```

## Evidence

Every reference was checked against its PubMed record: PMID, title, authors, journal, year, pages and DOI. Every number quoted from a source was checked against its abstract or PMC full text. A few statements could only be checked against the bibliographic record, because the source has no open abstract or text. These are the ESC/ERS 2022 hemodynamic definitions and TAPSE/sPAP risk thresholds, the ASE recommendations and the ESC 2019 PE guideline. They are flagged on `references.html`.

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
