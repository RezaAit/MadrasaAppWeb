/**
 * Ripple utility — attach to any element to get Material-style click ripple.
 * Usage:
 *   import { attachRipple, attachRippleAll } from '../../shared/js/ripple.js';
 *   attachRipple(el);
 *   attachRippleAll('.btn, .card-lift, .list-item');
 */

export function attachRipple(el) {
  if (!el || el._rippleAttached) return;
  el._rippleAttached = true;

  // Ensure el can contain the absolute-positioned ripple span
  const pos = getComputedStyle(el).position;
  if (pos === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';

  el.addEventListener('pointerdown', _spawnRipple, { passive: true });
}

export function attachRippleAll(selector, root = document) {
  root.querySelectorAll(selector).forEach(attachRipple);
}

function _spawnRipple(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();

  const diameter = Math.max(rect.width, rect.height) * 2;
  const x = e.clientX - rect.left - diameter / 2;
  const y = e.clientY - rect.top  - diameter / 2;

  const span = document.createElement('span');
  span.className = 'ripple';
  span.style.cssText = `
    width:${diameter}px;
    height:${diameter}px;
    left:${x}px;
    top:${y}px;
  `;

  // Remove any existing ripple that hasn't cleaned up yet
  el.querySelectorAll('.ripple').forEach(r => r.remove());
  el.appendChild(span);

  span.addEventListener('animationend', () => span.remove(), { once: true });
}
