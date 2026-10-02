# Pericardial disease: published hemodynamic endpoints and engine status

Information in this file comes from PubMed (abstract text retrieved through the PubMed tools on 2026-10-02). A number appears only if it is stated in the abstract of the cited record. "Abstract" in the last-but-one column states whether the abstract gives the number. Engine values are from `tests/pericard.test.mjs` (spontaneous breath of -4 mmHg, `CASES` in `site/js/pericard.js`). Status: **met** (model within 2 SD of a published mean ± SD, on the correct side of a threshold, or the same sign as a direction), **gap** (printed in the GAP block, not counted), **not testable** (qualitative, frequency in a cohort, or no number in the abstract).

Sources (DOI links resolve through doi.org):

| Key | PMID | DOI | Citation |
|---|---|---|---|
| Reddy 1978 | 668074 | 10.1161/01.cir.58.2.265 | Reddy PS, Curtiss EI, O'Toole JD, Shaver JA. Circulation 1978;58(2):265-72 |
| Reddy 1990 | 2251997 | 10.1016/0002-9149(90)90540-h | Reddy PS, Curtiss EI, Uretsky BF. Am J Cardiol 1990;66(20):1487-91 |
| Boltwood 1987 | 3568311 | 10.1161/01.cir.75.5.941 | Boltwood CM. Circulation 1987;75(5):941-55 |
| Singh 1986 | 3953452 | 10.1016/0002-9149(86)90853-2 | Singh S, Wann LS, Klopfenstein HS, Hartz A, Brooks HL. Am J Cardiol 1986;57(8):652-6 |
| Hamzaoui 2012 | 23222878 | 10.1183/09031936.00138912 | Hamzaoui O, Monnet X, Teboul JL. Eur Respir J 2012;42(6):1696-705 |
| Russo 1993 | 8325120 | 10.1378/chest.104.1.71 | Russo AM, O'Connor WH, Waxman HL. Chest 1993;104(1):71-8 |
| Chuttani 1994 | 8154431 | 10.1016/0002-8703(94)90561-4 | Chuttani K, Tischler MD, Pandian NG, Lee RT, Mohanty PK. Am Heart J 1994;127(4 Pt 1):913-8 |
| Schwartz 1993 | 8354831 | 10.1016/0735-1097(93)90210-r | Schwartz SL, Pandian NG, Cao QL, et al. J Am Coll Cardiol 1993;22(3):907-13 |
| Talreja 2008 | 18206742 | 10.1016/j.jacc.2007.09.039 | Talreja DR, Nishimura RA, Oh JK, Holmes DR. J Am Coll Cardiol 2008;51(3):315-9 |
| Jain 2022 | 34550314 | 10.1001/jamacardio.2021.3478 | Jain CC, Miranda WR, El Sabbagh A, Nishimura RA. JAMA Cardiol 2022;7(1):100-104 |
| Jaber 2009 | 19451139 | 10.1136/hrt.2008.155523 | Jaber WA, Sorajja P, Borlaug BA, Nishimura RA. Heart 2009;95(17):1449-54 |
| Kothari 1993 | 8335413 | 10.1016/0167-5273(93)90042-f | Kothari SS, Narula J, Tandon R, Shrivastava S. Int J Cardiol 1993;39(3):216-8 |
| Nadir 2014 | 24619369 | 10.1161/CIRCHEARTFAILURE.113.000830 | Nadir AM, Beadle R, Lim HS. Circ Heart Fail 2014;7(3):440-7 |
| Hatle 1989 | 2914352 | 10.1161/01.cir.79.2.357 | Hatle LK, Appleton CP, Popp RL. Circulation 1989;79(2):357-70 |
| Vaitkus 1991 | 1951008 | 10.1016/0002-8703(91)90587-8 | Vaitkus PT, Kussmaul WG. Am Heart J 1991;122(5):1431-41 |
| Mintz 1981 | 7285290 | 10.1161/01.cir.64.5.1018 | Mintz GS, Kotler MN, Parry WR, Iskandrian AS, Kane SA. Circulation 1981;64(5):1018-25 |
| Jozwiak 2024 | 39133379 | 10.1186/s13613-024-01356-5 | Jozwiak M, Teboul JL. Ann Intensive Care 2024;14(1):122 |
| Takata 1997 | 9390949 | 10.1152/jappl.1997.83.6.1799 | Takata M, Harasawa Y, Beloucif S, Robotham JL. J Appl Physiol 1997;83(6):1799-813 |
| Ramachandran 2009 | 19656411 | 10.1186/1742-4682-6-15 | Ramachandran D, Luo C, Ma TS, Clark JW. Theor Biol Med Model 2009;6:15 |

Arnal 2017 (PMID 29042486), Al-Rawas 2013 (PMID 23384402) and Georgopoulos 1995 (PMID 8636519) were added to `site/js/refs.js` as sources for ventilator and respiratory mechanics parameters. They carry no pericardial endpoint.

Full text: only Jain 2022 has a free PMC copy among the sources (PMC8459306), and the retrieved record held the abstract only. Every number below is therefore from an abstract.

## Cardiac tamponade

| Endpoint | Source | Published value | Abstract | Engine | Status |
|---|---|---|---|---|---|
| Right atrial pressure (RAP) before and after pericardiocentesis, 14 patients | Reddy 1978 | 16 ± 4 to 7 ± 5 mmHg | yes | 10.7 and 4.1 mmHg | met (existing) |
| Cardiac output before and after pericardiocentesis | Reddy 1978 | 3.87 ± 1.77 to 7 ± 2.2 L/min | yes | 3.13 and 5.54 L/min | met (existing) |
| Inspiratory systemic arterial pulse pressure before and after pericardiocentesis | Reddy 1978 | 45 ± 29 to 81 ± 23 mmHg | yes | 18.0 and 44.0 mmHg | met (new; both within 2 SD, the drained value near the lower bound of 35 mmHg) |
| RV end-diastolic pressure elevated and equal to pericardial pressure in every patient with tamponade; equilibration absent without tamponade | Reddy 1978 | equal (no difference stated) | yes | RVEDP 11.7 mmHg, difference from pericardial pressure 0.7 mmHg; 5.4 mmHg after drainage | met (new, tolerance 3 mmHg as in the existing equalization check) |
| Change after pericardiocentesis, group with intrapericardial pressure equilibrated to RAP and wedge (n = 48): RAP | Reddy 1990 | -9 ± 4 mmHg | yes | -6.6 mmHg | met (new) |
| Same: pulmonary artery wedge pressure | Reddy 1990 | -8 ± 5 mmHg | yes | -4.3 mmHg | met (new) |
| Same: intrapericardial pressure | Reddy 1990 | -16 ± 7 mmHg | yes | -8.9 mmHg | met (new) |
| Same: inspiratory decrease in arterial systolic pressure | Reddy 1990 | -17 ± 11 mmHg | yes | -10.1 mmHg | met (new) |
| Same: cardiac output | Reddy 1990 | +2.8 ± 1.5 L/min | yes | +2.4 L/min | met (new) |
| Wedge minus pericardial pressure, expiration, inspiration, after drainage | Boltwood 1987 | 4 ± 2, 0.2 ± 1.3, 8 ± 4 mmHg | yes | 3.3, 2.4, 7.9 mmHg | met (existing; the inspiratory value is within 2 SD but the model fall is smaller) |
| RAP and intrapericardial pressure essentially equal | Boltwood 1987 | equal | yes | 10.7 and 9.1 mmHg | met (existing) |
| Equilibrated intrapericardial, RAP and wedge pressures, all above 10 mmHg (study definition of tamponade) | Singh 1986 | > 10 mmHg | yes | RAP 10.7, wedge 12.4, intrapericardial 9.1 mmHg | RAP and wedge met (new); intrapericardial pressure gap by 0.9 mmHg |
| Pulsus paradoxus: fall in systolic pressure in inspiration | Hamzaoui 2012 | > 10 mmHg | yes | 15.8 mmHg | met (existing) |
| Pulsus paradoxus as a sign of tamponade | Singh 1986 | sensitivity 79%, specificity 40% | yes | not applicable (one case) | not testable |
| Pulsus paradoxus above 12 mmHg after cardiac surgery | Russo 1993 | 6 of 10 patients | yes | 15.8 mmHg | not testable (cohort frequency) |
| Pulsus paradoxus, equalized elevated diastolic pressures after cardiac surgery | Chuttani 1994 | 48% and 81% of 29 patients | yes | not applicable | not testable (cohort frequency) |
| Respiratory variation in systolic pressure above 10 mmHg at onset of LV diastolic collapse in regional tamponade (dog) | Schwartz 1993 | once in 14 episodes | yes | not applicable | not testable (regional tamponade, animal) |
| Pulsus paradoxus absent when wedge pressure is already high (chronic renal failure) | Reddy 1978 | 4 of 14 patients without pulsus paradoxus | yes | not exercised | not testable (needs a case with raised left-sided pressure) |
| Right atrial pressure does not fall below pericardial pressure in inspiration | Reddy 1978 | qualitative | yes | mean RAP above pericardial pressure in every beat | met (existing) |

Published model comparators that describe the same physiology: Takata 1997 (coupled pericardial constraint increases ventricular interdependence and pulsus paradoxus) and Ramachandran 2009 (septal and series interaction in a closed-loop model). Neither abstract gives a number that the engine could be tested against.

## Constrictive pericarditis

| Endpoint | Source | Published value | Abstract | Engine | Status |
|---|---|---|---|---|---|
| Enhanced ventricular interaction measured as the systolic area index (RV to LV systolic pressure-time area, inspiration over expiration) separates constriction (n = 59) from restrictive myocardial disease (n = 41) | Talreja 2008 | sensitivity 97%, predictive accuracy 100%; threshold not in abstract | yes (no threshold) | 0.99 in constriction, 0.93 in restriction | order met (new); level gap (model does not exceed 1) |
| Conventional criteria (equalization, early rapid filling) have predictive accuracy below 75% | Talreja 2008 | < 75% | yes | not applicable | not testable |
| Ejection time change, expiration less inspiration, aorta | Jain 2022 | +19.0 ± 15.7 ms (restriction or severe tricuspid regurgitation: +10.5 ± 9.1; P = 0.20) | yes | +7.9 ms | met (new) |
| Same, pulmonary artery | Jain 2022 | -31.8 ± 28.6 ms | yes | -5.5 ms | met (new; sign matches) |
| Same, aorta minus pulmonary artery | Jain 2022 | 50.8 ± 22.5 ms | yes | 13.3 ms | met (new; just above the lower 2 SD bound of 5.8 ms) |
| Difference between LV and RV diastolic pressures narrows in inspiration | Jaber 2009 | direction (no numbers) | yes | 2.3 to 0.9 mmHg | met (existing) |
| Early rapid filling wave in RV pressure unchanged by inspiration, expiratory equalization of diastolic pressures, raised RAP | Jaber 2009 | qualitative | yes | equalized within 5 mmHg, RAP 13.4 mmHg | partly met (existing check covers equalization and RAP; the filling wave is not tested) |
| Wedge pressure and LVEDP gradient abolished in inspiration, with respiratory variation in wedge pressure but not LVEDP (patient with mitral stenosis) | Kothari 1993 | case report, two patients, no numbers | yes | wedge minus LVEDP -1.1 to -1.2 mmHg | gap (existing; no gradient to abolish without mitral stenosis, and the model wedge pressure follows LVEDP) |
| Kussmaul physiology (inspiratory rise in RAP) in heart failure referred for transplantation | Nadir 2014 | 39 of 90 patients (43%) | yes | RAP 13.3 to 12.9 mmHg | gap (existing; population is heart failure, not constriction) |
| No respiratory variation of inferior vena cava dimension in constriction (normal: 50% inspiratory decrease) | Mintz 1981 | 50% in normal subjects | yes | RAP change under 1 mmHg | indirect (existing RAP check; cava diameter is not simulated) |
| Respiratory changes in left ventricular isovolumic relaxation time and early mitral and tricuspid velocities, abolished by pericardiectomy | Hatle 1989 | n = 7 constriction, 12 restriction, 20 control; qualitative | yes | not simulated | not testable (Doppler velocities absent from the engine) |
| RV to LV end-diastolic pressure difference, RV systolic pressure and RVEDP to RV systolic pressure ratio separate constriction from restriction | Vaitkus 1991 | predictive accuracy 85%, 70% and 76%; 82 constriction and 37 restriction cases; concordant criteria above 90% | yes (accuracies only) | restriction LVEDP minus RVEDP 20.6 mmHg; constriction 2.3 mmHg | not testable (thresholds not in the abstract) |

## Restrictive cardiomyopathy

| Endpoint | Source | Published value | Abstract | Engine | Status |
|---|---|---|---|---|---|
| No enhanced ventricular interaction (low systolic area index) | Talreja 2008 | unique to constriction | yes | 0.93 | met (new, order against constriction) |
| Ejection time change, aorta, without constriction (restriction or severe tricuspid regurgitation) | Jain 2022 | +10.5 ± 9.1 ms | yes | +4.2 ms | met (new) |
| Ejection time change, aorta minus pulmonary artery, without constriction | Jain 2022 | 5.4 ± 15.2 ms | yes | 21.1 ms | met (new) |
| Ejection time change, pulmonary artery, without constriction | Jain 2022 | +5.1 ± 9.5 ms | yes | -16.9 ms | gap (new; outside 2 SD, and the sign differs) |
| Aorta minus pulmonary artery ejection time difference larger in constriction than without | Jain 2022 | 50.8 versus 5.4 ms | yes | 13.3 ms in constriction, 21.1 ms in restriction | gap (new; order reversed) |
| No change in respiratory flow velocity pattern, shortening of tricuspid deceleration time with inspiration | Hatle 1989 | qualitative | yes | not simulated | not testable |
| Diastolic pressures raised and not equalized | existing check; thresholds from Vaitkus 1991 are not in the abstract | LVEDP minus RVEDP above 5 mmHg is the repository's assumption | no | 20.6 mmHg | the existing check has no published number behind it |

Pulmonary artery systolic pressure above 50 mmHg and RVEDP to RV systolic pressure above one third as separators of restriction from constriction are widely quoted. None of the abstracts retrieved for this work states either threshold, so neither is recorded as a published endpoint and neither can be tested. For later comparison the engine gives PASP 20.8 mmHg in restriction and 24.5 mmHg in constriction (RV systolic pressure equals PASP in the model), and RVEDP of 11.1 and 15.0 mmHg.

## Normal circulation

| Endpoint | Source | Published value | Abstract | Engine | Status |
|---|---|---|---|---|---|
| Systolic pressure falls in quiet inspiration; pulsus paradoxus defined as a fall above 10 mmHg | Hamzaoui 2012 | fall; threshold 10 mmHg | yes | 117.8 to 115.7 mmHg; beat-to-beat range 5.7 mmHg | met (new direction; existing threshold) |
| RAP falls during inspiration | Nadir 2014 | direction (no number) | yes | 3.9 to 3.2 mmHg | met (new) |
| Inspiration raises RV preload and afterload and lowers LV preload; no significant hemodynamic consequence in normal breathing | Jozwiak 2024 | qualitative | yes | LV end-diastolic volume -1.5% in inspiration | consistent (existing check on LV filling) |
| Right atrial pressure 7 ± 5 mmHg and cardiac output 7 ± 2.2 L/min after drainage of effusion | Reddy 1978 | as stated | yes | 4.1 mmHg, 5.54 L/min | met (existing; used as the post-drainage reference) |
| Inspiratory pulse pressure after drainage | Reddy 1978 | 81 ± 23 mmHg | yes | 44.0 mmHg | met (new) |

## Items searched without a usable abstract number

The following were sought and not recorded because no abstract retrieved in this session stated the number: the magnitude of respiratory variation in RAP in effusion; the rapid-filling (dip-and-plateau) amplitude or slope in mmHg; RV and LV peak systolic pressure discordance in inspiration as a percentage or in mmHg; the PASP and RVEDP to RV systolic pressure thresholds named above. A later pass with full-text access to Talreja 2008, Vaitkus 1991 and the Mayo catheterization series could supply them.

## Observations on the existing checks

- The previous GAP entries for Jain 2022 compared the model with the published constriction difference as if it failed. The model value of 13.3 ms lies inside 50.8 ± 2 × 22.5 ms, so it now appears as a counted check, and the GAP block records the two findings the engine misses (pulmonary artery ejection time without constriction, and the order of the aorta minus pulmonary artery difference).
- The tamponade case has a mean pericardial pressure of 9.1 mmHg, which sits 0.9 mmHg under the 10 mmHg level in the Singh 1986 definition of tamponade. RAP and wedge pressure clear it.
- The non-constriction group in Jain 2022 mixes restrictive cardiomyopathy with severe tricuspid regurgitation, so the restriction case is compared with a mixed group.
