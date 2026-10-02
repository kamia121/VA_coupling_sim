// Pressure lab: reference level and zero, PEEP, and the dynamic response of a fluid-filled catheter.
import { simulate } from './engine.js';
import { PRESETS, presetById } from './presets.js';
import { drawPlot, svgEl } from './plot.js';
import {
  MMHG_CM, POSTURES, SITES, siteHeight, transducerHeight, arterialAt, venousAt, capillaryP, reading,
  pleuralFromPeep, secondOrder, flushTest, respond, beatStats,
} from './pressurecore.js';

const $ = (s) => document.querySelector(s);
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const PATIENTS = ['normal', 'vasoplegia', 'hfref', 'septicCM'];
const MOUNTS = [
  ['axis', 'Leveled to the heart'],
  ['bed', 'Left where the heart was when supine'],
  ['site', 'At the vessel'],
  ['custom', 'At the height set below'],
];
const SYSTEMS = [
  ['good', 'Well tuned', 17.9, 0.65],
  ['bubble', 'Air bubble', 7.35, 0.36],
  ['over', 'Overdamped (clot, kink)', 17.9, 1.6],
  ['long', 'Long compliant tubing', 9, 0.4],
];
const TRANSMIT = [['0.24', 'Stiff lungs, 24%'], ['0.34', 'Injured lungs, 34%'], ['0.62', 'Normal lungs, 62%']];

function seg(host, items, current, onPick) {
  host.innerHTML = items.map(([id, label]) => `<button type="button" data-id="${id}" aria-pressed="${id === current}">${label}</button>`).join('');
  host.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    host.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.id);
  };
}
const pressed = (host) => host.querySelector('[aria-pressed="true"]').dataset.id;

export function initPressure() {
  const S = { patient: 'normal', posture: 'supine', site: 'radial', mount: 'axis', h: 0, zero: 0, peep: 10, frac: '0.34', sys: 'bubble', fn: 7.35, z: 0.36, hr: 80 };
  const cache = {};
  const run = (id, extra = {}) => {
    const k = id + JSON.stringify(extra);
    return cache[k] ??= simulate({ ...presetById(id).params, ...extra });
  };
  const heartOf = (id) => { const h = run(id).hemo; return { sbp: h.SBP, dbp: h.DBP, map: h.MAP, rap: h.RAP }; };

  // ---------- panel 1: reference level and zero ----------
  const patSel = $('#pl-patient'), siteSel = $('#pl-site');
  patSel.innerHTML = PATIENTS.map((id) => `<option value="${id}">${presetById(id).label}</option>`).join('');
  siteSel.innerHTML = SITES.map((s) => `<option value="${s.id}"${s.id === S.site ? ' selected' : ''}>${s.label}</option>`).join('');
  seg($('#pl-posture'), POSTURES.map((p) => [p.id, p.label]), S.posture, (v) => { S.posture = v; level(); });
  seg($('#pl-mount'), MOUNTS, S.mount, (v) => { S.mount = v; level(); });
  patSel.onchange = () => { S.patient = patSel.value; level(); peepPanel(); };
  siteSel.onchange = () => { S.site = siteSel.value; level(); };
  $('#pl-height').oninput = (e) => { S.h = +e.target.value; S.mount = 'custom'; syncMount(); level(); };
  $('#pl-zero').oninput = (e) => { S.zero = +e.target.value; level(); };
  const syncMount = () => $('#pl-mount').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === S.mount)));

  function body(post, hSite, hTrans, siteLabel) {
    const svg = $('#pl-body'); svg.innerHTML = '';
    const ang = (post.angle * Math.PI) / 180;
    const ox = 170, oy = 148, sc = 1.5;                 // hip joint, pixels per cm
    const P = (cm, a) => [ox + cm * Math.cos(a) * sc, oy - cm * Math.sin(a) * sc];
    const legAng = post.standing ? -Math.PI / 2 : 0;
    const torsoEnd = P(65 + 20, ang), heart = P(40, ang);
    const foot = post.standing ? [ox, oy + 78 * sc] : [ox - 78 * sc, oy];
    svgEl('line', { x1: foot[0], y1: foot[1], x2: ox, y2: oy, stroke: 'var(--mon-axis)', 'stroke-width': 10, 'stroke-linecap': 'round' }, svg);
    svgEl('line', { x1: ox, y1: oy, x2: torsoEnd[0], y2: torsoEnd[1], stroke: 'var(--mon-axis)', 'stroke-width': 22, 'stroke-linecap': 'round' }, svg);
    const hy = heart[1];
    svgEl('line', { x1: 20, x2: 420, y1: hy, y2: hy, stroke: 'var(--mcw-green)', 'stroke-dasharray': '5 4' }, svg);
    svgEl('text', { x: 420, y: hy - 5, fill: 'var(--mon-axis)', 'font-size': 11, 'text-anchor': 'end' }, svg).textContent = 'Level of the heart';
    svgEl('circle', { cx: heart[0], cy: hy, r: 7, fill: 'var(--flag)' }, svg);
    const vy = hy - hSite * sc, ty = hy - hTrans * sc;
    const vx = 300, tx = 370;
    svgEl('circle', { cx: vx, cy: vy, r: 6, fill: 'none', stroke: 'var(--text)', 'stroke-width': 2 }, svg);
    svgEl('text', { x: vx - 10, y: vy - 10, fill: 'var(--text)', 'font-size': 11, 'text-anchor': 'end' }, svg).textContent = siteLabel;
    svgEl('rect', { x: tx - 7, y: ty - 7, width: 14, height: 14, fill: 'var(--mcw-green)' }, svg);
    svgEl('text', { x: tx + 12, y: ty + 4, fill: 'var(--text)', 'font-size': 11 }, svg).textContent = 'Transducer';
    svgEl('line', { x1: vx + 6, y1: vy, x2: tx - 7, y2: ty, stroke: 'var(--text-muted)', 'stroke-dasharray': '2 3' }, svg);
    void legAng;
  }

  function level() {
    const post = POSTURES.find((p) => p.id === S.posture), heart = heartOf(S.patient);
    const hT = S.mount === 'custom' ? S.h : transducerHeight(S.mount, post, S.site, S.h);
    $('#pl-height').value = Math.round(hT);
    $('#pl-height-v').textContent = `${f(hT)} cm`;
    $('#pl-zero-v').textContent = `${S.zero > 0 ? '+' : ''}${S.zero} mmHg`;
    const hS = siteHeight(S.site, post), site = SITES.find((s) => s.id === S.site);
    const pIn = site.kind === 'arterial' ? arterialAt(heart, hS).map : venousAt(heart, hS);
    const rd = reading(pIn, hS, hT, S.zero), err = rd - pIn;
    body(post, hS, hT, site.label);
    $('#pl-tiles').innerHTML = [
      ['Pressure in the vessel', `${f(pIn)} mmHg`, site.kind === 'arterial' ? 'mean' : 'mean', false],
      ['Reading', `${f(rd)} mmHg`, `${err >= 0 ? '+' : ''}${f(err, 1)} against the vessel`, Math.abs(err) >= 3],
      ['Vertical distance', `${f(hS - hT)} cm`, 'vessel above (+) or below (−) the transducer', false],
    ].map(([k, v, sub, bad]) => `<div class="tile${bad ? ' off' : ''}"><div class="tile-v">${v}</div><div class="tile-k">${k} <span>${sub}</span></div></div>`).join('');
    const rows = [['aorta', 'Aortic root (mean)'], ['brain', 'Circle of Willis (mean)'], ['radial', 'Radial artery (mean)'], ['foot', 'Dorsalis pedis (mean)'], ['ra', 'Right atrium'], ['footvein', 'Foot vein']].map(([id, label]) => {
      const h = siteHeight(id, post), k = SITES.find((s) => s.id === id).kind;
      const p = k === 'arterial' ? arterialAt(heart, h).map : venousAt(heart, h);
      return `<tr><td>${label}</td><td class="num">${f(h)}</td><td class="num">${f(p, 1)}</td><td class="num">${f(reading(p, h, hT, S.zero), 1)}</td></tr>`;
    });
    const hf = siteHeight('foot', post), pa = arterialAt(heart, hf).map, pv = venousAt(heart, hf);
    rows.push(`<tr><td>Capillary, foot</td><td class="num">${f(hf)}</td><td class="num">${f(capillaryP(pa, pv), 1)}</td><td class="num">${f(reading(capillaryP(pa, pv), hf, hT, S.zero), 1)}</td></tr>`);
    $('#pl-table tbody').innerHTML = rows.join('');
  }

  // ---------- panel 2: PEEP ----------
  seg($('#pl-frac'), TRANSMIT, S.frac, (v) => { S.frac = v; peepPanel(); });
  $('#pl-peep').oninput = (e) => { S.peep = +e.target.value; peepPanel(); };
  function peepPanel() {
    $('#pl-peep-v').textContent = `${S.peep} cmH₂O`;
    const ppl = pleuralFromPeep(S.peep, +S.frac), a = run(S.patient).hemo, b = run(S.patient, { ppl }).hemo;
    const row = (k, x, y, d = 1) => `<tr><td>${k}</td><td class="num">${f(x, d)}</td><td class="num">${f(y, d)}</td></tr>`;
    $('#pl-peep-table tbody').innerHTML = [
      row('Pleural pressure, mmHg', 0, ppl),
      row('Right atrial pressure as measured, mmHg', a.RAP, b.RAP),
      row('Right atrial transmural pressure, mmHg', a.RAP, b.RAP - ppl),
      row('Wedge (left atrial) pressure as measured, mmHg', a.LAP, b.LAP),
      row('Wedge transmural pressure, mmHg', a.LAP, b.LAP - ppl),
      row('Cardiac output, L/min', a.CO, b.CO, 2),
      row('Mean arterial pressure, mmHg', a.MAP, b.MAP),
    ].join('');
  }

  // ---------- panel 3: dynamic response ----------
  const sysHost = $('#pl-sys');
  seg(sysHost, SYSTEMS.map(([id, l]) => [id, l]), S.sys, (v) => { S.sys = v; const s = SYSTEMS.find((x) => x[0] === v); S.fn = s[2]; S.z = s[3]; syncSliders(); dyn(); });
  const syncSliders = () => { $('#pl-fn').value = S.fn; $('#pl-z').value = S.z; };
  syncSliders();
  $('#pl-fn').oninput = (e) => { S.fn = +e.target.value; dyn(); };
  $('#pl-z').oninput = (e) => { S.z = +e.target.value; dyn(); };
  $('#pl-hr').oninput = (e) => { S.hr = +e.target.value; dyn(); };
  function dyn() {
    $('#pl-fn-v').textContent = `${f(S.fn, 1)} Hz`; $('#pl-z-v').textContent = f(S.z, 2); $('#pl-hr-v').textContent = `${S.hr} per minute`;
    const q = simulate({ hr: S.hr, baro: 0 }), beat = q.rec.Pao, dt = q.dt;
    const rep = respond(beat, dt, S.fn, S.z), t0 = beatStats(beat), t1 = beatStats(rep);
    const T = beat.length * dt, pts = (w, k) => w.map((v, i) => [(i * dt) * (k ?? 1), v]);
    const wave = pts(beat).concat(pts(beat).map(([x, y]) => [x + T, y])), repw = pts(rep).concat(pts(rep).map(([x, y]) => [x + T, y]));
    drawPlot($('#pl-wave'), { width: 560, height: 260, x: { min: 0, max: 2 * T, label: 'Time, s' }, y: { min: 40, max: Math.ceil((Math.max(t0.sbp, t1.sbp) + 10) / 20) * 20, label: 'mmHg' },
      series: [{ points: wave, color: 'var(--mon-axis)', width: 1.6 }, { points: repw, color: 'var(--mon-art, #3fbf6f)', width: 2 }], title: 'Arterial pressure at the tip and as reported' });
    const ft = flushTest(S.fn, S.z), cut = Math.min(ft.t.length, Math.round(0.4 / (ft.t[1])));
    drawPlot($('#pl-flush'), { width: 560, height: 260, x: { min: 0, max: 0.4, label: 'Time after the flush, s' }, y: { min: 0, max: 320, label: 'mmHg' },
      series: [{ points: [[0, 90], [0.4, 90]], color: 'var(--mon-axis)', dash: '4 3', width: 1.2 }, { points: ft.t.slice(0, cut).map((t, i) => [t, ft.y[i]]), color: 'var(--mon-art, #3fbf6f)', width: 2 }], title: 'Fast-flush test' });
    const d = (a, b) => `${b - a >= 0 ? '+' : ''}${f(b - a, 1)}`;
    $('#pl-dyn-table tbody').innerHTML = [['Systolic, mmHg', t0.sbp, t1.sbp], ['Diastolic, mmHg', t0.dbp, t1.dbp], ['Mean, mmHg', t0.map, t1.map]]
      .map(([k, a, b]) => `<tr><td>${k}</td><td class="num">${f(a, 1)}</td><td class="num">${f(b, 1)}</td><td class="num">${d(a, b)}</td></tr>`).join('') +
      (ft.oscillates ? `<tr><td>Fast-flush: fn (Hz); damping</td><td class="num">${f(S.fn, 1)}; ${f(S.z, 2)}</td><td class="num">${f(ft.fn, 1)}; ${f(ft.zeta, 2)}</td><td class="num">read from the trace</td></tr>`
        : `<tr><td>Fast-flush</td><td class="num" colspan="3">The trace does not ring, so the system is overdamped (damping coefficient above 1).</td></tr>`);
  }

  level(); peepPanel(); dyn();
}
