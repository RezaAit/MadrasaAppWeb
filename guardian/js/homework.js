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
      else if (hw.status === 'Reviewed') showFeedbackDetail(hw);
      else if (hw.status === 'Submitted') showSubmittedView(container, hw, child, all);
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
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
              <div class="hw-due">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${_fmt(h.dueDate)}
              </div>
              ${h.dueTime ? `<div class="hw-due" style="color:#7c3aed;font-weight:600;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${_fmtTime(h.dueTime)}</div>` : ''}
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
  const isLocked = !!h.editLockedAt;
  const isSeen = !!h.seenAt;

  // Attachment count
  const sub = h.submission;
  const photoCount = (sub?.primaryImageUrl ? 1 : 0) + (sub?.annotatedPhotoUrl ? 1 : 0) + (sub?.images?.length || 0);
  const fileCount  = sub?.files?.length || 0;
  const videoCount = (sub?.videoNoteUrl ? 1 : 0) + (sub?.videos?.length || 0) + (sub?.youtubeUrls?.length || 0);
  const voiceCount = sub?.voiceNoteUrl ? 1 : 0;
  const attachParts = [];
  if (photoCount) attachParts.push(`📷 ${photoCount}`);
  if (fileCount)  attachParts.push(`📄 ${fileCount}`);
  if (videoCount) attachParts.push(`🎬 ${videoCount}`);
  if (voiceCount) attachParts.push(`🎤 ${voiceCount}`);
  const attachBadge = attachParts.length
    ? `<span style="font-size:.65rem;color:#475569;background:#f1f5f9;border-radius:6px;padding:2px 6px;">${attachParts.join(' · ')}</span>`
    : '';

  // Submitted time (date + time)
  const submittedTime = h.submittedAt
    ? new Date(h.submittedAt).toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';

  // Countdown timer (only if not locked and submitted)
  const countdownId = `hw-cd-${h.id}`;
  const countdownHtml = (!isLocked && !fb && h.submittedAt)
    ? `<span id="${countdownId}" style="font-size:.65rem;font-weight:700;color:#ea580c;"></span>`
    : '';

  const seenLabel = isSeen
    ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:.68rem;color:#2563eb;font-weight:600;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#2563eb" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        শিক্ষক দেখেছেন</span>`
    : `<span style="display:inline-flex;align-items:center;gap:3px;font-size:.68rem;color:#94a3b8;font-weight:600;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        অপেক্ষায়</span>`;

  // Start countdown ticker after render
  const editRowId = `hw-editrow-${h.id}`;
  if (!isLocked && !fb && h.submittedAt) {
    const lockAt = new Date(h.submittedAt).getTime() + 30 * 60 * 1000;
    requestAnimationFrame(function tick() {
      const el = document.getElementById(countdownId);
      if (!el) return;
      const left = lockAt - Date.now();
      if (left <= 0) {
        el.textContent = '⏰ সময় শেষ';
        // Lock the edit button in the bottom row
        const row = document.getElementById(editRowId);
        if (row) row.innerHTML = `
          ${seenLabel}
          <span style="font-size:.68rem;color:#94a3b8;">🔒 লক হয়েছে</span>`;
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent = `⏱ ${m}:${String(s).padStart(2,'0')} বাকি`;
      setTimeout(tick, 1000);
    });
  }

  if (fb) {
    // ── Reviewed card ──────────────────────────────────────────────
    return `
    <div class="hw-card hw-card--reviewed" data-hw-id="${h.id}" style="--hw-accent:${reactionConfig.color};--hw-bg:${reactionConfig.bg};margin-bottom:8px;">
      <div class="hw-card-stripe" style="background:${reactionConfig.color};"></div>
      <div class="hw-card-inner">
        <div class="hw-card-top">
          <div class="hw-subject-chip"><span class="hw-subject-icon">${style.icon}</span><span>${h.subject}</span></div>
          <div class="hw-reaction-badge" style="background:${reactionConfig.bg};color:${reactionConfig.color};border:1.5px solid ${reactionConfig.color}22;">
            ${reactionConfig.emoji} ${reactionConfig.label}
          </div>
        </div>
        <div class="hw-card-title">${h.title}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;">
          <div class="hw-teacher" style="font-size:.75rem;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${h.teacherName ?? '—'}
          </div>
          <div style="font-size:.72rem;color:#64748b;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${submittedTime}
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1.5px solid ${reactionConfig.color}22;margin-top:4px;">
          ${attachBadge || '<span></span>'}
          <span class="hw-card-cta hw-card-cta--review" style="color:${reactionConfig.color};">
            মতামত দেখুন
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </div>
      </div>
    </div>`;
  }

  // ── Submitted (pending review) card ────────────────────────────
  return `
    <div class="hw-card hw-card--submitted" data-hw-id="${h.id}" style="--hw-accent:${style.accent};--hw-bg:${style.bg};margin-bottom:8px;">
      <div class="hw-card-stripe"></div>
      <div class="hw-card-inner">
        <div class="hw-card-top">
          <div class="hw-subject-chip"><span class="hw-subject-icon">${style.icon}</span><span>${h.subject}</span></div>
          <div style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#16a34a;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;border:1.5px solid #bbf7d0;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            জমা
          </div>
        </div>
        <div class="hw-card-title">${h.title}</div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="hw-teacher">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${h.teacherName ?? '—'}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <div style="display:flex;align-items:center;gap:3px;font-size:.72rem;color:#475569;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              জমা: ${submittedTime}
            </div>
            ${h.dueDate ? `<div style="display:flex;align-items:center;gap:3px;font-size:.72rem;color:#dc2626;font-weight:600;">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#dc2626" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              সীমা: ${_fmtDeadline(h.dueDate, h.dueTime)}
            </div>` : ''}
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(0,0,0,.06);margin-top:2px;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${seenLabel}
            ${attachBadge}
          </div>
          ${countdownHtml}
        </div>

        <div id="${editRowId}" style="display:flex;align-items:center;justify-content:flex-end;">
          ${!isLocked
            ? `<span style="font-size:.75rem;color:#2563eb;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                সম্পাদনা করুন
              </span>`
            : `<span style="font-size:.72rem;color:#94a3b8;display:inline-flex;align-items:center;gap:3px;">🔒 লক হয়েছে</span>`
          }
        </div>
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
  const photoEntries = []; // [{ file, annotatedBlob, previewUrl, annotatedUrl }]
  const videoFiles   = []; // File[]
  const ytUrls       = []; // string[]
  const docFiles     = []; // { file, name }[]
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

        <!-- Video -->
        <div class="hw-option-card" id="hw-opt-video">
          <div class="hw-option-icon" style="background:#fdf4ff;color:#9333ea;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">ভিডিও যোগ করুন</div>
            <div class="hw-option-sub">গ্যালারি বা রেকর্ড (সর্বোচ্চ ৫০MB)</div>
          </div>
          <div class="hw-option-toggle" id="hw-video-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-video-wrap">
          <input type="file" id="hw-video-gallery-input" accept="video/*" multiple style="display:none;">
          <input type="file" id="hw-video-cam-input" accept="video/*" capture="environment" style="display:none;">
          <div class="hw-pick-row" style="margin-top:4px;">
            <button type="button" class="hw-pick-btn hw-pick-gallery" id="hw-video-gallery-btn">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>গ্যালারি</span>
            </button>
            <button type="button" class="hw-pick-btn hw-pick-camera" id="hw-video-cam-btn">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <span>রেকর্ড</span>
            </button>
          </div>
          <div id="hw-video-list" class="hw-submit-video-list"></div>
        </div>

        <!-- YouTube -->
        <div class="hw-option-card" id="hw-opt-yt">
          <div class="hw-option-icon" style="background:#fee2e2;color:#dc2626;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#dc2626"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zm-13.5 8.6V8.4l8.1 3.6-8.1 3.6z"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">YouTube লিংক</div>
            <div class="hw-option-sub">Watch বা Shorts লিংক দিন</div>
          </div>
          <div class="hw-option-toggle" id="hw-yt-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-yt-wrap">
          <div style="display:flex;gap:8px;padding:8px 0 4px;">
            <input type="text" id="hw-yt-input" class="hw-textarea" placeholder="https://youtube.com/..." style="flex:1;padding:10px 12px;font-size:.85rem;resize:none;height:auto;">
            <button type="button" id="hw-yt-add-btn" class="hw-pick-btn hw-pick-gallery" style="flex-shrink:0;padding:10px 14px;">+ যোগ</button>
          </div>
          <div id="hw-yt-list" class="hw-submit-yt-list"></div>
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

        <!-- File/Doc -->
        <div class="hw-option-card" id="hw-opt-file">
          <div class="hw-option-icon" style="background:#f0f9ff;color:#0284c7;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="hw-option-body">
            <div class="hw-option-title">ফাইল আপলোড</div>
            <div class="hw-option-sub">PDF, DOC, TXT (সর্বোচ্চ ১০MB)</div>
          </div>
          <div class="hw-option-toggle" id="hw-file-toggle">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="hw-option-body-wrap" id="hw-file-wrap">
          <input type="file" id="hw-doc-input" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple style="display:none;">
          <button type="button" class="hw-pick-btn hw-pick-gallery" id="hw-doc-btn" style="width:100%;margin-top:8px;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            ফাইল বেছে নিন
          </button>
          <div id="hw-doc-list" class="hw-submit-doc-list"></div>
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
  [['video','video-wrap'],['yt','yt-wrap'],['file','file-wrap'],['voice','voice-wrap'],['text','text-wrap']].forEach(([key, wrapId]) => {
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

  // Video listeners
  sheetBody.querySelector('#hw-video-gallery-btn')?.addEventListener('click', () => sheetBody.querySelector('#hw-video-gallery-input').click());
  sheetBody.querySelector('#hw-video-cam-btn')?.addEventListener('click', () => sheetBody.querySelector('#hw-video-cam-input').click());
  ['#hw-video-gallery-input','#hw-video-cam-input'].forEach(sel => {
    sheetBody.querySelector(sel)?.addEventListener('change', e => {
      Array.from(e.target.files).forEach(file => _addVideo(file));
      e.target.value = '';
    });
  });

  // Doc/File listeners
  sheetBody.querySelector('#hw-doc-btn')?.addEventListener('click', () => sheetBody.querySelector('#hw-doc-input').click());
  sheetBody.querySelector('#hw-doc-input')?.addEventListener('change', e => {
    Array.from(e.target.files).forEach(file => _addDoc(file));
    e.target.value = '';
  });

  // YouTube listener
  sheetBody.querySelector('#hw-yt-add-btn')?.addEventListener('click', () => {
    const input = sheetBody.querySelector('#hw-yt-input');
    const url = input.value.trim();
    if (!url) return;
    if (!_ytVideoId(url)) { showToast('সঠিক YouTube লিংক দিন', 'error'); return; }
    ytUrls.push(url);
    input.value = '';
    _renderYtList();
  });

  function _renderYtList() {
    const list = sheetBody.querySelector('#hw-yt-list');
    list.innerHTML = ytUrls.map((url, i) => {
      const vid = _ytVideoId(url);
      const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : '';
      return `<div class="hw-submit-yt-card" data-idx="${i}">
        ${thumb ? `<img src="${thumb}" class="hw-submit-yt-thumb" alt="">` : ''}
        <div class="hw-submit-yt-url">${url}</div>
        <button class="hw-submit-photo-remove hw-yt-remove" data-idx="${i}">✕</button>
      </div>`;
    }).join('');
    list.querySelectorAll('.hw-yt-remove').forEach(btn => {
      btn.addEventListener('click', () => { ytUrls.splice(+btn.dataset.idx, 1); _renderYtList(); });
    });
  }

  function _addVideo(file) {
    videoFiles.push(file);
    const idx = videoFiles.length - 1;
    const list = sheetBody.querySelector('#hw-submit-video-list') || sheetBody.querySelector('#hw-video-list');
    const url = URL.createObjectURL(file);
    const card = document.createElement('div');
    card.className = 'hw-submit-video-card';
    card.innerHTML = `
      <video src="${url}" class="hw-submit-video-preview" controls playsinline></video>
      <button class="hw-submit-photo-remove" data-idx="${idx}">✕</button>`;
    card.querySelector('.hw-submit-photo-remove').addEventListener('click', () => {
      videoFiles.splice(idx, 1);
      card.remove();
    });
    list.appendChild(card);
  }

  function _addDoc(file) {
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) { showToast('ফাইল সর্বোচ্চ ১০MB হতে পারবে', 'error'); return; }
    docFiles.push(file);
    const idx = docFiles.length - 1;
    const list = sheetBody.querySelector('#hw-doc-list');
    const ext = file.name.split('.').pop().toUpperCase();
    const card = document.createElement('div');
    card.className = 'hw-submit-doc-card';
    card.innerHTML = `
      <div class="hw-submit-doc-icon">${_docIcon(ext)}</div>
      <div class="hw-submit-doc-info">
        <div class="hw-submit-doc-name">${file.name}</div>
        <div class="hw-submit-doc-size">${_fmtSize(file.size)}</div>
      </div>
      <button class="hw-submit-photo-remove" data-idx="${idx}">✕</button>`;
    card.querySelector('.hw-submit-photo-remove').addEventListener('click', () => {
      docFiles.splice(idx, 1); card.remove();
    });
    list.appendChild(card);
  }

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
      card.querySelector('.hw-submit-photo-img').addEventListener('click', () => {
        _openImageZoom(entry.annotatedUrl || entry.previewUrl);
      });
      card.querySelector('.hw-submit-photo-remove').addEventListener('click', () => {
        photoEntries.splice(idx, 1);
        card.remove();
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
    if (!photoEntries.length && !vBlob && !remarks && !videoFiles.length && !ytUrls.length && !docFiles.length) {
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
    const resData = await submitHomework(hw.id, payload, extraImages, videoFiles, ytUrls, docFiles);
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
function showSubmittedView(mainContainer, hw, child, all) {
  const sub = hw.submission;
  const isSeen = !!hw.seenAt;

  // Determine lock state locally (frontend mirrors backend C→B→A chain)
  let isLocked = !!hw.editLockedAt;
  let lockMsg = hw.editLockReason === 'teacher_seen' ? 'শিক্ষক দেখে ফেলেছেন'
    : hw.editLockReason === 'due_time' ? 'সময়সীমা শেষ'
    : hw.editLockReason === 'timeout' ? '৩০ মিনিট পার হয়েছে'
    : null;

  // If backend hasn't locked yet, check locally
  if (!isLocked && hw.submittedAt) {
    const lockAt = new Date(hw.submittedAt).getTime() + 30 * 60 * 1000;
    if (Date.now() > lockAt) { isLocked = true; lockMsg = '৩০ মিনিট পার হয়েছে'; }
  }

  const allPhotos = [];
  if (sub?.primaryImageUrl) allPhotos.push(sub.primaryImageUrl);
  if (sub?.annotatedPhotoUrl) allPhotos.push(sub.annotatedPhotoUrl);
  (sub?.images || []).forEach(u => allPhotos.push(u));

  const { open, body: sheetBody, close } = createBottomSheet({
    id: 'hw-submitted-sheet',
    title: 'জমা দেওয়া হয়েছে',
    content: `
      <div class="hw-sheet-wrap">
        <div style="display:flex;align-items:center;gap:10px;background:#f0fdf4;border-radius:14px;padding:14px;margin-bottom:12px;">
          <div style="width:40px;height:40px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;color:#15803d;font-size:.95rem;">জমা হয়েছে</div>
            <div style="font-size:.78rem;color:#166534;">${hw.submittedAt ? new Date(hw.submittedAt).toLocaleString('bn-BD', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit', hour12:true }) : ''}</div>
            <div style="font-size:.75rem;color:#4ade80;margin-top:2px;">${isSeen ? '👁 শিক্ষক দেখেছেন' : 'শিক্ষক শীঘ্রই রিভিউ করবেন'}</div>
            ${!isLocked && hw.submittedAt ? `<div id="hw-sheet-cd" style="font-size:.72rem;font-weight:700;color:#ea580c;margin-top:2px;"></div>` : ''}
          </div>
          <div id="hw-sheet-edit-wrap">
          ${!isLocked
            ? `<button id="hw-edit-submit-btn" style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                সম্পাদনা
              </button>`
            : `<div style="text-align:center;font-size:.7rem;color:#94a3b8;background:#f1f5f9;padding:6px 10px;border-radius:8px;">🔒 ${lockMsg || 'লক'}</div>`
          }
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

        ${(sub?.videos?.length || sub?.videoNoteUrl) ? `
          <div class="hw-feedback-section" style="margin-top:14px;">
            <div class="hw-feedback-section-title">তোমার ভিডিও</div>
            ${sub?.videoNoteUrl ? `<video controls style="width:100%;border-radius:10px;margin-bottom:8px;" src="${_full(sub.videoNoteUrl)}"></video>` : ''}
            ${(sub?.videos || []).map(v => `<video controls style="width:100%;border-radius:10px;margin-bottom:8px;" src="${_full(v)}"></video>`).join('')}
          </div>` : ''}

        ${sub?.youtubeUrls?.length ? `
          <div class="hw-feedback-section" style="margin-top:14px;">
            <div class="hw-feedback-section-title">YouTube ভিডিও</div>
            ${sub.youtubeUrls.map(u => {
              const vid = _ytVideoId(u);
              return vid ? `<div class="hw-instr-yt-wrap"><iframe class="hw-instr-yt" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>` : '';
            }).join('')}
          </div>` : ''}

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

        ${sub?.files?.length ? `
          <div class="hw-feedback-section" style="margin-top:14px;">
            <div class="hw-feedback-section-title">জমা দেওয়া ফাইল</div>
            ${sub.files.map(f => {
              const name = f.split('/').pop();
              const ext = name.split('.').pop().toUpperCase();
              return `<a href="${_full(f)}" target="_blank" rel="noopener" class="hw-submit-doc-card hw-submit-doc-card--link">
                <div class="hw-submit-doc-icon">${_docIcon(ext)}</div>
                <div class="hw-submit-doc-info">
                  <div class="hw-submit-doc-name">${name}</div>
                  <div class="hw-submit-doc-size">${ext} ফাইল</div>
                </div>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>`;
            }).join('')}
          </div>` : ''}
      </div>`,
    fullHeight: true,
  });
  open();

  // Countdown in sheet
  if (!isLocked && hw.submittedAt) {
    const cdEl = sheetBody.querySelector('#hw-sheet-cd');
    const editWrap = sheetBody.querySelector('#hw-sheet-edit-wrap');
    if (cdEl) {
      const lockAt = new Date(hw.submittedAt).getTime() + 30 * 60 * 1000;
      (function tick() {
        const left = lockAt - Date.now();
        if (left <= 0) {
          cdEl.textContent = '⏰ সম্পাদনার সময় শেষ';
          if (editWrap) editWrap.innerHTML = `<div style="text-align:center;font-size:.7rem;color:#94a3b8;background:#f1f5f9;padding:6px 10px;border-radius:8px;">🔒 ৩০ মিনিট পার হয়েছে</div>`;
          return;
        }
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        cdEl.textContent = `⏱ সম্পাদনার সুযোগ: ${m}:${String(s).padStart(2,'0')} বাকি`;
        setTimeout(tick, 1000);
      })();
    }
  }

  sheetBody.querySelectorAll('.hw-zoomable').forEach(img => {
    img.addEventListener('click', () => _openImageZoom(img.dataset.full));
  });
  sheetBody.querySelector('#hw-edit-submit-btn')?.addEventListener('click', () => {
    close();
    // reopen as Pending so user can re-submit
    openSubmitScreen(mainContainer, { ...hw, status: 'Pending' }, child, all);
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
      ${pdfs.length ? pdfs.map(p => _instrFileCard(_full(p.pdfUrl || p.PdfUrl), p.fileSize || p.FileSize || null)).join('') : ''}
      ${hasLegacyPdf ? _instrFileCard(_full(hw.pdfAttachmentUrl)) : ''}
    </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _instrFileCard(url, fileSize) {
  const fname = url.split('/').pop() || 'ফাইল';
  const ext = (fname.split('.').pop() || 'pdf').toLowerCase();
  const extUp = ext.toUpperCase();
  const cfg = ext === 'pdf' ? { bg:'#fff0f0', border:'#fca5a5', tc:'#dc2626', ic:'#dc2626' }
    : (ext === 'doc' || ext === 'docx') ? { bg:'#eff6ff', border:'#93c5fd', tc:'#2563eb', ic:'#2563eb' }
    : (ext === 'xls' || ext === 'xlsx') ? { bg:'#f0fdf4', border:'#86efac', tc:'#16a34a', ic:'#16a34a' }
    : (ext === 'ppt' || ext === 'pptx') ? { bg:'#fff7ed', border:'#fdba74', tc:'#ea580c', ic:'#ea580c' }
    : { bg:'#f8fafc', border:'#cbd5e1', tc:'#475569', ic:'#475569' };
  const sizeStr = fileSize ? _fmtSize(fileSize) : '';
  return `<a href="${url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:${cfg.bg};border:1.5px solid ${cfg.border};border-radius:9px;margin-bottom:6px;text-decoration:none;">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${cfg.ic}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    <div style="flex:1;min-width:0;">
      <div style="font-size:.8rem;color:#1e293b;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${fname.length > 32 ? fname.slice(0,29)+'…' : fname}</div>
      ${sizeStr ? `<div style="font-size:.68rem;color:#64748b;margin-top:1px;">${sizeStr}</div>` : ''}
    </div>
    <span style="font-size:.7rem;font-weight:700;color:${cfg.tc};background:${cfg.border};padding:2px 6px;border-radius:4px;flex-shrink:0;">${extUp}</span>
  </a>`;
}

function _docIcon(ext) {
  if (ext === 'PDF') return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  if (['DOC','DOCX'].includes(ext)) return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  if (['XLS','XLSX'].includes(ext)) return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16a34a" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#475569" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function _fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _ytVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1].split('?')[0];
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

function _fmtTime(t) {
  if (!t) return '';
  // t is "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function _fmtDeadline(dueDate, dueTime) {
  if (!dueDate) return '—';
  const dateStr = new Date(dueDate).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = dueTime ? _fmtTime(dueTime) : '১২:০০ AM';
  return `${dateStr}, ${timeStr}`;
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
