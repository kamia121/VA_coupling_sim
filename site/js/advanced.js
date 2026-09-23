// Advanced page: each mechanism drawn with the switch on (green) and off (gray), from the same engine.
import { simulate, cardiacPhases } from './engine.js';
import { presetById } from './presets.js';
import { drawPlot, niceMax, swatch } from './plot.js';
import { initScenarioCards } from './figures.js';

const ON = 'var(--series-current)', OFF = 'var(--series-ref)';
const P = (id) => presetById(id).params;

function loop(r, side) {
  const V = side === 'lv' ? r.rec.Vlv : r.rec.Vrv, Pr = side === 'lv' ? r.rec.Plv : r.rec.Prv;
  const pts = [];
  for (let i = 0; i < V.length; i += 4) pts.push([V[i], Pr[i]]);
  pts.push(pts[0]);
  return pts;
}

const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const ROW = {
  hr: ['Heart rate (/min)', (r) => f0(r.eff.hr)],
  map: ['MAP (mmHg)', (r) => f0(r.hemo.MAP)],
  bp: ['BP (mmHg)', (r) => `${f0(r.hemo.SBP)}/${f0(r.hemo.DBP)}`],
  co: ['Cardiac output (L/min)', (r) => f1(r.hemo.CO)],
  sv: ['LV stroke volume (mL)', (r) => f0(r.lv.SV)],
  fwd: ['Forward stroke volume (mL)', (r) => f0(r.lv.fwdSV)],
  lap: ['LAP (mmHg)', (r) => f1(r.hemo.LAP)],
  rap: ['RAP (mmHg)', (r) => f1(r.hemo.RAP)],
  mpap: ['mPAP (mmHg)', (r) => f0(r.hemo.mPAP)],
  lvedp: ['LVEDP (mmHg)', (r) => f1(r.lv.EDP)],
  lvedv: ['LV EDV (mL)', (r) => f0(r.lv.EDV)],
  minlvp: ['Lowest LV diastolic pressure (mmHg)', (r) => f1(Math.min(...r.rec.Plv))],
  rvedv: ['RV EDV (mL)', (r) => f0(r.rv.EDV)],
  ppcd: ['Pericardial pressure (mmHg)', (r) => f1(r.hemo.Ppcd)],
  vspt: ['Septal shift at end-diastole (mL)', (r) => f1(r.hemo.VsptED)],
  lvees: ['LV Ees (mmHg/mL)', (r) => f2(r.lv.Ees)],
  rvees: ['RV Ees (mmHg/mL)', (r) => f2(r.rv.Ees)],
  rveesea: ['RV Ees/Ea', (r) => f2(r.rv.EesEa)],
  tau: ['Relaxation τ (ms)', (r) => f0(r.lv.tau * 1000)],
  supR: ['RV coronary supply / demand', (r) => f2(r.hemo.supplyR)],
  svr: ['SVR used (mmHg·s/mL)', (r) => f2(r.eff.svr)],
  rf: ['Regurgitant fraction LV / RV (%)', (r) => `${f0(r.lv.RF * 100)} / ${f0(r.rv.RF * 100)}`],
  grad: ['Aortic valve mean gradient (mmHg)', (r) => f0(r.hemo.avMeanGrad)],
  raC: ['RA c wave peak (mmHg)', (r) => { const e = cardiacPhases(r).rv.events; return f1(Math.max(...r.rec.Pra.slice(e.inClose, e.outOpen + 20))); }],
  raX: ['RA x descent trough (mmHg)', (r) => { const e = cardiacPhases(r).rv.events; return f1(Math.min(...r.rec.Pra.slice(e.outOpen, e.outClose))); }],
  raV: ['RA v wave peak (mmHg)', (r) => { const e = cardiacPhases(r).rv.events; return f1(Math.max(...r.rec.Pra.slice(e.outClose, e.inOpen + 5))); }],
};

// Mechanism figures: [svg id, side or 'ra', on case, off case, table rows]
const FIGS = [
  ['pericardium', 'lv', ['Tamponade, pericardium on', P('tamponade')], ['Same fluid, pericardium off', { ...P('tamponade'), pericardium: 0 }], ['ppcd', 'lap', 'rap', 'lvedv', 'sv', 'co', 'hr']],
  ['septum', 'lv', ['Acute PE, septum on', P('acutePE')], ['Acute PE, septum off', { ...P('acutePE'), septum: 0 }], ['vspt', 'lvedv', 'lvedp', 'lap', 'rap', 'rvedv', 'co']],
  ['base', 'ra', ['Normal heart, on', {}], ['Normal heart, off', { baseDescent: 0 }], ['raX', 'raV', 'rap']],
  ['relax', 'lv', ['HFpEF at 102/min, τ 59 ms', P('hfpefTachy')], ['Same heart, τ 35 ms', { ...P('hfpefTachy'), tau: 0.035 }], ['tau', 'minlvp', 'lvedv', 'lap', 'sv', 'co', 'hr']],
  ['ffr', 'lv', ['130/min, force–frequency on', { hr: 130, baro: 0 }], ['130/min, off', { hr: 130, baro: 0, ffr: 0 }], ['lvees', 'sv', 'co', 'map']],
  ['baro', 'lv', ['Vasodilator, reflex on', { svr: 0.665 }], ['Vasodilator, reflex off', { svr: 0.665, baro: 0 }], ['map', 'hr', 'svr', 'lvees', 'co']],
  ['coronary', 'rv', ['PE at 12 WU, coronary on', P('peIschemia')], ['Same load, coronary off', { ...P('peIschemia'), coronary: 0 }], ['rvees', 'supR', 'rveesea', 'mpap', 'rap', 'co', 'map']],
];

function legend(el, a, b) {
  el.innerHTML = `<span>${swatch(ON, '', 2.6)}${a}</span><span>${swatch(OFF, '', 1.8)}${b}</span>`;
}

function table(el, rows, ra, rb, la, lb) {
  el.innerHTML = `<table class="data scen-table"><thead><tr><th>Model</th><th class="num">${la}</th><th class="num">${lb}</th></tr></thead><tbody>${
    rows.map((k) => `<tr><td>${ROW[k][0]}</td><td class="num">${ROW[k][1](ra)}</td><td class="num">${ROW[k][1](rb)}</td></tr>`).join('')}</tbody></table>`;
}

function drawFig([id, side, [la, pa], [lb, pb], rows], cache) {
  const svg = document.getElementById('mf-' + id);
  if (!svg) return;
  const ra = cache[id + 'a'] ??= simulate(pa), rb = cache[id + 'b'] ??= simulate(pb);
  const W = Math.max(320, Math.min(640, svg.parentElement.clientWidth || 560)), H = Math.round(W * 0.62);
  if (side === 'ra') {
    // RA pressure over one beat, from QRS
    const tr = (r) => r.rec.t.filter((_, i) => i % 4 === 0).map((t, k) => [t * 1000, r.rec.Pra[k * 4]]);
    const ev = cardiacPhases(ra).rv.events, T = ra.rec.t;
    drawPlot(svg, {
      width: W, height: H, title: 'Right atrial pressure over one beat',
      x: { min: 0, max: Math.round(ra.T * 1000), label: 'Time from QRS (ms)' }, y: { min: 0, max: 10, label: 'RA pressure (mmHg)' },
      series: [{ points: tr(rb), color: OFF, width: 1.8 }, { points: tr(ra), color: ON, width: 2.6 }],
      annotations: (() => {
        const P = ra.rec.Pra, at = (i) => ({ x: T[i] * 1000, y: P[i] });
        const iMax = (a, b) => { let k = a; for (let i = a; i < b; i++) if (P[i] > P[k]) k = i; return k; };
        const iMin = (a, b) => { let k = a; for (let i = a; i < b; i++) if (P[i] < P[k]) k = i; return k; };
        const c = at(iMax(ev.inClose, ev.outOpen + 40)), x = at(iMin(ev.outOpen, ev.outClose)), v = at(iMax(ev.outClose, ev.inOpen + 10));
        return [{ ...c, y: c.y + 0.9, text: 'c', color: ON }, { ...x, y: x.y - 1.1, text: 'x', color: ON }, { ...v, y: v.y + 0.9, text: 'v', color: ON }];
      })(),
    });
  } else {
    const ma = ra[side], mb = rb[side], Pk = side === 'lv' ? 'Plv' : 'Prv';
    const xmax = niceMax(Math.max(ma.EDV, mb.EDV) * 1.12);
    const ymax = niceMax(Math.max(...ra.rec[Pk], ...rb.rec[Pk]) * 1.1);
    drawPlot(svg, {
      width: W, height: H, title: `${side.toUpperCase()} pressure–volume loops`,
      x: { min: 0, max: xmax, label: `${side.toUpperCase()} volume (mL)` }, y: { min: 0, max: ymax, label: `${side.toUpperCase()} pressure (mmHg)` },
      series: [{ points: loop(rb, side), color: OFF, width: 1.8 }, { points: loop(ra, side), color: ON, width: 2.6 }],
    });
  }
  legend(document.getElementById('ml-' + id), la, lb);
  table(document.getElementById('mt-' + id), rows, ra, rb, 'On', 'Off');
}

// Valve lesions: four small loops against the normal heart.
const VALVES = [['v-as', 'asSevere', 'lv', 'Severe AS'], ['v-mr', 'mrAcute', 'lv', 'Acute severe MR'], ['v-ar', 'arChronic', 'lv', 'Chronic severe AR'], ['v-tr', 'trSevere', 'rv', 'Severe TR']];
function drawValves(cache) {
  const ref = cache.ref ??= simulate({});
  for (const [id, pid, side, name] of VALVES) {
    const svg = document.getElementById(id);
    if (!svg) continue;
    const r = cache[id] ??= simulate(P(pid));
    const Pk = side === 'lv' ? 'Plv' : 'Prv';
    drawPlot(svg, {
      width: 340, height: 230, xTicks: 4, yTicks: 4, title: name,
      x: { min: 0, max: niceMax(Math.max(r[side].EDV, ref[side].EDV) * 1.12), label: `${side.toUpperCase()} volume (mL)` },
      y: { min: 0, max: niceMax(Math.max(...r.rec[Pk], ...ref.rec[Pk]) * 1.1), label: 'mmHg' },
      series: [{ points: loop(ref, side), color: OFF, width: 1.6 }, { points: loop(r, side), color: ON, width: 2.4 }],
    });
  }
}

export function initAdvanced() {
  const cache = {};
  const all = () => { for (const f of FIGS) drawFig(f, cache); drawValves(cache); };
  all();
  initScenarioCards('advanced', 'adv-list');
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(all, 200); });
}
