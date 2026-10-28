// Minimal SVG line plotting. Colors are CSS variables so plots follow the theme.
const NS = 'http://www.w3.org/2000/svg';

export function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

export function niceMax(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/**
 * spec: { width, height, x: {min,max,label}, y: {min,max,label}, series: [{points, color,
 *         width, dash, fill, marker, label}], annotations: [{x,y,text,color,anchor}] , title }
 */
export function drawPlot(svg, spec) {
  const W = spec.width ?? 640, H = spec.height ?? 420;
  const m = { l: 56, r: 14, t: 12, b: 44 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  if (spec.title) svg.setAttribute('aria-label', spec.title);
  svg.innerHTML = '';
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const sx = (x) => m.l + ((x - spec.x.min) / (spec.x.max - spec.x.min)) * pw;
  const sy = (y) => m.t + ph - ((y - spec.y.min) / (spec.y.max - spec.y.min)) * ph;

  const g = el('g', { 'font-size': 12, 'font-family': 'inherit' }, svg);
  const clipId = 'clip' + Math.random().toString(36).slice(2, 8);
  const defs = el('defs', {}, svg);
  const cp = el('clipPath', { id: clipId }, defs);
  el('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);

  for (const t of niceTicks(spec.x.min, spec.x.max, spec.xTicks ?? 6)) {
    el('line', { x1: sx(t), x2: sx(t), y1: m.t, y2: m.t + ph, style: 'stroke:var(--grid)' }, g);
    const tx = el('text', { x: sx(t), y: m.t + ph + 16, 'text-anchor': 'middle', style: 'fill:var(--axis)' }, g);
    tx.textContent = t;
  }
  for (const t of niceTicks(spec.y.min, spec.y.max, spec.yTicks ?? 5)) {
    el('line', { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), style: 'stroke:var(--grid)' }, g);
    const ty = el('text', { x: m.l - 6, y: sy(t) + 4, 'text-anchor': 'end', style: 'fill:var(--axis)' }, g);
    ty.textContent = t;
  }
  el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, style: 'stroke:var(--axis)' }, g);
  el('line', { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph, style: 'stroke:var(--axis)' }, g);
  const xl = el('text', { x: m.l + pw / 2, y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--text)', 'font-size': 13 }, g);
  xl.textContent = spec.x.label;
  const yl = el('text', { x: 14, y: m.t + ph / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})`, style: 'fill:var(--text)', 'font-size': 13 }, g);
  yl.textContent = spec.y.label;

  const plotG = el('g', { 'clip-path': `url(#${clipId})` }, svg);
  for (const s of spec.series) {
    if (!s.points || s.points.length === 0) continue;
    if (s.marker) {
      for (const [x, y] of s.points) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        el('circle', { cx: sx(x), cy: sy(y), r: s.marker, style: `fill:${s.color};stroke:var(--surface);stroke-width:1.5` }, plotG);
      }
      continue;
    }
    // a missing or non-finite point breaks the line rather than the whole plot
    let d = '', pen = false;
    for (const pt of s.points) {
      if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${sx(pt[0]).toFixed(1)},${sy(pt[1]).toFixed(1)}`; pen = true;
    }
    if (!d) continue;
    if (s.closed) d += 'Z';
    el('path', {
      d,
      style: `fill:${s.fill ?? 'none'};stroke:${s.color};stroke-width:${s.width ?? 1.5};` +
        `${s.dash ? `stroke-dasharray:${s.dash};` : ''}stroke-linejoin:round;stroke-linecap:round;${s.opacity ? `opacity:${s.opacity};` : ''}`,
    }, plotG);
  }
  for (const a of spec.annotations ?? []) {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
    const t = el('text', { x: sx(a.x) + (a.dx ?? 0), y: sy(a.y) + (a.dy ?? 0), 'text-anchor': a.anchor ?? 'start', style: `fill:${a.color ?? 'var(--text-muted)'}`, 'font-size': 12 }, svg);
    t.textContent = a.text;
  }
  const ix = (px) => spec.x.min + ((px - m.l) / pw) * (spec.x.max - spec.x.min);
  const iy = (py) => spec.y.min + ((m.t + ph - py) / ph) * (spec.y.max - spec.y.min);
  return { sx, sy, ix, iy, svg };
}

// Pointer event → SVG user coordinates (accounts for CSS scaling).
export function svgPoint(svg, ev) {
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

export function svgEl(name, attrs, parent) { return el(name, attrs, parent); }

// Place text labels beside their anchor points so that no two overlap and none covers an obstacle or
// leaves the box `bounds` ({x0, y0, x1, y1}, in SVG units). labels: [{x, y, text, cls, style, dir}], where
// (x, y) is the anchor and dir the preferred direction in radians (0 = right, π/2 = down), for instance
// pointing away from the middle of a loop. Each label tries the eight positions around its anchor in order
// of closeness to dir and takes the first free one, or the one with the least overlap if none is free.
// obstacles: [{x, y, r, w}] circles (weight w, default 1). Returns the text elements.
export function placeLabels(parent, labels, { obstacles = [], bounds = null, gap = 6 } = {}) {
  const boxes = obstacles.map((o) => ({ x0: o.x - o.r, y0: o.y - o.r, x1: o.x + o.r, y1: o.y + o.r, w: o.w ?? 1 }));
  const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const out = [];
  for (const L of labels) {
    if (!Number.isFinite(L.x) || !Number.isFinite(L.y)) continue;
    const t = el('text', { x: 0, y: 0, ...(L.cls ? { class: L.cls } : {}), ...(L.style ? { style: L.style } : {}) }, parent);
    t.textContent = L.text;
    let bb = null;
    try { bb = t.getBBox(); } catch { /* not rendered */ }
    const w = bb?.width || L.text.length * (L.charW ?? 7), h = bb?.height || (L.h ?? 13), asc = bb?.height ? -bb.y : h * 0.78;
    const g = L.gap ?? gap, dg = g * 0.7;
    const cand = [
      [0, L.x + g, L.y - h / 2], [Math.PI / 4, L.x + dg, L.y + dg], [Math.PI / 2, L.x - w / 2, L.y + g],
      [3 * Math.PI / 4, L.x - dg - w, L.y + dg], [Math.PI, L.x - g - w, L.y - h / 2], [-3 * Math.PI / 4, L.x - dg - w, L.y - dg - h],
      [-Math.PI / 2, L.x - w / 2, L.y - g - h], [-Math.PI / 4, L.x + dg, L.y - dg - h],
    ];
    const dir = L.dir ?? -Math.PI / 4;
    const turn = (a) => { const d = Math.abs(((a - dir) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d; };
    cand.sort((a, b) => turn(a[0]) - turn(b[0]));
    let best = null;
    for (const [, x0, y0] of cand) {
      const b = { x0, y0, x1: x0 + w, y1: y0 + h };
      let cost = 0;
      for (const o of boxes) cost += area(b, o) * o.w;
      if (bounds) cost += 4 * (w * h - area(b, bounds));
      if (!best || cost < best.cost - 1e-9) best = { b, cost };
      if (cost === 0) break;
    }
    t.setAttribute('x', (best.b.x0 - (bb?.x ?? 0)).toFixed(1));
    t.setAttribute('y', (best.b.y0 + asc).toFixed(1));
    t.setAttribute('text-anchor', 'start');
    boxes.push({ ...best.b, w: 1 });
    out.push(t);
  }
  return out;
}

// Small legend swatch for a line style.
export function swatch(color, dash, width = 2) {
  return `<svg viewBox="0 0 26 10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" style="stroke:${color};stroke-width:${width};${dash ? `stroke-dasharray:${dash}` : ''}"/></svg>`;
}
