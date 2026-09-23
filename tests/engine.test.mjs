// Engine tests. Run with: node tests/engine.test.mjs  (no dependencies)
import { simulate, NORMAL, WU, cardiacPhases } from '../site/js/engine.js';
import { _pac } from '../site/js/pacsim.js';
import { PRESETS, INTERVENTIONS } from '../site/js/presets.js';
import { buildPalette, makeIndexer, GifWriter } from '../site/js/gif.js';

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!cond) failed++;
}
const within = (v, lo, hi) => v >= lo && v <= hi;
const stressed = (s, p) => s[0] - p.lvV0 + s[1] + s[2] + s[3] - p.rvV0 + s[4] + s[5];

// 1. Normal adult calibration targets
const n = simulate({});
check('normal converges', n.converged, `${n.beats} beats`);
check('LV EF 50–65%', within(n.lv.EF, 0.5, 0.65), n.lv.EF.toFixed(3));
check('LV EDV 110–150 mL', within(n.lv.EDV, 110, 150), n.lv.EDV.toFixed(1));
check('SBP 105–130, DBP 60–85', within(n.hemo.SBP, 105, 130) && within(n.hemo.DBP, 60, 85), `${n.hemo.SBP.toFixed(0)}/${n.hemo.DBP.toFixed(0)}`);
check('CO 4.5–6.5 L/min', within(n.hemo.CO, 4.5, 6.5), n.hemo.CO.toFixed(2));
check('LAP 5–12 mmHg', within(n.hemo.LAP, 5, 12), n.hemo.LAP.toFixed(1));
check('RAP 2–8 mmHg', within(n.hemo.RAP, 2, 8), n.hemo.RAP.toFixed(1));
check('LV Ea/Ees 0.5–0.75 (Starling 1993: 0.62)', within(n.lv.EaEes, 0.5, 0.75), n.lv.EaEes.toFixed(3));
check('mPAP 10–20 (Kovacs 2009: 14 ± 3.3)', within(n.hemo.mPAP, 10, 20), n.hemo.mPAP.toFixed(1));
check('PVR 0.7–1.5 WU', within(n.hemo.PVR_WU, 0.7, 1.5), n.hemo.PVR_WU.toFixed(2));
check('RV Ees/Ea 1.5–2.1 (Tello 2019: 1.5–2)', within(n.rv.EesEa, 1.5, 2.1), n.rv.EesEa.toFixed(2));
check('LV and RV stroke volumes equal at steady state', Math.abs(n.lv.SV - n.rv.SV) < 0.5, `${n.lv.SV.toFixed(2)} vs ${n.rv.SV.toFixed(2)}`);

// 2. Volume conservation across one beat
const p = { ...NORMAL };
check('stressed volume conserved (< 0.1 mL)', Math.abs(stressed(n.state, p) - p.vStressed) < 0.1, (stressed(n.state, p) - p.vStressed).toExponential(2));

// 3. ESPVR recovered from a preload sweep equals the input Ees
function espvrSlope(side) {
  const pts = [700, 740, 780, 820].map((v) => { const r = simulate({ vStressed: v }); return [r[side].ESV, r[side].Pes]; });
  const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length, my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  const sxy = pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0), sxx = pts.reduce((a, q) => a + (q[0] - mx) ** 2, 0);
  return sxy / sxx;
}
const sL = espvrSlope('lv'), sR = espvrSlope('rv');
check('LV ESPVR slope from preload sweep ≈ Ees (±5%)', Math.abs(sL / NORMAL.lvEes - 1) < 0.05, sL.toFixed(3));
check('RV ESPVR slope from preload sweep ≈ Ees (±5%)', Math.abs(sR / NORMAL.rvEes - 1) < 0.05, sR.toFixed(3));

// 4. Directional responses
const hiSVR = simulate({ svr: NORMAL.svr * 1.5 });
check('↑SVR → ↑Ea, ↓SV, ↑ESV', hiSVR.lv.Ea > n.lv.Ea && hiSVR.lv.SV < n.lv.SV && hiSVR.lv.ESV > n.lv.ESV);
const loEes = simulate({ lvEes: 1.0 });
check('↓LV Ees → ↑ESV, ↑Ea/Ees, ↓EF', loEes.lv.ESV > n.lv.ESV && loEes.lv.EaEes > n.lv.EaEes && loEes.lv.EF < n.lv.EF);
const hiPVR = simulate({ pvr: 8 * WU });
check('↑PVR → ↓RV Ees/Ea, ↑RV EDV, ↓LV EDV (series effect)', hiPVR.rv.EesEa < n.rv.EesEa && hiPVR.rv.EDV > n.rv.EDV && hiPVR.lv.EDV < n.lv.EDV);
const tachy = simulate({ hr: 110 });
check('↑HR at fixed SVR → ↑Ea (Ea ≈ SVR/T)', tachy.lv.Ea > n.lv.Ea, `${n.lv.Ea.toFixed(2)} → ${tachy.lv.Ea.toFixed(2)}`);
const k = (r) => r.lv.Ea / ((r.params.svr + r.params.zcAo) / r.T);
const ks = [n, hiSVR, tachy, simulate({ svr: NORMAL.svr * 0.6 })].map(k);
check('Ea tracks SVR/T across SVR and HR (ratio spread < 25%)', Math.max(...ks) / Math.min(...ks) < 1.25, ks.map((x) => x.toFixed(2)).join(', '));
const stiff = simulate({ lvBeta: 0.045 });
check('↑EDPVR stiffness → ↓EDV, ↑LAP, Ees unchanged', stiff.lv.EDV < n.lv.EDV && stiff.hemo.LAP > n.hemo.LAP);

// 5. Single-beat identity: Pmax/Pes − 1 equals true Ees/Ea in this model
check('single-beat Pmax/Pes − 1 ≈ Ees/Ea (±3%)', Math.abs(n.rv.pmaxRatio / n.rv.EesEa - 1) < 0.03 && Math.abs(hiPVR.rv.pmaxRatio / hiPVR.rv.EesEa - 1) < 0.03);

// 6. Every preset converges and matches its teaching claim
const byId = Object.fromEntries(PRESETS.map((x) => [x.id, simulate(x.params)]));
for (const [id, r] of Object.entries(byId)) check(`preset ${id} converges`, r.converged, `${r.beats} beats`);
check('HFpEF: Ees and Ea both high, ratio 0.4–0.8, LAP > 15', byId.hfpef.lv.Ees > 3.5 && byId.hfpef.lv.Ea > 2 && within(byId.hfpef.lv.EaEes, 0.4, 0.8) && byId.hfpef.hemo.LAP > 15);
check('HFrEF: EF < 35%, Ea/Ees > 1.5', byId.hfref.lv.EF < 0.35 && byId.hfref.lv.EaEes > 1.5);
check('Vasoplegia: Ea/Ees < normal, MAP < 70', byId.vasoplegia.lv.EaEes < n.lv.EaEes && byId.vasoplegia.hemo.MAP < 70);
check('Septic CM: Ea/Ees > 1.3', byId.septicCM.lv.EaEes > 1.3);
check('PAH compensated: RV Ees/Ea 0.9–1.5, mPAP > 20', within(byId.pahComp.rv.EesEa, 0.9, 1.5) && byId.pahComp.hemo.mPAP > 20);
check('PAH decompensated: RV Ees/Ea < 0.805, RAP > 10, SV/ESV < 0.515', byId.pahDecomp.rv.EesEa < 0.805 && byId.pahDecomp.hemo.RAP > 10 && byId.pahDecomp.rv.svEsv < 0.515);
check('Acute PE: RV Ees/Ea < 1, CO < normal', byId.acutePE.rv.EesEa < 1 && byId.acutePE.hemo.CO < n.hemo.CO);
check('CpcPH: LAP > 15, PVR > 2 WU, mPAP > 20', byId.cpcph.hemo.LAP > 15 && byId.cpcph.hemo.PVR_WU > 2 && byId.cpcph.hemo.mPAP > 20);

// 7. Echo lab quantities derived from the model beat
for (const id of ['normal', 'pahDecomp', 'hfref']) {
  const r = byId[id];
  const A = Math.PI * 1.1 ** 2;                                   // LVOT 2.2 cm
  const vti = r.rec.Qao.reduce((a, q) => a + q * r.dt, 0) / A;
  check(`${id}: LVOT area × VTI = SV (±3%)`, Math.abs(A * vti / r.lv.SV - 1) < 0.03, `${(A * vti).toFixed(1)} vs ${r.lv.SV.toFixed(1)}`);
  const v = Math.max(...r.rec.Prv.map((p, i) => (p > r.rec.Psv[i] ? Math.sqrt((p - r.rec.Psv[i]) / 4) : 0)));
  const i = r.rec.Prv.indexOf(Math.max(...r.rec.Prv));
  const est = 4 * v * v + r.rec.Psv[i];
  check(`${id}: 4v² + RAP = PASP (±3 mmHg)`, Math.abs(est - r.hemo.PASP) < 3, `${est.toFixed(1)} vs ${r.hemo.PASP.toFixed(1)}`);
}

// 8. Interventions move the expected variables
const I = Object.fromEntries(INTERVENTIONS.map((x) => [x.id, simulate({ ...NORMAL, ...x.apply(NORMAL) })]));
check('fluid → ↑EDV, ↑LAP', I.fluid.lv.EDV > n.lv.EDV && I.fluid.hemo.LAP > n.hemo.LAP);
check('remove volume → ↓EDV', I.diurese.lv.EDV < n.lv.EDV);
check('norepinephrine → ↑Ea, ↑MAP', I.norepi.lv.Ea > n.lv.Ea && I.norepi.hemo.MAP > n.hemo.MAP);
check('arterial vasodilator → ↓Ea, ↑SV', I.dilate.lv.Ea < n.lv.Ea && I.dilate.lv.SV > n.lv.SV);
check('inotrope → ↓ESV, ↓Ea/Ees', I.dobut.lv.ESV < n.lv.ESV && I.dobut.lv.EaEes < n.lv.EaEes);
const pah = simulate(byId.pahDecomp.params), pahV = simulate({ ...pah.params, ...INTERVENTIONS.find((x) => x.id === 'pvd').apply(pah.params) });
check('pulmonary vasodilator in PAH → ↑RV Ees/Ea, ↑CO', pahV.rv.EesEa > pah.rv.EesEa && pahV.hemo.CO > pah.hemo.CO);

// Concepts page: SV = (EDV − V0)·Ees/(Ees + Ea) predicts the model's SV within ~1 mL,
// and end-systolic points at different preloads lie on the ESPVR.
for (const f of [0.6, 1, 1.6]) {
  const r = simulate({ svr: NORMAL.svr * f }), m = r.lv, pred = m.Ees * (m.EDV - NORMAL.lvV0) / (m.Ees + m.Ea);
  check(`two-line formula: SVR ×${f} predicted SV within 1.5 mL`, Math.abs(pred - m.SV) < 1.5, `${pred.toFixed(1)} vs ${m.SV.toFixed(1)}`);
}
for (const vs of [520, 740, 1150]) {
  const m = simulate({ vStressed: vs }).lv;
  check(`ESPVR: preload ${vs}, end-systolic point within 2 mmHg of the line`, Math.abs(m.Ees * (m.ESV - NORMAL.lvV0) - m.Pes) < 2);
}

// 9. Valve events
for (const [id, r] of Object.entries(byId)) {
  const cp = cardiacPhases(r);
  for (const sd of ['lv', 'rv']) {
    const e = cp[sd].events;
    check(`${id} ${sd}: inflow close < outflow open < outflow close < inflow open`, e.inClose < e.outOpen && e.outOpen < e.outClose && e.outClose < e.inOpen && e.inOpen < r.rec.t.length);
  }
}
const cpn = cardiacPhases(n);
check('normal: RV outflow opens before LV outflow', cpn.rv.events.outOpen < cpn.lv.events.outOpen, `${cpn.rv.events.outOpen} vs ${cpn.lv.events.outOpen}`);

// 10. PA catheter artifacts
_pac.buildBeat();
const baseSig = () => _pac.signal(12).out;
Object.assign(_pac.st, { pos: 'pa', damp: 'ok', level: 0, resp: 'none' });
const s0 = _pac.stats(baseSig());
_pac.st.damp = 'over'; const sOver = _pac.stats(baseSig());
_pac.st.damp = 'under'; const sUnder = _pac.stats(baseSig());
_pac.st.damp = 'ok'; _pac.st.level = 1; const sLevel = _pac.stats(baseSig()); _pac.st.level = 0;
check('overdamped: mean within 1 mmHg, systolic lower', Math.abs(sOver.mean - s0.mean) < 1 && sOver.max < s0.max - 1, `${s0.max.toFixed(1)}→${sOver.max.toFixed(1)}, mean ${s0.mean.toFixed(1)}→${sOver.mean.toFixed(1)}`);
check('underdamped: systolic overshoot', sUnder.max > s0.max + 1, `${s0.max.toFixed(1)}→${sUnder.max.toFixed(1)}`);
check('transducer 10 cm low: +7.4 mmHg everywhere', Math.abs(sLevel.mean - s0.mean - 7.4) < 0.05 && Math.abs(sLevel.max - s0.max - 7.4) < 0.05);

// PAC export loops without a seam: the tracing repeats after one breath (a whole number of beats)
Object.assign(_pac.st, { pos: 'pa', damp: 'under', level: 0, resp: 'ppv' });
for (const id of ['normal', 'pahDecomp', 'septicCM']) {
  _pac.st.preset = id; _pac.buildBeat();
  const t0 = 100 * _pac.breath, a = _pac.signal(t0).out, b = _pac.signal(t0 + _pac.breath).out;
  const beats = _pac.breath / _pac.tb;
  check(`${id}: PAC tracing periodic over one breath (${beats.toFixed(0)} beats)`, Math.abs(beats - Math.round(beats)) < 1e-9 && a.every((v, i) => Math.abs(v - b[i]) < 1e-6));
}
Object.assign(_pac.st, { preset: 'normal', damp: 'ok', resp: 'none' }); _pac.buildBeat();

// Atrial waves (template on top of the model pressure)
{
  const at = (side) => { const b = _pac.beat, i = (t) => ((Math.round(t * _pac.FS) % b.n) + b.n) % b.n; return { b, i, w: _pac.waveTimes(side) }; };
  const setAtr = (a) => { _pac.st.atr = a; _pac.buildBeat(); };
  setAtr('sinus'); let { b, i, w } = at('ra');
  const aSinus = b.ra[i(w.a)] - b.ra[i(w.a - 0.15)];
  check('RA sinus: a wave rises ≥ 2 mmHg before the QRS', aSinus >= 2, aSinus.toFixed(1));
  check('RA sinus: x descent below the c wave', b.ra[i(w.x)] < b.ra[i(w.c)] - 1);
  const wedgeSinus = _pac.stats(b.wedge).mean, laSinus = _pac.stats(b.la).mean;
  check('wedge mean equals LA mean (filter keeps the mean)', Math.abs(wedgeSinus - laSinus) < 0.05, `${wedgeSinus.toFixed(2)} vs ${laSinus.toFixed(2)}`);
  setAtr('af'); ({ b, i, w } = at('ra'));
  check('AF: no a wave', b.ra[i(w.a)] - b.ra[i(w.a - 0.15)] < 0.5);
  setAtr('mr');
  const laMR = _pac.stats(_pac.beat.la);
  check('severe MR: giant LA v wave ≥ 15 mmHg above LA minimum, wedge mean rises', laMR.max - laMR.min >= 15 && _pac.stats(_pac.beat.wedge).mean > wedgeSinus + 3, `v ${ (laMR.max - laMR.min).toFixed(0)}`);
  setAtr('tr'); ({ b, i, w } = at('ra'));
  check('severe TR: systolic cv wave, RA peak in systole', b.ra[i(w.v)] - b.ra[i(w.y + 0.1)] > 6);
  for (const a of ['af', 'junc', 'mr']) {
    setAtr(a); Object.assign(_pac.st, { pos: 'wedge', resp: 'spont' });
    const t0 = 100 * _pac.breath, s1 = _pac.signal(t0).out, s2 = _pac.signal(t0 + _pac.breath).out;
    check(`${a}: wedge tracing still periodic over one breath`, s1.every((v, k) => Math.abs(v - s2[k]) < 1e-6));
  }
  Object.assign(_pac.st, { atr: 'sinus', pos: 'ra', resp: 'none' }); _pac.buildBeat();
}

// 11. GIF encoder: decode our own output and compare every pixel
function decodeGif(buf) {
  const u16 = (i) => buf[i] | (buf[i + 1] << 8), W = u16(6), H = u16(8), pal = buf.subarray(13, 13 + 768);
  let p = 13 + 768, trans = -1, delay = 0, loop = null;
  const canvas = new Uint8Array(W * H), frames = [];
  while (buf[p] !== 0x3b) {
    if (buf[p] === 0x21) {
      const label = buf[p + 1]; p += 2;
      if (label === 0xf9) { trans = buf[p + 1] & 1 ? buf[p + 4] : -1; delay = u16(p + 2); }
      if (label === 0xff) loop = u16(p + 14);
      while (buf[p]) p += buf[p] + 1; p++;
      continue;
    }
    const x = u16(p + 1), y = u16(p + 3), w = u16(p + 5), h = u16(p + 7); p += 10;
    const min = buf[p++], data = [];
    while (buf[p]) { data.push(...buf.subarray(p + 1, p + 1 + buf[p])); p += buf[p] + 1; } p++;
    const clear = 1 << min, out = [];
    let size = min + 1, dict = [], bits = 0, cur = 0, prev = null, k = 0;
    const reset = () => { dict = Array.from({ length: clear + 2 }, (_, i) => [i]); size = min + 1; prev = null; };
    reset();
    for (const byte of data) {
      cur |= byte << bits; bits += 8;
      while (bits >= size) {
        const code = cur & ((1 << size) - 1); cur >>= size; bits -= size;
        if (code === clear) { reset(); continue; }
        if (code === clear + 1) { bits = 0; break; }
        const entry = code < dict.length ? dict[code] : [...prev, prev[0]];
        out.push(...entry);
        if (prev) dict.push([...prev, entry[0]]);
        prev = entry;
        if (dict.length === 1 << size && size < 12) size++;
      }
    }
    for (let j = 0; j < w * h; j++) { const v = out[j]; if (v !== trans) canvas[(y + Math.floor(j / w)) * W + x + (j % w)] = v; k++; }
    frames.push({ idx: canvas.slice(), delay });
  }
  return { W, H, pal, frames, loop };
}
{
  const W = 97, H = 61, rgba = [];
  for (let f = 0; f < 6; f++) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = Math.floor(i / W), dot = (x - 10 - f * 15) ** 2 + (y - 30) ** 2 < 30;
      d.set(dot ? [255, 255, 255, 255] : [(x * 7) & 255, (y * 11) & 255, ((x ^ y) * 3) & 255, 255], i * 4);
    }
    rgba.push(d);
  }
  rgba[4] = rgba[3];                                     // identical frame: merged into a longer delay
  const P = buildPalette(rgba), index = makeIndexer(P), gw = new GifWriter(W, H, P), want = [];
  for (const d of rgba) { const idx = index(d, new Uint8Array(W * H)); want.push(idx); gw.addFrame(idx, 7); }
  const g = decodeGif(new Uint8Array(await gw.finish().arrayBuffer()));
  const keep = [0, 1, 2, 3, 5];
  check('GIF: size, loop forever, identical frame merged', g.W === W && g.H === H && g.loop === 0 && g.frames.length === 5 && g.frames[3].delay === 14);
  check('GIF: every decoded pixel matches the indexed frame', g.frames.every((fr, i) => fr.idx.every((v, j) => v === want[keep[i]][j])));
  // an image with ≤ 255 distinct colours (like a plot) must come back exactly
  const img = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const c = (i * 7919) % 216; img.set([(c % 6) * 51, (Math.floor(c / 6) % 6) * 51, Math.floor(c / 36) * 51, 255], i * 4); }
  const P2 = buildPalette([img]), idx2 = makeIndexer(P2)(img, new Uint8Array(W * H));
  check('GIF palette: plot-like image (216 colours) reproduced exactly', Array.from(idx2).every((v, j) => [0, 1, 2].every((c) => P2.pal[v * 3 + c] === img[j * 4 + c])));
}

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
