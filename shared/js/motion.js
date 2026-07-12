/**
 * motion.js — Premium animation engine for MadrasaApp
 * Features: scroll reveal, page settle, header logo spin,
 *           pull-to-refresh, number count-up, skeleton crossfade
 */

// ─── 1. Scroll Reveal ─────────────────────────────────────────────────────────
// Observes .sr elements and reveals them as they enter viewport
let _srObserver = null;

function _initScrollReveal() {
  if (_srObserver) _srObserver.disconnect();
  _srObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('sr-visible');
        _srObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  document.querySelectorAll('.sr').forEach(el => {
    if (!el.classList.contains('sr-visible')) _srObserver.observe(el);
  });
}

// Re-observe after dynamic DOM changes
const _srMutationObs = new MutationObserver(() => {
  document.querySelectorAll('.sr:not(.sr-visible)').forEach(el => {
    _srObserver?.observe(el);
  });
});

export function initScrollReveal() {
  _initScrollReveal();
  _srMutationObs.observe(document.body, { childList: true, subtree: true });
}

// Auto-mark children of .stagger-in and list items as scroll-reveal targets
export function markScrollReveal(container = document) {
  // Cards and list items inside the given container
  container.querySelectorAll(
    '.hw-review-item, .list-item, .card, .dash-card, .stat-card, .notice-card, .att-row, .lv-card, .fee-receipt-row'
  ).forEach((el, i) => {
    if (el.classList.contains('sr')) return;
    el.classList.add('sr');
    el.style.setProperty('--sr-delay', `${Math.min(i * 40, 300)}ms`);
  });
  _initScrollReveal();
}

// ─── 2. Page / Tab Settle Animation ──────────────────────────────────────────
// Called after content is injected into a container
export function settleContent(container, direction = 'forward') {
  if (!container) return;
  const items = container.querySelectorAll(
    '.hw-review-item, .list-item, .card, .dash-card, .stat-card, .notice-card, .lv-card, .fee-receipt-row, .section-header, .hw-create-card'
  );
  items.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = direction === 'back'
      ? 'translateX(-16px)'
      : 'translateY(14px)';
    el.style.transition = 'none';
    const delay = Math.min(i * 80, 500);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms,
                               transform 650ms cubic-bezier(0.34,1.2,0.64,1) ${delay}ms`;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) translateX(0)';
      });
    });
  });
}

// ─── 3. Header Logo Spin ──────────────────────────────────────────────────────
let _logoSpinCount = 0;

export function spinLogo(logoEl) {
  if (!logoEl) return;
  _logoSpinCount++;
  const count = _logoSpinCount;
  // Alternate direction for visual interest
  const dir = count % 2 === 0 ? 1 : -1;
  logoEl.style.transition = 'none';
  logoEl.style.transform = `rotateY(${dir * 90}deg) scale(0.8)`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      logoEl.style.transition = 'transform 600ms cubic-bezier(0.34,1.2,0.64,1)';
      logoEl.style.transform = 'rotateY(0deg) scale(1)';
    });
  });
}

// ─── 4. Pull-to-Refresh ───────────────────────────────────────────────────────
export function initPullToRefresh(scrollEl, onRefresh) {
  if (!scrollEl) return;
  let startY = 0, pulling = false, indicator = null;
  const THRESHOLD = 72;

  function _getOrCreateIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = `
      <svg class="ptr-spinner" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>`;
    scrollEl.parentElement?.insertBefore(indicator, scrollEl);
    return indicator;
  }

  let enabled = true;

  function onStart(e) {
    if (!enabled) return;
    if (scrollEl.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }
  function onMove(e) {
    if (!enabled || !pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) return;
    const progress = Math.min(dy / THRESHOLD, 1);
    const ind = _getOrCreateIndicator();
    ind.style.height = `${Math.min(dy * 0.4, 52)}px`;
    ind.style.opacity = String(progress);
    ind.querySelector('.ptr-spinner').style.transform = `rotate(${dy * 2}deg)`;
  }
  async function onEnd(e) {
    if (!enabled || !pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    const ind = indicator;
    if (!ind) return;
    if (dy >= THRESHOLD) {
      ind.classList.add('ptr-loading');
      ind.querySelector('.ptr-spinner').style.transform = '';
      await onRefresh?.();
    }
    ind.style.transition = 'height 300ms ease, opacity 300ms ease';
    ind.style.height = '0'; ind.style.opacity = '0';
    setTimeout(() => { ind.classList.remove('ptr-loading'); ind.style.transition = ''; }, 300);
  }

  scrollEl.addEventListener('touchstart', onStart, { passive: true });
  scrollEl.addEventListener('touchmove',  onMove,  { passive: true });
  scrollEl.addEventListener('touchend',   onEnd,   { passive: true });

  return {
    destroy() {
      enabled = false;
      pulling = false;
      scrollEl.removeEventListener('touchstart', onStart);
      scrollEl.removeEventListener('touchmove',  onMove);
      scrollEl.removeEventListener('touchend',   onEnd);
      indicator?.remove();
      indicator = null;
    }
  };
}

// ─── 5. Number Count-Up ───────────────────────────────────────────────────────
export function countUp(el, target, { duration = 700, prefix = '', suffix = '' } = {}) {
  if (!el || isNaN(target)) return;
  const start = performance.now();
  const from = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + (target - from) * eased;
    el.textContent = `${prefix}${Number.isInteger(target) ? Math.round(value) : value.toFixed(1)}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Auto count-up all [data-count-up] elements in a container
export function initCountUp(container = document) {
  container.querySelectorAll('[data-count-up]').forEach(el => {
    const target = parseFloat(el.dataset.countUp);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = parseInt(el.dataset.duration || '700', 10);
    // Observe so it only fires when visible
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        countUp(el, target, { duration, prefix, suffix });
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}

// ─── 6. Skeleton → Content Crossfade ─────────────────────────────────────────
export function crossfadeIn(container) {
  if (!container) return;
  container.style.opacity = '0';
  container.style.transform = 'translateY(18px) scale(0.97)';
  container.style.transition = 'none';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.style.transition = 'opacity 600ms ease, transform 650ms cubic-bezier(0.22,1,0.36,1)';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0) scale(1)';
    });
  });
}

// ─── 7. Micro-interactions ───────────────────────────────────────────────────
// Spring-pop an element (for button confirms, success states)
export function springPop(el) {
  if (!el) return;
  el.style.transition = 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)';
  el.style.transform = 'scale(0.85)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = 'scale(1)';
    });
  });
}

// Shake element (for errors)
export function shake(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'motionShake 400ms cubic-bezier(0.22,1,0.36,1)';
}

// ─── Init all ─────────────────────────────────────────────────────────────────
export function initMotion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  initScrollReveal();
}
