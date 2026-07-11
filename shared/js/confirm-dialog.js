let _overlay = null;

export function showConfirm(message, { confirmText = 'হ্যাঁ', cancelText = 'বাতিল', danger = true } = {}) {
  return new Promise(resolve => {
    if (_overlay) _overlay.remove();

    _overlay = document.createElement('div');
    _overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(15,23,42,.45);backdrop-filter:blur(2px);
      padding:20px;animation:_cfFadeIn .15s ease;
    `;

    _overlay.innerHTML = `
      <style>
        @keyframes _cfFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes _cfSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      </style>
      <div style="
        background:#fff;border-radius:16px;padding:24px 20px 18px;
        max-width:320px;width:100%;box-shadow:0 20px 60px rgba(15,23,42,.25);
        animation:_cfSlideUp .18s ease;text-align:center;
      ">
        <div style="
          width:48px;height:48px;border-radius:50%;margin:0 auto 14px;
          background:${danger ? '#fff1f2' : '#f0fdf4'};
          display:flex;align-items:center;justify-content:center;
        ">
          ${danger
            ? `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
          }
        </div>
        <div style="font-size:.95rem;font-weight:600;color:#0f172a;line-height:1.5;margin-bottom:20px;">${message}</div>
        <div style="display:flex;gap:10px;">
          <button id="_cf-cancel" style="
            flex:1;padding:10px;border-radius:10px;border:1.5px solid #e2e8f0;
            background:#f8fafc;color:#475569;font-size:.88rem;font-weight:600;cursor:pointer;
          ">${cancelText}</button>
          <button id="_cf-confirm" style="
            flex:1;padding:10px;border-radius:10px;border:none;
            background:${danger ? 'linear-gradient(135deg,#e11d48,#be123c)' : 'linear-gradient(135deg,#16a34a,#15803d)'};
            color:#fff;font-size:.88rem;font-weight:700;cursor:pointer;
          ">${confirmText}</button>
        </div>
      </div>
    `;

    const close = (result) => { _overlay.remove(); _overlay = null; resolve(result); };

    _overlay.querySelector('#_cf-confirm').onclick = () => close(true);
    _overlay.querySelector('#_cf-cancel').onclick  = () => close(false);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
    });

    document.body.appendChild(_overlay);
    _overlay.querySelector('#_cf-confirm').focus();
  });
}
