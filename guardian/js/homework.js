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
          <div class="hw-due"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>জমা: ${_fmt(h.submittedAt)}</div>
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
  let primaryPhotoFile = null;
  let annotatedBlob = null;
  let photoFiles = [];
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

        <!-- Photo -->
        <div class="hw-option-card" id="hw-opt-photo">
          <div class="hw-option-icon" style="background:#eff6ff;color:#2563eb;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">ছবি তুলুন / আপলোড</div>
            <div class="hw-option-sub">ক্যামেরা বা গ্যালারি থেকে</div>
          </div>
          <div class="hw-option-toggle" id="hw-photo-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-photo-wrap">
          <div class="hw-dropzone" id="hw-dropzone">
            <input type="file" id="hw-photo-input" accept="image/*" capture="environment" style="display:none;">
            <div class="hw-dropzone-icon">📷</div>
            <div class="hw-dropzone-text">ছবি বেছে নিন বা এখানে ফেলুন</div>
            <button class="hw-dropzone-btn" onclick="document.getElementById('hw-photo-input').click()">ছবি বেছে নিন</button>
          </div>
          <div id="hw-photo-preview" class="hw-photo-preview hidden"></div>
          <div id="annotation-area" class="hidden">
            <div class="hw-ann-toolbar" id="ann-toolbar-wrap"></div>
            <div class="hw-ann-canvas-wrap"><canvas id="hw-ann-canvas"></canvas></div>
            <button class="hw-ann-save-btn" id="save-annotation-btn">✓ আঁকা সংরক্ষণ করুন</button>
          </div>
        </div>

        <!-- Multi photo -->
        <div class="hw-option-card" id="hw-opt-multi">
          <div class="hw-option-icon" style="background:#fdf4ff;color:#9333ea;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="14" height="14" rx="2"/><path d="M22 10v10a2 2 0 0 1-2 2H10"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">একাধিক ছবি</div>
            <div class="hw-option-sub">সর্বোচ্চ ১০টি ছবি</div>
          </div>
          <div class="hw-option-toggle" id="hw-multi-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-multi-wrap">
          <input type="file" id="hw-multi-input" accept="image/*" multiple style="display:none;">
          <button class="hw-multi-pick-btn" onclick="document.getElementById('hw-multi-input').click()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ছবি যোগ করুন
          </button>
          <div class="hw-multi-grid" id="multi-preview"></div>
        </div>

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
  [['photo','photo-wrap'],['multi','multi-wrap'],['voice','voice-wrap'],['text','text-wrap']].forEach(([key, wrapId]) => {
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

  // Dropzone drag-and-drop
  const dropzone = sheetBody.querySelector('#hw-dropzone');
  dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('hw-dropzone--over'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('hw-dropzone--over'));
  dropzone?.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('hw-dropzone--over');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) _handlePrimaryPhoto(file, sheetBody);
  });

  // Photo input
  sheetBody.querySelector('#hw-photo-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) _handlePrimaryPhoto(file, sheetBody);
  });

  async function _handlePrimaryPhoto(file, sb) {
    primaryPhotoFile = file;
    const url = URL.createObjectURL(file);
    const preview = sb.querySelector('#hw-photo-preview');
    preview.innerHTML = `
      <div class="hw-photo-thumb">
        <img src="${url}" alt="">
        <button class="hw-photo-remove" id="hw-photo-remove">✕</button>
      </div>
      <button class="hw-annotate-btn" id="hw-annotate-btn">✏️ ছবিতে আঁকুন</button>`;
    preview.classList.remove('hidden');
    sb.querySelector('#hw-dropzone').classList.add('hidden');
    sb.querySelector('#hw-photo-remove')?.addEventListener('click', () => {
      primaryPhotoFile = null; annotatedBlob = null;
      preview.innerHTML = ''; preview.classList.add('hidden');
      sb.querySelector('#hw-dropzone').classList.remove('hidden');
      sb.querySelector('#annotation-area').classList.add('hidden');
    });
    sb.querySelector('#hw-annotate-btn')?.addEventListener('click', async () => {
      sb.querySelector('#annotation-area').classList.remove('hidden');
      await initAnnotation(sb.querySelector('#hw-ann-canvas'), url);
      buildToolbar('ann-toolbar-wrap');
    });
  }

  sheetBody.querySelector('#save-annotation-btn')?.addEventListener('click', async () => {
    const btn = sheetBody.querySelector('#save-annotation-btn');
    btn.disabled = true;
    btn.textContent = '⏳ সংরক্ষণ হচ্ছে...';
    annotatedBlob = await getAnnotatedBlob();
    btn.textContent = '✓ সংরক্ষিত হয়েছে!';
    btn.style.background = '#15803d';
    setTimeout(() => {
      btn.textContent = '✓ আঁকা সংরক্ষণ করুন';
      btn.style.background = '';
      btn.disabled = false;
    }, 2000);
  });

  // Multi images
  sheetBody.querySelector('#hw-multi-input')?.addEventListener('change', e => {
    const files = Array.from(e.target.files).slice(0, 10);
    photoFiles = files;
    const grid = sheetBody.querySelector('#multi-preview');
    grid.innerHTML = '';
    files.forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const div = document.createElement('div');
      div.className = 'hw-multi-thumb';
      div.innerHTML = `<img src="${url}" alt=""><button class="hw-multi-remove" data-idx="${i}">✕</button>`;
      div.querySelector('.hw-multi-remove').addEventListener('click', ev => {
        ev.stopPropagation(); photoFiles.splice(i, 1); div.remove();
      });
      grid.appendChild(div);
    });
  });

  // Submit
  sheetBody.querySelector('#final-submit-btn')?.addEventListener('click', async () => {
    const remarks = sheetBody.querySelector('#hw-remarks').value.trim();
    const vBlob = voiceRecorder?.getBlob() ?? null;
    if (!primaryPhotoFile && !annotatedBlob && !photoFiles.length && !vBlob && !remarks) {
      showToast('কমপক্ষে একটি তথ্য দিন', 'error'); return;
    }
    const btn = sheetBody.querySelector('#final-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> জমা হচ্ছে...`;
    const payload = { image: primaryPhotoFile, annotated: annotatedBlob, voice: vBlob, textRemarks: remarks || null };
    const resData = await submitHomework(hw.id, payload, photoFiles);
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
        <div class="hw-feedback-hero" style="background:${rc.bg};">
          <div class="hw-feedback-emoji">${rc.emoji}</div>
          <div class="hw-feedback-label" style="color:${rc.color};">${rc.label}</div>
          <div class="hw-feedback-hw">${hw.title}</div>
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

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _reactionConfig(r) {
  return {
    Excellent:          { emoji: '🌟', label: 'অসাধারণ!',           bg: '#fefce8', color: '#ca8a04' },
    StarWork:           { emoji: '⭐', label: 'তারকা কাজ!',         bg: '#fef9c3', color: '#a16207' },
    Good:               { emoji: '✅', label: 'ভালো হয়েছে',         bg: '#f0fdf4', color: '#16a34a' },
    NeedsImprovement:   { emoji: '📈', label: 'আরও উন্নতি দরকার',   bg: '#fff7ed', color: '#ea580c' },
    Incomplete:         { emoji: '❌', label: 'অসম্পূর্ণ',          bg: '#fef2f2', color: '#dc2626' },
  }[r] || { emoji: '📝', label: r, bg: '#f8fafc', color: '#475569' };
}
