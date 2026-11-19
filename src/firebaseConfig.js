import { getApp, getApps, initializeApp } from 'firebase/app';

// Estos identificadores de configuración WEB son públicos en Firebase.
// Las credenciales privadas de Firebase Admin NUNCA van en el frontend.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCDUepiYSVm0KRVoVGg4TPZ3kqgwOW5oU4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gestion-seg.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gestion-seg',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gestion-seg.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '447212017074',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:447212017074:web:9193f6874c5e26a42c00ab',
};

// La clave Web Push (VAPID) es pública, pero debe generarse en tu propio proyecto
// Firebase console > Configuración del proyecto > Cloud Messaging.
export const firebaseVapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
