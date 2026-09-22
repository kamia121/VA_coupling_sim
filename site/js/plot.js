// Minimal SVG line plotting. Colours are CSS variables so plots follow the theme.
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
        el('circle', { cx: sx(x), cy: sy(y), r: s.marker, style: `fill:${s.color};stroke:var(--surface);stroke-width:1.5` }, plotG);
      }
      continue;
    }
    const d = s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('') + (s.closed ? 'Z' : '');
    el('path', {
      d,
      style: `fill:${s.fill ?? 'none'};stroke:${s.color};stroke-width:${s.width ?? 1.5};` +
        `${s.dash ? `stroke-dasharray:${s.dash};` : ''}stroke-linejoin:round;stroke-linecap:round;${s.opacity ? `opacity:${s.opacity};` : ''}`,
    }, plotG);
  }
  for (const a of spec.annotations ?? []) {
    const t = el('text', { x: sx(a.x) + (a.dx ?? 0), y: sy(a.y) + (a.dy ?? 0), 'text-anchor': a.anchor ?? 'start', style: `fill:${a.color ?? 'var(--text-muted)'}`, 'font-size': 12 }, svg);
    t.textContent = a.text;
  }
  return { sx, sy };
}

// Small legend swatch for a line style.
export function swatch(color, dash, width = 2) {
  return `<svg viewBox="0 0 26 10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" style="stroke:${color};stroke-width:${width};${dash ? `stroke-dasharray:${dash}` : ''}"/></svg>`;
}
