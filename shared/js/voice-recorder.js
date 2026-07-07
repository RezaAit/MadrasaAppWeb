// Shared voice recorder module using MediaRecorder API
// Usage: import { initVoiceRecorder } from '../../shared/js/voice-recorder.js'

export async function fetchAudioAsBlob(url) {
  try {
    const token = localStorage.getItem('teacher_token') || localStorage.getItem('guardian_token') || '';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const resp = await fetch(url, { headers });
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch (_) {
    return url;
  }
}

export function initVoiceRecorder(containerId, { maxSeconds = 60, onRecorded } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let elapsed = 0;
  let audioBlob = null;
  let audioUrl = null;

  container.innerHTML = `
    <div class="voice-recorder">
      <div class="vr-visual" id="${containerId}-visual">
        <div class="vr-pulse-ring"></div>
        <div class="vr-mic-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="vr-timer" id="${containerId}-timer">০:০০</div>
      </div>
      <div class="vr-controls">
        <button class="btn btn-record" id="${containerId}-rec-btn">
          <span class="rec-dot"></span> রেকর্ড শুরু করো
        </button>
        <button class="btn btn-secondary" id="${containerId}-play-btn" style="display:none">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          শোনো
        </button>
        <button class="btn btn-ghost" id="${containerId}-del-btn" style="display:none">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          মুছো
        </button>
      </div>
      <audio id="${containerId}-audio" style="display:none"></audio>
      <div class="vr-wave" id="${containerId}-wave">
        ${Array.from({ length: 20 }, (_, i) => `<span class="vr-bar" style="animation-delay:${i * 0.05}s"></span>`).join('')}
      </div>
    </div>
  `;

  const recBtn = document.getElementById(`${containerId}-rec-btn`);
  const playBtn = document.getElementById(`${containerId}-play-btn`);
  const delBtn = document.getElementById(`${containerId}-del-btn`);
  const timerEl = document.getElementById(`${containerId}-timer`);
  const visual = document.getElementById(`${containerId}-visual`);
  const wave = document.getElementById(`${containerId}-wave`);
  const audioEl = document.getElementById(`${containerId}-audio`);

  let recording = false;

  function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function startTimer() {
    elapsed = 0;
    timerEl.textContent = '০:০০';
    timerInterval = setInterval(() => {
      elapsed++;
      timerEl.textContent = formatTime(elapsed);
      if (elapsed >= maxSeconds) stopRecording();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        audioBlob = new Blob(chunks, { type: 'audio/webm' });
        audioUrl = URL.createObjectURL(audioBlob);
        audioEl.src = audioUrl;
        stream.getTracks().forEach(t => t.stop());
        wave.classList.remove('active');
        visual.classList.remove('recording');
        recBtn.innerHTML = '<span class="rec-dot"></span> আবার রেকর্ড করো';
        recBtn.classList.remove('btn-stop');
        recBtn.classList.add('btn-record');
        playBtn.style.display = '';
        delBtn.style.display = '';
        recording = false;
        timerEl.textContent = formatTime(elapsed);
        if (onRecorded) onRecorded(audioBlob, audioUrl);
      };
      mediaRecorder.start();
      recording = true;
      visual.classList.add('recording');
      wave.classList.add('active');
      recBtn.innerHTML = '<span class="rec-square"></span> থামাও';
      recBtn.classList.remove('btn-record');
      recBtn.classList.add('btn-stop');
      playBtn.style.display = 'none';
      delBtn.style.display = 'none';
      startTimer();
    } catch (err) {
      showToast('মাইক্রোফোন ব্যবহারের অনুমতি দিন', 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      stopTimer();
    }
  }

  recBtn.addEventListener('click', () => {
    if (recording) stopRecording();
    else startRecording();
  });

  function _totalFmt() { return formatTime(isFinite(audioEl.duration) ? audioEl.duration : elapsed); }

  playBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl.play();
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> থামাও`;
    } else {
      audioEl.pause();
      audioEl.currentTime = 0;
      timerEl.textContent = _totalFmt();
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> শোনো`;
    }
  });

  audioEl.addEventListener('timeupdate', () => {
    if (!audioEl.paused) {
      timerEl.textContent = `${formatTime(audioEl.currentTime)} / ${_totalFmt()}`;
    }
  });

  audioEl.addEventListener('ended', () => {
    timerEl.textContent = _totalFmt();
    playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> শোনো`;
  });

  delBtn.addEventListener('click', () => {
    audioBlob = null;
    audioUrl = null;
    audioEl.src = '';
    playBtn.style.display = 'none';
    delBtn.style.display = 'none';
    timerEl.textContent = '০:০০';
    recBtn.innerHTML = '<span class="rec-dot"></span> রেকর্ড শুরু করো';
    if (onRecorded) onRecorded(null, null);
  });

  return {
    getBlob: () => audioBlob,
    getUrl: () => audioUrl,
  };
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}
