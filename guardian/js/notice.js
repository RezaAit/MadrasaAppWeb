import { getNotices, markNoticeRead } from './api.js';
import { openLightbox } from '../../teacher/js/file-upload.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';
import { BASE_URL } from '../../shared/js/api-config.js';
const CAT_LABEL = { Notice: 'নোটিশ', Circular: 'সার্কুলার', Event: 'ইভেন্ট' };
const CAT_COLOR = { Notice: '#2563eb', Circular: '#7c3aed', Event: '#d97706' };
const CAT_BG    = { Notice: '#eff6ff', Circular: '#ede9fe', Event: '#fffbeb' };
const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

export async function loadNotices(container, child) {
  container.innerHTML = `
    <style>
      .notice-card-content.rte-content b, .notice-card-content.rte-content strong { font-weight: 700; }
      .notice-card-content.rte-content i { font-style: italic; }
      .notice-card-content.rte-content u { text-decoration: underline; }
    </style>
    <div class="p-16">
      <div id="notice-list" class="stagger-in"></div>
    </div>
  `;

  const res = await getNotices(child.studentIID ?? child.studentIId);
  const all  = res.results || [];
  const list = document.getElementById('notice-list');

  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-title">কোনো নোটিশ নেই</div></div>`;
    return;
  }

  const chevronSvg = `<svg class="nh-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

  // Group: year → month
  const byYear = new Map();
  for (const n of all) {
    const d = new Date(n.publishDate ?? n.PublishDate ?? Date.now());
    const yr = d.getFullYear();
    const mo = d.getMonth();
    if (!byYear.has(yr)) byYear.set(yr, new Map());
    const byMonth = byYear.get(yr);
    if (!byMonth.has(mo)) byMonth.set(mo, []);
    byMonth.get(mo).push(n);
  }

  const now = new Date();
  let html = '';
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

  for (const yr of sortedYears) {
    const isCurrentYear = yr === now.getFullYear();
    const byMonth = byYear.get(yr);
    const totalYear = [...byMonth.values()].reduce((s, arr) => s + arr.length, 0);
    let monthsHtml = '';
    const sortedMonths = [...byMonth.keys()].sort((a, b) => b - a);
    for (const mo of sortedMonths) {
      const isCurrentMonth = isCurrentYear && mo === now.getMonth();
      const items = byMonth.get(mo);
      monthsHtml += `
        <div class="nh-month-block">
          <div class="gh-month-header nh-month-header">
            <div class="gh-month-left">
              <span class="gh-month-name">${MONTHS_BN[mo]}</span>
            </div>
            <div class="gh-month-right">
              <span class="gh-month-count">${items.length}টি</span>
              <svg class="gh-month-chevron${isCurrentMonth ? ' open' : ''}" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="gh-month-body nh-month-body${isCurrentMonth ? ' open' : ''}">${items.map(_noticeCardHtml).join('')}</div>
        </div>`;
    }
    html += `
      <div class="gh-year-group nh-year-block">
        <div class="gh-year-header nh-year-header${isCurrentYear ? '' : ' gh-closed'}">
          <span class="gh-year-title">${yr} সাল</span>
          <div class="gh-year-right">
            <span class="gh-year-meta">${totalYear}টি</span>
            <svg class="gh-year-chevron nh-chevron${isCurrentYear ? ' open' : ''}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="gh-year-body nh-year-body"${isCurrentYear ? '' : ' style="display:none;"'}>${monthsHtml}</div>
      </div>`;
  }

  list.innerHTML = html;

  // Accordion
  list.querySelectorAll('.nh-year-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const body = hdr.nextElementSibling;
      const chev = hdr.querySelector('.gh-year-chevron');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      chev?.classList.toggle('open', !isOpen);
      hdr.classList.toggle('gh-closed', isOpen);
    });
  });
  list.querySelectorAll('.nh-month-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const body = hdr.nextElementSibling;
      const chev = hdr.querySelector('.gh-month-chevron');
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      chev?.classList.toggle('open', !isOpen);
    });
  });

  // Lightbox
  list.querySelectorAll('[data-lightbox]').forEach(el =>
    el.addEventListener('click', () => openLightbox(el.dataset.lightbox)));

  // Card click → detail
  list.querySelectorAll('.gn-notice-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.noticeId;
      const n = all.find(x => String(x.id) === String(id));
      if (!n) return;
      // Mark read
      if (!n.isRead) { n.isRead = true; markNoticeRead(n.id); card.classList.remove('gn-unread'); }
      _openDetail(n);
    });
  });
}

function _noticeCardHtml(n) {
  const cat    = n.category ?? 'Notice';
  const id     = n.id;
  const color  = CAT_COLOR[cat] || '#2563eb';
  const bg     = CAT_BG[cat]   || '#eff6ff';
  const unread = !n.isRead;
  const preview = _truncate(n.content, 120);
  const hasAttach = !!(n.attachmentUrl);
  return `
  <div class="gn-notice-card${unread ? ' gn-unread' : ''} fade-in" data-notice-id="${id}" style="margin:6px 12px 6px 20px;cursor:pointer;">
    <div style="display:flex;align-items:stretch;">
      <div style="width:4px;background:${color};flex-shrink:0;border-radius:12px 0 0 12px;"></div>
      <div style="flex:1;padding:12px 14px 10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="font-size:.68rem;font-weight:800;padding:2px 9px;border-radius:999px;background:${bg};color:${color};letter-spacing:.2px;">${CAT_LABEL[cat] || cat}</span>
          ${unread ? '<span style="font-size:.63rem;font-weight:700;background:#ef4444;color:#fff;padding:2px 7px;border-radius:999px;">নতুন</span>' : ''}
          <span style="margin-left:auto;font-size:.68rem;color:#94a3b8;">${_fmt(n.publishDate)}</span>
        </div>
        <div style="font-size:.92rem;font-weight:700;color:#0f172a;line-height:1.35;margin-bottom:4px;">${n.title ?? ''}</div>
        ${preview ? `<div style="font-size:.78rem;color:#64748b;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${preview}</div>` : ''}
        ${hasAttach ? `<div style="display:flex;align-items:center;gap:4px;margin-top:6px;font-size:.7rem;color:#94a3b8;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>সংযুক্তি আছে</div>` : ''}
      </div>
    </div>
  </div>`;
}

function _attachmentHtml(rawUrl) {
  if (!rawUrl) return '';
  const urls = _parseUrls(rawUrl);
  if (!urls.length) return '';
  const items = urls.map((url, i) => {
    const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) return `<a href="${full}" target="_blank" class="glve-chip glve-chip-pdf" style="text-decoration:none;" onclick="event.stopPropagation()">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>PDF ${i+1}</span>
    </a>`;
    return `<div class="glve-chip glve-chip-img" data-lightbox="${full}" style="cursor:pointer;" onclick="event.stopPropagation()">
      <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
      <div class="glve-chip-eye"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;" onclick="event.stopPropagation()">${items}</div>`;
}

function _openDetail(n) {
  const existing = document.getElementById('gn-detail-overlay');
  if (existing) existing.remove();

  const cat   = n.category ?? n.Category ?? 'Notice';
  const color = CAT_COLOR[cat] || '#2563eb';
  const ov = document.createElement('div');
  ov.id = 'gn-detail-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:201;background:var(--bg,#f0f2f5);overflow-y:auto;';

  const attachHtml = _attachmentDetailHtml(n.attachmentUrl);

  ov.innerHTML = `
    <div style="position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:10px;padding:14px 16px;background:linear-gradient(135deg,#1a1a2e 0%,#2563eb 100%);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);">
      <button id="gn-back" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;backdrop-filter:blur(4px);">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.68rem;opacity:.75;letter-spacing:.5px;text-transform:uppercase;font-weight:600;">নোটিশ বিস্তারিত</div>
        <div style="font-size:.95rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.title ?? ''}</div>
      </div>
    </div>

    <div style="padding:0 0 48px;">

      <!-- hero strip -->
      <div style="height:5px;background:linear-gradient(90deg,${color},${color}88);"></div>

      <!-- meta row -->
      <div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0;flex-wrap:wrap;">
        <span style="font-size:.7rem;font-weight:800;padding:3px 10px;border-radius:999px;background:${CAT_BG[cat]||'#eff6ff'};color:${color};">${CAT_LABEL[cat]||cat}</span>
        <div style="display:flex;align-items:center;gap:4px;font-size:.72rem;color:#64748b;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
          ${_fmt(n.publishDate)}
        </div>
      </div>

      <!-- title block -->
      <div style="padding:12px 16px 0;">
        <h2 style="font-size:1.15rem;font-weight:800;color:#0f172a;line-height:1.4;margin:0;">${n.title ?? ''}</h2>
      </div>

      ${attachHtml ? `
      <!-- attachments -->
      <div style="padding:14px 16px 0;">
        <div style="font-size:.72rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px;">সংযুক্তি</div>
        ${attachHtml}
      </div>` : ''}

      <!-- divider -->
      <div style="margin:16px 16px 0;height:1px;background:#f1f5f9;"></div>

      <!-- content -->
      <div style="padding:14px 16px 0;font-size:.93rem;line-height:1.9;color:#1e293b;" class="rte-content">${n.content ?? ''}</div>
    </div>
  `;

  document.body.appendChild(ov);
  attachRipple(ov.querySelector('#gn-back'));
  ov.querySelector('#gn-back').addEventListener('click', () => ov.remove());

  ov.querySelectorAll('[data-lightbox]').forEach(el =>
    el.addEventListener('click', () => openLightbox(el.dataset.lightbox)));
}

function _attachmentDetailHtml(rawUrl) {
  if (!rawUrl) return '';
  const urls = _parseUrls(rawUrl);
  if (!urls.length) return '';
  const items = urls.map((url, i) => {
    const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) return `<a href="${full}" target="_blank" class="glve-chip glve-chip-pdf" style="text-decoration:none;">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dc2626" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>PDF ${i+1}</span>
    </a>`;
    return `<div class="glve-chip glve-chip-img" data-lightbox="${full}" style="cursor:pointer;">
      <img src="${full}" alt="সংযুক্তি ${i+1}" loading="lazy">
      <div class="glve-chip-eye"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${items}</div>`;
}

function _parseUrls(raw) {
  if (!raw) return [];
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.filter(Boolean); } catch (_) {}
  return [raw];
}

function _truncate(html, max) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '');
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function _fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
}
