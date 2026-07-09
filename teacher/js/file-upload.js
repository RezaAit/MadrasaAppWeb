/**
 * FileUpload — reusable component (supports multiple files)
 * Usage:
 *   const fu = createFileUpload(container, { existingUrls, accept, label, multiple })
 *   fu.getFiles()    → File[]  (new files selected)
 *   fu.isRemoved()   → true if all existing were removed
 *   fu.getRemovedUrls() → string[] of specifically removed existing URLs
 *
 * Legacy single-file compat:
 *   fu.getFile()     → File | null  (first new file or null)
 */

const BASE = 'http://localhost:805';

export function createFileUpload(container, {
  existingUrl  = null,
  existingUrls = null,
  accept       = 'image/*,.pdf',
  label        = 'সংযুক্তি',
  multiple     = true,
} = {}) {

  // Normalise existing URLs to array
  let existList = _normaliseUrls(existingUrls ?? existingUrl);

  let newFiles    = [];      // File[] newly selected
  let removedUrls = new Set(); // existing URLs explicitly removed

  _rerender();

  // ── public API ──────────────────────────────────────────────
  return {
    getFiles:      () => newFiles,
    getFile:       () => newFiles[0] ?? null,
    isRemoved:     () => removedUrls.size > 0 && existList.every(u => removedUrls.has(u)),
    getRemovedUrls:() => [...removedUrls],
  };

  // ── internals ───────────────────────────────────────────────
  function _rerender() {
    const visibleExist = existList.filter(u => !removedUrls.has(u));

    let html = `<div class="fu-root"><div class="fu-label">${label}</div>`;

    // Existing attachments
    if (visibleExist.length) {
      html += `<div class="fu-exist-list">`;
      for (const url of visibleExist) {
        html += `
          <div class="fu-exist-item" data-url="${url}">
            ${_previewHtml(`${BASE}${url}`, url)}
            <button class="fu-remove-btn fu-remove-exist" type="button" data-url="${url}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              সরান
            </button>
          </div>`;
      }
      html += `</div>`;
    }

    // New file previews
    if (newFiles.length) {
      html += `<div class="fu-new-list">`;
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        html += `
          <div class="fu-new-item">
            ${_previewHtml(URL.createObjectURL(f), f.name)}
            <div class="fu-preview-info">
              <span class="fu-fname" title="${f.name}">${f.name}</span>
              <span class="fu-preview-size">${_size(f.size)}</span>
            </div>
            <button class="fu-remove-btn fu-remove-new" type="button" data-idx="${i}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              সরান
            </button>
          </div>`;
      }
      html += `</div>`;
    }

    const hasAny = newFiles.length || visibleExist.length;
    html += `
      <input type="file" id="fu-input-gallery" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none;">
      <div class="fu-pick-row">
        <button type="button" class="fu-pick-btn fu-pick-gallery" id="fu-btn-gallery">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          ${hasAny ? 'আরও যোগ করুন' : 'ছবি / ফাইল যোগ করুন'}
        </button>
      </div>
      <div class="fu-drop-hint" style="text-align:center;margin-top:4px;">ক্যামেরা বা গ্যালারি থেকে বেছে নিন • সর্বোচ্চ 5MB</div>
    </div>`;

    container.innerHTML = html;
    _wire();
  }

  function _addFiles(fileList) {
    for (const f of fileList) {
      if (f.size > 5 * 1024 * 1024) { alert(`"${f.name}" ফাইলটি 5MB এর বেশি`); continue; }
      newFiles.push(f);
    }
    _rerender();
  }

  function _wire() {
    const galleryInput = container.querySelector('#fu-input-gallery');
    const galleryBtn   = container.querySelector('#fu-btn-gallery');

    // Lightbox
    container.querySelectorAll('[data-lightbox]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => openLightbox(el.dataset.lightbox));
    });

    if (galleryBtn && galleryInput) {
      galleryBtn.addEventListener('click', () => galleryInput.click());
      galleryInput.addEventListener('change', e => { _addFiles(e.target.files); e.target.value = ''; });
    }

    container.querySelectorAll('.fu-remove-exist').forEach(btn => {
      btn.addEventListener('click', () => {
        removedUrls.add(btn.dataset.url);
        _rerender();
      });
    });

    container.querySelectorAll('.fu-remove-new').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        newFiles.splice(idx, 1);
        _rerender();
      });
    });
  }
}

function _normaliseUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  // Try JSON array
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {}
  // Single URL string
  return raw.trim() ? [raw.trim()] : [];
}

function _previewHtml(src, nameOrUrl) {
  const isPdf = (nameOrUrl || '').toLowerCase().includes('.pdf');
  if (isPdf) {
    return `
      <a href="${src}" target="_blank" class="fu-pdf-thumb">
        <div class="fu-pdf-icon">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
        </div>
        <span>PDF ফাইল</span>
      </a>`;
  }
  return `
    <div class="fu-img-thumb" data-lightbox="${src}">
      <img src="${src}" alt="preview" loading="lazy">
      <div class="fu-img-overlay">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </div>
    </div>`;
}

export function openLightbox(src) {
  const existing = document.getElementById('app-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'app-lightbox';
  lb.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,.92);
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    animation:lbFadeIn 200ms ease;
  `;
  lb.innerHTML = `
    <div style="position:absolute;top:16px;right:16px;z-index:2;">
      <button id="lb-close" style="
        width:40px;height:40px;border-radius:50%;
        background:rgba(255,255,255,.15);
        border:1.5px solid rgba(255,255,255,.25);
        color:#fff;font-size:1.2rem;
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;backdrop-filter:blur(4px);
      ">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="max-width:100%;max-height:90vh;padding:16px;display:flex;align-items:center;justify-content:center;">
      <img src="${src}" style="
        max-width:100%;max-height:85vh;
        object-fit:contain;
        border-radius:12px;
        box-shadow:0 20px 60px rgba(0,0,0,.5);
        animation:lbZoomIn 250ms cubic-bezier(0.22,1,0.36,1);
      " alt="preview">
    </div>
    <div style="color:rgba(255,255,255,.5);font-size:.75rem;margin-top:8px;">
      ছবি দেখতে ট্যাপ করুন · বন্ধ করতে বাইরে চাপুন
    </div>
  `;

  document.body.appendChild(lb);
  lb.querySelector('#lb-close').onclick = () => lb.remove();
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });

  let startY = 0;
  lb.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 80) lb.remove();
  }, { passive: true });
}

function _size(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}
