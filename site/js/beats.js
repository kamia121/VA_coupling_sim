// Beats run one after another from a converged circulation, each starting where the one before ended,
// under a breath: the pleural pressure follows the pattern of the breath and changes within every beat.
// Pure functions (no DOM), so the same file runs in the browser and in the node tests.
import { simulate } from './engine.js';

// Breathing patterns: period (s), share of the period that is inspiration, and the pleural pressure swing (mmHg)
// during inspiration and, with active expiration, during expiration (relative to quiet end-expiration).
export const BREATHS = {
  none: null,
  // quiet spontaneous breathing: the swing is an assumption of the model (a retrieved abstract gave no normal value)
  spont: { period: 4, insp: 1 / 3, inspSwing: -4, expSwing: 0 },
  tachy: { period: 2, insp: 0.45, inspSwing: -12, expSwing: 4 },
  ppv: { period: 4, insp: 1 / 3, inspSwing: 8, expSwing: 0 },
};

// Pleural pressure (mmHg) at time t (s) for a pattern; a half sine in each phase, 0 at end-expiration.
export function pleural(t, pat) {
  if (!pat) return 0;
  const ph = (((t % pat.period) + pat.period) % pat.period) / pat.period;
  if (ph < pat.insp) return pat.inspSwing * Math.sin((ph / pat.insp) * Math.PI);
  return pat.expSwing * Math.sin(((ph - pat.insp) / (1 - pat.insp)) * Math.PI);
}

// Run beats for `seconds` after `warm` seconds that are discarded, with the breath `pat` (a BREATHS entry).
// opt.rr: optional RR multipliers cycled beat by beat (irregular rhythm). Returns the converged beat without
// a breath (`base`) and the recorded beats, each with its start time t0, its length T and its result r.
export function runBeats(params, pat, { seconds = 16, warm = 8, rr = null, dt } = {}) {
  const base = simulate(params, dt ? { dt } : {});
  const fn = (t) => pleural(t, pat);
  const beats = [];
  let s = base.state, prev = base, t = 0, k = 0;
  while (t < warm + seconds) {
    const f = rr ? rr[k % rr.length] : 1;
    const r = simulate({ ...params, hr: base.params.hr / f }, { state: s, slow: base.slow, holdSlow: true, maxBeats: 0, prev, t0: t, pplFn: fn, ...(dt ? { dt } : {}) });
    const T = r.rec.t.length * r.dt;
    if (t >= warm) beats.push({ t0: t - warm, T, r });
    s = r.endState; prev = r; t += T; k++;
  }
  return { base, beats, pat };
}

// Per-beat arterial and venous quantities from a run, with the breath phase at the start of each beat.
export function beatTable({ beats, pat }) {
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return beats.map(({ t0, T, r }) => {
    const rec = r.rec, ppl = mean(rec.Ppl);
    return {
      t0, T, ppl, insp: pat ? ((t0 % pat.period) / pat.period < pat.insp) : false,
      SBP: Math.max(...rec.Pao), DBP: Math.min(...rec.Pao), MAP: mean(rec.Pao),
      SV: r.lv.SV, RVSV: r.rv.SV, RAP: mean(rec.Pra), LAP: mean(rec.Pla), Ppv: mean(rec.Ppv),
      LVEDP: rec.Plv[0], RVEDP: rec.Prv[0], Ppcd: mean(rec.Ppcd),
    };
  });
}

// Range of a per-beat quantity over the run: the highest and lowest beat and their difference. The
// inspiratory fall in systolic pressure (pulsus paradoxus) is the range of SBP over whole breaths.
export function variation(rows, key) {
  const v = rows.map((x) => x[key]);
  const max = Math.max(...v), min = Math.min(...v);
  return { max, min, range: max - min };
}
