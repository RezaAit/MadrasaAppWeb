import { getUserDetails, getAttendanceHistory, getHomework, getStudentDue, getNotices } from './api.js';
import { initLogin, checkAuth, logout } from './auth.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';
import { initTabIndicator } from '../../shared/js/tab-indicator.js';
import { loadAttendance, loadExam } from './attendance.js';
import { loadGuardianLeave } from './leave.js';
import { loadHomework } from './homework.js';
import { loadFees } from './fees.js';
import { loadNotices } from './notice.js';

// ── Global state ─────────────────────────────────────────────────────────
export let state = {
  guardian: null,
  children: [],
  activeChild: null,
  activeSection: 'attendance',
};

// ── Router ────────────────────────────────────────────────────────────────
const SCREEN_ORDER = ['screen-login', 'screen-dashboard', 'screen-profile'];

export function navigateTo(screenId, opts = {}) {
  const current = document.querySelector('.screen.active');
  const next    = document.getElementById(screenId);
  if (!next) return;

  // Determine direction: back = reverse slide
  const currentIdx = SCREEN_ORDER.indexOf(current?.id);
  const nextIdx    = SCREEN_ORDER.indexOf(screenId);
  const isBack     = opts.back === true || (currentIdx > -1 && nextIdx > -1 && nextIdx < currentIdx);

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'slide-back');
  });

  if (isBack) next.classList.add('slide-back');
  next.classList.add('active');

  // Remove animation class after it plays so it doesn't replay
  next.addEventListener('animationend', () => next.classList.remove('slide-back'), { once: true });
}

// ── Toast ─────────────────────────────────────────────────────────────────
export function showToast(msg, type = 'default') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Icons helpers (inline SVG shortcuts) ─────────────────────────────────
export const Icons = {
  home: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  attendance: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`,
  homework: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  fees: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  exam: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  notice: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

// ── Init ──────────────────────────────────────────────────────────────────
export async function init() {
  attachRippleAll('.btn, .profile-nav-btn');

  const token = localStorage.getItem('guardian_token');
  const savedData = localStorage.getItem('guardian_data');

  window.addEventListener('login-success', async e => {
    state.guardian = e.detail;
    await loadDashboard();
  });

  if (token && savedData) {
    try {
      state.guardian = JSON.parse(savedData);
      await loadDashboard();
      return;
    } catch {
      localStorage.removeItem('guardian_token');
      localStorage.removeItem('guardian_data');
    }
  }

  navigateTo('screen-login');
  initLogin();
}

async function clearAllCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    showToast('ক্যাশ পরিষ্কার হয়েছে, রিলোড হচ্ছে…', 'success');
    setTimeout(() => location.reload(true), 800);
  } catch {
    location.reload(true);
  }
}

document.addEventListener('click', e => {
  if (e.target.closest('#clear-cache-btn') || e.target.closest('#clear-cache-btn-2')) {
    clearAllCache();
  }
});

async function loadDashboard() {
  if (!state.guardian) {
    const res = await getUserDetails('');
    if (!res.HasError) state.guardian = res.results;
  }

  // Populate header user info
  const hdrName = document.getElementById('hdr-guardian-name');
  if (hdrName) hdrName.textContent = state.guardian?.name || 'অভিভাবক';

  state.children = state.guardian?.children || [];

  if (state.children.length === 1) {
    state.activeChild = state.children[0];
    showStudentProfile();
  } else {
    renderChildSelector();
    navigateTo('screen-dashboard');
  }

  attachRipple(document.getElementById('logout-btn'));
  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

// ── Child Selector ────────────────────────────────────────────────────────
function renderChildSelector() {
  const grid = document.getElementById('children-grid');
  if (!grid) return;

  grid.innerHTML = '';
  state.children.forEach(child => {
    const dot = child.todayAttendance === 'Present' ? '#22C55E' : '#EF4444';
    const initials = child.fullName.slice(0, 1);
    const card = document.createElement('div');
    card.className = 'child-card card-lift stagger-in';
    const avatarHtml = child.photoUrl
      ? `<img src="${child.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : initials;
    const avatarBg = child.photoUrl ? 'transparent' : child.avatarColor;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="position:relative;flex-shrink:0;">
          <div style="width:52px;height:52px;border-radius:50%;background:${avatarBg};color:#fff;font-size:1.3rem;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #E5E7EB;">${avatarHtml}</div>
          <div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;border-radius:50%;background:${dot};border:2px solid #fff;"></div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.97rem;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${child.fullName}</div>
          ${child.nameBangla ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:1px;">${child.nameBangla}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
            ${child.className ? `<span style="font-size:.7rem;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;padding:1px 7px;border-radius:20px;font-weight:600;">শ্রেণি ${child.className}</span>` : ''}
            ${child.section ? `<span style="font-size:.7rem;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;padding:1px 7px;border-radius:20px;font-weight:600;">সেকশন ${child.section}</span>` : ''}
            ${child.roll ? `<span style="font-size:.7rem;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;padding:1px 7px;border-radius:20px;font-weight:600;">রোল ${child.roll}</span>` : ''}
            ${child.studentInsID ? `<span style="font-size:.7rem;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;padding:1px 7px;border-radius:20px;font-weight:600;">${child.studentInsID}</span>` : ''}
          </div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
    card.addEventListener('click', () => {
      state.activeChild = child;
      showStudentProfile();
    });
    grid.appendChild(card);
  });
  attachRippleAll('.child-card', grid);
}

// ── Student Profile ───────────────────────────────────────────────────────
function showStudentProfile() {
  const child = state.activeChild;
  if (!child) return;
  localStorage.setItem('active_child', JSON.stringify(child));

  // Populate hero
  document.getElementById('profile-name').textContent = child.fullName;
  const nameBnEl = document.getElementById('profile-name-bn');
  if (nameBnEl) nameBnEl.textContent = child.nameBangla || '';
  const avatarEl = document.getElementById('profile-avatar');
  if (child.photoUrl) {
    avatarEl.innerHTML = `<img src="${child.photoUrl}" alt="${child.fullName}">`;
  } else {
    avatarEl.textContent = child.fullName.slice(0, 1);
  }

  // Info chips
  const chipsEl = document.getElementById('profile-chips');
  if (chipsEl) {
    const chip = (label, val) => val
      ? `<span class="hero-chip">${label}: ${val}</span>`
      : '';
    chipsEl.innerHTML = [
      chip('শ্রেণি', child.className),
      chip('সেকশন', child.section),
      chip('গ্রুপ', child.group),
      chip('রোল', child.roll),
      chip('আইডি', child.studentInsID),
    ].join('');
  }

  // Quick stats
  document.getElementById('qs-attendance').textContent = child.todayAttendance === 'Present' ? '✓' : '✗';
  document.getElementById('qs-homework').textContent = child.homeworkPending;
  document.getElementById('qs-fees').textContent = child.feesDue > 0 ? `৳${child.feesDue}` : '০';
  document.getElementById('qs-notice').textContent = child.noticeUnread;

  navigateTo('screen-profile');
  initProfileNav();
  _loadQuickStats(child);
}

async function _loadQuickStats(child) {
  const now = new Date();
  const [attRes, hwRes, dueRes, noticeRes] = await Promise.all([
    getAttendanceHistory(child.studentIID),
    getHomework(child.studentIID),
    getStudentDue(child.studentIID),
    getNotices(child.studentIID),
  ]);

  // Attendance — today's status
  const days = attRes?.results?.days || [];
  const todayDay = now.getDate();
  const todayEntry = days.find(d => d.day === todayDay && d.dayType === 'R');
  const todayStatus = todayEntry
    ? (todayEntry.isPresent ? 'Present' : todayEntry.isLeave ? 'Leave' : 'Absent')
    : 'Unknown';
  const attEl = document.getElementById('qs-attendance');
  if (attEl) attEl.textContent = todayStatus === 'Present' ? '✓' : todayStatus === 'Absent' ? '✗' : '—';

  // Homework pending
  const hwList = Array.isArray(hwRes?.results) ? hwRes.results : [];
  const pending = hwList.filter(h => !h.isSubmitted && !h.IsSubmitted).length;
  const hwEl = document.getElementById('qs-homework');
  if (hwEl) hwEl.textContent = pending;

  // Fees due
  const due = dueRes?.results?.dueAmount ?? 0;
  const feesEl = document.getElementById('qs-fees');
  if (feesEl) feesEl.textContent = due > 0 ? `৳${due.toLocaleString()}` : '০';

  // Notices unread
  const notices = Array.isArray(noticeRes?.results) ? noticeRes.results : [];
  const unread = notices.filter(n => !n.isRead).length;
  const noticeEl = document.getElementById('qs-notice');
  if (noticeEl) noticeEl.textContent = unread;
}

// ── Profile Navigation Tabs ───────────────────────────────────────────────
function initProfileNav() {
  const navEl  = document.querySelector('.profile-nav');
  const navBtns = document.querySelectorAll('.profile-nav-btn');

  // Sliding indicator
  const { moveTo } = initTabIndicator(navEl, { autoWire: false });

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      moveTo(btn);
      loadSection(btn.dataset.section);
    });
  });

  // Position indicator on the default active tab after layout
  requestAnimationFrame(() => moveTo(navEl?.querySelector('.profile-nav-btn.active')));

  // Load default
  loadSection('attendance');

  attachRipple(document.getElementById('profile-back-btn'));
  document.getElementById('profile-back-btn')?.addEventListener('click', () => {
    if (state.children.length > 1) navigateTo('screen-dashboard', { back: true });
  });
}

function loadSection(section) {
  const content = document.getElementById('profile-content');
  content.innerHTML = _skeletonCards(3);
  state.activeSection = section;

  const child = state.activeChild;
  switch (section) {
    case 'attendance': loadAttendance(content, child); break;
    case 'leave':      loadGuardianLeave(content, child, state.guardian); break;
    case 'homework':   loadHomework(content, child);   break;
    case 'fees':       loadFees(content, child);       break;
    case 'exam':       loadExam(content, child); break;
    case 'notice':     loadNotices(content, child);    break;
  }
}

function _skeletonCards(n) {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton-card mb-12"></div>`).join('');
}
