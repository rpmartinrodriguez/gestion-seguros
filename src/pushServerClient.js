import { getAuth } from 'firebase/auth';
import { firebaseApp } from './firebaseConfig.js';

const api = '/.netlify/functions/';
const auth = getAuth(firebaseApp);
const queueKey = 'gestion-seguros-push-outbox-v1';
const syncKey = 'gestion-seguros-push-demo-sync-v1';
const allowedKinds = new Set([
  'client_created','policy_created','cash_income','cash_expense',
  'payment_paid','payment_reported','payment_confirmed','payment_remitted','cash_closed'
]);
let queued = [];
let timer = null;
let busy = false;
let backoff = 5000;

try {
  const loaded = JSON.parse(localStorage.getItem(queueKey) || '[]');
  if (Array.isArray(loaded)) queued = loaded.filter(x =>
    allowedKinds.has(x.kind) && /^[A-Za-z0-9_-]{12,100}$/.test(x.eventId || '')).slice(-40);
} catch { /* cola opcional */ }

export function hasOperatorSession() {
  const user = auth.currentUser;
  return Boolean(user && !user.isAnonymous && user.email);
}
async function call(name, input) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Iniciá sesión con el correo y contraseña de la agencia en Configuración.');
  const response = await fetch(api + name, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify(input),
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok || body.ok !== true) {
    const error = new Error(body.error || 'Netlify no respondió correctamente. Revisá Functions y las variables del sitio.');
    error.code = body.code || String(response.status);
    error.status = response.status;
    throw error;
  }
  return body;
}

export function sendRealPushTest(deviceId) {
  return call('push-test', { deviceId });
}

function persistQueue() {
  try { localStorage.setItem(queueKey, JSON.stringify(queued)); } catch {}
}
function scheduleFlush(delay = 1000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flushPushEvents(); }, delay);
}
async function flushPushEvents() {
  if (busy || !queued.length || !hasOperatorSession()) return;
  busy = true;
  try {
    while (queued.length) {
      const item = queued[0];
      try {
        const result = await call('push-event', item);
        if (result.duplicate) console.info('Gestión Seguros: aviso ya emitido.', item.kind);
        queued.shift();
        persistQueue();
        backoff = 5000;
      } catch (err) {
        if (err.status === 400 || err.status === 403 || err.code === 'ALLOWLIST_MISSING') {
          console.warn('Gestión Seguros: evento no autorizado; descartado.', err.message);
          queued.shift();
          persistQueue();
          continue;
        }
        console.warn('Gestión Seguros: aviso en cola.', err.message);
        backoff = Math.min(5 * 60 * 1000, backoff * 2);
        break;
      }
    }
  } finally {
    busy = false;
    if (queued.length && hasOperatorSession()) scheduleFlush(backoff);
  }
}
export function notifyDemoAction(kind, eventId) {
  if (!allowedKinds.has(kind) || typeof eventId !== 'string' ||
      !/^[A-Za-z0-9_-]{12,100}$/.test(eventId) || !hasOperatorSession()) return false;
  if (!queued.some(x => x.eventId === eventId && x.kind === kind)) {
    queued = [...queued, { kind, eventId }].slice(-40);
    persistQueue();
  }
  scheduleFlush(700);
  return true;
}
export function flushNotificationsAfterLogin() {
  if (queued.length && hasOperatorSession()) scheduleFlush(1000);
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (queued.length) scheduleFlush(1000); });
}

export async function syncDemoDueSchedule(data, { force = false } = {}) {
  if (!hasOperatorSession()) return { skipped: true, reason: 'no_login' };
  // Solo se sincronizan fechas y un contador de alertas, NO datos personales.
  const payload = {
    mode: 'demo',
    dueDates: (data.installments || []).filter(i => i.status === 'pending').map(i => i.due).slice(0, 300),
    renewalDates: (data.policies || []).map(p => p.end).filter(Boolean).slice(0, 300),
    reminderDays: Number(data.settings?.reminderDays ?? 3),
  };
  const identity = auth.currentUser.uid;
  const signature = JSON.stringify(payload);
  const key = syncKey + ':' + identity;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } })();
  if (!force && saved?.signature === signature && Date.now() - (saved.at || 0) < 12 * 60 * 60 * 1000)
    return { skipped: true, reason: 'unchanged' };
  const outcome = await call('push-schedule', payload);
  localStorage.setItem(key, JSON.stringify({ signature, at: Date.now() }));
  return outcome;
}
