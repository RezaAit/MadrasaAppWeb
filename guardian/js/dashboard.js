import { getUserDetails, getAttendanceHistory, getHomework, getStudentDue, getNotices } from './api.js';
import { initLogin, checkAuth, logout } from './auth.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';
import { initTabIndicator } from '../../shared/js/tab-indicator.js';
import { initMotion, settleContent, crossfadeIn, markScrollReveal, spinLogo, initPullToRefresh } from '../../shared/js/motion.js';
import { loadAttendance, loadExam } from './attendance.js';
import { loadGuardianLeave } from './leave.js';
import { loadHomework } from './homework.js';
import { loadFees } from './fees.js';
import { loadNotices } from './notice.js';

// ── Slot (fuel-station) animation ────────────────────────────────────────
export function slotAnimate(el, numStr, prefix = '', suffix = '') {
  const digits = [...String(numStr)];
  el.style.cssText += 'display:inline-flex;align-items:center;overflow:visible;vertical-align:middle;';
  el.innerHTML = '';
  if (prefix) {
    const p = document.createElement('span');
    p.style.cssText = 'display:inline-block;';
    p.textContent = prefix;
    el.appendChild(p);
  }
  digits.forEach((ch, i) => {
    if (isNaN(parseInt(ch))) {
      const s = document.createElement('span');
      s.style.cssText = 'display:inline-block;';
      s.textContent = ch;
      el.appendChild(s);
      return;
    }
    const d = parseInt(ch);
    const col = document.createElement('span');
    col.style.cssText = 'display:inline-block;overflow:hidden;height:1.1em;line-height:1.1em;vertical-align:middle;';
    const inner = document.createElement('span');
    inner.style.cssText = 'display:block;';
    let frames = '';
    for (let n = 0; n <= d; n++) frames += `<span style="display:block;height:1.1em;line-height:1.1em;text-align:center;">${n}</span>`;
    inner.innerHTML = frames;
    col.appendChild(inner);
    el.appendChild(col);
    setTimeout(() => {
      inner.style.cssText = `display:block;transition:transform 2.2s cubic-bezier(.22,.68,0,1.1);transform:translateY(-${d * 1.1}em);`;
    }, 80 + i * 100);
  });
  if (suffix) {
    const s = document.createElement('span');
    s.style.cssText = 'display:inline-block;';
    s.textContent = suffix;
    el.appendChild(s);
  }
}

// ── Global state ─────────────────────────────────────────────────────────
export let state = {
  guardian: null,
  children: [],
  activeChild: null,
  activeSection: 'attendance',
};

// ── Lightbox ──────────────────────────────────────────────────────────────
function openLightbox(src, alt = '') {
  const lb = document.getElementById('img-lightbox');
  const img = document.getElementById('img-lightbox-img');
  if (!lb || !img) return;
  img.src = src; img.alt = alt;
  lb.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('open')));
  const close = () => {
    lb.classList.remove('open');
    setTimeout(() => { lb.style.display = 'none'; img.src = ''; }, 400);
  };
  lb.querySelector('.img-lightbox-close').onclick = close;
  lb.querySelector('.img-lightbox-backdrop').onclick = close;
}

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

  // Update status bar theme-color per screen
  const themeColors = { 'screen-login': '#0b2e4d', 'screen-dashboard': '#1e3a8a', 'screen-profile': '#1e3a8a' };
  const meta = document.getElementById('theme-color-meta');
  if (meta && themeColors[screenId]) meta.setAttribute('content', themeColors[screenId]);

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
  initMotion();
  attachRippleAll('.btn, .profile-nav-btn');

  const token = localStorage.getItem('guardian_token');
  const savedData = localStorage.getItem('guardian_data');

  window.addEventListener('login-success', async e => {
    const incoming = e.detail;
    // If API already gave us children, use them; otherwise fetch full profile
    if (incoming?.children?.length) {
      state.guardian = incoming;
    } else {
      // verifyOtp may not always return children — fetch full profile
      state.guardian = incoming;
      try {
        const phone = incoming?.phone || localStorage.getItem('guardian_phone') || '';
        const profileRes = await getUserDetails(phone);
        if (!profileRes.HasError && profileRes.results) {
          state.guardian = { ...incoming, ...profileRes.results, phone: incoming.phone };
        }
      } catch (_) {}
    }
    await loadDashboard();
  });

  if (token && savedData) {
    try {
      state.guardian = JSON.parse(savedData);
      // Restore active child only when returning mid-session (e.g. camera return)
      // sessionStorage survives page reload but not app close/reopen
      const sessionChild = sessionStorage.getItem('active_child');
      if (sessionChild) {
        try { state.activeChild = JSON.parse(sessionChild); } catch (_) {}
        const sessionSection = sessionStorage.getItem('active_section');
        if (sessionSection) state.activeSection = sessionSection;
      }
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
  if (e.target.closest('#logout-btn-2')) {
    logout();
  }
});

// Profile screen three-dot
document.addEventListener('DOMContentLoaded', () => {
  const dot2 = document.getElementById('gh-three-dot-2');
  const act2 = document.getElementById('gh-actions-2');
  if (dot2 && act2) {
    dot2.addEventListener('click', () => act2.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#gh-three-dot-2') && !e.target.closest('#gh-actions-2'))
        act2.classList.remove('open');
    });
  }
});

async function loadDashboard() {
  if (!state.guardian) {
    const res = await getUserDetails('');
    if (!res.HasError) state.guardian = res.results;
  }

  // Populate header user info with entrance animation
  const hdrName = document.getElementById('hdr-guardian-name');
  if (hdrName) {
    hdrName.textContent = state.guardian?.name || 'অভিভাবক';
    hdrName.style.cssText += 'opacity:0;transform:translateY(10px);transition:opacity .6s ease,transform .6s ease;';
    requestAnimationFrame(() => setTimeout(() => {
      hdrName.style.opacity = '1';
      hdrName.style.transform = 'translateY(0)';
    }, 100));
  }
  const hdrPhone = document.getElementById('hdr-guardian-phone');
  if (hdrPhone) {
    const ph = state.guardian?.phone || localStorage.getItem('guardian_phone') || '';
    if (ph) {
      hdrPhone.textContent = `📱 ${ph}`;
      hdrPhone.style.cssText += 'opacity:0;transform:translateY(8px);transition:opacity .6s ease,transform .6s ease;';
      requestAnimationFrame(() => setTimeout(() => {
        hdrPhone.style.opacity = '1';
        hdrPhone.style.transform = 'translateY(0)';
      }, 220));
    }
  }


  // Three-dot toggle
  const ghThreeDot = document.getElementById('gh-three-dot');
  const ghActions = document.getElementById('gh-actions');
  if (ghThreeDot && ghActions && !ghThreeDot.dataset.bound) {
    ghThreeDot.dataset.bound = '1';
    ghThreeDot.addEventListener('click', () => ghActions.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#gh-three-dot') && !e.target.closest('#gh-actions'))
        ghActions.classList.remove('open');
    });
  }

  state.children = state.guardian?.children || [];

  if (state.activeChild) {
    // Returning mid-session (e.g. after camera) — restore previous profile
    showStudentProfile(state.activeSection || 'leave');
  } else if (state.children.length === 1) {
    state.activeChild = state.children[0];
    showStudentProfile();
  } else {
    renderChildSelector();
    navigateTo('screen-dashboard');
  }

  attachRipple(document.getElementById('logout-btn'));
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Notification bell — attach once
  const notifBtn = document.getElementById('dash-notif-btn');
  if (notifBtn && !notifBtn.dataset.bound) {
    notifBtn.dataset.bound = '1';
    notifBtn.addEventListener('click', () => {
      if (state.children.length === 1) {
        state.activeChild = state.children[0];
        showStudentProfile('notice');
      } else if (state.children.length > 1) {
        // multi-child: open first child's notice tab
        state.activeChild = state.children[0];
        showStudentProfile('notice');
      }
    });
  }
}

// ── Child Selector ────────────────────────────────────────────────────────
function renderChildSelector() {
  const grid = document.getElementById('children-grid');
  if (!grid) return;

  grid.innerHTML = '';
  state.children.forEach((child, idx) => {
    const dot = child.todayAttendance === 'Present' ? '#22C55E' : '#EF4444';
    const initials = child.fullName.slice(0, 1);
    const card = document.createElement('div');
    card.className = 'child-card card-lift child-card-anim';
    card.style.animationDelay = (150 + idx * 280) + 'ms';
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
function showStudentProfile(openSection = null) {
  const child = state.activeChild;
  if (!child) return;
  sessionStorage.setItem('active_child', JSON.stringify(child));

  // Populate hero
  const nameEl = document.getElementById('profile-name');
  if (nameEl) {
    nameEl.textContent = child.fullName;
    nameEl.classList.remove('marquee-name');
    // marquee only if overflows — use a short delay for layout to settle
    setTimeout(() => {
      if (nameEl.scrollWidth > nameEl.offsetWidth + 2) {
        nameEl.classList.add('marquee-name');
      }
    }, 100);
  }
  const nameBnEl = document.getElementById('profile-name-bn');
  if (nameBnEl) nameBnEl.textContent = child.nameBangla || '';

  const idEl = document.getElementById('profile-student-id');
  if (idEl) idEl.textContent = child.studentInsID ? `🎓 ${child.studentInsID}` : '';

  const avatarEl = document.getElementById('profile-avatar');
  avatarEl.classList.remove('avatar-zoom-in', 'has-photo');
  void avatarEl.offsetWidth;
  if (child.photoUrl) {
    avatarEl.innerHTML = `<img src="${child.photoUrl}" alt="${child.fullName}">`;
    avatarEl.classList.add('has-photo');
    avatarEl.onclick = () => openLightbox(child.photoUrl, child.fullName);
  } else {
    avatarEl.textContent = child.fullName.slice(0, 1);
    avatarEl.onclick = null;
  }
  avatarEl.classList.add('avatar-zoom-in');

  // Info chips — class, section, group, roll
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
    ].join('');
  }

  // Quick stats
  document.getElementById('qs-attendance').textContent = child.todayAttendance === 'Present' ? '✓' : '✗';
  document.getElementById('qs-homework').textContent = child.homeworkPending;
  document.getElementById('qs-fees').textContent = child.feesDue > 0 ? `৳${child.feesDue}` : '০';
  document.getElementById('qs-notice').textContent = child.noticeUnread;

  navigateTo('screen-profile');
  initProfileNav(openSection);
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

  // Attendance — this month's present count
  const attData = attRes?.results || {};
  const totalPresent = attData.totalPresent ?? 0;
  const totalSchool  = (attData.days || []).filter(d => d.dayType === 'R').length;
  const attEl = document.getElementById('qs-attendance');
  if (attEl) {
    if (totalSchool) slotAnimate(attEl, `${totalPresent}/${totalSchool}`);
    else attEl.textContent = '—';
  }

  // Homework pending
  const hwList = Array.isArray(hwRes?.results) ? hwRes.results : [];
  const pending = hwList.filter(h => !h.isSubmitted && !h.IsSubmitted).length;
  const hwEl = document.getElementById('qs-homework');
  if (hwEl) slotAnimate(hwEl, String(pending));

  // Fees due
  const due = dueRes?.results?.dueAmount ?? 0;
  const feesEl = document.getElementById('qs-fees');
  if (feesEl) {
    if (due > 0) slotAnimate(feesEl, String(due.toLocaleString()), '৳');
    else feesEl.textContent = '০';
  }

  // Notices unread
  const notices = Array.isArray(noticeRes?.results) ? noticeRes.results : [];
  const unread = notices.filter(n => !n.isRead).length;
  const noticeEl = document.getElementById('qs-notice');
  if (noticeEl) slotAnimate(noticeEl, String(unread));

  // Dashboard notification badge
  const badge = document.getElementById('dash-notif-badge');
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

}

// ── Profile Navigation Tabs ───────────────────────────────────────────────
function initProfileNav(openSection = null) {
  const navEl  = document.querySelector('.profile-nav');
  const navBtns = document.querySelectorAll('.profile-nav-btn');

  // Sliding indicator — reinit each time profile opens
  if (navEl) {
    navEl._indicatorAttached = false;
    navEl.querySelector('.tab-indicator')?.remove();
  }
  const { moveTo } = initTabIndicator(navEl, { autoWire: false });

  // Remove old listeners by replacing each button with a clone
  navBtns.forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
  });
  const freshBtns = document.querySelectorAll('.profile-nav-btn');

  function scrollTabToCenter(btn) {
    const navRect = navEl.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offset = btnRect.left - navRect.left + navEl.scrollLeft - (navRect.width / 2) + (btnRect.width / 2);
    navEl.scrollTo({ left: offset, behavior: 'smooth' });
  }

  freshBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      freshBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      moveTo(btn);
      scrollTabToCenter(btn);
      loadSection(btn.dataset.section);
    });
  });

  // Determine which section to open
  const defaultSection = openSection || 'attendance';
  const activeBtn = document.querySelector(`.profile-nav-btn[data-section="${defaultSection}"]`)
    || document.querySelector('.profile-nav-btn');
  freshBtns.forEach(b => b.classList.remove('active'));
  activeBtn?.classList.add('active');

  // Position indicator and scroll active tab into view
  requestAnimationFrame(() => {
    moveTo(activeBtn);
    if (activeBtn) scrollTabToCenter(activeBtn);
  });

  // Load section
  loadSection(defaultSection);

  // Back button — re-attach on fresh clone isn't needed, use delegation
  const backBtn = document.getElementById('profile-back-btn');
  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = '1';
    backBtn.addEventListener('click', () => {
      if (state.children.length > 1) {
        state.activeChild = null;
        sessionStorage.removeItem('active_child');
        sessionStorage.removeItem('active_section');
        renderChildSelector();
        navigateTo('screen-dashboard', { back: true });
      }
    });
    attachRipple(backBtn);
  }

  // Hero stats → navigate to section (rebind every time so moveTo is current)
  document.querySelectorAll('.hero-stat[data-nav-section]').forEach(card => {
    const fresh = card.cloneNode(true);
    card.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      const section = fresh.dataset.navSection;
      const btn = document.querySelector(`.profile-nav-btn[data-section="${section}"]`);
      if (!btn) return;
      freshBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      requestAnimationFrame(() => moveTo(btn));
      loadSection(section);
    });
  });
}

function loadSection(section) {
  const content = document.getElementById('profile-content');
  content.innerHTML = _skeletonCards(3);
  state.activeSection = section;
  sessionStorage.setItem('active_section', section);

  // Logo spin on section switch
  const logoEl = document.querySelector('.thb-avatar, .guardian-avatar, [id*="avatar"]');
  if (logoEl) spinLogo(logoEl);

  const child = state.activeChild;
  switch (section) {
    case 'attendance': loadAttendance(content, child); break;
    case 'leave':      loadGuardianLeave(content, child, state.guardian); break;
    case 'homework':   loadHomework(content, child);   break;
    case 'fees':       loadFees(content, child);       break;
    case 'exam':       loadExam(content, child); break;
    case 'notice':     loadNotices(content, child);    break;
  }

  // After a tick, settle whatever was rendered
  setTimeout(() => {
    crossfadeIn(content);
    settleContent(content);
    markScrollReveal(content);
    initPullToRefresh(content, () => loadSection(section));
  }, 50);
}

function _skeletonCards(n) {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton-card mb-12"></div>`).join('');
}

