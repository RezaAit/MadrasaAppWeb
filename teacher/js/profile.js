import { getTeacherProfile, updateTeacherProfile, teacherPhotoUrl } from './api.js';
import { showToast, navigateTo, state } from './dashboard.js';

export async function loadProfileModule(container, teacher) {
  container.innerHTML = `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;"><div class="spinner"></div></div>`;

  const res = await getTeacherProfile();
  if (res.HasError) { container.innerHTML = `<div class="p-16 empty-state"><div class="empty-title">প্রোফাইল লোড হয়নি</div></div>`; return; }
  const p = res.results;

  const token = localStorage.getItem('teacher_token');

  const bloodGroups    = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
  const religions      = ['ইসলাম','হিন্দু','খ্রিস্টান','বৌদ্ধ','অন্যান্য'];
  const genders        = ['পুরুষ','মহিলা','অন্যান্য'];
  const maritalList    = ['অবিবাহিত','বিবাহিত','বিধবা/বিপত্নীক','তালাকপ্রাপ্ত'];
  const nationalities  = ['বাংলাদেশী','ভারতীয','অন্যান্য'];

  container.innerHTML = `
    <div class="pf-root">

      <!-- Cover + Avatar -->
      <div class="pf-cover">
        <button class="pf-back" id="pf-back">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <!-- Bubbles -->
        <div class="pf-b pf-b1"></div>
        <div class="pf-b pf-b2"></div>
        <div class="pf-b pf-b3"></div>
        <div class="pf-b pf-b4"></div>
        <div class="pf-avatar-wrap" id="pf-avatar-wrap">
          <div class="pf-avatar-placeholder" id="pf-avatar-img">${(p.fullName||'?')[0]}</div>
          <div class="pf-avatar-edit">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
        </div>
        <input type="file" id="pf-file" accept="image/*" style="display:none;">
        <div class="pf-identity">
          <div class="pf-identity-name">${p.fullName||''}</div>
          <div class="pf-identity-role">${p.designation||'শিক্ষক'}</div>
        </div>
        <div class="pf-wave">
          <svg viewBox="0 0 480 36" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,0 C80,36 160,36 240,18 C320,0 400,36 480,18 L480,36 L0,36 Z" fill="#f0f4ff"/>
          </svg>
        </div>
      </div>

      <!-- Form body -->
      <div class="pf-body">

        <div class="pf-group-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1"/><path d="M1.61 4.5 2.33 3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81"/></svg>
          যোগাযোগ
        </div>
        ${_row('ইমেইল', 'email', p.email||'', 'email')}
        ${_row('যোগাযোগ নম্বর', 'contact', p.contact||'', 'tel')}
        ${_row('SMS নম্বর', 'smsNo', p.smsNo||'', 'tel')}

        <div class="pf-divider"></div>

        <div class="pf-group-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
          ব্যক্তিগত তথ্য
        </div>
        ${_sensitive('পূর্ণ নাম', 'fullName', p.fullName||'')}
        ${_row('পিতার নাম', 'fatherName', p.fatherName||'')}
        ${_row('মাতার নাম', 'motherName', p.motherName||'')}
        ${_row('জন্মতারিখ', 'dateOfBirth', p.dateOfBirth?p.dateOfBirth.split('T')[0]:'', 'date')}
        ${_row('জাতীয় পরিচয়পত্র নং', 'nationalId', p.nationalId||'')}
        ${_row('পদবী', 'designation', p.designation||'', 'text', false, true)}

        ${_chips('লিঙ্গ', 'gender', genders, p.gender||'')}
        ${_chips('বৈবাহিক অবস্থা', 'maritalStatus', maritalList, p.maritalStatus||'')}
        ${_chips('রক্তের গ্রুপ', 'bloodGroup', bloodGroups, p.bloodGroup||'')}
        ${_chips('ধর্ম', 'religion', religions, p.religion||'')}
        ${_chips('জাতীয়তা', 'nationality', nationalities, p.nationality||'')}

        <div class="pf-divider"></div>

        <div class="pf-group-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          ঠিকানা
        </div>
        ${_row('বর্তমান ঠিকানা', 'presentAddress', p.presentAddress||'', 'text', true)}
        ${_row('স্থায়ী ঠিকানা', 'permanentAddress', p.permanentAddress||'', 'text', true)}

      </div>

      <!-- Save FAB -->
      <button class="pf-save-fab" id="pf-save-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        সংরক্ষণ
      </button>

    </div>
  `;

  // Load photo in background (non-blocking)
  fetch(teacherPhotoUrl(p.empId), { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.blob() : null)
    .then(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const el = document.getElementById('pf-avatar-img');
      if (!el) return;
      const img = document.createElement('img');
      img.className = 'pf-avatar-img'; img.id = 'pf-avatar-img'; img.src = url;
      el.parentNode.replaceChild(img, el);
    }).catch(() => {});

  // Back
  document.getElementById('pf-back').addEventListener('click', () => {
    navigateTo(state.previousModule || 'dashboard');
  });

  // Photo
  let newFile = null;
  document.getElementById('pf-avatar-wrap').addEventListener('click', () => document.getElementById('pf-file').click());
  document.getElementById('pf-file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    newFile = f;
    const url = URL.createObjectURL(f);
    const wrap = document.getElementById('pf-avatar-wrap');
    const old = document.getElementById('pf-avatar-img');
    const img = document.createElement('img');
    img.className = 'pf-avatar-img'; img.id = 'pf-avatar-img'; img.src = url;
    wrap.replaceChild(img, old);
  });

  // Chips
  container.querySelectorAll('.pf-chip').forEach(c => {
    c.addEventListener('click', () => {
      container.querySelectorAll(`.pf-chip[data-g="${c.dataset.g}"]`).forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
    });
  });

  // Save
  document.getElementById('pf-save-btn').addEventListener('click', async () => {
    // Warn if sensitive name field changed
    const newName = document.getElementById('fullName')?.value?.trim();
    if (newName && newName !== p.fullName) {
      const ok = await _confirm(
        '⚠️ নাম পরিবর্তন',
        `আপনি নাম পরিবর্তন করতে চাইছেন:\n"${p.fullName}" → "${newName}"\n\nএই পরিবর্তন সব রেকর্ডে প্রভাব ফেলবে। আপনি কি নিশ্চিত?`
      );
      if (!ok) return;
    }
    const btn = document.getElementById('pf-save-btn');
    btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...';
    const fd = new FormData();
    const v = id => document.getElementById(id)?.value?.trim()||'';
    const chip = g => container.querySelector(`.pf-chip[data-g="${g}"].sel`)?.dataset.v||'';
    [['fullName','fullName'],['email','email'],['fatherName','fatherName'],['motherName','motherName'],
     ['dateOfBirth','dateOfBirth'],['nationalId','nationalId'],
     ['contact','contact'],['smsNo','smsNo'],
     ['presentAddress','presentAddress'],['permanentAddress','permanentAddress']]
      .forEach(([k,id]) => { if(v(id)) fd.append(k,v(id)); });
    if(chip('gender'))        fd.append('gender',        chip('gender'));
    if(chip('maritalStatus')) fd.append('maritalStatus', chip('maritalStatus'));
    if(chip('bloodGroup'))    fd.append('bloodGroup',    chip('bloodGroup'));
    if(chip('religion'))      fd.append('religion',      chip('religion'));
    if(chip('nationality'))   fd.append('nationality',   chip('nationality'));
    if(newFile)            fd.append('photo', newFile);
    const r = await updateTeacherProfile(fd);
    showToast(r.HasError?(r.message||'ত্রুটি'):r.message, r.HasError?'error':'success');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> সংরক্ষণ`;
    if(!r.HasError && newFile) {
      const av = document.getElementById('teacher-initials');
      if(av) av.innerHTML=`<img src="${URL.createObjectURL(newFile)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    }
  });
}

function _sensitive(label, id, value) {
  return `
    <label class="pf-row pf-row-sensitive">
      <span class="pf-row-label">
        ${label}
        <span class="pf-sensitive-badge">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          সংবেদনশীল
        </span>
      </span>
      <input class="pf-input pf-input-sensitive" type="text" id="${id}" value="${_e(value)}">
    </label>`;
}

function _confirm(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:10px;">${title}</div>
        <div style="font-size:.88rem;color:#475569;line-height:1.6;white-space:pre-line;margin-bottom:20px;">${message}</div>
        <div style="display:flex;gap:10px;">
          <button id="cf-cancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #e2e8f0;background:#f8fafc;font-size:.9rem;font-weight:600;color:#64748b;cursor:pointer;font-family:inherit;">বাতিল</button>
          <button id="cf-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(37,99,235,.35);">হ্যাঁ, পরিবর্তন করুন</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cf-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#cf-ok').onclick    = () => { overlay.remove(); resolve(true); };
  });
}

function _row(label, id, value, type='text', multi=false, readonly=false) {
  const inp = multi
    ? `<textarea class="pf-input" id="${id}" rows="2">${_e(value)}</textarea>`
    : `<input class="pf-input" type="${type}" id="${id}" value="${_e(value)}"${readonly?' readonly style="color:#94a3b8;cursor:default;"':''}>`;
  return `
    <label class="pf-row${readonly?' pf-row-readonly':''}">
      <span class="pf-row-label">${label}${readonly?' <span style="font-size:.6rem;background:#e0e7ff;color:#4f46e5;padding:1px 5px;border-radius:4px;margin-left:4px;">READ ONLY</span>':''}</span>
      ${inp}
    </label>`;
}

function _chips(label, id, options, value) {
  const chips = options.map(o =>
    `<button type="button" class="pf-chip${o===value?' sel':''}" data-g="${id}" data-v="${o}">${o}</button>`
  ).join('');
  return `
    <div class="pf-chip-row">
      <span class="pf-chip-row-label">${label}</span>
      <div class="pf-chips-scroll">${chips}</div>
    </div>`;
}

function _e(v){ return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
