/**
 * Bottom-sheet utility — slide-up modal with drag-to-dismiss.
 *
 * Usage:
 *   import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
 *
 *   const sheet = createBottomSheet({
 *     id: 'my-sheet',           // optional, for deduplication
 *     title: 'শিরোনাম',        // optional header text
 *     content: htmlString,      // inner HTML
 *     onClose: () => {},        // optional callback
 *     fullHeight: false,        // true = 95vh, false = auto (max 90vh)
 *   });
 *   sheet.open();
 *   sheet.close();
 */

export function createBottomSheet({ id, title, content, onClose, fullHeight = false } = {}) {
  // Remove existing sheet with same id
  if (id) document.getElementById(id)?.remove();

  // ── Overlay ────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'bs-overlay';
  if (id) overlay.id = id;

  // ── Sheet panel ───────────────────────────────────────────────────────────
  const sheet = document.createElement('div');
  sheet.className = 'bs-sheet' + (fullHeight ? ' bs-sheet--full' : '');

  // Drag handle
  const handle = document.createElement('div');
  handle.className = 'bs-handle';

  // Optional header
  let headerEl = null;
  if (title) {
    headerEl = document.createElement('div');
    headerEl.className = 'bs-header';
    headerEl.innerHTML = `
      <span class="bs-title">${title}</span>
      <button class="bs-close-btn" aria-label="বন্ধ করুন">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
  }

  // Content
  const body = document.createElement('div');
  body.className = 'bs-body';
  body.innerHTML = content || '';

  sheet.appendChild(handle);
  if (headerEl) sheet.appendChild(headerEl);
  sheet.appendChild(body);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // ── Close logic ───────────────────────────────────────────────────────────
  function close() {
    overlay.classList.add('bs-closing');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      onClose?.();
    }, { once: true });
  }

  overlay.addEventListener('pointerdown', e => {
    if (e.target === overlay) close();
  });
  headerEl?.querySelector('.bs-close-btn')?.addEventListener('click', close);

  // ── Drag to dismiss ───────────────────────────────────────────────────────
  let startY = 0, currentY = 0, dragging = false;

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY = e.clientY;
    currentY = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    currentY = Math.max(0, e.clientY - startY); // only drag down
    sheet.style.transform = `translateY(${currentY}px)`;
  });

  handle.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    if (currentY > 120) {
      close();
    } else {
      sheet.style.transform = '';
    }
  });

  // ── Open ─────────────────────────────────────────────────────────────────
  function open() {
    requestAnimationFrame(() => overlay.classList.add('bs-open'));
  }

  return { overlay, sheet, body, close, open };
}
