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
              মুছুন
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
              মুছুন
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

  async function _addFiles(fileList) {
    for (const f of fileList) {
      if (f.size > 5 * 1024 * 1024) { alert(`"${f.name}" ফাইলটি 5MB এর বেশি`); continue; }
      if (f.type.startsWith('image/') && f.size > 300 * 1024) {
        const compressed = await _compressImage(f, 1200, 0.82);
        newFiles.push(compressed);
      } else {
        newFiles.push(f);
      }
    }
    _rerender();
  }

  function _compressImage(file, maxPx, quality) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function _wire() {
    const galleryInput = container.querySelector('#fu-input-gallery');
    const galleryBtn   = container.querySelector('#fu-btn-gallery');

    // Lightbox (image)
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
      <a href="${src}" class="fu-pdf-thumb" style="cursor:pointer;text-decoration:none;">
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

  const imgEl = lb.querySelector('img');
  imgEl.style.transformOrigin = 'center center';
  imgEl.style.willChange = 'transform';
  imgEl.style.touchAction = 'none';
  lb.style.touchAction = 'none';

  let scale = 1, lastScale = 1;
  let panX = 0, panY = 0, lastPanX = 0, lastPanY = 0;
  let isPinching = false;
  let startDist = 0, pinchMidX = 0, pinchMidY = 0;
  let dragStartX = 0, dragStartY = 0;
  let lastTap = 0, tapStartX = 0, tapStartY = 0;
  let swipeStartY = 0;

  function applyTransform(animate) {
    if (animate) imgEl.style.transition = 'transform 200ms ease';
    imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    if (animate) setTimeout(() => { imgEl.style.transition = ''; }, 210);
  }

  function clampPan() {
    const maxX = Math.max(0, (scale - 1) * imgEl.offsetWidth  / 2);
    const maxY = Math.max(0, (scale - 1) * imgEl.offsetHeight / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  }

  lb.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      isPinching = true;
      startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      lastScale = scale;
      lastPanX = panX; lastPanY = panY;
    } else if (e.touches.length === 1) {
      isPinching = false;
      dragStartX = e.touches[0].clientX - panX;
      dragStartY = e.touches[0].clientY - panY;
      swipeStartY = e.touches[0].clientY;
      tapStartX = e.touches[0].clientX;
      tapStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  lb.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2 && isPinching) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(Math.max(lastScale * (dist / startDist), 1), 6);
      clampPan();
      applyTransform(false);
    } else if (e.touches.length === 1 && !isPinching && scale > 1) {
      panX = e.touches[0].clientX - dragStartX;
      panY = e.touches[0].clientY - dragStartY;
      clampPan();
      applyTransform(false);
    }
  }, { passive: false });

  lb.addEventListener('touchend', e => {
    e.preventDefault();
    if (isPinching) {
      lastScale = scale;
      lastPanX = panX; lastPanY = panY;
      isPinching = false;
      if (scale <= 1) { scale = 1; panX = 0; panY = 0; applyTransform(true); }
      return;
    }

    const dx = Math.abs(e.changedTouches[0].clientX - tapStartX);
    const dy = e.changedTouches[0].clientY - swipeStartY;

    // double-tap zoom
    const now = Date.now();
    if (dx < 10 && Math.abs(dy) < 10 && now - lastTap < 300) {
      if (scale > 1) { scale = 1; panX = 0; panY = 0; }
      else { scale = 2.5; }
      lastScale = scale;
      applyTransform(true);
      lastTap = 0;
      return;
    }
    lastTap = now;

    // swipe-down to close only when not zoomed
    if (scale <= 1 && dy > 80) { lb.remove(); return; }

    // tap outside image to close when not zoomed
    if (scale <= 1 && e.target === lb) { lb.remove(); }
  }, { passive: false });

  lb.querySelector('#lb-close').addEventListener('touchend', e => {
    e.stopPropagation(); lb.remove();
  });
}

function _size(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}


/**
 * createRichEditor(container, options)
 * Replaces container content with a toolbar + contenteditable div.
 * Returns { getValue() → HTML string, setValue(html), focus() }
 */
export function createRichEditor(container, {
  placeholder = 'লিখুন...',
  initialValue = '',
  minHeight = '90px',
} = {}) {
  container.innerHTML = `
    <div class="rte-wrap">
      <div class="rte-toolbar">
        <button type="button" data-cmd="bold"      title="Bold"><b>B</b></button>
        <button type="button" data-cmd="italic"    title="Italic"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
        <span class="rte-sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="তালিকা">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" data-cmd="insertOrderedList" title="ক্রমিক তালিকা">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" fill="currentColor" stroke="none">1.</text><text x="2" y="14" font-size="7" fill="currentColor" stroke="none">2.</text><text x="2" y="20" font-size="7" fill="currentColor" stroke="none">3.</text></svg>
        </button>
      </div>
      <div class="rte-body" contenteditable="true" style="min-height:${minHeight};">${initialValue}</div>
      ${!initialValue ? `<div class="rte-placeholder">${placeholder}</div>` : ''}
    </div>
  `;

  const toolbar = container.querySelector('.rte-toolbar');
  const body    = container.querySelector('.rte-body');
  const ph      = container.querySelector('.rte-placeholder');

  // toolbar button clicks
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => { e.preventDefault(); });
    btn.addEventListener('click', () => {
      document.execCommand(btn.dataset.cmd, false, null);
      body.focus();
      _syncActive();
    });
  });

  function _syncActive() {
    toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
      try { btn.classList.toggle('rte-active', document.queryCommandState(btn.dataset.cmd)); }
      catch (_) {}
    });
    if (ph) ph.style.display = body.innerHTML.replace(/<br\s*\/?>/gi,'').trim() ? 'none' : '';
  }

  body.addEventListener('input',     _syncActive);
  body.addEventListener('keyup',     _syncActive);
  body.addEventListener('mouseup',   _syncActive);
  body.addEventListener('touchend',  _syncActive);
  body.addEventListener('focus',     () => { if (ph) ph.style.display = 'none'; });
  body.addEventListener('blur', () => {
    if (ph) ph.style.display = body.innerHTML.replace(/<br\s*\/?>/gi,'').trim() ? 'none' : '';
  });

  return {
    getValue: () => body.innerHTML.trim() === '<br>' ? '' : body.innerHTML.trim(),
    setValue: (html) => { body.innerHTML = html || ''; _syncActive(); },
    focus:    () => body.focus(),
  };
}
