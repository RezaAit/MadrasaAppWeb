import { getMySections, getClassStudents, saveAttendance, getTodayAttendance, getMonthlySummary } from './api.js';
import { showToast, _mountFAB } from './dashboard.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';

export async function loadAttendanceModule(container, teacher) {
  container.innerHTML = `
    <div class="p-16">
      <h2 class="fw-700 mb-16" style="font-size:1rem;">উপস্থিতি</h2>
      <div class="form-group mb-16">
        <label class="form-label">শ্রেণি ও সেকশন</label>
        <select class="form-select" id="att-section">
          <option value="">লোড হচ্ছে...</option>
        </select>
      </div>
      <div class="att-tabs mb-16" id="att-tabs" style="display:none;">
        <button class="att-tab active" data-tab="today">আজকের উপস্থিতি</button>
        <button class="att-tab" data-tab="calendar">মাসিক ক্যালেন্ডার</button>
      </div>
      <div id="students-list-wrap"></div>
    </div>
  `;

  const sectionSelect = document.getElementById('att-section');
  const res = await getMySections();
  const sections = res.results?.classTeacherSections || [];

  if (!sections.length) {
    sectionSelect.innerHTML = `<option value="">আপনি কোনো শ্রেণির শ্রেণি শিক্ষক নন</option>`;
    return;
  }

  sectionSelect.innerHTML = `
    <option value="">বেছে নিন</option>
    ${sections.map(s => `<option value="${s.sectionId}">${s.className} - ${s.sectionName}</option>`).join('')}
  `;

  let currentTab = 'today';
  let currentSectionId = null;

  // Tab switching
  document.getElementById('att-tabs').querySelectorAll('.att-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.att-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentSectionId) {
        if (currentTab === 'today') renderStudentList(currentSectionId);
        else renderCalendar(currentSectionId);
      }
    });
  });

  sectionSelect.addEventListener('change', async () => {
    currentSectionId = sectionSelect.value || null;
    if (!currentSectionId) { document.getElementById('students-list-wrap').innerHTML = ''; document.getElementById('att-tabs').style.display = 'none'; return; }
    document.getElementById('att-tabs').style.display = 'flex';
    if (currentTab === 'today') renderStudentList(currentSectionId);
    else renderCalendar(currentSectionId);
  });
}

// ── Today / date attendance ───────────────────────────────────────────────────

async function renderStudentList(sectionId, dateStr = null) {
  const wrap = document.getElementById('students-list-wrap');
  wrap.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;

  const [studentsRes, todayRes] = await Promise.all([
    getClassStudents(sectionId),
    getTodayAttendance(sectionId, dateStr),
  ]);
  const students = studentsRes.results || [];
  if (!students.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-title">কোনো শিক্ষার্থী নেই</div></div>`; return; }

  const savedToday = {};
  (todayRes.results || []).forEach(r => { savedToday[String(r.studentIID)] = r.status; });
  const alreadySaved = Object.keys(savedToday).length > 0;

  const today = dateStr ? new Date(dateStr) : new Date();
  const isFuture = today > new Date();
  const attState = {};
  students.forEach(s => {
    const sid = String(s.studentIID ?? s.StudentIID);
    attState[sid] = savedToday[sid] || 'Present';
  });

  const dateLabel = today.toLocaleDateString('bn-BD');

  wrap.innerHTML = `
    <div class="mb-12 fade-in" style="display:flex;align-items:center;justify-content:space-between;padding:0 2px;">
      <div style="font-size:.82rem;font-weight:700;color:#64748b;">
        <span style="color:#1e293b;font-size:1rem;">${students.length}</span> জন শিক্ষার্থী
      </div>
      <div style="font-size:.8rem;font-weight:600;color:#94a3b8;background:#fff;padding:4px 10px;border-radius:20px;box-shadow:0 1px 3px rgba(0,0,0,.07);">
        ${dateLabel}
      </div>
    </div>
    <div class="att-list-wrap mb-16 fade-in" id="att-rows"></div>
    ${isFuture ? '' : '<div style="height:80px;"></div>'}
  `;

  const rowsEl = document.getElementById('att-rows');
  rowsEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  students.forEach(s => {
    const id = s.studentIID ?? s.StudentIID;
    const sid = String(id);
    const roll = s.rollNo ?? s.RollNo;
    const name = s.fullName ?? s.FullName;
    const currentStatus = attState[sid];
    const row = document.createElement('div');
    row.className = `att-row fade-in status-${currentStatus.toLowerCase()}`;
    row.innerHTML = `
      <div class="att-roll">${roll}</div>
      <div class="att-name">${name}</div>
      <div class="att-btns">
        <button class="att-btn ${currentStatus==='Present'?'active-present':''}" data-status="Present" data-id="${id}" title="উপস্থিত">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Absent'?'active-absent':''}" data-status="Absent" data-id="${id}" title="অনুপস্থিত">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Leave'?'active-leave':''}" data-status="Leave" data-id="${id}" title="ছুটি">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Late'?'active-late':''}" data-status="Late" data-id="${id}" title="দেরি">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
      </div>
    `;

    if (!isFuture) {
      row.querySelectorAll('.att-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.dataset.id;
          const status = btn.dataset.status;
          attState[sid] = status;
          row.className = `att-row status-${status.toLowerCase()}`;
          row.querySelectorAll('.att-btn').forEach(b => { b.className = 'att-btn'; });
          btn.className = `att-btn active-${status.toLowerCase()}`;
          btn.style.transform = 'scale(1.2)';
          setTimeout(() => btn.style.transform = '', 120);
        });
      });
    }
    rowsEl.appendChild(row);
  });

  if (!isFuture) {
    const saveIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    const saveBtn = _mountFAB(`${saveIcon} ${alreadySaved ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}`);
    saveBtn.addEventListener('click', async () => {
      const payload = Object.entries(attState).map(([sid, status]) => ({
        studentIID: Number(sid),
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
        isPresent: status === 'Present' || status === 'Late',
        status,
      }));
      saveBtn.disabled = true; saveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
      const res = await saveAttendance(payload);
      showToast(res.HasError ? (res.message || 'ত্রুটি হয়েছে') : 'উপস্থিতি সংরক্ষণ হয়েছে ✓', res.HasError ? 'error' : 'success');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${saveIcon} আপডেট করুন`;
    });
  }
}

// ── Monthly calendar ──────────────────────────────────────────────────────────

async function renderCalendar(sectionId) {
  const wrap = document.getElementById('students-list-wrap');
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  async function draw() {
    wrap.innerHTML = `<div class="skeleton skeleton-card" style="height:280px;"></div>`;
    const res = await getMonthlySummary(sectionId, year, month);
    const { totalStudents = 0, days = [] } = res.results || {};
    const dayMap = {};
    days.forEach(d => { dayMap[d.day] = d; });

    const monthNames = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayMap[d];
      const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
      const isFuture = new Date(year, month - 1, d) > today;
      let bg = '#f8fafc', color = '#94a3b8', dot = '';
      if (info) {
        const pct = totalStudents ? info.presentCount / totalStudents : 1;
        if (pct >= 1)        { bg = '#dcfce7'; color = '#16a34a'; }
        else if (pct >= 0.8) { bg = '#fef9c3'; color = '#ca8a04'; }
        else                  { bg = '#fee2e2'; color = '#dc2626'; }
      }
      const todayRing = isToday ? 'box-shadow:0 0 0 2px #047857;' : '';
      const opacity = isFuture ? 'opacity:.35;' : '';
      const badge = info
        ? info.absentCount > 0
          ? `<div style="font-size:.62rem;font-weight:800;margin-top:1px;">${info.absentCount} অনুপ.</div>`
          : `<div style="font-size:.75rem;margin-top:1px;">✓</div>`
        : '';
      cells += `
        <div class="cal-day ${isFuture?'':'clickable'}" data-day="${d}" style="background:${bg};color:${color};${todayRing}${opacity}">
          <span style="font-size:.82rem;font-weight:700;">${d}</span>
          ${badge}
        </div>`;
    }

    wrap.innerHTML = `
      <div class="cal-card fade-in">
        <div class="cal-header">
          <button class="cal-nav" id="cal-prev">‹</button>
          <span class="cal-title">${monthNames[month-1]} ${year}</span>
          <button class="cal-nav" id="cal-next" ${year===today.getFullYear()&&month===today.getMonth()+1?'disabled':''}>›</button>
        </div>
        <div class="cal-weekdays">
          <div>রবি</div><div>সোম</div><div>মঙ্গল</div><div>বুধ</div><div>বৃহ</div><div>শুক্র</div><div>শনি</div>
        </div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-summary">
          <div class="cal-summary-item">
            <div class="cal-summary-val">${days.length}</div>
            <div class="cal-summary-lbl">দিন নেওয়া হয়েছে</div>
          </div>
          <div class="cal-summary-divider"></div>
          <div class="cal-summary-item">
            <div class="cal-summary-val" style="color:#dc2626;">${days.reduce((a,d)=>a+d.absentCount,0)}</div>
            <div class="cal-summary-lbl">মোট অনুপস্থিত</div>
          </div>
          <div class="cal-summary-divider"></div>
          <div class="cal-summary-item">
            <div class="cal-summary-val" style="color:#145c44;">${totalStudents}</div>
            <div class="cal-summary-lbl">মোট শিক্ষার্থী</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => {
      month--; if (month < 1) { month = 12; year--; } draw();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      month++; if (month > 12) { month = 1; year++; } draw();
    });

    wrap.querySelectorAll('.cal-day.clickable').forEach(cell => {
      cell.addEventListener('click', () => {
        const d = cell.dataset.day;
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        _openDaySheet(sectionId, dateStr, totalStudents);
      });
    });
  }

  draw();
}

async function _openDaySheet(sectionId, dateStr, totalStudents) {
  const { overlay, sheet, body, open, close } = createBottomSheet({ title: dateStr });
  body.innerHTML = `<div class="skeleton skeleton-card"></div>`;
  open();

  const [studentsRes, attRes] = await Promise.all([
    getClassStudents(sectionId),
    getTodayAttendance(sectionId, dateStr),
  ]);
  const students = studentsRes.results || [];
  const savedMap = {};
  (attRes.results || []).forEach(r => { savedMap[String(r.studentIID)] = r.status; });

  const attState = {};
  students.forEach(s => { attState[String(s.studentIID ?? s.StudentIID)] = savedMap[String(s.studentIID ?? s.StudentIID)] || 'Present'; });

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:80px;" id="sheet-rows"></div>
    <div style="height:80px;"></div>
  `;

  const rowsEl = body.querySelector('#sheet-rows');
  students.forEach(s => {
    const id = s.studentIID ?? s.StudentIID;
    const sid = String(id);
    const currentStatus = attState[sid];
    const row = document.createElement('div');
    row.className = `att-row status-${currentStatus.toLowerCase()}`;
    row.innerHTML = `
      <div class="att-roll">${s.rollNo ?? s.RollNo}</div>
      <div class="att-name">${s.fullName ?? s.FullName}</div>
      <div class="att-btns">
        <button class="att-btn ${currentStatus==='Present'?'active-present':''}" data-status="Present" data-id="${id}" title="উপস্থিত">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Absent'?'active-absent':''}" data-status="Absent" data-id="${id}" title="অনুপস্থিত">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Leave'?'active-leave':''}" data-status="Leave" data-id="${id}" title="ছুটি">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
        <button class="att-btn ${currentStatus==='Late'?'active-late':''}" data-status="Late" data-id="${id}" title="দেরি">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
      </div>
    `;
    row.querySelectorAll('.att-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.id; const status = btn.dataset.status;
        attState[sid] = status;
        row.className = `att-row status-${status.toLowerCase()}`;
        row.querySelectorAll('.att-btn').forEach(b => { b.className = 'att-btn'; });
        btn.className = `att-btn active-${status.toLowerCase()}`;
      });
    });
    rowsEl.appendChild(row);
  });

  const sheetSaveIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  const sheetSaveBtn = _mountFAB(`${sheetSaveIcon} সংরক্ষণ করুন`);
  sheetSaveBtn.addEventListener('click', async () => {
    const date = new Date(dateStr);
    const payload = Object.entries(attState).map(([sid, status]) => ({
      studentIID: Number(sid),
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
      isPresent: status === 'Present' || status === 'Late', status,
    }));
    sheetSaveBtn.disabled = true; sheetSaveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
    const res = await saveAttendance(payload);
    showToast(res.HasError ? (res.message || 'ত্রুটি') : 'আপডেট হয়েছে ✓', res.HasError ? 'error' : 'success');
    if (!res.HasError) { sheetSaveBtn.remove(); close(); }
    else { sheetSaveBtn.disabled = false; sheetSaveBtn.innerHTML = `${sheetSaveIcon} সংরক্ষণ করুন`; }
  });
}
