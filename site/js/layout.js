// Shared header, footer, theme toggle and citation rendering for every page.
import { REF_INDEX, REFS } from './refs.js';

const PAGES = [
  ['index.html', 'Overview'],
  ['learn.html', 'Concepts'],
  ['simulator.html', 'Simulator'],
  ['scenarios.html', 'Scenarios'],
  ['echo.html', 'Echo lab'],
  ['pac.html', 'PA catheter'],
  ['references.html', 'References'],
];

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; }
  return null;
}

function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function refText(r) {
  return `${r.authors}. ${r.title}. ${r.journal} ${r.year};${r.volume}:${r.pages}.`;
}

function header() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const h = document.createElement('header');
  h.className = 'site-header';
  h.innerHTML = `<div class="inner">
    <a class="brand" href="index.html">Ventricular–Arterial Coupling<small>Simulation and tutorial · LV and RV</small></a>
    <nav class="nav" aria-label="Main">${PAGES.map(([href, label]) =>
      `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <button class="theme-btn" type="button" aria-label="Toggle light or dark theme"></button>
  </div>`;
  document.body.prepend(h);
  const btn = h.querySelector('.theme-btn');
  const label = () => { btn.textContent = currentTheme() === 'dark' ? 'Light mode' : 'Dark mode'; };
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next); store('vac-theme', next); label();
    document.dispatchEvent(new CustomEvent('themechange'));
  });
  label();
}

function footer() {
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.innerHTML = `<div class="inner">
    Educational model for teaching only. It does not use patient data and does not make diagnostic or treatment recommendations.
    Simulated values come from a lumped time-varying elastance model; see <a href="learn.html#model">model assumptions</a>
    and <a href="references.html">references</a>. Colours follow the Medical College of Wisconsin palette; this site is not an official MCW publication.
  </div>`;
  document.body.append(f);
}

// <cite data-ref="key1,key2"></cite>  →  superscript numbers local to this page.
function citations() {
  const order = [];
  document.querySelectorAll('cite[data-ref]').forEach((c) => {
    const keys = c.dataset.ref.split(',').map((s) => s.trim());
    const nums = keys.map((k) => {
      if (!REF_INDEX[k]) { console.error('Unknown reference key', k); return '?'; }
      if (!order.includes(k)) order.push(k);
      return order.indexOf(k) + 1;
    });
    const sup = document.createElement('sup');
    sup.className = 'cite';
    sup.innerHTML = nums.map((n, i) => `<a href="#ref-${keys[i]}" title="${REF_INDEX[keys[i]] ? refText(REF_INDEX[keys[i]]).replace(/"/g, '&quot;') : ''}">${n}</a>`).join(',');
    c.replaceWith(sup);
  });
  const box = document.getElementById('page-refs');
  if (box && order.length) {
    box.className = 'page-refs';
    box.innerHTML = `<h2>References cited on this page</h2><ol>${order.map((k) => {
      const r = REF_INDEX[k];
      return `<li id="ref-${k}">${refText(r)} <a href="https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/">PMID ${r.pmid}</a>${r.doi ? ` · <a href="https://doi.org/${r.doi}">doi</a>` : ''}</li>`;
    }).join('')}</ol>`;
  }
}

export function initLayout() {
  applyTheme(store('vac-theme'));
  header();
  footer();
  citations();
}

export { REFS };
