import { createHash } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export const result = (code, payload) => new Response(JSON.stringify(payload), {
  status: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
export class PushError extends Error {
  constructor(status, message, code = 'PUSH_ERROR') { super(message); this.status = status; this.code = code; }
}
function allowedEmails() {
  return String(process.env.GESTION_PUSH_ALLOWED_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}
export function service() {
  const value = process.env.GESTION_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!value) throw new PushError(503, 'Falta configurar GESTION_FIREBASE_SERVICE_ACCOUNT_JSON en las variables de entorno de Netlify.', 'ADMIN_MISSING');
  let key;
  try { key = JSON.parse(value); }
  catch { throw new PushError(503, 'La credencial JSON de Firebase Admin está mal formada en Netlify.', 'ADMIN_INVALID'); }
  if (key.project_id !== 'gestion-seg') throw new PushError(503, 'La credencial Admin no corresponde al proyecto gestion-seg.', 'PROJECT_MISMATCH');
  const app = getApps().find(a => a.name === 'gestion-seguros-admin') ||
    initializeApp({ credential: cert(key) }, 'gestion-seguros-admin');
  return { db: getFirestore(app), auth: getAuth(app), messaging: getMessaging(app) };
}

export async function requireOperator(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new PushError(403, 'Origen no autorizado.');
  const idToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!idToken) throw new PushError(401, 'Iniciá sesión como operadora para enviar notificaciones.');
  const emails = allowedEmails();
  if (!emails.length) throw new PushError(503, 'Falta GESTION_PUSH_ALLOWED_EMAILS en Netlify.', 'ALLOWLIST_MISSING');
  const admin = service();
  let user;
  try { user = await admin.auth.verifyIdToken(idToken, true); }
  catch { throw new PushError(401, 'La sesión de Firebase venció. Volvé a ingresar.'); }
  if (user.firebase?.sign_in_provider !== 'password' || !emails.includes(String(user.email || '').toLowerCase())) {
    throw new PushError(403, 'Esta cuenta no está autorizada para enviar push. Revisá GESTION_PUSH_ALLOWED_EMAILS en Netlify.');
  }
  return { ...admin, uid: user.uid, email: String(user.email).toLowerCase() };
}
export async function getInput(request, maximum = 4096) {
  if (request.method !== 'POST') throw new PushError(405, 'Método no permitido.');
  if (Number(request.headers.get('content-length') || 0) > maximum) throw new PushError(413, 'Solicitud demasiado grande.');
  let raw = '';
  try { raw = await request.text(); }
  catch { throw new PushError(400, 'No se recibió la solicitud.'); }
  if (raw.length > maximum) throw new PushError(413, 'Solicitud demasiado grande.');
  try { return JSON.parse(raw); }
  catch { throw new PushError(400, 'Datos JSON inválidos.'); }
}
export async function run(request, fn) {
  try { return result(200, { ok: true, ...(await fn()) }); }
  catch (error) {
    console.error('Gestión Seguros Push:', error?.code || '', error?.message || error);
    const quota = Number(error?.code) === 8 || /resource.exhausted|quota exceeded/i.test(String(error?.message));
    return result(quota ? 429 : error?.status || 500, {
      ok: false, code: quota ? 'FIRESTORE_QUOTA' : error?.code || 'PUSH_SERVER',
      error: error?.status ? error.message : quota ? 'Límite temporal de Firebase alcanzado. Revisá el uso del proyecto.' :
        'No se pudo enviar la notificación. Revisá Netlify → Functions → Logs.',
    });
  }
}
export async function activeDevices(db, uid) {
  const snap = await db.collection('pushDevices').doc(uid).collection('devices').where('enabled', '==', true).limit(30).get();
  return snap.docs.filter(d => typeof d.data().token === 'string' && d.data().token.length >= 30)
    .map(d => ({ id: d.id, token: d.data().token, ref: d.ref }));
}
export async function sendPush(admin, uid, event, targetId = null) {
  let devices = await activeDevices(admin.db, uid);
  if (targetId) devices = devices.filter(x => x.id === targetId);
  if (!devices.length) throw new PushError(409, 'No hay dispositivos registrados para esta cuenta. Ingresá con la misma cuenta en cada equipo y activá las push.', 'NO_DEVICES');
  const tokens = [...new Set(devices.map(x => x.token))];
  const msg = {
    tokens,
    data: {
      title: String(event.title || 'Gestión Seguros').slice(0, 80),
      body: String(event.body || 'Tenés una nueva gestión pendiente.').slice(0, 170),
      category: String(event.category || 'general').slice(0, 60),
      eventId: hash(String(event.id || Date.now())).slice(0, 20),
      url: '/?section=alerts',
    },
    webpush: { headers: { Urgency: 'high' } },
  };
  const sent = await admin.messaging.sendEachForMulticast(msg);
  for (let i = 0; i < sent.responses.length; i++) {
    const code = sent.responses[i].error?.code;
    if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
      await Promise.all(devices.filter(d => d.token === tokens[i]).map(d => d.ref.update({ enabled: false }).catch(() => {})));
    }
  }
  if (!sent.successCount) {
    const codes = sent.responses.map(r => r.error?.code).filter(Boolean).slice(0, 3).join(', ');
    throw new PushError(502, 'FCM rechazó los tokens de destino: ' + (codes || 'sin detalle'), 'FCM_DELIVERY');
  }
  return { sent: sent.successCount, failed: sent.failureCount, devices: tokens.length };
}
export async function cooldown(db, name, waitMs) {
  const ref = db.doc('gestion_push_throttles/' + hash(name));
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const last = snap.data()?.at?.toMillis?.() || 0;
    if (Date.now() - last < waitMs) throw new PushError(429, 'Esperá unos segundos antes de repetir la prueba.', 'COOLDOWN');
    transaction.set(ref, { at: Timestamp.now() });
  });
}
export async function dedupedSend(admin, uid, event) {
  const ref = admin.db.doc('gestion_push_deliveries/' + hash(uid + ':' + event.id));
  try { await ref.create({ uid, category: event.category, status: 'sending', createdAt: FieldValue.serverTimestamp() }); }
  catch (err) {
    if (Number(err?.code) === 6 || err?.code === 'already-exists') return { sent: 0, duplicate: true };
    throw err;
  }
  try {
    const delivery = await sendPush(admin, uid, event);
    await ref.update({ status: 'sent', ...delivery, completedAt: FieldValue.serverTimestamp() });
    return { ...delivery, duplicate: false };
  } catch (err) {
    await ref.update({ status: 'failed', error: String(err?.code || err?.message || err).slice(0, 180) }).catch(() => {});
    throw err;
  }
}
export function todayArgentina(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(v => [v.type, v.value]));
  return p.year + '-' + p.month + '-' + p.day;
}
export function addDays(date, count) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
}
