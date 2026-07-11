import { getPendingLeaves, actionLeave, principalLeaveDecision, getMySections, getClassStudents, getLeaveTypes, teacherApplyLeave, teacherUpdateLeave, teacherDeleteLeave, checkLeaveCalendar } from './api.js';
import { showToast } from './dashboard.js';
import { showConfirm } from '../../shared/js/confirm-dialog.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
import { createFileUpload, openLightbox, createRichEditor } from './file-upload.js';
import { BASE_URL } from '../../shared/js/api-config.js';

export async function loadLeaveModule(container, teacher) {
  const isPrincipal = !!teacher?.isPrincipal;

  container.innerHTML = `
    <div class="lv-root">
      <div class="lv-tabs" id="lv-tabs">
        <button class="lv-tab active" data-tab="pending">অপেক্ষমান</button>
        ${isPrincipal ? `<button class="lv-tab" data-tab="escalated">এস্কেলেটেড</button>` : ''}
        <button class="lv-tab" data-tab="reviewed">ইতিহাস</button>
        <button class="lv-tab lv-tab-apply" data-tab="apply">+ ছুটি আবেদন</button>
      </div>
      <div id="lv-content" class="lv-content">
        <div class="skeleton skeleton-card" style="margin:16px;height:120px;border-radius:16px;"></div>
        <div class="skeleton skeleton-card" style="margin:16px;height:120px;border-radius:16px;"></div>
      </div>
    </div>`;

  const [pendingRes, reviewedRes] = await Promise.all([
    getPendingLeaves(),
    getPendingLeaves('Reviewed'),
  ]);

  const all       = pendingRes.results || [];
  const reviewed  = reviewedRes.results || [];
  const pending   = all.filter(l => (l.Status ?? l.status) === 'Pending');
  const escalated = all.filter(l => (l.Status ?? l.status) === 'Escalated');

  // Update tab counts
  container.querySelector('[data-tab="pending"]').textContent   = `অপেক্ষমান (${pending.length})`;
  if (isPrincipal) container.querySelector('[data-tab="escalated"]').textContent = `এস্কেলেটেড (${escalated.length})`;
  container.querySelector('[data-tab="reviewed"]').textContent  = `ইতিহাস (${reviewed.length})`;

  let currentTab = 'pending';

  function renderList(tab) {
    const list = tab === 'pending' ? pending : tab === 'escalated' ? escalated : reviewed;
    const content = document.getElementById('lv-content');
    content.innerHTML = '';
    content.style.gap = '0';

    if (!list.length) {
      content.innerHTML = `
        <div class="empty-state" style="padding:48px 16px;">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
          </div>
          <div class="empty-title">কোনো আবেদন নেই</div>
        </div>`;
      return;
    }

    // Build Year > Month > items tree
    const tree = new Map(); // year → Map(monthKey → { label, items[] })
    list.forEach(leave => {
      const raw = leave.FromDate ?? leave.fromDate ?? leave.RequestOn ?? leave.requestOn;
      const d = raw ? new Date(raw) : new Date();
      const yr  = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
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
      const totalYr = [...months.values()].reduce((s,m)=>s+m.items.length,0);

      const yrGroup = document.createElement('div');
      yrGroup.className = 'gh-year-group';

      const yrHeader = document.createElement('div');
      yrHeader.className = `gh-year-header${isLatestYr ? '' : ' gh-closed'}`;
      yrHeader.innerHTML = `
        <span class="gh-year-title">${yr} সাল</span>
        <div class="gh-year-right">
          <span class="gh-year-meta">${totalYr}টি আবেদন</span>
          <svg class="gh-year-chevron${isLatestYr ? ' open' : ''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;
      yrGroup.appendChild(yrHeader);

      const yrBody = document.createElement('div');
      yrBody.className = 'gh-year-body';
      if (!isLatestYr) yrBody.style.display = 'none';
      yrGroup.appendChild(yrBody);
      content.appendChild(yrGroup);

      yrHeader.addEventListener('click', () => {
        const open = yrBody.style.display !== 'none';
        yrBody.style.display = open ? 'none' : '';
        yrHeader.querySelector('.gh-year-chevron').classList.toggle('open', !open);
        yrHeader.classList.toggle('gh-closed', open);
      });

      const sortedMonths = [...months.entries()].sort((a,b) => b[0].localeCompare(a[0]));
      sortedMonths.forEach(([mKey, group]) => {
        const isLatestMon = mKey === latestMonth;

        const mHeader = document.createElement('div');
        mHeader.className = 'gh-month-header';
        mHeader.innerHTML = `
          <div class="gh-month-left" style="flex-direction:row;align-items:center;gap:6px;">
            <span class="gh-month-name">${group.label}</span>
            <span class="gh-month-sub" style="margin-top:0;">${group.items.length}টি</span>
          </div>
          <svg class="gh-month-chevron${isLatestMon ? ' open' : ''}" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
        yrBody.appendChild(mHeader);

        const mBody = document.createElement('div');
        mBody.className = `gh-month-body${isLatestMon ? ' open' : ''}`;
        yrBody.appendChild(mBody);

        mHeader.addEventListener('click', () => {
          const open = mBody.classList.contains('open');
          mBody.classList.toggle('open', !open);
          mHeader.querySelector('.gh-month-chevron').classList.toggle('open', !open);
        });

        group.items.forEach(leave => {
      const showActions = (tab === 'pending' && !isPrincipal) || (tab === 'escalated' && isPrincipal);
      const myUserId = String(teacher?.userId ?? '');
      const leaveAddBy = String(leave.AddBy ?? leave.addBy ?? '');
      const isMyLeave = myUserId && leaveAddBy && myUserId === leaveAddBy;
      const showEditDelete = isMyLeave && (leave.Status ?? leave.status) === 'Pending';
      const card = document.createElement('div');
      card.className = 'lv-card fade-in';

      const st = leave.Status ?? leave.status ?? '';
      const statusColor = {
        Pending: '#f59e0b', Escalated: '#8b5cf6',
        Approved: '#16a34a', Disapproved: '#dc2626'
      }[st] || '#94a3b8';

      const statusLabel = {
        Pending: 'অপেক্ষমান', Escalated: 'অধ্যক্ষে',
        Approved: 'অনুমোদিত', Disapproved: 'প্রত্যাখ্যাত'
      }[st] || st;

      const dayCount = leave.Duration ?? leave.duration ?? _dayDiff(leave.FromDate ?? leave.fromDate, leave.ToDate ?? leave.toDate);

      card.innerHTML = `
        <div class="lv-card-accent" style="background:${statusColor};"></div>
        <div class="lv-card-body">
          <!-- Header -->
          <div class="lv-card-header">
            <div>
              <div class="lv-student-name">${leave.StudentName ?? leave.studentName ?? '—'}</div>
              <div class="lv-meta">${leave.ClassName ?? leave.className ?? ''} ${(leave.SectionName ?? leave.sectionName) ? '· '+(leave.SectionName ?? leave.sectionName) : ''}</div>
            </div>
            <div class="lv-status-badge" style="background:${statusColor}18;color:${statusColor};">
              ${statusLabel}
            </div>
          </div>

          <!-- Leave info -->
          <div class="lv-info-row">
            <div class="lv-info-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${_fmt(leave.FromDate ?? leave.fromDate)} → ${_fmt(leave.ToDate ?? leave.toDate)}
            </div>
            <div class="lv-info-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${dayCount} দিন
            </div>
            <div class="lv-info-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
              আবেদন: ${_fmt(leave.RequestOn ?? leave.requestOn ?? leave.CreatedAt ?? leave.createdAt)}
            </div>
            ${(leave.LeaveTypeName ?? leave.leaveTypeName) ? `
            <div class="lv-info-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              ${leave.LeaveTypeName ?? leave.leaveTypeName}
            </div>` : ''}
          </div>

          <!-- Description -->
          ${(leave.Description ?? leave.description) ? `<div class="lv-desc">${leave.Description ?? leave.description}</div>` : ''}

          <!-- Actions -->
          ${showActions ? `
            <div class="lv-actions">
              <button class="lv-btn lv-btn-approve" data-id="${leave.LeaveId ?? leave.leaveId}" data-action="Approved">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                অনুমোদন
              </button>
              <button class="lv-btn lv-btn-reject" data-id="${leave.LeaveId ?? leave.leaveId}" data-action="Disapproved">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                প্রত্যাখ্যান
              </button>
              ${!isPrincipal ? `
              <button class="lv-btn lv-btn-escalate" data-id="${leave.LeaveId ?? leave.leaveId}" data-action="Escalated">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                অধ্যক্ষকে পাঠাও
              </button>` : ''}
            </div>
          ` : ''}

          <!-- Edit/Delete for own Pending leaves -->
          ${showEditDelete ? `
            <div class="lv-edit-actions">
              <button class="lv-btn lv-btn-edit" data-edit-id="${leave.LeaveId ?? leave.leaveId}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                সম্পাদনা
              </button>
              <button class="lv-btn lv-btn-delete" data-delete-id="${leave.LeaveId ?? leave.leaveId}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                মুছুন
              </button>
            </div>
          ` : ''}

          <!-- Attachment -->
          ${_leaveAttachmentHtml(leave)}

          <!-- Reviewed info -->
          ${tab === 'reviewed' && (leave.ReviewNote ?? leave.reviewNote) ? `
            <div class="lv-review-note">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ${leave.ReviewNote}
            </div>` : ''}
        </div>
      `;

        mBody.appendChild(card);
        }); // end group.items.forEach
      }); // end sortedMonths.forEach
    }); // end sortedYears.forEach

    // Legacy attachment viewer (old binary file)
    content.querySelectorAll('.lv-attachment-legacy').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.leaveId;
        const url = `${BASE_URL}/api/Leave/${id}/attachment`;
        const token = localStorage.getItem('teacher_token');
        el.textContent = 'লোড হচ্ছে...';
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) { showToast('সংযুক্তি পাওয়া যায়নি', 'error'); return; }
          const ct = r.headers.get('content-type') || '';
          const blob = await r.blob();
          const src = URL.createObjectURL(blob);
          if (ct.includes('pdf')) { window.open(src, '_blank'); }
          else { openLightbox(src); }
        } catch { showToast('সংযুক্তি লোড হয়নি', 'error'); }
        el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> সংযুক্তি দেখুন`;
      });
    });

    // New file-system attachments: image thumbnails + PDF links
    content.querySelectorAll('.lv-att-img[data-lightbox]').forEach(el => {
      el.addEventListener('click', () => openLightbox(el.dataset.lightbox));
    });

    // Delete buttons
    content.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteId;
        if (!await showConfirm('এই আবেদনটি মুছে ফেলতে চান?', { confirmText: 'মুছে ফেলুন', cancelText: 'বাতিল' })) return;
        btn.disabled = true; btn.style.opacity = '.5';
        const res = await teacherDeleteLeave(id);
        if (!res.HasError) {
          showToast(res.message || 'মুছে ফেলা হয়েছে', 'success');
          const removeFrom = l => { const i = l.findIndex(x => String(x.LeaveId ?? x.leaveId) === String(id)); if (i > -1) l.splice(i, 1); };
          removeFrom(pending); removeFrom(escalated); removeFrom(reviewed);
          container.querySelector('[data-tab="pending"]').textContent = `অপেক্ষমান (${pending.length})`;
          renderList(currentTab);
        } else {
          showToast(res.message || 'ত্রুটি হয়েছে', 'error');
          btn.disabled = false; btn.style.opacity = '';
        }
      });
    });

    // Edit buttons
    content.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editId;
        const leave = [...pending, ...escalated, ...reviewed].find(l => String(l.LeaveId ?? l.leaveId) === String(id));
        if (leave) _openEditForm(container, leave, pending, reviewed, currentTab, renderList, teacher);
      });
    });

    // Action buttons
    content.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const decision = btn.dataset.action;

        let note = '';
        if (decision === 'Disapproved') {
          note = prompt('প্রত্যাখ্যানের কারণ (ঐচ্ছিক):') || '';
        }

        // Disable ALL action buttons on this card
        const actionsEl = btn.closest('.lv-actions');
        const allBtns = actionsEl ? [...actionsEl.querySelectorAll('[data-action]')] : [btn];
        allBtns.forEach(b => { b.disabled = true; b.style.opacity = '.5'; });

        const res = isPrincipal
          ? await principalLeaveDecision(id, decision, note)
          : await actionLeave(id, decision, note);

        if (!res.HasError) {
          showToast(res.message || '✓ আপডেট হয়েছে', 'success');
          const leave = all.find(l => String(l.LeaveId ?? l.leaveId) === String(id));
          if (leave) {
            leave.Status = decision;
            leave.ReviewNote = note;
            // Remove from whichever active list this card came from
            const srcList = currentTab === 'escalated' ? escalated : pending;
            const idx = srcList.findIndex(l => String(l.LeaveId ?? l.leaveId) === String(id));
            if (idx > -1) {
              const [moved] = srcList.splice(idx, 1);
              reviewed.unshift(moved);
            }
            const pendingTab = container.querySelector('[data-tab="pending"]');
            const escalatedTab = container.querySelector('[data-tab="escalated"]');
            if (pendingTab) pendingTab.textContent = `অপেক্ষমান (${pending.length})`;
            if (escalatedTab) escalatedTab.textContent = `অধ্যক্ষে (${escalated.length})`;
            container.querySelector('[data-tab="reviewed"]').textContent = `ইতিহাস (${reviewed.length})`;
          }
          renderList(currentTab);
        } else {
          showToast(res.message || 'ত্রুটি হয়েছে', 'error');
          // Re-enable on failure
          allBtns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
        }
      });
    });
  }

  renderList('pending');

  container.querySelectorAll('.lv-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'apply') {
        _openApplyForm(container, pending, escalated, reviewed, renderList, () => { currentTab = 'pending'; });
        return;
      }
      container.querySelectorAll('.lv-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderList(currentTab);
    });
  });
}

async function _openApplyForm(container, pending, escalated, reviewed, renderList, setTabPending) {
  const { body, open, close } = createBottomSheet({
    id: 'lv-apply-sheet', title: 'ছুটির আবেদন করুন', fullHeight: true,
    content: `<div style="padding:16px;"><div class="skeleton skeleton-card" style="height:300px;border-radius:12px;"></div></div>`
  });
  open();

  // Load sections, leave types in parallel
  const [sectionsRes, typesRes] = await Promise.all([
    getMySections(),
    getLeaveTypes(),
  ]);

  const ctSections = sectionsRes.results?.classTeacherSections || [];
  const leaveTypes = typesRes.results || [];
  const today = new Date().toISOString().slice(0, 10);

  body.innerHTML = `
    <div style="padding:16px 16px 100px;display:flex;flex-direction:column;gap:14px;">

      <div class="form-group">
        <label class="form-label">সেকশন বেছে নিন *</label>
        <select class="form-select" id="lv-section">
          <option value="">— সেকশন —</option>
          ${ctSections.map(s => `<option value="${s.sectionId}">${s.className} - ${s.sectionName}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">শিক্ষার্থী *</label>
        <select class="form-select" id="lv-student" disabled>
          <option value="">আগে সেকশন বেছে নিন</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">ছুটির ধরন *</label>
        <select class="form-select" id="lv-type">
          <option value="">— ধরন —</option>
          ${leaveTypes.map(t => `<option value="${t.LeaveId ?? t.leaveId}">${t.TypeName ?? t.typeName}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">শুরুর তারিখ *</label>
          <input type="date" class="form-input" id="lv-from" value="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">শেষের তারিখ *</label>
          <input type="date" class="form-input" id="lv-to" value="${today}">
        </div>
      </div>

      <div id="lv-day-info"></div>

      <div class="form-group">
        <label class="form-label">কারণ</label>
        <div id="lv-desc-wrap"></div>
      </div>

      <div id="lv-fu-wrap"></div>

      <div class="sticky-bottom" style="margin:0 -16px -100px;">
        <button class="btn btn-primary btn-full" id="lv-submit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          আবেদন জমা দিন
        </button>
      </div>
    </div>`;

  // Rich editor for description
  const rte = createRichEditor(body.querySelector('#lv-desc-wrap'), { placeholder: 'ছুটির কারণ লিখুন...' });

  // File upload component — multiple files
  const fu = createFileUpload(body.querySelector('#lv-fu-wrap'), {
    label: 'সংযুক্তি (ডাক্তারের সনদ, চিঠি ইত্যাদি)',
    accept: 'image/*,.pdf',
    multiple: true,
  });

  const infoEl  = body.querySelector('#lv-day-info');
  let _dayTimer = null;

  function _fmtShort(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
  }

  async function refreshDayCount() {
    const studentId = body.querySelector('#lv-student').value;
    const from = body.querySelector('#lv-from').value;
    const to   = body.querySelector('#lv-to').value;
    if (!studentId || !from || !to || from > to) { infoEl.innerHTML = ''; return; }
    infoEl.innerHTML = `<div class="glv-day-info glv-day-info--loading"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> দিন হিসাব করা হচ্ছে...</div>`;
    const res = await checkLeaveCalendar(studentId, from, to);
    if (res.HasError) { infoEl.innerHTML = ''; return; }
    const { regularCount, nonRegular } = res.results;
    const total = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    const warnings = (nonRegular || []).map(nr => {
      const label = nr.dayType === 'Weekend' ? 'সাপ্তাহিক ছুটি' : (nr.holidayName || nr.dayType);
      return `<span class="glv-day-tag glv-day-tag--warn">${_fmtShort(nr.date)} • ${label}</span>`;
    }).join('');
    infoEl.innerHTML = `<div class="glv-day-info">
      <div class="glv-day-count"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <strong>${regularCount}</strong> কার্যদিবস <span class="glv-day-total">(মোট ${total}টি দিন)</span>
      </div>
      ${warnings ? `<div class="glv-day-warns">${warnings}</div>` : ''}
    </div>`;
  }

  function _scheduleRefresh() {
    clearTimeout(_dayTimer);
    _dayTimer = setTimeout(refreshDayCount, 400);
  }

  // Section → load students
  body.querySelector('#lv-section').addEventListener('change', async e => {
    const sid = e.target.value;
    const studentSel = body.querySelector('#lv-student');
    if (!sid) { studentSel.innerHTML = '<option value="">আগে সেকশন বেছে নিন</option>'; studentSel.disabled = true; infoEl.innerHTML = ''; return; }
    studentSel.innerHTML = '<option value="">লোড হচ্ছে...</option>'; studentSel.disabled = true;
    const res = await getClassStudents(sid);
    const students = res.results || [];
    studentSel.innerHTML = students.length
      ? `<option value="">— শিক্ষার্থী বেছে নিন —</option>` + students.map(s =>
          `<option value="${s.StudentIID ?? s.studentIID}">${s.RollNo ?? s.rollNo}. ${s.FullName ?? s.fullName}</option>`).join('')
      : '<option value="">কোনো শিক্ষার্থী নেই</option>';
    studentSel.disabled = false;
    _scheduleRefresh();
  });

  body.querySelector('#lv-student').addEventListener('change', _scheduleRefresh);
  body.querySelector('#lv-from').addEventListener('change', _scheduleRefresh);
  body.querySelector('#lv-to').addEventListener('change', _scheduleRefresh);

  // Submit
  body.querySelector('#lv-submit').addEventListener('click', async () => {
    const studentId = body.querySelector('#lv-student').value;
    const typeId    = body.querySelector('#lv-type').value;
    const from      = body.querySelector('#lv-from').value;
    const to        = body.querySelector('#lv-to').value;
    const desc      = rte.getValue();

    if (!studentId) { showToast('শিক্ষার্থী বেছে নিন', 'error'); return; }
    if (!typeId)    { showToast('ছুটির ধরন বেছে নিন', 'error'); return; }
    if (!from || !to) { showToast('তারিখ দিন', 'error'); return; }
    if (new Date(from) > new Date(to)) { showToast('শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না', 'error'); return; }

    const btn = body.querySelector('#lv-submit');
    btn.disabled = true; btn.textContent = 'জমা হচ্ছে...';

    const fd = new FormData();
    fd.append('StudentIId', studentId);
    fd.append('LeaveTypeId', typeId);
    fd.append('FromDate', from);
    fd.append('ToDate', to);
    if (desc) fd.append('Description', desc);
    fu.getFiles().forEach(f => fd.append('attachments', f));

    const res = await teacherApplyLeave(fd);

    if (!res.HasError) {
      showToast(res.message || 'আবেদন জমা হয়েছে ✓', 'success');
      close();
      // Reload full list from server so dates/names are correct
      const freshRes = await getPendingLeaves();
      const freshAll = freshRes.results || [];
      pending.length = 0;
      escalated.length = 0;
      freshAll.filter(l => (l.Status ?? l.status) === 'Pending').forEach(l => pending.push(l));
      freshAll.filter(l => (l.Status ?? l.status) === 'Escalated').forEach(l => escalated.push(l));
      container.querySelector('[data-tab="pending"]').textContent = `অপেক্ষমান (${pending.length})`;
      if (container.querySelector('[data-tab="escalated"]'))
        container.querySelector('[data-tab="escalated"]').textContent = `এস্কেলেটেড (${escalated.length})`;
      // Switch to pending tab
      setTabPending();
      container.querySelectorAll('.lv-tab').forEach(b => b.classList.remove('active'));
      container.querySelector('[data-tab="pending"]')?.classList.add('active');
      renderList('pending');
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> আবেদন জমা দিন`;
    }
  });
}

function _leaveAttachmentHtml(leave) {
  const id = leave.LeaveId ?? leave.leaveId;
  const rawUrls = leave.AttachmentUrls ?? leave.attachmentUrls ?? null;
  const hasFile = leave.HasFile ?? leave.hasFile;

  let urls = [];
  if (rawUrls) {
    try {
      const parsed = JSON.parse(rawUrls);
      urls = Array.isArray(parsed) ? parsed : [parsed];
    } catch { urls = [rawUrls]; }
  }

  if (urls.length > 0) {
    const items = urls.map((url, i) => {
      const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      const isPdf = url.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        return `<a href="${full}" target="_blank" class="glve-chip glve-chip-pdf" style="text-decoration:none;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>PDF ${i+1}</span>
        </a>`;
      }
      return `<div class="glve-chip glve-chip-img lv-att-img" data-lightbox="${full}" style="cursor:pointer;">
        <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
        <div class="glve-chip-eye">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">${items}</div>`;
  }

  // Legacy binary file
  if (hasFile) {
    return `<div class="lv-attachment lv-attachment-legacy" data-leave-id="${id}" style="margin-top:6px;">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      সংযুক্তি দেখুন
    </div>`;
  }

  return '';
}

async function _openEditForm(container, leave, pending, reviewed, currentTab, renderList, teacher) {
  const leaveId = leave.LeaveId ?? leave.leaveId;

  const [typesRes] = await Promise.all([getLeaveTypes()]);
  const leaveTypes = typesRes.results || [];

  const fromVal = (leave.FromDate ?? leave.fromDate ?? '').slice(0, 10);
  const toVal   = (leave.ToDate   ?? leave.toDate   ?? '').slice(0, 10);

  const { body, open, close } = createBottomSheet({
    id: 'lv-edit-sheet', title: 'আবেদন সম্পাদনা', fullHeight: true,
    content: `<div style="padding:16px;"></div>`
  });
  open();

  // Parse existing attachments
  let existingUrls = [];
  const rawUrls = leave.AttachmentUrls ?? leave.attachmentUrls;
  if (rawUrls) {
    try { const p = JSON.parse(rawUrls); existingUrls = Array.isArray(p) ? p : [p]; }
    catch { existingUrls = [rawUrls]; }
  }

  body.innerHTML = `
    <div style="padding:16px 16px 100px;display:flex;flex-direction:column;gap:14px;">

      <div class="form-group">
        <label class="form-label">শিক্ষার্থী</label>
        <div class="form-input" style="background:#f1f5f9;color:#64748b;">${leave.StudentName ?? leave.studentName ?? '—'} · ${leave.ClassName ?? leave.className ?? ''} ${leave.SectionName ?? leave.sectionName ?? ''}</div>
      </div>

      <div class="form-group">
        <label class="form-label">ছুটির ধরন *</label>
        <select class="form-select" id="lved-type">
          <option value="">— ধরন —</option>
          ${leaveTypes.map(t => `<option value="${t.LeaveId ?? t.leaveId}" ${(t.LeaveId ?? t.leaveId) == (leave.LeaveTypeId ?? leave.leaveTypeId) ? 'selected' : ''}>${t.TypeName ?? t.typeName}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">শুরুর তারিখ *</label>
          <input type="date" class="form-input" id="lved-from" value="${fromVal}">
        </div>
        <div class="form-group">
          <label class="form-label">শেষের তারিখ *</label>
          <input type="date" class="form-input" id="lved-to" value="${toVal}">
        </div>
      </div>
      <div id="lved-days-info" style="display:none;align-items:center;gap:8px;padding:10px 14px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;font-size:.85rem;color:#15803d;font-weight:600;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span id="lved-days-text"></span>
      </div>

      <div class="form-group">
        <label class="form-label">কারণ</label>
        <div id="lved-desc-wrap"></div>
      </div>

      ${existingUrls.length > 0 ? `
        <div class="form-group">
          <label class="form-label">বিদ্যমান সংযুক্তি</label>
          <div id="lved-existing-atts" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${existingUrls.map((url, i) => {
              const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
              const isPdf = url.toLowerCase().endsWith('.pdf');
              if (isPdf) return `
              <div class="glve-chip glve-chip-pdf" data-url="${url}">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>PDF ${i+1}</span>
                <button class="glve-chip-remove lved-remove-att" data-url="${url}" type="button" aria-label="সরান">×</button>
              </div>`;
              return `
              <div class="glve-chip glve-chip-img" data-url="${url}" data-full="${full}">
                <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
                <button class="glve-chip-remove lved-remove-att" data-url="${url}" type="button" aria-label="সরান">×</button>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      <div id="lved-fu-wrap"></div>

      <div class="sticky-bottom" style="margin:0 -16px -100px;">
        <button class="btn btn-primary btn-full" id="lved-submit">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          আপডেট করুন
        </button>
      </div>
    </div>`;

  const rteEd = createRichEditor(body.querySelector('#lved-desc-wrap'), {
    placeholder: 'ছুটির কারণ লিখুন...',
    initialValue: leave.Description ?? leave.description ?? '',
  });

  const fu = createFileUpload(body.querySelector('#lved-fu-wrap'), {
    label: 'নতুন সংযুক্তি যোগ করুন',
    accept: 'image/*,.pdf',
    multiple: true,
  });

  // Working days counter
  const fromInput = body.querySelector('#lved-from');
  const toInput   = body.querySelector('#lved-to');
  const daysInfo  = body.querySelector('#lved-days-info');
  const daysText  = body.querySelector('#lved-days-text');
  function _updateDays() {
    const f = fromInput.value, t = toInput.value;
    if (!f || !t) { daysInfo.style.display = 'none'; return; }
    const d1 = new Date(f), d2 = new Date(t);
    if (d2 < d1) { daysInfo.style.display = 'none'; return; }
    let count = 0, cur = new Date(d1);
    while (cur <= d2) { const day = cur.getDay(); if (day !== 5 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
    const total = Math.round((d2 - d1) / 86400000) + 1;
    daysText.textContent = `${count} কার্যদিবস (মোট ${total}টি দিন)`;
    daysInfo.style.display = 'flex';
  }
  fromInput.addEventListener('change', _updateDays);
  toInput.addEventListener('change', _updateDays);
  _updateDays();

  // Track removed URLs
  const removedUrls = new Set();
  body.querySelectorAll('.glve-chip-img').forEach(chip => {
    chip.addEventListener('click', () => openLightbox(chip.dataset.full));
  });
  body.querySelectorAll('.lved-remove-att').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const url = btn.dataset.url;
      removedUrls.add(url);
      btn.closest('.glve-chip').remove();
    });
  });

  body.querySelector('#lved-submit').addEventListener('click', async () => {
    const typeId = body.querySelector('#lved-type').value;
    const from   = body.querySelector('#lved-from').value;
    const to     = body.querySelector('#lved-to').value;
    const desc   = rteEd.getValue();

    if (!typeId) { showToast('ছুটির ধরন বেছে নিন', 'error'); return; }
    if (!from || !to) { showToast('তারিখ দিন', 'error'); return; }
    if (new Date(from) > new Date(to)) { showToast('শুরুর তারিখ শেষের তারিখের পরে হতে পারবে না', 'error'); return; }

    const submitBtn = body.querySelector('#lved-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'আপডেট হচ্ছে...';

    const fd = new FormData();
    fd.append('StudentIId', String(leave.StudentIId ?? leave.studentIId));
    fd.append('LeaveTypeId', typeId);
    fd.append('FromDate', from);
    fd.append('ToDate', to);
    if (desc) fd.append('Description', desc);
    if (removedUrls.size > 0) fd.append('RemoveUrls', JSON.stringify([...removedUrls]));
    fu.getFiles().forEach(f => fd.append('attachments', f));

    const res = await teacherUpdateLeave(leaveId, fd);
    if (!res.HasError) {
      showToast(res.message || 'আপডেট হয়েছে ✓', 'success');
      close();
      // Refresh the leave in local list
      const freshRes = await getPendingLeaves();
      const freshAll = freshRes.results || [];
      pending.length = 0;
      freshAll.filter(l => (l.Status ?? l.status) === 'Pending').forEach(l => pending.push(l));
      container.querySelector('[data-tab="pending"]').textContent = `অপেক্ষমান (${pending.length})`;
      renderList(currentTab);
    } else {
      showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> আপডেট করুন`;
    }
  });
}

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _dayDiff(from, to) {
  if (!from || !to) return '—';
  const d = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  return d > 0 ? d : 1;
}
