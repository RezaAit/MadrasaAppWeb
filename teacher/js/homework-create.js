import { getHomeworkList, createHomework, updateHomework, publishHomework, deleteHomework, uploadHomeworkAttachments, uploadHomeworkMultiAttachments, deleteHomeworkAttachment, reviewHomework, submitReaction, getMySections } from './api.js';
import { showToast } from './dashboard.js';
import { initAnnotation, buildToolbar, getAnnotatedBlob, openLightbox } from '../../shared/js/annotation.js';
import { compressImage } from '../../shared/js/compress-image.js';
import { initVoiceRecorder, fetchAudioAsBlob } from '../../shared/js/voice-recorder.js';
import { createBottomSheet } from '../../shared/js/bottom-sheet.js';
import { BASE_URL } from '../../shared/js/api-config.js';
import { createMultiAttachManager } from './hw-multi-attach.js';

export async function loadHomeworkModule(container, teacher) {
  const res = await getHomeworkList();
  const homeworks = res.results || [];

  container.innerHTML = `
    <div class="p-16">
      <div class="hw-create-card" id="create-hw-btn">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.95rem;font-weight:700;letter-spacing:.01em;">হোমওয়ার্ক তৈরি করুন</div>
          <div style="font-size:.74rem;opacity:.82;margin-top:1px;">ছবি, ভয়েস, PDF সহ নির্দেশনা দিন</div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>

      <div class="section-header"><span class="section-title">হোমওয়ার্ক তালিকা</span></div>
      <div id="hw-list" class="stagger-in"></div>
    </div>
  `;

  _renderHwList(homeworks, container);

  document.getElementById('create-hw-btn').addEventListener('click', () => {
    _openCreateForm(container, teacher);
  });
}

async function _reloadList(container) {
  const res = await getHomeworkList();
  const homeworks = res.results || [];
  _renderHwList(homeworks, container);
}

const BN_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

function _hwGroupKey(hw, mode) {
  const d = new Date(hw.addDate ?? hw.AddDate);
  if (mode === 'year')  return String(d.getFullYear());
  if (mode === 'month') return `${d.getFullYear()} — ${BN_MONTHS[d.getMonth()]}`;
  // week: show week-of-year label
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()} — সপ্তাহ ${week}`;
}

function _renderHwCard(hw) {
  const subCount    = hw.SubmissionCount ?? hw.submissionCount ?? 0;
  const totalCount  = hw.TotalStudents   ?? hw.totalStudents   ?? 0;
  const pendingCount = totalCount - subCount;
  const sessionName = hw.SessionName ?? hw.sessionName ?? '';
  const className   = hw.ClassName   ?? hw.className   ?? '';
  const groupName   = hw.GroupName   ?? hw.groupName   ?? '';
  const sectionName = hw.SectionName ?? hw.sectionName ?? '';
  const subjectName = hw.subjectName ?? hw.SubjectName ?? '';
  const metaParts   = [sessionName, className, groupName, sectionName].filter(Boolean);
  return `
  <div class="list-item hw-review-item ${hw.status === 'Published' ? 'has-pending' : ''}" data-hw-id="${hw.id}" style="cursor:pointer;">
    <div style="flex:1;min-width:0;">
      <div class="list-item-title" style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:3px;">${hw.title}</div>
      ${subjectName ? `<div style="font-size:.82rem;font-weight:700;color:var(--primary);margin-bottom:3px;">${subjectName}</div>` : ''}
      ${metaParts.length ? `<div style="font-size:.78rem;font-weight:600;color:#334155;margin-bottom:4px;">${metaParts.join(' · ')}</div>` : ''}
      <div style="font-size:.75rem;color:#64748b;font-weight:500;margin-bottom:5px;">
        তৈরি: ${_fmtDateTime(hw.addDate ?? hw.AddDate)} &nbsp;|&nbsp; সীমা: ${_fmt(hw.dueDate ?? hw.DueDate)}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
        <span class="badge ${hw.status === 'Published' ? 'badge-submitted' : 'badge-pending'}">${hw.status === 'Published' ? '✓ প্রকাশিত' : '📝 খসড়া'}</span>
        ${hw.status === 'Published' && totalCount > 0 ? `
          <span style="font-size:.75rem;background:#dcfce7;color:#15803d;padding:3px 9px;border-radius:10px;font-weight:700;">✓ ${subCount} জমা</span>
          <span style="font-size:.75rem;background:#fee2e2;color:#b91c1c;padding:3px 9px;border-radius:10px;font-weight:700;">✗ ${pendingCount} বাকি</span>
          <span style="font-size:.75rem;color:#475569;font-weight:600;">মোট ${totalCount}</span>` : ''}
        ${hw.status !== 'Published' ? `<button type="button" class="btn-hw-publish" data-pub-id="${hw.id}">▶ প্রকাশ করুন</button>` : ''}
        ${subCount === 0 ? `<button type="button" class="btn-hw-delete" data-del-id="${hw.id}">🗑 মুছুন</button>` : ''}
      </div>
      ${(() => {
        const imgCount   = (hw.instructionImages || hw.InstructionImages || []).length
                         || (hw.instructionPhotoUrl || hw.InstructionPhotoUrl ? 1 : 0);
        const voiceCount = (hw.instructionVoices || hw.InstructionVoices || hw.voiceNotes || hw.VoiceNotes || []).length
                         || (hw.voiceAttachmentUrl || hw.VoiceAttachmentUrl ? 1 : 0);
        const videoCount = (hw.instructionVideos || hw.InstructionVideos || hw.videos || hw.Videos || hw.videoAttachments || hw.VideoAttachments || []).length;
        const ytCount    = (hw.youtubeLinks || hw.YoutubeLinks || []).length;
        const pdfCount   = (hw.instructionPdfs || hw.InstructionPdfs || []).length
                         || (hw.pdfAttachmentUrl || hw.PdfAttachmentUrl ? 1 : 0);
        const _chip = (color, svg, label) =>
          `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;color:${color};line-height:1;padding:2px 0;">${svg}<span style="line-height:1;">${label}</span></span>`;
        const _svg = (paths, color='currentColor', fill='none') =>
          `<svg viewBox="0 0 24 24" width="13" height="13" fill="${fill}" stroke="${color}" stroke-width="2" style="flex-shrink:0;display:block;">${paths}</svg>`;
        const parts = [];
        if (imgCount   > 0) parts.push(_chip('#475569', _svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'), `${imgCount}টি ছবি`));
        if (voiceCount > 0) parts.push(_chip('#475569', _svg('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>'), `${voiceCount}টি ভয়েস`));
        if (videoCount > 0) parts.push(_chip('#475569', _svg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>'), `${videoCount}টি ভিডিও`));
        if (ytCount    > 0) parts.push(_chip('#dc2626', `<svg viewBox="0 0 24 24" width="13" height="13" fill="#dc2626" style="flex-shrink:0;display:block;"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.2 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zm-13.5 8.6V8.4l8.1 3.6-8.1 3.6z"/></svg>`, `${ytCount}টি YouTube`));
        if (pdfCount   > 0) parts.push(_chip('#475569', _svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'), `${pdfCount}টি ফাইল`));
        return parts.length ? `<div style="display:flex;align-items:center;gap:10px;margin-top:5px;flex-wrap:wrap;">${parts.join('')}</div>` : '';
      })()}
    </div>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-light);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
  </div>`;
}

function _renderHwList(homeworks, container) {
  const list = document.getElementById('hw-list');
  if (!list) return;
  if (!homeworks.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-title">কোনো হোমওয়ার্ক নেই</div><div class="empty-sub">নতুন হোমওয়ার্ক তৈরি করুন</div></div>`;
    return;
  }

  // grouping toggle buttons
  const groupMode = list.dataset.groupMode || 'month';
  list.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
      ${['year','month','week'].map(m => `
        <button type="button" class="btn-hw-group ${groupMode===m?'btn-hw-group-active':''}" data-mode="${m}">
          ${m==='year'?'বছর':m==='month'?'মাস':'সপ্তাহ'}
        </button>`).join('')}
    </div>
    <div id="hw-list-inner"></div>`;

  list.querySelectorAll('.btn-hw-group').forEach(btn => {
    btn.addEventListener('click', () => {
      list.dataset.groupMode = btn.dataset.mode;
      _renderHwList(homeworks, container);
    });
  });

  // group homeworks
  const groups = {};
  homeworks.forEach(hw => {
    const key = _hwGroupKey(hw, groupMode);
    if (!groups[key]) groups[key] = [];
    groups[key].push(hw);
  });

  const inner = document.getElementById('hw-list-inner');
  inner.innerHTML = Object.entries(groups).map(([label, items]) => `
    <div class="hw-group-section">
      <div class="hw-group-label">${label} <span style="font-size:.7rem;color:#94a3b8;">(${items.length}টি)</span></div>
      ${items.map(_renderHwCard).join('')}
    </div>`).join('');

  inner.querySelectorAll('[data-hw-id]').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-hw-publish, .btn-hw-delete')) return;
      const hw = homeworks.find(h => String(h.id) === item.dataset.hwId);
      if (hw) _openReviewScreen(container, hw);
    });
  });

  inner.querySelectorAll('.btn-hw-publish').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('এই হোমওয়ার্ক প্রকাশ করবেন?')) return;
      btn.disabled = true; btn.textContent = '...';
      const res = await publishHomework(Number(btn.dataset.pubId));
      if (res.HasError) { showToast(res.message || 'প্রকাশ ব্যর্থ হয়েছে', 'error'); btn.disabled = false; btn.textContent = '▶ প্রকাশ করুন'; }
      else { showToast('প্রকাশিত হয়েছে ✓', 'success'); _reloadList(container); }
    });
  });

  inner.querySelectorAll('.btn-hw-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('এই হোমওয়ার্ক মুছে ফেলবেন? এটি আর ফেরানো যাবে না।')) return;
      btn.disabled = true; btn.textContent = '...';
      const res = await deleteHomework(Number(btn.dataset.delId));
      if (res.HasError) { showToast(res.message || 'মুছতে ব্যর্থ হয়েছে', 'error'); btn.disabled = false; btn.textContent = '🗑 মুছুন'; }
      else { showToast('মুছে ফেলা হয়েছে', 'success'); _reloadList(container); }
    });
  });
}

function _openCreateForm(container, teacher) {
  const formHtml = `
    <div class="hwc-form">
      <div class="form-group mb-12">
        <label class="form-label">ক্লাস, সেকশন ও বিষয় *</label>
        <select class="form-select" id="hw-section">
          <option value="">লোড হচ্ছে...</option>
        </select>
      </div>
      <div class="form-group mb-12">
        <label class="form-label">শিরোনাম *</label>
        <input type="text" class="form-input" id="hw-title" placeholder="হোমওয়ার্কের শিরোনাম">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">শেষ তারিখ *</label>
        <input type="date" class="form-input" id="hw-due">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">বিবরণ</label>
        <div id="quill-editor" style="min-height:120px;"></div>
      </div>

      <!-- ── Multiple attachments (images, voice, video, YouTube, PDF) ── -->
      <div id="hwc-multi-attach-wrap" class="mb-12"></div>

      <button class="btn btn-primary btn-full btn-lg" id="submit-hw-btn">হোমওয়ার্ক প্রকাশ করুন</button>
    </div>
  `;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'hw-create-sheet',
    title: 'নতুন হোমওয়ার্ক',
    content: formHtml,
    fullHeight: true,
  });
  open();

  sheetBody.querySelector('#hw-due').value = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Section + subject picker (from teacher's real assignments)
  const sectionSelect = sheetBody.querySelector('#hw-section');
  let sectionData = [];
  getMySections().then(res => {
    sectionData = (res.results?.subjectSections || []).filter(s => s.subjectId);
    sectionSelect.innerHTML = sectionData.length
      ? `<option value="">বেছে নিন</option>` + sectionData.map((s, i) =>
          `<option value="${i}">${s.className} - ${s.sectionName} (${s.subjectName})</option>`).join('')
      : `<option value="">কোনো বিষয় বরাদ্দ নেই</option>`;
  });

  // Quill init
  let quill = null;
  if (window.Quill) {
    quill = new Quill(sheetBody.querySelector('#quill-editor'), {
      theme: 'snow',
      placeholder: 'হোমওয়ার্কের বিস্তারিত বিবরণ লিখুন...',
      modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ color: [] }, { size: ['small', false, 'large', 'huge'] }], ['clean']] }
    });
  } else {
    sheetBody.querySelector('#quill-editor').innerHTML = `<textarea class="form-textarea" id="hw-desc-fallback" style="min-height:120px;" placeholder="হোমওয়ার্কের বিস্তারিত বিবরণ লিখুন..."></textarea>`;
  }

  // ── Multi-attachment manager (images, voice, video, YouTube, PDF) ──
  const multiAttachWrap = sheetBody.querySelector('#hwc-multi-attach-wrap');
  const multiMgr = createMultiAttachManager(multiAttachWrap);

  // Submit: create -> upload attachments -> publish
  sheetBody.querySelector('#submit-hw-btn')?.addEventListener('click', async () => {
    const title   = sheetBody.querySelector('#hw-title').value.trim();
    const dueDate = sheetBody.querySelector('#hw-due').value;
    const sectionIdx = sectionSelect.value;

    if (!sectionIdx && sectionIdx !== '0') { showToast('ক্লাস ও বিষয় বেছে নিন', 'error'); return; }
    if (!title)   { showToast('শিরোনাম দিন', 'error'); return; }
    if (!dueDate) { showToast('শেষ তারিখ দিন', 'error'); return; }

    const sec = sectionData[Number(sectionIdx)];
    const description = quill
      ? quill.root.innerHTML
      : (sheetBody.querySelector('#hw-desc-fallback')?.value || '');

    const btn = sheetBody.querySelector('#submit-hw-btn');
    btn.disabled = true; btn.textContent = 'তৈরি হচ্ছে...';

    const createRes = await createHomework({
      VersionId: sec.versionId, SessionId: sec.sessionId, BranchId: sec.branchId, ShiftId: sec.shiftId,
      ClassId: sec.classId, GroupId: sec.groupId, SectionId: sec.sectionId, SubjectId: sec.subjectId,
      Title: title, Description: description, DueDate: dueDate,
    });

    if (createRes.HasError || !createRes.results?.id) {
      showToast(createRes.message || 'হোমওয়ার্ক তৈরি ব্যর্থ হয়েছে', 'error');
      btn.disabled = false; btn.textContent = 'হোমওয়ার্ক প্রকাশ করুন';
      return;
    }

    const hwId = createRes.results.id;
    const { images, annotated, voices, videos, youtubeUrls, pdfs } = multiMgr.getPayload();

    // Upload all attachments (images, voice, video, YouTube, PDF)
    if (images.length || voices.length || videos.length || youtubeUrls.length || pdfs.length) {
      btn.textContent = 'সংযুক্তি আপলোড হচ্ছে...';
      const upRes = await uploadHomeworkMultiAttachments(hwId, { images, annotated, voices, videos, youtubeUrls, pdfs });
      if (upRes?.HasError) {
        showToast(upRes.message || 'সংযুক্তি আপলোড ব্যর্থ হয়েছে', 'error');
        btn.disabled = false; btn.textContent = 'হোমওয়ার্ক প্রকাশ করুন';
        return;
      }
    }

    btn.textContent = 'প্রকাশ হচ্ছে...';
    const pubRes = await publishHomework(hwId);

    if (!pubRes.HasError) {
      showToast('হোমওয়ার্ক প্রকাশিত হয়েছে ✓', 'success');
      close();
      _reloadList(container);
    } else {
      showToast(pubRes.message || 'প্রকাশ করতে ত্রুটি হয়েছে (খসড়া হিসেবে সংরক্ষিত আছে)', 'error');
      btn.disabled = false; btn.textContent = 'হোমওয়ার্ক প্রকাশ করুন';
    }
  });
}

function _full(url) {
  if (!url) return url;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

function _openLightbox(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';
  ov.innerHTML = `
    <img src="${src}" style="max-width:94vw;max-height:90vh;object-fit:contain;border-radius:8px;">
    <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('button')) ov.remove(); });
  document.body.appendChild(ov);
}

async function _openReviewScreen(container, hw) {
  const skeletonHtml = `<div class="p-16"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>`;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'hw-review-sheet',
    title: hw.title,
    content: skeletonHtml,
    fullHeight: true,
  });
  open();

  const res = await reviewHomework(hw.id);
  const submissions = res.results || [];

  const content = sheetBody.querySelector('.p-16');
  content.innerHTML = '';
  content.className = 'p-16 stagger-in';

  const submitted = submissions.filter(s => s.status === 'Submitted' || s.status === 'Reviewed');
  const pending   = submissions.filter(s => s.status === 'Pending');
  const canEdit   = submitted.length === 0;

  // ── Build teacher instruction attachment HTML ──────────────────
  const instrImages  = (hw.instructionImages  || []).map(i => ({ photoUrl: _full(i.PhotoUrl ?? i.photoUrl), annotatedPhotoUrl: (i.AnnotatedPhotoUrl ?? i.annotatedPhotoUrl) ? _full(i.AnnotatedPhotoUrl ?? i.annotatedPhotoUrl) : null }));
  if (!instrImages.length && hw.instructionPhotoUrl)
    instrImages.push({ photoUrl: _full(hw.instructionPhotoUrl), annotatedPhotoUrl: hw.instructionAnnotatedPhotoUrl ? _full(hw.instructionAnnotatedPhotoUrl) : null });
  const instrVoices  = (hw.instructionVoices || []).map(v => _full(v.VoiceUrl ?? v.voiceUrl));
  if (!instrVoices.length && hw.voiceAttachmentUrl) instrVoices.push(_full(hw.voiceAttachmentUrl));
  const instrVideos  = (hw.instructionVideos || []).map(v => _full(v.VideoUrl ?? v.videoUrl));
  const instrYoutube = (hw.youtubeLinks      || []).map(y => y.YoutubeUrl ?? y.youtubeUrl);
  const instrPdfs    = (hw.instructionPdfs   || []).map(p => _full(p.PdfUrl ?? p.pdfUrl));
  if (!instrPdfs.length && hw.pdfAttachmentUrl) instrPdfs.push(_full(hw.pdfAttachmentUrl));

  const hasInstr = instrImages.length || instrVoices.length || instrVideos.length || instrYoutube.length || instrPdfs.length || hw.description;

  const instrHtml = hasInstr ? `
    <div class="card mb-16" style="background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:.8rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">📋 শিক্ষকের নির্দেশনা</div>
      ${hw.description ? `<div style="font-size:.88rem;color:#334155;margin-bottom:10px;line-height:1.6;">${hw.description}</div>` : ''}
      ${instrImages.length ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          ${instrImages.map(img => `<img src="${img.annotatedPhotoUrl || img.photoUrl}" data-zoom-instr style="width:90px;height:90px;object-fit:cover;border-radius:10px;cursor:zoom-in;border:1px solid #e2e8f0;">`).join('')}
        </div>` : ''}
      ${instrVoices.map(url => `<audio controls style="width:100%;margin-bottom:8px;" src="${url}"></audio>`).join('')}
      ${instrVideos.map(url => `<video controls src="${url}" style="width:100%;border-radius:8px;background:#000;max-height:160px;margin-bottom:8px;"></video>`).join('')}
      ${instrYoutube.map((url, ytIdx) => {
        const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
        const vid = m ? m[1] : null;
        const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
        const uid = `yt-instr-${Date.now()}-${ytIdx}`;
        return `<div style="margin-bottom:8px;border-radius:10px;overflow:hidden;border:1px solid #fecaca;">
          <div id="${uid}-preview" style="position:relative;background:#000;cursor:pointer;" onclick="
            var p=document.getElementById('${uid}-preview');
            var f=document.getElementById('${uid}-frame');
            p.style.display='none';
            f.style.display='block';
            f.querySelector('iframe').src='https://www.youtube.com/embed/${vid}?autoplay=1';
          ">
            ${thumb ? `<img src="${thumb}" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;">` : `<div style="aspect-ratio:16/9;background:#1e293b;"></div>`}
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
              <div style="width:56px;height:56px;border-radius:50%;background:rgba(220,38,38,0.9);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><polygon points="10,8 18,12 10,16"/></svg>
              </div>
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.7));">
              <span style="font-size:.75rem;color:#fff;font-weight:600;">▶ YouTube ভিডিও</span>
            </div>
          </div>
          <div id="${uid}-frame" style="display:none;aspect-ratio:16/9;background:#000;">
            <iframe width="100%" height="100%" style="border:none;display:block;" allow="autoplay;encrypted-media" allowfullscreen></iframe>
          </div>
        </div>`;
      }).join('')}
      ${instrPdfs.map(p => {
        const url = p.pdfUrl || p.PdfUrl || p;
        const fileSize = p.fileSize || p.FileSize || null;
        const fname = (typeof url === 'string' ? url : '').split('/').pop() || 'ফাইল';
        const ext = (fname.split('.').pop() || 'pdf').toLowerCase();
        const extUp = ext.toUpperCase();
        const cfg = ext === 'pdf' ? { bg:'#fff0f0', border:'#fca5a5', tc:'#dc2626', ic:'#dc2626' }
          : (ext === 'doc' || ext === 'docx') ? { bg:'#eff6ff', border:'#93c5fd', tc:'#2563eb', ic:'#2563eb' }
          : (ext === 'xls' || ext === 'xlsx') ? { bg:'#f0fdf4', border:'#86efac', tc:'#16a34a', ic:'#16a34a' }
          : (ext === 'ppt' || ext === 'pptx') ? { bg:'#fff7ed', border:'#fdba74', tc:'#ea580c', ic:'#ea580c' }
          : { bg:'#f8fafc', border:'#cbd5e1', tc:'#475569', ic:'#475569' };
        const sizeStr = fileSize ? _fmtSize(fileSize) : '';
        return `<a href="${url}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:${cfg.bg};border:1.5px solid ${cfg.border};border-radius:9px;margin-bottom:6px;text-decoration:none;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${cfg.ic}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.8rem;color:#1e293b;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${fname.length > 32 ? fname.slice(0,29)+'…' : fname}</div>
            ${sizeStr ? `<div style="font-size:.68rem;color:#64748b;margin-top:1px;">${sizeStr}</div>` : ''}
          </div>
          <span style="font-size:.7rem;font-weight:700;color:${cfg.tc};background:${cfg.border};padding:2px 6px;border-radius:4px;flex-shrink:0;">${extUp}</span>
        </a>`;
      }).join('')}
    </div>` : '';

  const subjectName = hw.subjectName ?? hw.SubjectName ?? '';
  const dueDate     = hw.dueDate    ?? hw.DueDate    ?? '';
  const addDate     = hw.addDate    ?? hw.AddDate    ?? '';

  content.innerHTML = `
    ${subjectName || dueDate ? `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:6px;">
      ${subjectName ? `<span style="font-size:.9rem;font-weight:700;color:var(--primary);">${subjectName}</span>` : ''}
      <div style="display:flex;gap:10px;font-size:.78rem;color:#64748b;">
        ${addDate ? `<span>তৈরি: ${_fmt(addDate)}</span>` : ''}
        ${dueDate ? `<span style="font-weight:700;color:#dc2626;">সীমা: ${_fmt(dueDate)}</span>` : ''}
      </div>
    </div>` : ''}

    <div class="stat-grid mb-16">
      <div class="stat-card"><div class="stat-label">জমা দিয়েছে</div><div class="stat-value text-success">${submitted.length}</div></div>
      <div class="stat-card"><div class="stat-label">জমা দেয়নি</div><div class="stat-value text-danger">${pending.length}</div></div>
    </div>

    ${instrHtml}

    ${canEdit ? `<button class="btn btn-secondary btn-full mb-16" id="hw-edit-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      হোমওয়ার্ক সম্পাদনা করুন
    </button>` : ''}

    <div class="tabs mb-16">
      <button class="tab-btn active" data-tab="submitted">জমা দিয়েছে (${submitted.length})</button>
      <button class="tab-btn" data-tab="pending">জমা দেয়নি (${pending.length})</button>
    </div>
    <div id="sub-list"></div>
  `;

  // instruction image zoom
  content.querySelectorAll('img[data-zoom-instr]').forEach(img => {
    img.addEventListener('click', () => _openLightbox(img.src));
  });

  content.querySelector('#hw-edit-btn')?.addEventListener('click', () => {
    close();
    _openEditForm(container, hw);
  });

  function renderSubList(tab) {
    const list = tab === 'submitted' ? submitted : pending;
    const el = content.querySelector('#sub-list');
    el.innerHTML = '';
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-title">কেউ নেই</div></div>`;
      return;
    }
    list.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'card mb-10 fade-in';
      const isSubmitted = sub.status === 'Submitted' || sub.status === 'Reviewed';
      card.innerHTML = `
        <div class="flex-between mb-10">
          <div>
            <div class="fw-700" style="font-size:.93rem;">${sub.studentName || '—'}</div>
            <div style="font-size:.78rem;color:var(--text-muted);">রোল ${sub.rollNo ?? '—'}</div>
          </div>
          <span class="badge badge-${isSubmitted ? 'submitted' : 'pending'}">${isSubmitted ? '✓ জমা' : '⏳ বাকি'}</span>
        </div>
        ${isSubmitted ? `
          ${sub.textRemarks ? `
            <div class="sub-remarks">"${sub.textRemarks}"</div>` : ''}
          ${(sub.primaryImageUrl || sub.annotatedPhotoUrl || (sub.images && sub.images.length)) ? `
            <div class="sub-img-grid">
              ${(sub.annotatedPhotoUrl || sub.primaryImageUrl) ? `<img src="${_full(sub.annotatedPhotoUrl || sub.primaryImageUrl)}" data-zoom class="sub-img">` : ''}
              ${(sub.images || []).map(u => `<img src="${_full(u)}" data-zoom class="sub-img">`).join('')}
            </div>` : ''}
          ${sub.voiceNoteUrl ? `<audio controls class="sub-audio" src="${_full(sub.voiceNoteUrl)}"></audio>` : ''}
          <div class="sub-section-label">প্রতিক্রিয়া</div>
          <div class="sub-reaction-grid">
            ${['Excellent','Good','NeedsImprovement','Incomplete','StarWork'].map(r => `
              <button class="sub-reaction-btn ${sub.teacherReaction === r ? 'active' : ''}" data-reaction="${r}" data-detail-id="${sub.id}">
                <span class="sub-reaction-emoji">${_reactionEmoji(r)}</span>
                <span class="sub-reaction-label">${_reactionLabel(r)}</span>
              </button>`).join('')}
          </div>
          <div class="sub-section-label">নোট</div>
          <textarea class="form-textarea sub-note" data-note-id="${sub.id}" placeholder="শিক্ষকের মন্তব্য...">${sub.teacherNote || ''}</textarea>
          <button class="btn btn-primary btn-sm sub-save-btn save-reaction-btn" data-detail-id="${sub.id}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            সংরক্ষণ
          </button>
        ` : ''}
      `;
      el.appendChild(card);
    });

    // Image zoom
    el.querySelectorAll('img[data-zoom]').forEach(img => {
      img.addEventListener('click', () => _openLightbox(img.src));
    });

    // Reaction & save handlers
    el.querySelectorAll('.sub-reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const detailId = btn.dataset.detailId;
        el.querySelectorAll(`.sub-reaction-btn[data-detail-id="${detailId}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sub = submissions.find(s => String(s.id) === detailId);
        if (sub) sub.teacherReaction = btn.dataset.reaction;
        _reactionBurst(btn);
      });
    });

    el.querySelectorAll('.save-reaction-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const detailId = btn.dataset.detailId;
        const sub = submissions.find(s => String(s.id) === detailId);
        const note = el.querySelector(`[data-note-id="${detailId}"]`)?.value || '';
        btn.disabled = true;
        const res = await submitReaction(detailId, sub?.teacherReaction, note);
        showToast(res.HasError ? (res.message || 'ত্রুটি হয়েছে') : '✓ সংরক্ষিত হয়েছে', res.HasError ? 'error' : 'success');
        btn.disabled = false;
      });
    });
  }

  renderSubList('submitted');
  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSubList(btn.dataset.tab);
    });
  });
}

function _openEditForm(container, hw) {
  const hasPdf = !!hw.pdfAttachmentUrl;

  // Build existing attachment arrays for the multi-manager
  const existingImages  = (hw.instructionImages  || []).map(i => ({ id: i.Id ?? i.id, photoUrl: _full(i.PhotoUrl ?? i.photoUrl), annotatedPhotoUrl: (i.AnnotatedPhotoUrl ?? i.annotatedPhotoUrl) ? _full(i.AnnotatedPhotoUrl ?? i.annotatedPhotoUrl) : null }));
  const existingVoices  = (hw.instructionVoices  || []).map(v => ({ id: v.Id ?? v.id, voiceUrl: _full(v.VoiceUrl ?? v.voiceUrl) }));
  const existingVideos  = (hw.instructionVideos  || []).map(v => ({ id: v.Id ?? v.id, videoUrl: _full(v.VideoUrl ?? v.videoUrl) }));
  const existingYoutube = (hw.youtubeLinks       || []).map(y => ({ id: y.Id ?? y.id, youtubeUrl: y.YoutubeUrl ?? y.youtubeUrl }));
  const existingPdfs    = (hw.instructionPdfs    || []).map(p => ({ id: p.Id ?? p.id, pdfUrl: _full(p.PdfUrl ?? p.pdfUrl) }));

  // Legacy single-attachment fallback (migrate to list display)
  if (!existingImages.length && hw.instructionPhotoUrl)
    existingImages.push({ id: null, photoUrl: _full(hw.instructionPhotoUrl), annotatedPhotoUrl: hw.instructionAnnotatedPhotoUrl ? _full(hw.instructionAnnotatedPhotoUrl) : null });
  if (!existingVoices.length && hw.instructionVoiceNoteUrl)
    existingVoices.push({ id: null, voiceUrl: _full(hw.instructionVoiceNoteUrl) });
  if (!existingVideos.length && hw.instructionVideoUrl)
    existingVideos.push({ id: null, videoUrl: _full(hw.instructionVideoUrl) });
  // Legacy single PDF fallback
  if (!existingPdfs.length && hw.pdfAttachmentUrl)
    existingPdfs.push({ id: null, pdfUrl: _full(hw.pdfAttachmentUrl) });

  const attachmentHtml = `
    <!-- multi-attach manager renders here -->
    <div id="hwe-multi-attach-wrap" class="mb-12"></div>
  `;

  const formHtml = `
    <div class="hwc-form">
      <div class="form-group mb-12">
        <label class="form-label">শিরোনাম *</label>
        <input type="text" class="form-input" id="hwe-title" value="${(hw.title || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">শেষ তারিখ *</label>
        <input type="date" class="form-input" id="hwe-due" value="${hw.dueDate ? hw.dueDate.slice(0, 10) : ''}">
      </div>
      <div class="form-group mb-12">
        <label class="form-label">বিবরণ</label>
        <div id="hwe-quill-editor" style="min-height:120px;"></div>
      </div>
      ${attachmentHtml}
      <div style="font-size:.8rem;color:#f59e0b;background:#fef3c7;border-radius:8px;padding:10px 12px;margin-bottom:16px;">
        ⚠ শুধু শিরোনাম, তারিখ ও বিবরণ পরিবর্তন করা যাবে। কোনো শিক্ষার্থী জমা দেওয়ার পরে সম্পাদনা বন্ধ হয়ে যাবে।
      </div>
      <button class="btn btn-primary btn-full btn-lg" id="hwe-save-btn">পরিবর্তন সংরক্ষণ করুন</button>
    </div>
  `;

  const { body: sheetBody, close, open } = createBottomSheet({
    id: 'hw-edit-sheet',
    title: 'হোমওয়ার্ক সম্পাদনা',
    content: formHtml,
    fullHeight: true,
  });
  open();

  // ── Multi-attachment manager ──
  const editMultiWrap = sheetBody.querySelector('#hwe-multi-attach-wrap');
  const editMultiMgr = createMultiAttachManager(editMultiWrap, {
    existingImages,
    existingVoices,
    existingVideos,
    existingYoutube,
    existingPdfs,
    onDelete: async (type, id) => {
      if (id === null) return; // legacy item, no server delete
      await deleteHomeworkAttachment(type, id);
    },
  });

  let quill = null;
  if (window.Quill) {
    quill = new Quill(sheetBody.querySelector('#hwe-quill-editor'), {
      theme: 'snow',
      modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ color: [] }, { size: ['small', false, 'large', 'huge'] }], ['clean']] }
    });
    if (hw.description) quill.root.innerHTML = hw.description;
  } else {
    sheetBody.querySelector('#hwe-quill-editor').innerHTML =
      `<textarea class="form-textarea" id="hwe-desc-fallback" style="min-height:120px;">${hw.description || ''}</textarea>`;
  }

  sheetBody.querySelector('#hwe-save-btn')?.addEventListener('click', async () => {
    const title   = sheetBody.querySelector('#hwe-title').value.trim();
    const dueDate = sheetBody.querySelector('#hwe-due').value;
    if (!title)   { showToast('শিরোনাম দিন', 'error'); return; }
    if (!dueDate) { showToast('শেষ তারিখ দিন', 'error'); return; }

    const description = quill
      ? quill.root.innerHTML
      : (sheetBody.querySelector('#hwe-desc-fallback')?.value || '');

    const btn = sheetBody.querySelector('#hwe-save-btn');
    btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...';

    const res = await updateHomework(hw.id, { Title: title, Description: description, DueDate: dueDate });
    if (res.HasError) {
      showToast(res.message || 'আপডেট ব্যর্থ হয়েছে', 'error');
      btn.disabled = false; btn.textContent = 'পরিবর্তন সংরক্ষণ করুন';
      return;
    }

    const { images, annotated, voices, videos, youtubeUrls, pdfs } = editMultiMgr.getPayload();
    if (images.length || voices.length || videos.length || youtubeUrls.length || pdfs.length) {
      btn.textContent = 'সংযুক্তি আপলোড হচ্ছে...';
      const upRes = await uploadHomeworkMultiAttachments(hw.id, { images, annotated, voices, videos, youtubeUrls, pdfs });
      if (upRes?.HasError) {
        showToast(upRes.message || 'সংযুক্তি আপলোড ব্যর্থ হয়েছে', 'error');
        btn.disabled = false; btn.textContent = 'পরিবর্তন সংরক্ষণ করুন';
        return;
      }
    }

    showToast('হোমওয়ার্ক আপডেট হয়েছে ✓', 'success');
    close();
    _reloadList(container);
  });
}

function _fmt(d) { return d ? new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '—'; }
function _fmtDateTime(d) { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }); }
function _fmtSize(bytes) { if (!bytes) return ''; if (bytes < 1024) return bytes + ' B'; if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+' KB'; return (bytes/(1024*1024)).toFixed(1)+' MB'; }
function _reactionEmoji(r) { return { Excellent: '🌟', Good: '✅', NeedsImprovement: '📈', Incomplete: '❌', StarWork: '⭐' }[r] || '📝'; }
function _reactionLabel(r) { return { Excellent: 'অসাধারণ', Good: 'ভালো', NeedsImprovement: 'উন্নতি দরকার', Incomplete: 'অসম্পূর্ণ', StarWork: 'তারকা' }[r] || r; }

function _reactionBurst(btn) {
  const colors = {
    Excellent: ['#f59e0b','#fcd34d','#fef08a','#f97316'],
    StarWork:  ['#eab308','#fde047','#fef9c3','#f59e0b'],
    Good:      ['#16a34a','#4ade80','#bbf7d0','#22c55e'],
    NeedsImprovement: ['#ea580c','#fb923c','#fed7aa','#f97316'],
    Incomplete:['#dc2626','#f87171','#fecaca','#ef4444'],
  };
  const r = btn.dataset.reaction;
  const palette = colors[r] || ['#6366f1','#a78bfa','#c4b5fd','#818cf8'];

  // Re-trigger bounce by removing + re-adding active class
  const emoji = btn.querySelector('.sub-reaction-emoji');
  if (emoji) { emoji.style.animation = 'none'; requestAnimationFrame(() => { emoji.style.animation = ''; }); }

  // Remove old particles
  btn.querySelectorAll('.rxn-particles').forEach(p => p.remove());

  const container = document.createElement('div');
  container.className = 'rxn-particles';
  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'rxn-particle';
    const angle = (i / count) * 360;
    const dist = 28 + Math.random() * 18;
    const rad = angle * Math.PI / 180;
    p.style.cssText = `
      background:${palette[i % palette.length]};
      --dx:${(Math.cos(rad)*dist).toFixed(1)}px;
      --dy:${(Math.sin(rad)*dist).toFixed(1)}px;
      animation-delay:${(Math.random()*60).toFixed(0)}ms;
    `;
    container.appendChild(p);
  }
  btn.appendChild(container);
  setTimeout(() => container.remove(), 700);
}
