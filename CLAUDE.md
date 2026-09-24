# Writing rules for site text

These rules apply to all prose on the site: paragraphs, figure captions, table notes, status lines, question and explanation text, and the scenario and grade descriptions in the JavaScript. They were set for the Diastolic lab (`site/diastolic.html`, `site/diastolic-sim.html`, `site/js/diastcore.js`, `site/js/diastquiz.js`) and apply to any page that is rewritten.

## Model paragraph

Every paragraph should read like this one:

> Early diastole is active: myocardial relaxation drives an exponential fall in LV pressure (τ), generating a suction gradient that pulls blood from the left atrium. Once relaxation ceases, late diastolic pressure is governed passively by LV volume and passive chamber stiffness along the end-diastolic pressure–volume relation (EDPVR). Diastolic dysfunction typically begins with impaired relaxation before progressing to increased myocardial stiffness—two mechanically distinct processes tracked by different echocardiographic parameters.

The paragraph opens on physiology. It names each variable precisely (LV pressure, τ, EDPVR) and states mechanism and sequence in complete sentences. It stays in one register from start to finish.

## What to avoid

1. **Meta-commenting and meta-framing.** Do not write sentences about the page, the section or the reader's path through them. Examples: "first the physiology, then questions, then the simulator", "the simulator translates the numbers into…", "that is fluid tolerance in one picture", "hover over a chart to read the values", "Contents: 1 … 2 …". A control or chart that needs an instruction gets it in its own label or caption, stated as fact.
2. **Structural redundancy.** Explain each concept once. Put a mechanism and the model's numbers for it in the same place. Do not add a separate "why" section that a later "results" section repeats.
3. **Physiological ambiguity.** Name the quantity: mean LA pressure, not "the pressure"; LV chamber stiffness (the EDPVR), not "stiffness"; the transmitral gradient at mitral valve opening, not "the gradient"; normal ventricle, not "normal heart" when the LV is meant. Keep chamber stiffness and myocardial (material) stiffness distinct. Give units.
4. **Abrupt tonal shifts into jargon.** Keep one formal register. Define an abbreviation or index the first time it appears. Do not drop from full sentences into shorthand or clipped fragments.
5. **The faux-dramatic binary.** Avoid "[A] does X, and [B] does Y" and the semicolon pair built to sound profound ("Where the curve is flat, …; where it is steep, …"). If two findings differ, report each with its own subject and numbers, in separate sentences where that is clearer.
6. **Anthropomorphism and shorthand for instruments.** A Doppler recording measures a velocity; an index reflects or is related to a physiological quantity. Do not write that a modality or index "reads", "tells you", "knows", "sees" or "records pressure". "E/e′ rises with LA pressure" is acceptable; "the Doppler reads LA pressure" is not.
7. **Aphoristic, executive-summary brevity.** No punchlines or slogans: "rate is where the grades part company", "fluid adds pressure without flow", "afterload alone does not flood the lungs", "the exception worth remembering". No bold run-in leads in place of structure; use a subheading or a topic sentence.

8. **Pedagogical self-consciousness.** Do not break the fourth wall. Sentences such as "the direction is the one to teach", "the simulator translates the numbers into the bedside picture" and "this is the central problem of Doppler grading" make the voice that of a presenter describing the teaching tool. Write as the expert stating the physiology.
9. **The tour guide of numbers.** Do not recite every model output in running prose ("E is 90 cm/s, A is 77 cm/s (E/A 1.17), the deceleration time is 226 ms…"). Values belong in tables and figures. The prose explains the mechanism and quotes only the one or two numbers that carry it.
10. **Algorithmic navel-gazing.** Do not digress into guideline flowchart minutiae to show knowledge of the algorithm ("E is above the 50 cm/s the algorithm uses… and the algorithm reaches grade I only because…"). Cite a guideline where it changes clinical interpretation, and synthesize as a clinician would.
11. **Other unnatural habits to remove:**
    - stacked parenthetical values;
    - "in the model" or "the model's" repeated in consecutive sentences;
    - signposting cross-references ("described under limitations", "see below", "as shown above");
    - every paragraph opening with the same frame ("In grade I, … In grade II, …");
    - paragraphs that end with a moral or verdict;
    - "respectively" chains;
    - range dumps ("by 0.4 mmHg in A, 1.6 mmHg in B and 3.6 mmHg in C") where one contrast carries the point;
    - reflexive qualifiers.

## What to do

8. **Name the physiological problem before its solution.** When a measurement is confounded, say so first and name the paradox. Example: the mitral inflow velocities are driven by opposing forces, because slow relaxation lowers E while a raised LA pressure raises it, so a pseudonormal pattern can look like a normal one. Only then introduce the indices that resolve it (e′, LA volume index, TR jet velocity) and explain why each one escapes the confounding.
9. **Vary sentence architecture.** Do not chain "X happens when Y" clauses. Use participial phrases, compound and complex sentences, and occasional short declaratives, as the reasoning requires.
10. **Use precise hemodynamic vocabulary** in place of technician shorthand. Examples: surrogate, relatively preload-independent, atrial kick, retrograde transmission (of LA pressure to the pulmonary circulation), transmitral gradient, stressed volume. Keep qualifiers that the evidence requires. e′ is *relatively* preload-independent (Sohn 1997), and Opdahl 2009 showed a preload effect.

## Also avoid

- announced assertions ("the key point is", "importantly");
- "not X but Y" constructions;
- reflexive triplets;
- trailing gerund clauses;
- rhetorical questions;
- intensifiers such as "simply", "at all" and "very";
- characterizations where a number exists.

Use American spelling.

## Numbers

Every number the text quotes from the model is recomputed in a test, either `tests/diastolic.test.mjs` or `tests/quoted_numbers.test.mjs`. If a rewrite changes a number or adds one, change the test with it. Numbers quoted from a source must match its abstract or full text. Mark a source that could only be checked against its bibliographic record in `README.md`.
