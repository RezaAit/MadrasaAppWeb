import { requestOtp, verifyOtp } from './api.js';
import { showToast } from './dashboard.js';

const OTP_COOLDOWN_SEC = 60;
const OTP_MAX_RESEND   = 3;

export function initLogin() {
  const phoneStep  = document.getElementById('phone-step');
  const otpStep    = document.getElementById('otp-step');
  const phoneInput = document.getElementById('phone-input');
  const sendOtpBtn = document.getElementById('send-otp-btn');
  const verifyBtn  = document.getElementById('verify-otp-btn');
  const changeNum  = document.getElementById('change-number');
  const displayNum = document.getElementById('display-number');

  let _otpSendCount = 0;
  let _cooldownTimer = null;

  function _startCooldown() {
    let remaining = OTP_COOLDOWN_SEC;
    const hint = document.getElementById('otp-resend-hint');
    _setBtn(sendOtpBtn, `${remaining}s পর আবার পাঠান`, true);
    if (hint) hint.textContent = `OTP না আসলে ${remaining}s পর আবার চেষ্টা করুন`;
    _cooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(_cooldownTimer);
        _cooldownTimer = null;
        if (_otpSendCount >= OTP_MAX_RESEND) {
          _setBtn(sendOtpBtn, 'সীমা শেষ', true);
          if (hint) hint.textContent = 'অনেকবার চেষ্টা করা হয়েছে। পরে আবার চেষ্টা করুন।';
        } else {
          _setBtn(sendOtpBtn, 'আবার পাঠাও', false);
          if (hint) hint.textContent = 'OTP না আসলে আবার পাঠাতে পারেন';
        }
      } else {
        sendOtpBtn.textContent = `${remaining}s পর আবার পাঠান`;
        if (hint) hint.textContent = `OTP না আসলে ${remaining}s পর আবার চেষ্টা করুন`;
      }
    }, 1000);
  }

  function _resetOtpLimit() {
    clearInterval(_cooldownTimer);
    _cooldownTimer = null;
    _otpSendCount = 0;
    _setBtn(sendOtpBtn, 'OTP পাঠাও', false);
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  sendOtpBtn.addEventListener('click', async () => {
    const raw = phoneInput.value.trim();
    const phone = /^0/.test(raw) ? raw : '0' + raw;

    if (!raw) { _loginError('মোবাইল নম্বর দিন'); return; }
    if (!/^01[3-9][0-9]{8}$/.test(phone)) { _loginError('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)'); return; }
    if (_otpSendCount >= OTP_MAX_RESEND) { _loginError('বারবার OTP পাঠানো যাবে না। কিছুক্ষণ পর চেষ্টা করুন।'); return; }

    _setBtn(sendOtpBtn, 'পাঠানো হচ্ছে...', true);

    try {
      const res = await requestOtp(phone);
      if (res?.httpStatusCode === 429) {
        _loginError(res.message || 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।');
        _setBtn(sendOtpBtn, 'OTP পাঠাও', false);
      } else if (res && (res.success === true || res.httpStatusCode === 200)) {
        _otpSendCount++;
        displayNum.textContent = phone;
        phoneStep.style.display = 'none';
        otpStep.style.display = 'block';
        _focusOtp();
        showToast('OTP পাঠানো হয়েছে ✓', 'success');
        _startCooldown();
      } else {
        _loginError(res?.message || 'OTP পাঠানো যায়নি। নম্বরটি সঠিক কিনা যাচাই করুন।');
        _setBtn(sendOtpBtn, 'OTP পাঠাও', false);
      }
    } catch (err) {
      _loginError('সার্ভারের সাথে সংযোগ নেই। ইন্টারনেট চেক করুন।');
      _setBtn(sendOtpBtn, 'OTP পাঠাও', false);
    }
  });

  // ── Back to phone ─────────────────────────────────────────────────────────
  changeNum.addEventListener('click', () => {
    _resetOtpLimit();
    otpStep.style.display = 'none';
    phoneStep.style.display = 'block';
    _clearError();
    _clearOtp();
  });

  // ── Verify OTP ────────────────────────────────────────────────────────────
  verifyBtn.addEventListener('click', async () => {
    const otp = _getOtp();
    if (!otp || otp.length < 6) { _loginError('৬ সংখ্যার OTP লিখুন'); return; }

    const raw = phoneInput.value.trim();
    const phone = /^0/.test(raw) ? raw : '0' + raw;
    _setBtn(verifyBtn, 'যাচাই হচ্ছে...', true);
    _clearError();

    try {
      const res = await verifyOtp(phone, otp);
      if (res?.success && res?.token) {
        localStorage.setItem('teacher_token', res.token);
        if (res.refreshToken) localStorage.setItem('teacher_refresh_token', res.refreshToken);
        localStorage.setItem('teacher_data', JSON.stringify(res.teacher));
        window.dispatchEvent(new CustomEvent('teacher-login-success', { detail: res.teacher }));
        return;
      }
      // Wrong OTP or server rejection
      const msg = res?.message || 'OTP সঠিক নয়। আবার চেষ্টা করুন।';
      _loginError(msg);
      _clearOtp();
      _focusOtp();
    } catch {
      _loginError('সার্ভারের সাথে সংযোগ নেই। ইন্টারনেট চেক করুন।');
    }

    _setBtn(verifyBtn, 'লগইন করো', false);
  });

  // ── OTP box navigation ────────────────────────────────────────────────────
  document.querySelectorAll('.otp-box').forEach((box, i, boxes) => {
    box.addEventListener('input', e => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      _clearError();
      if (val && i < boxes.length - 1) boxes[i + 1].focus();
      // Auto-submit when all 6 filled
      if (_getOtp().length === 6) verifyBtn.click();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      [...pasted].forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
      if (boxes[pasted.length - 1]) boxes[Math.min(pasted.length, 5)].focus();
      if (pasted.length === 6) setTimeout(() => verifyBtn.click(), 100);
    });
  });

  phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtpBtn.click(); });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _setBtn(btn, text, disabled) {
  btn.disabled = disabled;
  btn.textContent = text;
}

function _loginError(msg) {
  let el = document.getElementById('login-error-box');
  if (!el) {
    el = document.createElement('div');
    el.id = 'login-error-box';
    el.style.cssText = `
      background:#fef2f2; border:1.5px solid #fecaca; color:#dc2626;
      border-radius:10px; padding:10px 14px; font-size:.85rem; font-weight:600;
      margin-top:12px; display:flex; align-items:center; gap:8px; line-height:1.4;
    `;
    // Insert after active step
    const active = document.getElementById('otp-step')?.style.display !== 'none'
      ? document.getElementById('otp-step')
      : document.getElementById('phone-step');
    active?.appendChild(el);
  }
  el.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    ${msg}
  `;
}

function _clearError() {
  document.getElementById('login-error-box')?.remove();
}

function _getOtp() { return Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join(''); }
function _clearOtp() { document.querySelectorAll('.otp-box').forEach(b => b.value = ''); }
function _focusOtp() { const first = document.querySelector('.otp-box'); if (first) setTimeout(() => first.focus(), 100); }

export function checkAuth() { return !!localStorage.getItem('teacher_token'); }

let _logoutPrimed = false;
let _logoutTimer = null;

export function logout() {
  if (!_logoutPrimed) {
    // First touch — prime and show toast warning
    _logoutPrimed = true;
    _showLogoutWarning();
    _logoutTimer = setTimeout(() => {
      _logoutPrimed = false;
      _dismissLogoutWarning();
    }, 4000);
    return;
  }
  // Second touch — show confirm dialog
  clearTimeout(_logoutTimer);
  _logoutPrimed = false;
  _dismissLogoutWarning();
  _showLogoutConfirm();
}

function _showLogoutWarning() {
  const el = document.createElement('div');
  el.id = 'logout-warning';
  const shell = document.querySelector('.app-shell') || document.body;
  const shellRect = shell.getBoundingClientRect();
  el.style.cssText = `
    position:fixed;
    top:${shellRect.top + 68}px;
    left:${shellRect.left + 12}px;
    width:${shellRect.width - 24}px;
    background:#dc2626; color:#fff;
    padding:13px 16px; border-radius:14px;
    font-size:.88rem; font-weight:700;
    box-shadow:0 6px 20px rgba(220,38,38,.45);
    display:flex; align-items:center; gap:10px;
    z-index:9999;
    animation:slideDown 200ms ease;
  `;
  el.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" style="flex-shrink:0;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    <span style="flex:1;">লগআউট করতে আবার চাপুন</span>
    <span style="background:rgba(255,255,255,.25);padding:3px 10px;border-radius:8px;font-size:.8rem;font-weight:800;" id="logout-countdown">4s</span>
  `;
  document.body.appendChild(el);

  // Countdown
  let t = 4;
  const counter = document.getElementById('logout-countdown');
  const iv = setInterval(() => {
    t--;
    if (counter) counter.textContent = `${t}s`;
    if (t <= 0) clearInterval(iv);
  }, 1000);
  el._interval = iv;
}

function _dismissLogoutWarning() {
  const el = document.getElementById('logout-warning');
  if (el) { clearInterval(el._interval); el.remove(); }
}

function _showLogoutConfirm() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center;">
      <div style="width:56px;height:56px;border-radius:16px;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#dc2626" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </div>
      <div style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:8px;">লগআউট করবেন?</div>
      <div style="font-size:.85rem;color:#64748b;line-height:1.6;margin-bottom:20px;">আপনি অ্যাপ থেকে বের হয়ে যাবেন। পুনরায় প্রবেশ করতে OTP লাগবে।</div>
      <div style="display:flex;gap:10px;">
        <button id="lc-cancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:.9rem;font-weight:600;color:#64748b;cursor:pointer;font-family:inherit;">থাকুন</button>
        <button id="lc-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(37,99,235,.35);">লগআউট</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#lc-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#lc-ok').onclick = () => {
    overlay.remove();
    // Revoke refresh token on server (best-effort)
    const rt = localStorage.getItem('teacher_refresh_token');
    if (rt) { import('../../shared/js/api-config.js').then(({ BASE_URL }) => fetch(`${BASE_URL}/api/Auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) }).catch(() => {})); }
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('teacher_refresh_token');
    localStorage.removeItem('teacher_data');
    location.reload();
  };
}
