// Floating mini window: a small copy of a page's main display, shown in the lower right corner while that
// display is scrolled out of view, so a control further down the page can be moved while its effect stays
// in sight. Clicking the window scrolls back to the full display; × folds it to a small tab (remembered).
// Phones already keep the main display on screen with a sticky card, so the CSS hides the window there.

export function floatWindow({ anchor, title, key }) {
  const store = `vac-float-${key}`;
  let folded = false;
  try { folded = localStorage.getItem(store) === '1'; } catch { /* storage blocked */ }
  const box = document.createElement('aside');
  box.className = 'float-win monitor';
  box.setAttribute('aria-label', `${title}, floating copy`);
  box.hidden = true;
  box.innerHTML = `<div class="fw-head"><button type="button" class="fw-title" title="Back to the full display">${title} ↑</button>
    <button type="button" class="fw-fold" aria-label="Fold the floating window">×</button></div><div class="fw-body"></div>`;
  const tab = document.createElement('button');
  tab.type = 'button'; tab.className = 'float-tab'; tab.hidden = true; tab.textContent = `${title} ▴`;
  document.body.append(box, tab);
  const body = box.querySelector('.fw-body');
  let away = false, onShow = null;

  const sync = () => {
    const was = !box.hidden;
    box.hidden = !away || folded;
    tab.hidden = !away || !folded;
    if (!box.hidden && !was && onShow) onShow();
  };
  const setFolded = (f) => {
    folded = f;
    try { localStorage.setItem(store, f ? '1' : '0'); } catch { /* storage blocked */ }
    sync();
  };
  // shown once the display has left the screen, above or below
  new IntersectionObserver(([e]) => { away = !e.isIntersecting; sync(); }, { threshold: 0 }).observe(anchor);
  box.querySelector('.fw-title').addEventListener('click', () => anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  box.querySelector('.fw-fold').addEventListener('click', () => setFolded(true));
  tab.addEventListener('click', () => setFolded(false));

  return {
    body,
    get visible() { return !box.hidden; },
    onShow(fn) { onShow = fn; },
  };
}
