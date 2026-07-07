// Canvas-based photo annotation — lightshot-style, fully functional
// Tools: pen, marker, eraser, line, arrow, rect, circle, text

let _inst = null;

function _newInst(canvas) {
  return {
    canvas,
    ctx:       canvas.getContext('2d', { willReadFrequently: true }),
    mode:      'pen',
    color:     '#e53e3e',
    size:      8,
    fontSize:  24,
    shapes:    [],       // committed shapes
    history:   [],       // ImageData snapshots for undo (one per committed shape)
    bgSnap:    null,     // initial clean image snapshot
    painting:  false,
    sx: 0, sy: 0,        // stroke start
    textEl:    null,     // live floating <input>
    _h:        {},       // event handler refs
  };
}

// ── init ─────────────────────────────────────────────────────────────────────
export async function initAnnotation(canvasEl, imageUrl) {
  if (_inst) _destroy(_inst);
  _inst = _newInst(canvasEl);

  // Convert external URLs to blob URLs to avoid canvas taint (CORS)
  let src = imageUrl;
  if (imageUrl && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      src = URL.createObjectURL(blob);
    } catch (_) {
      src = imageUrl; // fallback — canvas may be tainted but at least shows image
    }
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const { canvas, ctx } = _inst;
      canvas.width  = img.naturalWidth  || 800;
      canvas.height = img.naturalHeight || 600;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      _inst.bgSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      _bind(_inst);
      canvas.style.cursor = 'crosshair';
      resolve();
    };
    img.onerror = () => { _bind(_inst); resolve(); };
    img.src = src;
  });
}

function _destroy(inst) {
  const c = inst.canvas, h = inst._h;
  c.removeEventListener('mousedown',  h.start);
  c.removeEventListener('mousemove',  h.move);
  c.removeEventListener('mouseup',    h.end);
  c.removeEventListener('mouseleave', h.end);
  c.removeEventListener('touchstart', h.start);
  c.removeEventListener('touchmove',  h.move);
  c.removeEventListener('touchend',   h.end);
  inst.textEl?.remove();
}

// ── coordinate helpers ────────────────────────────────────────────────────────
function _pt(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
}
function _ptEnd(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  const t = e.changedTouches ? e.changedTouches[0] : e;
  return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
}

// ── snapshot helpers ──────────────────────────────────────────────────────────
function _snap(inst) {
  return inst.ctx.getImageData(0, 0, inst.canvas.width, inst.canvas.height);
}
function _restore(inst, snap) {
  inst.ctx.putImageData(snap, 0, 0);
}

// ── event binding ─────────────────────────────────────────────────────────────
function _bind(inst) {
  const { canvas } = inst;
  const isFree = () => ['pen','marker','highlight','eraser'].includes(inst.mode);

  // highlight/marker need path replay to avoid alpha stacking
  const isReplay = () => inst.mode === 'highlight' || inst.mode === 'marker';

  const onStart = e => {
    // two-finger touch = scroll, not draw
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
    if (inst.mode === 'text') { _startText(inst, e); return; }
    _commitText(inst);
    inst.painting = true;
    const p = _pt(e, canvas);
    inst.sx = p.x; inst.sy = p.y;
    inst._preSnap = _snap(inst);
    inst._pathPts = [p];

    if (isFree() && !isReplay()) {
      const ctx = inst.ctx;
      ctx.save();
      _applyStrokeStyle(ctx, inst);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      inst._strokeCtx = ctx;
    }
  };

  const onMove = e => {
    // two-finger touch = let browser scroll naturally
    if (e.touches && e.touches.length > 1) {
      inst.painting = false;
      return;
    }
    if (!inst.painting) return;
    e.preventDefault();
    const p = _pt(e, canvas);

    if (inst.mode === 'eraser') {
      _eraseAt(inst, p.x, p.y);
    } else if (isReplay()) {
      inst._pathPts.push(p);
      _restore(inst, inst._preSnap);
      const ctx = inst.ctx;
      ctx.save();
      _applyStrokeStyle(ctx, inst);
      ctx.beginPath();
      ctx.moveTo(inst._pathPts[0].x, inst._pathPts[0].y);
      for (let i = 1; i < inst._pathPts.length; i++) ctx.lineTo(inst._pathPts[i].x, inst._pathPts[i].y);
      ctx.stroke();
      ctx.restore();
    } else if (isFree()) {
      const ctx = inst._strokeCtx;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    } else {
      _restore(inst, inst._preSnap);
      _drawShape(inst.ctx, inst.mode, inst.sx, inst.sy, p.x, p.y, inst.color, inst.size, inst.fontSize);
    }
  };

  const onEnd = e => {
    if (!inst.painting) return;
    inst.painting = false;
    const p = _ptEnd(e, canvas);

    if (inst.mode === 'eraser') {
      inst.history.push(inst._preSnap);
    } else if (isReplay()) {
      inst.history.push(inst._preSnap);
    } else if (isFree()) {
      inst._strokeCtx?.restore();
      inst.history.push(inst._preSnap);
    } else {
      _restore(inst, inst._preSnap);
      inst.history.push(inst._preSnap);
      _drawShape(inst.ctx, inst.mode, inst.sx, inst.sy, p.x, p.y, inst.color, inst.size, inst.fontSize);
    }
    inst._preSnap = null;
    inst._pathPts = [];
  };

  inst._h = { start: onStart, move: onMove, end: onEnd };
  canvas.addEventListener('mousedown',  onStart);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  // passive:false only on start so we can preventDefault for single finger;
  // move uses conditional preventDefault inside handler
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onEnd);
}

// ── eraser: copy pixels from bgSnap in a radius ───────────────────────────────
function _eraseAt(inst, cx, cy) {
  const r = inst.size * 8;
  const { canvas, ctx, bgSnap } = inst;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(canvas.width,  Math.ceil(cx + r));
  const y1 = Math.min(canvas.height, Math.ceil(cy + r));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const patch = new ImageData(
    bgSnap.data.slice((y0 * canvas.width + x0) * 4, (y0 * canvas.width + x0) * 4 + w * h * 4),
    w, h
  );
  // Rebuild correct rectangular slice
  const src = bgSnap.data;
  const dst = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const si = ((y0 + row) * canvas.width + x0) * 4;
    const di = row * w * 4;
    dst.set(src.subarray(si, si + w * 4), di);
  }
  ctx.putImageData(new ImageData(dst, w, h), x0, y0);
}

// ── apply stroke style to ctx ─────────────────────────────────────────────────
function _applyStrokeStyle(ctx, inst) {
  ctx.lineCap    = 'round';
  ctx.lineJoin   = 'round';
  if (inst.mode === 'marker') {
    ctx.globalAlpha      = 0.55;
    ctx.strokeStyle      = inst.color;
    ctx.lineWidth        = inst.size * 4;
    ctx.globalCompositeOperation = 'source-over';
  } else if (inst.mode === 'highlight') {
    ctx.globalAlpha      = 0.35;
    ctx.strokeStyle      = '#facc15';
    ctx.lineWidth        = inst.size * 10;
    ctx.lineCap          = 'square';
    ctx.lineJoin         = 'miter';
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.globalAlpha      = 1;
    ctx.strokeStyle      = inst.color;
    ctx.lineWidth        = inst.size;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── draw committed shape ──────────────────────────────────────────────────────
function _drawShape(ctx, type, x1, y1, x2, y2, color, size, fontSize) {
  ctx.save();
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = size;

  switch (type) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;

    case 'arrow': {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head  = 12 + size * 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fill();
      break;
    }

    case 'rect':
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      break;

    case 'circle': {
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ── text overlay ──────────────────────────────────────────────────────────────
function _startText(inst, e) {
  _commitText(inst);
  const { canvas } = inst;
  const p    = _pt(e, canvas);
  const rect = canvas.getBoundingClientRect();
  const sx   = rect.width  / canvas.width;
  const sy   = rect.height / canvas.height;

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'লিখুন...';
  Object.assign(inp.style, {
    position:     'fixed',
    left:         (rect.left + p.x * sx) + 'px',
    top:          (rect.top  + p.y * sy) + 'px',
    minWidth:     '120px',
    maxWidth:     '260px',
    fontSize:     Math.max(14, inst.fontSize * sx) + 'px',
    fontWeight:   '700',
    color:        inst.color,
    background:   'rgba(255,255,255,.9)',
    border:       '2px dashed ' + inst.color,
    borderRadius: '6px',
    padding:      '3px 8px',
    outline:      'none',
    zIndex:       '99999',
    boxShadow:    '0 2px 12px rgba(0,0,0,.3)',
  });
  document.body.appendChild(inp);
  inp.focus();
  inst.textEl = inp;
  inst._textPt = { x: p.x, y: p.y + inst.fontSize * 0.85 };

  const _reposition = () => {
    const r2 = canvas.getBoundingClientRect();
    inp.style.left = (r2.left + p.x * (r2.width  / inst.canvas.width))  + 'px';
    inp.style.top  = (r2.top  + p.y * (r2.height / inst.canvas.height)) + 'px';
  };
  window.addEventListener('scroll', _reposition, true);
  inp._removeScroll = () => window.removeEventListener('scroll', _reposition, true);

  const commit = () => {
    const txt = inp.value.trim();
    if (txt && inst.textEl === inp) {
      inst.history.push(_snap(inst));
      const ctx = inst.ctx;
      ctx.save();
      ctx.font        = `700 ${inst.fontSize}px sans-serif`;
      ctx.fillStyle   = inst.color;
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur  = 3;
      ctx.fillText(txt, inst._textPt.x, inst._textPt.y);
      ctx.restore();
    }
    inp._removeScroll?.();
    inp.remove();
    if (inst.textEl === inp) inst.textEl = null;
  };

  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { inp._removeScroll?.(); inp.remove(); if (inst.textEl === inp) inst.textEl = null; }
  });
  inp.addEventListener('blur', () => setTimeout(commit, 150));
}

function _commitText(inst) {
  if (inst.textEl) { inst.textEl.blur(); }
}

// ── public API ────────────────────────────────────────────────────────────────
const _cursors = {
  pen:       'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\' fill=\'%232563eb\' stroke=\'white\' stroke-width=\'1\'/%3E%3C/svg%3E") 0 24, crosshair',
  highlight: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'7\' y=\'3\' width=\'10\' height=\'8\' rx=\'1\' fill=\'%23facc15\' stroke=\'%23ca8a04\' stroke-width=\'1\'/%3E%3Cpath d=\'M9 11l-5 9h14l-5-9\' fill=\'%23facc15\' stroke=\'%23ca8a04\' stroke-width=\'1\'/%3E%3C/svg%3E") 12 24, crosshair',
  marker:    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'2\' y=\'9\' width=\'20\' height=\'6\' rx=\'3\' fill=\'%23e53e3e\' stroke=\'white\' stroke-width=\'1\'/%3E%3C/svg%3E") 12 12, crosshair',
  eraser:    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'3\' fill=\'white\' stroke=\'%2394a3b8\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, cell',
  line:      'crosshair',
  arrow:     'crosshair',
  rect:      'crosshair',
  circle:    'crosshair',
  text:      'text',
  scroll:    'grab',
};

export function setMode(mode) {
  if (!_inst) return;
  _commitText(_inst);
  _inst.mode = mode;
  _inst.canvas.style.cursor = _cursors[mode] || 'crosshair';
}
export function setColor(c)       { if (_inst) { _commitText(_inst); _inst.color = c; } }
export function setSize(s)        { if (_inst) _inst.size = Number(s); }
export function setFontSize(s)    { if (_inst) _inst.fontSize = Number(s); }

export function undo() {
  if (!_inst || !_inst.history.length) return;
  _commitText(_inst);
  const prev = _inst.history.pop();
  _inst.ctx.putImageData(prev, 0, 0);
}

export function clearAll() {
  if (!_inst) return;
  _commitText(_inst);
  _inst.history = [];
  if (_inst.bgSnap) _inst.ctx.putImageData(_inst.bgSnap, 0, 0);
}

export function getAnnotatedDataUrl() {
  if (!_inst) return null;
  _commitText(_inst);
  return _inst.canvas.toDataURL('image/jpeg', 0.9);
}

// ── fullscreen lightbox with pinch-zoom ───────────────────────────────────────
export function openLightbox(src) {
  if (document.getElementById('ann-lightbox')) return;

  const lb = document.createElement('div');
  lb.id = 'ann-lightbox';
  Object.assign(lb.style, {
    position: 'fixed', inset: '0', zIndex: '999999',
    background: 'rgba(0,0,0,0.96)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    touchAction: 'none', userSelect: 'none',
  });

  const img = document.createElement('img');
  img.src = src;
  Object.assign(img.style, {
    maxWidth: '100%', maxHeight: '100%',
    borderRadius: '6px',
    transformOrigin: 'center center',
    transition: 'transform 0.1s',
    cursor: 'zoom-in',
  });

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute', top: '16px', right: '16px',
    width: '36px', height: '36px', borderRadius: '50%',
    border: 'none', background: 'rgba(255,255,255,0.15)',
    color: '#fff', fontSize: '18px', cursor: 'pointer', zIndex: '1',
  });

  lb.appendChild(img);
  lb.appendChild(closeBtn);
  document.body.appendChild(lb);

  const close = () => lb.remove();
  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  // pinch-zoom + drag
  let scale = 1, tx = 0, ty = 0;
  let lastDist = 0, lastMx = 0, lastMy = 0, dragging = false;
  let startTx = 0, startTy = 0, startX = 0, startY = 0;

  function _apply() {
    img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
  }

  lb.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      dragging = true;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      startTx = tx; startTy = ty;
    }
  }, { passive: true });

  lb.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist) scale = Math.min(6, Math.max(1, scale * dist / lastDist));
      lastDist = dist;
      _apply();
    } else if (e.touches.length === 1 && dragging && scale > 1) {
      tx = startTx + (e.touches[0].clientX - startX);
      ty = startTy + (e.touches[0].clientY - startY);
      _apply();
    }
  }, { passive: false });

  lb.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastDist = 0;
    if (e.touches.length === 0) dragging = false;
    if (scale < 1.05) { scale = 1; tx = 0; ty = 0; _apply(); }
  }, { passive: true });

  // double-tap to reset
  let lastTap = 0;
  lb.addEventListener('touchend', () => {
    const now = Date.now();
    if (now - lastTap < 300) { scale = 1; tx = 0; ty = 0; _apply(); }
    lastTap = now;
  }, { passive: true });
}

export async function getAnnotatedBlob() {
  if (!_inst) return null;
  _commitText(_inst);
  return new Promise(r => _inst.canvas.toBlob(r, 'image/jpeg', 0.9));
}

// ── toolbar ───────────────────────────────────────────────────────────────────
const _CSS = `
.ann-tb{display:flex;flex-direction:column;background:#f1f5f9;border-radius:10px 10px 0 0;overflow:hidden;user-select:none;font-family:system-ui,sans-serif}

/* ── Row 1: tools ── */
.ann-tb-row1{display:flex;align-items:center;padding:6px 8px;gap:3px;background:#f1f5f9;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid #e2e8f0}
.ann-tb-row1::-webkit-scrollbar{display:none}
.ann-tb-btn{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9px;border:none;background:transparent;color:#64748b;cursor:pointer;flex-shrink:0;padding:0;transition:background .12s,color .12s}
.ann-tb-btn:hover{background:#e2e8f0;color:#1e293b}
.ann-tb-btn.ann-active{background:#dbeafe;color:#2563eb;box-shadow:inset 0 0 0 1.5px #93c5fd}
.ann-tb-sep{width:1px;height:24px;background:#cbd5e1;flex-shrink:0;margin:0 4px}
.ann-tb-act{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:none;background:transparent;color:#64748b;cursor:pointer;flex-shrink:0;padding:0;transition:all .12s}
.ann-tb-act:hover{background:#e2e8f0;color:#1e293b}
.ann-tb-del:hover{color:#dc2626!important}

/* ── Row 2: colors + dropdowns ── */
.ann-tb-row2{display:flex;align-items:center;padding:6px 10px;gap:10px;background:#e8edf5;border-bottom:1px solid #d1d9e6;overflow-x:auto;scrollbar-width:none}
.ann-tb-row2::-webkit-scrollbar{display:none}
.ann-clr{width:22px;height:22px;border-radius:50%;border:2.5px solid transparent;cursor:pointer;flex-shrink:0;padding:0;outline:none;transition:transform .12s,box-shadow .12s}
.ann-clr:hover{transform:scale(1.2)}
.ann-clr.ann-active{border-color:#fff;box-shadow:0 0 0 2.5px #2563eb}
.ann-cpick{width:22px;height:22px;border-radius:50%;border:2px solid #cbd5e1;cursor:pointer;padding:0;background:none;flex-shrink:0}
.ann-row2-sep{width:1px;height:20px;background:#cbd5e1;flex-shrink:0}
.ann-drop-wrap{display:flex;align-items:center;gap:5px;flex-shrink:0}
.ann-drop-lbl{font-size:.6rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.ann-drop{height:26px;padding:0 6px;border-radius:7px;border:1.5px solid #cbd5e1;background:#fff;color:#475569;font-size:.72rem;font-weight:600;cursor:pointer;outline:none;min-width:64px;transition:border-color .12s,color .12s;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;padding-right:20px}
.ann-drop:hover,.ann-drop:focus{border-color:#2563eb;color:#1e293b}
.ann-drop option{background:#fff;color:#1e293b}
`;

function _injectCSS() {
  if (document.getElementById('ann-tb-style')) return;
  const s = document.createElement('style');
  s.id = 'ann-tb-style';
  s.textContent = _CSS;
  document.head.appendChild(s);
}

export function buildToolbar(containerId) {
  _injectCSS();
  const container = typeof containerId === 'string'
    ? document.getElementById(containerId) : containerId;
  if (!container) return;
  const uid = Math.random().toString(36).slice(2, 8);

  const tools = [
    { mode:'pen',       title:'Pen',         svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
    { mode:'highlight', title:'Highlighter',  svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l-5 9h14l-5-9"/><rect x="7" y="3" width="10" height="8" rx="1"/></svg>`, fixedColor:'#facc15' },
    { mode:'marker',    title:'Marker',       svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="9" width="20" height="6" rx="3"/></svg>` },
    { mode:'eraser',    title:'Eraser',       svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16l10-10 7 7-2 2"/><path d="M7 20l3.5-3.5"/></svg>` },
    { mode:'line',      title:'Line',         svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
    { mode:'arrow',     title:'Arrow',        svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>` },
    { mode:'rect',      title:'Rectangle',    svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>` },
    { mode:'circle',    title:'Circle',       svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>` },
    { mode:'text',      title:'Text',         svg:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>` },
  ];

  const COLORS = ['#e53e3e','#3b82f6','#22c55e','#000000'];

  container.innerHTML = `
    <div class="ann-tb">
      <div class="ann-tb-row1">
        <button class="ann-tb-btn" id="ann-scroll-toggle-${uid}" title="Scroll / Pan mode" style="color:#d97706"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></button>
        <div class="ann-tb-sep"></div>
        ${tools.map(t => `<button class="ann-tb-btn${t.mode==='pen'?' ann-active':''}" data-mode="${t.mode}" title="${t.title}">${t.svg}</button>`).join('')}
        <div class="ann-tb-sep"></div>
        <button class="ann-tb-act" id="ann-undo" title="Undo"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.79"/></svg></button>
        <button class="ann-tb-act ann-tb-del" id="ann-clear" title="Clear all"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
      </div>
      <div class="ann-tb-row2">
        ${COLORS.map((c,i) => `<button class="ann-clr${i===0?' ann-active':''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
        <input type="color" class="ann-cpick" value="#e53e3e" title="Custom color">
        <div class="ann-row2-sep"></div>
        <div class="ann-drop-wrap">
          <span class="ann-drop-lbl">Thickness</span>
          <select class="ann-drop" id="ann-sz-sel-${uid}">
            <option value="2">2 px</option>
            <option value="4">4 px</option>
            <option value="6">6 px</option>
            <option value="8" selected>8 px</option>
            <option value="12">12 px</option>
            <option value="16">16 px</option>
            <option value="20">20 px</option>
            <option value="25">25 px</option>
            <option value="30">30 px</option>
          </select>
        </div>
        <div class="ann-row2-sep ann-font-only" style="display:none"></div>
        <div class="ann-drop-wrap ann-font-only" style="display:none">
          <span class="ann-drop-lbl">Font</span>
          <select class="ann-drop" id="ann-fs-sel-${uid}">
            <option value="14">14 px</option>
            <option value="18">18 px</option>
            <option value="24" selected>24 px</option>
            <option value="32">32 px</option>
            <option value="44">44 px</option>
            <option value="60">60 px</option>
          </select>
        </div>
      </div>
    </div>
  `;

  // tool buttons
  const _toolFixedColors = { highlight: '#facc15' };
  container.querySelectorAll('.ann-tb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.ann-tb-btn').forEach(b => b.classList.remove('ann-active'));
      btn.classList.add('ann-active');
      setMode(btn.dataset.mode);
      if (_toolFixedColors[btn.dataset.mode]) setColor(_toolFixedColors[btn.dataset.mode]);
      const isText = btn.dataset.mode === 'text';
      container.querySelectorAll('.ann-font-only').forEach(el => el.style.display = isText ? '' : 'none');
    });
  });

  // colors
  container.querySelectorAll('.ann-clr').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.ann-clr').forEach(s => s.classList.remove('ann-active'));
      sw.classList.add('ann-active');
      container.querySelector('.ann-cpick').value = sw.dataset.color;
      setColor(sw.dataset.color);
    });
  });
  container.querySelector('.ann-cpick').addEventListener('input', e => {
    container.querySelectorAll('.ann-clr').forEach(s => s.classList.remove('ann-active'));
    setColor(e.target.value);
  });

  // thickness dropdown
  container.querySelector(`#ann-sz-sel-${uid}`).addEventListener('change', e => setSize(Number(e.target.value)));
  setSize(8); // default 8px

  // font size dropdown
  container.querySelector(`#ann-fs-sel-${uid}`).addEventListener('change', e => setFontSize(Number(e.target.value)));

  // scroll/pan toggle — switches canvas wrapper between draw mode and scroll mode
  const scrollBtn = container.querySelector(`#ann-scroll-toggle-${uid}`);
  scrollBtn.addEventListener('click', () => {
    const wrap = container.parentElement?.querySelector('.annotation-canvas-wrap')
      || document.querySelector('.annotation-canvas-wrap');
    if (!wrap) return;
    const on = wrap.classList.toggle('ann-scroll-mode');
    scrollBtn.style.color = on ? '#92400e' : '#d97706';
    scrollBtn.style.background = on ? '#fef3c7' : '';
    scrollBtn.title = on ? 'Back to draw mode' : 'Scroll / Pan mode';
    if (_inst) _inst.canvas.style.cursor = on ? 'grab' : (_cursors[_inst.mode] || 'crosshair');
  });

  container.querySelector('#ann-undo') .addEventListener('click', undo);
  container.querySelector('#ann-clear').addEventListener('click', clearAll);
}
