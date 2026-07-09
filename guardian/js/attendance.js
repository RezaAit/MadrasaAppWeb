import { getAttendanceHistory, getAttendanceFullHistory, getExamResults, getExamRoutine } from './api.js';
import { showToast } from './dashboard.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';

// ── Attendance ─────────────────────────────────────────────────────────────
export async function loadAttendance(container, child) {
  container.innerHTML = _attendanceSkeleton();

  const [res, historyRes] = await Promise.all([
    getAttendanceHistory(child.studentIID),
    getAttendanceFullHistory(child.studentIID),
  ]);
  const data = res.results || {};
  const days = data.days || [];
  const totalPresent = data.totalPresent ?? 0;
  const totalAbsent  = data.totalAbsent  ?? 0;
  const totalLeave   = data.totalLeave   ?? 0;
  const schoolDays   = days.filter(d => d.dayType === 'R');
  const totalSchool  = schoolDays.length;

  const now = new Date();
  const todayDay = now.getDate();
  const todayEntry = days.find(d => d.day === todayDay);
  const todayStatus = todayEntry
    ? (todayEntry.dayType !== 'R' ? 'Holiday' : todayEntry.isPresent ? 'Present' : todayEntry.isLeave ? 'Leave' : 'Absent')
    : (days.length > 0 ? 'Absent' : 'Unknown');

  const monthNames = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const pct = totalSchool ? Math.round(totalPresent / totalSchool * 100) : 0;

  // Year > Month > Week, built from the full-history API response
  const years = (historyRes.results || {}).years || (historyRes.results || {}).Years || [];
  const yearGroups = _buildYearGroups(years);

  container.innerHTML = `
    <div class="p-16">

      <!-- Summary stats -->
      <div class="stat-grid mb-16 stagger-in">
        <div class="stat-card">
          <div class="stat-label">উপস্থিত (${monthLabel})</div>
          <div class="stat-value">${totalPresent}</div>
          <div class="stat-sub">${totalSchool} দিনের মধ্যে</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">উপস্থিতির হার</div>
          <div class="stat-value">${pct}<span style="font-size:1.2rem">%</span></div>
          <div class="stat-sub">অনুপস্থিত ${totalAbsent} · ছুটি ${totalLeave}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card mb-16" style="padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:.82rem;color:var(--text-muted);">উপস্থিতি অগ্রগতি</span>
          <span style="font-size:.82rem;font-weight:700;color:${pct>=75?'#15803D':'#DC2626'}">${pct}%</span>
        </div>
        <div style="height:8px;border-radius:99px;background:#F3F4F6;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${pct>=75?'#22C55E':'#EF4444'};border-radius:99px;transition:width .4s ease;"></div>
        </div>
      </div>

      <!-- Attendance history grouped by week -->
      <div class="section-header">
        <span class="section-title">উপস্থিতির ইতিহাস</span>
      </div>

      ${yearGroups.length === 0
        ? `<div class="empty-state"><div class="empty-icon">${_calIcon()}</div><div class="empty-title">কোনো রেকর্ড নেই</div></div>`
        : yearGroups.map(y => _yearGroup(y, now)).join('')
      }

    </div>
  `;

  // Expand/collapse
  container.querySelectorAll('.year-header').forEach(hdr => {
    attachRipple(hdr);
    const body = hdr.nextElementSibling;
    const chev = hdr.querySelector('.gh-year-chevron');
    hdr.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      chev?.classList.toggle('open', !isOpen);
      hdr.classList.toggle('gh-closed', isOpen);
    });
  });
  container.querySelectorAll('.month-header').forEach(hdr => {
    attachRipple(hdr);
    const body = hdr.nextElementSibling;
    const chev = hdr.querySelector('.gh-month-chevron');
    hdr.addEventListener('click', () => {
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      chev?.classList.toggle('open', !isOpen);
    });
  });
  container.querySelectorAll('.week-header').forEach(hdr => {
    attachRipple(hdr);
    const body = hdr.nextElementSibling;
    const chev = hdr.querySelector('.week-chevron');
    hdr.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      if (chev) chev.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0)';
    });
  });
}

// ── Smooth collapsible (Android-style expand/collapse) ──────────────────────
function _prepCollapsible(body) {
  const startOpen = body.style.display !== 'none';
  body.style.display = '';
  body.style.overflow = 'hidden';
  body.style.display = 'grid';
  body.style.gridTemplateRows = startOpen ? '1fr' : '0fr';
  body.style.transition = 'grid-template-rows .28s cubic-bezier(.4,0,.2,1)';
  body.classList.toggle('is-open', startOpen);
  // Wrap children in an inner div so grid-rows collapse can clip them (min-height:0 trick)
  if (!body.firstElementChild || !body.firstElementChild.classList?.contains('collapsible-inner')) {
    const inner = document.createElement('div');
    inner.className = 'collapsible-inner';
    inner.style.minHeight = '0';
    while (body.firstChild) inner.appendChild(body.firstChild);
    body.appendChild(inner);
  }
}

function _toggleCollapsible(body, open) {
  body.style.gridTemplateRows = open ? '1fr' : '0fr';
  body.classList.toggle('is-open', open);
}

function _attendanceSkeleton() {
  const shimmer = `background:linear-gradient(90deg,#EEF1F4 25%,#E2E6EA 37%,#EEF1F4 63%);background-size:400% 100%;animation:skeleton-shimmer 1.4s ease infinite;`;
  const bar = (w, h, r = 8) => `<div style="width:${w};height:${h};border-radius:${r}px;${shimmer}"></div>`;
  return `
    <style>
      @keyframes skeleton-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
    </style>
    <div class="p-16">
      <div class="card mb-16 text-center" style="padding:20px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;">
        ${bar('120px', '12px')}
        ${bar('100px', '26px', 20)}
      </div>
      <div class="stat-grid mb-16" style="display:flex;gap:12px;">
        <div class="stat-card" style="flex:1;display:flex;flex-direction:column;gap:8px;">${bar('70%', '10px')}${bar('40%', '22px')}${bar('60%', '9px')}</div>
        <div class="stat-card" style="flex:1;display:flex;flex-direction:column;gap:8px;">${bar('70%', '10px')}${bar('40%', '22px')}${bar('60%', '9px')}</div>
      </div>
      <div class="card mb-16" style="padding:14px 16px;">${bar('100%', '8px', 99)}</div>
      <div class="mb-16">${bar('100%', '44px', 10)}</div>
      <div class="card mb-12" style="padding:14px;display:flex;flex-direction:column;gap:10px;">
        ${bar('40%', '14px')}
        ${bar('100%', '38px', 10)}
        ${bar('100%', '38px', 10)}
        ${bar('100%', '38px', 10)}
      </div>
    </div>
  `;
}

// ── Grouping: Year > Month > Week ───────────────────────────────────────────
// historyRes.results.years = [{ year, months: [{ year, month, totalPresent, totalLeave, totalAbsent, days:[{day,dayType,isPresent,isLeave}] }] }]
const MONTH_BN    = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const MONTH_SHORT = ['জান','ফেব','মার্চ','এপ্রি','মে','জুন','জুলা','আগ','সেপ','অক্টো','নভে','ডিসে'];

function _buildYearGroups(years) {
  return years.map(y => {
    const year = y.year ?? y.Year;
    const monthsRaw = y.months ?? y.Months ?? [];
    const months = monthsRaw.map(m => {
      const monthNum = (m.month ?? m.Month); // 1-based
      const daysRaw = m.days ?? m.Days ?? [];
      const schoolDays = daysRaw
        .filter(d => (d.dayType ?? d.DayType) === 'R')
        .map(d => ({
          day:       d.day ?? d.Day,
          isPresent: d.isPresent ?? d.IsPresent ?? false,
          isLeave:   d.isLeave ?? d.IsLeave ?? false,
        }))
        .sort((a, b) => b.day - a.day); // newest day first

      const weekMap = new Map();
      schoolDays.forEach(d => {
        const weekOfMonth = Math.ceil(d.day / 7);
        const wKey = `সপ্তাহ ${weekOfMonth}`;
        if (!weekMap.has(wKey)) weekMap.set(wKey, { label: wKey, days: [] });
        weekMap.get(wKey).days.push(d);
      });

      return {
        monthNum,
        year,
        label: `${MONTH_BN[monthNum - 1]} ${year}`,
        totalPresent: m.totalPresent ?? m.TotalPresent ?? 0,
        totalAbsent:  m.totalAbsent  ?? m.TotalAbsent  ?? 0,
        totalLeave:   m.totalLeave   ?? m.TotalLeave   ?? 0,
        weeks: [...weekMap.values()],
      };
    }).sort((a, b) => b.monthNum - a.monthNum); // newest month first

    return { year, months };
  }).sort((a, b) => b.year - a.year); // newest year first
}

function _yearGroup(yearData, now) {
  const totalPresent  = yearData.months.reduce((s, m) => s + m.totalPresent, 0);
  const totalAbsent   = yearData.months.reduce((s, m) => s + m.totalAbsent, 0);
  const isCurrentYear = yearData.year === now.getFullYear();
  const monthRows     = yearData.months.map(m => _monthGroup(m, now, isCurrentYear)).join('');

  return `
    <div class="gh-year-group">
      <div class="gh-year-header year-header${isCurrentYear ? '' : ' gh-closed'}">
        <span class="gh-year-title">${yearData.year} সাল</span>
        <div class="gh-year-right">
          <span class="gh-year-meta">✓ ${totalPresent} &nbsp; ✗ ${totalAbsent}</span>
          <svg class="gh-year-chevron year-chevron${isCurrentYear ? ' open' : ''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="gh-year-body year-body"${isCurrentYear ? '' : ' style="display:none;"'}>
        ${monthRows}
      </div>
    </div>
  `;
}

function _monthGroup(month, now, isCurrentYear) {
  const isCurrentMonth = isCurrentYear && month.monthNum === (now.getMonth() + 1);
  const weekRows = month.weeks.map(w => _weekGroup(w, month.monthNum, month.year, now, isCurrentMonth)).join('');
  const subParts = [
    month.totalPresent ? `✓ ${month.totalPresent}` : '',
    month.totalAbsent  ? `✗ ${month.totalAbsent}`  : '',
    month.totalLeave   ? `📋 ${month.totalLeave}`  : '',
  ].filter(Boolean).join(' · ');

  return `
    <div>
      <div class="gh-month-header month-header">
        <div class="gh-month-left" style="flex-direction:row;align-items:center;gap:6px;">
          <span class="gh-month-name">${month.label}</span>
          ${subParts ? `<span class="gh-month-sub" style="margin-top:0;">${subParts}</span>` : ''}
        </div>
        <svg class="gh-month-chevron month-chevron${isCurrentMonth ? ' open' : ''}" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="gh-month-body month-body${isCurrentMonth ? ' open' : ''}">
        ${weekRows}
      </div>
    </div>
  `;
}

function _weekGroup(week, monthNum, year, now, isCurrentMonth) {
  const currentWeekOfMonth = Math.ceil(now.getDate() / 7);
  const isCurrentWeek = isCurrentMonth && week.label === `সপ্তাহ ${currentWeekOfMonth}`;
  const days = week.days; // already sorted newest first
  const presentCount = days.filter(d => d.isPresent).length;
  const absentCount  = days.filter(d => !d.isPresent && !d.isLeave).length;
  const leaveCount   = days.filter(d => d.isLeave).length;

  const dots = days.map(d => {
    const color = d.isPresent ? '#22C55E' : d.isLeave ? '#F59E0B' : '#EF4444';
    return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};"></span>`;
  }).join('');

  const rows = days.map(d => {
    const status = d.isPresent ? 'Present' : d.isLeave ? 'Leave' : 'Absent';
    const mn = MONTH_SHORT[monthNum - 1];
    const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
    return `
      <div class="att-history-item fade-in">
        <div class="att-date-chip">${d.day} ${mn}</div>
        <div style="flex:1;font-size:.85rem;color:var(--text-muted);">${_dayName(dateStr)}</div>
        <span class="badge badge-${status === 'Present' ? 'present' : status === 'Absent' ? 'absent' : 'leave'}" style="font-size:.72rem;">
          ${_statusLabel(status)}
        </span>
      </div>`;
  }).join('');

  return `
    <div style="border-bottom:1px solid var(--border);">
      <div class="week-header card-clickable" style="display:flex;align-items:center;gap:8px;padding:9px 14px 9px 30px;cursor:pointer;background:#FAFBFF;position:relative;overflow:hidden;transition:transform .12s ease;border-left:2px solid #C7D9EC;">
        <div style="flex:1;position:relative;z-index:1;">
          <div style="font-size:.75rem;font-weight:600;color:#4B5C73;">${week.label}</div>
          <div style="display:flex;gap:3px;align-items:center;margin-top:3px;">${dots}</div>
        </div>
        <div style="font-size:.7rem;color:var(--text-muted);display:flex;gap:6px;position:relative;z-index:1;">
          ${presentCount ? `<span style="color:#15803D;font-weight:600;">✓${presentCount}</span>` : ''}
          ${absentCount  ? `<span style="color:#DC2626;font-weight:600;">✗${absentCount}</span>` : ''}
          ${leaveCount   ? `<span style="color:#D97706;font-weight:600;">📋${leaveCount}</span>` : ''}
        </div>
        <svg class="week-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#9CA3AF" stroke-width="2" style="transition:transform .2s;flex-shrink:0;position:relative;z-index:1;${isCurrentWeek ? '' : 'transform:rotate(-90deg);'}"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="week-body" style="${isCurrentWeek ? '' : 'display:none;'}">
        ${rows}
      </div>
    </div>
  `;
}

// ── Exam ───────────────────────────────────────────────────────────────────
export async function loadExam(container, child) {
  const [resR, resRt] = await Promise.all([getExamResults(child.studentIID), getExamRoutine(child.studentIID)]);

  const raw = resR.results || resR;
  const grandResults   = raw.grandResult   || [];
  const subjectResults = raw.mainExamResult || [];
  const routine = resRt.results || [];

  if (!grandResults.length && !subjectResults.length) {
    container.innerHTML = `
      <div class="p-16">
        <div class="empty-state"><div class="empty-title">কোনো পরীক্ষার ফলাফল নেই</div></div>
        ${_routineSection(routine)}
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="p-16">
      ${grandResults.length > 1 ? `
        <div class="tabs mb-16" id="exam-tabs">
          ${grandResults.map((g, i) => `<button class="tab-btn ${i===0?'active':''}" data-idx="${i}">${g.ExamName}</button>`).join('')}
        </div>` : ''}

      <div id="exam-result-body">
        ${_examBody(grandResults[0] || null, subjectResults)}
      </div>

      <div class="section-header mt-16"><span class="section-title">পরীক্ষার সময়সূচি</span></div>
      ${_routineSection(routine)}
    </div>
  `;

  if (grandResults.length > 1) {
    attachRippleAll('#exam-tabs .tab-btn', container);
    container.querySelectorAll('#exam-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#exam-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('exam-result-body').innerHTML = _examBody(grandResults[parseInt(btn.dataset.idx)], subjectResults);
      });
    });
  }
}

function _examBody(grand, subjects) {
  const gpa = grand?.GPA ?? '—';
  const examName = grand?.ExamName || '';
  const promotion = grand?.Promotion || '';
  const statusColor = promotion === 'Promoted' ? '#22C55E' : promotion === 'Failed' ? '#EF4444' : '#F59E0B';

  return `
    <div class="card mb-16" style="padding:24px;text-align:center;">
      ${examName ? `<div style="font-size:.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${examName}</div>` : ''}
      <div class="result-gpa">${gpa}</div>
      <div style="font-size:.78rem;color:var(--text-light);margin-top:4px;">GPA</div>
      ${promotion ? `<div style="margin-top:12px;display:inline-block;padding:4px 16px;border-radius:20px;background:${statusColor}18;color:${statusColor};font-size:.82rem;font-weight:700;">${_promotionLabel(promotion)}</div>` : ''}
    </div>

    ${subjects.length ? `
      <div class="section-header"><span class="section-title">বিষয়ভিত্তিক ফলাফল</span></div>
      <div class="card mb-16" style="padding:0;overflow:hidden;">
        <table class="data-table">
          <thead><tr><th>বিষয়</th><th>প্রাপ্ত</th><th>পূর্ণ</th><th>গ্রেড</th></tr></thead>
          <tbody>
            ${subjects.map(r => `
              <tr class="fade-in">
                <td>${r.SubjectName || r.subject || '—'}</td>
                <td><strong>${r.ObtainMark ?? r.obtained ?? '—'}</strong></td>
                <td class="text-muted">${r.TotalMark ?? r.fullMarks ?? '—'}</td>
                <td><span class="grade-chip ${_gradeClass(r.LetterGrade || r.grade)}">${r.LetterGrade || r.grade || '—'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : ''}
  `;
}

function _routineSection(routine) {
  if (!routine.length) return `<div class="empty-state"><div class="empty-title">কোনো পরীক্ষা নির্ধারিত নেই</div></div>`;
  return `<div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr><th>তারিখ</th><th>বিষয়</th><th>সময়</th></tr></thead>
      <tbody>
        ${routine.map(r => `
          <tr class="fade-in">
            <td><strong>${_formatDate(r.date || r.Date)}</strong><br><small class="text-muted">${r.day || r.Day || ''}</small></td>
            <td>${r.subject || r.SubjectName || '—'}</td>
            <td style="font-size:.8rem">${r.time || r.Time || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function _gradeClass(grade) {
  if (!grade) return '';
  if (grade === 'A+') return 'A\\+';
  if (grade === 'C' || grade === 'D') return grade;
  if (grade === 'F') return 'F';
  return '';
}

function _promotionLabel(p) {
  return { Promoted: '✓ উত্তীর্ণ', Failed: '✗ অনুত্তীর্ণ', Detained: '⚠ বিরত' }[p] || p;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}

function _dayName(dateStr) {
  const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  return days[new Date(dateStr).getDay()];
}

function _statusLabel(s) {
  return { Present: '✓ উপস্থিত', Absent: '✗ অনুপস্থিত', Late: '⏰ দেরি', Leave: '📋 ছুটি' }[s] || s;
}

function _calIcon() {
  return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}
