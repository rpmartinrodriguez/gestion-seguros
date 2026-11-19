import React, { useState } from 'react';
import { BellRing, CalendarClock, Check, MessageCircle, ShieldCheck, Wallet, AlertTriangle } from 'lucide-react';
import { notificationKinds, defaultNotificationPrefs } from './notificationRules.js';

const categoryLabels = Object.fromEntries(notificationKinds.map(item => [item.id, item.label]));

export function NotificationCenter({ alerts, seen = [], onSeen, onMarkAll, onNavigate, onContact, onSettings }) {
  const [filter, setFilter] = useState('pending');
  const viewed = new Set(seen);
  const pending = alerts.filter(alert => !viewed.has(alert.id));
  const items = alerts.filter(alert => filter === 'all' || (filter === 'pending' && !viewed.has(alert.id)) || alert.kind === filter);
  return <>
    <div className="sectionbar">
      <div><h2>Centro de notificaciones</h2><p>Alertas sobre cuotas, pagos, renovaciones y caja.</p></div>
      <button type="button" className="btn btn-outline" onClick={onSettings}>Preferencias</button>
    </div>
    <div className="notebox"><BellRing size={20}/><span><b>Alertas internas de demostración.</b> Se calculan al abrir la app. Las alertas de ejemplo permanecen en este navegador. Desde Configuración podés activar push reales por dispositivo, probar un envío desde Netlify y sincronizar fechas ficticias para recordatorios programados.</span></div>
    <div className="stats three">
      <div className="numbercard"><div className="numbertop"><span>Por atender</span><BellRing size={19}/></div><strong>{pending.length}</strong><small>Alertas no marcadas como vistas</small></div>
      <div className="numbercard"><div className="numbertop"><span>Cuotas</span><CalendarClock size={19}/></div><strong>{pending.filter(x => x.kind === 'due' || x.kind === 'overdue').length}</strong><small>Próximas o vencidas</small></div>
      <div className="numbercard"><div className="numbertop"><span>Gestiones</span><ShieldCheck size={19}/></div><strong>{pending.filter(x => x.kind !== 'due' && x.kind !== 'overdue').length}</strong><small>Pagos, renovaciones y caja</small></div>
    </div>
    <article className="panel">
      <div className="alert-toolbar">
        <label>Ver alertas
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="pending">Pendientes</option>
            <option value="all">Todas</option>
            {notificationKinds.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-outline" disabled={!pending.length} onClick={onMarkAll}><Check size={16}/> Marcar todas vistas</button>
      </div>
      <div className="alertlist">
        {items.map(alert => {
          const wasSeen = viewed.has(alert.id);
          const canContact = (alert.kind === 'due' || alert.kind === 'overdue') && alert.installmentId;
          return <div key={alert.id} className={'alertrow' + (wasSeen ? ' seen' : '')}>
            <div className={'alertbadge ' + (alert.priority === 0 ? 'danger' : alert.priority === 1 ? 'warning' : '')}>
              {alert.kind === 'closing' || alert.kind === 'transfers' || alert.kind === 'remittances' ? <Wallet size={19}/> : alert.kind === 'renewal' ? <ShieldCheck size={19}/> : <AlertTriangle size={19}/>}
            </div>
            <div className="alertbody">
              <b>{alert.title}</b>
              <small>{categoryLabels[alert.kind]}</small>
              <p>{alert.detail}</p>
              <div className="alert-actions">
                <button type="button" className="btn" onClick={() => onNavigate(alert)}>Ver detalle</button>
                {canContact && <button type="button" className="btn btn-outline" onClick={() => onContact(alert.installmentId)}><MessageCircle size={16}/> Preparar WhatsApp</button>}
                {!wasSeen && <button type="button" className="textbutton" onClick={() => onSeen(alert.id)}>Marcar vista</button>}
              </div>
            </div>
          </div>;
        })}
        {items.length === 0 && <div className="alertempty"><Check size={28}/><p>No hay alertas con este filtro.</p></div>}
      </div>
    </article>
  </>;
}

export function NotificationPreferences({ values = {}, onToggle }) {
  const preferences = { ...defaultNotificationPrefs, ...values };
  return <article className="panel settingspanel">
    <h3>Preferencias de notificaciones</h3>
    <p className="muted">Elegí qué eventos querés ver en el centro de alertas. Estos ajustes se guardan únicamente en esta demo, hasta conectar cuentas y dispositivos con Firebase.</p>
    <div className="notification-pref-list">
      {notificationKinds.map(kind => <label className="notification-pref" key={kind.id}>
        <input type="checkbox" checked={preferences[kind.id]} onChange={e => onToggle(kind.id, e.target.checked)}/>
        <span><b>{kind.label}</b><small>{kind.description}</small></span>
      </label>)}
    </div>
  </article>;
}
