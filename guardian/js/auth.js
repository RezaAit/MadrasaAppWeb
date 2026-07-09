import { requestOtp, verifyOtp } from './api.js';
import { showToast, navigateTo } from './dashboard.js';

const OTP_COOLDOWN_SEC = 60;
const OTP_MAX_RESEND   = 3;

export function initLogin() {
  const phoneStep = document.getElementById('phone-step');
  const otpStep   = document.getElementById('otp-step');
  const phoneInput = document.getElementById('phone-input');
  const sendOtpBtn = document.getElementById('send-otp-btn');
  const verifyBtn  = document.getElementById('verify-otp-btn');
  const changeNum  = document.getElementById('change-number');
  const displayNum = document.getElementById('display-number');

  let _otpSendCount = 0;
  let _cooldownTimer = null;

  function _startCooldown() {
    let remaining = OTP_COOLDOWN_SEC;
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = `${remaining}s পর আবার পাঠান`;
    _cooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(_cooldownTimer);
        _cooldownTimer = null;
        if (_otpSendCount >= OTP_MAX_RESEND) {
          sendOtpBtn.textContent = 'সীমা শেষ';
          sendOtpBtn.disabled = true;
        } else {
          sendOtpBtn.disabled = false;
          sendOtpBtn.textContent = 'আবার পাঠাও';
        }
      } else {
        sendOtpBtn.textContent = `${remaining}s পর আবার পাঠান`;
      }
    }, 1000);
  }

  function _resetOtpLimit() {
    clearInterval(_cooldownTimer);
    _cooldownTimer = null;
    _otpSendCount = 0;
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = 'OTP পাঠাও';
  }

  sendOtpBtn.addEventListener('click', async () => {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 10) { showToast('সঠিক মোবাইল নম্বর দিন', 'error'); return; }
    if (_otpSendCount >= OTP_MAX_RESEND) { showToast('বারবার OTP পাঠানো যাবে না। কিছুক্ষণ পর চেষ্টা করুন।', 'error'); return; }
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'পাঠানো হচ্ছে...';
    try {
      const res = await requestOtp('0' + phone.replace(/^0/, ''));
      if (res.httpStatusCode === 429) {
        showToast(res.message || 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।', 'error');
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'OTP পাঠাও';
        return;
      }
      if (res.httpStatusCode === 200 || res.success !== false) {
        _otpSendCount++;
        displayNum.textContent = phone;
        phoneStep.style.display = 'none';
        otpStep.style.display = 'block';
        _focusOtp();
        showToast('OTP পাঠানো হয়েছে', 'success');
        _startCooldown();
      } else {
        showToast(res.message || 'ত্রুটি হয়েছে', 'error');
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'OTP পাঠাও';
      }
    } catch {
      showToast('সংযোগ সমস্যা', 'error');
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'OTP পাঠাও';
    }
  });

  changeNum.addEventListener('click', () => {
    _resetOtpLimit();
    otpStep.style.display = 'none';
    phoneStep.style.display = 'block';
    _clearOtp();
  });

  verifyBtn.addEventListener('click', async () => {
    const otp = _getOtp();
    if (!otp || otp.length < 4) { showToast('OTP লিখুন', 'error'); return; }
    const phone = phoneInput.value.trim();
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'যাচাই হচ্ছে...';
    try {
      const res = await verifyOtp('0' + phone.replace(/^0/, ''), otp);
      if (res.success !== false && res.token) {
        const guardianPhone = '0' + phone.replace(/^0/, '');
        const guardianData = { ...res.guardian, phone: guardianPhone };
        localStorage.setItem('guardian_token', res.token);
        localStorage.setItem('guardian_data', JSON.stringify(guardianData));
        localStorage.setItem('guardian_phone', guardianPhone);
        window.dispatchEvent(new CustomEvent('login-success', { detail: guardianData }));
      } else {
        showToast(res.message || 'ভুল OTP', 'error');
      }
    } catch { showToast('সংযোগ সমস্যা', 'error'); }
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'লগইন করো';
  });

  // OTP box navigation
  document.querySelectorAll('.otp-box').forEach((box, i, boxes) => {
    box.addEventListener('input', e => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      box.classList.toggle('filled', !!e.target.value);
      if (val && i < boxes.length - 1) boxes[i + 1].focus();
      if (_getOtp().length === 6) verifyBtn.click();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace') { box.classList.remove('filled'); if (!box.value && i > 0) boxes[i - 1].focus(); }
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      [...pasted].forEach((ch, j) => { if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('filled'); } });
      if (boxes[pasted.length - 1]) boxes[Math.min(pasted.length, 5)].focus();
      if (pasted.length === 6) setTimeout(() => verifyBtn.click(), 100);
    });
  });

  phoneInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendOtpBtn.click();
  });
}

function _getOtp() {
  return Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join('');
}
function _clearOtp() {
  document.querySelectorAll('.otp-box').forEach(b => b.value = '');
}
function _focusOtp() {
  const first = document.querySelector('.otp-box');
  if (first) setTimeout(() => first.focus(), 100);
}

export function checkAuth() {
  return !!localStorage.getItem('guardian_token');
}

let _logoutPrimed = false;
let _logoutTimer = null;

export function logout() {
  if (!_logoutPrimed) {
    _logoutPrimed = true;
    _showLogoutWarning();
    _logoutTimer = setTimeout(() => {
      _logoutPrimed = false;
      _dismissLogoutWarning();
    }, 4000);
    return;
  }
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
    background:#dc2626;color:#fff;
    padding:13px 16px;border-radius:14px;
    font-size:.88rem;font-weight:700;
    box-shadow:0 6px 20px rgba(220,38,38,.45);
    display:flex;align-items:center;gap:10px;
    z-index:9999;
    animation:slideDown 200ms ease;
  `;
  el.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" style="flex-shrink:0;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    <span style="flex:1;">লগআউট করতে আবার চাপুন</span>
    <span style="background:rgba(255,255,255,.25);padding:3px 10px;border-radius:8px;font-size:.8rem;font-weight:800;" id="logout-countdown">4s</span>
  `;
  document.body.appendChild(el);
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
        <button id="lc-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#dc2626;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(220,38,38,.35);">লগআউট</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#lc-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#lc-ok').onclick = () => {
    overlay.remove();
    localStorage.removeItem('guardian_token');
    localStorage.removeItem('guardian_data');
    localStorage.removeItem('active_child');
    location.reload();
  };
}
