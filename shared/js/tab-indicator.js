/**
 * Sliding tab indicator utility.
 * Adds a <div class="tab-indicator"> inside the nav container and
 * animates it to follow the active tab button using getBoundingClientRect().
 *
 * Usage:
 *   import { initTabIndicator } from '../../shared/js/tab-indicator.js';
 *   const { moveTo } = initTabIndicator(navEl);
 *   // Call moveTo(btn) whenever active tab changes, or pass autoWire:true
 *   initTabIndicator(navEl, { autoWire: true, activeClass: 'active' });
 */

export function initTabIndicator(navEl, { autoWire = true, activeClass = 'active' } = {}) {
  if (!navEl || navEl._indicatorAttached) return { moveTo: () => {} };
  navEl._indicatorAttached = true;

  // navEl must be position:relative for the indicator to sit inside it
  navEl.style.position = 'relative';

  const bar = document.createElement('div');
  bar.className = 'tab-indicator';
  navEl.appendChild(bar);

  function moveTo(btn) {
    if (!btn) return;
    const navRect  = navEl.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    // Account for horizontal scroll offset of the nav
    const scrollLeft = navEl.scrollLeft;
    const left  = btnRect.left - navRect.left + scrollLeft;
    const width = btnRect.width;
    bar.style.transform = `translateX(${left}px)`;
    bar.style.width     = `${width}px`;
  }

  // Move to currently active button (if any) immediately — no transition on first paint
  const initial = navEl.querySelector(`.${activeClass}`);
  if (initial) {
    bar.style.transition = 'none';
    moveTo(initial);
    // Re-enable transition after first frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { bar.style.transition = ''; });
    });
  }

  if (autoWire) {
    navEl.addEventListener('click', e => {
      const btn = e.target.closest('button, [role="tab"]');
      if (!btn || !navEl.contains(btn)) return;
      moveTo(btn);
      // Scroll active tab into view on overflow navs
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }

  return { moveTo };
}
