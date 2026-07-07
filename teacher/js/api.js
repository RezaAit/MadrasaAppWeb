import { BASE_URL, mockDelay, useMock } from '../../shared/js/api-config.js';
import * as M from '../../shared/js/mock-data.js';

// â”€â”€ Teacher Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTeacherProfile() {
  const r = await _fetch(`${BASE_URL}/api/Teacher/profile`, { headers: _authHeader() });
  return _json(r);
}

export async function updateTeacherProfile(formData) {
  const r = await _fetch(`${BASE_URL}/api/Teacher/profile`, {
    method: 'PUT',
    headers: _authHeader(),
    body: formData,
  });
  return _json(r);
}

export function teacherPhotoUrl(empId) {
  return `${BASE_URL}/api/Teacher/photo/${empId}`;
}

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function requestOtp(phone) {
  if (useMock('auth')) return mockDelay({ success: true });
  const r = await _fetch(`${BASE_URL}/api/Auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, userType: 'Teacher' }),
  });
  return _json(r);
}

export async function verifyOtp(phone, otp) {
  if (useMock('auth')) {
    if (otp.length >= 4) return mockDelay({ success: true, token: M.MOCK_TEACHER.token, teacher: M.MOCK_TEACHER });
    return mockDelay({ success: false });
  }
  const r = await _fetch(`${BASE_URL}/api/Auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, userType: 'Teacher', otp }),
  });
  const data = await _json(r);
  // Real API: { httpStatusCode, message, results: { token, ...userData } }
  if (data.httpStatusCode === 200 && data.results) {
    return { success: true, token: data.results.token, teacher: data.results };
  }
  return { success: false, message: data.message };
}

export async function teacherLogin(phone, role) {
  if (useMock('auth')) {
    const user = role === 'Principal' ? M.MOCK_PRINCIPAL : M.MOCK_TEACHER;
    return mockDelay({ HasError: false, results: user });
  }
  const r = await _fetch(`${BASE_URL}/api/Sbook/GetUserDetails/${phone}/${role}`, { headers: _authHeader() });
  return _json(r);
}

// â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getDashboardSummary() {
  if (useMock('dashboard')) return mockDelay({ HasError: false, results: M.MOCK_TEACHER_DASHBOARD });
  const r = await _fetch(`${BASE_URL}/api/Dashboard/attendance/today`, { headers: _authHeader() });
  return _json(r);
}

export async function getPrincipalDashboard() {
  if (useMock('dashboard')) return mockDelay({ HasError: false, results: M.MOCK_TEACHER_DASHBOARD });
  const r = await _fetch(`${BASE_URL}/api/Dashboard/principal`, { headers: _authHeader() });
  return _json(r);
}

// â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getMySections() {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: { subjectSections: M.MOCK_SECTIONS, classTeacherSections: [] } });
  const r = await _fetch(`${BASE_URL}/api/Student/my-sections`, { headers: _authHeader() });
  return _json(r);
}

// â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getClassStudents(sectionId) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: M.MOCK_ATTENDANCE.today });
  const r = await _fetch(`${BASE_URL}/api/Student/by-section/${sectionId}`, { headers: _authHeader() });
  return _json(r);
}

export async function getTodayAttendance(sectionId, date = null) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: [] });
  const qs = date ? `?date=${date}` : '';
  const r = await _fetch(`${BASE_URL}/api/Attendance/today/${sectionId}${qs}`, { headers: _authHeader() });
  return _json(r);
}

export async function getMonthlySummary(sectionId, year, month) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: { totalStudents: 0, days: [] } });
  const r = await _fetch(`${BASE_URL}/api/Attendance/monthly-summary/${sectionId}/${year}/${month}`, { headers: _authHeader() });
  return _json(r);
}

export async function getMonthlyAttendance(sectionId, year, month) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: M.MOCK_ATTENDANCE.today });
  const r = await _fetch(`${BASE_URL}/api/Attendance/monthly/${sectionId}/${year}/${month}`, { headers: _authHeader() });
  return _json(r);
}

export async function saveAttendance(payload) {
  if (useMock('attendance')) { console.log('[MOCK] saveAttendance:', payload); return mockDelay({ HasError: false, message: 'à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦¹à¦¯à¦¼à§‡à¦›à§‡' }); }
  const r = await _fetch(`${BASE_URL}/api/Attendance/save-list`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return _json(r);
}

// â”€â”€ Leave Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// status: '' (default) = Pending+Escalated, 'Reviewed' = Approved+Disapproved history
export async function getPendingLeaves(status = '') {
  if (useMock('leave')) return mockDelay({ HasError: false, results: M.MOCK_LEAVES });
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const r = await _fetch(`${BASE_URL}/api/Leave/pending${qs}`, { headers: _authHeader() });
  return _json(r);
}

export async function getEscalatedLeaves() {
  if (useMock('leave')) return mockDelay({ HasError: false, results: [] });
  const r = await _fetch(`${BASE_URL}/api/Leave/escalated`, { headers: _authHeader() });
  return _json(r);
}

export async function getLeaveTypes() {
  const r = await _fetch(`${BASE_URL}/api/Leave/types`, { headers: _authHeader() });
  return _json(r);
}

export async function checkLeaveCalendar(studentId, from, to) {
  const params = new URLSearchParams({ studentId, from, to });
  const r = await _fetch(`${BASE_URL}/api/Leave/calendar-check?${params}`, { headers: _authHeader() });
  return _json(r);
}

export async function teacherApplyLeave(formData) {
  const r = await _fetch(`${BASE_URL}/api/Leave/teacher-apply`, {
    method: 'POST',
    headers: _authHeader(),
    body: formData,
  });
  return _json(r);
}

export async function teacherUpdateLeave(leaveId, formData) {
  const r = await _fetch(`${BASE_URL}/api/Leave/teacher/${leaveId}`, {
    method: 'PUT',
    headers: _authHeader(),
    body: formData,
  });
  return _json(r);
}

export async function teacherDeleteLeave(leaveId) {
  const r = await _fetch(`${BASE_URL}/api/Leave/teacher/${leaveId}`, {
    method: 'DELETE',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
  });
  return _json(r);
}

// decision: 'Approved' | 'Disapproved' | 'Escalated'
export async function actionLeave(leaveId, decision, note = '') {
  if (useMock('leave')) {
    const leave = M.MOCK_LEAVES.find(l => l.id === leaveId);
    if (leave) leave.status = decision;
    return mockDelay({ HasError: false, message: 'âœ“ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡' });
  }
  const r = await _fetch(`${BASE_URL}/api/Leave/review`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ LeaveId: Number(leaveId), Decision: decision, Note: note }),
  });
  return _json(r);
}

// decision: 'Approved' | 'Disapproved'
export async function principalLeaveDecision(leaveId, decision, note = '') {
  if (useMock('leave')) return mockDelay({ HasError: false, message: 'âœ“ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦¹à¦¯à¦¼à§‡à¦›à§‡' });
  const r = await _fetch(`${BASE_URL}/api/Leave/principal-decision`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ LeaveId: Number(leaveId), Decision: decision, Note: note }),
  });
  return _json(r);
}

// â”€â”€ Homework â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getHomeworkList() {
  if (useMock('homework')) return mockDelay({ HasError: false, results: M.MOCK_HOMEWORK });
  const r = await _fetch(`${BASE_URL}/api/Homework/teacher`, { headers: _authHeader() });
  return _json(r);
}

// payload: { VersionId, SessionId, BranchId, ShiftId, ClassId, GroupId, SectionId, SubjectId, Title, Description, DueDate }
export async function createHomework(payload) {
  if (useMock('homework')) {
    console.log('[MOCK] createHomework:', payload);
    const newHw = { id: 'hw_new_' + Date.now(), ...payload, status: 'Pending', teacherName: M.MOCK_TEACHER.fullName };
    M.MOCK_HOMEWORK.unshift(newHw);
    return mockDelay({ HasError: false, results: { id: newHw.id } });
  }
  const r = await _fetch(`${BASE_URL}/api/Homework`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return _json(r);
}

export async function updateHomework(hwId, payload) {
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}`, {
    method: 'PUT',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return _json(r);
}

export async function publishHomework(hwId) {
  if (useMock('homework')) return mockDelay({ HasError: false });
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}/publish`, {
    method: 'POST',
    headers: _authHeader(),
  });
  return _json(r);
}

export async function deleteHomework(hwId) {
  if (useMock('homework')) return mockDelay({ HasError: false });
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}`, {
    method: 'DELETE',
    headers: _authHeader(),
  });
  return _json(r);
}

// files: { photo, annotated, voice, pdf, video } â€” any subset, each a File/Blob or null
export async function uploadHomeworkAttachments(hwId, files) {
  if (useMock('homework')) return mockDelay({ HasError: false });
  const fd = new FormData();
  Object.entries(files).forEach(([key, file]) => { if (file) fd.append(key, file); });
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}/attachments`, {
    method: 'POST',
    headers: _authHeader(),
    body: fd,
  });
  return _json(r);
}

// multi: { images: File[], annotated: (File|null)[], voices: Blob[], videos: File[], youtubeUrls: string[], pdfs: File[] }
export async function uploadHomeworkMultiAttachments(hwId, { images = [], annotated = [], voices = [], videos = [], youtubeUrls = [], pdfs = [] } = {}) {
  if (useMock('homework')) return mockDelay({ HasError: false, results: {} });
  const fd = new FormData();
  images.forEach(f => fd.append('images[]', f));
  annotated.forEach(f => { if (f) fd.append('annotated[]', f); });
  voices.forEach((b, i) => fd.append('voices[]', b, `voice_${i}.webm`));
  videos.forEach(f => fd.append('videos[]', f));
  pdfs.forEach(f => fd.append('pdfs[]', f));
  if (youtubeUrls.length) fd.append('youtubeUrls', JSON.stringify(youtubeUrls));
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}/attachments/multi`, {
    method: 'POST',
    headers: _authHeader(),
    body: fd,
  });
  return _json(r);
}

export async function deleteHomeworkAttachment(type, itemId) {
  if (useMock('homework')) return mockDelay({ HasError: false });
  const r = await _fetch(`${BASE_URL}/api/Homework/attachments/${type}/${itemId}`, {
    method: 'DELETE',
    headers: _authHeader(),
  });
  return _json(r);
}

export async function reviewHomework(hwId) {
  if (useMock('homework')) {
    const submissions = [
      { id: 101, studentIID: 101, studentName: 'à¦†à¦¹à¦®à¦¾à¦¦ à¦¹à¦¾à¦¸à¦¾à¦¨', rollNo: 1, status: 'Submitted', images: [], voiceNoteUrl: null, textRemarks: 'à¦¸à¦¬ à¦•à¦°à§‡à¦›à¦¿', annotatedPhotoUrl: null, teacherReaction: null, teacherNote: '' },
      { id: 102, studentIID: 102, studentName: 'à¦®à§à¦¹à¦¾à¦®à§à¦®à¦¾à¦¦ à¦†à¦²à§€', rollNo: 2, status: 'Pending', images: [], voiceNoteUrl: null, textRemarks: '', annotatedPhotoUrl: null, teacherReaction: null, teacherNote: '' },
      { id: 103, studentIID: 103, studentName: 'à¦‡à¦¬à§à¦°à¦¾à¦¹à¦¿à¦® à¦–à¦²à¦¿à¦²', rollNo: 3, status: 'Submitted', images: [], voiceNoteUrl: null, textRemarks: 'à¦†à¦œ à¦…à¦¸à§à¦¸à§à¦¥ à¦›à¦¿à¦² à¦¤à¦¬à§ à¦•à¦°à§‡à¦›à¦¿', annotatedPhotoUrl: null, teacherReaction: 'Excellent', teacherNote: 'à¦šà¦®à§Žà¦•à¦¾à¦°!' },
    ];
    return mockDelay({ HasError: false, results: submissions });
  }
  const r = await _fetch(`${BASE_URL}/api/Homework/${hwId}/submissions`, { headers: _authHeader() });
  return _json(r);
}

// detailsId: HwApp_Details.Id (the row returned as `id` from reviewHomework), NOT studentIID
export async function submitReaction(detailsId, reaction, note) {
  if (useMock('homework')) { console.log('[MOCK] submitReaction:', { detailsId, reaction, note }); return mockDelay({ HasError: false }); }
  const r = await _fetch(`${BASE_URL}/api/Homework/review`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ DetailsId: Number(detailsId), TeacherReaction: reaction, TeacherNote: note }),
  });
  return _json(r);
}

// â”€â”€ Fees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Per-section due summary for sections this teacher is the class/homeroom teacher for.
export async function getClassFeesSummary() {
  if (useMock('fees')) return mockDelay({ HasError: false, results: M.MOCK_FEES.classDue });
  const r = await _fetch(`${BASE_URL}/api/Fee/my-sections-due-summary`, { headers: _authHeader() });
  return _json(r);
}

// Per-student due totals within one section (sectionId, not studentId).
export async function getStudentDueList(sectionId) {
  if (useMock('fees')) return mockDelay({ HasError: false, results: M.MOCK_FEES.studentDue });
  const r = await _fetch(`${BASE_URL}/api/Fee/section/${sectionId}/due-students`, { headers: _authHeader() });
  return _json(r);
}

export async function sendFeeReminder(studentIIDs) {
  if (useMock('fees')) { console.log('[MOCK] sendFeeReminder to:', studentIIDs); return mockDelay({ HasError: false, message: `${studentIIDs.length}à¦Ÿà¦¿ SMS à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡` }); }
  const r = await _fetch(`${BASE_URL}/api/Fee/sms-reminder-bulk`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIIDs }),
  });
  return _json(r);
}

// â”€â”€ Marks / Result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTeacherSubjects(versionId, classId, sessionId, groupId) {
  if (useMock('marks')) return mockDelay({ HasError: false, results: [] });
  const r = await _fetch(
    `${BASE_URL}/api/Result/teacher-subjects/${versionId}/${classId}/${sessionId}/${groupId}`,
    { headers: _authHeader() }
  );
  return _json(r);
}

export async function getMainExams(versionId, sessionId, classId, groupId, subjectId) {
  if (useMock('marks')) return mockDelay({ HasError: false, results: [{ MainExamId: 1, MainExamName: 'à¦®à¦• à¦ªà¦°à§€à¦•à§à¦·à¦¾' }] });
  const r = await _fetch(
    `${BASE_URL}/api/Result/main-exams/${versionId}/${sessionId}/${classId}/${groupId}/${subjectId}`,
    { headers: _authHeader() }
  );
  return _json(r);
}

export async function getSubExams(mainExamId, subjectId) {
  if (useMock('marks')) return mockDelay({ HasError: false, results: [] });
  const r = await _fetch(`${BASE_URL}/api/Result/sub-exams/${mainExamId}/${subjectId}`, { headers: _authHeader() });
  return _json(r);
}

export async function getDividedExams(mainExamId, subExamId, subjectId) {
  if (useMock('marks')) return mockDelay({ HasError: false, results: [] });
  const r = await _fetch(`${BASE_URL}/api/Result/divided-exams/${mainExamId}/${subExamId}/${subjectId}`, { headers: _authHeader() });
  return _json(r);
}

export async function saveMarkOne(record) {
  if (useMock('marks')) return mockDelay({ HasError: false, message: 'saved' });
  const body = {
    StudentIID: record.studentIID, VersionId: record.versionId, SessionId: record.sessionId,
    ShiftId: record.shiftId, ClassId: record.classId, GroupId: record.groupId, SectionId: record.sectionId,
    MarksId: record.marksId || 0, MainExamID: record.mainExamId, SubExamID: record.subExamId || 0,
    DividedExamID: record.dividedExamId || 0, SubjectID: record.subjectId,
    DividedExamMarkSetupID: record.dividedExamMarkSetupId || 0,
    ObtainMarks: record.obtainMarks, IsAbsent: record.isAbsent || false, Remarks: record.remarks || null,
  };
  const r = await _fetch(`${BASE_URL}/api/Result/marks/save-one`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return _json(r);
}

// f: { versionId, sessionId, branchId, shiftId, classId, groupId, sectionId, subjectId, mainExamId, subExamId, dividedExamId }
export async function getMarksEntry(f) {
  if (useMock('marks')) return mockDelay({ HasError: false, results: M.MOCK_MARKS });
  const qs = new URLSearchParams({
    VersionId: f.versionId, SessionId: f.sessionId, BranchId: f.branchId, ShiftId: f.shiftId,
    ClassId: f.classId, GroupId: f.groupId, SectionId: f.sectionId, SubjectId: f.subjectId,
    MainExamId: f.mainExamId, SubExamId: f.subExamId || 0, DividedExamId: f.dividedExamId || 0,
  });
  const r = await _fetch(`${BASE_URL}/api/Result/marks?${qs}`, { headers: _authHeader() });
  return _json(r);
}

// records: array of { studentIID, versionId, sessionId, shiftId, classId, groupId, sectionId, marksId, mainExamId, subExamId, dividedExamId, subjectId, obtainMarks, isAbsent, remarks }
export async function saveMarks(records) {
  if (useMock('marks')) { console.log('[MOCK] saveMarks:', records); return mockDelay({ HasError: false, message: 'à¦¨à¦®à§à¦¬à¦° à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦¹à¦¯à¦¼à§‡à¦›à§‡' }); }
  const body = records.map(r => ({
    StudentIID: r.studentIID, VersionId: r.versionId, SessionId: r.sessionId, ShiftId: r.shiftId,
    ClassId: r.classId, GroupId: r.groupId, SectionId: r.sectionId, MarksId: r.marksId || 0,
    MainExamID: r.mainExamId, SubExamID: r.subExamId || 0, DividedExamID: r.dividedExamId || 0,
    SubjectID: r.subjectId, DividedExamMarkSetupID: r.dividedExamMarkSetupId || 0,
    ObtainMarks: r.obtainMarks, IsAbsent: r.isAbsent || false, Remarks: r.remarks || null,
  }));
  const r = await _fetch(`${BASE_URL}/api/Result/marks/save-bulk`, {
    method: 'POST',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return _json(r);
}

// â”€â”€ Notice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getTeacherNotices() {
  if (useMock('notice')) return mockDelay({ HasError: false, results: M.MOCK_NOTICES });
  const r = await _fetch(`${BASE_URL}/api/Notice/teacher`, { headers: _authHeader() });
  return _json(r);
}

export async function createNotice(payload, attachmentFiles = []) {
  if (useMock('notice')) { console.log('[MOCK] createNotice:', payload); return mockDelay({ HasError: false }); }
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
  const files = Array.isArray(attachmentFiles) ? attachmentFiles : (attachmentFiles ? [attachmentFiles] : []);
  files.forEach(f => fd.append('attachments', f));
  const r = await _fetch(`${BASE_URL}/api/Notice`, {
    method: 'POST',
    headers: _authHeader(),
    body: fd,
  });
  return _json(r);
}

export async function updateNotice(noticeId, formData) {
  if (useMock('notice')) return mockDelay({ HasError: false });
  const r = await _fetch(`${BASE_URL}/api/Notice/${noticeId}`, {
    method: 'PUT',
    headers: _authHeader(),
    body: formData,
  });
  return _json(r);
}

export async function deleteNotice(noticeId) {
  if (useMock('notice')) return mockDelay({ HasError: false });
  const r = await _fetch(`${BASE_URL}/api/Notice/${noticeId}`, {
    method: 'DELETE',
    headers: _authHeader(),
  });
  return _json(r);
}

function _authHeader() {
  const token = localStorage.getItem('teacher_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _json(r) {
  const text = await r.text();
  if (!text) return { HasError: true, message: `à¦¸à¦¾à¦°à§à¦­à¦¾à¦° à¦•à§‹à¦¨à§‹ response à¦¦à§‡à¦¯à¦¼à¦¨à¦¿ (${r.status})` };
  try { return JSON.parse(text); }
  catch { return { HasError: true, message: `Invalid response (${r.status}): ${text.slice(0, 120)}` }; }
}


// Auto-refresh: on 401, tries refresh token once then retries original request
let _refreshing = null;
async function _fetch(url, opts = {}) {
  let r = await fetch(url, opts);
  if (r.status !== 401) return r;

  if (!_refreshing) {
    _refreshing = _doRefresh().finally(() => { _refreshing = null; });
  }
  const refreshed = await _refreshing;
  if (!refreshed) return r;

  const newOpts = { ...opts, headers: { ...opts.headers, ..._authHeader() } };
  return fetch(url, newOpts);
}

async function _doRefresh() {
  const refreshToken = localStorage.getItem('teacher_refresh_token');
  if (!refreshToken) { _forceLogout(); return false; }
  try {
    const r = await fetch(`${BASE_URL}/api/Auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) { _forceLogout(); return false; }
    const data = await r.json();
    if (data.HasError || !data.results?.token) { _forceLogout(); return false; }
    localStorage.setItem('teacher_token', data.results.token);
    localStorage.setItem('teacher_refresh_token', data.results.refreshToken);
    return true;
  } catch { return false; }
}

function _forceLogout() {
  localStorage.removeItem('teacher_token');
  localStorage.removeItem('teacher_refresh_token');
  localStorage.removeItem('teacher_data');
  window.dispatchEvent(new CustomEvent('teacher-session-expired'));
}

