import { requestOtp, verifyOtp } from './api.js';
import { showToast, navigateTo } from './dashboard.js';

export function initLogin() {
  const phoneStep = document.getElementById('phone-step');
  const otpStep   = document.getElementById('otp-step');
  const phoneInput = document.getElementById('phone-input');
  const sendOtpBtn = document.getElementById('send-otp-btn');
  const verifyBtn  = document.getElementById('verify-otp-btn');
  const changeNum  = document.getElementById('change-number');
  const displayNum = document.getElementById('display-number');

  sendOtpBtn.addEventListener('click', async () => {
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 10) { showToast('সঠিক মোবাইল নম্বর দিন', 'error'); return; }
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'পাঠানো হচ্ছে...';
    try {
      const res = await requestOtp('0' + phone.replace(/^0/, ''));
      if (res.success !== false) {
        displayNum.textContent = phone;
        phoneStep.style.display = 'none';
        otpStep.style.display = 'block';
        _focusOtp();
        showToast('OTP পাঠানো হয়েছে', 'success');
      } else {
        showToast(res.message || 'ত্রুটি হয়েছে', 'error');
      }
    } catch { showToast('সংযোগ সমস্যা', 'error'); }
    sendOtpBtn.disabled = false;
    sendOtpBtn.textContent = 'OTP পাঠাও';
  });

  changeNum.addEventListener('click', () => {
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
        localStorage.setItem('guardian_token', res.token);
        localStorage.setItem('guardian_data', JSON.stringify(res.guardian));
        localStorage.setItem('guardian_phone', '0' + phone.replace(/^0/, ''));
        window.dispatchEvent(new CustomEvent('login-success', { detail: res.guardian }));
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

export function logout() {
  localStorage.removeItem('guardian_token');
  localStorage.removeItem('guardian_data');
  localStorage.removeItem('active_child');
  location.reload();
}
