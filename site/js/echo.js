// Echo lab: synthetic Doppler and M-mode displays generated from the model beat.
// The learner measures on them the same way as on a scanner; answers come from the model.
import { simulate } from './engine.js';
import { presetById } from './presets.js';
import { addExport, header, even } from './export.js';

const LVOT_D = 2.2;                        // true LVOT diameter in this lab, cm
const TAPSE_K = 22 / simulate({}).rv.SV;   // mm of annular excursion per mL of RV stroke volume (normal ≈ 22 mm)
const CASES = [['normal', 'Normal'], ['hfref', 'HFrEF'], ['septicCM', 'Septic, low Ees'], ['pahComp', 'PAH, compensated'], ['pahDecomp', 'PAH, decompensated'], ['acutePE', 'Acute PE']];
const $ = (s) => document.querySelector(s);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let R = null;               // current simulation
const st = { ov: { lvot: false, tr: false, tap: false }, angle: 0, dMeas: LVOT_D, trace: [], trCal: null, weak: false, rapEst: 8, tap: [null, null], ed: null, es: null, frame: 0, playing: true };

// ---------- canvas helpers ----------
let off = null;             // export: { c, w } off-page canvas that stands in for the screen
function screen(id, aspect = 0.42) {
  let c, w, dpr = 1;
  if (off) ({ c, w } = off);
  else {
    c = document.getElementById(id);
    const cs = getComputedStyle(c.parentElement);
    w = Math.floor(Math.min(760, c.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    dpr = window.devicePixelRatio || 1;
  }
  const h = Math.round(w * (w < 520 ? Math.max(aspect, 0.72) : aspect));
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05090A'; g.fillRect(0, 0, w, h);
  return { c, g, w, h };
}
function rand(i) { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }   // deterministic speckle
function localXY(c, e) { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }

// Two beats of a model signal sampled at n columns.
function twoBeats(arr, n) {
  const m = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor((i / n) * 2 * m) % m];
  return out;
}

function ecg(g, x0, w, y, n) {
  g.strokeStyle = '#7CE38B'; g.lineWidth = 1.3; g.beginPath();
  for (let i = 0; i <= w; i++) {
    const ph = ((i / w) * 2) % 1;                    // two beats; QRS at activation onset
    const d = ph < 0.03 ? Math.sin(ph / 0.03 * Math.PI) * 14 * (ph < 0.015 ? 1 : -0.4) : ph > 0.3 && ph < 0.45 ? Math.sin((ph - 0.3) / 0.15 * Math.PI) * 4 : 0;
    i ? g.lineTo(x0 + i, y - d) : g.moveTo(x0 + i, y - d);
  }
  g.stroke();
}

function scale(g, x, y0, h, vmax, step, unit) {
  g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
  for (let v = 0; v <= vmax + 1e-9; v += step) { const y = y0 + (v / vmax) * h; g.fillText(`${v ? '-' : ''}${v}`, x, y + 4); g.fillRect(x + 2, y, 4, 1); }
  g.fillText(unit, x, y0 - 8);
}

// Pressure (or volume) curves drawn over an echo screen on the same time axis, with a right-hand scale.
const OV = { vent: '#5FD0BD', art: '#E8B962', atr: '#A9BCF2' };
function overlay(g, x0, pw, top, h, curves, vmax, unit) {
  g.save();
  for (const { arr, color, dash } of curves) {
    const v = twoBeats(arr, pw);
    g.strokeStyle = color; g.lineWidth = 2; g.setLineDash(dash || []); g.globalAlpha = 0.9; g.beginPath();
    for (let i = 0; i < pw; i++) { const y = top + h - (v[i] / vmax) * h; i ? g.lineTo(x0 + i, y) : g.moveTo(x0 + i, y); }
    g.stroke();
  }
  g.setLineDash([]); g.globalAlpha = 1; g.font = '11px system-ui'; g.textAlign = 'left';
  const gap = 12, widths = curves.map((c) => g.measureText(c.label).width);  // legend, right-aligned so it never clips
  let x = x0 + pw - 6 - widths.reduce((a, b) => a + b + gap, -gap);
  curves.forEach((c, k) => { g.fillStyle = c.color; g.fillText(c.label, x, top + 20); x += widths[k] + gap; });
  g.fillStyle = '#8FA39D'; g.textAlign = 'right'; g.font = '10px system-ui';
  for (const f of [0, 0.5, 1]) g.fillText(`${Math.round(vmax * f)}`, x0 + pw + 8, top + h - f * h + 3);
  g.fillText(unit, x0 + pw + 8, top + h / 2 + 15);
  g.restore();
}

// ---------- LVOT pulsed-wave Doppler ----------
function lvotV() { const A = Math.PI * (LVOT_D / 2) ** 2; return R.rec.Qao.map((q) => (q / A) / 100 * Math.cos(st.angle * Math.PI / 180)); } // m/s
function trueVTI() { const A = Math.PI * (LVOT_D / 2) ** 2; return R.rec.Qao.reduce((a, q) => a + q * R.dt, 0) / A; }         // cm

function drawLVOT() {
  const { c, g, w, h } = screen('scr-lvot');
  const x0 = 44, pw = w - x0 - 10, base = 24, vmax = 2, ph = h - base - 46;
  const v = twoBeats(lvotV(), pw);
  g.strokeStyle = '#3B4E48'; g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + pw, base); g.stroke();
  for (let i = 0; i < pw; i++) {
    const d = (v[i] / vmax) * ph;
    if (d < 1) { if (rand(i) > 0.7) { g.fillStyle = 'rgba(200,220,215,0.15)'; g.fillRect(x0 + i, base + rand(i * 3) * ph, 1, 1); } continue; }
    for (let y = 0; y < d; y += 1.5) {                 // laminar flow: bright edge, darker spectral window
      const f = y / d, a = f > 0.72 ? 0.55 + 0.45 * rand(i * 31 + y) : 0.12 * rand(i * 17 + y);
      g.fillStyle = `rgba(225,240,236,${a})`; g.fillRect(x0 + i, base + y, 1, 1.5);
    }
  }
  scale(g, x0 - 6, base, ph, vmax, 0.5, 'm/s');
  ecg(g, x0, pw, h - 14, pw);
  if (st.ov.lvot) overlay(g, x0, pw - 16, base, ph, [
    { arr: R.rec.Plv, color: OV.vent, label: 'LV' },
    { arr: R.rec.Pao, color: OV.art, dash: [5, 4], label: 'Aorta' },
    { arr: R.rec.Ppv, color: OV.atr, dash: [2, 3], label: 'LA' },
  ], Math.ceil(R.hemo.SBP * 1.15 / 10) * 10, 'mmHg');
  if (st.trace.length > 1) {
    g.strokeStyle = css('--mon-flag'); g.lineWidth = 2; g.beginPath();
    st.trace.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  c.dataset.geom = JSON.stringify({ x0, pw, base, ph, vmax, T: R.T });
  lvotOut();
}

function lvotOut() {
  queueMicrotask(cplOut);   // after this station stores its measurement
  const gm = JSON.parse($('#scr-lvot').dataset.geom || '{}');
  let vti = null;
  if (st.trace.length > 5) {
    const pts = st.trace.map(([x, y]) => [((x - gm.x0) / gm.pw) * 2 * gm.T, Math.max(0, (y - gm.base) / gm.ph * gm.vmax)]).sort((a, b) => a[0] - b[0]);
    vti = 0;
    for (let i = 1; i < pts.length; i++) vti += (pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1]) / 2 * 100;
  }
  const A = Math.PI * (st.dMeas / 2) ** 2;
  const sv = vti != null ? A * vti : null;
  const ea = sv ? 0.9 * R.hemo.SBP / sv : null;
  st.svEcho = sv;
  $('#out-lvot').innerHTML = row([
    ['Your VTI', vti != null ? `${vti.toFixed(1)} cm` : 'trace one envelope'],
    ['True VTI', `${trueVTI().toFixed(1)} cm`],
    ['LVOT area (your D)', `${A.toFixed(2)} cm²`],
    ['Echo SV', sv ? `${sv.toFixed(0)} mL` : '–', sv && Math.abs(sv / R.lv.SV - 1) > 0.15],
    ['Model SV', `${R.lv.SV.toFixed(0)} mL`],
    ['Ea ≈ 0.9·SBP/SV', ea ? `${ea.toFixed(2)} mmHg/mL` : '–'],
    ['Model Ea', `${R.lv.Ea.toFixed(2)} mmHg/mL`],
  ]);
}

function autoTraceLVOT() {
  const gm = JSON.parse($('#scr-lvot').dataset.geom), v = twoBeats(lvotV(), gm.pw);
  const end = Math.floor(gm.pw / 2);
  const pts = [];
  for (let i = 0; i < end; i += 2) pts.push([gm.x0 + i, gm.base + (v[i] / gm.vmax) * gm.ph]);
  animatePoints(pts, (p) => { st.trace = p; drawLVOT(); });
}

function animatePoints(pts, cb) {
  if (reduce) return cb(pts);
  let k = 0;
  const stepFn = () => { k = Math.min(pts.length, k + 6); cb(pts.slice(0, k)); if (k < pts.length) requestAnimationFrame(stepFn); };
  stepFn();
}

// ---------- TR continuous-wave Doppler ----------
function trV() { return R.rec.Prv.map((p, i) => (p > R.rec.Psv[i] + 1 && R.rec.Qpv[i] >= 0 && p > 8 ? Math.sqrt((p - R.rec.Psv[i]) / 4) : 0)); }
function trPeak() { return Math.max(...trV()); }

function drawTR() {
  const { c, g, w, h } = screen('scr-tr');
  const x0 = 44, pw = w - x0 - 10, base = 24, vmax = 5, ph = h - base - 46;
  const v = twoBeats(trV(), pw);
  g.strokeStyle = '#3B4E48'; g.beginPath(); g.moveTo(x0, base); g.lineTo(x0 + pw, base); g.stroke();
  for (let i = 0; i < pw; i++) {
    const d = (v[i] / vmax) * ph;
    for (let y = 0; y < d; y += 1.5) {                 // CW samples every velocity along the beam: filled envelope
      const f = y / d;
      let a = 0.25 + 0.55 * f * rand(i * 13 + y);
      if (st.weak) a *= f > 0.8 ? 0.08 : 0.45;         // poor Doppler signal: the true peak is barely visible
      g.fillStyle = `rgba(225,240,236,${a})`; g.fillRect(x0 + i, base + y, 1, 1.5);
    }
  }
  scale(g, x0 - 6, base, ph, vmax, 1, 'm/s');
  ecg(g, x0, pw, h - 14, pw);
  if (st.ov.tr) overlay(g, x0, pw - 16, base, ph, [
    { arr: R.rec.Prv, color: OV.vent, label: 'RV' },
    { arr: R.rec.Ppa, color: OV.art, dash: [5, 4], label: 'PA' },
    { arr: R.rec.Psv, color: OV.atr, dash: [2, 3], label: 'RA' },
  ], Math.ceil(Math.max(...R.rec.Prv) * 1.15 / 10) * 10, 'mmHg');
  if (st.trCal != null) {
    const y = base + (st.trCal / vmax) * ph;
    g.strokeStyle = css('--mon-flag'); g.setLineDash([6, 4]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--mon-flag'); g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText(`${st.trCal.toFixed(2)} m/s`, x0 + 6, y - 5);
  }
  c.dataset.geom = JSON.stringify({ x0, pw, base, ph, vmax });
  trOut();
}

function trOut() {
  queueMicrotask(cplOut);   // after this station stores its measurement
  const pasp = st.trCal != null ? 4 * st.trCal ** 2 + st.rapEst : null;
  st.paspEcho = pasp;
  $('#out-tr').innerHTML = row([
    ['Your peak TR velocity', st.trCal != null ? `${st.trCal.toFixed(2)} m/s` : 'drag the caliper to the peak'],
    ['4v² + RAP estimate', pasp != null ? `${pasp.toFixed(0)} mmHg` : '–', pasp != null && Math.abs(pasp - R.hemo.PASP) > 10],
    ['Catheter PASP (model)', `${R.hemo.PASP.toFixed(0)} mmHg`],
    ['Catheter RAP (model)', `${R.hemo.RAP.toFixed(0)} mmHg`],
  ]) + (st.ov.tr ? (() => {
    const i = R.rec.Prv.indexOf(Math.max(...R.rec.Prv)), grad = R.rec.Prv[i] - R.rec.Psv[i], v = Math.sqrt(grad / 4);
    return `<p class="status">At peak systole: RV ${R.rec.Prv[i].toFixed(0)} − RA ${R.rec.Psv[i].toFixed(0)} = ${grad.toFixed(0)} mmHg = 4 × ${v.toFixed(2)}² (the Doppler peak).</p>`;
  })() : '');
  tapOut();
}

// ---------- TAPSE M-mode ----------
function disp() { const edv = Math.max(...R.rec.Vrv); return R.rec.Vrv.map((v) => TAPSE_K * (edv - v)); }   // mm toward apex

function drawTAPSE() {
  const { c, g, w, h } = screen('scr-tap', 0.46);
  const x0 = 44, pw = w - x0 - 10, top = 16, ph = h - top - 30, depth = 60;   // 60 mm window
  const d = twoBeats(disp(), pw), pxmm = ph / depth;
  for (let i = 0; i < pw; i++) {
    const y0 = top + ph * 0.62 - d[i] * pxmm;           // annulus rests at 62% depth, moves up (toward the probe) in systole
    for (let y = top; y < top + ph; y += 2) {
      const rel = y - y0;
      let a = 0.05 + 0.1 * rand(i * 7 + y * 3);
      if (Math.abs(rel) < 5) a = 0.85 + 0.15 * rand(i + y);                     // bright annulus
      else if (rel > 12 && rel < 40) a = 0.25 + 0.3 * rand(i * 5 + y);          // RA wall / tissue below
      else if (rel < -30 && rel > -70) a = 0.18 + 0.25 * rand(i * 11 + y);      // RV free wall above
      g.fillStyle = `rgba(215,230,226,${a})`; g.fillRect(x0 + i, y, 1, 2);
    }
  }
  g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.textAlign = 'right';
  for (let mm = 0; mm <= depth; mm += 10) g.fillText(`${mm}`, x0 - 6, top + mm * pxmm + 4);
  g.fillText('mm', x0 - 6, top - 4);
  if (st.ov.tap) {
    const vmaxV = Math.ceil(Math.max(...R.rec.Vrv) * 1.1 / 10) * 10;
    overlay(g, x0, pw - 16, top, ph, [{ arr: R.rec.Vrv, color: OV.art, label: 'RV volume' }], vmaxV, 'mL');
  }
  st.tap.forEach((y, k) => {
    if (y == null) return;
    g.strokeStyle = css('--mon-flag'); g.setLineDash([6, 4]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--mon-flag'); g.textAlign = 'left'; g.fillText(k ? 'peak systole' : 'end-diastole', x0 + pw - 90, y - 4);
  });
  c.dataset.geom = JSON.stringify({ x0, pw, top, ph, pxmm, rest: top + ph * 0.62 });
  tapOut();
}

function tapOut() {
  queueMicrotask(cplOut);   // after this station stores its measurement
  const gm = JSON.parse($('#scr-tap').dataset.geom || '{}');
  const tapse = st.tap[0] != null && st.tap[1] != null ? Math.abs(st.tap[0] - st.tap[1]) / gm.pxmm : null;
  const pasp = st.paspEcho ?? R.hemo.PASP;
  const ratio = tapse != null ? tapse / pasp : null;
  const trueT = TAPSE_K * R.rv.SV;
  st.tapseEcho = tapse;
  $('#out-tap').innerHTML = row([
    ['Your TAPSE', tapse != null ? `${tapse.toFixed(1)} mm` : 'place both calipers'],
    ['Model TAPSE', `${trueT.toFixed(1)} mm`],
    [`PASP used (${st.paspEcho != null ? 'your TR estimate' : 'model'})`, `${pasp.toFixed(0)} mmHg`],
    ['TAPSE/PASP', ratio != null ? `${ratio.toFixed(2)} mm/mmHg` : '–', ratio != null && ratio < 0.31],
    ['Model Ees/Ea (catheter truth)', R.rv.EesEa.toFixed(2), R.rv.EesEa < 0.805],
  ]);
  drawBar(ratio);
}

function drawBar(r) {
  const svg = $('#tap-bar'), W = 600, H = 52, l = 10, pw = W - 20, max = 0.8;
  const x = (v) => l + Math.min(v, max) / max * pw;
  let s = `<rect x="${x(0)}" y="18" width="${x(0.19) - x(0)}" height="12" style="fill:var(--flag);opacity:.35"/>
    <rect x="${x(0.19)}" y="18" width="${x(0.32) - x(0.19)}" height="12" style="fill:var(--flag);opacity:.15"/>
    <rect x="${x(0.32)}" y="18" width="${x(max) - x(0.32)}" height="12" style="fill:var(--mcw-green);opacity:.2"/>`;
  for (const [v, t] of [[0.19, '0.19'], [0.31, '0.31'], [0.36, '0.36']]) s += `<line x1="${x(v)}" x2="${x(v)}" y1="14" y2="34" style="stroke:var(--text-muted)"/><text x="${x(v)}" y="46" font-size="11" text-anchor="middle" style="fill:var(--text-muted)">${t}</text>`;
  if (r != null) s += `<path d="M${x(r)},18 l-6,-10 h12 z" style="fill:var(--text)"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s;
}

// ---------- RV volumes (SV/ESV) ----------
function drawRV() {
  const { g, w, h } = screen('scr-rv', 0.5);
  const n = R.rec.Vrv.length, i = st.frame % n, V = R.rec.Vrv[i];
  const s = Math.cbrt(V / 130);                          // linear size ∝ volume^(1/3)
  const cx = w * 0.3, cy = h * 0.55;
  g.save(); g.translate(cx, cy);
  g.fillStyle = 'rgba(200,215,210,0.08)'; g.strokeStyle = 'rgba(225,240,236,0.9)'; g.lineWidth = 3;
  g.beginPath();                                          // RV crescent in an apical four-chamber orientation
  g.moveTo(0, -h * 0.4 * s);
  g.bezierCurveTo(-w * 0.2 * s, -h * 0.25 * s, -w * 0.24 * s, h * 0.2 * s, -w * 0.1 * s, h * 0.34 * s);
  g.lineTo(w * 0.06 * s, h * 0.34 * s);
  g.bezierCurveTo(w * 0.02, h * 0.1, w * 0.02, -h * 0.2, 0, -h * 0.4 * s);
  g.fill(); g.stroke(); g.restore();
  g.strokeStyle = 'rgba(225,240,236,0.35)'; g.lineWidth = 2;   // septum and LV outline for orientation
  g.beginPath(); g.ellipse(cx + w * 0.16, cy, w * 0.1, h * 0.36, 0, 0, Math.PI * 2); g.stroke();
  // mini RV pressure–volume loop with the current frame
  const lx = w * 0.7, ly = 20, lw = w * 0.27, lh = h * 0.5;
  const vmx = Math.max(...R.rec.Vrv) * 1.1, pmx = Math.max(...R.rec.Prv) * 1.15;
  const X = (v) => lx + (v / vmx) * lw, Y = (p) => ly + lh - (p / pmx) * lh;
  g.strokeStyle = '#2A3D37'; g.strokeRect(lx, ly, lw, lh);
  g.strokeStyle = OV.vent; g.lineWidth = 1.8; g.beginPath();
  for (let k = 0; k < n; k += 8) { k ? g.lineTo(X(R.rec.Vrv[k]), Y(R.rec.Prv[k])) : g.moveTo(X(R.rec.Vrv[k]), Y(R.rec.Prv[k])); }
  g.closePath(); g.stroke();
  const dot = (v, p, c, r) => { g.fillStyle = c; g.beginPath(); g.arc(X(v), Y(p), r, 0, Math.PI * 2); g.fill(); };
  for (const [vv, lab] of [[st.ed, 'ED'], [st.es, 'ES']]) if (vv != null) {
    const k = R.rec.Vrv.indexOf(vv); dot(vv, R.rec.Prv[k], OV.art, 4);
    g.fillStyle = OV.art; g.font = '10px system-ui'; g.fillText(lab, X(vv) + 5, Y(R.rec.Prv[k]) - 4);
  }
  dot(V, R.rec.Prv[i], '#fff', 4.5);
  g.fillStyle = '#8FA39D'; g.font = '10px system-ui'; g.textAlign = 'left'; g.fillText('RV PV loop', lx + 4, ly + lh + 12);
  const ph = i / n;
  g.fillStyle = '#8FA39D'; g.font = '12px system-ui'; g.textAlign = 'left';
  g.fillText(`frame ${i + 1}/${n}`, 10, 18);
  ecg(g, 10, w - 20, h - 12, w);
  g.fillStyle = css('--mon-flag'); g.fillRect(10 + ph * (w - 20) / 2, h - 30, 2, 24);
  rvOut();
}

function rvOut() {
  const r = st.ed != null && st.es != null ? (st.ed - st.es) / st.es : null;
  st.svEsvEcho = r;
  $('#out-rv').innerHTML = row([
    ['Marked EDV', st.ed != null ? `${st.ed.toFixed(0)} mL` : '–'],
    ['Marked ESV', st.es != null ? `${st.es.toFixed(0)} mL` : '–'],
    ['SV/ESV', r != null ? r.toFixed(2) : '–', r != null && r < 0.515],
    ['True Ees/Ea (model, V₀ = ' + R.params.rvV0 + ' mL)', R.rv.EesEa.toFixed(2)],
  ]);
}

let lastT = 0;
function playRV(now) {
  if (st.playing && R && now - lastT > 4000 * R.T / 60) {    // 60 frames per beat, quarter speed
    lastT = now; st.frame = (st.frame + Math.max(1, Math.round(R.rec.Vrv.length / 60))) % R.rec.Vrv.length; drawRV();
  }
  requestAnimationFrame(playRV);
}

// ---------- shared ----------
function row(items) {
  return `<table class="data metrics"><tbody>${items.map(([k, v, bad]) => `<tr class="${bad ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}</td></tr>`).join('')}</tbody></table>`;
}

function seg(id, opts, get, set) {
  const box = document.getElementById(id);
  box.innerHTML = opts.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('');
  const sync = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === get())));
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; set(+b.dataset.v); sync(); });
  sync();
}

function loadCase(id) {
  st.caseId = id;
  R = simulate(presetById(id).params);
  Object.assign(st, { trace: [], trCal: null, tap: [null, null], ed: null, es: null, paspEcho: null, svEcho: null, tapseEcho: null, svEsvEcho: null });
  document.querySelectorAll('#cases button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  drawAll();
}
function drawAll() { drawLVOT(); drawTR(); drawTAPSE(); drawRV(); cplOut(); }

// ---------- "Coupling from echo" worked example ----------
// Uses the learner's measurements where made, otherwise the model's values, and shows the
// catheter (model) truth for comparison.
function cplOut() {
  const src = (mine) => `<span class="src">${mine ? 'yours' : 'model'}</span>`;
  const sv = st.svEcho ?? R.lv.SV, sbp = R.hemo.SBP, ef = R.lv.EF;
  const ea = 0.9 * sbp / sv, ratio = (1 - ef) / ef, ees = ea / ratio;
  $('#cpl-lv').innerHTML = row([
    [`Stroke volume ${src(st.svEcho != null)}`, `${sv.toFixed(0)} mL`],
    ['Cuff SBP', `${sbp.toFixed(0)} mmHg`],
    ['Ea = 0.9 × SBP / SV', `${ea.toFixed(2)} mmHg/mL`, Math.abs(ea / R.lv.Ea - 1) > 0.25],
    [`EF ${src(false)} (biplane in practice)`, `${(ef * 100).toFixed(0)}%`],
    ['Ea/Ees ≈ (1 − EF)/EF', ratio.toFixed(2), ratio > 1.36],
    ['Implied Ees = Ea ÷ ratio', `${ees.toFixed(2)} mmHg/mL`],
  ]) + `<p class="truth">Catheter truth: Ea ${R.lv.Ea.toFixed(2)}, Ees ${R.lv.Ees.toFixed(2)} mmHg/mL, Ea/Ees <b>${R.lv.EaEes.toFixed(2)}</b> · normal 1.43, 2.30, 0.62</p>`;
  const tapse = st.tapseEcho ?? TAPSE_K * R.rv.SV, pasp = st.paspEcho ?? R.hemo.PASP, tp = tapse / pasp;
  const svEsv = st.svEsvEcho ?? R.rv.svEsv;
  $('#cpl-rv').innerHTML = row([
    [`TAPSE ${src(st.tapseEcho != null)}`, `${tapse.toFixed(1)} mm`],
    [`PASP ${src(st.paspEcho != null)}`, `${pasp.toFixed(0)} mmHg`],
    ['TAPSE/PASP', `${tp.toFixed(2)} mm/mmHg`, tp < 0.31],
    [`SV/ESV ${src(st.svEsvEcho != null)}`, svEsv.toFixed(2), svEsv <= 0.515],
  ]) + `<p class="truth">Catheter truth: RV Ees/Ea <b>${R.rv.EesEa.toFixed(2)}</b>${R.rv.EesEa < 0.805 ? ' (below 0.805)' : ''} · normal 2.00</p>`;
}

export function initEcho() {
  $('#cases').innerHTML = CASES.map(([id, t]) => `<button type="button" data-id="${id}">${t}</button>`).join('');
  $('#cases').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) loadCase(b.dataset.id); });

  // LVOT: trace by dragging along the envelope
  const cl = $('#scr-lvot');
  let tracing = false;
  cl.addEventListener('pointerdown', (e) => { tracing = true; st.trace = [localXY(cl, e)]; cl.setPointerCapture(e.pointerId); });
  cl.addEventListener('pointermove', (e) => { if (tracing) { st.trace.push(localXY(cl, e)); drawLVOT(); } });
  cl.addEventListener('pointerup', () => { tracing = false; drawLVOT(); });
  $('#lvot-show').addEventListener('click', autoTraceLVOT);
  $('#lvot-clear').addEventListener('click', () => { st.trace = []; drawLVOT(); });
  seg('lvot-angle', [[0, '0°'], [20, '20°'], [40, '40°']], () => st.angle, (v) => { st.angle = v; st.trace = []; drawLVOT(); });
  seg('lvot-d', [[2.0, '2.0 cm'], [2.2, '2.2 cm (true)'], [2.4, '2.4 cm']], () => st.dMeas, (v) => { st.dMeas = v; lvotOut(); });

  // TR: caliper follows the pointer while pressed
  const ct = $('#scr-tr');
  let calOn = false;
  const setCal = (e) => { const gm = JSON.parse(ct.dataset.geom); const [, y] = localXY(ct, e); st.trCal = Math.max(0, Math.min(gm.vmax, (y - gm.base) / gm.ph * gm.vmax)); drawTR(); };
  ct.addEventListener('pointerdown', (e) => { calOn = true; ct.setPointerCapture(e.pointerId); setCal(e); });
  ct.addEventListener('pointermove', (e) => calOn && setCal(e));
  ct.addEventListener('pointerup', () => { calOn = false; });
  $('#tr-show').addEventListener('click', () => { st.trCal = trPeak(); drawTR(); });
  seg('tr-rap', [[3, 'IVC ≤ 2.1 cm, collapses > 50%: 3'], [8, 'Indeterminate: 8'], [15, 'IVC > 2.1 cm, collapses < 50%: 15']], () => st.rapEst, (v) => { st.rapEst = v; trOut(); });
  seg('tr-weak', [[0, 'Good signal'], [1, 'Weak signal']], () => +st.weak, (v) => { st.weak = !!v; drawTR(); });

  // TAPSE: first press sets end-diastole caliper, second sets peak systole; drag moves the nearest
  const cp = $('#scr-tap');
  let capOn = -1;
  cp.addEventListener('pointerdown', (e) => {
    const [, y] = localXY(cp, e);
    capOn = st.tap[0] == null ? 0 : st.tap[1] == null ? 1 : Math.abs(st.tap[0] - y) < Math.abs(st.tap[1] - y) ? 0 : 1;
    st.tap[capOn] = y; cp.setPointerCapture(e.pointerId); drawTAPSE();
  });
  cp.addEventListener('pointermove', (e) => { if (capOn >= 0) { st.tap[capOn] = localXY(cp, e)[1]; drawTAPSE(); } });
  cp.addEventListener('pointerup', () => { capOn = -1; });
  $('#tap-show').addEventListener('click', () => {
    const gm = JSON.parse(cp.dataset.geom);
    st.tap = [gm.rest, gm.rest - Math.max(...disp()) * gm.pxmm]; drawTAPSE();
  });

  for (const k of ['lvot', 'tr', 'tap']) {
    const b = document.getElementById('ov-' + k);
    b.addEventListener('click', () => { st.ov[k] = !st.ov[k]; b.setAttribute('aria-pressed', String(st.ov[k])); drawAll(); });
  }

  // RV volumes: freeze and mark frames
  $('#rv-play').addEventListener('click', () => { st.playing = !st.playing; $('#rv-play').textContent = st.playing ? 'Freeze' : 'Play'; });
  $('#rv-back').addEventListener('click', () => { st.playing = false; st.frame = (st.frame - 20 + R.rec.Vrv.length) % R.rec.Vrv.length; $('#rv-play').textContent = 'Play'; drawRV(); });
  $('#rv-fwd').addEventListener('click', () => { st.playing = false; st.frame = (st.frame + 20) % R.rec.Vrv.length; $('#rv-play').textContent = 'Play'; drawRV(); });
  $('#rv-ed').addEventListener('click', () => { st.ed = R.rec.Vrv[st.frame % R.rec.Vrv.length]; rvOut(); cplOut(); });
  $('#rv-es').addEventListener('click', () => { st.es = R.rec.Vrv[st.frame % R.rec.Vrv.length]; rvOut(); cplOut(); });

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
  for (const id of Object.keys(EXPORTS)) addExport(document.getElementById(id).parentElement, () => echoSpec(id), { still: !EXPORTS[id].animated });
  loadCase('normal');
  if (reduce) st.playing = false;
  requestAnimationFrame(playRV);
}

// ---------- export for slides ----------
// Static screens export as one frame; the RV station exports one beat at quarter speed.
const EXPORTS = {
  'scr-lvot': { draw: () => drawLVOT(), name: 'lvot', title: 'LVOT pulsed-wave Doppler',
    caption: () => `Pulsed-wave Doppler in the LVOT, two beats, generated from the model. VTI × LVOT area = stroke volume; Ea ≈ 0.9 × SBP / SV.${st.ov.lvot ? ' Overlay: LV (solid), aortic (dashed) and LA (dotted) pressure, right-hand scale: flow runs only while LV pressure exceeds aortic pressure.' : ''}`,
    notes: () => `Model SV ${R.lv.SV.toFixed(0)} mL, BP ${R.hemo.SBP.toFixed(0)}/${R.hemo.DBP.toFixed(0)} mmHg, model Ea ${R.lv.Ea.toFixed(2)} mmHg/mL.` },
  'scr-tr': { draw: () => drawTR(), name: 'tr', title: 'TR continuous-wave Doppler',
    caption: () => `Continuous-wave Doppler of the tricuspid regurgitant jet, generated from the model. Peak velocity v gives the RV–RA gradient 4v²; PASP ≈ 4v² + RAP.${st.ov.tr ? ' Overlay: RV (solid), PA (dashed) and RA (dotted) pressure: the jet velocity follows the RV–RA difference.' : ''}`,
    notes: () => `Catheter (model) PASP ${R.hemo.PASP.toFixed(0)} mmHg, RAP ${R.hemo.RAP.toFixed(0)} mmHg.` },
  'scr-tap': { draw: () => drawTAPSE(), name: 'tapse', title: 'TAPSE M-mode',
    caption: () => `M-mode through the lateral tricuspid annulus, generated from the model. TAPSE = annular excursion from end-diastole to peak systole; TAPSE/PASP is a coupling surrogate.${st.ov.tap ? ' Overlay: RV volume: the annulus moves toward the apex as the RV empties.' : ''}`,
    notes: () => `Model TAPSE ${(R.rv.SV * TAPSE_K).toFixed(1)} mm, PASP ${R.hemo.PASP.toFixed(0)} mmHg, RV Ees/Ea ${R.rv.EesEa.toFixed(2)}.` },
  'scr-rv': { draw: () => drawRV(), name: 'rv', title: 'RV volumes through one beat', animated: true,
    caption: () => 'RV in an apical four-chamber view, one beat at quarter speed, generated from the model. Right: the RV pressure–volume loop; the white dot is the current frame. SV/ESV approximates Ees/Ea if V₀ ≈ 0.',
    notes: () => `RV EDV ${R.rv.EDV.toFixed(0)} mL, ESV ${R.rv.ESV.toFixed(0)} mL, SV/ESV ${R.rv.svEsv.toFixed(2)}, true Ees/Ea ${R.rv.EesEa.toFixed(2)} (V₀ = ${R.params.rvV0} mL).` },
};
function echoSpec(id) {
  const x = EXPORTS[id], label = (CASES.find(([k]) => k === st.caseId) || [, ''])[1];
  return {
    file: `va-coupling-echo-${x.name}-${st.caseId}`,
    title: `${x.title} · ${label}`,
    caption: x.caption(), notes: x.notes(),
    async prepare() {
      const saved = { playing: st.playing, frame: st.frame };
      st.playing = false;
      const W = 1100, top = 56, cv = document.createElement('canvas');
      off = { c: cv, w: W };
      x.draw();
      const sh = cv.height, H = even(top + sh + 8), n = R.rec.Vrv.length;
      off = null;
      return {
        W, H, duration: x.animated ? 4 * R.T : 1,
        async frame(g, t) {
          if (x.animated) st.frame = Math.min(n - 1, Math.floor((t / 4) / R.T * n));
          off = { c: cv, w: W }; x.draw(); off = null;
          g.fillStyle = '#05090A'; g.fillRect(0, 0, W, H);
          header(g, W, `${x.title} · ${label}`, x.animated ? `RV volume ${R.rec.Vrv[st.frame].toFixed(0)} mL` : 'model-generated');
          g.drawImage(cv, 0, top);
        },
        done() { Object.assign(st, saved); drawAll(); },
      };
    },
  };
}

// For tests: quantities the lab derives from the model.
export const _test = { LVOT_D, TAPSE_K };

// Schematic apical views with the cursor placement for each measurement.
export function drawViews() {
  document.querySelectorAll('[data-view]').forEach((el) => {
    const k = el.dataset.view;
    const hi = (name) => (name === 'rv' && (k === 'rv' || k === 'tap') ? 'stroke:var(--mon-current);stroke-width:2.5' : 'stroke:#6E817B;stroke-width:1.5');
    const cursor = {
      lvot: '<line x1="80" y1="8" x2="83" y2="96" class="vc"/><rect x="78" y="92" width="10" height="5" class="vg"/>',
      tr: '<line x1="80" y1="8" x2="52" y2="112" class="vc"/>',
      tap: '<line x1="80" y1="8" x2="36" y2="100" class="vc"/><circle cx="37" cy="99" r="3.5" class="vg"/>',
      rv: '',
    }[k];
    el.innerHTML = `<svg viewBox="0 0 160 150" role="img" aria-label="Apical ${k === 'lvot' ? 'five' : 'four'}-chamber schematic">
      <path d="M80,6 L8,138 Q80,158 152,138 Z" style="fill:#0E1A17;stroke:#22352F"/>
      <ellipse cx="57" cy="62" rx="19" ry="36" style="fill:none;${hi('rv')}"/>
      <ellipse cx="101" cy="60" rx="22" ry="40" style="fill:none;${hi('lv')}"/>
      <ellipse cx="55" cy="120" rx="19" ry="15" style="fill:none;${hi('ra')}"/>
      <ellipse cx="103" cy="120" rx="20" ry="15" style="fill:none;${hi('la')}"/>
      ${k === 'lvot' ? '<path d="M78,100 Q80,118 82,135" style="fill:none;stroke:#6E817B;stroke-width:6;opacity:.6"/>' : ''}
      <text x="57" y="66" class="vt">RV</text><text x="101" y="64" class="vt">LV</text><text x="55" y="124" class="vt">RA</text><text x="103" y="124" class="vt">LA</text>
      <path d="M72,2 h16 l-3,7 h-10 z" style="fill:#8FA39D"/>${cursor}</svg>`;
  });
}
