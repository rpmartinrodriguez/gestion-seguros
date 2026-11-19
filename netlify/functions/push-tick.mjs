import { service, todayArgentina, addDays, dedupedSend } from '../lib/gestion-push.mjs';

// Se ejecuta en Netlify a las 09:00 de Argentina (12:00 UTC).
// Solo evalúa FECHAS FICTICIAS sincronizadas: no hay datos reales de asegurados.
export default async function handler() {
  const admin = service();
  const date = todayArgentina();
  const allowed = String(process.env.GESTION_PUSH_ALLOWED_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) throw Error('Falta GESTION_PUSH_ALLOWED_EMAILS en Netlify');
  const snapshot = await admin.db.collection('gestion_push_schedules').where('enabled', '==', true).limit(100).get();
  let notified = 0;
  for (const doc of snapshot.docs) {
    const item = doc.data();
    if (!item.demoOnly || !allowed.includes(String(item.email||'').toLowerCase()) || item.uid !== doc.id) continue;
    const user = await admin.auth.getUser(item.uid).catch(()=>null);
    if (!user || user.disabled || user.email?.toLowerCase() !== item.email) continue;
    const due = Array.isArray(item.dueDates) ? item.dueDates : [];
    const renew = Array.isArray(item.renewalDates) ? item.renewalDates : [];
    const days = Math.max(0, Math.min(30, Number(item.reminderDays ?? 3)));
    const dueCount = due.filter(d=>[addDays(date,days), addDays(date,1),date,addDays(date,-1)].includes(d)).length;
    const renewalCount = renew.filter(d=>[addDays(date,30),addDays(date,15),addDays(date,7)].includes(d)).length;
    if (!dueCount && !renewalCount) continue;
    try {
      const report = await dedupedSend(admin, item.uid, {
        id:'daily-demo:' + date,
        category:'daily_summary',
        title:'Gestión Seguros · Agenda del día',
        body: [dueCount ? dueCount + ' cuota(s) para revisar' : '', renewalCount ? renewalCount + ' renovación(es) próxima(s)' : ''].filter(Boolean).join(' · ') + '. Abrí la app.',
      });
      notified += report.sent || 0;
    } catch(err) { console.error('Agenda push', item.uid, err?.code||'', err?.message||err); }
  }
  console.log('Gestion Seguros agenda', { date, accounts:snapshot.size, sent:notified });
}
export const config = { schedule: '0 12 * * *' };
