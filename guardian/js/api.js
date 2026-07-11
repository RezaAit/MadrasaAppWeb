import { BASE_URL, mockDelay, useMock } from '../../shared/js/api-config.js';
import * as M from '../../shared/js/mock-data.js';

// ── Auth ──────────────────────────────────────────────────────────────────
export async function requestOtp(phone) {
  if (useMock('auth')) return mockDelay({ success: true, message: 'OTP পাঠানো হয়েছে' });
  const r = await fetch(`${BASE_URL}/api/Auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, userType: 'Guardian' }),
  });
  return _safeJson(r);
}

export async function verifyOtp(phone, otp) {
  if (useMock('auth')) {
    if (otp.length >= 4) return mockDelay({ success: true, token: M.MOCK_GUARDIAN.token, guardian: M.MOCK_GUARDIAN });
    return mockDelay({ success: false, message: 'ভুল OTP' });
  }
  const r = await fetch(`${BASE_URL}/api/Auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, userType: 'Guardian', otp }),
  });
  const data = await r.json();
  const token = data.results?.token || (data.httpStatusCode === 200 ? data.token : null);
  if (token) {
    // Fetch full guardian profile with children
    let guardian = {};
    try {
      const profileRes = await fetch(`${BASE_URL}/api/Sbook/GetUserDetails/${phone}/Guardian`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await profileRes.json();
      guardian = profile.results || {};
      // Normalize children fields to match app expectations
      if (guardian.children) {
        guardian.children = guardian.children.map(c => ({
          studentIID:      c.studentIID,
          studentInsID:    c.studentInsID,
          fullName:        c.fullName,
          nameBangla:      c.nameBangla,
          className:       c.class,
          section:         c.section,
          group:           c.group,
          roll:            c.rollNo,
          photoUrl:        c.photoUrl || null,
          avatarColor:     '#1a6b4a',
          todayAttendance: 'Unknown',
          homeworkPending: 0,
          feesDue:         0,
          noticeUnread:    0,
          hasUpcomingExam: false,
        }));
      }
    } catch (_) {}
    guardian.token = token;
    return { success: true, token, guardian };
  }
  return { success: false, message: data.message || 'OTP যাচাই ব্যর্থ হয়েছে' };
}

export async function getUserDetails(phone) {
  if (useMock('dashboard')) return mockDelay({ HasError: false, results: M.MOCK_GUARDIAN });
  const r = await fetch(`${BASE_URL}/api/Sbook/GetUserDetails/${phone}/Guardian`, { headers: _authHeader() });
  return _safeJson(r);
}

// ── Homework ──────────────────────────────────────────────────────────────
export async function getHomework(studentIID) {
  if (useMock('homework')) return mockDelay({ HasError: false, results: M.MOCK_HOMEWORK });
  const r = await fetch(`${BASE_URL}/api/Homework/student/${studentIID}`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function submitHomework(detailsId, payload, extraImages = [], videos = [], youtubeUrls = [], docs = []) {
  if (useMock('homework')) {
    console.log('[MOCK] submitHomework payload:', payload, extraImages, videos, youtubeUrls, docs);
    return mockDelay({ HasError: false, message: 'হোমওয়ার্ক জমা হয়েছে' });
  }
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => v !== null && v !== undefined && fd.append(k, v));
  extraImages.forEach(file => fd.append('images', file));
  videos.forEach(file => fd.append('videos', file));
  docs.forEach(file => fd.append('files', file));
  if (youtubeUrls.length) fd.append('youtubeUrls', JSON.stringify(youtubeUrls));
  const r = await fetch(`${BASE_URL}/api/Homework/submit/${detailsId}`, {
    method: 'POST',
    headers: _authHeader(),
    body: fd,
  });
  return _safeJson(r);
}

// ── Attendance ────────────────────────────────────────────────────────────
export async function getAttendanceHistory(studentIID) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: M.MOCK_ATTENDANCE.history });
  const now = new Date();
  const r = await fetch(
    `${BASE_URL}/api/Attendance/student/${studentIID}/${now.getFullYear()}/${now.getMonth() + 1}`,
    { headers: _authHeader() }
  );
  return _safeJson(r);
}

export async function getAttendanceFullHistory(studentIID) {
  if (useMock('attendance')) return mockDelay({ HasError: false, results: M.MOCK_ATTENDANCE.history });
  const r = await fetch(
    `${BASE_URL}/api/Attendance/student/${studentIID}/history`,
    { headers: _authHeader() }
  );
  return _safeJson(r);
}

// ── Leave ─────────────────────────────────────────────────────────────────
export async function getLeaveHistory(studentIID) {
  if (useMock('leave')) return mockDelay({ HasError: false, results: M.MOCK_LEAVES.filter(l => l.studentName) });
  const r = await fetch(`${BASE_URL}/api/Leave/student/${studentIID}`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function applyLeave(formData) {
  if (useMock('leave')) return mockDelay({ HasError: false, message: 'ছুটির আবেদন জমা হয়েছে' });
  const r = await fetch(`${BASE_URL}/api/Leave`, {
    method: 'POST',
    headers: _authHeader(),
    body: formData,
  });
  return _safeJson(r);
}

export async function getLeaveTypes() {
  const r = await fetch(`${BASE_URL}/api/Leave/types`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function getLeaveAttachment(leaveId) {
  return `${BASE_URL}/api/Leave/${leaveId}/attachment`;
}

export async function checkLeaveCalendar(studentId, from, to) {
  const params = new URLSearchParams({ studentId, from, to });
  const r = await fetch(`${BASE_URL}/api/Leave/calendar-check?${params}`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function guardianUpdateLeave(leaveId, formData) {
  const r = await fetch(`${BASE_URL}/api/Leave/guardian/${leaveId}`, {
    method: 'PUT',
    headers: _authHeader(),
    body: formData,
  });
  return _safeJson(r);
}

export async function guardianDeleteLeave(leaveId) {
  const r = await fetch(`${BASE_URL}/api/Leave/guardian/${leaveId}`, {
    method: 'DELETE',
    headers: { ..._authHeader(), 'Content-Type': 'application/json' },
  });
  return _safeJson(r);
}

// ── Fees ──────────────────────────────────────────────────────────────────
export async function getFeesInfo(studentIID) {
  if (useMock('fees')) return mockDelay({ HasError: false, results: M.MOCK_FEES });
  const r = await fetch(`${BASE_URL}/api/Fee/student/${studentIID}/history`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function getStudentDue(studentIID) {
  const r = await fetch(`${BASE_URL}/api/Fee/student/${studentIID}/due`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function getReceiptDetails(masterId) {
  const r = await fetch(`${BASE_URL}/api/Fee/receipt/${masterId}`, { headers: _authHeader() });
  return _safeJson(r);
}

// ── Exam ──────────────────────────────────────────────────────────────────
export async function getExamResults(studentIID) {
  if (useMock('exam')) return mockDelay({ HasError: false, results: M.MOCK_EXAM_RESULTS });
  const r = await fetch(`${BASE_URL}/api/Result/student/${studentIID}`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function getExamRoutine(studentIID) {
  if (useMock('exam')) return mockDelay({ HasError: false, results: M.MOCK_EXAM_ROUTINE });
  const r = await fetch(`${BASE_URL}/api/Routine/class-periods`, { headers: _authHeader() });
  return _safeJson(r);
}

// ── Notices ───────────────────────────────────────────────────────────────
export async function getNotices(studentIID) {
  if (useMock('notice')) return mockDelay({ HasError: false, results: M.MOCK_NOTICES });
  const r = await fetch(`${BASE_URL}/api/Notice/guardian/${studentIID}`, { headers: _authHeader() });
  return _safeJson(r);
}

export async function markNoticeRead(noticeId) {
  if (useMock('notice')) {
    const n = M.MOCK_NOTICES.find(x => x.id === noticeId);
    if (n) n.isRead = true;
    return mockDelay({ HasError: false });
  }
  const r = await fetch(`${BASE_URL}/api/Notice/${noticeId}/mark-read`, {
    method: 'POST',
    headers: _authHeader(),
  });
  return _safeJson(r);
}

function _authHeader() {
  const token = localStorage.getItem('guardian_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _safeJson(r) {
  if (r.status === 401) {
    localStorage.removeItem('guardian_token');
    localStorage.removeItem('guardian_data');
    window.location.reload();
    return { HasError: true, httpStatusCode: 401, message: 'Session expired' };
  }
  const text = await r.text();
  if (!text) return { HasError: true, httpStatusCode: r.status, message: `Empty response (${r.status})` };
  try { return JSON.parse(text); }
  catch { return { HasError: true, httpStatusCode: r.status, message: text.slice(0, 200) }; }
}
