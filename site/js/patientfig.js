// A patient in the chosen posture with the heart level, the vessel being measured and the transducer on its pole.
// Lengths come from the body model of pressurecore.js, so the height of every marker on the figure equals the height used in the arithmetic.
import { BODY, SITES } from './pressurecore.js';
import { svgEl } from './plot.js';

const SC = 1.55;                     // pixels per cm
const W = 440, H = 300;
const SKIN = '#B9A99A', SKIN_DARK = '#9C8D80', GOWN = '#6F8F8A', BED = '#2A3B36', LINE = '#9DB3AB';

export function drawPatient(svg, { post, siteId, hTrans, hSite, label }) {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const el = (n, a, p = svg) => svgEl(n, a, p);
  const th = (post.angle * Math.PI) / 180, a = [Math.cos(th), -Math.sin(th)];     // unit vector along the torso toward the head
  const nrm = [a[1], -a[0]];                                                        // unit vector toward the front of the body
  const standing = post.standing;
  // hip joint on screen; the heart level and every height are measured from it
  const hx = standing ? 190 : 205, hy = standing ? 150 : 150;
  const P = (d, off = 0) => [hx + (a[0] * d + nrm[0] * off) * SC, hy + (a[1] * d + nrm[1] * off) * SC];   // along the torso (cm) and toward the front (cm)
  const heartY = hy - BODY.hipToHeart * Math.sin(th) * SC;
  const yOf = (hcm) => heartY - hcm * SC;                                                         // screen y of a height above the heart
  const cap = (p, q, rcm, fill, extra = {}) => el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: fill, 'stroke-width': rcm * 2 * SC, 'stroke-linecap': 'round', ...extra });

  // bed or floor
  if (standing) {
    el('line', { x1: 40, y1: hy + (BODY.hipToAnkle + 9) * SC, x2: 300, y2: hy + (BODY.hipToAnkle + 9) * SC, stroke: BED, 'stroke-width': 5, 'stroke-linecap': 'round' });
  } else {
    const by = hy + 14;
    el('rect', { x: 40, y: by, width: 160, height: 10, rx: 4, fill: BED });                       // mattress under the legs
    const back = P(0, -14), top = P(80, -14);
    cap(back, top, 5, BED);                                                                          // raised back rest
    el('line', { x1: 50, y1: by + 10, x2: 50, y2: H - 6, stroke: BED, 'stroke-width': 4 });
    el('line', { x1: 190, y1: by + 10, x2: 190, y2: H - 6, stroke: BED, 'stroke-width': 4 });
    el('line', { x1: 40, y1: H - 6, x2: 300, y2: H - 6, stroke: BED, 'stroke-width': 3, opacity: 0.6 });
  }

  // legs (the model keeps them flat except when standing)
  const legDir = standing ? [0, 1] : [-1, 0];
  const leg = (d) => [hx + legDir[0] * d * SC, hy + legDir[1] * d * SC];
  const knee = leg(42), ankle = leg(BODY.hipToAnkle);
  cap(leg(0), knee, 8.5, SKIN_DARK); cap(knee, ankle, 5.5, SKIN_DARK);
  if (!standing) cap(leg(8), leg(74), 11.5, '#4E6E8A', { opacity: 0.92 });                    // blanket
  if (standing) el('ellipse', { cx: ankle[0] - 9, cy: ankle[1] + 5, rx: 15, ry: 5.5, fill: SKIN_DARK });
  else el('ellipse', { cx: ankle[0] - 3, cy: ankle[1] - 11, rx: 5.5, ry: 14, fill: SKIN_DARK });
  // torso, neck, head
  cap(P(2), P(50), 15, GOWN);
  cap(P(50), P(60), 5.3, SKIN);
  const head = P(BODY.hipToBrain + 1, 0);
  if (!standing) { const pil = P(BODY.hipToBrain + 1, -9); el('ellipse', { cx: pil[0], cy: pil[1], rx: 9 * SC, ry: 13 * SC, fill: '#D8E2DF', transform: `rotate(${(-post.angle).toFixed(0)} ${pil[0]} ${pil[1]})` }); }
  el('circle', { cx: head[0], cy: head[1], r: 10.8 * SC, fill: SKIN });
  const hairC = [head[0] - nrm[0] * 3.5 * SC, head[1] - nrm[1] * 3.5 * SC];
  el('circle', { cx: hairC[0], cy: hairC[1], r: 9.4 * SC, fill: '#5C4B3F' });
  el('circle', { cx: head[0] + nrm[0] * 2 * SC, cy: head[1] + nrm[1] * 2 * SC, r: 8.6 * SC, fill: SKIN });
  const nose = [head[0] + nrm[0] * 10.8 * SC, head[1] + nrm[1] * 10.8 * SC];
  el('circle', { cx: nose[0], cy: nose[1], r: 2, fill: SKIN });
  // arm resting along the side, wrist at the level of the hip
  cap(P(50, 3), P(25, 6), 4.6, SKIN); cap(P(25, 6), P(2, 6), 3.8, SKIN);
  el('circle', { cx: P(0, 6)[0], cy: P(0, 6)[1], r: 4.2 * SC, fill: SKIN });

  // site markers
  const heart = P(BODY.hipToHeart, 2);
  const mk = {
    aorta: heart, ra: [heart[0] + 2, heart[1] + 4], brain: P(BODY.hipToBrain + 1, 0), radial: P(0, 6),
    foot: [ankle[0] + (standing ? -2 : 0), ankle[1] + (standing ? -6 : -2)], footvein: [ankle[0] + (standing ? 0 : 4), ankle[1] + (standing ? -14 : 6)],
  };
  // the heart
  const hh = mk.aorta;
  el('path', { d: `M${hh[0]} ${hh[1] + 9} C${hh[0] - 15} ${hh[1] - 2} ${hh[0] - 8} ${hh[1] - 13} ${hh[0]} ${hh[1] - 5} C${hh[0] + 8} ${hh[1] - 13} ${hh[0] + 15} ${hh[1] - 2} ${hh[0]} ${hh[1] + 9}Z`, fill: '#C9514B', stroke: '#8E2F2B', 'stroke-width': 1 });
  // level of the heart
  el('line', { x1: 14, y1: heartY, x2: 330, y2: heartY, stroke: '#4CB5A3', 'stroke-dasharray': '5 4', 'stroke-width': 1.2 });
  el('text', { x: 16, y: heartY - 5, fill: '#4CB5A3', 'font-size': 13 }).textContent = 'Level of the heart';
  for (const s of SITES) {
    const p = mk[s.id], on = s.id === siteId;
    el('circle', { cx: p[0], cy: p[1], r: on ? 6.5 : 3.2, fill: on ? '#FFFFFF' : 'none', stroke: s.kind === 'arterial' ? '#E5736C' : '#6FA8DC', 'stroke-width': on ? 3 : 1.5 });
  }
  const vp = mk[siteId];

  // transducer on an IV pole, with the fluid line to the vessel and the height between them
  const px = 372, ty = yOf(hTrans);
  el('line', { x1: px, y1: 12, x2: px, y2: H - 6, stroke: LINE, 'stroke-width': 3, 'stroke-linecap': 'round' });
  el('line', { x1: px - 22, y1: H - 6, x2: px + 22, y2: H - 6, stroke: LINE, 'stroke-width': 3, 'stroke-linecap': 'round' });
  el('rect', { x: px - 15, y: ty - 10, width: 30, height: 20, rx: 4, fill: '#E9F2EF', stroke: '#2F6E66', 'stroke-width': 2 });
  el('circle', { cx: px, cy: ty, r: 3.5, fill: '#2F6E66' });
  el('path', { d: `M${vp[0]} ${vp[1]} C${vp[0] + 60} ${vp[1]} ${px - 70} ${ty} ${px - 15} ${ty}`, fill: 'none', stroke: '#E8C96A', 'stroke-width': 1.8 });
  const bx = px - 38, y1 = yOf(hSite), y2 = ty;
  if (Math.abs(y1 - y2) > 3) {
    el('line', { x1: bx, y1, x2: bx, y2, stroke: '#E8C96A', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
    el('line', { x1: bx - 4, y1, x2: bx + 4, y2: y1, stroke: '#E8C96A', 'stroke-width': 1.5 });
    el('line', { x1: bx - 4, y1: y2, x2: bx + 4, y2, stroke: '#E8C96A', 'stroke-width': 1.5 });
    const t = el('text', { x: bx - 6, y: (y1 + y2) / 2 + 4, fill: '#E8C96A', 'font-size': 13, 'text-anchor': 'end' });
    t.textContent = `${Math.abs(hSite - hTrans).toFixed(0)} cm`;
  }
  const lab = el('text', { x: vp[0] - 12, y: vp[1] + 22, fill: '#E9F2EF', 'font-size': 13, 'text-anchor': 'end' });
  lab.textContent = label;
}
