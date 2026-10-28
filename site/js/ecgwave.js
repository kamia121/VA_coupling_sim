// One beat of a lead II-like ECG, in screen units (R wave about 13), shared by the monitors.
// ph: seconds since QRS onset; T: RR interval (s), which sets the QT (Bazett: QT ∝ √RR);
// pr: PR interval (s), or 0 for no P wave (atrial fibrillation, AV dissociation drawn without P).
// The T wave is broad, asymmetric and about three times the height of the P wave, and the QRS has
// Q, R and S deflections, so neither is mistaken for the other.
const g = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2);

export function ecgWave(ph, T, pr = 0.16) {
  const q = Math.sqrt(Math.max(0.3, T));             // QT scales with √RR
  let d = -1.4 * g(ph, 0.006, 0.004) + 13 * g(ph, 0.02, 0.007) - 3.2 * g(ph, 0.038, 0.007);
  const tPeak = 0.29 * q;                             // T wave: rises slowly, falls faster
  d += 4.6 * g(ph, tPeak, ph < tPeak ? 0.06 * q : 0.04 * q);
  if (pr > 0) {                                      // P wave, 90 ms, ending before the QRS
    const tp = ph - (T - pr);
    if (tp > -0.02 && tp < 0.11) d += 1.6 * g(tp, 0.045, 0.02);
  }
  return d;
}
