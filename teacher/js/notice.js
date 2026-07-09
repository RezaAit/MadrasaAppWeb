import { getTeacherNotices, createNotice, updateNotice, deleteNotice, getMySections } from './api.js';
import { createFileUpload, openLightbox } from './file-upload.js';
import { showToast } from './dashboard.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';
import { BASE_URL } from '../../shared/js/api-config.js';

const CATEGORY_LABEL = { Notice: 'নোটিশ', Circular: 'সার্কুলার', Event: 'ইভেন্ট' };

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

export async function loadNoticeModule(container, teacher) {
  container.innerHTML = `
    <style>
      /* ── History grouped list ── */
      .nh-year-block { margin-bottom: 4px; }
      .nh-year-header {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 16px 6px;
        cursor: pointer; user-select: none;
      }
      .nh-year-badge {
        font-size: .8rem; font-weight: 800; color: #1e40af;
        background: #dbeafe; border-radius: 8px; padding: 3px 10px;
      }
      .nh-year-line { flex: 1; height: 1px; background: #e2e8f0; }
      .nh-chevron { color: #94a3b8; transition: transform .2s; flex-shrink: 0; }
      .nh-year-block.open .nh-chevron { transform: rotate(180deg); }
      .nh-year-body { display: none; }
      .nh-year-block.open .nh-year-body { display: block; }

      .nh-month-block { margin-bottom: 2px; }
      .nh-month-header {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 16px 5px 24px;
        cursor: pointer; user-select: none;
      }
      .nh-month-dot { width: 7px; height: 7px; border-radius: 50%; background: #93c5fd; flex-shrink: 0; }
      .nh-month-name { font-size: .78rem; font-weight: 700; color: #3b82f6; flex: 1; }
      .nh-month-count { font-size: .7rem; color: #94a3b8; font-weight: 600; }
      .nh-month-body { display: none; padding: 0 0 4px; }
      .nh-month-block.open .nh-month-body { display: block; }

      .nh-week-label {
        font-size: .68rem; font-weight: 700; color: #cbd5e1;
        text-transform: uppercase; letter-spacing: .07em;
        padding: 6px 16px 2px 36px;
      }
      /* RTE formatted content in card */
      .notice-card-content.rte-content { line-height: 1.6; }
      .notice-card-content.rte-content b, .notice-card-content.rte-content strong { font-weight: 700; }
      .notice-card-content.rte-content i, .notice-card-content.rte-content em { font-style: italic; }
      .notice-card-content.rte-content u { text-decoration: underline; }
      .notice-card-content.rte-content s { text-decoration: line-through; }
      .notice-card-content.rte-content ul, .notice-card-content.rte-content ol { padding-left: 1.4em; margin: 2px 0; }
      .notice-card-content.rte-content h1, .notice-card-content.rte-content h2, .notice-card-content.rte-content h3 { font-weight: 700; margin: 2px 0; }
    </style>
    <div class="p-16">
      <button class="notice-create-fab" id="create-notice-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        নতুন নোটিশ তৈরি করুন
      </button>
      <div class="section-header mt-16"><span class="section-title">নোটিশ ইতিহাস</span></div>
      <div id="notice-list" class="stagger-in"></div>
    </div>
  `;

  attachRipple(document.getElementById('create-notice-btn'));
  document.getElementById('create-notice-btn').addEventListener('click', () => _openCreateForm(container, teacher));

  await _renderNoticeList(container);
}

async function _renderNoticeList(container) {
  const list = document.getElementById('notice-list');
  list.innerHTML = `<div class="skeleton skeleton-card mb-12"></div><div class="skeleton skeleton-card mb-12"></div>`;

  const res = await getTeacherNotices();
  const notices = res.results || [];

  if (!notices.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-title">কোনো নোটিশ নেই</div></div>`;
    return;
  }

  const catColor = { Notice: '#2563eb', Circular: '#7c3aed', Event: '#d97706' };
  const catBg    = { Notice: '#eff6ff', Circular: '#ede9fe', Event: '#fffbeb' };

  function _noticeCardHtml(n) {
    const cat = n.Category ?? n.category ?? 'Notice';
    const id  = n.Id ?? n.id;
    return `
    <div class="notice-card fade-in" data-notice-id="${id}" style="margin-left:36px;margin-right:12px;">
      <div class="notice-card-left" style="background:${catColor[cat]||'#2563eb'};"></div>
      <div class="notice-card-body">
        <div class="notice-card-top">
          <span class="notice-cat-badge" style="background:${catBg[cat]||'#eff6ff'};color:${catColor[cat]||'#2563eb'};">
            ${CATEGORY_LABEL[cat] || cat}
          </span>
          <div style="display:flex;gap:6px;">
            <button class="notice-edit-btn" data-id="${id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="notice-delete-btn" data-id="${id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="notice-card-title">${n.Title ?? n.title ?? ''}</div>
        <div class="notice-card-content rte-content">${_truncateHtmlSafe(n.Content ?? n.content, 160)}</div>
        ${_attachmentPreview(n.AttachmentUrl ?? n.attachmentUrl)}
        <div class="notice-card-meta">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${_fmt(n.PublishDate ?? n.publishDate)}
          <span class="notice-meta-dot">·</span>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ${_targetLabel(n)}
        </div>
      </div>
    </div>`;
  }

  // Group: year → month → week
  const chevronSvg = `<svg class="nh-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

  const byYear = new Map();
  for (const n of notices) {
    const d = new Date(n.PublishDate ?? n.publishDate ?? Date.now());
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const week = Math.ceil(d.getDate() / 7);
    if (!byYear.has(yr)) byYear.set(yr, new Map());
    const byMonth = byYear.get(yr);
    if (!byMonth.has(mo)) byMonth.set(mo, new Map());
    const byWeek = byMonth.get(mo);
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week).push(n);
  }

  const now = new Date();
  let html = '';
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);
  for (const yr of sortedYears) {
    const isCurrentYear = yr === now.getFullYear();
    const byMonth = byYear.get(yr);
    const totalYear = [...byMonth.values()].reduce((s, wm) => s + [...wm.values()].reduce((a, arr) => a + arr.length, 0), 0);
    let monthsHtml = '';
    const sortedMonths = [...byMonth.keys()].sort((a, b) => b - a);
    for (const mo of sortedMonths) {
      const isCurrentMonth = isCurrentYear && mo === now.getMonth();
      const byWeek = byMonth.get(mo);
      const totalMonth = [...byWeek.values()].reduce((s, arr) => s + arr.length, 0);
      let weeksHtml = '';
      const sortedWeeks = [...byWeek.keys()].sort((a, b) => b - a);
      for (const wk of sortedWeeks) {
        const items = byWeek.get(wk);
        weeksHtml += `<div class="nh-week-label">${wk} সপ্তাহ</div>` + items.map(_noticeCardHtml).join('');
      }
      monthsHtml += `
        <div class="nh-month-block${isCurrentMonth ? ' open' : ''}">
          <div class="nh-month-header">
            <div class="nh-month-dot"></div>
            <span class="nh-month-name">${MONTHS_BN[mo]}</span>
            <span class="nh-month-count">${totalMonth}টি</span>
          </div>
          <div class="nh-month-body">${weeksHtml}</div>
        </div>`;
    }
    html += `
      <div class="nh-year-block${isCurrentYear ? ' open' : ''}">
        <div class="nh-year-header">
          <span class="nh-year-badge">${yr}</span>
          <div class="nh-year-line"></div>
          <span style="font-size:.7rem;color:#94a3b8;font-weight:600;">${totalYear}টি</span>
          ${chevronSvg}
        </div>
        <div class="nh-year-body">${monthsHtml}</div>
      </div>`;
  }

  list.innerHTML = html;

  // Toggle accordion
  list.querySelectorAll('.nh-year-header').forEach(hdr => {
    hdr.addEventListener('click', () => hdr.closest('.nh-year-block').classList.toggle('open'));
  });
  list.querySelectorAll('.nh-month-header').forEach(hdr => {
    hdr.addEventListener('click', () => hdr.closest('.nh-month-block').classList.toggle('open'));
  });

  list.querySelectorAll('[data-lightbox]').forEach(el => {
    el.addEventListener('click', () => openLightbox(el.dataset.lightbox));
  });

  list.querySelectorAll('.notice-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const n = notices.find(x => String(x.Id ?? x.id) === String(id));
      if (n) _openEditForm(container, n);
    });
  });

  list.querySelectorAll('.notice-delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('এই নোটিশটি মুছে ফেলতে চান?')) return;
      const res = await deleteNotice(btn.dataset.id);
      if (!res.HasError) {
        showToast('নোটিশ মুছে ফেলা হয়েছে', 'success');
        _renderNoticeList(container);
      } else {
        showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      }
    });
  });
}

function _targetLabel(n) {
  const t = n.TargetType ?? n.targetType;
  if (t === 'All') return 'সবার জন্য';
  if (t === 'ClassWise') {
    const cls = n.TargetClassName ?? n.targetClassName;
    return cls ? `ক্লাস: ${cls}` : 'নির্দিষ্ট ক্লাস';
  }
  if (t === 'SectionWise') {
    const cls = n.TargetClassName ?? n.targetClassName;
    const sec = n.TargetSectionName ?? n.targetSectionName;
    if (cls && sec) return `${cls} - ${sec}`;
    if (sec) return `সেকশন: ${sec}`;
    return 'নির্দিষ্ট সেকশন';
  }
  return t || '—';
}

function _openCreateForm(container, teacher) {
  const formHtml = `
    <div style="padding:16px 16px 32px;">
      <div class="form-group mb-12">
        <label class="form-label">শিরোনাম *</label>
        <input type="text" class="form-input" id="notice-title" placeholder="নোটিশের শিরোনাম">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">বিস্তারিত *</label>
        ${_richEditorHtml('notice-content')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="mb-12">
        <div class="form-group">
          <label class="form-label">ধরন</label>
          <select class="form-select" id="notice-category">
            <option value="Notice">নোটিশ</option>
            <option value="Circular">সার্কুলার</option>
            <option value="Event">ইভেন্ট</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">প্রকাশের তারিখ</label>
          <input type="date" class="form-input" id="notice-publish-date" value="${new Date().toISOString().slice(0, 10)}">
        </div>
      </div>
      <div class="form-group mb-12">
        <label class="form-label">কাদের জন্য</label>
        <select class="form-select" id="notice-target-type">
          <option value="All">সবার জন্য</option>
          <option value="SectionWise">নির্দিষ্ট সেকশন (আমার)</option>
        </select>
      </div>
      <div class="form-group mb-12 hidden" id="notice-section-wrap">
        <label class="form-label">সেকশন</label>
        <select class="form-select" id="notice-section">
          <option value="">লোড হচ্ছে...</option>
        </select>
      </div>
      <div id="notice-fu-wrap" class="mb-20"></div>
      <button class="btn btn-primary btn-full" id="notice-submit-btn">নোটিশ প্রকাশ করুন</button>
    </div>
  `;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'notice-create-sheet',
    title: 'নতুন নোটিশ',
    content: formHtml,
    fullHeight: true,
  });
  open();
  _initRichEditor(sheetBody.querySelector('#notice-content-wrap'));
  const fuWrap = sheetBody.querySelector('#notice-fu-wrap');
  const fu = createFileUpload(fuWrap, { label: 'সংযুক্তি (ঐচ্ছিক)', multiple: true });

  const targetTypeSelect = sheetBody.querySelector('#notice-target-type');
  const sectionWrap = sheetBody.querySelector('#notice-section-wrap');
  const sectionSelect = sheetBody.querySelector('#notice-section');

  targetTypeSelect.addEventListener('change', () => {
    sectionWrap.classList.toggle('hidden', targetTypeSelect.value !== 'SectionWise');
  });

  getMySections().then(res => {
    const subjectSections = res.results?.subjectSections || [];
    const classTeacherSections = res.results?.classTeacherSections || [];
    const seen = new Map();
    [...classTeacherSections, ...subjectSections].forEach(s => { if (!seen.has(s.sectionId)) seen.set(s.sectionId, s); });
    const sections = [...seen.values()];
    sectionSelect.innerHTML = sections.length
      ? sections.map(s => `<option value="${s.sectionId}" data-class-id="${s.classId}">${s.className} - ${s.sectionName}</option>`).join('')
      : `<option value="">কোনো সেকশন নেই</option>`;
  });

  sheetBody.querySelector('#notice-submit-btn').addEventListener('click', async () => {
    const title = sheetBody.querySelector('#notice-title').value.trim();
    const content = _getRichContent(sheetBody, 'notice-content');
    const category = sheetBody.querySelector('#notice-category').value;
    const targetType = targetTypeSelect.value;
    const publishDate = sheetBody.querySelector('#notice-publish-date').value;
    const attachmentFiles = fu.getFiles();

    if (!title || !content) { showToast('শিরোনাম ও বিস্তারিত দিন', 'error'); return; }

    let targetSectionId = null;
    if (targetType === 'SectionWise') {
      targetSectionId = sectionSelect.value;
      if (!targetSectionId) { showToast('সেকশন বেছে নিন', 'error'); return; }
    }

    const btn = sheetBody.querySelector('#notice-submit-btn');
    btn.disabled = true;
    btn.textContent = 'প্রকাশ হচ্ছে...';

    const payload = {
      Title: title,
      Content: content,
      Category: category,
      TargetType: targetType,
      TargetSectionId: targetSectionId,
      PublishDate: publishDate,
    };

    const res = await createNotice(payload, attachmentFiles);
    if (!res.HasError) {
      showToast('নোটিশ প্রকাশিত হয়েছে ✓', 'success');
      close();
      _renderNoticeList(container);
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      btn.disabled = false;
      btn.textContent = 'নোটিশ প্রকাশ করুন';
    }
  });
}

function _openEditForm(container, n) {
  const id = n.Id ?? n.id;
  const cat = n.Category ?? n.category ?? 'Notice';
  const target = n.TargetType ?? n.targetType ?? 'All';
  const pubDate = n.PublishDate ?? n.publishDate;
  const dateVal = pubDate ? new Date(pubDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

  const formHtml = `
    <div style="padding:16px 16px 32px;">
      <div class="form-group mb-12">
        <label class="form-label">শিরোনাম *</label>
        <input type="text" class="form-input" id="edit-notice-title" value="${_esc(n.Title ?? n.title ?? '')}">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">বিস্তারিত *</label>
        ${_richEditorHtml('edit-notice-content')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="mb-12">
        <div class="form-group">
          <label class="form-label">ধরন</label>
          <select class="form-select" id="edit-notice-category">
            <option value="Notice" ${cat==='Notice'?'selected':''}>নোটিশ</option>
            <option value="Circular" ${cat==='Circular'?'selected':''}>সার্কুলার</option>
            <option value="Event" ${cat==='Event'?'selected':''}>ইভেন্ট</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">প্রকাশের তারিখ</label>
          <input type="date" class="form-input" id="edit-notice-date" value="${dateVal}">
        </div>
      </div>
      <div class="form-group mb-12">
        <label class="form-label">কাদের জন্য</label>
        <select class="form-select" id="edit-notice-target">
          <option value="All" ${target==='All'?'selected':''}>সবার জন্য</option>
          <option value="SectionWise" ${target==='SectionWise'?'selected':''}>নির্দিষ্ট সেকশন</option>
        </select>
      </div>
      <div class="form-group mb-12 ${target!=='SectionWise'?'hidden':''}" id="edit-section-wrap">
        <label class="form-label">সেকশন</label>
        <select class="form-select" id="edit-notice-section"><option value="">লোড হচ্ছে...</option></select>
      </div>
      <div id="edit-fu-wrap" class="mb-20"></div>
      <button class="btn btn-primary btn-full" id="edit-notice-submit">আপডেট করুন</button>
    </div>`;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'notice-edit-sheet', title: 'নোটিশ সম্পাদনা', content: formHtml, fullHeight: true,
  });
  open();
  _initRichEditor(sheetBody.querySelector('#edit-notice-content-wrap'));
  _setRichContent(sheetBody, 'edit-notice-content', n.Content ?? n.content ?? '');

  const targetSel = sheetBody.querySelector('#edit-notice-target');
  const secWrap   = sheetBody.querySelector('#edit-section-wrap');
  const secSel    = sheetBody.querySelector('#edit-notice-section');
  targetSel.addEventListener('change', () => secWrap.classList.toggle('hidden', targetSel.value !== 'SectionWise'));

  // File upload component
  const editFuWrap = sheetBody.querySelector('#edit-fu-wrap');
  const existingRaw = n.AttachmentUrl ?? n.attachmentUrl ?? null;
  const editFu = createFileUpload(editFuWrap, {
    existingUrls: existingRaw,
    label: 'সংযুক্তি',
    multiple: true,
  });

  getMySections().then(res => {
    const all = [...(res.results?.classTeacherSections||[]), ...(res.results?.subjectSections||[])];
    const seen = new Map(); all.forEach(s => { if (!seen.has(s.sectionId)) seen.set(s.sectionId, s); });
    secSel.innerHTML = [...seen.values()].map(s =>
      `<option value="${s.sectionId}" ${String(s.sectionId)===String(n.TargetSectionId??n.targetSectionId)?'selected':''}>${s.className} - ${s.sectionName}</option>`
    ).join('') || `<option value="">কোনো সেকশন নেই</option>`;
  });

  sheetBody.querySelector('#edit-notice-submit').addEventListener('click', async () => {
    const title   = sheetBody.querySelector('#edit-notice-title').value.trim();
    const content = _getRichContent(sheetBody, 'edit-notice-content');
    if (!title || !content) { showToast('শিরোনাম ও বিস্তারিত দিন', 'error'); return; }

    const fd = new FormData();
    fd.append('Title',       title);
    fd.append('Content',     content);
    fd.append('Category',    sheetBody.querySelector('#edit-notice-category').value);
    fd.append('TargetType',  targetSel.value);
    fd.append('PublishDate', sheetBody.querySelector('#edit-notice-date').value);
    if (targetSel.value === 'SectionWise') fd.append('TargetSectionId', secSel.value);
    const newFiles = editFu.getFiles();
    newFiles.forEach(f => fd.append('attachments', f));
    const removedUrls = editFu.getRemovedUrls();
    if (removedUrls.length) fd.append('RemoveUrls', JSON.stringify(removedUrls));
    if (editFu.isRemoved()) fd.append('RemoveAttachment', 'true');

    const btn = sheetBody.querySelector('#edit-notice-submit');
    btn.disabled = true; btn.textContent = 'আপডেট হচ্ছে...';
    const res = await updateNotice(id, fd);
    if (!res.HasError) {
      showToast('নোটিশ আপডেট হয়েছে ✓', 'success');
      close();
      _renderNoticeList(container);
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      btn.disabled = false; btn.textContent = 'আপডেট করুন';
    }
  });
}

function _esc(v) { return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function _richEditorHtml(id) {
  return `
    <div class="rte-wrap" id="${id}-wrap">
      <div class="rte-toolbar">
        <select class="rte-select rte-select-font" data-action="fontName" title="ফন্ট">
          <option value="inherit">ফন্ট</option>
          <option value="'SolaimanLipi', serif">SolaimanLipi</option>
          <option value="'Kalpurush', sans-serif">Kalpurush</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <select class="rte-select rte-select-size" data-action="fontSize" title="আকার">
          <option value="">Size</option>
          <option value="1">10</option>
          <option value="2">12</option>
          <option value="3" selected>14</option>
          <option value="4">16</option>
          <option value="5">18</option>
          <option value="6">22</option>
          <option value="7">36</option>
        </select>
        <select class="rte-select rte-select-block" data-action="formatBlock" title="স্টাইল">
          <option value="p">¶ সাধারণ</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="blockquote">❝</option>
        </select>
        <div class="rte-sep"></div>
        <button type="button" class="rte-btn" data-cmd="bold" title="Bold"><b>B</b></button>
        <button type="button" class="rte-btn" data-cmd="italic" title="Italic"><i>I</i></button>
        <button type="button" class="rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>
        <button type="button" class="rte-btn" data-cmd="strikeThrough" title="Strike"><s>S</s></button>
        <div class="rte-sep"></div>
        <label class="rte-color-btn" title="লেখার রং">
          <span class="rte-color-icon">A</span>
          <input type="color" class="rte-color-input" data-action="foreColor" value="#000000">
          <span class="rte-color-bar" id="${id}-fg-bar" style="background:#000000"></span>
        </label>
        <label class="rte-color-btn" title="পটভূমির রং">
          <span class="rte-color-icon" style="font-size:.7rem;">bg</span>
          <input type="color" class="rte-color-input" data-action="hiliteColor" value="#ffff00">
          <span class="rte-color-bar" id="${id}-bg-bar" style="background:#ffff00"></span>
        </label>
        <div class="rte-sep"></div>
        <button type="button" class="rte-btn" data-cmd="justifyLeft" title="বাম">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx=".7"/><rect x="1" y="5.5" width="9" height="1.5" rx=".7"/><rect x="1" y="9" width="14" height="1.5" rx=".7"/><rect x="1" y="12.5" width="9" height="1.5" rx=".7"/></svg>
        </button>
        <button type="button" class="rte-btn" data-cmd="justifyCenter" title="মাঝ">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx=".7"/><rect x="3.5" y="5.5" width="9" height="1.5" rx=".7"/><rect x="1" y="9" width="14" height="1.5" rx=".7"/><rect x="3.5" y="12.5" width="9" height="1.5" rx=".7"/></svg>
        </button>
        <button type="button" class="rte-btn" data-cmd="justifyRight" title="ডান">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="1" y="2" width="14" height="1.5" rx=".7"/><rect x="6" y="5.5" width="9" height="1.5" rx=".7"/><rect x="1" y="9" width="14" height="1.5" rx=".7"/><rect x="6" y="12.5" width="9" height="1.5" rx=".7"/></svg>
        </button>
        <div class="rte-sep"></div>
        <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="বুলেট">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><circle cx="3" cy="5" r="1.5"/><rect x="6" y="4" width="12" height="2" rx="1"/><circle cx="3" cy="10" r="1.5"/><rect x="6" y="9" width="12" height="2" rx="1"/><circle cx="3" cy="15" r="1.5"/><rect x="6" y="14" width="12" height="2" rx="1"/></svg>
        </button>
        <button type="button" class="rte-btn" data-cmd="insertOrderedList" title="নম্বর তালিকা">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><text x="1" y="7" font-size="7" font-weight="bold">1.</text><rect x="7" y="4" width="11" height="2" rx="1"/><text x="1" y="12" font-size="7" font-weight="bold">2.</text><rect x="7" y="9" width="11" height="2" rx="1"/><text x="1" y="17" font-size="7" font-weight="bold">3.</text><rect x="7" y="14" width="11" height="2" rx="1"/></svg>
        </button>
        <div class="rte-sep"></div>
        <button type="button" class="rte-btn" data-cmd="removeFormat" title="ফরম্যাট মুছুন">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></svg>
        </button>
      </div>
      <div class="rte-editor" id="${id}" contenteditable="true" data-placeholder="নোটিশের বিস্তারিত লিখুন..."></div>
    </div>
    <style>
      .rte-wrap { border: 1.5px solid #d1d5db; border-radius: 10px; overflow: hidden; background: #fff; }
      .rte-wrap:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
      .rte-toolbar {
        display: flex; align-items: center; gap: 2px;
        padding: 5px 6px; background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        flex-wrap: wrap; overflow-x: auto;
      }
      .rte-select {
        height: 26px; padding: 0 3px;
        border: 1px solid #e2e8f0; border-radius: 6px;
        background: #fff; color: #374151;
        font-size: .73rem; outline: none; cursor: pointer;
        transition: border-color .1s; flex-shrink: 0;
      }
      .rte-select-font { max-width: 80px; }
      .rte-select-size { max-width: 46px; }
      .rte-select-block { max-width: 72px; }
      .rte-select:focus { border-color: #6366f1; }
      .rte-btn {
        min-width: 26px; height: 26px; padding: 0 4px;
        border: none; border-radius: 6px; background: transparent;
        cursor: pointer; color: #374151; font-size: .82rem;
        display: inline-flex; align-items: center; justify-content: center;
        transition: background .1s; flex-shrink: 0;
      }
      .rte-btn:hover, .rte-btn.active { background: #e0e7ff; color: #4338ca; }
      .rte-sep { width: 1px; height: 16px; background: #e2e8f0; margin: 0 1px; flex-shrink: 0; }
      /* Color pickers */
      .rte-color-btn {
        display: inline-flex; flex-direction: column; align-items: center;
        width: 26px; height: 26px; border-radius: 6px;
        cursor: pointer; position: relative; flex-shrink: 0;
        justify-content: center; gap: 1px;
        transition: background .1s;
      }
      .rte-color-btn:hover { background: #e0e7ff; }
      .rte-color-icon {
        font-size: .8rem; font-weight: 800; color: #374151;
        line-height: 1; pointer-events: none;
      }
      .rte-color-input {
        position: absolute; opacity: 0; width: 100%; height: 100%;
        top: 0; left: 0; cursor: pointer; padding: 0; border: none;
      }
      .rte-color-bar {
        display: block; width: 16px; height: 3px; border-radius: 2px;
        pointer-events: none;
      }
      .rte-editor {
        min-height: 130px; max-height: 260px; overflow-y: auto;
        padding: 10px 12px; font-size: .9rem; line-height: 1.7;
        color: #1f2937; outline: none;
      }
      .rte-editor:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
      .rte-editor ul, .rte-editor ol { padding-left: 1.5em; margin: 4px 0; }
      .rte-editor li { margin: 2px 0; }
      .rte-editor h1 { font-size: 1.5em; font-weight: 700; margin: 6px 0 4px; }
      .rte-editor h2 { font-size: 1.25em; font-weight: 700; margin: 6px 0 4px; }
      .rte-editor h3 { font-size: 1.1em; font-weight: 700; margin: 4px 0 2px; }
      .rte-editor blockquote { border-left: 3px solid #6366f1; margin: 4px 0; padding: 4px 10px; color: #6b7280; font-style: italic; background: #f5f3ff; border-radius: 0 6px 6px 0; }
    </style>`;
}

function _initRichEditor(wrap) {
  const editor = wrap.querySelector('.rte-editor');

  wrap.querySelectorAll('.rte-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
      _updateRteState(wrap);
    });
  });

  wrap.querySelectorAll('.rte-select').forEach(sel => {
    sel.addEventListener('mousedown', e => e.stopPropagation());
    sel.addEventListener('change', () => {
      const action = sel.dataset.action;
      const val = sel.value;
      if (!val) return;
      editor.focus();
      if (action === 'fontName') {
        document.execCommand('fontName', false, val === 'inherit' ? 'Arial' : val);
        if (val === 'inherit') {
          const spans = editor.querySelectorAll('font[face]');
          spans.forEach(s => s.removeAttribute('face'));
        }
      } else if (action === 'fontSize') {
        document.execCommand('fontSize', false, val);
      } else if (action === 'formatBlock') {
        document.execCommand('formatBlock', false, val);
      }
      _updateRteState(wrap);
    });
  });

  // Color pickers
  wrap.querySelectorAll('.rte-color-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const action = inp.dataset.action;
      const color = inp.value;
      // Update the color bar indicator
      const bar = inp.parentElement.querySelector('.rte-color-bar');
      if (bar) bar.style.background = color;
    });
    inp.addEventListener('change', () => {
      const action = inp.dataset.action;
      const color = inp.value;
      editor.focus();
      document.execCommand(action, false, color);
      _updateRteState(wrap);
    });
  });

  editor.addEventListener('keyup', () => _updateRteState(wrap));
  editor.addEventListener('mouseup', () => _updateRteState(wrap));
}

function _updateRteState(wrap) {
  wrap.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
    try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); } catch(e) {}
  });
}

function _getRichContent(scope, id) {
  const el = scope.querySelector('#' + id);
  return el ? el.innerHTML.trim() : '';
}

function _setRichContent(scope, id, html) {
  const el = scope.querySelector('#' + id);
  if (el) el.innerHTML = html || '';
}

function _truncateHtml(html, max) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '');
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function _truncateHtmlSafe(html, maxChars) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  let count = 0;
  function walk(node) {
    if (count >= maxChars) { node.parentNode?.removeChild(node); return; }
    if (node.nodeType === Node.TEXT_NODE) {
      const remaining = maxChars - count;
      if (node.textContent.length > remaining) {
        node.textContent = node.textContent.slice(0, remaining) + '…';
        count = maxChars;
      } else {
        count += node.textContent.length;
      }
    } else {
      [...node.childNodes].forEach(walk);
    }
  }
  [...div.childNodes].forEach(walk);
  return div.innerHTML;
}

function _existingAttachment(url) {
  if (!url) return `<div style="font-size:.8rem;color:#94a3b8;padding:8px 0;">কোনো সংযুক্তি নেই</div>`;
  const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const isPdf = url.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    return `
      <a href="${full}" target="_blank" class="notice-attachment-pdf" style="margin:0 0 4px;">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>বর্তমান PDF দেখুন</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>`;
  }
  return `
    <div style="position:relative;border-radius:10px;overflow:hidden;max-height:120px;margin-bottom:4px;">
      <img src="${full}" style="width:100%;height:120px;object-fit:cover;display:block;" alt="বর্তমান সংযুক্তি">
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);color:#fff;font-size:.72rem;font-weight:600;padding:5px 10px;text-align:center;">বর্তমান ছবি</div>
    </div>`;
}

function _attachmentPreview(rawUrl) {
  if (!rawUrl) return '';
  const urls = _parseAttachmentUrls(rawUrl);
  if (!urls.length) return '';
  return urls.map(url => {
    const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return `
        <a href="${full}" target="_blank" class="notice-attachment-pdf">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></svg>
          <span>PDF সংযুক্তি দেখুন</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`;
    }
    return `
      <div class="notice-attachment-img" data-lightbox="${full}" style="cursor:pointer;">
        <img src="${full}" alt="সংযুক্তি" loading="lazy">
        <div class="notice-attachment-overlay">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
      </div>`;
  }).join('');
}

function _parseAttachmentUrls(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {}
  return [raw];
}

function _truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}
