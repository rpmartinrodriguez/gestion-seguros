import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, CircleAlert, Copy, Smartphone, Monitor, Send, BellOff, RefreshCw } from 'lucide-react';
import { firebaseApp, firebaseConfig } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { sendRealPushTest, syncDemoDueSchedule } from './pushServerClient.js';
import {
  getPushCapabilities,
  getSavedPushDevice,
  activatePushDevice,
  restorePushDevice,
  deactivatePushDevice,
  showLocalNotificationTest,
  getLocalNotificationDiagnostics,
  getPushTestToken,
  pushErrorMessage,
} from './devicePush.js';

export default function DevicePushPanel({ demoData }) {
  const [device, setDevice] = useState(() => getSavedPushDevice());
  const [capabilities, setCapabilities] = useState(() => getPushCapabilities());
  const [working, setWorking] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [account, setAccount] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => onAuthStateChanged(getAuth(firebaseApp), user => {
    setAccount(user);
    setSessionReady(true);
    setDevice(getSavedPushDevice());
  }), []);
  const enabled = !!device?.active && !!device?.registered && capabilities.permission === 'granted' &&
    (!sessionReady || device?.uid === account?.uid);
  const canSend = enabled && Boolean(account?.email && !account?.isAnonymous);

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
      const result = await showLocalNotificationTest();
      setDiagnostics(await getLocalNotificationDiagnostics());
      if (result.queued === true) {
        setInfo('El navegador creó el aviso de prueba y lo tiene registrado. Si no aparece una ventana emergente, revisá Windows > Sistema > Notificaciones (Chrome/Edge y No molestar), y el centro de notificaciones con Win + N. Esto no es todavía un envío desde Firebase.');
      } else if (result.queued === false) {
        setError('El navegador aceptó la solicitud, pero la prueba no figura entre sus avisos activos. Revisá permisos del sitio, notificaciones de Windows y No molestar.');
      } else {
        setInfo('Se solicitó el aviso local, pero este navegador no permite verificar que haya aparecido en pantalla. Revisá las notificaciones del sistema; esta prueba no usa Firebase.');
      }
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); }
  }

  async function diagnose() {
    clearFeedback(); setWorking('diagnose');
    try {
      const state = await getLocalNotificationDiagnostics();
      setCapabilities(getPushCapabilities());
      setDiagnostics(state);
      if (!state.secure || !state.supported || state.permission !== 'granted' || !state.workerActive) {
        setError('El diagnóstico detectó una configuración incompleta. Revisá el estado detallado abajo.');
      } else {
        setInfo('Permisos y service worker correctos. Si el banner no se ve, Windows o el navegador pueden estar ocultándolo. Revisá No molestar y Win + N.');
      }
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); }
  }

  async function testReal() {
    clearFeedback(); setWorking('real-test');
    try {
      const response = await sendRealPushTest(device.deviceId);
      setInfo('Firebase aceptó ' + response.sent + ' envío(s) push real(es) para este equipo. Si la app está abierta aparecerá un aviso interno; si está en segundo plano, comprobá las notificaciones de Windows o del celular.');
    } catch (err) {
      setError('Push real: ' + (err.message || 'No se pudo enviar') +
        (err.code ? ' (' + err.code + ')' : ''));
    } finally { setWorking(''); }
  }

  async function syncAgenda() {
    clearFeedback(); setWorking('schedule');
    try {
      const response = await syncDemoDueSchedule(demoData, { force: true });
      setInfo('Agenda de demostración sincronizada: ' + response.dues + ' fechas de cuotas y ' + response.renewals + ' vencimientos de pólizas. Netlify hará la revisión programada.');
    } catch (err) { setError(err.message || 'No se pudo sincronizar la agenda.'); }
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
      <div><small>Cuenta operadora</small><b>{canSend ? account.email : account?.isAnonymous ? 'Anónima de demo' : 'Sin cuenta vinculada'}</b></div>
    </div>
    {reason && <div className="push-feedback warn"><CircleAlert size={17}/><span>{reason}</span></div>}
    {!!error && <div className="push-feedback error" role="alert"><CircleAlert size={17}/><span>{error}</span></div>}
    {!!info && <div className="push-feedback good" role="status"><CheckCircle2 size={17}/><span>{info}</span></div>}
    <div className="push-actions">
      {!enabled
        ? <button className="btn" type="button" disabled={!!working || blocked} onClick={activate}><BellRing size={16}/> {working === 'activate' ? 'Activando…' : 'Activar en este dispositivo'}</button>
        : <button className="btn btn-outline" type="button" disabled={!!working} onClick={deactivate}><BellOff size={16}/> {working === 'deactivate' ? 'Desactivando…' : 'Desactivar dispositivo'}</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={refresh}><RefreshCw size={16}/> Sincronizar</button>}
      {canSend && <button className="btn" type="button" disabled={!!working} onClick={testReal}><Send size={16}/> {working === 'real-test' ? 'Enviando…' : 'Probar push real desde la app'}</button>}
      {canSend && <button className="btn btn-outline" type="button" disabled={!!working} onClick={syncAgenda}><RefreshCw size={16}/> Sincronizar vencimientos demo</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={testLocal}><Send size={16}/> Probar aviso local</button>}
      {enabled && <button className="btn btn-outline" type="button" disabled={!!working} onClick={copyToken}><Copy size={16}/> Copiar token de prueba</button>}
      <button className="btn btn-outline" type="button" disabled={!!working} onClick={diagnose}><RefreshCw size={16}/> Diagnosticar notificaciones</button>
    </div>
    {diagnostics && <div className="push-diagnostics" role="status">
      <b>Diagnóstico de este dispositivo</b>
      <div><span>Permiso del navegador</span><strong>{diagnostics.permission === 'granted' ? 'Permitido' : diagnostics.permission === 'denied' ? 'Bloqueado' : 'Sin conceder'}</strong></div>
      <div><span>Conexión HTTPS</span><strong>{diagnostics.secure ? 'Correcta' : 'No segura'}</strong></div>
      <div><span>Service worker</span><strong>{diagnostics.workerActive ? 'Activo' : diagnostics.workerRegistered ? 'Registrado, no activo' : 'Sin registrar'}</strong></div>
      <div><span>Avisos activos en el navegador</span><strong>{diagnostics.notificationsCount === null ? 'No verificable' : String(diagnostics.notificationsCount)}</strong></div>
      <p>Un aviso registrado no garantiza que Windows muestre un banner. Verificá Windows → Configuración → Sistema → Notificaciones → Google Chrome/Microsoft Edge y desactivá «No molestar»; también podés revisar Win + N.</p>
    </div>}
    <p className="push-disclaimer">El permiso se solicita solo al pulsar Activar. Las push reales se envían desde funciones privadas de Netlify con Firebase Admin, una cuenta de operadora autorizada y la credencial segura de Netlify. No hace falta usar Firebase Console para probar el envío. Los clientes ficticios permanecen en el navegador; solo sus fechas de vencimiento se sincronizan para los avisos programados de la demo. El cierre definitivo de operaciones reales requerirá migrar la cartera a Firestore.</p>
  </article>;
}
