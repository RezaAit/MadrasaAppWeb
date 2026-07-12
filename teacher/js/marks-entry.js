import { getMySections, getMainExams, getSubExams, getDividedExams, getMarksEntry, saveMarks, saveMarkOne } from './api.js';
import { showToast, _mountFAB } from './dashboard.js';

export async function loadMarksModule(container, teacher) {
  container.innerHTML = `
    <style>
      /* ── Indigo palette ── */
      :root {
        --in-primary:   #4338ca;   /* indigo-700 */
        --in-primary-d: #3730a3;   /* indigo-800 */
        --in-accent:    #6366f1;   /* indigo-500 */
        --in-surface:   #f8fafc;   /* slate-50   */
        --in-card:      #ffffff;
        --in-border:    #e2e8f0;   /* slate-200  */
        --in-muted:     #94a3b8;   /* slate-400  */
        --in-text:      #0f172a;   /* slate-900  */
        --in-text2:     #475569;   /* slate-600  */
        --in-red:       #ef4444;
        --in-red-bg:    #fef2f2;
        --in-green:     #16a34a;
        --in-green-bg:  #f0fdf4;
        --in-amber:     #d97706;
        --in-amber-bg:  #fffbeb;
      }

      .me-page { padding: 0; background: var(--in-surface); min-height: 100vh; font-family: inherit; }

      /* ── App bar ── */
      .me-appbar {
        background: linear-gradient(135deg, #012a09, #145c44);
        margin:10px;
        border-radius:16px;
        color: #fff;
        padding: 0 8px 0 16px;
        height: 56px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 2px 8px rgba(67,56,202,.35);
      }
      .me-appbar-icon { opacity: .85; flex-shrink: 0; }
      .me-appbar-title {
        flex: 1;
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: .01em;
        line-height: 1;
      }
      .me-appbar-sub {
        font-size: .68rem;
        font-weight: 400;
        opacity: .75;
        display: block;
        margin-top: 2px;
        letter-spacing: .02em;
      }
      .me-load-icon-btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        border: none;
        background: rgba(255,255,255,0.18);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background .15s, transform .1s;
        padding: 0;
        backdrop-filter: blur(4px);
      }
      .me-load-icon-btn:active { background: rgba(255,255,255,0.32); transform: scale(.93); }
      .me-load-icon-btn:disabled { opacity: 0.35; cursor: default; }

      /* ── Filter card ── */
      .me-filter {
        background: var(--in-card);
        margin: 12px 12px 0;
        border-radius: 16px;
        padding: 14px 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 4px 16px rgba(67,56,202,.06);
        border: 1px solid var(--in-border);
      }

      /* Outlined select — indigo flavour */
      .me-field { position: relative; }
      .me-field label {
        position: absolute;
        top: -8px; left: 10px;
        font-size: .68rem;
        font-weight: 700;
        color: var(--in-primary);
        background: var(--in-card);
        padding: 0 4px;
        pointer-events: none;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .me-field select {
        width: 100%;
        padding: 11px 12px 10px;
        font-size: .875rem;
        border: 1.5px solid #c7d2fe;
        border-radius: 10px;
        background: var(--in-card);
        color: var(--in-text);
        appearance: auto;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .me-field select:focus {
        border-color: var(--in-accent);
        box-shadow: 0 0 0 3px rgba(99,102,241,.12);
      }
      .me-field select:disabled {
        border-color: var(--in-border);
        color: var(--in-muted);
        background: var(--in-surface);
      }

      /* ── Stats bar ── */
      .me-stats-bar {
        display: flex;
        gap: 0;
        margin: 12px 12px 4px;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid var(--in-border);
        background: var(--in-card);
        box-shadow: 0 1px 3px rgba(0,0,0,.05);
      }
      .me-stat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 4px 9px;
        gap: 2px;
        border-right: 1px solid var(--in-border);
      }
      .me-stat:last-child { border-right: none; }
      .me-stat-val {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--in-primary);
        line-height: 1;
      }
      .me-stat-val.red   { color: var(--in-red); }
      .me-stat-val.green { color: var(--in-green); }
      .me-stat-label {
        font-size: .62rem;
        font-weight: 600;
        color: var(--in-muted);
        text-transform: uppercase;
        letter-spacing: .05em;
      }

      /* ── Student list ── */
      .me-list { padding: 8px 0 100px; }

      .me-student-card {
        display: flex;
        align-items: center;
        background: var(--in-card);
        margin: 0 12px 6px;
        border-radius: 14px;
        padding: 11px 10px 11px 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,.05);
        gap: 10px;
        border: 1px solid transparent;
        transition: border-color .15s, box-shadow .15s;
      }
      .me-student-card:has(.me-marks-input:focus) {
        border-color: #c7d2fe;
        box-shadow: 0 0 0 2px rgba(99,102,241,.1);
      }
      .me-student-card.absent-row {
        background: var(--in-red-bg);
        border-color: #fecaca;
      }

      /* Roll badge */
      .me-roll {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: #eef2ff;
        color: var(--in-primary);
        font-size: .75rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        letter-spacing: -.02em;
      }
      .absent-row .me-roll { background: #fee2e2; color: var(--in-red); }

      .me-name {
        flex: 1;
        font-size: .875rem;
        font-weight: 600;
        color: var(--in-text);
        line-height: 1.25;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .absent-row .me-name {
        color: var(--in-muted);
        font-weight: 500;
        text-decoration: line-through;
        text-decoration-color: #fca5a5;
      }

      /* Marks input */
      .me-input-wrap { position: relative; flex-shrink: 0; }
      .me-marks-input {
        width: 62px;
        padding: 8px 6px;
        font-size: 1rem;
        font-weight: 800;
        text-align: center;
        border: 1.5px solid var(--in-border);
        border-radius: 10px;
        background: #f8fafc;
        color: var(--in-text);
        outline: none;
        transition: border-color .15s, background .15s, box-shadow .15s;
        -moz-appearance: textfield;
      }
      .me-marks-input::-webkit-outer-spin-button,
      .me-marks-input::-webkit-inner-spin-button { -webkit-appearance: none; }
      .me-marks-input:focus {
        border-color: var(--in-accent);
        background: #fff;
        box-shadow: 0 0 0 3px rgba(99,102,241,.15);
      }
      .me-marks-input:disabled {
        background: #f1f5f9;
        color: var(--in-muted);
        border-color: var(--in-border);
      }
      .me-marks-input.saving { opacity: .45; }
      .me-marks-input.saved-flash {
        border-color: #86efac;
        background: var(--in-green-bg);
        box-shadow: 0 0 0 3px rgba(22,163,74,.12);
      }

      /* Absent toggle */
      .me-absent-btn {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1.5px solid var(--in-border);
        background: #f8fafc;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s, border-color .15s, transform .1s;
        flex-shrink: 0;
        padding: 0;
      }
      .absent-row .me-absent-btn {
        background: #fee2e2;
        border-color: #fca5a5;
      }
      .me-absent-btn:active { transform: scale(.9); }
      .me-absent-btn svg { pointer-events: none; }
      .me-absent-chk { display: none; }

      /* Section divider label */
      .me-section-label {
        font-size: .68rem;
        font-weight: 700;
        color: var(--in-muted);
        text-transform: uppercase;
        letter-spacing: .08em;
        padding: 10px 16px 4px;
      }
    </style>

    <div class="me-page">
      <div class="me-appbar">
        <svg class="me-appbar-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span class="me-appbar-title">
          নম্বর এন্ট্রি
          <span class="me-appbar-sub">Marks Entry</span>
        </span>
        <button class="me-load-icon-btn" id="load-marks-btn" title="নম্বর লোড করুন">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>

      <div class="me-filter">
        <div class="me-field">
          <label>ক্লাস · সেকশন · বিষয়</label>
          <select id="marks-section"><option value="">লোড হচ্ছে...</option></select>
        </div>
        <div class="me-field">
          <label>পরীক্ষা</label>
          <select id="marks-exam" disabled><option value="">পরীক্ষা বেছে নিন</option></select>
        </div>
        <div class="me-field" id="sub-exam-wrap" style="display:none;">
          <label>সাব পরীক্ষা</label>
          <select id="marks-sub-exam" disabled><option value="">বেছে নিন</option></select>
        </div>
        <div class="me-field" id="divided-exam-wrap" style="display:none;">
          <label>বিভক্ত পরীক্ষা</label>
          <select id="marks-divided-exam" disabled><option value="">বেছে নিন</option></select>
        </div>
      </div>

      <div id="marks-table-wrap"></div>
    </div>
  `;

  const sectionSelect = document.getElementById('marks-section');
  const examSelect    = document.getElementById('marks-exam');
  const subExamWrap   = document.getElementById('sub-exam-wrap');
  const subExamSelect = document.getElementById('marks-sub-exam');
  const dividedWrap   = document.getElementById('divided-exam-wrap');
  const dividedSelect = document.getElementById('marks-divided-exam');

  const res = await getMySections();
  const sections = (res.results?.subjectSections || []).filter(s => s.subjectId);
  sectionSelect.innerHTML = sections.length
    ? `<option value="">বেছে নিন</option>` + sections.map((s, i) =>
        `<option value="${i}">${s.className} - ${s.sectionName} (${s.subjectName})</option>`).join('')
    : `<option value="">কোনো বিষয় বরাদ্দ নেই</option>`;

  function _resetFromExam() {
    subExamWrap.style.display = 'none';
    dividedWrap.style.display = 'none';
    subExamSelect.disabled = true;
    dividedSelect.disabled = true;
    document.getElementById('marks-table-wrap').innerHTML = '';
  }

  function _resetFromSubExam() {
    dividedWrap.style.display = 'none';
    dividedSelect.disabled = true;
    document.getElementById('marks-table-wrap').innerHTML = '';
  }

  sectionSelect.addEventListener('change', async () => {
    _rendering = false;
    examSelect.innerHTML = `<option value="">লোড হচ্ছে...</option>`;
    examSelect.disabled = true;
    _resetFromExam();

    const idx = sectionSelect.value;
    if (idx === '') { examSelect.innerHTML = `<option value="">পরীক্ষা বেছে নিন</option>`; return; }
    const sec = sections[Number(idx)];

    const examRes = await getMainExams(sec.versionId, sec.sessionId, sec.classId, sec.groupId, sec.subjectId);
    const exams = examRes.results || [];
    examSelect.innerHTML = exams.length
      ? `<option value="">বেছে নিন</option>` + exams.map(e =>
          `<option value="${e.mainExamId ?? e.MainExamId}">${e.mainExamName ?? e.MainExamName}</option>`).join('')
      : `<option value="">কোনো পরীক্ষা নেই</option>`;
    examSelect.disabled = !exams.length;

    if (exams.length === 1) {
      examSelect.value = String(exams[0].mainExamId ?? exams[0].MainExamId);
      examSelect.dispatchEvent(new Event('change'));
    }
  });

  examSelect.addEventListener('change', async () => {
    _resetFromExam();
    const idx = sectionSelect.value;
    const mainExamId = examSelect.value;
    if (idx === '' || !mainExamId) return;
    const sec = sections[Number(idx)];

    subExamSelect.innerHTML = `<option value="">লোড হচ্ছে...</option>`;
    subExamWrap.style.display = 'block';

    const subRes = await getSubExams(Number(mainExamId), sec.subjectId);
    const subExams = subRes.results || [];

    if (!subExams.length) {
      subExamWrap.style.display = 'none';
      await _renderMarksTable(sec, mainExamId, 0, 0);
      return;
    }

    subExamSelect.innerHTML = `<option value="">বেছে নিন</option>` + subExams.map(e =>
      `<option value="${e.subExamId ?? e.SubExamId}">${e.subExamName ?? e.SubExamName}</option>`).join('');
    subExamSelect.disabled = false;

    if (subExams.length === 1) {
      subExamSelect.value = String(subExams[0].subExamId ?? subExams[0].SubExamId);
      subExamSelect.dispatchEvent(new Event('change'));
    }
  });

  subExamSelect.addEventListener('change', async () => {
    _resetFromSubExam();
    const idx = sectionSelect.value;
    const mainExamId = examSelect.value;
    const subExamId = subExamSelect.value;
    if (!subExamId) return;
    const sec = sections[Number(idx)];

    dividedSelect.innerHTML = `<option value="">লোড হচ্ছে...</option>`;
    dividedWrap.style.display = 'block';

    const divRes = await getDividedExams(Number(mainExamId), Number(subExamId), sec.subjectId);
    const divExams = divRes.results || [];

    if (!divExams.length) {
      dividedWrap.style.display = 'none';
      await _renderMarksTable(sec, mainExamId, subExamId, 0);
      return;
    }

    dividedSelect.innerHTML = `<option value="">বেছে নিন</option>` + divExams.map(e =>
      `<option value="${e.dividedExamId ?? e.DividedExamId}">${e.dividedExamName ?? e.DividedExamName}</option>`).join('');
    dividedSelect.disabled = false;

    if (divExams.length === 1) {
      dividedSelect.value = String(divExams[0].dividedExamId ?? divExams[0].DividedExamId);
      dividedSelect.dispatchEvent(new Event('change'));
    }
  });

  dividedSelect.addEventListener('change', async () => {
    document.getElementById('marks-table-wrap').innerHTML = '';
    const idx = sectionSelect.value;
    const mainExamId = examSelect.value;
    const subExamId = subExamSelect.value;
    const dividedExamId = dividedSelect.value;
    if (!dividedExamId) return;
    const sec = sections[Number(idx)];
    await _renderMarksTable(sec, mainExamId, subExamId, dividedExamId);
  });

  document.getElementById('load-marks-btn').addEventListener('click', async () => {
    const idx = sectionSelect.value;
    const mainExamId = examSelect.value;
    if (idx === '' || !mainExamId) { showToast('ক্লাস, বিষয় ও পরীক্ষা বেছে নিন', 'error'); return; }
    const sec = sections[Number(idx)];
    const subExamId = subExamSelect.value || 0;
    const dividedExamId = dividedSelect.value || 0;
    await _renderMarksTable(sec, mainExamId, subExamId, dividedExamId);
  });
}

let _rendering = false;
async function _renderMarksTable(sec, mainExamId, subExamId, dividedExamId) {
  if (_rendering) return;
  _rendering = true;
  try {
    const wrap = document.getElementById('marks-table-wrap');
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--in-accent);font-size:.875rem;display:flex;flex-direction:column;align-items:center;gap:10px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.5;animation:me-spin 1s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>লোড হচ্ছে...</div><style>@keyframes me-spin{to{transform:rotate(360deg)}}</style>`;

    const filter = {
      versionId: sec.versionId, sessionId: sec.sessionId, branchId: sec.branchId, shiftId: sec.shiftId,
      classId: sec.classId, groupId: sec.groupId, sectionId: sec.sectionId, subjectId: sec.subjectId,
      mainExamId: Number(mainExamId), subExamId: Number(subExamId) || 0, dividedExamId: Number(dividedExamId) || 0,
    };

    const res = await getMarksEntry(filter);
    const isError = res.HasError || (res.httpStatusCode && res.httpStatusCode !== 200);
    if (isError) {
      wrap.innerHTML = `<div style="margin:16px 12px;padding:16px;border-radius:14px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:.875rem;font-weight:600;">${res.message || 'নম্বর সেটআপ পাওয়া যায়নি'}</div>`;
      return;
    }
    const students = res.results?.Marks || res.results?.marks || [];

    if (!students.length) {
      wrap.innerHTML = `<div style="margin:16px 12px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#94a3b8;font-size:.875rem;text-align:center;">কোনো শিক্ষার্থী নেই</div>`;
      return;
    }

    const fullMark = students[0]?.FullMarks ?? students[0]?.fullMarks ?? '—';
    const absentCount = students.filter(s => s.IsAbsent ?? s.isAbsent).length;
    const savedCount  = students.filter(s => (s.MarksId ?? s.marksId ?? 0) > 0).length;

    wrap.innerHTML = `
      <div class="me-stats-bar">
        <div class="me-stat">
          <span class="me-stat-val">${fullMark}</span>
          <span class="me-stat-label">পূর্ণমান</span>
        </div>
        <div class="me-stat">
          <span class="me-stat-val">${students.length}</span>
          <span class="me-stat-label">মোট</span>
        </div>
        <div class="me-stat">
          <span class="me-stat-val red">${absentCount}</span>
          <span class="me-stat-label">অনুপস্থিত</span>
        </div>
        <div class="me-stat">
          <span class="me-stat-val green">${savedCount}</span>
          <span class="me-stat-label">সংরক্ষিত</span>
        </div>
      </div>
      <div class="me-list" id="me-student-list">
        ${students.map((s, i) => {
          const roll   = s.RollNo ?? s.rollNo;
          const name   = s.FullName ?? s.fullName;
          const marks  = s.ObtainMarks ?? s.obtainMarks ?? '';
          const max    = s.FullMarks ?? s.fullMarks ?? 100;
          const absent = s.IsAbsent ?? s.isAbsent ?? false;
          return `
          <div class="me-student-card${absent ? ' absent-row' : ''}" data-row="${i}">
            <div class="me-roll">${roll}</div>
            <div class="me-name">${name}</div>
            <div class="me-input-wrap">
              <input
                type="number"
                inputmode="numeric"
                class="me-marks-input"
                data-row="${i}"
                value="${absent ? '' : (marks || '')}"
                min="0" max="${max}"
                tabindex="${i + 1}"
                placeholder="${absent ? 'অনু.' : '—'}"
                ${absent ? 'disabled' : ''}
              >
            </div>
            <button class="me-absent-btn" data-row="${i}" title="অনুপস্থিত">
              <input type="checkbox" class="me-absent-chk" data-row="${i}" ${absent ? 'checked' : ''}>
              ${absent
                ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
                : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#cbd5e1" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
              }
            </button>
          </div>`;
        }).join('')}
      </div>
      <div style="height:90px;"></div>
    `;

    const inputs = Array.from(wrap.querySelectorAll('.me-marks-input'));
    const checks = Array.from(wrap.querySelectorAll('.me-absent-chk'));
    const absentBtns = Array.from(wrap.querySelectorAll('.me-absent-btn'));

    function _buildRecord(s, obtainMarks, isAbsent) {
      return {
        studentIID: s.StudentIID ?? s.studentIID,
        versionId: sec.versionId, sessionId: sec.sessionId, shiftId: sec.shiftId,
        classId: sec.classId, groupId: sec.groupId, sectionId: sec.sectionId,
        marksId: s.MarksId ?? s.marksId ?? 0,
        mainExamId: Number(mainExamId), subExamId: Number(subExamId) || 0,
        dividedExamId: Number(dividedExamId) || 0, subjectId: sec.subjectId,
        dividedExamMarkSetupId: s.DividedExamMarkSetupID ?? s.dividedExamMarkSetupId ?? 0,
        obtainMarks, isAbsent,
        remarks: 'App',
      };
    }

    inputs.forEach((inp, i) => {
      const s   = students[i];
      const max = Number(s.FullMarks ?? s.fullMarks ?? 100);
      const autoDigits = Math.max(1, String(Math.floor(max - 1)).length);

      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const next = inputs[i + 1];
          if (next) next.focus(); else inp.blur();
        }
      });
      inp.addEventListener('focus', () => inp.select());

      inp.addEventListener('input', () => {
        const digits = inp.value.replace(/\D/g, '');
        if (digits.length >= autoDigits) {
          const next = inputs[i + 1];
          if (next) next.focus(); else inp.blur();
        }
      });

      inp.addEventListener('blur', async () => {
        const raw = inp.value.trim();
        if (raw === '') return;
        const val = parseFloat(raw);
        if (isNaN(val)) { inp.value = ''; return; }
        if (val > max) {
          showToast(`রোল ${s.RollNo ?? s.rollNo}: পূর্ণমান ${max} এর বেশি দেওয়া যাবে না`, 'error');
          inp.value = max;
          return;
        }
        inp.classList.add('saving');
        const rec = _buildRecord(s, val, false);
        const r = await saveMarkOne(rec);
        inp.classList.remove('saving');
        const err = r.HasError || (r.httpStatusCode && r.httpStatusCode !== 200);
        if (err) {
          showToast(`রোল ${s.RollNo ?? s.rollNo}: ${r.message || 'ত্রুটি'}`, 'error');
        } else {
          if (r.results?.marksId) s.MarksId = r.results.marksId;
          inp.classList.add('saved-flash');
          setTimeout(() => inp.classList.remove('saved-flash'), 800);
        }
      });
    });

    absentBtns.forEach((btn, i) => {
      btn.addEventListener('click', async () => {
        const chk  = checks[i];
        const inp  = inputs[i];
        const card = btn.closest('.me-student-card');
        const s    = students[i];

        chk.checked = !chk.checked;
        const absent = chk.checked;

        inp.disabled = absent;
        inp.placeholder = absent ? 'অনু.' : '—';
        if (absent) inp.value = '';
        card.classList.toggle('absent-row', absent);

        // swap icon
        btn.querySelector('svg').outerHTML; // read
        btn.innerHTML = `<input type="checkbox" class="me-absent-chk" data-row="${i}" ${absent ? 'checked' : ''}>` +
          (absent
            ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e46962" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
            : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#cac4d0" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
          );
        checks[i] = btn.querySelector('.me-absent-chk');

        const rec = _buildRecord(s, 0, absent);
        const r = await saveMarkOne(rec);
        const err = r.HasError || (r.httpStatusCode && r.httpStatusCode !== 200);
        if (err) showToast(r.message || 'ত্রুটি', 'error');
      });
    });

    const marksIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    const marksBtn = _mountFAB(`${marksIcon} সব সংরক্ষণ`);
    marksBtn.addEventListener('click', async () => {
      const records = students.map((s, i) => {
        const absent = checks[i].checked;
        const val = absent ? 0 : (parseFloat(inputs[i].value) || 0);
        return _buildRecord(s, val, absent);
      });

      marksBtn.disabled = true;
      marksBtn.textContent = 'সংরক্ষণ হচ্ছে...';
      const res = await saveMarks(records);
      const saveErr = res.HasError || (res.httpStatusCode && res.httpStatusCode !== 200);
      showToast(saveErr ? (res.message || 'ত্রুটি হয়েছে') : 'সব নম্বর সংরক্ষণ হয়েছে ✓', saveErr ? 'error' : 'success');
      marksBtn.disabled = false;
      marksBtn.innerHTML = `${marksIcon} সব সংরক্ষণ`;
    });
  } finally { _rendering = false; }
}
