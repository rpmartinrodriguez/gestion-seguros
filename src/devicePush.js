import { firebaseApp, firebaseVapidKey } from './firebaseConfig.js';

const STORE = 'gestion-seguros-push-device-v1';
const REFRESH_MS = 48 * 60 * 60 * 1000;

export function getPushCapabilities() {
  if (typeof window === 'undefined') return { secure: false, supported: false, ios: false, standalone: false, permission: 'default' };
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = !!(window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)')?.matches);
  return {
    secure: !!window.isSecureContext,
    supported: 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window,
    ios, standalone,
    permission: 'Notification' in window ? Notification.permission : 'unavailable',
    vapidConfigured: Boolean(firebaseVapidKey),
  };
}

export function getSavedPushDevice() {
  try {
    const raw = window.localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDevice(device) {
  window.localStorage.setItem(STORE, JSON.stringify(device));
  return device;
}

function getDeviceId() {
  const previous = getSavedPushDevice();
  return previous?.deviceId || window.crypto.randomUUID();
}

function deviceLabel() {
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Computadora Windows';
  if (/Macintosh/i.test(ua)) return 'Computadora Mac';
  return 'Navegador web';
}

export function pushErrorMessage(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  if (code === 'auth/operation-not-allowed') return 'Habilitá el método de acceso Anónimo en Firebase Authentication para registrar los dispositivos de prueba.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'Firestore rechazó el registro. Publicá las reglas firestore.rules del repositorio desde la consola Firebase.';
  if (/messaging\/token-subscribe-failed|messaging\/permission-blocked/.test(code)) return 'No se pudo obtener el token de Firebase. Revisá la clave VAPID, el dominio autorizado y los permisos del navegador.';
  if (code === 'auth/network-request-failed') return 'No se pudo conectar con Firebase. Revisá la conexión a Internet.';
  return msg || 'No se pudo completar la configuración de notificaciones.';
}

// Solicitar permisos SOLAMENTE en respuesta a un clic. En Safari de iOS
// requestPermission debe ejecutarse dentro del gesto directo del usuario.
export async function activatePushDevice({ requestPermission = true } = {}) {
  const c = getPushCapabilities();
  if (!c.secure) throw new Error('Necesitás abrir la app mediante HTTPS (Netlify).');
  if (!c.supported) throw new Error('Este navegador no admite notificaciones web.');
  if (c.ios && !c.standalone) throw new Error('En iPhone/iPad, agregá la web a Inicio y abrila desde su icono para activar las push.');
  if (!firebaseVapidKey) throw new Error('Falta VITE_FIREBASE_VAPID_KEY. Generá la clave pública en Firebase > Configuración del proyecto > Cloud Messaging.');
  if (c.permission === 'denied') throw new Error('El navegador bloqueó las notificaciones. Cambiá el permiso desde la configuración del sitio.');

  if (requestPermission && c.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('No se concedió el permiso de notificaciones.');
  } else if (Notification.permission !== 'granted') {
    throw new Error('Este dispositivo todavía no tiene permisos para recibir notificaciones.');
  }

  const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('Firebase Cloud Messaging no es compatible con este navegador.');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase no devolvió un token para este dispositivo.');

  const [{ getAuth, signInAnonymously }, { getFirestore, doc, setDoc, serverTimestamp }] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const auth = getAuth(firebaseApp);
  await auth.authStateReady();
  const user = auth.currentUser || (await signInAnonymously(auth)).user;

  const deviceId = getDeviceId();
  await setDoc(doc(getFirestore(firebaseApp), 'pushDevices', user.uid, 'devices', deviceId), {
    token,
    enabled: true,
    label: deviceLabel(),
    platform: c.ios ? 'ios-pwa' : 'web',
    origin: window.location.origin,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return {
    token,
    device: saveDevice({
      deviceId,
      uid: user.uid,
      active: true,
      registered: true,
      label: deviceLabel(),
      lastSync: Date.now(),
    }),
  };
}

export async function restorePushDevice() {
  const saved = getSavedPushDevice();
  if (!saved?.active || typeof Notification === 'undefined' || Notification.permission !== 'granted') return saved;
  if (Date.now() - (saved.lastSync || 0) < REFRESH_MS) return saved;
  return (await activatePushDevice({ requestPermission: false })).device;
}

export async function deactivatePushDevice() {
  const saved = getSavedPushDevice();
  const errors = [];
  try {
    const [{ getAuth }, { getFirestore, doc, deleteDoc }] = await Promise.all([
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const auth = getAuth(firebaseApp);
    await auth.authStateReady();
    if (saved?.uid && auth.currentUser?.uid === saved.uid && saved.deviceId) {
      await deleteDoc(doc(getFirestore(firebaseApp), 'pushDevices', saved.uid, 'devices', saved.deviceId));
    }
  } catch (err) {
    errors.push('No se pudo eliminar el registro remoto: ' + pushErrorMessage(err));
  }
  try {
    const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging');
    if (await isSupported()) await deleteToken(getMessaging(firebaseApp));
  } catch (err) {
    errors.push('No se pudo revocar el token del navegador: ' + pushErrorMessage(err));
  }
  saveDevice({
    ...(saved || {}),
    active: false,
    registered: false,
    lastSync: 0,
  });
  return errors;
}

export async function showLocalNotificationTest() {
  const c = getPushCapabilities();
  if (c.permission !== 'granted') throw new Error('Primero tenés que permitir las notificaciones.');
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Gestión Seguros · Prueba local', {
    body: 'Este equipo puede mostrar avisos. Esta prueba no fue enviada por Firebase.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'gestion-seguros-local-test',
    data: { url: '/?section=alerts' },
  });
}

export async function getPushTestToken() {
  const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('Este dispositivo no admite FCM.');
  if (!firebaseVapidKey) throw new Error('Falta la clave VAPID.');
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) throw new Error('Activá primero las notificaciones de este dispositivo.');
  return getToken(getMessaging(firebaseApp), { vapidKey: firebaseVapidKey, serviceWorkerRegistration: registration });
}

export async function listenForegroundPush(onPayload) {
  const { isSupported, getMessaging, onMessage } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  return onMessage(getMessaging(firebaseApp), onPayload);
}
