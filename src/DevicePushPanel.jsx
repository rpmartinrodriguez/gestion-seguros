import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, CheckCircle2, CircleAlert, Send, Smartphone, Monitor } from 'lucide-react';
import { firebaseApp } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { sendRealPushTest } from './pushServerClient.js';
import {
  activatePushDevice,
  deactivatePushDevice,
  getPushCapabilities,
  getSavedPushDevice,
  pushErrorMessage,
  restorePushDevice,
} from './devicePush.js';

// Panel para el uso diario: activar, probar o desactivar en ESTE dispositivo.
// Los diagnósticos, tokens y programación automática siguen disponibles en
// el código/servicio, pero no se exponen en la interfaz de la clienta.
export default function DevicePushPanel() {
  const [device, setDevice] = useState(getSavedPushDevice);
  const [capabilities, setCapabilities] = useState(getPushCapabilities);
  const [account, setAccount] = useState(null);
  const [working, setWorking] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(getAuth(firebaseApp), user => {
      if (mounted) setAccount(user);
    });
    const saved = getSavedPushDevice();
    if (saved?.active) {
      restorePushDevice().then(result => {
        if (mounted) {
          setDevice(result || getSavedPushDevice());
          setCapabilities(getPushCapabilities());
        }
      }).catch(err => {
        if (mounted) setError('No pudimos verificar este dispositivo: ' + pushErrorMessage(err));
      });
    }
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const enabled = Boolean(
    device?.active && device?.registered &&
    capabilities.permission === 'granted' &&
    account?.uid && device.uid === account.uid
  );

  const reason = !capabilities.secure ? 'Abrí la aplicación desde su dirección HTTPS.'
    : !capabilities.supported ? 'Este dispositivo o navegador no admite notificaciones web.'
    : capabilities.ios && !capabilities.standalone ? 'En iPhone, instalá la app en Inicio y abrila desde el ícono.'
    : !capabilities.vapidConfigured ? 'Falta la configuración pública de notificaciones.'
    : capabilities.permission === 'denied' ? 'Las notificaciones están bloqueadas en los ajustes del dispositivo.'
    : '';
  const blocked = Boolean(reason);

  async function activate() {
    setWorking('activate'); setInfo(''); setError('');
    try {
      const result = await activatePushDevice({ requestPermission: true });
      setDevice(result.device);
      setCapabilities(getPushCapabilities());
      setInfo('Notificaciones activadas en este dispositivo.');
    } catch (err) {
      setError(pushErrorMessage(err));
      setCapabilities(getPushCapabilities());
    } finally { setWorking(''); }
  }

  async function deactivate() {
    setWorking('deactivate'); setInfo(''); setError('');
    try {
      const warnings = await deactivatePushDevice();
      setDevice(getSavedPushDevice());
      setCapabilities(getPushCapabilities());
      if (warnings.length) setError('Se desactivó localmente, pero no se confirmó la baja remota. ' + warnings.join(' '));
      else setInfo('Notificaciones desactivadas en este dispositivo.');
    } catch (err) { setError(pushErrorMessage(err)); }
    finally { setWorking(''); }
  }

  async function test() {
    setWorking('test'); setInfo(''); setError('');
    try {
      const result = await sendRealPushTest(device.deviceId);
      setInfo('Prueba enviada desde la app a Firebase (' + result.sent + ' envío confirmado). Revisá el aviso en este dispositivo.');
    } catch (err) {
      setError(err.message || 'No se pudo enviar la notificación de prueba.');
    } finally { setWorking(''); }
  }

  return <article className="panel settingspanel push-settings push-simple">
    <div className="push-heading">
      <div className="push-symbol"><BellRing size={23}/></div>
      <div><h3>Notificaciones</h3><p>Recibí avisos de la agencia en este equipo.</p></div>
    </div>
    <div className="push-state">
      <span>{capabilities.ios ? <Smartphone size={19}/> : <Monitor size={19}/>}
        <b>{device?.label || (capabilities.ios ? 'Este iPhone' : 'Este dispositivo')}</b>
      </span>
      <span className={'tag ' + (enabled ? 'success' : blocked ? 'warning' : 'neutral')}>
        {enabled ? 'Activadas' : blocked ? 'Revisar permisos' : 'Desactivadas'}
      </span>
    </div>
    {reason && !enabled && <div className="push-feedback warn"><CircleAlert size={17}/><span>{reason}</span></div>}
    {error && <div className="push-feedback error" role="alert"><CircleAlert size={17}/><span>{error}</span></div>}
    {info && <div className="push-feedback good" role="status"><CheckCircle2 size={17}/><span>{info}</span></div>}
    <div className="push-simple-actions">
      <button type="button" className="btn" onClick={activate} disabled={enabled || blocked || Boolean(working)}>
        <BellRing size={17}/>{working==='activate'?'Activando…':enabled?'Notificaciones activadas':'Activar notificaciones'}
      </button>
      <button type="button" className="btn btn-outline" onClick={test} disabled={!enabled || Boolean(working)}>
        <Send size={17}/>{working==='test'?'Enviando…':'Probar notificación'}
      </button>
    </div>
    {enabled && <button type="button" className="push-disable" onClick={deactivate} disabled={Boolean(working)}>
      <BellOff size={15}/>{working==='deactivate'?'Desactivando…':'Desactivar en este dispositivo'}
    </button>}
  </article>;
}
