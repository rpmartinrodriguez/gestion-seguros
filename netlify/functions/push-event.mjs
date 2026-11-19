import { requireOperator, getInput, run, PushError, dedupedSend } from '../lib/gestion-push.mjs';

// Únicamente eventos de la DEMO; no se aceptan datos personales ni textos del navegador.
// Al migrar la cartera, validar el registro persistido antes de emitir cada evento.
const EVENTS = {
  client_created: ['Nuevo cliente registrado', 'Se agregó un cliente a la cartera de demostración.'],
  policy_created: ['Nueva póliza registrada', 'Se creó una póliza y su plan de cuotas.'],
  cash_income: ['Ingreso en caja', 'Se registró un nuevo ingreso en caja.'],
  cash_expense: ['Egreso de caja', 'Se registró un nuevo egreso de caja.'],
  payment_paid: ['Cuota pagada', 'Se registró el pago de una cuota.'],
  payment_reported: ['Pago directo informado', 'Hay un pago directo pendiente de confirmar.'],
  payment_confirmed: ['Pago confirmado', 'Se confirmó un pago de la aseguradora.'],
  payment_remitted: ['Rendición realizada', 'Se registró una rendición a la aseguradora.'],
  cash_closed: ['Cierre de caja realizado', 'Se cerró la caja diaria.'],
};
export default async function handler(request) {
  return run(request, async () => {
    const admin = await requireOperator(request);
    const input = await getInput(request);
    const kind = String(input?.kind || '');
    const eventId = String(input?.eventId || '');
    if (!Object.hasOwn(EVENTS, kind) || !/^[A-Za-z0-9_-]{12,100}$/.test(eventId))
      throw new PushError(400, 'Evento de demostración inválido.');
    const [title, body] = EVENTS[kind];
    return dedupedSend(admin, admin.uid, {
      id: 'demo:' + kind + ':' + eventId,
      category: kind, title, body,
    });
  });
}
