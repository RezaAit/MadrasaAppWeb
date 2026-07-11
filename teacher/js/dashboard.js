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
import { initMotion, settleContent, crossfadeIn, initCountUp, markScrollReveal, spinLogo, initPullToRefresh } from '../../shared/js/motion.js';

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
  document.getElementById('__ext-fab')?.remove();

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
  const initials = t?.name?.slice(0, 1) || 'শি';
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

  document.getElementById('teacher-fullname').textContent = t?.name || 'শিক্ষক';
  document.getElementById('teacher-designation').textContent = t?.designation || '';
  document.getElementById('teacher-role-badge').textContent = roleLabel;

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

  document.getElementById('teacher-logout-btn').addEventListener('click', logout);

  // Avatar → profile
  document.getElementById('teacher-initials').style.cursor = 'pointer';
  document.getElementById('teacher-initials').addEventListener('click', () => navigateTo('profile'));

  navigateTo('dashboard');
}

async function loadDashboardModule(container) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'শুভ সকাল' : hour < 17 ? 'শুভ অপরাহ্ন' : 'শুভ সন্ধ্যা';
  const arrow = `<div class="dash-arrow"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>`;

  // Show skeleton first
  container.innerHTML = `
    <div class="stagger-in">
      <div class="dash-greeting">
        <div class="dash-greeting-date">${dateStr}</div>
        <div class="dash-greeting-title">${greeting} 👋</div>
      </div>
      <div class="dash-grid" id="dash-cards" style="min-height:420px;">
        ${Array(4).fill('<div class="skeleton skeleton-card" style="height:110px;border-radius:20px;"></div>').join('')}
        <div class="skeleton skeleton-card dash-card--wide" style="height:68px;border-radius:20px;grid-column:1/-1;"></div>
        <div class="skeleton skeleton-card" style="height:110px;border-radius:20px;"></div>
        <div class="skeleton skeleton-card" style="height:110px;border-radius:20px;"></div>
      </div>
    </div>`;

  // Fetch all in parallel
  const [sectionsRes, leavesRes, hwRes, feesRes] = await Promise.allSettled([
    import('./api.js').then(m => m.getMySections()),
    import('./api.js').then(m => m.getPendingLeaves()),
    import('./api.js').then(m => m.getHomeworkList()),
    import('./api.js').then(m => m.getClassFeesSummary()),
  ]);

  const sections   = sectionsRes.value?.results;
  const subjectSec = sections?.subjectSections?.length ?? '—';
  const ctSec      = sections?.classTeacherSections?.length ?? 0;
  const leaves     = leavesRes.value?.results?.filter(l => (l.Status ?? l.status) === 'Pending').length ?? '—';
  const hwList     = hwRes.value?.results || [];
  const hwPending  = hwList.filter(h => h.status === 'Published').length;
  const feesList   = feesRes.value?.results || [];
  const totalDue   = feesList.reduce((a, c) => a + (c.totalDue || 0), 0);
  const dueStudents= feesList.reduce((a, c) => a + (c.dueStudents || 0), 0);

  document.getElementById('dash-cards').innerHTML = `
    <div class="dash-card dash-card-blue" data-nav="attendance">
      <div>
        <div class="dash-label">উপস্থিতি</div>
        <div class="dash-value" data-count-up="${ctSec}">${ctSec}</div>
        <span class="dash-value-unit">সেকশন</span>
      </div>
      <div style="position:absolute;bottom:14px;right:14px;opacity:.6;">${_attIcon(22)}</div>
    </div>

    <div class="dash-card dash-card-amber" data-nav="homework">
      <div>
        <div class="dash-label">হোমওয়ার্ক</div>
        <div class="dash-value" data-count-up="${hwList.length}">${hwList.length}</div>
        <span class="dash-value-unit">টি মোট</span>
      </div>
      ${hwPending > 0 ? `<div class="dash-sub dash-sub-amber">⏳ ${hwPending} প্রকাশিত</div>` : ''}
      <div style="position:absolute;bottom:14px;right:14px;opacity:.6;">${_hwIcon(22)}</div>
    </div>

    <div class="dash-card dash-card-purple" data-nav="leave">
      <div>
        <div class="dash-label">ছুটির আবেদন</div>
        <div class="dash-value" data-count-up="${leaves}">${leaves}</div>
        <span class="dash-value-unit">অপেক্ষমান</span>
      </div>
      ${leaves === 0 ? `<div class="dash-sub dash-sub-green">✓ মিটমাট</div>` : ''}
      <div style="position:absolute;bottom:14px;right:14px;opacity:.6;">${_leaveIcon(22)}</div>
    </div>

    <div class="dash-card dash-card-green" data-nav="marks">
      <div>
        <div class="dash-label">নম্বর এন্ট্রি</div>
        <div class="dash-value" data-count-up="${subjectSec}">${subjectSec}</div>
        <span class="dash-value-unit">বিষয়</span>
      </div>
      <div style="position:absolute;bottom:14px;right:14px;opacity:.6;">${_marksIcon(22)}</div>
    </div>

    <div class="dash-card dash-card-red dash-card--wide" data-nav="fees">
      <div class="dash-icon dash-icon-red">${_feesIcon(22)}</div>
      <div style="flex:1;min-width:0;">
        <div class="dash-label">ফি বকেয়া</div>
        <div style="display:flex;align-items:baseline;gap:6px;">
          <div class="dash-value" data-count-up="${dueStudents > 0 ? dueStudents : 0}">${dueStudents > 0 ? dueStudents : '০'}</div>
          <span class="dash-value-unit" style="display:inline;margin:0;">শিক্ষার্থী</span>
        </div>
      </div>
      ${totalDue > 0 ? `<div class="dash-sub dash-sub-red" style="white-space:nowrap;">৳${totalDue.toLocaleString()}</div>` : `<div class="dash-sub dash-sub-green">✓ বকেয়া নেই</div>`}
    </div>

    <div class="dash-card dash-card-blue dash-card--wide" data-nav="notice">
      <div class="dash-icon dash-icon-blue">${_noticeIcon(22)}</div>
      <div style="flex:1;min-width:0;">
        <div class="dash-label">নোটিশ</div>
        <div style="font-size:.95rem;font-weight:700;color:#1e40af;margin-top:2px;">নতুন নোটিশ তৈরি করুন →</div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.nav));
  });
  attachRippleAll('.dash-card', container);

  // Animate in + count-up + scroll reveal
  const cardsEl = document.getElementById('dash-cards');
  if (cardsEl) {
    crossfadeIn(cardsEl);
    settleContent(cardsEl);
    initCountUp(cardsEl);
    markScrollReveal(cardsEl);
  }

  // Pull-to-refresh on main-content scroll area
  const scrollArea = document.getElementById('main-content');
  initPullToRefresh(scrollArea, async () => {
    const { loadDashboardModule: _ld } = await import('./dashboard.js').catch(() => ({}));
    navigateTo('dashboard');
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
