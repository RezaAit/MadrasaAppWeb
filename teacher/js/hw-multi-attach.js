/**
 * Reusable multiple-attachment manager for homework create/edit forms.
 * Manages: multiple images (with annotation), multiple voice notes (max 5),
 *          multiple videos, YouTube links, multiple PDFs.
 *
 * Usage:
 *   const mgr = createMultiAttachManager(containerEl, { existingImages, existingVoices, existingVideos, existingYoutube, existingPdfs, onDelete });
 *   mgr.getPayload() → { images, annotated, voices, videos, youtubeUrls, pdfs }
 */

import { initAnnotation, buildToolbar, getAnnotatedBlob } from '../../shared/js/annotation.js';
import { compressImage } from '../../shared/js/compress-image.js';
import { initVoiceRecorder, fetchAudioAsBlob } from '../../shared/js/voice-recorder.js';
import { showToast } from './dashboard.js';

const MAX_VOICES = 5;

// ── Fullscreen annotation overlay ────────────────────────────────────────────
async function _openAnnotationOverlay(imageUrl, onSave) {
  const ov = document.createElement('div');
  ov.id = 'ann-fs-overlay';
  ov.style.cssText = `
    position:fixed;inset:0;z-index:999990;
    background:#0f172a;display:flex;flex-direction:column;
    font-family:system-ui,sans-serif;
  `;

  const canvasId   = 'ann-fs-canvas';
  const toolbarId  = 'ann-fs-toolbar';

  ov.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#1e293b;flex-shrink:0;">
      <span style="color:#f1f5f9;font-size:.9rem;font-weight:700;">✏ ছবিতে আঁকুন</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="ann-fs-zoom-out" style="background:rgba(255,255,255,.1);border:none;color:#e2e8f0;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">−</button>
        <span id="ann-fs-zoom-label" style="color:#94a3b8;font-size:.75rem;font-weight:600;min-width:36px;text-align:center;">100%</span>
        <button id="ann-fs-zoom-in"  style="background:rgba(255,255,255,.1);border:none;color:#e2e8f0;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">+</button>
        <button id="ann-fs-pan-btn"  style="background:rgba(255,255,255,.1);border:none;color:#fbbf24;width:34px;height:34px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Pan / Draw toggle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
        </button>
      </div>
    </div>

    <div id="ann-fs-viewport" style="flex:1;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;touch-action:none;">
      <div id="ann-fs-canvas-wrap" style="transform-origin:0 0;will-change:transform;cursor:crosshair;">
        <canvas id="${canvasId}"></canvas>
      </div>
    </div>

    <div style="flex-shrink:0;background:#1e293b;">
      <div id="${toolbarId}"></div>
      <div style="display:flex;gap:10px;padding:10px 14px;">
        <button id="ann-fs-save" style="flex:1;background:#2563eb;color:#fff;border:none;border-radius:10px;padding:12px;font-size:.9rem;font-weight:700;cursor:pointer;">✓ সেভ করুন</button>
        <button id="ann-fs-cancel" style="flex:0 0 auto;background:rgba(255,255,255,.08);color:#94a3b8;border:none;border-radius:10px;padding:12px 18px;font-size:.9rem;cursor:pointer;">বাতিল</button>
      </div>
    </div>
  `;

  document.body.appendChild(ov);

  const canvas   = ov.querySelector(`#${canvasId}`);
  const wrap     = ov.querySelector('#ann-fs-canvas-wrap');
  const viewport = ov.querySelector('#ann-fs-viewport');
  const zoomLbl  = ov.querySelector('#ann-fs-zoom-label');

  await initAnnotation(canvas, imageUrl);
  buildToolbar(toolbarId);

  // ── Zoom + Pan state ────────────────────────────────────────────
  let scale = 1, tx = 0, ty = 0;
  let panMode = false;

  function _applyTransform() {
    wrap.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    zoomLbl.textContent  = Math.round(scale * 100) + '%';
  }

  function _centerCanvas() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const cw = canvas.width,         ch = canvas.height;
    // fit to viewport
    const fitScale = Math.min(vw / cw, vh / ch, 1);
    scale = fitScale;
    tx = (vw - cw * scale) / 2;
    ty = (vh - ch * scale) / 2;
    _applyTransform();
  }

  // wait for canvas to have dimensions then center
  requestAnimationFrame(_centerCanvas);

  ov.querySelector('#ann-fs-zoom-in').addEventListener('click', () => {
    scale = Math.min(scale * 1.3, 6);
    _applyTransform();
  });
  ov.querySelector('#ann-fs-zoom-out').addEventListener('click', () => {
    scale = Math.max(scale / 1.3, 0.2);
    _applyTransform();
  });

  const panBtn = ov.querySelector('#ann-fs-pan-btn');
  panBtn.addEventListener('click', () => {
    panMode = !panMode;
    panBtn.style.background = panMode ? '#fef3c7' : 'rgba(255,255,255,.1)';
    panBtn.style.color      = panMode ? '#92400e' : '#fbbf24';
    wrap.style.cursor       = panMode ? 'grab' : 'crosshair';
    // disable canvas pointer events in pan mode so we can drag the wrapper
    canvas.style.pointerEvents = panMode ? 'none' : '';
    import('../../shared/js/annotation.js').then(m => m.setMode(panMode ? 'scroll' : 'pen'));
  });

  // ── Touch pinch-zoom + drag (on viewport) ───────────────────────
  let _lastDist = 0, _dragging = false, _startX = 0, _startY = 0, _startTx = 0, _startTy = 0;

  viewport.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _lastDist = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && panMode) {
      _dragging = true;
      _startX = e.touches[0].clientX; _startY = e.touches[0].clientY;
      _startTx = tx; _startTy = ty;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (_lastDist) scale = Math.min(6, Math.max(0.2, scale * dist / _lastDist));
      _lastDist = dist;
      _applyTransform();
    } else if (e.touches.length === 1 && _dragging && panMode) {
      e.preventDefault();
      tx = _startTx + (e.touches[0].clientX - _startX);
      ty = _startTy + (e.touches[0].clientY - _startY);
      _applyTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', e => {
    if (e.touches.length < 2) _lastDist = 0;
    if (e.touches.length === 0) _dragging = false;
  }, { passive: true });

  // ── Mouse drag in pan mode ──────────────────────────────────────
  let _mouseDrag = false, _msx = 0, _msy = 0, _mtx = 0, _mty = 0;
  viewport.addEventListener('mousedown', e => {
    if (!panMode) return;
    _mouseDrag = true; _msx = e.clientX; _msy = e.clientY; _mtx = tx; _mty = ty;
    wrap.style.cursor = 'grabbing';
  });
  viewport.addEventListener('mousemove', e => {
    if (!_mouseDrag) return;
    tx = _mtx + (e.clientX - _msx); ty = _mty + (e.clientY - _msy);
    _applyTransform();
  });
  viewport.addEventListener('mouseup', () => { _mouseDrag = false; if (panMode) wrap.style.cursor = 'grab'; });

  // ── Mouse wheel zoom ────────────────────────────────────────────
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    // zoom toward cursor
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    tx = mx - (mx - tx) * factor;
    ty = my - (my - ty) * factor;
    scale = Math.min(6, Math.max(0.2, scale * factor));
    _applyTransform();
  }, { passive: false });

  // ── Save / Cancel ────────────────────────────────────────────────
  ov.querySelector('#ann-fs-save').addEventListener('click', async () => {
    const saveBtn = ov.querySelector('#ann-fs-save');
    saveBtn.textContent = '⏳ সেভ হচ্ছে...'; saveBtn.disabled = true;
    const blob = await getAnnotatedBlob();
    ov.remove();
    if (blob) onSave(blob);
  });

  ov.querySelector('#ann-fs-cancel').addEventListener('click', () => ov.remove());
}

function _openLightbox(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = `
    <img src="${src}" style="max-width:94vw;max-height:90vh;object-fit:contain;border-radius:8px;">
    <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('button')) ov.remove(); });
  document.body.appendChild(ov);
}

function _ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function _isValidYt(url) {
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

export function createMultiAttachManager(container, {
  existingImages = [],   // [{ id, photoUrl, annotatedPhotoUrl }]
  existingVoices = [],   // [{ id, voiceUrl }]
  existingVideos = [],   // [{ id, videoUrl }]
  existingYoutube = [],  // [{ id, youtubeUrl }]
  existingPdfs = [],     // [{ id, pdfUrl }]
  onDelete = async () => {},  // async (type, id) => {}
} = {}) {

  // ── State ──────────────────────────────────────────────────────
  const newImages   = [];  // [{ file: File, annotatedBlob: Blob|null, previewUrl: string, annCanvas: HTMLCanvasElement|null }]
  const newVoices   = [];  // [{ blob: Blob, url: string }]
  const newVideos   = [];  // [{ file: File, previewUrl: string }]
  const newYoutube  = [];  // string[]
  const newPdfs     = [];  // File[]

  let existingImagesLocal  = [...existingImages];
  let existingVoicesLocal  = [...existingVoices];
  let existingVideosLocal  = [...existingVideos];
  let existingYoutubeLocal = [...existingYoutube];
  let existingPdfsLocal    = [...existingPdfs];

  let voiceRecorders = [];  // active recorder instances

  // ── Render root ────────────────────────────────────────────────
  container.innerHTML = `
    <div class="hwm-section" id="hwm-images-section">
      <div class="hwm-section-header">
        <div class="hwc-section-icon hwc-icon-photo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div>
          <div class="hwc-section-title">ছবি নির্দেশনা</div>
          <div class="hwc-section-sub">একাধিক ছবি যোগ করুন, প্রতিটিতে আঁকা যাবে</div>
        </div>
      </div>
      <div id="hwm-img-list" class="hwm-img-list"></div>
      <input type="file" id="hwm-img-input" accept="image/*" multiple class="hwc-hidden-input">
      <input type="file" id="hwm-cam-input" accept="image/*" capture="environment" class="hwc-hidden-input">
      <div class="hwc-pick-row" style="margin-top:8px;">
        <button type="button" class="hwc-pick-btn hwc-pick-gallery" id="hwm-img-gallery-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>গ্যালারি</span>
        </button>
        <button type="button" class="hwc-pick-btn hwc-pick-camera" id="hwm-img-camera-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>ক্যামেরা</span>
        </button>
      </div>
    </div>

    <div class="hwm-section" id="hwm-voice-section">
      <div class="hwm-section-header">
        <div class="hwc-section-icon hwc-icon-voice">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </div>
        <div>
          <div class="hwc-section-title">ভয়েস নির্দেশনা <span id="hwm-voice-count" style="font-size:.75rem;color:var(--text-muted);"></span></div>
          <div class="hwc-section-sub">সর্বোচ্চ ৫টি ভয়েস নোট রেকর্ড করুন</div>
        </div>
      </div>
      <div id="hwm-voice-list" class="hwm-voice-list"></div>
      <button type="button" class="hwc-voice-init-btn" id="hwm-add-voice-btn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
        নতুন ভয়েস রেকর্ড করুন
      </button>
    </div>

    <div class="hwm-section" id="hwm-video-section">
      <div class="hwm-section-header">
        <div class="hwc-section-icon hwc-icon-video">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        </div>
        <div>
          <div class="hwc-section-title">ভিডিও নির্দেশনা</div>
          <div class="hwc-section-sub">একাধিক ভিডিও যোগ করুন (প্রতিটি সর্বোচ্চ ৫০ MB)</div>
        </div>
      </div>
      <div id="hwm-video-list" class="hwm-video-list"></div>
      <input type="file" id="hwm-video-input" accept="video/*" multiple class="hwc-hidden-input">
      <input type="file" id="hwm-video-cam-input" accept="video/*" capture="environment" class="hwc-hidden-input">
      <div class="hwc-pick-row" style="margin-top:8px;">
        <button type="button" class="hwc-pick-btn hwc-pick-gallery" id="hwm-video-gallery-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>গ্যালারি</span>
        </button>
        <button type="button" class="hwc-pick-btn hwc-pick-camera" id="hwm-video-cam-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <span>রেকর্ড</span>
        </button>
      </div>
    </div>

    <div class="hwm-section" id="hwm-yt-section">
      <div class="hwm-section-header">
        <div class="hwc-section-icon" style="background:#fee2e2;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#dc2626"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zm-13.5 8.6V8.4l8.1 3.6-8.1 3.6z"/></svg>
        </div>
        <div>
          <div class="hwc-section-title">YouTube লিংক</div>
          <div class="hwc-section-sub">YouTube ভিডিওর লিংক যোগ করুন</div>
        </div>
      </div>
      <div id="hwm-yt-list" class="hwm-yt-list"></div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="hwm-yt-input" class="form-input" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;font-size:.85rem;">
        <button type="button" class="btn btn-secondary" id="hwm-yt-add-btn" style="white-space:nowrap;">+ যোগ করুন</button>
      </div>
    </div>

    <div class="hwm-section" id="hwm-pdf-section">
      <div class="hwm-section-header">
        <div class="hwc-section-icon hwc-icon-pdf">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div>
          <div class="hwc-section-title">PDF সংযুক্ত করুন</div>
          <div class="hwc-section-sub">একাধিক PDF যোগ করুন</div>
        </div>
      </div>
      <div id="hwm-pdf-list" class="hwm-pdf-list"></div>
      <input type="file" id="hwm-pdf-input" accept=".pdf,application/pdf" multiple class="hwc-hidden-input">
      <button type="button" class="hwc-voice-init-btn" id="hwm-pdf-add-btn" style="margin-top:8px;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        PDF যোগ করুন
      </button>
    </div>
  `;

  // ── Refs ───────────────────────────────────────────────────────
  const imgList      = container.querySelector('#hwm-img-list');
  const voiceList    = container.querySelector('#hwm-voice-list');
  const voiceCountEl = container.querySelector('#hwm-voice-count');
  const videoList    = container.querySelector('#hwm-video-list');
  const ytList       = container.querySelector('#hwm-yt-list');
  const pdfList      = container.querySelector('#hwm-pdf-list');
  const imgInput     = container.querySelector('#hwm-img-input');
  const camInput     = container.querySelector('#hwm-cam-input');
  const videoInput   = container.querySelector('#hwm-video-input');
  const videoCamInput= container.querySelector('#hwm-video-cam-input');
  const pdfInput     = container.querySelector('#hwm-pdf-input');
  const ytInput      = container.querySelector('#hwm-yt-input');
  const addVoiceBtn  = container.querySelector('#hwm-add-voice-btn');

  // ── Image helpers ──────────────────────────────────────────────
  function _renderExistingImages() {
    existingImagesLocal.forEach((img, ei) => {
      const card = document.createElement('div');
      card.className = 'hwm-img-card';
      card.dataset.existingId = img.id;
      const displayUrl = img.annotatedPhotoUrl || img.photoUrl;
      card.innerHTML = `
        <div class="hwm-img-thumb-wrap">
          <img src="${displayUrl}" class="hwm-img-thumb hwm-zoomable" style="cursor:zoom-in;">
          ${img.annotatedPhotoUrl ? '<span class="hwm-img-badge">আঁকা</span>' : ''}
        </div>
        <div class="hwm-img-ann-toggle">
          <button type="button" class="btn btn-ghost btn-sm hwm-toggle-ann-btn">✏ আঁকুন</button>
          <button type="button" class="hwm-remove-btn" title="সরান">✕</button>
        </div>
      `;

      card.querySelector('.hwm-zoomable').addEventListener('click', () => _openLightbox(displayUrl));

      card.querySelector('.hwm-toggle-ann-btn').addEventListener('click', () => {
        const currentUrl = card.querySelector('.hwm-img-thumb').src;
        _openAnnotationOverlay(currentUrl, blob => {
          const newUrl = URL.createObjectURL(blob);
          card.querySelector('.hwm-img-thumb').src = newUrl;
          let badge = card.querySelector('.hwm-img-badge');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'hwm-img-badge';
            card.querySelector('.hwm-img-thumb-wrap').appendChild(badge);
          }
          badge.textContent = 'আঁকা';
          const file = new File([blob], `annotated_${img.id}.jpg`, { type: 'image/jpeg' });
          newImages.push({ file, annotatedBlob: null, previewUrl: newUrl, annCanvas: null, replacesExistingId: img.id });
          showToast('আঁকা সেভ হয়েছে ✓');
        });
      });

      card.querySelector('.hwm-remove-btn').addEventListener('click', async () => {
        card.style.opacity = '0.4';
        await onDelete('image', img.id);
        existingImagesLocal = existingImagesLocal.filter(i => i.id !== img.id);
        card.remove();
      });
      imgList.appendChild(card);
    });
  }

  async function _addNewImage(file) {
    showToast('ছবি প্রস্তুত হচ্ছে…');
    let result;
    try {
      result = await compressImage(file, { maxPx: 1600, quality: 0.82, maxBytes: 400_000 });
    } catch (_) {
      showToast('ছবি প্রস্তুত করা যায়নি', 'error'); return;
    }
    const compressed = new File([result.blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(result.blob);
    const idx = newImages.length;
    const entry = { file: compressed, annotatedBlob: null, previewUrl, annCanvas: null };
    newImages.push(entry);

    const card = document.createElement('div');
    card.className = 'hwm-img-card hwm-img-card--new';
    card.dataset.newIdx = idx;
    card.innerHTML = `
      <div class="hwm-img-thumb-wrap">
        <img src="${previewUrl}" class="hwm-img-thumb hwm-zoomable" style="cursor:zoom-in;">
        <span id="hwm-ann-saved-${idx}" class="hwm-ann-saved hidden">✓</span>
      </div>
      <div class="hwm-img-ann-toggle">
        <button type="button" class="btn btn-ghost btn-sm hwm-toggle-ann-btn" data-idx="${idx}">✏ আঁকুন</button>
        <button type="button" class="hwm-remove-btn" data-idx="${idx}">✕</button>
      </div>
    `;

    card.querySelector('.hwm-zoomable').addEventListener('click', () => _openLightbox(card.querySelector('.hwm-img-thumb').src));

    card.querySelector('.hwm-toggle-ann-btn').addEventListener('click', () => {
      const currentUrl = card.querySelector('.hwm-img-thumb').src;
      _openAnnotationOverlay(currentUrl, async blob => {
        entry.annotatedBlob = blob;
        const newUrl = URL.createObjectURL(blob);
        card.querySelector('.hwm-img-thumb').src = newUrl;
        const savedEl = card.querySelector(`#hwm-ann-saved-${idx}`);
        savedEl.classList.remove('hidden');
        setTimeout(() => savedEl.classList.add('hidden'), 2000);
        showToast('আঁকা সেভ হয়েছে ✓');
      });
    });
    card.querySelector('.hwm-remove-btn[data-idx]').addEventListener('click', () => {
      newImages.splice(idx, 1);
      card.remove();
    });

    imgList.appendChild(card);
    showToast(`✓ ${result.originalKB} KB → ${result.compressedKB} KB`);
  }

  imgInput.addEventListener('change', async e => {
    for (const file of e.target.files) await _addNewImage(file);
    e.target.value = '';
  });
  camInput.addEventListener('change', async e => {
    if (e.target.files[0]) await _addNewImage(e.target.files[0]);
    e.target.value = '';
  });
  container.querySelector('#hwm-img-gallery-btn').addEventListener('click', () => imgInput.click());
  container.querySelector('#hwm-img-camera-btn').addEventListener('click', () => camInput.click());

  // ── Voice helpers ──────────────────────────────────────────────
  function _voiceTotal() {
    return existingVoicesLocal.length + newVoices.length;
  }

  function _updateVoiceCount() {
    const total = _voiceTotal();
    voiceCountEl.textContent = `(${total}/${MAX_VOICES})`;
    addVoiceBtn.style.display = total >= MAX_VOICES ? 'none' : '';
  }

  function _renderExistingVoices() {
    existingVoicesLocal.forEach(v => {
      const card = _buildExistingVoiceCard(v);
      voiceList.appendChild(card);
    });
    _updateVoiceCount();
  }

  function _buildExistingVoiceCard(v) {
    const card = document.createElement('div');
    card.className = 'hwm-voice-card';
    card.dataset.existingId = v.id;
    card.innerHTML = `
      <div class="hwm-voice-row">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);flex-shrink:0"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
        <audio controls preload="metadata" style="flex:1;min-width:0;"></audio>
        <button type="button" class="hwm-remove-btn" title="সরান">✕</button>
      </div>
    `;
    const audioEl = card.querySelector('audio');
    fetchAudioAsBlob(v.voiceUrl).then(blobUrl => { audioEl.src = blobUrl; audioEl.load(); });
    card.querySelector('.hwm-remove-btn').addEventListener('click', async () => {
      card.style.opacity = '0.4';
      await onDelete('voice', v.id);
      existingVoicesLocal = existingVoicesLocal.filter(i => i.id !== v.id);
      card.remove();
      _updateVoiceCount();
    });
    return card;
  }

  function _addVoiceRecorder() {
    if (_voiceTotal() >= MAX_VOICES) {
      showToast(`সর্বোচ্চ ${MAX_VOICES}টি ভয়েস নোট যোগ করা যাবে`, 'error'); return;
    }
    const recIdx = voiceRecorders.length;
    const wrapperId = `hwm-vrec-${recIdx}`;
    const card = document.createElement('div');
    card.className = 'hwm-voice-card hwm-voice-card--recorder';
    card.innerHTML = `<div id="${wrapperId}"></div>`;
    voiceList.appendChild(card);

    const rec = initVoiceRecorder(wrapperId, {
      maxSeconds: 120,
      onRecorded: (blob, url) => {
        if (!blob) {
          const existing = newVoices.findIndex(v => v._recIdx === recIdx);
          if (existing !== -1) newVoices.splice(existing, 1);
        } else {
          const existing = newVoices.findIndex(v => v._recIdx === recIdx);
          if (existing !== -1) newVoices[existing] = { blob, url, _recIdx: recIdx };
          else newVoices.push({ blob, url, _recIdx: recIdx });
        }
        _updateVoiceCount();
      }
    });
    voiceRecorders.push(rec);
    _updateVoiceCount();
  }

  addVoiceBtn.addEventListener('click', _addVoiceRecorder);

  // ── Video helpers ──────────────────────────────────────────────
  function _renderExistingVideos() {
    existingVideosLocal.forEach(v => {
      const card = _buildExistingVideoCard(v);
      videoList.appendChild(card);
    });
  }

  function _buildExistingVideoCard(v) {
    const card = document.createElement('div');
    card.className = 'hwm-video-card';
    card.dataset.existingId = v.id;
    card.innerHTML = `
      <video controls playsinline preload="metadata" src="${v.videoUrl}" style="width:100%;border-radius:8px;background:#000;max-height:180px;"></video>
      <button type="button" class="hwm-remove-btn hwm-video-remove" title="সরান">✕ সরান</button>
    `;
    card.querySelector('.hwm-remove-btn').addEventListener('click', async () => {
      card.style.opacity = '0.4';
      await onDelete('video', v.id);
      existingVideosLocal = existingVideosLocal.filter(i => i.id !== v.id);
      card.remove();
    });
    return card;
  }

  function _addNewVideo(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { showToast('ভিডিও ৫০ MB এর বেশি হবে না', 'error'); return; }
    const idx = newVideos.length;
    const previewUrl = URL.createObjectURL(file);
    newVideos.push({ file, previewUrl });
    const card = document.createElement('div');
    card.className = 'hwm-video-card hwm-video-card--new';
    card.innerHTML = `
      <video controls playsinline src="${previewUrl}" style="width:100%;border-radius:8px;background:#000;max-height:180px;"></video>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
        <span style="font-size:.75rem;color:var(--text-muted);">${file.name.slice(0, 30)} (${(file.size/1024/1024).toFixed(1)} MB)</span>
        <button type="button" class="hwm-remove-btn" style="font-size:.75rem;color:#f87171;background:none;border:none;cursor:pointer;">✕ সরান</button>
      </div>
    `;
    card.querySelector('.hwm-remove-btn').addEventListener('click', () => {
      newVideos.splice(idx, 1);
      card.remove();
    });
    videoList.appendChild(card);
  }

  videoInput.addEventListener('change', e => {
    for (const file of e.target.files) _addNewVideo(file);
    e.target.value = '';
  });
  videoCamInput.addEventListener('change', e => {
    if (e.target.files[0]) _addNewVideo(e.target.files[0]);
    e.target.value = '';
  });
  container.querySelector('#hwm-video-gallery-btn').addEventListener('click', () => videoInput.click());
  container.querySelector('#hwm-video-cam-btn').addEventListener('click', () => videoCamInput.click());

  // ── YouTube helpers ────────────────────────────────────────────
  function _renderExistingYoutube() {
    existingYoutubeLocal.forEach(yt => {
      const card = _buildYtCard(yt.youtubeUrl, yt.id, true);
      ytList.appendChild(card);
    });
  }

  function _ytVideoId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function _buildYtCard(url, id, isExisting) {
    const card = document.createElement('div');
    card.className = 'hwm-yt-card';
    const thumb = _ytThumb(url);
    const vidId = _ytVideoId(url);
    card.innerHTML = `
      <div class="hwm-yt-row">
        <div class="hwm-yt-preview" style="position:relative;flex-shrink:0;width:80px;height:56px;border-radius:8px;overflow:hidden;background:#000;cursor:pointer;">
          ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : '<div style="width:100%;height:100%;background:#1e293b;"></div>'}
          <div class="hwm-yt-play-btn" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><circle cx="12" cy="12" r="12" fill="rgba(220,38,38,0.85)"/><polygon points="10,8 18,12 10,16" fill="#fff"/></svg>
          </div>
        </div>
        <div class="hwm-yt-info" style="flex:1;min-width:0;">
          <a href="${url}" target="_blank" class="hwm-yt-url">${url.length > 40 ? url.slice(0, 38) + '…' : url}</a>
        </div>
        <button type="button" class="hwm-remove-btn" title="সরান">✕</button>
      </div>
      <div class="hwm-yt-embed-wrap" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;background:#000;position:relative;">
        <button type="button" class="hwm-yt-close-btn" style="position:absolute;top:6px;right:6px;z-index:10;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:28px;height:28px;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
        <div class="hwm-yt-iframe-wrap" style="aspect-ratio:16/9;"></div>
      </div>
    `;
    const previewEl  = card.querySelector('.hwm-yt-preview');
    const embedWrap  = card.querySelector('.hwm-yt-embed-wrap');
    const iframeWrap = card.querySelector('.hwm-yt-iframe-wrap');
    const closeBtn   = card.querySelector('.hwm-yt-close-btn');

    const _openEmbed = () => {
      if (vidId) {
        iframeWrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${vidId}?autoplay=1" width="100%" height="100%" style="border:none;display:block;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        embedWrap.style.display = 'block';
      } else {
        window.open(url, '_blank');
      }
    };
    const _closeEmbed = () => {
      embedWrap.style.display = 'none';
      iframeWrap.innerHTML = '';
    };

    previewEl.addEventListener('click', _openEmbed);
    closeBtn.addEventListener('click', _closeEmbed);
    card.querySelector('.hwm-remove-btn').addEventListener('click', async () => {
      if (isExisting) {
        card.style.opacity = '0.4';
        await onDelete('youtube', id);
        existingYoutubeLocal = existingYoutubeLocal.filter(i => i.id !== id);
      } else {
        const idx = newYoutube.indexOf(url);
        if (idx !== -1) newYoutube.splice(idx, 1);
      }
      card.remove();
    });
    return card;
  }

  function _addYoutubeUrl(url) {
    url = url.trim();
    if (!url) return;
    if (!_isValidYt(url)) { showToast('সঠিক YouTube URL দিন', 'error'); return; }
    if (newYoutube.includes(url) || existingYoutubeLocal.some(y => y.youtubeUrl === url)) {
      showToast('এই লিংক আগেই যোগ করা হয়েছে', 'error'); return;
    }
    newYoutube.push(url);
    ytList.appendChild(_buildYtCard(url, null, false));
    ytInput.value = '';
  }

  container.querySelector('#hwm-yt-add-btn').addEventListener('click', () => _addYoutubeUrl(ytInput.value));
  ytInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _addYoutubeUrl(ytInput.value); } });

  // ── PDF helpers ────────────────────────────────────────────────
  function _pdfSize(bytes) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function _renderExistingPdfs() {
    existingPdfsLocal.forEach(p => {
      const card = document.createElement('div');
      card.className = 'hwm-pdf-card';
      card.dataset.existingId = p.id;
      const name = p.pdfUrl.split('/').pop() || 'PDF ফাইল';
      card.innerHTML = `
        <div class="hwm-pdf-row">
          <svg viewBox="0 0 64 64" width="32" height="32" fill="none" style="flex-shrink:0;">
            <rect x="8" y="4" width="36" height="48" rx="4" fill="#fee2e2" stroke="#fca5a5" stroke-width="1.5"/>
            <polyline points="36,4 36,16 48,16" fill="#fecaca" stroke="#fca5a5" stroke-width="1.5"/>
            <text x="14" y="38" font-family="Arial" font-weight="700" font-size="10" fill="#dc2626">PDF</text>
          </svg>
          <a href="${p.pdfUrl}" target="_blank" class="hwm-pdf-name">${name.length > 35 ? name.slice(0, 32) + '...' : name}</a>
          <button type="button" class="hwm-remove-btn" title="সরান">✕</button>
        </div>
      `;
      card.querySelector('.hwm-remove-btn').addEventListener('click', async () => {
        card.style.opacity = '0.4';
        await onDelete('pdf', p.id);
        existingPdfsLocal = existingPdfsLocal.filter(i => i.id !== p.id);
        card.remove();
      });
      pdfList.appendChild(card);
    });
  }

  function _addNewPdf(file) {
    if (!file || file.type !== 'application/pdf') { showToast('শুধু PDF ফাইল গ্রহণযোগ্য', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { showToast('PDF ২০ MB এর বেশি হবে না', 'error'); return; }
    const idx = newPdfs.length;
    newPdfs.push(file);
    const card = document.createElement('div');
    card.className = 'hwm-pdf-card hwm-pdf-card--new';
    card.innerHTML = `
      <div class="hwm-pdf-row">
        <svg viewBox="0 0 64 64" width="32" height="32" fill="none" style="flex-shrink:0;">
          <rect x="8" y="4" width="36" height="48" rx="4" fill="#fee2e2" stroke="#fca5a5" stroke-width="1.5"/>
          <polyline points="36,4 36,16 48,16" fill="#fecaca" stroke="#fca5a5" stroke-width="1.5"/>
          <text x="14" y="38" font-family="Arial" font-weight="700" font-size="10" fill="#dc2626">PDF</text>
        </svg>
        <div class="hwm-pdf-name">${file.name.length > 35 ? file.name.slice(0, 32) + '...' : file.name} <span style="color:var(--text-muted);font-size:.7rem;">${_pdfSize(file.size)}</span></div>
        <button type="button" class="hwm-remove-btn" title="সরান">✕</button>
      </div>
    `;
    card.querySelector('.hwm-remove-btn').addEventListener('click', () => {
      newPdfs.splice(idx, 1);
      card.remove();
    });
    pdfList.appendChild(card);
  }

  pdfInput.addEventListener('change', e => {
    for (const file of e.target.files) _addNewPdf(file);
    e.target.value = '';
  });
  container.querySelector('#hwm-pdf-add-btn').addEventListener('click', () => pdfInput.click());

  // ── Init: render existing ──────────────────────────────────────
  _renderExistingImages();
  _renderExistingVoices();
  _renderExistingVideos();
  _renderExistingYoutube();
  _renderExistingPdfs();

  // ── Public API ─────────────────────────────────────────────────
  return {
    getPayload() {
      return {
        images:      newImages.map(i => i.file),
        annotated:   newImages.map(i => i.annotatedBlob),
        voices:      newVoices.map(v => v.blob),
        videos:      newVideos.map(v => v.file),
        youtubeUrls: [...newYoutube],
        pdfs:        [...newPdfs],
      };
    },
    hasNewContent() {
      return newImages.length > 0 || newVoices.length > 0 || newVideos.length > 0 || newYoutube.length > 0 || newPdfs.length > 0;
    }
  };
}
