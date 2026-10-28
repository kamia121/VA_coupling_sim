// ICU diastology lab: patient and intervention controls, Doppler tiles, color M-mode with a Nyquist control and
// a slope measured by dragging, estimated against model LA pressure, and the volume steps of each patient.
import { drawPlot, svgPoint, svgEl, swatch } from './plot.js';
import { PATIENTS, VOLS, icuState, mmodeField, contour, fitSlope, MM, EF_EEP_INVALID } from './vpcore.js';

const $ = (s) => document.querySelector(s);
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const C_VP = '#3987e5', C_EEP = '#d95926';    // E/Vp and E/e′ estimates on the monitor surface (validated pair)

function seg(host, items, current, onPick) {
  host.innerHTML = items.map(([id, label]) => `<button type="button" data-id="${id}" aria-pressed="${String(id) === String(current)}">${label}</button>`).join('');
  host.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    host.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.id);
  };
}

export function initIcu() {
  const S = { pt: 'septicCM', vol: 0, ino: false, af: false, annulus: true, nyqShare: MM.nyqShare, show: true };
  const cache = new Map();
  const state = (vol) => {
    const k = `${S.pt}|${vol}|${S.ino}|${S.af}`;
    if (!cache.has(k)) cache.set(k, icuState(S.pt, { vol, ino: S.ino, af: S.af }));
    return cache.get(k);
  };

  $('#icu-patient').innerHTML = PATIENTS.map((p) => `<option value="${p.id}"${p.id === S.pt ? ' selected' : ''}>${p.label}</option>`).join('');
  $('#icu-patient').onchange = (e) => { S.pt = e.target.value; render(); };
  seg($('#icu-vol'), VOLS.map((v) => [v, v === 0 ? 'None' : `${v > 0 ? '+' : '−'}${Math.abs(v) / 1000} L`]), S.vol, (v) => { S.vol = +v; render(); });
  seg($('#icu-ino'), [['0', 'Off'], ['1', 'On']], '0', (v) => { S.ino = v === '1'; render(); });
  seg($('#icu-rhythm'), [['sinus', 'Sinus'], ['af', 'AF at 110/min']], 'sinus', (v) => { S.af = v === 'af'; render(); });
  seg($('#icu-annulus'), [['1', 'Recordable'], ['0', 'Not recordable']], '1', (v) => { S.annulus = v === '1'; render(); });
  $('#mm-nyq').oninput = (e) => { S.nyqShare = +e.target.value / 100; drawMmode(); };
  $('#mm-show').onchange = (e) => { S.show = e.target.checked; drawMmode(); };

  let cur = null, field = null, drag = null;

  function render() {
    $('#icu-status').textContent = 'Solving…';
    // let the status paint before the solver runs
    setTimeout(() => {
      cur = state(S.vol);
      field = mmodeField(cur.sol.r, cur.Vp);
      drag = null;
      tiles(); drawMmode(); sweep();
      $('#icu-status').textContent = '';
    }, 10);
  }

  function tiles() {
    const s = cur, eepOk = S.annulus && !s.eepInvalid;
    const t = (k, v, sub, off = false) => `<div class="tile${off ? ' off' : ''}"><div class="tile-v">${v}</div><div class="tile-k">${k} <span>${sub}</span></div></div>`;
    $('#icu-tiles').innerHTML = [
      t('Mean LA pressure', `${f(s.LAP, 1)} mmHg`, 'model value'),
      t('Ejection fraction', `${f(s.EF * 100)}%`, `τ ${f(s.e.tauMs)} ms`),
      t('Mitral E', `${f(s.E)} cm/s`, S.af ? 'mean of irregular beats' : 'peak early velocity'),
      t('Vp', `${f(s.Vp)} cm/s`, 'scaled from τ and EF'),
      t('E/Vp', f(s.EVp, 2), `LA pressure estimate ${f(s.pcwpVp, 1)} mmHg`),
      S.annulus
        ? t('Lateral E/e′', f(s.Eep, 1), s.eepInvalid ? `not a valid comparator at EF below ${EF_EEP_INVALID * 100}%` : `e′ ${f(s.ep, 1)} cm/s; estimate ${f(s.pcwpEep, 1)} mmHg`, !eepOk)
        : t('Lateral E/e′', 'not recordable', 'annular velocities unavailable', true),
    ].join('');
  }

  // ---------- color M-mode ----------
  const W = 720, H = 320, M = { l: 52, r: 12, t: 12, b: 36 };
  function drawMmode() {
    if (!field) return;
    const cv = $('#mm-canvas'), g = cv.getContext('2d');
    cv.width = W; cv.height = H;
    const F = field, N = S.nyqShare * F.E;
    const tLo = F.t0 - 0.02, tHi = F.T, xLo = -MM.laDepth, xHi = F.L;
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const px = (t) => M.l + ((t - tLo) / (tHi - tLo)) * pw, py = (x) => M.t + ph - ((x - xLo) / (xHi - xLo)) * ph;
    g.fillStyle = '#05090A'; g.fillRect(0, 0, W, H);
    const img = g.createImageData(pw, ph);
    for (let j = 0; j < ph; j++) {
      const x = xHi - (j / ph) * (xHi - xLo);
      for (let i = 0; i < pw; i++) {
        const t = tLo + (i / pw) * (tHi - tLo);
        const v = F.at(x, t);
        const va = (((v + N) % (2 * N)) + 2 * N) % (2 * N) - N;   // aliased into [−N, N)
        const k = Math.abs(va) / N, o = 4 * (j * pw + i);
        if (v < 0.04 * N || k < 0.04) { img.data[o + 3] = 255; continue; }   // wall filter
        if (va >= 0) { img.data[o] = 70 + 185 * k; img.data[o + 1] = 210 * Math.max(0, k - 0.55) / 0.45; img.data[o + 2] = 0; }
        else { img.data[o] = 0; img.data[o + 1] = 200 * Math.max(0, k - 0.5) / 0.5; img.data[o + 2] = 90 + 165 * k; }
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, M.l, M.t);
    // axes
    g.strokeStyle = '#2A3D37'; g.fillStyle = '#8FA39D'; g.font = '11px system-ui'; g.lineWidth = 1;
    g.textAlign = 'right';
    for (let x = 0; x <= xHi + 1e-9; x += 2) { const y = py(x); g.fillText(`${x}`, M.l - 6, y + 4); g.beginPath(); g.moveTo(M.l - 3, y); g.lineTo(M.l, y); g.stroke(); }
    g.save(); g.translate(14, M.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('Distance from the mitral tips toward the apex, cm', 0, 0); g.restore();
    g.textAlign = 'center';
    for (let t = F.t0; t <= tHi + 1e-9; t += 0.1) { const x = px(t); g.fillText(`${Math.round((t - F.t0) * 1000)}`, x, H - M.b + 16); g.beginPath(); g.moveTo(x, H - M.b); g.lineTo(x, H - M.b + 3); g.stroke(); }
    g.fillText('Time from aortic valve closure, ms', M.l + pw / 2, H - 4);
    // mitral plane
    g.strokeStyle = '#7E918B'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(M.l, py(0)); g.lineTo(M.l + pw, py(0)); g.stroke(); g.setLineDash([]);
    // fitted slope of the first aliasing contour
    const pts = contour(F, N), slope = fitSlope(pts);
    if (S.show && pts.length >= 5) {
      const mt = pts.reduce((a, p) => a + p[0], 0) / pts.length, mx = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const tA = mt - mx / slope, tB = mt + (MM.span - mx) / slope;
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(px(tA), py(0)); g.lineTo(px(tB), py(MM.span)); g.stroke(); g.setLineDash([]);
    }
    $('#mm-nyq-v').textContent = `${f(N)} cm/s (${f(S.nyqShare * 100)}% of E)`;
    const user = drag && drag.b ? (drag.b.x - drag.a.x) / (drag.b.t - drag.a.t) : NaN;
    $('#mm-out').innerHTML = `Slope of the first aliasing contour over the first ${MM.span} cm at this Nyquist limit: <b>${Number.isFinite(slope) ? `${f(slope)} cm/s` : 'the contour does not reach far enough'}</b>. ` +
      `Vp of the model (Nyquist limit at half of E): <b>${f(cur.Vp)} cm/s</b>.` + (Number.isFinite(user) && Math.abs(drag.b.t - drag.a.t) > 0.005 ? ` Your line: <b>${f(user)} cm/s</b>.` : '');
    overlay(px, py, tLo, tHi, xLo, xHi);
  }

  // drag a line on the M-mode; its slope is reported in cm/s
  function overlay(px, py, tLo, tHi, xLo, xHi) {
    const svg = $('#mm-overlay');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const toData = (p) => ({ t: tLo + ((p.x - M.l) / pw) * (tHi - tLo), x: xLo + ((M.t + ph - p.y) / ph) * (xHi - xLo) });
    if (drag && drag.b) svgEl('line', { x1: px(drag.a.t), y1: py(drag.a.x), x2: px(drag.b.t), y2: py(drag.b.x), stroke: '#FFE08A', 'stroke-width': 2.5 }, svg);
    svg.onpointerdown = (e) => { svg.setPointerCapture(e.pointerId); const d = toData(svgPoint(svg, e)); drag = { a: d, b: d }; };
    svg.onpointermove = (e) => { if (!drag || !svg.hasPointerCapture(e.pointerId)) return; drag.b = toData(svgPoint(svg, e)); drawMmode(); };
    svg.onpointerup = (e) => { if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); };
  }

  // ---------- volume steps ----------
  function sweep() {
    const rows = VOLS.map((v) => ({ v, s: state(v) }));
    const eepShown = S.annulus && !rows[0].s.eepInvalid;
    $('#icu-sweep tbody').innerHTML = rows.map(({ v, s }) => `<tr${v === S.vol ? ' class="cur-row"' : ''}><td>${v === 0 ? 'As found' : `${v > 0 ? '+' : '−'}${Math.abs(v) / 1000} L`}</td>` +
      `<td class="num">${f(s.LAP, 1)}</td><td class="num">${f(s.E)}</td><td class="num">${f(s.Vp)}</td><td class="num">${f(s.EVp, 2)}</td><td class="num">${f(s.pcwpVp, 1)}</td>` +
      `<td class="num">${S.annulus ? f(s.Eep, 1) : '–'}</td><td class="num">${eepShown ? f(s.pcwpEep, 1) : '–'}</td></tr>`).join('');
    $('#icu-sweep-note').textContent = !S.annulus ? 'Annular velocities are not recordable, so E/e′ is not reported.'
      : rows[0].s.eepInvalid ? `EF is below ${EF_EEP_INVALID * 100}%. Lateral e′ in the model depends on τ alone and does not fall with systolic dysfunction, so its E/e′ understates LA pressure here and no estimate is given from it.` : '';
    // estimate against model LA pressure
    const lo = 0, hi = Math.max(30, Math.ceil(Math.max(...rows.map((r) => Math.max(r.s.LAP, r.s.pcwpVp, r.s.pcwpEep))) / 5) * 5);
    const series = [
      { points: [[lo, lo], [hi, hi]], color: 'var(--mon-axis)', width: 1.2, dash: '4 4' },
      { points: rows.map((r) => [r.s.LAP, r.s.pcwpVp]), color: C_VP, width: 2 },
      { points: rows.map((r) => [r.s.LAP, r.s.pcwpVp]), color: C_VP, marker: 4.5 },
    ];
    if (eepShown) series.push({ points: rows.map((r) => [r.s.LAP, r.s.pcwpEep]), color: C_EEP, width: 2, dash: '6 3' },
      { points: rows.map((r) => [r.s.LAP, r.s.pcwpEep]), color: C_EEP, marker: 4.5 });
    const P = drawPlot($('#icu-est'), { width: 560, height: 300, x: { min: lo, max: hi, label: 'Mean LA pressure of the model, mmHg' }, y: { min: lo, max: hi, label: 'Estimated LA pressure, mmHg' },
      series, title: 'LA pressure estimated from E/Vp and from E/e′ against the model value across the volume steps' });
    // native tooltips on each point
    for (const r of rows) {
      const add = (y, k) => { const c = svgEl('circle', { cx: P.sx(r.s.LAP), cy: P.sy(y), r: 9, fill: 'transparent' }, P.svg); svgEl('title', {}, c).textContent = `${r.v === 0 ? 'As found' : `${r.v > 0 ? '+' : '−'}${Math.abs(r.v) / 1000} L`}: model ${f(r.s.LAP, 1)} mmHg, ${k} ${f(y, 1)} mmHg`; };
      add(r.s.pcwpVp, 'from E/Vp');
      if (eepShown) add(r.s.pcwpEep, 'from E/e′');
    }
    $('#icu-est-legend').innerHTML = `<span>${swatch(C_VP)} From E/Vp (Garcia 1997)</span>` + (eepShown ? ` <span>${swatch(C_EEP, '6 3')} From lateral E/e′ (Nagueh 1997)</span>` : '') + ` <span>${swatch('var(--mon-axis)', '4 4', 1.2)} Identity</span>`;
  }

  render();
}
