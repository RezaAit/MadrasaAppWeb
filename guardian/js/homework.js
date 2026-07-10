import { getHomework, submitHomework } from './api.js';
import { showToast } from './dashboard.js';
import { initAnnotation, buildToolbar, getAnnotatedBlob } from '../../shared/js/annotation.js';
import { initVoiceRecorder } from '../../shared/js/voice-recorder.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';
import { BASE_URL } from '../../shared/js/api-config.js';

// Subject → color map
const SUBJECT_COLORS = {
  'গণিত':       { bg: '#eff6ff', accent: '#2563eb', icon: '📐' },
  'বাংলা':      { bg: '#fdf4ff', accent: '#9333ea', icon: '📖' },
  'ইংরেজি':    { bg: '#f0fdf4', accent: '#16a34a', icon: '🔤' },
  'বিজ্ঞান':   { bg: '#fff7ed', accent: '#ea580c', icon: '🔬' },
  'ইসলাম':     { bg: '#fefce8', accent: '#ca8a04', icon: '☪️' },
  'সামাজিক':   { bg: '#f0f9ff', accent: '#0284c7', icon: '🌍' },
  'আরবি':      { bg: '#fdf2f8', accent: '#db2777', icon: '📜' },
};

function _subjectStyle(subject) {
  for (const [key, val] of Object.entries(SUBJECT_COLORS)) {
    if (subject?.includes(key)) return val;
  }
  return { bg: '#f8fafc', accent: '#475569', icon: '📚' };
}

// ── Main list ──────────────────────────────────────────────────────────────
export async function loadHomework(container, child) {
  container.innerHTML = `
    <div class="hw-root">
      <div class="skeleton" style="height:52px;border-radius:16px;margin:16px 16px 12px;"></div>
      <div class="skeleton" style="height:120px;border-radius:20px;margin:0 16px 12px;"></div>
      <div class="skeleton" style="height:120px;border-radius:20px;margin:0 16px 12px;"></div>
      <div class="skeleton" style="height:120px;border-radius:20px;margin:0 16px;"></div>
    </div>`;

  const res = await getHomework(child.studentIID);
  const all = res.results || [];
  const pending   = all.filter(h => h.status === 'Pending');
  const submitted = all.filter(h => h.status === 'Submitted' || h.status === 'Reviewed');

  // Overdue count
  const overdue = pending.filter(h => _daysLeftNum(h.dueDate) < 0).length;

  container.innerHTML = `
    <div class="hw-root">
      ${overdue > 0 ? `
        <div class="hw-alert">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${overdue}টি হোমওয়ার্কের সময়সীমা পার হয়ে গেছে!
        </div>` : ''}

      <div class="hw-tabs">
        <button class="hw-tab active" data-tab="pending">
          <span>জমা দেওয়া হয়নি</span>
          <span class="hw-tab-badge ${overdue > 0 ? 'hw-tab-badge--urgent' : ''}">${pending.length}</span>
        </button>
        <button class="hw-tab" data-tab="submitted">
          <span>জমা দেওয়া হয়েছে</span>
          <span class="hw-tab-badge hw-tab-badge--done">${submitted.length}</span>
        </button>
      </div>

      <div id="hw-tab-pending" class="hw-panel">${_renderPending(pending)}</div>
      <div id="hw-tab-submitted" class="hw-panel hw-panel--hidden">${_renderSubmitted(submitted)}</div>
    </div>
  `;

  container.querySelectorAll('.hw-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.hw-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.hw-panel').forEach(p => p.classList.add('hw-panel--hidden'));
      container.querySelector(`#hw-tab-${btn.dataset.tab}`).classList.remove('hw-panel--hidden');
    });
  });

  // Year/month accordion toggles for submitted tab
  container.querySelectorAll('.hw-year-toggle').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const body = hdr.nextElementSibling;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      hdr.querySelector('.gh-year-chevron').classList.toggle('open', !open);
      hdr.classList.toggle('gh-closed', open);
    });
  });
  container.querySelectorAll('.hw-month-toggle').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const body = hdr.nextElementSibling;
      const open = body.classList.contains('open');
      body.classList.toggle('open', !open);
      hdr.querySelector('.gh-month-chevron').classList.toggle('open', !open);
    });
  });

  container.querySelectorAll('.hw-card[data-hw-id]').forEach(card => {
    card.addEventListener('click', () => {
      const hw = all.find(h => String(h.id) === String(card.dataset.hwId));
      if (!hw) return;
      if (hw.status === 'Pending') openSubmitScreen(container, hw, child, all);
      else if (hw.teacherFeedback) showFeedbackDetail(hw);
      else if (hw.status === 'Submitted') showSubmittedView(hw);
    });
  });
}

function _renderPending(list) {
  if (!list.length) return `
    <div class="hw-empty">
      <div class="hw-empty-icon">🎉</div>
      <div class="hw-empty-title">সব হোমওয়ার্ক জমা!</div>
      <div class="hw-empty-sub">দারুণ কাজ করেছ!</div>
    </div>`;

  // Sort: overdue first, then by dueDate
  const sorted = [...list].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return sorted.map(h => {
    const daysLeft = _daysLeftNum(h.dueDate);
    const isOverdue = daysLeft < 0;
    const isUrgent  = daysLeft === 0 || daysLeft === 1;
    const style = _subjectStyle(h.subject);

    const urgencyClass = isOverdue ? 'hw-urgency--overdue' : isUrgent ? 'hw-urgency--urgent' : 'hw-urgency--ok';
    const urgencyText  = isOverdue
      ? `${Math.abs(daysLeft)} দিন দেরি`
      : daysLeft === 0 ? 'আজকে শেষ!'
      : daysLeft === 1 ? 'কাল শেষ!'
      : `${daysLeft} দিন বাকি`;

    return `
      <div class="hw-card hw-card--pending" data-hw-id="${h.id}" style="--hw-accent:${style.accent};--hw-bg:${style.bg}">
        <div class="hw-card-stripe"></div>
        <div class="hw-card-inner">
          <div class="hw-card-top">
            <div class="hw-subject-chip">
              <span class="hw-subject-icon">${style.icon}</span>
              <span>${h.subject}</span>
            </div>
            <div class="hw-urgency ${urgencyClass}">${urgencyText}</div>
          </div>
          <div class="hw-card-title">${h.title}</div>
          <div class="hw-card-bottom">
            <div class="hw-teacher">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${h.teacherName ?? '—'}
            </div>
            <div class="hw-due">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${_fmt(h.dueDate)}
            </div>
          </div>
          <div class="hw-card-cta">
            <span>জমা দিন</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>
      </div>`;
  }).join('');
}

function _hwCard(h) {
  const style = _subjectStyle(h.subject);
  const fb = h.teacherFeedback;
  const reactionConfig = fb ? _reactionConfig(fb.reaction) : null;
  return `
    <div class="hw-card hw-card--submitted ${fb ? 'hw-card--reviewed' : ''}" data-hw-id="${h.id}" style="--hw-accent:${style.accent};--hw-bg:${style.bg};margin-bottom:8px;">
      <div class="hw-card-stripe"></div>
      <div class="hw-card-inner">
        <div class="hw-card-top">
          <div class="hw-subject-chip"><span class="hw-subject-icon">${style.icon}</span><span>${h.subject}</span></div>
          ${fb ? `<div class="hw-reaction-badge" style="background:${reactionConfig.bg};color:${reactionConfig.color};">${reactionConfig.emoji} ${reactionConfig.label}</div>`
               : `<div class="hw-submitted-badge">✓ জমা</div>`}
        </div>
        <div class="hw-card-title">${h.title}</div>
        <div class="hw-card-bottom">
          <div class="hw-teacher"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${h.teacherName ?? '—'}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <div class="hw-due"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>জমা: ${_fmt(h.submittedAt)}</div>
            ${h.dueDate ? `<div class="hw-due" style="color:#dc2626;font-weight:600;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>সীমা: ${_fmt(h.dueDate)}</div>` : ''}
          </div>
        </div>
        ${fb ? `<div class="hw-card-cta hw-card-cta--review"><span>মতামত দেখুন</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>` : ''}
      </div>
    </div>`;
}

function _renderSubmitted(list) {
  if (!list.length) return `
    <div class="hw-empty">
      <div class="hw-empty-icon">📋</div>
      <div class="hw-empty-title">এখনো কোনো জমা নেই</div>
      <div class="hw-empty-sub">হোমওয়ার্ক জমা দিলে এখানে দেখাবে</div>
    </div>`;

  const tree = new Map();
  list.forEach(h => {
    const d = new Date(h.submittedAt || h.dueDate);
    const yr = d.getFullYear();
    const mKey = `${yr}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const mLabel = d.toLocaleDateString('bn-BD', { month: 'long' });
    if (!tree.has(yr)) tree.set(yr, new Map());
    const months = tree.get(yr);
    if (!months.has(mKey)) months.set(mKey, { label: mLabel, items: [] });
    months.get(mKey).items.push(h);
  });

  const sortedYears = [...tree.entries()].sort((a,b) => b[0]-a[0]);
  const latestYear  = sortedYears[0]?.[0];
  const latestMonth = latestYear ? [...tree.get(latestYear).keys()].sort().pop() : null;

  return sortedYears.map(([yr, months]) => {
    const isLatestYr = yr === latestYear;
    const totalYr = [...months.values()].reduce((s,m) => s+m.items.length, 0);
    const sortedMonths = [...months.entries()].sort((a,b) => b[0].localeCompare(a[0]));

    const monthRows = sortedMonths.map(([mKey, group]) => {
      const isLatestMon = mKey === latestMonth;
      return `
        <div>
          <div class="gh-month-header hw-month-toggle">
            <div class="gh-month-left" style="flex-direction:row;align-items:center;gap:6px;">
              <span class="gh-month-name">${group.label}</span>
              <span class="gh-month-sub" style="margin-top:0;">${group.items.length}টি</span>
            </div>
            <svg class="gh-month-chevron${isLatestMon ? ' open' : ''}" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="gh-month-body${isLatestMon ? ' open' : ''}">
            <div style="padding:8px 12px;">${group.items.map(h => _hwCard(h)).join('')}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="gh-year-group">
        <div class="gh-year-header hw-year-toggle${isLatestYr ? '' : ' gh-closed'}">
          <span class="gh-year-title">${yr} সাল</span>
          <div class="gh-year-right">
            <span class="gh-year-meta">${totalYr}টি</span>
            <svg class="gh-year-chevron${isLatestYr ? ' open' : ''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="gh-year-body"${isLatestYr ? '' : ' style="display:none;"'}>${monthRows}</div>
      </div>`;
  }).join('');
}

// ── Submit Screen ──────────────────────────────────────────────────────────
function openSubmitScreen(mainContainer, hw, child, all) {
  let voiceRecorder = null;
  // photoEntries: [{ file: File, annotatedBlob: Blob|null, previewUrl: string, annotatedUrl: string|null }]
  const photoEntries = [];
  const style = _subjectStyle(hw.subject);
  const daysLeft = _daysLeftNum(hw.dueDate);
  const isOverdue = daysLeft < 0;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'hw-submit-sheet',
    title: hw.title,
    content: `
      <div class="hw-sheet-wrap">

        <!-- Info card -->
        <div class="hw-info-banner" style="background:${style.bg};border-color:${style.accent}30;">
          <div class="hw-info-banner-left">
            <div class="hw-info-subject" style="color:${style.accent};">${style.icon} ${hw.subject}</div>
            <div class="hw-info-teacher">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${hw.teacherName}
            </div>
          </div>
          <div class="hw-info-due ${isOverdue ? 'hw-info-due--overdue' : ''}">
            <div class="hw-info-due-num">${Math.abs(daysLeft)}</div>
            <div class="hw-info-due-label">${isOverdue ? 'দিন দেরি' : daysLeft === 0 ? 'আজকে!' : 'দিন বাকি'}</div>
          </div>
        </div>

        ${_renderInstructionMedia(hw)}

        <!-- Upload options -->
        <div class="hw-section-title">জমা দেওয়ার পদ্ধতি বেছে নিন</div>

        <!-- Photo pick + grid -->
        <input type="file" id="hw-photo-gallery-input" accept="image/*" multiple style="display:none;">
        <input type="file" id="hw-photo-cam-input" accept="image/*" capture="environment" style="display:none;">
        <div class="hw-pick-row">
          <button type="button" class="hw-pick-btn hw-pick-gallery" id="hw-photo-gallery-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>গ্যালারি</span>
          </button>
          <button type="button" class="hw-pick-btn hw-pick-camera" id="hw-photo-cam-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>ক্যামেরা</span>
          </button>
        </div>
        <div id="hw-photo-grid" class="hw-submit-photo-grid"></div>

        <!-- Voice -->
        <div class="hw-option-card" id="hw-opt-voice">
          <div class="hw-option-icon" style="background:#fff7ed;color:#ea580c;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">ভয়েস নোট</div>
            <div class="hw-option-sub">সর্বোচ্চ ৬০ সেকেন্ড</div>
          </div>
          <div class="hw-option-toggle" id="hw-voice-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-voice-wrap">
          <div id="voice-recorder-wrap"></div>
        </div>

        <!-- Text -->
        <div class="hw-option-card" id="hw-opt-text">
          <div class="hw-option-icon" style="background:#f0fdf4;color:#16a34a;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">মন্তব্য লিখুন</div>
            <div class="hw-option-sub">ঐচ্ছিক</div>
          </div>
          <div class="hw-option-toggle" id="hw-text-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-text-wrap">
          <textarea class="hw-textarea" id="hw-remarks" placeholder="যেমন: আজ অসুস্থ ছিলাম, তাই একটু কম করতে পেরেছি..."></textarea>
        </div>

        <!-- Submit -->
        <div class="hw-submit-footer">
          <button class="hw-submit-btn" id="final-submit-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            হোমওয়ার্ক জমা দিন
          </button>
        </div>

      </div>`,
    fullHeight: true,
  });
  open();

  // Wire zoom on instruction images
  sheetBody.querySelectorAll('.hw-zoomable').forEach(img => {
    img.addEventListener('click', () => _openImageZoom(img.dataset.full));
  });

  // Collapsible option cards
  [['voice','voice-wrap'],['text','text-wrap']].forEach(([key, wrapId]) => {
    const card = sheetBody.querySelector(`#hw-opt-${key}`);
    const wrap = sheetBody.querySelector(`#hw-${wrapId}`);
    const toggle = sheetBody.querySelector(`#hw-${key}-toggle`);
    card?.addEventListener('click', () => {
      const isOpen = wrap.classList.contains('open');
      wrap.classList.toggle('open', !isOpen);
      toggle.classList.toggle('rotated', !isOpen);
      if (!isOpen && key === 'voice' && !voiceRecorder) {
        voiceRecorder = initVoiceRecorder('voice-recorder-wrap', { maxSeconds: 60 });
      }
    });
  });

  // Gallery / Camera buttons
  sheetBody.querySelector('#hw-photo-gallery-btn')?.addEventListener('click', () => sheetBody.querySelector('#hw-photo-gallery-input').click());
  sheetBody.querySelector('#hw-photo-cam-btn')?.addEventListener('click', () => sheetBody.querySelector('#hw-photo-cam-input').click());
  sheetBody.querySelector('#hw-photo-gallery-input')?.addEventListener('change', e => {
    if (e.target.files.length) _addPhotos(e.target.files);
  });
  sheetBody.querySelector('#hw-photo-cam-input')?.addEventListener('change', e => {
    if (e.target.files.length) _addPhotos(e.target.files);
  });

  function _addPhotos(files) {
    const grid = sheetBody.querySelector('#hw-photo-grid');
    Array.from(files).forEach(file => {
      const entry = { file, annotatedBlob: null, previewUrl: URL.createObjectURL(file), annotatedUrl: null };
      photoEntries.push(entry);
      const idx = photoEntries.length - 1;

      const card = document.createElement('div');
      card.className = 'hw-submit-photo-card';
      card.dataset.idx = idx;
      card.innerHTML = `
        <img class="hw-submit-photo-img" src="${entry.previewUrl}" alt="">
        <button class="hw-submit-photo-remove">✕</button>
        <button class="hw-submit-photo-annotate">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          আঁকুন
        </button>`;
      card.querySelector('.hw-submit-photo-remove').addEventListener('click', () => {
        photoEntries.splice(idx, 1);
        card.remove();
        // re-index remaining cards
        grid.querySelectorAll('.hw-submit-photo-card').forEach((c, i) => c.dataset.idx = i);
      });
      card.querySelector('.hw-submit-photo-annotate').addEventListener('click', () => {
        const src = entry.annotatedUrl || entry.previewUrl;
        _openAnnotationOverlay(src, blob => {
          entry.annotatedBlob = blob;
          entry.annotatedUrl = URL.createObjectURL(blob);
          card.querySelector('.hw-submit-photo-img').src = entry.annotatedUrl;
          const btn = card.querySelector('.hw-submit-photo-annotate');
          btn.style.background = '#dcfce7'; btn.style.color = '#15803d';
        });
      });
      grid.appendChild(card);
    });
    // reset inputs
    sheetBody.querySelector('#hw-photo-gallery-input').value = '';
    sheetBody.querySelector('#hw-photo-cam-input').value = '';
  }

  // Submit
  sheetBody.querySelector('#final-submit-btn')?.addEventListener('click', async () => {
    const remarks = sheetBody.querySelector('#hw-remarks').value.trim();
    const vBlob = voiceRecorder?.getBlob() ?? null;
    if (!photoEntries.length && !vBlob && !remarks) {
      showToast('কমপক্ষে একটি তথ্য দিন', 'error'); return;
    }
    const btn = sheetBody.querySelector('#final-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> জমা হচ্ছে...`;
    // first photo → primary; annotated blob if exists; rest → extraImages
    const first = photoEntries[0] || null;
    const payload = {
      image:        first ? (first.annotatedBlob || first.file) : null,
      annotated:    null,
      voice:        vBlob,
      textRemarks:  remarks || null,
    };
    const extraImages = photoEntries.slice(1).map(e => e.annotatedBlob || e.file);
    const resData = await submitHomework(hw.id, payload, extraImages);
    if (!resData.HasError) {
      _showSuccessScreen(sheetBody, close, hw, mainContainer, child, all);
    } else {
      showToast(resData.message || 'ত্রুটি হয়েছে', 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> হোমওয়ার্ক জমা দিন`;
    }
  });
}

function _showSuccessScreen(sheetBody, close, hw, mainContainer, child, all) {
  sheetBody.innerHTML = `
    <div class="hw-success">
      <div class="hw-success-circle">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="hw-success-title">জমা হয়েছে! 🎉</div>
      <div class="hw-success-sub">শিক্ষক শীঘ্রই রিভিউ করবেন</div>
      <div class="hw-success-hw">${hw.subject} · ${hw.title}</div>
      <button class="hw-success-btn" id="hw-back-btn">ফিরে যাই</button>
    </div>`;
  sheetBody.querySelector('#hw-back-btn').addEventListener('click', () => {
    close();
    // Refresh list
    const found = all.find(h => h.id === hw.id);
    if (found) found.status = 'Submitted';
    loadHomework(mainContainer, child);
  });
}

// ── Submitted view (no feedback yet) ─────────────────────────────────────
function showSubmittedView(hw) {
  const sub = hw.submission;
  const allPhotos = [];
  if (sub?.primaryImageUrl) allPhotos.push(sub.primaryImageUrl);
  if (sub?.annotatedPhotoUrl) allPhotos.push(sub.annotatedPhotoUrl);
  (sub?.images || []).forEach(u => allPhotos.push(u));

  const { open, body: sheetBody } = createBottomSheet({
    id: 'hw-submitted-sheet',
    title: 'জমা দেওয়া হয়েছে',
    content: `
      <div class="hw-sheet-wrap">
        <div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border-radius:14px;padding:14px;margin-bottom:16px;">
          <div style="width:40px;height:40px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style="font-weight:700;color:#15803d;font-size:.95rem;">জমা হয়েছে</div>
            <div style="font-size:.8rem;color:#4ade80;">শিক্ষক শীঘ্রই রিভিউ করবেন</div>
          </div>
        </div>

        <div style="font-weight:700;font-size:.85rem;color:#0f172a;margin-bottom:6px;">${hw.subject} · ${hw.title}</div>

        ${allPhotos.length ? `
          <div class="hw-feedback-section-title" style="margin-top:14px;margin-bottom:8px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            জমা দেওয়া ছবি
          </div>
          <div class="hw-photo-grid">
            ${allPhotos.map(u => `<img src="${_full(u)}" data-full="${_full(u)}" class="hw-zoomable">`).join('')}
          </div>` : '<div style="color:#94a3b8;font-size:.85rem;text-align:center;padding:20px 0;">কোনো ছবি জমা দেওয়া হয়নি</div>'}

        ${sub?.textRemarks ? `
          <div class="hw-feedback-section" style="margin-top:14px;">
            <div class="hw-feedback-section-title">তোমার মন্তব্য</div>
            <p class="hw-feedback-remark">${sub.textRemarks}</p>
          </div>` : ''}

        ${sub?.voiceNoteUrl ? `
          <div class="hw-feedback-section" style="margin-top:14px;">
            <div class="hw-feedback-section-title">তোমার ভয়েস নোট</div>
            <audio controls style="width:100%;border-radius:10px;" src="${_full(sub.voiceNoteUrl)}"></audio>
          </div>` : ''}
      </div>`,
    fullHeight: true,
  });
  open();
  sheetBody.querySelectorAll('.hw-zoomable').forEach(img => {
    img.addEventListener('click', () => _openImageZoom(img.dataset.full));
  });
}

// ── Feedback detail ────────────────────────────────────────────────────────
function showFeedbackDetail(hw) {
  const fb = hw.teacherFeedback;
  const sub = hw.submission;
  const rc = _reactionConfig(fb.reaction);
  const allPhotos = [];
  if (sub?.primaryImageUrl) allPhotos.push(sub.primaryImageUrl);
  if (sub?.annotatedPhotoUrl) allPhotos.push(sub.annotatedPhotoUrl);
  (sub?.images || []).forEach(u => allPhotos.push(u));

  const { open, body: sheetBody } = createBottomSheet({
    id: 'hw-feedback-sheet',
    title: 'শিক্ষকের মতামত',
    content: `
      <div class="hw-sheet-wrap">
        <!-- Reaction hero -->
        <div class="hw-feedback-hero-wrap">
          <div class="hw-wave-ring" style="--hw-glow:${rc.color};"></div>
          <div class="hw-wave-ring" style="--hw-glow:${rc.color};"></div>
          <div class="hw-wave-ring" style="--hw-glow:${rc.color};"></div>
          <div class="hw-feedback-hero" style="background:${rc.bg};--hw-glow:${rc.color};--hw-glow-a06:rgba(${rc.glow},.06);--hw-glow-a10:rgba(${rc.glow},.10);--hw-glow-a14:rgba(${rc.glow},.14);--hw-glow-a18:rgba(${rc.glow},.18);--hw-glow-a25:rgba(${rc.glow},.25);--hw-glow-a30:rgba(${rc.glow},.30);--hw-glow-a40:rgba(${rc.glow},.40);">
            <div class="hw-feedback-emoji">${rc.emoji}</div>
            <div class="hw-feedback-label" style="color:${rc.color};">${rc.label}</div>
            <div class="hw-feedback-hw">${hw.title}</div>
            ${hw.subject ? `<div style="font-size:.78rem;font-weight:700;color:${rc.color};opacity:.8;margin-top:4px;">${hw.subject}</div>` : ''}
            ${hw.dueDate ? `<div style="font-size:.72rem;color:${rc.color};opacity:.6;margin-top:2px;">সীমা: ${_fmt(hw.dueDate)}</div>` : ''}
          </div>
        </div>

        ${fb.note ? `
          <div class="hw-feedback-section">
            <div class="hw-feedback-section-title">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              শিক্ষকের নোট
            </div>
            <p class="hw-feedback-note">${fb.note}</p>
          </div>` : ''}

        ${allPhotos.length ? `
          <div class="hw-feedback-section">
            <div class="hw-feedback-section-title">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              তোমার জমা দেওয়া ছবি
            </div>
            <div class="hw-photo-grid">
              ${allPhotos.map(u => `<img src="${_full(u)}" data-full="${_full(u)}" class="hw-zoomable">`).join('')}
            </div>
          </div>` : ''}

        ${sub?.textRemarks ? `
          <div class="hw-feedback-section">
            <div class="hw-feedback-section-title">তোমার মন্তব্য</div>
            <p class="hw-feedback-remark">${sub.textRemarks}</p>
          </div>` : ''}

        ${sub?.voiceNoteUrl ? `
          <div class="hw-feedback-section">
            <div class="hw-feedback-section-title">তোমার ভয়েস নোট</div>
            <audio controls style="width:100%;border-radius:10px;" src="${_full(sub.voiceNoteUrl)}"></audio>
          </div>` : ''}

        ${_renderInstructionMedia(hw)}
      </div>`,
  });
  open();
  sheetBody.querySelectorAll('.hw-zoomable').forEach(img => {
    img.addEventListener('click', () => _openImageZoom(img.dataset.full));
  });
  // Particle burst on open
  const hero = sheetBody.querySelector('.hw-feedback-hero');
  if (hero) {
    const colors = {
      Excellent: ['#f59e0b','#fcd34d','#fef08a','#f97316'],
      StarWork:  ['#eab308','#fde047','#fef9c3','#f59e0b'],
      Good:      ['#16a34a','#4ade80','#bbf7d0','#22c55e'],
      NeedsImprovement: ['#ea580c','#fb923c','#fed7aa','#f97316'],
      Incomplete:['#dc2626','#f87171','#fecaca','#ef4444'],
    };
    const palette = colors[fb.reaction] || ['#6366f1','#a78bfa','#c4b5fd'];
    const container = document.createElement('div');
    container.className = 'rxn-particles';
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'rxn-particle';
      const angle = (i / 14) * 360;
      const dist = 50 + Math.random() * 35;
      const rad = angle * Math.PI / 180;
      p.style.cssText = `background:${palette[i%palette.length]};--dx:${(Math.cos(rad)*dist).toFixed(1)}px;--dy:${(Math.sin(rad)*dist).toFixed(1)}px;animation-delay:${(Math.random()*80).toFixed(0)}ms;width:${5+Math.random()*4|0}px;height:${5+Math.random()*4|0}px;`;
      container.appendChild(p);
    }
    hero.appendChild(container);
    setTimeout(() => container.remove(), 900);
  }
}

// ── Instruction media renderer ─────────────────────────────────────────────
function _renderInstructionMedia(hw) {
  const images   = hw.instructionImages   || [];
  const voices   = hw.instructionVoices   || [];
  const videos   = hw.instructionVideos   || [];
  const youtubes = hw.youtubeLinks        || [];
  const pdfs     = hw.instructionPdfs     || [];

  const hasLegacyPhoto = hw.instructionPhotoUrl || hw.instructionAnnotatedPhotoUrl;
  const hasLegacyVoice = hw.instructionVoiceNoteUrl;
  const hasLegacyPdf   = hw.pdfAttachmentUrl;
  const hasDescription = hw.description && hw.description.trim();

  const hasMedia = images.length || voices.length || videos.length || youtubes.length || pdfs.length || hasLegacyPhoto || hasLegacyVoice || hasLegacyPdf;
  if (!hasMedia && !hasDescription) return '';

  const allPhotos = [];
  if (hw.instructionPhotoUrl) allPhotos.push(_full(hw.instructionPhotoUrl));
  if (hw.instructionAnnotatedPhotoUrl) allPhotos.push(_full(hw.instructionAnnotatedPhotoUrl));
  images.forEach(img => {
    const p = img.photoUrl || img.PhotoUrl;
    const a = img.annotatedPhotoUrl || img.AnnotatedPhotoUrl;
    if (a) allPhotos.push(_full(a));
    else if (p) allPhotos.push(_full(p));
  });

  return `
    <div class="hw-instruction-block">
      <div class="hw-instruction-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        শিক্ষকের নির্দেশনা
      </div>
      ${hasDescription ? `<p class="hw-instr-desc">${hw.description}</p>` : ''}
      ${allPhotos.length ? `
        <div class="hw-instr-photo-grid">
          ${allPhotos.map(u => `<img src="${u}" data-full="${u}" class="hw-zoomable hw-instr-photo">`).join('')}
        </div>` : ''}
      ${voices.length ? voices.map(v => `
        <audio controls class="hw-instr-audio" src="${_full(v.voiceUrl || v.VoiceUrl)}"></audio>`).join('') : ''}
      ${hasLegacyVoice ? `<audio controls class="hw-instr-audio" src="${_full(hw.instructionVoiceNoteUrl)}"></audio>` : ''}
      ${videos.length ? videos.map(v => `
        <video controls class="hw-instr-video" src="${_full(v.videoUrl || v.VideoUrl)}"></video>`).join('') : ''}
      ${youtubes.length ? youtubes.map(y => {
        const url = y.youtubeUrl || y.YoutubeUrl || '';
        const vid = _ytVideoId(url);
        return vid
          ? `<div class="hw-instr-yt-wrap"><iframe class="hw-instr-yt" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`
          : `<a href="${url}" target="_blank" rel="noopener" class="hw-instr-youtube">YouTube ভিডিও দেখুন</a>`;
      }).join('') : ''}
      ${pdfs.length ? pdfs.map(p => `
        <a href="${_full(p.pdfUrl || p.PdfUrl)}" target="_blank" rel="noopener" class="hw-pdf-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF খুলুন
        </a>`).join('') : ''}
      ${hasLegacyPdf ? `
        <a href="${_full(hw.pdfAttachmentUrl)}" target="_blank" rel="noopener" class="hw-pdf-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF খুলুন
        </a>` : ''}
    </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _ytVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v') || null;
  } catch { return null; }
}

function _full(url) {
  if (!url) return url;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function _openImageZoom(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <img src="${src}" style="max-width:94vw;max-height:90vh;object-fit:contain;border-radius:8px;">
    <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(4px);">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('button')) overlay.remove(); });
  document.body.appendChild(overlay);
}

function _daysLeftNum(dueDate) {
  return Math.ceil((new Date(dueDate) - new Date()) / 86400000);
}

// ── Fullscreen annotation overlay (same as teacher app) ───────────────────
async function _openAnnotationOverlay(imageUrl, onSave) {
  const ov = document.createElement('div');
  ov.id = 'ann-fs-overlay';
  ov.style.cssText = `position:fixed;inset:0;z-index:999990;background:#0f172a;display:flex;flex-direction:column;font-family:system-ui,sans-serif;`;

  const canvasId  = 'ann-fs-canvas';
  const toolbarId = 'ann-fs-toolbar';

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
    </div>`;

  document.body.appendChild(ov);

  const canvas   = ov.querySelector(`#${canvasId}`);
  const wrap     = ov.querySelector('#ann-fs-canvas-wrap');
  const viewport = ov.querySelector('#ann-fs-viewport');
  const zoomLbl  = ov.querySelector('#ann-fs-zoom-label');

  await initAnnotation(canvas, imageUrl);
  buildToolbar(toolbarId);

  let scale = 1, tx = 0, ty = 0, panMode = false;

  function _applyTransform() {
    wrap.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    zoomLbl.textContent  = Math.round(scale * 100) + '%';
  }
  function _centerCanvas() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const cw = canvas.width,         ch = canvas.height;
    const fitScale = Math.min(vw / cw, vh / ch, 1);
    scale = fitScale;
    tx = (vw - cw * scale) / 2;
    ty = (vh - ch * scale) / 2;
    _applyTransform();
  }
  requestAnimationFrame(_centerCanvas);

  ov.querySelector('#ann-fs-zoom-in').addEventListener('click',  () => { scale = Math.min(scale * 1.3, 6); _applyTransform(); });
  ov.querySelector('#ann-fs-zoom-out').addEventListener('click', () => { scale = Math.max(scale / 1.3, 0.2); _applyTransform(); });

  const panBtn = ov.querySelector('#ann-fs-pan-btn');
  panBtn.addEventListener('click', () => {
    panMode = !panMode;
    panBtn.style.background = panMode ? '#fef3c7' : 'rgba(255,255,255,.1)';
    panBtn.style.color      = panMode ? '#92400e' : '#fbbf24';
    wrap.style.cursor       = panMode ? 'grab' : 'crosshair';
    canvas.style.pointerEvents = panMode ? 'none' : '';
    import('../../shared/js/annotation.js').then(m => m.setMode(panMode ? 'scroll' : 'pen'));
  });

  let _lastDist = 0, _dragging = false, _startX = 0, _startY = 0, _startTx = 0, _startTy = 0;
  viewport.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      _lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1 && panMode) {
      _dragging = true; _startX = e.touches[0].clientX; _startY = e.touches[0].clientY; _startTx = tx; _startTy = ty;
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (_lastDist) scale = Math.min(6, Math.max(0.2, scale * dist / _lastDist));
      _lastDist = dist; _applyTransform();
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

  let _mouseDrag = false, _msx = 0, _msy = 0, _mtx = 0, _mty = 0;
  viewport.addEventListener('mousedown', e => { if (!panMode) return; _mouseDrag = true; _msx = e.clientX; _msy = e.clientY; _mtx = tx; _mty = ty; wrap.style.cursor = 'grabbing'; });
  viewport.addEventListener('mousemove', e => { if (!_mouseDrag) return; tx = _mtx + (e.clientX - _msx); ty = _mty + (e.clientY - _msy); _applyTransform(); });
  viewport.addEventListener('mouseup',   () => { _mouseDrag = false; if (panMode) wrap.style.cursor = 'grab'; });
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    tx = mx - (mx - tx) * factor; ty = my - (my - ty) * factor;
    scale = Math.min(6, Math.max(0.2, scale * factor)); _applyTransform();
  }, { passive: false });

  ov.querySelector('#ann-fs-save').addEventListener('click', async () => {
    const saveBtn = ov.querySelector('#ann-fs-save');
    saveBtn.textContent = '⏳ সেভ হচ্ছে...'; saveBtn.disabled = true;
    const blob = await getAnnotatedBlob();
    ov.remove();
    if (blob) onSave(blob);
  });
  ov.querySelector('#ann-fs-cancel').addEventListener('click', () => ov.remove());
}

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _reactionConfig(r) {
  const map = {
    Excellent:        { emoji: '🌟', label: 'অসাধারণ!',          bg: '#fefce8', color: '#d97706', glow: '217,119,6'  },
    StarWork:         { emoji: '⭐', label: 'তারকা কাজ!',        bg: '#fef9c3', color: '#b45309', glow: '180,83,9'   },
    Good:             { emoji: '✅', label: 'ভালো হয়েছে',        bg: '#f0fdf4', color: '#16a34a', glow: '22,163,74'  },
    NeedsImprovement: { emoji: '📈', label: 'আরও উন্নতি দরকার', bg: '#fff7ed', color: '#ea580c', glow: '234,88,12'  },
    Incomplete:       { emoji: '❌', label: 'অসম্পূর্ণ',         bg: '#fef2f2', color: '#dc2626', glow: '220,38,38'  },
  };
  return map[r] || { emoji: '📝', label: r, bg: '#f8fafc', color: '#475569', glow: '71,85,105' };
}
