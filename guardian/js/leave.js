import { getLeaveHistory, applyLeave, getLeaveTypes, getLeaveAttachment, checkLeaveCalendar, guardianUpdateLeave, guardianDeleteLeave } from './api.js';
import { showToast } from './dashboard.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
import { createFileUpload, openLightbox, openPdfLightbox, createRichEditor } from '../../teacher/js/file-upload.js';

const BASE_URL = 'http://localhost:805';

export async function loadGuardianLeave(container, child, guardian) {
  if (!child) { container.innerHTML = `<div class="empty-state"><div class="empty-title">শিক্ষার্থী নির্বাচন করুন</div></div>`; return; }

  container.innerHTML = `
    <div class="lv-root" style="margin-top: 13px;">
      <div class="lv-tabs" id="glv-tabs">
        <button class="lv-tab active" data-tab="history">ছুটির ইতিহাস</button>
        <button class="lv-tab lv-tab-apply" data-tab="apply">+ নতুন আবেদন</button>
      </div>
      <div id="glv-content" class="lv-content">
        <div class="skeleton skeleton-card" style="height:100px;border-radius:16px;"></div>
        <div class="skeleton skeleton-card" style="height:100px;border-radius:16px;"></div>
      </div>
    </div>`;

  const res = await getLeaveHistory(child.studentIID ?? child.StudentIID);
  const all = res.results || [];

  // Update tab count
  container.querySelector('[data-tab="history"]').textContent = `ছুটির ইতিহাস (${all.length})`;

  renderHistory(container, all, child, guardian);

  container.querySelectorAll('.lv-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'apply') {
        _openApplyForm(container, child, all, guardian);
        return;
      }
      container.querySelectorAll('.lv-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderHistory(container, all, child, guardian);
    });
  });
}

function renderHistory(container, all, child, guardian) {
  const content = document.getElementById('glv-content');
  content.innerHTML = '';

  if (!all.length) {
    content.innerHTML = `
      <div class="empty-state" style="padding:48px 16px;">
        <div class="empty-icon"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="empty-title">কোনো আবেদন নেই</div>
        <div class="empty-sub">নতুন আবেদন করতে "+ নতুন আবেদন" চাপুন</div>
      </div>`;
    return;
  }

  // Year > Month grouping
  const tree = new Map();
  all.forEach(leave => {
    const d = new Date(leave.FromDate ?? leave.fromDate ?? leave.RequestOn ?? leave.requestOn);
    const yr = d.getFullYear();
    const mon = d.getMonth();
    const mKey = `${yr}-${String(mon+1).padStart(2,'0')}`;
    const mLabel = d.toLocaleDateString('bn-BD', { month: 'long' });
    if (!tree.has(yr)) tree.set(yr, new Map());
    const months = tree.get(yr);
    if (!months.has(mKey)) months.set(mKey, { label: mLabel, items: [] });
    months.get(mKey).items.push(leave);
  });

  const sortedYears = [...tree.entries()].sort((a,b) => b[0]-a[0]);
  const latestYear  = sortedYears[0]?.[0];
  const latestMonth = latestYear ? [...tree.get(latestYear).keys()].sort().pop() : null;

  sortedYears.forEach(([yr, months]) => {
    const isLatestYr = yr === latestYear;
    const totalYr = [...months.values()].reduce((s,m) => s+m.items.length, 0);

    const yrHeader = document.createElement('div');
    yrHeader.className = 'lv-year-header';
    yrHeader.innerHTML = `
      <span>${yr}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="lv-group-count">${totalYr}টি</span>
        <svg class="lv-chevron ${isLatestYr?'open':''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>`;
    content.appendChild(yrHeader);

    const yrBody = document.createElement('div');
    yrBody.className = 'lv-year-body';
    if (!isLatestYr) yrBody.style.display = 'none';
    content.appendChild(yrBody);

    yrHeader.addEventListener('click', () => {
      const open = yrBody.style.display !== 'none';
      yrBody.style.display = open ? 'none' : 'flex';
      yrHeader.querySelector('.lv-chevron').classList.toggle('open', !open);
    });

    const sortedMonths = [...months.entries()].sort((a,b) => b[0].localeCompare(a[0]));
    sortedMonths.forEach(([mKey, group]) => {
      const isLatestMon = mKey === latestMonth;

      const mHeader = document.createElement('div');
      mHeader.className = 'lv-group-header';
      mHeader.innerHTML = `
        <span>${group.label}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="lv-group-count">${group.items.length}টি</span>
          <svg class="lv-chevron ${isLatestMon?'open':''}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;
      yrBody.appendChild(mHeader);

      const mBody = document.createElement('div');
      mBody.className = 'lv-group-body';
      if (!isLatestMon) mBody.style.display = 'none';
      yrBody.appendChild(mBody);

      mHeader.addEventListener('click', () => {
        const open = mBody.style.display !== 'none';
        mBody.style.display = open ? 'none' : 'flex';
        mHeader.querySelector('.lv-chevron').classList.toggle('open', !open);
      });

      group.items.forEach(leave => {
        const st = leave.Status ?? leave.status ?? '';
        const statusColor = { Pending:'#f59e0b', Escalated:'#8b5cf6', Approved:'#16a34a', Disapproved:'#dc2626' }[st] || '#94a3b8';
        const statusLabel = { Pending:'অপেক্ষমান', Escalated:'অধ্যক্ষে', Approved:'অনুমোদিত', Disapproved:'প্রত্যাখ্যাত' }[st] || st;
        const id = leave.LeaveId ?? leave.leaveId;
        const hasFile = leave.HasFile ?? leave.hasFile;
        const dayCount = leave.Duration ?? leave.duration ?? 1;

        const card = document.createElement('div');
        card.className = 'lv-card fade-in';
        card.innerHTML = `
          <div class="lv-card-accent" style="background:${statusColor};"></div>
          <div class="lv-card-body">
            <div class="lv-card-header">
              <div>
                <div class="lv-student-name">${leave.LeaveTypeName ?? leave.leaveTypeName ?? 'ছুটি'}</div>
                <div class="lv-meta">${_fmt(leave.FromDate ?? leave.fromDate)} → ${_fmt(leave.ToDate ?? leave.toDate)}</div>
              </div>
              <div class="lv-status-badge" style="background:${statusColor}18;color:${statusColor};">${statusLabel}</div>
            </div>
            <div class="lv-info-row">
              <div class="lv-info-item">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${dayCount} দিন
              </div>
              <div class="lv-info-item">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
                আবেদন: ${_fmt(leave.RequestOn ?? leave.requestOn ?? leave.CreatedAt ?? leave.createdAt)}
              </div>
            </div>
            ${(leave.Description ?? leave.description) ? `<div class="lv-desc">${leave.Description ?? leave.description}</div>` : ''}
            ${_leaveAttachmentHtml(leave)}
            ${(leave.ReviewNote ?? leave.reviewNote) ? `<div class="lv-review-note">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ${leave.ReviewNote ?? leave.reviewNote}
            </div>` : ''}
            ${st === 'Pending' ? `
            <div class="lv-edit-actions">
              <button class="lv-btn lv-btn-edit" data-edit-id="${id}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                সম্পাদনা
              </button>
              <button class="lv-btn lv-btn-delete" data-delete-id="${id}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                মুছুন
              </button>
            </div>` : ''}
          </div>`;

        mBody.appendChild(card);
      });

      // Delete handler
      mBody.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const lid = btn.dataset.deleteId;
          if (!confirm('এই আবেদনটি মুছে ফেলতে চান?')) return;
          btn.disabled = true; btn.style.opacity = '.5';
          const res = await guardianDeleteLeave(lid);
          if (!res.HasError) {
            showToast(res.message || 'মুছে ফেলা হয়েছে', 'success');
            const idx = all.findIndex(x => String(x.LeaveId ?? x.leaveId) === String(lid));
            if (idx > -1) all.splice(idx, 1);
            container.querySelector('[data-tab="history"]').textContent = `ছুটির ইতিহাস (${all.length})`;
            renderHistory(container, all, child, guardian);
          } else {
            showToast(res.message || 'ত্রুটি হয়েছে', 'error');
            btn.disabled = false; btn.style.opacity = '';
          }
        });
      });

      // Edit handler
      mBody.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const lid = btn.dataset.editId;
          const leave = all.find(l => String(l.LeaveId ?? l.leaveId) === String(lid));
          if (leave) _openEditForm(container, leave, all, child, guardian);
        });
      });

      // Legacy binary attachment viewer
      mBody.querySelectorAll('.lv-attachment-legacy').forEach(el => {
        el.addEventListener('click', async () => {
          const lid = el.dataset.leaveId;
          const url = `${BASE_URL}/api/Leave/${lid}/attachment`;
          const token = localStorage.getItem('guardian_token');
          el.textContent = 'লোড হচ্ছে...';
          try {
            const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) { showToast('সংযুক্তি পাওয়া যায়নি', 'error'); return; }
            const ct = r.headers.get('content-type') || '';
            const blob = await r.blob();
            const src = URL.createObjectURL(blob);
            ct.includes('pdf') ? window.open(src, '_blank') : openLightbox(src);
          } catch { showToast('সংযুক্তি লোড হয়নি', 'error'); }
          el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> সংযুক্তি দেখুন`;
        });
      });

      // New file-system attachments: image lightbox
      mBody.querySelectorAll('.lv-att-img[data-lightbox]').forEach(el => {
        el.addEventListener('click', () => openLightbox(el.dataset.lightbox));
      });
    });
  });
}

async function _openApplyForm(container, child, allLeaves, guardian) {
  const { body, open, close } = createBottomSheet({
    id: 'glv-apply-sheet', title: 'ছুটির আবেদন', fullHeight: true,
    content: `<div style="padding:16px;"><div class="skeleton skeleton-card" style="height:280px;border-radius:12px;"></div></div>`
  });
  open();

  const typesRes = await getLeaveTypes();
  const leaveTypes = typesRes.results || [];
  const today = new Date().toISOString().slice(0,10);
  const studentId = child.studentIID ?? child.StudentIID;

  body.innerHTML = `
    <div style="padding:16px 16px 100px;display:flex;flex-direction:column;gap:14px;">

      <div class="form-group">
        <label class="form-label">ছুটির ধরন <span style="color:#ef4444;">*</span></label>
        <select class="form-select" id="glv-type">
          <option value="">— ধরন বেছে নিন —</option>
          ${leaveTypes.map(t => `<option value="${t.LeaveId??t.leaveId}">${t.TypeName??t.typeName}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">শুরুর তারিখ <span style="color:#ef4444;">*</span></label>
          <input type="date" class="form-input" id="glv-from" value="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">শেষের তারিখ <span style="color:#ef4444;">*</span></label>
          <input type="date" class="form-input" id="glv-to" value="${today}">
        </div>
      </div>

      <div id="glv-day-info"></div>

      <div class="form-group">
        <label class="form-label">ছুটির কারণ</label>
        <div id="glv-desc-wrap"></div>
      </div>

      <div id="glv-fu-wrap"></div>

      <div class="sticky-bottom" style="margin:0 -16px -100px;">
        <button class="btn btn-primary btn-full" id="glv-submit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          আবেদন জমা দিন
        </button>
      </div>

    </div>`;

  const rte = createRichEditor(body.querySelector('#glv-desc-wrap'), { placeholder: 'বিস্তারিত লিখুন...' });

  const fu = createFileUpload(body.querySelector('#glv-fu-wrap'), {
    label: 'সংযুক্তি (ডাক্তারের সনদ, চিঠি ইত্যাদি)',
    accept: 'image/*,.pdf',
  });

  // ── Day count + calendar validation on date change ──
  const infoEl   = body.querySelector('#glv-day-info');
  const fromInp  = body.querySelector('#glv-from');
  const toInp    = body.querySelector('#glv-to');
  let calTimer   = null;

  async function refreshDayCount() {
    const from = fromInp.value;
    const to   = toInp.value;
    if (!from || !to || from > to) {
      infoEl.innerHTML = '';
      return;
    }
    infoEl.innerHTML = `<div class="glv-day-info glv-day-info--loading">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" stroke-width="2" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="20"/></svg>
      দিন হিসাব করা হচ্ছে...
    </div>`;

    const res = await checkLeaveCalendar(studentId, from, to);
    if (res.HasError) { infoEl.innerHTML = ''; return; }

    const { regularCount, nonRegular } = res.results;
    const warnings = (nonRegular || []).map(nr => {
      const label = nr.dayType === 'Weekend' ? 'সাপ্তাহিক ছুটি' : (nr.holidayName || nr.dayType);
      return `<span class="glv-day-tag glv-day-tag--warn">${_fmtShort(nr.date)} • ${label}</span>`;
    }).join('');

    infoEl.innerHTML = `
      <div class="glv-day-info">
        <div class="glv-day-count">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <strong>${regularCount}</strong> কার্যদিবস
          <span class="glv-day-total">(মোট ${(new Date(to) - new Date(from)) / 86400000 + 1}টি দিন)</span>
        </div>
        ${warnings ? `<div class="glv-day-warns">${warnings}</div>` : ''}
      </div>`;
  }

  function onDateChange() {
    clearTimeout(calTimer);
    calTimer = setTimeout(refreshDayCount, 400);
  }

  fromInp.addEventListener('change', onDateChange);
  toInp.addEventListener('change', onDateChange);
  // Initial load
  refreshDayCount();

  body.querySelector('#glv-submit').addEventListener('click', async () => {
    const typeId = body.querySelector('#glv-type').value;
    const from   = body.querySelector('#glv-from').value;
    const to     = body.querySelector('#glv-to').value;
    const desc   = rte.getValue();

    if (!typeId) { showToast('ছুটির ধরন বেছে নিন', 'error'); return; }
    if (!from || !to) { showToast('তারিখ দিন', 'error'); return; }
    if (new Date(from) > new Date(to)) { showToast('শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না', 'error'); return; }

    const btn = body.querySelector('#glv-submit');
    btn.disabled = true; btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="56" stroke-dashoffset="28"/></svg> জমা হচ্ছে...`;

    const fd = new FormData();
    fd.append('StudentIId', studentId);
    fd.append('LeaveTypeId', typeId);
    fd.append('FromDate', from);
    fd.append('ToDate', to);
    if (desc) fd.append('Description', desc);
    const file = fu.getFile();
    if (file) fd.append('attachment', file);

    const res = await applyLeave(fd);
    if (!res.HasError) {
      showToast(res.message || 'আবেদন জমা হয়েছে ✓', 'success');
      close();
      // Refresh
      const newRes = await import('./api.js').then(m => m.getLeaveHistory(studentId));
      const updated = newRes.results || [];
      container.querySelector('[data-tab="history"]').textContent = `ছুটির ইতিহাস (${updated.length})`;
      allLeaves.length = 0;
      updated.forEach(l => allLeaves.push(l));
      renderHistory(container, allLeaves, child, guardian);
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> আবেদন জমা দিন`;
    }
  });
}

async function _openEditForm(container, leave, all, child, guardian) {
  const leaveId = leave.LeaveId ?? leave.leaveId;
  const studentId = child.studentIID ?? child.StudentIID;

  const typesRes = await getLeaveTypes();
  const leaveTypes = typesRes.results || [];

  const existingUrls = (() => {
    const raw = leave.AttachmentUrls ?? leave.attachmentUrls;
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; }
    catch { return [raw]; }
  })();

  const fromVal = (leave.FromDate ?? leave.fromDate ?? '').slice(0,10);
  const toVal   = (leave.ToDate   ?? leave.toDate   ?? '').slice(0,10);
  const descVal = leave.Description ?? leave.description ?? '';
  const typeId  = leave.LeaveTypeId ?? leave.leaveTypeId ?? '';

  const { body, open, close } = createBottomSheet({
    id: 'glv-edit-sheet', title: 'আবেদন সম্পাদনা', fullHeight: true,
    content: `<div style="padding:16px;"><div class="skeleton skeleton-card" style="height:280px;border-radius:12px;"></div></div>`
  });
  open();

  body.innerHTML = `
    <div style="padding:16px 16px 100px;display:flex;flex-direction:column;gap:14px;">

      <div class="form-group">
        <label class="form-label">ছুটির ধরন <span style="color:#ef4444;">*</span></label>
        <select class="form-select" id="glve-type">
          <option value="">— ধরন বেছে নিন —</option>
          ${leaveTypes.map(t => `<option value="${t.LeaveId??t.leaveId}" ${(t.LeaveId??t.leaveId)==typeId?'selected':''}>${t.TypeName??t.typeName}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">শুরুর তারিখ <span style="color:#ef4444;">*</span></label>
          <input type="date" class="form-input" id="glve-from" value="${fromVal}">
        </div>
        <div class="form-group">
          <label class="form-label">শেষের তারিখ <span style="color:#ef4444;">*</span></label>
          <input type="date" class="form-input" id="glve-to" value="${toVal}">
        </div>
      </div>

      <div id="glve-day-info"></div>

      <div class="form-group">
        <label class="form-label">কারণ</label>
        <div id="glve-desc-wrap"></div>
      </div>

      ${existingUrls.length ? `
      <div class="form-group">
        <label class="form-label">বিদ্যমান সংযুক্তি</label>
        <div id="glve-existing-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
          ${existingUrls.map((u,i) => {
            const full = u.startsWith('http') ? u : `${BASE_URL}${u}`;
            const isPdf = u.toLowerCase().endsWith('.pdf');
            if (isPdf) return `
            <div class="glve-chip glve-chip-pdf" data-url="${u}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>PDF ${i+1}</span>
              <button class="glve-chip-remove" aria-label="সরান">×</button>
            </div>`;
            return `
            <div class="glve-chip glve-chip-img" data-url="${u}" data-full="${full}">
              <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
              <button class="glve-chip-remove" aria-label="সরান">×</button>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <div id="glve-fu-wrap"></div>

      <div class="sticky-bottom" style="margin:0 -16px -100px;">
        <button class="btn btn-primary btn-full" id="glve-submit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          আপডেট করুন
        </button>
      </div>
    </div>`;

  const rteEd = createRichEditor(body.querySelector('#glve-desc-wrap'), {
    placeholder: 'ছুটির কারণ লিখুন...',
    initialValue: descVal,
  });

  const fu = createFileUpload(body.querySelector('#glve-fu-wrap'), {
    label: 'নতুন সংযুক্তি (ডাক্তারের সনদ, চিঠি ইত্যাদি)',
    accept: 'image/*,.pdf',
    multiple: true,
  });

  // Day count
  const infoEl  = body.querySelector('#glve-day-info');
  const fromInp = body.querySelector('#glve-from');
  const toInp   = body.querySelector('#glve-to');
  let calTimer  = null;

  async function refreshDayCount() {
    const from = fromInp.value, to = toInp.value;
    if (!from || !to || from > to) { infoEl.innerHTML = ''; return; }
    infoEl.innerHTML = `<div class="glv-day-info glv-day-info--loading"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" stroke-width="2" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="20"/></svg> দিন হিসাব করা হচ্ছে...</div>`;
    const res = await checkLeaveCalendar(studentId, from, to);
    if (res.HasError) { infoEl.innerHTML = ''; return; }
    const { regularCount, nonRegular } = res.results;
    const warns = (nonRegular||[]).map(nr => `<span class="glv-day-tag glv-day-tag--warn">${_fmtShort(nr.date)} • ${nr.dayType==='Weekend'?'সাপ্তাহিক ছুটি':(nr.holidayName||nr.dayType)}</span>`).join('');
    infoEl.innerHTML = `<div class="glv-day-info"><div class="glv-day-count"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><strong>${regularCount}</strong> কার্যদিবস <span class="glv-day-total">(মোট ${(new Date(to)-new Date(from))/86400000+1}টি দিন)</span></div>${warns?`<div class="glv-day-warns">${warns}</div>`:''}</div>`;
  }

  fromInp.addEventListener('change', () => { clearTimeout(calTimer); calTimer = setTimeout(refreshDayCount, 400); });
  toInp.addEventListener('change',   () => { clearTimeout(calTimer); calTimer = setTimeout(refreshDayCount, 400); });
  refreshDayCount();

  // Track removed URLs
  const removedUrls = new Set();
  body.querySelectorAll('.glve-chip-img').forEach(chip => {
    chip.addEventListener('click', () => openLightbox(chip.dataset.full));
  });
  body.querySelectorAll('.glve-chip-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const chip = btn.closest('.glve-chip');
      removedUrls.add(chip.dataset.url);
      chip.remove();
    });
  });

  body.querySelector('#glve-submit').addEventListener('click', async () => {
    const typeId = body.querySelector('#glve-type').value;
    const from   = fromInp.value;
    const to     = toInp.value;
    const desc   = rteEd.getValue();

    if (!typeId) { showToast('ছুটির ধরন বেছে নিন', 'error'); return; }
    if (!from || !to) { showToast('তারিখ দিন', 'error'); return; }
    if (new Date(from) > new Date(to)) { showToast('শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না', 'error'); return; }

    const submitBtn = body.querySelector('#glve-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="56" stroke-dashoffset="28"/></svg> আপডেট হচ্ছে...`;

    const fd = new FormData();
    fd.append('StudentIId', studentId);
    fd.append('LeaveTypeId', typeId);
    fd.append('FromDate', from);
    fd.append('ToDate', to);
    if (desc) fd.append('Description', desc);
    if (removedUrls.size) fd.append('RemoveUrls', JSON.stringify([...removedUrls]));
    const files = fu.getFiles ? fu.getFiles() : (fu.getFile() ? [fu.getFile()] : []);
    files.forEach(f => fd.append('attachments', f));

    const res = await guardianUpdateLeave(leaveId, fd);
    if (!res.HasError) {
      showToast(res.message || 'আবেদন আপডেট হয়েছে ✓', 'success');
      close();
      const newRes = await getLeaveHistory(studentId);
      const updated = newRes.results || [];
      all.length = 0;
      updated.forEach(l => all.push(l));
      container.querySelector('[data-tab="history"]').textContent = `ছুটির ইতিহাস (${all.length})`;
      renderHistory(container, all, child, guardian);
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> আপডেট করুন`;
    }
  });
}

function _leaveAttachmentHtml(leave) {
  const id = leave.LeaveId ?? leave.leaveId;
  const rawUrls = leave.AttachmentUrls ?? leave.attachmentUrls ?? null;
  const hasFile = leave.HasFile ?? leave.hasFile;

  let urls = [];
  if (rawUrls) {
    try { const p = JSON.parse(rawUrls); urls = Array.isArray(p) ? p : [p]; }
    catch { urls = [rawUrls]; }
  }

  if (urls.length > 0) {
    const items = urls.map((url, i) => {
      const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      const isPdf = url.toLowerCase().endsWith('.pdf');
      if (isPdf) return `<a href="${full}" target="_blank" class="glve-chip glve-chip-pdf" style="text-decoration:none;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>PDF ${i+1}</span>
      </a>`;
      return `<div class="glve-chip glve-chip-img lv-att-img" data-lightbox="${full}" style="cursor:pointer;">
        <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
        <div class="glve-chip-eye">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">${items}</div>`;
  }

  if (hasFile) {
    return `<div class="lv-attachment lv-attachment-legacy" data-leave-id="${id}" style="margin-top:8px;">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      সংযুক্তি দেখুন
    </div>`;
  }
  return '';
}

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day:'numeric', month:'short', year:'numeric' });
}

function _fmtShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day:'numeric', month:'short' });
}
