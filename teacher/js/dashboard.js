import { getDashboardSummary } from './api.js';
import { BASE_URL } from '../../shared/js/api-config.js';
import { initLogin, checkAuth, logout } from './auth.js';
import { attachRippleAll } from '../../shared/js/ripple.js';
import { initTabIndicator } from '../../shared/js/tab-indicator.js';
import { loadAttendanceModule } from './attendance.js';
import { loadLeaveModule } from './leave.js';
import { loadHomeworkModule } from './homework-create.js';
import { loadFeesModule } from './fees.js';
import { loadMarksModule } from './marks-entry.js';
import { loadNoticeModule } from './notice.js';
import { loadProfileModule } from './profile.js';
import { initMotion, crossfadeIn, initCountUp, spinLogo } from '../../shared/js/motion.js';

export let state = {
  teacher: null,
  activeModule: 'dashboard',
  previousModule: 'dashboard',
};

// Mounts an Extended FAB on document.body (avoids overflow clipping).
// Returns the button element. Call fab.remove() to clean up.
export function _mountFAB(innerHtml) {
  document.getElementById('__ext-fab')?.remove();
  const btn = document.createElement('button');
  btn.id = '__ext-fab';
  btn.className = 'ext-fab';
  btn.innerHTML = innerHtml;
  document.body.appendChild(btn);
  return btn;
}

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

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

export function navigateTo(moduleKey) {
  if (state.activeModule !== moduleKey) state.previousModule = state.activeModule;
  state.activeModule = moduleKey;
  sessionStorage.setItem('teacher_active_module', moduleKey);

  // Active class + indicator + scroll into view
  const nav = document.getElementById('main-nav');
  let activeBtn = null;
  document.querySelectorAll('.main-nav-btn').forEach(b => {
    const match = b.dataset.module === moduleKey;
    b.classList.toggle('active', match);
    if (match) activeBtn = b;
  });
  if (activeBtn) {
    // Move tab indicator
    if (nav?._moveIndicator) nav._moveIndicator(activeBtn);
    // Scroll active tab into view smoothly
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Hide wave when profile (has own hero), show for all others
  const waveSep = document.querySelector('.thb-wave-sep');
  if (waveSep) waveSep.style.display = moduleKey === 'profile' ? 'none' : '';
  window.__tdFabCleanup?.();

  // Logo spin on tab switch
  const logoEl = document.getElementById('teacher-initials');
  if (logoEl) spinLogo(logoEl);

  const content = document.getElementById('main-content');
  content.innerHTML = _skeleton();
  switch (moduleKey) {
    case 'dashboard':  loadDashboardModule(content); break;
    case 'attendance': loadAttendanceModule(content, state.teacher); break;
    case 'leave':      loadLeaveModule(content, state.teacher); break;
    case 'homework':   loadHomeworkModule(content, state.teacher); break;
    case 'fees':       loadFeesModule(content, state.teacher); break;
    case 'marks':      loadMarksModule(content, state.teacher); break;
    case 'notice':     loadNoticeModule(content, state.teacher); break;
    case 'profile':    loadProfileModule(content, state.teacher); break;
  }
}

export async function init() {
  initMotion();

  window.addEventListener('teacher-session-expired', () => {
    showScreen('screen-login');
    initLogin();
    showToast('সেশন শেষ হয়েছে, আবার লগইন করুন', 'error');
  });

  if (!checkAuth()) {
    showScreen('screen-login');
    initLogin();
    window.addEventListener('teacher-login-success', e => {
      state.teacher = e.detail;
      showScreen('screen-main');
      renderShell();
    });
    return;
  }
  const raw = localStorage.getItem('teacher_data');
  if (raw) state.teacher = JSON.parse(raw);
  showScreen('screen-main');
  renderShell();
}

function renderShell() {
  const t = state.teacher;
  const initials = t?.name?.slice(0, 1) || '';
  const roleLabel = t?.isPrincipal ? (t?.designation || 'অধ্যক্ষ') : 'শিক্ষক';

  // Avatar: photo if available, else initials
  const avatarEl = document.getElementById('teacher-initials');
  if (t?.userId) {
    const token = localStorage.getItem('teacher_token');
    const img = document.createElement('img');
    img.src = `${BASE_URL}/api/Teacher/photo/${t.userId}`;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
    img.onerror = () => { avatarEl.textContent = initials; };
    img.onload = () => { avatarEl.innerHTML = ''; avatarEl.appendChild(img); };
    // Trigger load with auth header via fetch then objectURL
    fetch(img.src, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob) {
          img.src = URL.createObjectURL(blob);
          avatarEl.innerHTML = '';
          avatarEl.appendChild(img);
        } else {
          avatarEl.textContent = initials;
        }
      })
      .catch(() => { avatarEl.textContent = initials; });
  } else {
    avatarEl.textContent = initials;
  }

  const nameEl = document.getElementById('teacher-fullname');
  const nameText = t?.name || '';
  // Marquee only if name overflows — wrap in inner span, duplicate for seamless loop
  nameEl.innerHTML = `<span class="name-inner">${nameText}</span>`;
  requestAnimationFrame(() => {
    const inner = nameEl.querySelector('.name-inner');
    if (inner && inner.scrollWidth > nameEl.clientWidth) {
      // duplicate text for seamless loop
      inner.textContent = nameText + '      ' + nameText;
      inner.classList.add('scrolling');
    }
  });
  document.getElementById('teacher-designation').textContent = t?.designation || '';
  const roleBadgeEl = document.getElementById('teacher-role-badge');
  if (roleBadgeEl) roleBadgeEl.textContent = roleLabel;

  // Build nav based on role
  const navItems = [
    { key: 'dashboard', label: 'হোম', icon: _homeIcon() },
    { key: 'attendance', label: 'উপস্থিতি', icon: _attIcon() },
    { key: 'leave', label: 'ছুটি', icon: _leaveIcon() },
    { key: 'homework', label: 'হোমওয়ার্ক', icon: _hwIcon() },
    { key: 'fees', label: 'ফি', icon: _feesIcon() },
    { key: 'marks', label: 'নম্বর', icon: _marksIcon() },
    { key: 'notice', label: 'নোটিশ', icon: _noticeIcon() },
  ];

  const nav = document.getElementById('main-nav');
  nav.innerHTML = navItems.map(item => `
    <button class="main-nav-btn ${item.key === 'dashboard' ? 'active' : ''}" data-module="${item.key}">
      ${item.icon} ${item.label}
    </button>
  `).join('');

  const { moveTo: moveIndicator } = initTabIndicator(nav, { autoWire: false });
  nav._moveIndicator = moveIndicator; // store for programmatic use

  nav.querySelectorAll('.main-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      moveIndicator(btn);
      navigateTo(btn.dataset.module);
    });
  });
  attachRippleAll('.main-nav-btn', nav);

  // Position indicator on initial active tab after layout renders
  requestAnimationFrame(() => moveIndicator(nav.querySelector('.main-nav-btn.active')));

  // Three-dot menu
  const threeDot   = document.getElementById('thb-three-dot');
  const actions    = document.getElementById('thb-actions');
  const refreshBtn = document.getElementById('teacher-refresh-btn');
  const logoutBtn  = document.getElementById('teacher-logout-btn');
  const closeDrawer = () => actions.classList.remove('open');

  // Remove old listeners by replacing with clones, then re-query
  threeDot.replaceWith(threeDot.cloneNode(true));
  refreshBtn.replaceWith(refreshBtn.cloneNode(true));
  logoutBtn.replaceWith(logoutBtn.cloneNode(true));

  document.getElementById('thb-three-dot').addEventListener('click', (e) => {
    e.stopPropagation();
    actions.classList.toggle('open');
  });
  document.getElementById('teacher-refresh-btn').addEventListener('click', async () => {
    closeDrawer();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      showToast('ক্যাশ পরিষ্কার হচ্ছে…', 'success');
      setTimeout(() => location.reload(true), 800);
    } catch {
      location.reload(true);
    }
  });
  document.getElementById('teacher-logout-btn').addEventListener('click', () => {
    closeDrawer();
    logout();
  });

  // Close on outside tap
  document.removeEventListener('click', document.__thbOutsideHandler);
  document.__thbOutsideHandler = () => closeDrawer();
  document.addEventListener('click', document.__thbOutsideHandler);

  // Avatar → profile
  document.getElementById('teacher-initials').style.cursor = 'pointer';
  document.getElementById('teacher-initials').addEventListener('click', () => navigateTo('profile'));

  _mountDashFAB();

  const savedModule = sessionStorage.getItem('teacher_active_module') || 'dashboard';
  navigateTo(savedModule);
}

async function loadDashboardModule(container) {
  // Dynamic greeting based on local time
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour >= 5 && hour < 12 ? 'শুভ সকাল 👋'
                 : hour >= 12 && hour < 17 ? 'শুভ দুপুর 👋'
                 : 'শুভ সন্ধ্যা 👋';
  const dateStr = now.toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long' });

  // Skeleton
  container.innerHTML = `
    <div>
      <div class="td-greet-row">
        <div>
          <div class="td-date-line">${dateStr}</div>
          <div class="td-greet-line">${greeting}</div>
        </div>
        <span class="td-term-pill" id="td-term-label">—</span>
      </div>
      <div class="td-cards" id="td-cards">
        <div class="skeleton skeleton-card" style="height:80px;border-radius:18px;"></div>
        <div class="td-grid">
          <div class="skeleton skeleton-card" style="height:130px;border-radius:18px;"></div>
          <div class="skeleton skeleton-card" style="height:130px;border-radius:18px;"></div>
          <div class="skeleton skeleton-card" style="height:130px;border-radius:18px;"></div>
          <div class="skeleton skeleton-card" style="height:130px;border-radius:18px;"></div>
        </div>
        <div class="skeleton skeleton-card" style="height:70px;border-radius:18px;"></div>
      </div>
    </div>`;

  // Fetch all in parallel
  const [sectionsRes, leavesRes, hwRes, feesRes, noticeRes] = await Promise.allSettled([
    import('./api.js').then(m => m.getMySections()),
    import('./api.js').then(m => m.getPendingLeaves()),
    import('./api.js').then(m => m.getHomeworkList()),
    import('./api.js').then(m => m.getClassFeesSummary()),
    import('./api.js').then(m => m.getTeacherNotices()),
  ]);

  const sections    = sectionsRes.value?.results;
  const subjectSec  = sections?.subjectSections?.length ?? 0;
  const ctSec       = sections?.classTeacherSections?.length ?? 0;
  const leaves      = leavesRes.value?.results?.filter(l => (l.Status ?? l.status) === 'Pending').length ?? 0;
  const hwList      = hwRes.value?.results || [];
  const hwPublished = hwList.filter(h => h.status === 'Published').length;
  const feesList    = feesRes.value?.results || [];
  const totalDue    = feesList.reduce((a, c) => a + (c.totalDue || 0), 0);
  const dueStudents = feesList.reduce((a, c) => a + (c.dueStudents || 0), 0);
  const notices     = noticeRes.value?.results || [];
  const unreadCount = notices.filter(n => !n.isRead).length;

  // Attendance badge: check if ct sections have today's attendance taken
  const attBadge = ctSec > 0
    ? `<div class="td-badge ok">✓ আজ নেওয়া হয়েছে</div>`
    : `<div class="td-badge warn">⏳ বাকি আছে</div>`;

  const hwBadge = hwPublished > 0
    ? `<div class="td-badge warn">⏳ ${_bn(hwPublished)} প্রকাশিত</div>`
    : `<div class="td-badge ok">✓ সব ঠিকঠাক</div>`;

  const leavesBadge = leaves > 0
    ? `<div class="td-badge info">⏳ অপেক্ষমান</div>`
    : `<div class="td-badge ok">✓ মিটমাট</div>`;

  const marksBadge = subjectSec > 0
    ? `<div class="td-badge warn">⏳ বাকি আছে</div>`
    : `<div class="td-badge ok">✓ সম্পন্ন</div>`;

  // Fee card content
  const feeContent = totalDue > 0
    ? `<div class="td-fee-amount" id="td-fee-amount-val">৳০</div>
       <div class="td-fee-sub">${_bn(dueStudents)} জন শিক্ষার্থী</div>`
    : `<div class="td-fee-amount" style="font-size:1rem;color:var(--td-green);">✓ বকেয়া নেই</div>`;

  // Notice unread badge
  const unreadBadge = unreadCount > 0
    ? `<div class="td-unread-badge">${_bn(Math.min(unreadCount, 99))}</div>` : '';

  document.getElementById('td-cards').innerHTML = `
    <!-- Priority: Fee alert -->
    <div class="td-fee-card" data-nav="fees">
      <div class="td-fee-ic">${_feesIcon(22)}</div>
      <div class="td-fee-info">
        <div class="td-fee-label">ফি বকেয়া</div>
        ${feeContent}
      </div>
      <div class="td-fee-chev">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>

    <!-- 2×2 stat grid -->
    <div class="td-grid">
      <div class="td-stat c-green" data-nav="attendance">
        <div class="td-stat-top">
          <span class="td-stat-label">উপস্থিতি</span>
          <div class="td-stat-ic">${_attIcon(16)}</div>
        </div>
        <div class="td-stat-val" data-count-up="${ctSec}">${_bn(ctSec)}</div>
        <div class="td-stat-sub">সেকশন</div>
        ${attBadge}
      </div>

      <div class="td-stat c-amber" data-nav="homework">
        <div class="td-stat-top">
          <span class="td-stat-label">হোমওয়ার্ক</span>
          <div class="td-stat-ic">${_hwIcon(16)}</div>
        </div>
        <div class="td-stat-val" data-count-up="${hwList.length}">${_bn(hwList.length)}</div>
        <div class="td-stat-sub">টি মোট</div>
        ${hwBadge}
      </div>

      <div class="td-stat c-purple" data-nav="leave">
        <div class="td-stat-top">
          <span class="td-stat-label">ছুটির আবেদন</span>
          <div class="td-stat-ic">${_leaveIcon(16)}</div>
        </div>
        <div class="td-stat-val" data-count-up="${leaves}">${_bn(leaves)}</div>
        <div class="td-stat-sub">আবেদন</div>
        ${leavesBadge}
      </div>

      <div class="td-stat c-blue" data-nav="marks">
        <div class="td-stat-top">
          <span class="td-stat-label">নম্বর এন্ট্রি</span>
          <div class="td-stat-ic">${_marksIcon(16)}</div>
        </div>
        <div class="td-stat-val" data-count-up="${subjectSec}">${_bn(subjectSec)}</div>
        <div class="td-stat-sub">বিষয়</div>
        ${marksBadge}
      </div>
    </div>

    <!-- Notice card -->
    <div class="td-notice-card" data-nav="notice">
      <div class="td-notice-ic-wrap">
        <div class="td-notice-ic">${_noticeIcon(20)}</div>
        ${unreadBadge}
      </div>
      <div class="td-notice-text">
        <div class="td-notice-lbl">নোটিশ</div>
        <div class="td-notice-cta">নতুন নোটিশ তৈরি করুন →</div>
      </div>
    </div>
  `;

  // Nav clicks
  container.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.nav));
  });

  // Fee amount count-up animation
  if (totalDue > 0) {
    const feeAmountEl = document.getElementById('td-fee-amount-val');
    if (feeAmountEl) {
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * totalDue);
        feeAmountEl.textContent = '৳' + current.toLocaleString('bn-BD');
        if (progress < 1) requestAnimationFrame(tick);
        else feeAmountEl.textContent = '৳' + _bnNum(totalDue);
      };
      requestAnimationFrame(tick);
    }
  }

  // Animations (no layout-shifting effects)
  const cardsEl = document.getElementById('td-cards');
  if (cardsEl) {
    crossfadeIn(cardsEl);
    initCountUp(cardsEl);
  }

}

function _bn(n) {
  if (n === null || n === undefined || n === '—') return '—';
  return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
}

function _bnNum(n) {
  return n.toLocaleString('bn-BD');
}

function _mountDashFAB() {
  // Remove any existing ext-fab first
  document.getElementById('__ext-fab')?.remove();
  document.getElementById('__td-fab-backdrop')?.remove();
  document.getElementById('__td-fab-menu')?.remove();
  document.getElementById('__td-fab')?.remove();

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = '__td-fab-backdrop';
  backdrop.className = 'td-fab-backdrop';
  document.body.appendChild(backdrop);

  // Menu
  const menu = document.createElement('div');
  menu.id = '__td-fab-menu';
  menu.className = 'td-fab-menu';
  menu.innerHTML = `
    <div class="td-fab-action" data-nav="attendance">
      <span class="td-fab-action-label">উপস্থিতি নিন</span>
      <button class="td-fab-action-btn att">${_attIcon(18)}</button>
    </div>
    <div class="td-fab-action" data-nav="notice">
      <span class="td-fab-action-label">নোটিশ তৈরি</span>
      <button class="td-fab-action-btn ntc">${_noticeIcon(18)}</button>
    </div>
    <div class="td-fab-action" data-nav="homework">
      <span class="td-fab-action-label">হোমওয়ার্ক পোস্ট</span>
      <button class="td-fab-action-btn hw">${_hwIcon(18)}</button>
    </div>
  `;
  document.body.appendChild(menu);

  // FAB button
  const fab = document.createElement('button');
  fab.id = '__td-fab';
  fab.className = 'td-fab';
  fab.setAttribute('aria-label', 'Quick actions');
  fab.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  document.body.appendChild(fab);

  const toggle = (open) => {
    fab.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
  };

  fab.addEventListener('click', () => toggle(!menu.classList.contains('open')));
  backdrop.addEventListener('click', () => toggle(false));
  menu.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => { toggle(false); navigateTo(el.dataset.nav); });
  });

}

function _skeleton() {
  return `<div class="p-16">${Array.from({length:4},()=>'<div class="skeleton skeleton-card mb-12"></div>').join('')}</div>`;
}

function _homeIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`; }
function _attIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`; }
function _leaveIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`; }
function _hwIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`; }
function _feesIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`; }
function _marksIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`; }
function _noticeIcon(s=18) { return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`; }
