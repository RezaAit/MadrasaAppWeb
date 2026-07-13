// FCM push notification registration
// Call initFcm(token, userType) after login

const _FCM_VAPID = 'BD992hTmNR4ORs4qrE6Cz-Vl97U647B_mOx0lJh6RiyO632gssKvGFneG6cnvQ1CBgBgGx6swI0qc53XrHU77qI';

const _FCM_CONFIG = {
  apiKey: "AIzaSyAfYTPaEN8rT9juS_z_fpoxrNYQFicp5JY",
  authDomain: "madrasaapp-ait.firebaseapp.com",
  projectId: "madrasaapp-ait",
  storageBucket: "madrasaapp-ait.firebasestorage.app",
  messagingSenderId: "139052575052",
  appId: "1:139052575052:web:a9c980d102d53cf2fb87e9"
};

let _fcmApp = null;

async function _loadFirebase() {
  if (_fcmApp) return _fcmApp;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js');
  const apps = getApps();
  _fcmApp = apps.length ? apps[0] : initializeApp(_FCM_CONFIG);
  return _fcmApp;
}

export async function initFcm(authToken, userType) {
  try {
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const app = await _loadFirebase();
    const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging.js');

    const swReg = await navigator.serviceWorker.getRegistration('/')
      ?? await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      vapidKey: _FCM_VAPID,
      serviceWorkerRegistration: swReg
    });

    if (!fcmToken) return;

    // Save token to backend
    const { API_BASE } = await import('/shared/js/api-config.js');
    await fetch(`${API_BASE}/api/Notification/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ deviceToken: fcmToken, platform: 'web' })
    });
  } catch (err) {
    console.warn('[FCM] init failed:', err);
  }
}
