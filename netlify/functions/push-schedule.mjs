import { requireOperator, getInput, run, PushError } from '../lib/gestion-push.mjs';
import { FieldValue } from 'firebase-admin/firestore';

function dates(input) {
  if (!Array.isArray(input) || input.length > 300) throw new PushError(400, 'Demasiadas fechas de demostración.');
  if (input.some(d => typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d + 'T12:00:00Z'))))
    throw new PushError(400, 'Hay fechas de demostración inválidas.');
  return [...new Set(input)].sort().slice(0, 300);
}
export default async function handler(request) {
  return run(request, async () => {
    const admin = await requireOperator(request);
    const input = await getInput(request, 15000);
    if (input?.mode !== 'demo') throw new PushError(400, 'Solo se admiten fechas ficticias de demostración.');
    const dueDates = dates(input?.dueDates);
    const renewalDates = dates(input?.renewalDates);
    const reminderDays = Math.max(0, Math.min(30, Number(input?.reminderDays ?? 3) || 0));
    await admin.db.doc('gestion_push_schedules/' + admin.uid).set({
      uid: admin.uid, email: admin.email, enabled: true, demoOnly: true,
      dueDates, renewalDates, reminderDays, updatedAt: FieldValue.serverTimestamp(),
    });
    return { saved: true, dues: dueDates.length, renewals: renewalDates.length };
  });
}
