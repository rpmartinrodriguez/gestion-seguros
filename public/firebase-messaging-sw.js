/* Firebase Cloud Messaging: recepción de notificaciones con la web cerrada.
 * Estos identificadores WEB son públicos. Nunca agregar claves de Firebase Admin.
 * Enviar únicamente texto genérico en las push; los datos de asegurados quedan
 * dentro de la aplicación, protegidos por el futuro sistema de usuarios.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL('/?section=alerts', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(destination);
    } else if (self.clients.openWindow) {
      await self.clients.openWindow(destination);
    }
  })());
});

importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCDUepiYSVm0KRVoVGg4TPZ3kqgwOW5oU4',
  authDomain: 'gestion-seg.firebaseapp.com',
  projectId: 'gestion-seg',
  storageBucket: 'gestion-seg.firebasestorage.app',
  messagingSenderId: '447212017074',
  appId: '1:447212017074:web:9193f6874c5e26a42c00ab',
});
const messaging = firebase.messaging();

// Los payloads FCM con notification son mostrados por el propio SDK.
// Mostrar manualmente solo payloads que tienen únicamente data, evitando duplicados.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  const title = String(data.title || 'Gestión Seguros').slice(0, 80);
  const body = String(data.body || 'Tenés una nueva gestión pendiente. Abrí la aplicación.').slice(0, 180);
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: String(data.tag || 'gestion-seguros-alerta').slice(0, 100),
    data: { url: '/?section=alerts' },
  });
});
