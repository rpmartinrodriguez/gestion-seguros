// Alertas internas calculadas con datos de la demo.
// No envían notificaciones push: el envío remoto requiere Auth, Firestore y FCM.
export const notificationKinds = [
  { id: 'due', label: 'Cuotas próximas a vencer', description: 'Avisar con anticipación y abrir WhatsApp.' },
  { id: 'overdue', label: 'Cuotas vencidas', description: 'Cuotas que siguen pendientes después de su fecha.' },
  { id: 'renewal', label: 'Renovaciones de pólizas', description: '30, 15 y 7 días antes de finalizar la cobertura.' },
  { id: 'payments', label: 'Pagos directos sin confirmar', description: 'Cuando se informa un pago a la aseguradora.' },
  { id: 'transfers', label: 'Transferencias pendientes', description: 'Ingresos o egresos bancarios sin conciliar.' },
  { id: 'remittances', label: 'Cobranzas pendientes de rendir', description: 'Después de 48 horas sin registrar la rendición.' },
  { id: 'closing', label: 'Cierre diario de caja', description: 'Al terminar la jornada si hubo movimientos.' },
];
export const defaultNotificationPrefs = Object.fromEntries(notificationKinds.map(({ id }) => [id, true]));

export const localDay = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

function dayDelta(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const a = new Date(date + 'T12:00:00');
  const b = new Date(today + 'T12:00:00');
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function makeAlerts(data, instant = new Date()) {
  if (!data || !Array.isArray(data.installments)) return [];
  const today = localDay(instant);
  const prefs = { ...defaultNotificationPrefs, ...(data.settings?.notifications || {}) };
  const reminderDays = Math.max(0, Math.min(30, Number(data.settings?.reminderDays ?? 3) || 0));
  const policies = new Map((data.policies || []).map(p => [p.id, p]));
  const clients = new Map((data.clients || []).map(c => [c.id, c]));
  const alerts = [];
  const add = (kind, item) => { if (prefs[kind]) alerts.push({ kind, ...item }); };
  for (const i of data.installments) {
    const policy = policies.get(i.policyId);
    if (!policy) continue;
    const client = clients.get(policy.clientId);
    const person = client?.name || 'Cliente sin identificar';
    const delta = dayDelta(i.due, today);
    const label = 'Cuota ' + i.number + ' · ' + person;
    if (i.status === 'pending' && delta !== null) {
      if (delta >= 0 && delta <= reminderDays) {
        add('due', { id: 'due:' + i.id, priority: delta === 0 ? 1 : 2,
          title: delta === 0 ? 'Cuota vence hoy' : 'Cuota próxima a vencer',
          detail: label + ' · ' + policy.company + ' · ' + i.due,
          action: 'due', policyId: policy.id, clientId: client?.id, installmentId: i.id });
      } else if (delta < 0) {
        add('overdue', { id: 'overdue:' + i.id, priority: 0, title: 'Cuota vencida',
          detail: label + ' · venció el ' + i.due,
          action: 'due', policyId: policy.id, clientId: client?.id, installmentId: i.id });
      }
    }
    if (i.status === 'reported' && policy.mode === 'direct') {
      add('payments', { id: 'payment:' + i.id, priority: 1, title: 'Pago directo por confirmar',
        detail: label + ' · ' + policy.company,
        action: 'policies', policyId: policy.id });
    }
    if (i.status === 'paid' && policy.mode === 'office' && !i.remittedAt) {
      const elapsed = dayDelta(i.paidAt, today);
      if (elapsed !== null && elapsed <= -2) {
        add('remittances', { id: 'remittance:' + i.id, priority: 2, title: 'Cobranza pendiente de rendir',
          detail: label + ' · ' + policy.company,
          action: 'policies', policyId: policy.id });
      }
    }
  }
  for (const p of (data.policies || [])) {
    const delta = dayDelta(p.end, today);
    if (delta !== null && [30, 15, 7, 3, 1, 0].includes(delta)) {
      add('renewal', { id: 'renewal:' + p.id + ':' + delta, priority: delta <= 7 ? 1 : 2,
        title: 'Renovación de póliza', detail: (clients.get(p.clientId)?.name || 'Cliente') + ' · ' + p.company + ' · vence el ' + p.end,
        action: 'policies', policyId: p.id });
    }
  }
  for (const m of (data.movements || [])) {
    if (m.method === 'transfer' && m.status === 'informado') {
      add('transfers', { id: 'transfer:' + m.id, priority: 2, title: 'Transferencia por verificar',
        detail: m.category + (m.reference ? ' · ref. ' + m.reference : '') + ' · ' + m.date,
        action: 'cash', movementId: m.id });
    }
  }
  if (instant.getHours() >= 18 && (data.movements || []).some(m => m.date === today) &&
      !(data.closings || []).some(c => c.date === today)) {
    add('closing', { id: 'closing:' + today, priority: 2,
      title: 'Caja pendiente de cierre', detail: 'Hay movimientos del día sin cierre de caja.',
      action: 'cash' });
  }
  return alerts.sort((a, b) => a.priority - b.priority || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
