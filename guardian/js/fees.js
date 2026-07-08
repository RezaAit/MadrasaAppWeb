import { getFeesInfo, getReceiptDetails, getStudentDue } from './api.js';
import { showToast } from './dashboard.js';
import { attachRippleAll, attachRipple } from '../../shared/js/ripple.js';

const BN_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

function _monthLabel(h) {
  if (h.MonthId >= 1 && h.MonthId <= 12) return BN_MONTHS[h.MonthId - 1];
  if (h.PaymentDate) {
    const d = new Date(h.PaymentDate);
    if (!isNaN(d)) return BN_MONTHS[d.getMonth()];
  }
  return '—';
}

function _dateStr(paymentDate) {
  if (!paymentDate) return '—';
  const d = new Date(paymentDate);
  if (isNaN(d)) return '—';
  return `${d.getDate()} ${BN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function _yearOf(paymentDate) {
  if (!paymentDate) return 0;
  const d = new Date(paymentDate);
  return isNaN(d) ? 0 : d.getFullYear();
}

export async function loadFees(container, child) {

  const [res, dueRes] = await Promise.all([
    getFeesInfo(child.studentIID),
    getStudentDue(child.studentIID),
  ]);
  const history = Array.isArray(res.results) ? res.results : [];
  const totalPaid = history.reduce((s, h) => s + (h.ReceivedAmount || 0), 0);
  const dueAmount = dueRes?.results?.dueAmount ?? 0;

  const byYear = {};
  history.forEach(h => {
    const yr = _yearOf(h.PaymentDate);
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(h);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();

  container.innerHTML = `
    <div class="p-16">
      <div class="card mb-16" style="padding:0;border:1px solid var(--border);overflow:hidden;">
        <div style="display:grid;grid-template-columns:1fr 1fr;">
          <div id="fees-paid-stat" style="padding:18px 16px;text-align:center;border-right:1px solid var(--border);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s;">
            <div style="font-size:.72rem;color:var(--text-muted);font-weight:600;margin-bottom:4px;">মোট পরিশোধিত</div>
            <div style="font-size:1.55rem;font-weight:800;color:#1E3A5F;">৳${totalPaid.toLocaleString()}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:3px;">${history.length}টি পেমেন্ট</div>
          </div>
          <div id="fees-due-stat" style="padding:18px 16px;text-align:center;background:${dueAmount > 0 ? '#fff5f5' : '#f0fdf4'};cursor:${dueAmount > 0 ? 'pointer' : 'default'};-webkit-tap-highlight-color:transparent;transition:background .15s;">
            <div style="font-size:.72rem;color:${dueAmount > 0 ? '#dc2626' : '#16a34a'};font-weight:600;margin-bottom:4px;">বকেয়া</div>
            <div style="font-size:1.55rem;font-weight:800;color:${dueAmount > 0 ? '#dc2626' : '#16a34a'};">৳${dueAmount.toLocaleString()}</div>
            <div style="font-size:.72rem;color:${dueAmount > 0 ? '#dc2626' : '#16a34a'};margin-top:3px;opacity:.8;">${dueAmount > 0 ? '👆 পরিশোধ করুন' : '✓ পরিশোধিত'}</div>
          </div>
        </div>
      </div>


      <div class="section-header"><span class="section-title">পরিশোধের ইতিহাস</span></div>
      ${history.length === 0
        ? `<div class="empty-state"><div class="empty-title">কোনো রেকর্ড নেই</div></div>`
        : years.map(yr => {
            const items = byYear[yr];
            const yrTotal = items.reduce((s, h) => s + (h.ReceivedAmount || 0), 0);
            const isOpen = yr === currentYear || years[0] === yr;
            return `
              <div class="fees-year-group mb-12 ${isOpen ? 'expanded' : ''}" data-year="${yr}">
                <button class="fees-year-toggle ${isOpen ? 'open' : ''}">
                  <span style="font-weight:700;">${yr} সাল</span>
                  <span style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:.82rem;color:#1E3A5F;font-weight:600;">৳${yrTotal.toLocaleString()}</span>
                    <svg class="fees-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </span>
                </button>
                <div class="fees-year-items card" style="padding:0;overflow:hidden;${isOpen ? '' : 'display:none;'}">
                  ${items.map(h => `
                    <div class="fee-receipt-row" data-master-id="${h.Id}" style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;">
                      <div>
                        <div style="font-weight:600;font-size:.9rem;">${_monthLabel(h)}</div>
                        <div style="font-size:.78rem;color:var(--text-muted);">পরিশোধ: ${_dateStr(h.PaymentDate)}</div>
                        <div style="font-size:.78rem;color:var(--text-muted);">রসিদ: ${h.MoneyReceipt || '—'}</div>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div style="font-size:1rem;font-weight:700;color:#1E3A5F;">৳${(h.ReceivedAmount || 0).toLocaleString()}</div>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </div>`).join('')}
                </div>
              </div>`;
          }).join('')
      }
    </div>
  `;

  // Stats card clicks
  container.querySelector('#fees-paid-stat')?.addEventListener('click', () => {
    container.querySelector('.fees-year-group')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  container.querySelector('#fees-due-stat')?.addEventListener('click', () => {
    if (dueAmount > 0) _openBkashOverlay(child.studentInsID, dueAmount);
  });

  // Accordion toggles
  attachRippleAll('.fees-year-toggle', container);
  container.querySelectorAll('.fees-year-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.fees-year-group');
      const items = group.querySelector('.fees-year-items');
      const isNowOpen = group.classList.toggle('expanded');
      btn.classList.toggle('open', isNowOpen);
      items.style.display = isNowOpen ? '' : 'none';
    });
  });

  // Receipt row click
  attachRippleAll('.fee-receipt-row', container);
  container.querySelectorAll('.fee-receipt-row').forEach(row => {
    row.addEventListener('click', () => showReceiptModal(row.dataset.masterId));
    row.addEventListener('mouseenter', () => row.style.background = '#F8FAFF');
    row.addEventListener('mouseleave', () => row.style.background = '');
  });
}

async function showReceiptModal(masterId) {
  // Remove any existing receipt overlay
  document.getElementById('receipt-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'receipt-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(0,0,0,0.6)',
    'z-index:99999',
    'display:flex',
    'align-items:flex-end',
    'justify-content:center',
  ].join(';');

  overlay.innerHTML = `
    <div id="receipt-sheet" style="
      background:#fff;
      border-radius:20px 20px 0 0;
      width:100%;
      max-width:500px;
      max-height:90vh;
      display:flex;
      flex-direction:column;
      transform:translateY(100%);
      transition:transform .3s cubic-bezier(.32,.72,0,1);
    ">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
        <span style="font-weight:700;font-size:1rem;color:#111827;">পেমেন্ট রসিদ</span>
        <button id="receipt-close" style="background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#6b7280;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Scrollable body -->
      <div id="receipt-body" style="overflow-y:auto;flex:1;padding:20px;">
        <div style="text-align:center;padding:32px 0;">
          <div style="width:40px;height:40px;border-radius:50%;border:3px solid #1E3A5F;border-top-color:transparent;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>
          <div style="font-size:.85rem;color:#6b7280;">রসিদ লোড হচ্ছে...</div>
        </div>
      </div>

      <!-- Action buttons -->
      <div id="receipt-actions" style="display:none;flex-shrink:0;padding:12px 16px;border-top:1px solid #e5e7eb;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <button id="receipt-print" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;background:#F0F7FF;border:1px solid #BFDBFE;border-radius:12px;cursor:pointer;color:#1E3A5F;font-size:.75rem;font-weight:600;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          প্রিন্ট
        </button>
        <button id="receipt-download" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;cursor:pointer;color:#1d4ed8;font-size:.75rem;font-weight:600;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ডাউনলোড
        </button>
        <button id="receipt-share" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;cursor:pointer;color:#7c3aed;font-size:.75rem;font-weight:600;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          শেয়ার
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('receipt-sheet').style.transform = 'translateY(0)';
    });
  });

  // Close handlers
  const close = () => {
    document.getElementById('receipt-sheet').style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 300);
  };
  attachRipple(document.getElementById('receipt-close'));
  document.getElementById('receipt-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Fetch data
  const res = await getReceiptDetails(masterId);
  const r = res?.results;
  if (!r?.master && !r?.Master) {
    showToast('রসিদ লোড হয়নি', 'error');
    close();
    return;
  }

  const m = r.master || r.Master;
  const details = r.details || r.Details || [];

  const receiptHtml = `
    <div id="receipt-printable">
      <!-- Institution header with logo -->
      <div style="text-align:center;padding-bottom:16px;border-bottom:2px dashed #E5E7EB;margin-bottom:16px;">
        <img src="/images/headerlogo.png" alt="Madrasatul Huda" style="width:100%;height:auto;display:block;margin-bottom:10px;" onerror="this.style.display='none'">
        <div style="font-size:.7rem;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">মানি রসিদ নং</div>
        <div style="font-size:1.5rem;font-weight:900;color:#1E3A5F;font-family:monospace;">${m.MoneyReceipt || '—'}</div>
      </div>

      <!-- Student info -->
      <div style="background:#F8FAFF;border-radius:12px;padding:12px 14px;margin-bottom:16px;border:1px solid #E5E7EB;">
        <div style="font-size:.78rem;color:#6b7280;margin-bottom:2px;">শিক্ষার্থী</div>
        <div style="font-weight:700;font-size:.95rem;color:#111827;">${m.FullName || '—'}</div>
        <div style="font-size:.78rem;color:#374151;margin-top:4px;">আইডি: ${m.StudentInsID || '—'} · রোল: ${m.RollNo || '—'}</div>
        <div style="font-size:.78rem;color:#374151;margin-top:2px;">পরিশোধের তারিখ: ${_dateStr(m.PaymentDate)}</div>
      </div>

      <!-- Details breakdown -->
      <div style="margin-bottom:16px;">
        <div style="font-size:.78rem;font-weight:700;color:#6b7280;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;">বিবরণ</div>
        ${details.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f3f4f6;">
            <div>
              <div style="font-size:.88rem;font-weight:600;color:#111827;">${d.HeadName || '—'}</div>
              <div style="font-size:.75rem;color:#6b7280;">${d.MonthName || ''} ${d.Year || ''}</div>
            </div>
            <div style="font-size:.92rem;font-weight:700;color:#1E3A5F;">৳${(d.ReceiveAmount || 0).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>

      <!-- Total -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#1E3A5F;border-radius:12px;color:#fff;">
        <span style="font-weight:700;font-size:.95rem;">মোট পরিশোধিত</span>
        <span style="font-size:1.2rem;font-weight:900;">৳${(m.ReceivedAmount || 0).toLocaleString()}</span>
      </div>
    </div>
  `;

  document.getElementById('receipt-body').innerHTML = receiptHtml;
  document.getElementById('receipt-actions').style.display = 'grid';
  attachRippleAll('#receipt-print, #receipt-download, #receipt-share', overlay);

  // Print
  document.getElementById('receipt-print').addEventListener('click', () => {
    const html = document.getElementById('receipt-printable').innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>রসিদ ${m.MoneyReceipt}</title>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; padding: 24px; max-width: 420px; margin: 0 auto; color: #111; }
        img { max-width: 100%; }
        @media print { body { padding: 8px; } button { display: none; } }
      </style>
      </head><body>${html}<script>window.onload=()=>{ window.print(); window.close(); }<\/script></body></html>
    `);
    w.document.close();
  });

  // Download as text summary
  document.getElementById('receipt-download').addEventListener('click', () => {
    const lines = [
      `মানি রসিদ: ${m.MoneyReceipt}`,
      `শিক্ষার্থী: ${m.FullName}`,
      `তারিখ: ${_dateStr(m.PaymentDate)}`,
      `রোল: ${m.RollNo}`,
      '---',
      ...details.map(d => `${d.HeadName} (${d.MonthName} ${d.Year}): ৳${d.ReceiveAmount}`),
      '---',
      `মোট: ৳${m.ReceivedAmount}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `রসিদ_${m.MoneyReceipt}.txt`;
    a.click();
  });

  // Share
  document.getElementById('receipt-share').addEventListener('click', async () => {
    const text = `মানি রসিদ: ${m.MoneyReceipt}\nশিক্ষার্থী: ${m.FullName}\nতারিখ: ${_dateStr(m.PaymentDate)}\nমোট: ৳${m.ReceivedAmount}`;
    if (navigator.share) {
      await navigator.share({ title: `রসিদ ${m.MoneyReceipt}`, text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast('রসিদ তথ্য কপি হয়েছে', 'success');
    }
  });
}

function _openBkashOverlay(studentInsID, dueAmount) {
  document.getElementById('bkash-overlay')?.remove();

  const ov = document.createElement('div');
  ov.id = 'bkash-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;';

  ov.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:#E2136E;color:#fff;flex-shrink:0;">
      <button id="bkash-close" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;">✕</button>
      <div style="font-size:.95rem;font-weight:700;">bKash পেমেন্ট</div>
    </div>
    <iframe
      id="bkash-iframe"
      src="https://a.madrasatulhuda.com/Sbook/bkashapppayment.html?StudentInsID=${encodeURIComponent(studentInsID)}&DueFees=${encodeURIComponent(dueAmount)}&redirect=APPPOSTMESSAGE&v=${Date.now()}"
      style="flex:1;border:none;width:100%;"
      allow="payment"
    ></iframe>
  `;

  document.body.appendChild(ov);

  document.getElementById('bkash-close').addEventListener('click', () => ov.remove());

  // bkash.html থেকে postMessage এ result পাব
  function onMessage(e) {
    if (e.origin !== 'https://a.madrasatulhuda.com') return;
    const data = e.data;
    if (data?.type === 'bkash_success') {
      ov.remove();
      window.removeEventListener('message', onMessage);
      showToast(`পরিশোধ সফল! রসিদ: ${data.receipt ?? data.trxID}`, 'success');
      // fees reload করো
      document.querySelector('[data-section="fees"]')?.click();
    } else if (data?.type === 'bkash_cancelled') {
      ov.remove();
      window.removeEventListener('message', onMessage);
      showToast('পেমেন্ট বাতিল হয়েছে', 'error');
    }
  }
  window.addEventListener('message', onMessage);
}
