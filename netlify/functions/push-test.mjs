import { requireOperator, getInput, run, PushError, sendPush, cooldown } from '../lib/gestion-push.mjs';

// Una prueba desde la app: la API de Netlify entrega un FCM REAL
// solo al dispositivo registrado de la persona que inició sesión.
export default async function handler(request) {
  return run(request, async () => {
    const admin = await requireOperator(request);
    const input = await getInput(request);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input?.deviceId || '')) throw new PushError(400, 'ID de dispositivo inválido.');
    await cooldown(admin.db, admin.uid + ':test', 20000);
    return sendPush(admin, admin.uid, {
      id: 'test:' + admin.uid + ':' + Date.now(),
      category: 'test', title: 'Gestión Seguros · Push real',
      body: 'Esta notificación llegó desde la app mediante Netlify y Firebase.',
    }, input.deviceId);
  });
}
