import { getClassFeesSummary, getStudentDueList, sendFeeReminder } from './api.js';
import { showToast, _mountFAB } from './dashboard.js';

export async function loadFeesModule(container, teacher) {
  const res = await getClassFeesSummary();
  const classes = res.results || [];

  container.innerHTML = `
    <div class="p-16">
      <h2 class="fw-700 mb-16" style="font-size:1rem;">ফি বকেয়া সারসংক্ষেপ</h2>
      <div id="fees-class-list" class="stagger-in"></div>
      <div id="fees-students-wrap" class="hidden mt-16"></div>
    </div>
  `;

  const classListEl = document.getElementById('fees-class-list');
  if (!classes.length) {
    classListEl.innerHTML = `<div class="empty-state"><div class="empty-title">আপনি কোনো শ্রেণির শ্রেণি শিক্ষক নন</div></div>`;
    return;
  }
  classes.forEach(cls => {
    const pct = cls.totalStudents ? Math.round(cls.dueStudents / cls.totalStudents * 100) : 0;
    const card = document.createElement('div');
    card.className = 'fees-class-card fade-in';
    card.innerHTML = `
      <div class="flex-between mb-6">
        <div class="fw-700" style="font-size:.93rem;">${cls.className} - ${cls.sectionName}</div>
        <div style="font-size:.9rem;font-weight:800;color:var(--red-600);">৳${cls.totalDue.toLocaleString()}</div>
      </div>
      <div style="font-size:.8rem;color:var(--text-muted);">${cls.dueStudents} / ${cls.totalStudents} শিক্ষার্থী বকেয়া</div>
      <div class="fees-bar"><div class="fees-bar-fill" style="width:${pct}%;"></div></div>
    `;
    card.addEventListener('click', () => loadStudentDue(cls));
    classListEl.appendChild(card);
  });
}

async function loadStudentDue(cls) {
  const wrap = document.getElementById('fees-students-wrap');
  wrap.classList.remove('hidden');
  wrap.innerHTML = `<div class="skeleton skeleton-card"></div>`;

  const res = await getStudentDueList(cls.sectionId);
  const students = res.results || [];
  const selected = new Set();

  wrap.innerHTML = `
    <div class="section-header">
      <span class="section-title">${cls.className} - ${cls.sectionName} — বকেয়া তালিকা</span>
    </div>
    <div class="card mb-12" style="padding:0;overflow:hidden;">
      <div style="padding:10px 14px;background:var(--cream-100);border-bottom:1px solid var(--border);">
        <label class="custom-check">
          <input type="checkbox" id="select-all-fees">
          <span class="checkmark"></span>
          <span style="font-size:.8rem;font-weight:600;color:var(--text-muted);">সব নির্বাচন করুন</span>
        </label>
      </div>
      <div id="due-student-rows"></div>
      <div style="height:80px;"></div>
    </div>
  `;

  const rowsEl = document.getElementById('due-student-rows');

  // Mount FAB on body so it's never clipped by overflow containers
  const reminderBtn = _mountFAB(`
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1 19.79 19.79 0 0 1 1.61 4.5 2 2 0 0 1 3.59 2.33h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l1.09-1.09a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.91 17z"/></svg>
    SMS রিমাইন্ডার <span class="ext-fab-badge" id="fab-count">0</span>
  `);

  function updateBtn() {
    document.getElementById('fab-count').textContent = selected.size;
    reminderBtn.disabled = selected.size === 0;
  }

  students.forEach(s => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);';
    row.innerHTML = `
      <label class="custom-check" style="flex-shrink:0;">
        <input type="checkbox" class="student-check" data-id="${s.studentIID}">
        <span class="checkmark"></span>
      </label>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:.9rem;">${s.fullName}</div>
        <div style="font-size:.78rem;color:var(--text-muted);">রোল ${s.rollNo}</div>
      </div>
      <div style="font-weight:800;color:var(--red-600);font-size:1rem;">৳${s.dueAmount.toLocaleString()}</div>
    `;
    const cb = row.querySelector('.student-check');
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(s.studentIID);
      else selected.delete(s.studentIID);
      updateBtn();
    });
    rowsEl.appendChild(row);
  });

  document.getElementById('select-all-fees').addEventListener('change', e => {
    rowsEl.querySelectorAll('.student-check').forEach(cb => {
      cb.checked = e.target.checked;
      const id = parseInt(cb.dataset.id);
      if (e.target.checked) selected.add(id);
      else selected.delete(id);
    });
    updateBtn();
  });

  reminderBtn.addEventListener('click', async () => {
    if (!selected.size) { showToast('কোনো শিক্ষার্থী নির্বাচন করুন', 'error'); return; }
    reminderBtn.disabled = true;
    const res = await sendFeeReminder(Array.from(selected));
    showToast(res.message || `${selected.size}টি SMS পাঠানো হয়েছে`, 'success');
    reminderBtn.disabled = false;
  });
}
