// Shock lab page: accelerated clock, bedside monitor, infusions and fluids, four-interface panel,
// live PV loops, trends, and the flow–congestion (Forrester–Kenny) diagram.
import { simulate, couplingLines } from './engine.js';
import { DRUGS, DRUG, FLUIDS } from './pharm.js';
import { SHOCK, SHOCK_BY, createPatient, advance, setDrug, give, setBleed, setUF, action, interfaces } from './shockcore.js';
import { drawPlot, niceMax, swatch } from './plot.js';
import { addExport, header, even } from './export.js';

const $ = (s) => document.querySelector(s);
const TICK = 500;                    // ms of real time per tick
const MIN_PER_S = 1;                 // simulated minutes per real second at 1×
const FS = 250;                      // monitor sample rate (Hz); the window (s) is st.win
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NORM = simulate({});

const st = { id: 'normal', speed: 1, running: false, timer: null, busy: false, pt: null, start: null, beat: null, t0: performance.now(), showPA: false,
  sweep: null, scale: { abp: 0, cvp: 0, pa: 0 },
  win: window.innerWidth < 600 ? 3 : 6 };   // a phone shows 3 s so the waves are wide enough to read
const KEYS = ['ecg', 'abp', 'cvp', 'pa'];

// ---------- monitor ----------
function buildBeat() {
  const r = st.pt.r, n = Math.max(2, Math.round(r.T * FS)), m = r.rec.t.length;
  const pick = (a) => Array.from({ length: n }, (_, k) => a[Math.min(m - 1, Math.floor((k / n) * m))]);
  st.beat = { n, T: n / FS, abp: pick(r.rec.Pao), cvp: pick(r.rec.Pra), pa: pick(r.rec.Ppa) };
}
function ecg(ph, T) {
  const u = ph / T, tp = ph - (T - 0.16);
  let d = u < 0.03 ? Math.sin(u / 0.03 * Math.PI) * 12 * (u < 0.015 ? 1 : -0.4) : u > 0.3 && u < 0.45 ? Math.sin((u - 0.3) / 0.15 * Math.PI) * 3.5 : 0;
  if (tp >= 0 && tp < 0.09) d += 2 * Math.sin(tp / 0.09 * Math.PI);
  return d;
}

// Sweep buffer, as on a bedside monitor: samples are written once at the moving cursor and never
// redrawn, and each new sample continues the beat phase, so a change of heart rate at a tick changes
// only the beats still to come. The display does not scroll, so there is no aliasing shimmer.
function sweepFill(now) {
  const N = Math.round(st.win * FS), b = st.beat;
  if (!st.sweep) st.sweep = { N, written: null, phase: 0, buf: Object.fromEntries(KEYS.map((k) => [k, new Float32Array(N).fill(NaN)])) };
  const sw = st.sweep, target = Math.floor(((now - st.t0) / 1000) * FS);
  if (sw.written == null || target - sw.written > N) sw.written = target - N;
  for (let s = sw.written + 1; s <= target; s++) {
    sw.phase += 1 / b.n; if (sw.phase >= 1) sw.phase -= Math.floor(sw.phase);
    const k = Math.min(b.n - 1, Math.floor(sw.phase * b.n)), i = ((s % N) + N) % N;
    sw.buf.ecg[i] = ecg(k / FS, b.T); sw.buf.abp[i] = b.abp[k]; sw.buf.cvp[i] = b.cvp[k]; sw.buf.pa[i] = b.pa[k];
  }
  sw.written = target;
  return { buf: sw.buf, N, cursor: ((target % N) + N) % N };
}
// Scrolling window from one fixed beat (slide export, where every frame is rendered from the model).
function scrollFill(tEnd) {
  const N = Math.round(st.win * FS), s0 = Math.round(tEnd * FS) - N, b = st.beat;
  const buf = Object.fromEntries(KEYS.map((k) => [k, new Float32Array(N)]));
  for (let j = 0; j < N; j++) {
    const kk = (((s0 + j) % b.n) + b.n) % b.n;
    buf.ecg[j] = ecg(kk / FS, b.T); buf.abp[j] = b.abp[kk]; buf.cvp[j] = b.cvp[kk]; buf.pa[j] = b.pa[kk];
  }
  return { buf, N, cursor: null };
}
// Display range with hysteresis, so the scale does not jump with small beat-to-beat changes.
function range(k, max, floor, step) {
  const cur = st.scale[k];
  if (!cur || max > cur * 0.92 || max < cur * 0.45) st.scale[k] = Math.max(floor, Math.ceil((max * 1.25) / step) * step);
  return [0, st.scale[k]];
}

// target (export only): { g, w, h }
function drawMonitor(tEnd, target) {
  let g, w, h;
  if (target) ({ g, w, h } = target);
  else {
    const c = $('#mon'), box = c.parentElement, cs = getComputedStyle(box);
    w = Math.floor(box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    h = Math.round(Math.min(w < 560 ? w * 0.95 : w * 0.46, Math.max(300, window.innerHeight * 0.6)));
    const dpr = window.devicePixelRatio || 1;
    // whole-pixel backing store: with a fractional devicePixelRatio (125%, 150%) w·dpr is not an integer,
    // so comparing it with c.width never matched and the canvas was cleared and resized on every frame
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; c.style.width = w + 'px'; c.style.height = h + 'px'; }
    g = c.getContext('2d'); g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
  }
  const b = st.beat, o = st.pt.out;
  const src = target || reduce ? scrollFill(tEnd) : sweepFill(tEnd);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  const narrow = w < 560;
  const numW = narrow ? 0 : Math.max(170, w * 0.26);
  const traceH = narrow ? h * 0.58 : h;
  const pw = Math.floor(w - numW - 16), x0 = 8;
  const rows = st.showPA ? ['ecg', 'abp', 'pa', 'cvp'] : ['ecg', 'abp', 'cvp'];
  const rh = (traceH - 10) / rows.length;
  const col = { ecg: '#7CE38B', abp: '#F2706A', cvp: '#6FB7F2', pa: '#E8D35F' };
  const scale = {
    abp: range('abp', Math.max(...b.abp), 120, 20),
    cvp: range('cvp', Math.max(...b.cvp), 10, 5),
    pa: range('pa', Math.max(...b.pa), 40, 10),
  };
  const per = src.N / pw, gap = Math.round(0.25 * FS);   // erase bar ahead of the cursor, 250 ms
  g.font = '11px system-ui'; g.textBaseline = 'alphabetic';
  rows.forEach((k, i) => {
    const top = 6 + i * rh, bot = top + rh - 6;
    const Y = k === 'ecg' ? (v) => (top + bot) / 2 - v * rh / 40 : (v) => bot - ((v - scale[k][0]) / (scale[k][1] - scale[k][0])) * (bot - top);
    const a = src.buf[k];
    g.strokeStyle = '#16251F'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, bot); g.lineTo(x0 + pw, bot); g.stroke();
    g.strokeStyle = col[k]; g.lineWidth = k === 'ecg' ? 1.3 : 1.8; g.lineJoin = 'round'; g.beginPath();
    let pen = false;
    for (let j = 0; j < pw; j++) {
      const i0 = Math.floor(j * per), i1 = Math.max(i0 + 1, Math.floor((j + 1) * per));
      if (src.cursor != null) {
        const ahead = (i0 - src.cursor + src.N) % src.N;
        if (ahead > 0 && ahead <= gap) { pen = false; continue; }
      }
      // every sample in this pixel column, so a narrow QRS or c wave is always drawn to its full height
      let lo = Infinity, hi = -Infinity, first = NaN, last = NaN;
      for (let q = i0; q < i1; q++) { const v = a[q]; if (Number.isNaN(v)) continue; if (Number.isNaN(first)) first = v; last = v; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (Number.isNaN(first)) { pen = false; continue; }
      const x = x0 + j + 0.5;
      if (pen) g.lineTo(x, Y(first)); else g.moveTo(x, Y(first));
      if (hi - lo > 0.01) { g.lineTo(x, Y(hi)); g.lineTo(x, Y(lo)); }
      g.lineTo(x, Y(last)); pen = true;
    }
    g.stroke();
    g.fillStyle = col[k]; g.textAlign = 'left';
    g.fillText(k === 'ecg' ? 'II' : k === 'abp' ? `ART 0–${scale.abp[1]}` : k === 'pa' ? `PA 0–${scale.pa[1]}` : `CVP 0–${scale.cvp[1]}`, x0 + 2, top + 11);
  });
  // numerics
  const nums = [
    ['HR', o.hr.toFixed(0), '/min', col.ecg],
    ['ART', `${o.sbp.toFixed(0)}/${o.dbp.toFixed(0)}`, `(${o.map.toFixed(0)})`, col.abp],
    ...(st.showPA ? [['PA', `${o.pasp.toFixed(0)}/${o.padp.toFixed(0)}`, `(${o.mpap.toFixed(0)})`, col.pa]] : []),
    ['CVP', o.cvp.toFixed(0), 'mmHg', col.cvp],
    ['CO', o.co.toFixed(1), `CI ${o.ci.toFixed(1)}`, '#D5E2DE'],
    ['ScvO₂', (o.svo2 * 100).toFixed(0), '%', '#A9BCF2'],
    ['Lactate', o.lac.toFixed(1), 'mmol/L', '#E8B962'],
    ['CRT', o.crt.toFixed(1), 's', '#E8B962'],
  ];
  if (narrow) {
    const cols = 4, cw = w / cols, top = traceH + 4, ch = (h - top) / Math.ceil(nums.length / cols);
    nums.forEach(([k, v, u, c], i) => {
      const x = (i % cols) * cw + 8, y = top + Math.floor(i / cols) * ch;
      g.fillStyle = c; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(k, x, y + 13);
      g.font = `600 ${Math.min(22, cw / 4.6)}px system-ui`; g.fillText(v, x, y + 13 + Math.min(24, ch * 0.45));
      g.font = '10px system-ui'; g.fillStyle = '#7E918B'; g.fillText(u, x, y + 13 + Math.min(38, ch * 0.72));
    });
  } else {
    const x = w - numW, rH = (h - 8) / nums.length;
    nums.forEach(([k, v, u, c], i) => {
      const y = 4 + i * rH;
      g.fillStyle = c; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(k, x, y + 14);
      g.font = `600 ${Math.min(26, rH * 0.62)}px system-ui`; g.textAlign = 'right'; g.fillText(v, w - 10, y + rH * 0.72);
      g.font = '10px system-ui'; g.fillStyle = '#7E918B'; g.fillText(u, w - 10, y + rH * 0.98);
    });
  }
  g.textAlign = 'left';
}

function frame(now) {
  if (st.beat) drawMonitor(now);
  if (!reduce) requestAnimationFrame(frame);
}

// ---------- clock ----------
function hm(t) { const m = Math.round(t); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }

function tick() {
  if (st.busy) return;
  st.busy = true;
  advance(st.pt, (TICK / 1000) * MIN_PER_S * st.speed);
  refresh();
  st.busy = false;
}
function setRunning(on) {
  st.running = on;
  clearInterval(st.timer);
  if (on) st.timer = setInterval(tick, TICK);
  $('#play').textContent = on ? '❚❚ Pause' : '▶ Run';
  $('#play').setAttribute('aria-pressed', String(on));
}

function load(id) {
  st.id = SHOCK_BY[id] ? id : 'normal';
  st.pt = createPatient(st.id);
  st.scale = { abp: 0, cvp: 0, pa: 0 };
  st.start = st.pt.r;
  $('#scn').value = st.id;
  $('#scn-text').innerHTML = `<p>${st.pt.sc.text}</p>`;
  const acts = st.pt.sc.actions || [];
  $('#acts').innerHTML = acts.map(([a, t]) => `<button type="button" class="give" data-act="${a}">${t}</button>`).join('');
  $('#acts').hidden = !acts.length;
  $('#bleed').value = st.pt.bleed; $('#uf').value = 0;
  syncDrugInputs();
  history.replaceState(null, '', `#scenario=${st.id}`);
  refresh();
}

// ---------- panels ----------
function drugPanel() {
  const groups = [...new Set(DRUGS.map((d) => d.group))];
  $('#drugs').innerHTML = groups.map((gname) => `<fieldset class="drug-grp"><legend>${gname}</legend>${
    DRUGS.filter((d) => d.group === gname).map((d) => `<div class="drug" data-id="${d.id}">
      <label for="d-${d.id}">${d.name}</label>
      <span class="drug-in"><input type="number" id="d-${d.id}" min="0" max="${d.max}" step="${d.step}" value="0" inputmode="decimal"><span class="unit">${d.unit}</span></span>
      <span class="drug-btns"><button type="button" class="pb-btn" data-typ="${d.id}" title="Start at ${d.typical} ${d.unit}">${d.typical}</button><button type="button" class="pb-btn" data-stop="${d.id}">Stop</button></span>
      <span class="lvl" aria-hidden="true"><span></span></span>
    </div>`).join('')}</fieldset>`).join('');
  $('#drugs').addEventListener('change', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    setDrug(st.pt, inp.id.slice(2), inp.value); syncDrugInputs(); logPanel(); drugLevels();
  });
  $('#drugs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.typ) setDrug(st.pt, b.dataset.typ, DRUG[b.dataset.typ].typical);
    if (b.dataset.stop) setDrug(st.pt, b.dataset.stop, 0);
    syncDrugInputs(); logPanel(); drugLevels();
  });
}
function syncDrugInputs() {
  for (const d of DRUGS) { const i = document.getElementById('d-' + d.id); if (i && document.activeElement !== i) i.value = st.pt.drugs[d.id].rate; }
}
function drugLevels() {
  for (const d of DRUGS) {
    const s = st.pt.drugs[d.id], row = document.querySelector(`.drug[data-id="${d.id}"]`);
    if (!row) continue;
    const frac = Math.min(1, s.ce / d.max);
    row.querySelector('.lvl span').style.width = `${(frac * 100).toFixed(1)}%`;
    row.classList.toggle('on', s.rate > 0 || s.ce > d.max * 0.005);
    row.title = s.rate > 0 || s.ce > 0.001 ? `Effect-site level ${s.ce.toPrecision(2)} ${d.unit} (${s.rate > 0 ? Math.round(100 * s.ce / s.rate) + '% of the running rate' : 'wearing off'})` : '';
  }
}

function interfacePanel(o) {
  $('#ifaces').innerHTML = interfaces(o).map((x) => `<div class="iface ${x.ok ? 'ok' : 'bad'}">
    <h3><span class="iface-n">${x.id}</span>${x.name}<span class="iface-s">${x.ok ? 'coupled' : 'uncoupled'}</span></h3>
    <table class="data metrics"><tbody>${x.checks.map(([k, v, ok]) => `<tr class="${ok === false ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}${ok === false ? ' *' : ''}</td></tr>`).join('')}</tbody></table>
  </div>`).join('');
}

function numbers(o) {
  const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
  const rows = [
    ['O₂ delivery (DO₂)', `${f0(o.do2)} mL/min`, `${f1(o.do2kg)} mL/min/kg`],
    ['O₂ consumption (VO₂)', `${f0(o.vo2)} mL/min`, `extraction ${f2(o.er)}`],
    ['Hemoglobin', `${f1(o.hb)} g/dL`, ''],
    ['PCO₂ gap', `${f1(o.gap)} mmHg`, ''],
    ['Pmsf', `${f1(o.pmsf)} mmHg`, `Pmsf − CVP ${f1(o.vrGrad)}`],
    ['Resistance to venous return', `${(o.rvr * 1000).toFixed(0)}`, 'mmHg·s/L'],
    ['Critical closing pressure', `${f0(o.pcc)} mmHg`, 'illustrative'],
    ['Tissue perfusion pressure', `${f0(o.tpp)} mmHg`, 'MAP − Pcc'],
    ['LA pressure', `${f0(o.lap)} mmHg`, ''],
    ['LVOT peak gradient', `${f0(o.grad)} mmHg`, ''],
    ['Net intravascular volume', `${o.balance >= 0 ? '+' : ''}${f0(o.balance)} mL`, `given ${f0(o.given)}, bled ${f0(o.bled)}`],
  ];
  $('#nums').innerHTML = `<table class="data metrics"><tbody>${rows.map(([k, v, n]) => `<tr><td>${k}</td><td class="num cur">${v}</td><td class="status">${n}</td></tr>`).join('')}</tbody></table>`;
}

function loopPts(r, side) {
  const V = side === 'lv' ? r.rec.Vlv : r.rec.Vrv, Pr = side === 'lv' ? r.rec.Plv : r.rec.Prv, out = [];
  for (let i = 0; i < V.length; i += 4) out.push([V[i], Pr[i]]);
  out.push(out[0]);
  return out;
}
function drawLoops() {
  const r = st.pt.r;
  for (const side of ['lv', 'rv']) {
    const svg = document.getElementById('pv-' + side);
    const W = Math.max(300, Math.min(520, svg.parentElement.clientWidth || 420)), H = Math.round(W * 0.72);
    const Pk = side === 'lv' ? 'Plv' : 'Prv', m = r[side];
    const xmax = niceMax(Math.max(m.EDV, NORM[side].EDV, st.start[side].EDV) * 1.12);
    const ymax = niceMax(Math.max(...r.rec[Pk], ...NORM.rec[Pk], ...st.start.rec[Pk]) * 1.1);
    const cl = couplingLines(m, r.params[side + 'V0']);
    drawPlot(svg, {
      width: W, height: H, xTicks: 5, yTicks: 5, title: `${side.toUpperCase()} pressure–volume loop`,
      x: { min: 0, max: xmax, label: `${side.toUpperCase()} volume (mL)` }, y: { min: 0, max: ymax, label: `${side.toUpperCase()} pressure (mmHg)` },
      series: [
        { points: loopPts(NORM, side), color: 'var(--series-ref)', width: 1.4 },
        { points: loopPts(st.start, side), color: 'var(--series-snap)', width: 1.4, dash: '5 4' },
        { points: cl.espvr, color: 'var(--series-current)', width: 1, opacity: 0.6 },
        { points: cl.ea, color: 'var(--series-current)', width: 1, dash: '4 3', opacity: 0.6 },
        { points: loopPts(r, side), color: 'var(--series-current)', width: 2.4 },
      ],
      annotations: [{ x: xmax * 0.97, y: ymax * 0.92, anchor: 'end', color: 'var(--text)',
        text: side === 'lv' ? `Ea/Ees ${m.EaEes.toFixed(2)}` : `Ees/Ea ${m.EesEa.toFixed(2)}` }],
    });
  }
}

const TRENDS = [
  ['map', 'MAP (mmHg)', 65], ['hr', 'Heart rate (/min)', null], ['co', 'Cardiac output (L/min)', null],
  ['cvp', 'CVP (mmHg)', 12], ['svo2', 'ScvO₂ (%)', 70], ['lac', 'Lactate (mmol/L)', 2],
];
function drawTrends() {
  const h = st.pt.hist, tmax = Math.max(30, Math.ceil(h[h.length - 1].t / 30) * 30);
  for (const [k, label, line] of TRENDS) {
    const svg = document.getElementById('tr-' + k);
    const vals = h.map((p) => p[k]);
    const lo = Math.min(...vals, line ?? Infinity), hi = Math.max(...vals, line ?? -Infinity);
    const pad = Math.max(1, (hi - lo) * 0.2);
    const ymin = Math.max(0, Math.floor((lo - pad) / 5) * 5), ymax = Math.ceil((hi + pad) / 5) * 5;
    drawPlot(svg, {
      width: 320, height: 170, xTicks: 4, yTicks: 4, title: label,
      x: { min: 0, max: tmax, label: 'Minutes' }, y: { min: ymin, max: ymax === ymin ? ymin + 5 : ymax, label },
      series: [
        ...(line != null ? [{ points: [[0, line], [tmax, line]], color: 'var(--flag)', width: 1, dash: '3 3' }] : []),
        { points: h.map((p) => [p.t, p[k]]), color: 'var(--series-current)', width: 2 },
      ],
    });
  }
}

// Flow against congestion: LVOT VTI (forward flow) and CVP (venous congestion), with the thresholds
// VTI 18 cm and CVP 12 mmHg dividing warm from cold and dry from wet.
function drawFK() {
  const svg = $('#fk'), h = st.pt.hist;
  const W = Math.max(300, Math.min(560, svg.parentElement.clientWidth || 480)), H = Math.round(W * 0.72);
  const xmax = Math.max(24, niceMax(Math.max(...h.map((p) => p.cvp)) * 1.15)), ymax = Math.max(35, niceMax(Math.max(...h.map((p) => p.vti)) * 1.15));
  const last = h[h.length - 1];
  drawPlot(svg, {
    width: W, height: H, xTicks: 5, yTicks: 5, title: 'Flow against congestion',
    x: { min: 0, max: xmax, label: 'CVP (mmHg)' }, y: { min: 0, max: ymax, label: 'LVOT VTI (cm)' },
    series: [
      { points: [[12, 0], [12, ymax]], color: 'var(--flag)', width: 1, dash: '3 3' },
      { points: [[0, 18], [xmax, 18]], color: 'var(--flag)', width: 1, dash: '3 3' },
      { points: h.map((p) => [p.cvp, p.vti]), color: 'var(--series-current)', width: 1.6 },
      { points: [[h[0].cvp, h[0].vti]], color: 'var(--series-snap)', marker: 5 },
      { points: [[last.cvp, last.vti]], color: 'var(--series-current)', marker: 7 },
    ],
    annotations: [
      { x: 1, y: ymax * 0.94, text: 'Warm, dry' }, { x: xmax - 1, y: ymax * 0.94, text: 'Warm, wet', anchor: 'end' },
      { x: 1, y: 2, text: 'Cold, dry' }, { x: xmax - 1, y: 2, text: 'Cold, wet', anchor: 'end' },
    ],
  });
}

function logPanel() {
  const L = st.pt.log, box = $('#log'), added = L.length > (box.dataset.n | 0);
  box.innerHTML = L.length ? L.slice().reverse().map((e, i) => `<li${added && i === 0 ? ' class="log-new"' : ''}><span class="log-t">${hm(e.t)}</span>${e.text}</li>`).join('') : '<li class="status">No treatment given yet.</li>';
  box.dataset.n = L.length;
  if (added) box.scrollTop = 0;       // newest entry is at the top; bring it into view
}

function refresh() {
  const o = st.pt.out;
  buildBeat();
  $('#clock').textContent = hm(st.pt.t);
  interfacePanel(o); numbers(o); drugLevels(); drawLoops(); drawTrends(); drawFK(); logPanel();
  if (reduce) drawMonitor(0);
}

// ---------- export ----------
function monitorSpec() {
  const sc = st.pt.sc;
  return {
    file: `va-coupling-shock-${st.id}-${Math.round(st.pt.t)}min`,
    title: `Shock lab · ${sc.label} · ${hm(st.pt.t)}`,
    caption: `Bedside monitor at ${hm(st.pt.t)} (h:min) of simulated time, generated from the model beat. Treatments given: ${st.pt.log.map((e) => `${hm(e.t)} ${e.text}`).join('; ') || 'none'}.`,
    notes: '',
    async prepare() {
      const W = 1100, h = Math.round(W * 0.46), top = 56, H = even(top + h + 12);
      const c = document.createElement('canvas'); c.width = W; c.height = h;
      const cg = c.getContext('2d'), duration = Math.ceil(3 / st.beat.T) * st.beat.T, t0 = 100 * st.beat.T;
      return {
        W, H, duration,
        async frame(g, t) {
          drawMonitor(t0 + t, { g: cg, w: W, h });
          g.fillStyle = '#05090A'; g.fillRect(0, 0, W, H);
          header(g, W, `${sc.label}`, `t = ${hm(st.pt.t)}`);
          g.drawImage(c, 0, top);
        },
      };
    },
  };
}

export function initShock() {
  $('#scn').innerHTML = SHOCK.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  $('#scn').addEventListener('change', () => { setRunning(false); load($('#scn').value); });
  $('#play').addEventListener('click', () => setRunning(!st.running));
  $('#step').addEventListener('click', () => { advance(st.pt, 5); refresh(); });
  $('#reset').addEventListener('click', () => { setRunning(false); load(st.id); });
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st.speed = +b.dataset.v;
    $('#speed').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
  const win = $('#mon-win');
  const syncWin = () => win.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.v === st.win)));
  win.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st.win = +b.dataset.v; st.sweep = null; syncWin(); if (reduce) drawMonitor(0);
  });
  syncWin();
  $('#pa-toggle').addEventListener('change', (e) => { st.showPA = e.target.checked; if (reduce) drawMonitor(0); });
  drugPanel();
  $('#fluids').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-fluid]'); if (!b) return;
    give(st.pt, b.dataset.fluid); refresh();
  });
  $('#acts').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (!b) return; action(st.pt, b.dataset.act); advance(st.pt, 0.01); refresh(); });
  $('#bleed').addEventListener('change', () => { setBleed(st.pt, +$('#bleed').value || 0); refresh(); });
  $('#uf').addEventListener('change', () => { setUF(st.pt, +$('#uf').value || 0); refresh(); });
  $('#fluids').insertAdjacentHTML('afterbegin', Object.entries(FLUIDS).map(([k, f]) => `<button type="button" class="give" data-fluid="${k}">${f.name}<small>over ${f.over} min</small></button>`).join(''));
  addExport($('#mon').parentElement, monitorSpec);
  const m = /scenario=([\w]+)/.exec(location.hash);
  load(m ? m[1] : 'normal');
  if (!reduce) requestAnimationFrame(frame); else drawMonitor(0);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => refresh(), 200); });
  document.addEventListener('themechange', () => refresh());
}

export const _shock = { st, tick, load };
