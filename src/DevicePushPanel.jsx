import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, CircleAlert, Copy, Smartphone, Monitor, Send, BellOff, RefreshCw } from 'lucide-react';
import { firebaseConfig } from './firebaseConfig.js';
import {
  getPushCapabilities,
  getSavedPushDevice,
  activatePushDevice,
  restorePushDevice,
  deactivatePushDevice,
  showLocalNotificationTest,
  getPushTestToken,
  listenForegroundPush,
  pushErrorMessage,
} from './devicePush.js';

export default function DevicePushPanel() {
  const [device, setDevice] = useState(() => getSavedPushDevice());
  const [capabilities, setCapabilities] = useState(() => getPushCapabilities());
  const [working, setWorking] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [foreground, setForeground] = useState(null);
  const enabled = !!device?.active && !!device?.registered && capabilities.permission === 'granted';

  useEffect(() => {
    let alive = true;
    setCapabilities(getPushCapabilities());
    if (device?.active) {
      restorePushDevice().then(result => {
        if (alive) { setDevice(result || null); setCapabilities(getPushCapabilities()); }
      }).catch(err => { if (alive) setError('No se pudo renovar el registro: ' + pushErrorMessage(err)); });
    }
    return () => { alive = false; };
    // Una sola comprobación en el montaje. No se solicitan permisos automáticamente.
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let stop = () => {};
    let cancelled = false;
    listenForegroundPush(payload => {
      setForeground({
        title: payload.notification?.title || payload.data?.title || 'Nuevo aviso de Gestión Seguros',
        body: payload.notification?.body || payload.data?.body || 'Abrí el centro de notificaciones para consultar el detalle.',
      });
    }).then(unsubscribe => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    }).catch(() => {});
    return () => { cancelled = true; stop(); };
  }, [enabled]);

  function clearFeedback() { setInfo(''); setError(''); }

  async function activate() {
    clearFeedback(); setWorking('activate');
    try {
      const result = await activatePushDevice({ requestPermission: true });
      setDevice(result.device);
      setCapabilities(getPushCapabilities());
      setInfo('Este dispositivo quedó registrado en Firebase para recibir notificaciones FCM. El envío automático por vencimientos se habilitará cuando la cartera esté sincronizada.');
    } catch (err) {
      setCapabilities(getPushCapabilities());
      setError(pushErrorMessage(err));
    } finally { setWorking(''); }
  }

  async function deactivate() {
    clearFeedback(); setWorking('deactivate');
    try {
      const warnings = await deactivatePushDevice();
      setDevice(getSavedPushDevice());
      setInfo(warnings.length ? 'Se desactivó el dispositivo localmente, pero requiere revisar su registro en Firebase.' : 'Notificaciones desactivadas para este dispositivo.');
      if (warnings.length) setError(warnings.join(' '));
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); setCapabilities(getPushCapabilities()); }
  }

  async function testLocal() {
    clearFeedback(); setWorking('test');
    try {
      await showLocalNotificationTest();
      setInfo('Se mostró una notificación local de prueba. No se envió ninguna push desde Firebase.');
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); }
  }

  async function copyToken() {
    clearFeedback(); setWorking('token');
    try {
      const token = await getPushTestToken();
      if (!token) throw new Error('No hay token registrado.');
      await navigator.clipboard.writeText(token);
      setInfo('Token FCM copiado. Podés utilizarlo únicamente para una prueba dirigida desde Firebase Cloud Messaging.');
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); }
  }

  async function refresh() {
    clearFeedback(); setWorking('refresh');
    try {
      const result = await activatePushDevice({ requestPermission: false });
      setDevice(result.device);
      setInfo('Registro del dispositivo actualizado en Firebase.');
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); setCapabilities(getPushCapabilities()); }
  }

  const blocked = !capabilities.secure || !capabilities.supported || (capabilities.ios && !capabilities.standalone) || !capabilities.vapidConfigured || capabilities.permission === 'denied';
  const reason = !capabilities.secure ? 'Abrí la aplicación desde la dirección HTTPS de Netlify.'
    : !capabilities.supported ? 'Este navegador no admite Web Push.'
    : capabilities.ios && !capabilities.standalone ? 'En iPhone o iPad usá Compartir → Agregar a pantalla de inicio y abrí la aplicación desde ese icono.'
    : !capabilities.vapidConfigured ? 'Falta la clave pública VAPID de Firebase en la variable VITE_FIREBASE_VAPID_KEY de Netlify.'
    : capabilities.permission === 'denied' ? 'El permiso está bloqueado. Tenés que habilitarlo desde los ajustes del navegador.'
    : '';

  return <article className="panel settingspanel push-settings">
    <div className="push-heading">
      <div className="push-symbol"><BellRing size={22}/></div>
      <div><h3>Notificaciones push por dispositivo</h3><p>Activación independiente en cada computadora o celular.</p></div>
    </div>
    <div className="push-state">
      <span>{capabilities.ios ? <Smartphone size={20}/> : <Monitor size={20}/>} <b>{device?.label || (capabilities.ios ? 'iPhone / iPad' : 'Este navegador')}</b></span>
      <span className={'tag ' + (enabled ? 'success' : blocked ? 'warning' : 'neutral')}>
        {enabled ? 'Registrado en Firebase' : blocked ? 'Configuración pendiente' : 'No activado'}
      </span>
    </div>
    <div className="push-detail-grid">
      <div><small>Permiso del navegador</small><b>{capabilities.permission === 'granted' ? 'Concedido' : capabilities.permission === 'denied' ? 'Bloqueado' : capabilities.permission === 'default' ? 'Sin solicitar' : 'No disponible'}</b></div>
      <div><small>Servicio</small><b>Firebase · {firebaseConfig.projectId}</b></div>
      <div><small>Clave Web Push</small><b>{capabilities.vapidConfigured ? 'Configurada' : 'Pendiente'}</b></div>
      <div><small>Registro remoto</small><b>{enabled ? 'Activo' : 'Sin confirmar'}</b></div>
    </div>
    {reason && <div className="push-feedback warn"><CircleAlert size={17}/><span>{reason}</span></div>}
    {!!error && <div className="push-feedback error" role="alert"><CircleAlert size={17}/><span>{error}</span></div>}
    {!!info && <div className="push-feedback good" role="status"><CheckCircle2 size={17}/><span>{info}</span></div>}
    <div className="push-actions">
      {!enabled
        ? <button className="btn" type="button" disabled={!!working || blocked} onClick={activate}><BellRing size={16}/> {working === 'activate' ? 'Activando…' : 'Activar en este dispositivo'}</button>
        : <button className="btn btn-outline" type="button" disabled={!!working} onClick={deactivate}><BellOff size={16}/> {working === 'deactivate' ? 'Desactivando…' : 'Desactivar dispositivo'}</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={refresh}><RefreshCw size={16}/> Sincronizar</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={testLocal}><Send size={16}/> Probar aviso local</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={copyToken}><Copy size={16}/> Copiar token de prueba</button>}
    </div>
    {foreground && <div className="push-feedback good"><BellRing size={17}/><span><b>{foreground.title}</b> — {foreground.body}</span></div>}
    <p className="push-disclaimer">El permiso se solicita únicamente al pulsar Activar. Cada dispositivo tiene su propio registro. Esta etapa sigue usando clientes ficticios guardados en el navegador. Las push pueden probarse desde Firebase Console con el token; los avisos automáticos de cuotas requieren migrar los datos a Firestore y configurar un emisor seguro del lado servidor.</p>
  </article>;
}
