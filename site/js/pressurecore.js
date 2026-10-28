// Pressure measurement: the hydrostatic column, the reference level and the zero, the pressure around the
// vessels, and the dynamic response of a fluid-filled catheter and transducer. Pure functions (no DOM), so the
// same file runs in the browser and in the node tests.

// ---------- constants ----------
// 1 cmH2O = 98.0665 Pa and 1 mmHg = 133.322 Pa, so a column of fluid of density ρ (g/mL) and height h (cm)
// exerts ρ·0.73556·h mmHg. Densities: isotonic saline in the line, and blood.
export const MMHG_PER_CMH2O = 98.0665 / 133.322;
export const RHO = { saline: 1.005, blood: 1.056 };
export const MMHG_CM = { saline: RHO.saline * MMHG_PER_CMH2O, blood: RHO.blood * MMHG_PER_CMH2O };

// Body lengths of a 175 cm adult (assumed): from the hip joint to the heart (the phlebostatic axis), to the
// circle of Willis, and to the ankle. The wrist rests at the level of the hip.
export const BODY = { hipToHeart: 40, hipToBrain: 65, hipToAnkle: 78 };

// Pre-capillary to post-capillary resistance ratio of the systemic circulation (assumed).
export const RESISTANCE_RATIO = 4;

// ---------- posture and sites ----------
// angle: elevation of the torso above the horizontal; the legs lie flat except when standing.
export const POSTURES = [
  { id: 'supine', label: 'Supine', angle: 0, standing: false },
  { id: 'hob30', label: 'Head up 30°', angle: 30, standing: false },
  { id: 'hob60', label: 'Head up 60°', angle: 60, standing: false },
  { id: 'sitting', label: 'Sitting', angle: 90, standing: false },
  { id: 'standing', label: 'Standing', angle: 90, standing: true },
];

export const SITES = [
  { id: 'aorta', label: 'Aortic root', kind: 'arterial' },
  { id: 'brain', label: 'Circle of Willis', kind: 'arterial' },
  { id: 'radial', label: 'Radial artery', kind: 'arterial' },
  { id: 'foot', label: 'Dorsalis pedis artery', kind: 'arterial' },
  { id: 'ra', label: 'Right atrium', kind: 'venous' },
  { id: 'footvein', label: 'Foot vein', kind: 'venous' },
];

// Height of a site above the heart (cm; negative is below it).
export function siteHeight(site, posture) {
  const s = Math.sin((posture.angle * Math.PI) / 180);
  switch (site) {
    case 'aorta': case 'ra': return 0;
    case 'brain': return (BODY.hipToBrain - BODY.hipToHeart) * s;
    case 'radial': return -BODY.hipToHeart * s;
    case 'foot': case 'footvein': return posture.standing ? -(BODY.hipToHeart + BODY.hipToAnkle) : -BODY.hipToHeart * s;
    default: throw new Error(`unknown site ${site}`);
  }
}

// Height of the transducer above the heart for each way of mounting it.
export function transducerHeight(mode, posture, site, custom = 0) {
  switch (mode) {
    case 'axis': return 0;                                                  // leveled to the phlebostatic axis
    case 'bed': return -BODY.hipToHeart * Math.sin((posture.angle * Math.PI) / 180);   // left where the heart was when supine
    case 'site': return siteHeight(site, posture);                          // at the vessel
    case 'custom': return custom;
    default: throw new Error(`unknown mounting ${mode}`);
  }
}

// ---------- pressures inside the vessels ----------
// heart: pressures at the level of the heart (mmHg): { sbp, dbp, map, rap }. Every pressure in an arterial site
// differs from the pressure at the heart by the weight of the blood column between them, so the pulse
// pressure is unchanged. A column of venous blood below the heart is supported by the valves; above the heart the
// veins collapse and the pressure there falls no lower than the atmosphere.
export function arterialAt(heart, h) {
  const d = MMHG_CM.blood * h;
  return { sbp: heart.sbp - d, dbp: heart.dbp - d, map: heart.map - d };
}
export function venousAt(heart, h) {
  const p = heart.rap - MMHG_CM.blood * h;
  return h > 0 ? Math.max(0, p) : p;
}
// Capillary pressure between an artery and a vein by the resistances in series: the pressure falls across
// the pre-capillary resistance and again across the post-capillary resistance.
export function capillaryP(pa, pv, ratio = RESISTANCE_RATIO) { return pv + (pa - pv) / (1 + ratio); }

// What the transducer reports for a pressure p measured in a vessel at height hSite, with the transducer at hTrans
// and a zero offset: the saline column between them adds to p when the vessel lies above the transducer.
export function reading(p, hSite, hTrans, offset = 0) { return p + MMHG_CM.saline * (hSite - hTrans) + offset; }

// ---------- pressure around the vessels ----------
// Pleural pressure (mmHg) added by a PEEP (cmH2O) when a fraction of the airway pressure reaches the pleural space.
export function pleuralFromPeep(peep, fraction) { return fraction * peep * MMHG_PER_CMH2O; }

// ---------- dynamic response ----------
// A fluid-filled catheter, tubing and transducer behave as a second-order system with natural frequency fn (Hz) and
// damping coefficient ζ: y'' = ωn²(u − y) − 2ζωn y', with u the pressure at the tip and y the pressure reported.
// u is a sampled signal with step dt (s); y starts at y0.
export function secondOrder(u, dt, fn, zeta, y0 = u[0]) {
  const w = 2 * Math.PI * fn, y = new Array(u.length);
  const sub = Math.max(1, Math.ceil((dt * w * (zeta + Math.sqrt(zeta * zeta + 1))) / 0.4));
  const h = dt / sub;
  let p = y0, v = 0;
  const acc = (pp, vv, uu) => w * w * (uu - pp) - 2 * zeta * w * vv;
  for (let i = 0; i < u.length; i++) {
    y[i] = p;
    const u0 = u[i], u1 = i + 1 < u.length ? u[i + 1] : u[i];
    for (let k = 0; k < sub; k++) {
      const ua = u0 + ((u1 - u0) * k) / sub, ub = u0 + ((u1 - u0) * (k + 0.5)) / sub, uc = u0 + ((u1 - u0) * (k + 1)) / sub;
      const k1p = v, k1v = acc(p, v, ua);
      const k2p = v + 0.5 * h * k1v, k2v = acc(p + 0.5 * h * k1p, v + 0.5 * h * k1v, ub);
      const k3p = v + 0.5 * h * k2v, k3v = acc(p + 0.5 * h * k2p, v + 0.5 * h * k2v, ub);
      const k4p = v + h * k3v, k4v = acc(p + h * k3p, v + h * k3v, uc);
      p += (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
      v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    }
  }
  return y;
}

// The fast-flush test: the tip pressure is held high by the flush and then drops to the arterial pressure at t = 0.
// Returns the reported pressure after the flush stops and the natural frequency and damping coefficient found
// from the oscillations, the way they are read at the bedside: the period between two consecutive peaks gives the damped
// frequency, and the ratio of their amplitudes gives the damping coefficient through the logarithmic decrement.
export function flushTest(fn, zeta, { base = 90, high = 300, dt = 0.0005, duration = 0.8 } = {}) {
  const n = Math.round(duration / dt), u = new Array(n).fill(base);
  const y = secondOrder(u, dt, fn, zeta, high);
  // extrema of the trace about the baseline, in order
  const ex = [];
  for (let i = 1; i < n - 1; i++) {
    const a = y[i] - base;
    if ((y[i] - y[i - 1]) * (y[i + 1] - y[i]) < 0 && Math.abs(a) > 0.002 * (high - base)) ex.push({ i, a });
  }
  const t = Array.from({ length: n }, (_, i) => i * dt);
  const found = { t, y, extrema: ex };
  // two consecutive peaks of the same direction: extrema 1 and 3, and the amplitudes about the baseline
  if (ex.length < 3 || Math.abs(ex[2].a) < 0.01 * Math.abs(ex[0].a)) return { ...found, oscillates: false };
  const Td = (ex[2].i - ex[0].i) * dt, ratio = Math.abs(ex[2].a) / Math.abs(ex[0].a), delta = Math.log(1 / ratio);
  const z = delta / Math.sqrt(4 * Math.PI * Math.PI + delta * delta), fd = 1 / Td;
  return { ...found, oscillates: true, fd, zeta: z, fn: fd / Math.sqrt(1 - z * z), ratio };
}

// For a damping coefficient above 1 the system does not oscillate and a step in pressure is reported as the sum of two
// exponentials; the slower one dominates, with this time constant (s). Where ζ is large the time constant is about 2ζ/ωn.
export function slowTimeConstant(fn, zeta) {
  if (zeta <= 1) return null;
  const w = 2 * Math.PI * fn;
  return 1 / (w * (zeta - Math.sqrt(zeta * zeta - 1)));
}

// The reported pressure for a periodic arterial waveform u (one beat sampled at dt, repeated): the system is run through
// several beats so that its own transient has gone, and the last beat is returned.
export function respond(beat, dt, fn, zeta, beats = 5) {
  const u = [];
  for (let b = 0; b < beats; b++) u.push(...beat);
  const y = secondOrder(u, dt, fn, zeta, beat[0]);
  return y.slice(-beat.length);
}

// Systolic, diastolic and mean pressure of a sampled beat.
export function beatStats(w) {
  let mx = -Infinity, mn = Infinity, s = 0;
  for (const v of w) { if (v > mx) mx = v; if (v < mn) mn = v; s += v; }
  return { sbp: mx, dbp: mn, map: s / w.length };
}
