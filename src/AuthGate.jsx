import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ShieldCheck, LockKeyhole, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { firebaseApp } from './firebaseConfig.js';
import { activatePushDevice, getSavedPushDevice } from './devicePush.js';

// El correo es un identificador público, NO una credencial de acceso.
// La contraseña solo la valida Firebase Authentication y no se incluye en el código.
export const ADMIN_EMAIL = 'admin@seg.com';
const auth = getAuth(firebaseApp);

function authError(error) {
  const code = String(error?.code || '');
  if (/invalid-credential|wrong-password|user-not-found/.test(code))
    return 'Correo o contraseña incorrectos, o la cuenta aún no existe en Firebase Authentication.';
  if (code === 'auth/operation-not-allowed')
    return 'Habilitá Correo/contraseña en Firebase Authentication → Método de acceso.';
  if (code === 'auth/too-many-requests')
    return 'Demasiados intentos. Firebase bloqueó temporalmente el acceso; probá después o restablecé la contraseña.';
  if (code === 'auth/network-request-failed')
    return 'No se pudo conectar a Firebase. Revisá la conexión de este dispositivo.';
  return 'No se pudo iniciar sesión. ' + (code || String(error?.message || ''));
}

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('loading');
  const [otherAccount, setOtherAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    return onAuthStateChanged(auth, async (user) => {
      if (disposed) return;
      if (!user || user.isAnonymous || user.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
        setOtherAccount(user && !user.isAnonymous ? user.email || 'otra cuenta' : '');
        setStatus('login');
        return;
      }

      setStatus('loading');
      setOtherAccount('');
      // Si este navegador ya tenía push activas bajo el UID anónimo anterior,
      // pasamos el token al usuario administrador sin pedir permiso nuevamente.
      // Si falla, el acceso permanece disponible y podrá reactivarse desde ajustes.
      const old = getSavedPushDevice();
      if (old?.active && old.uid !== user.uid &&
          typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          await activatePushDevice({ requestPermission: false });
        } catch (err) {
          console.warn('Gestión Seguros: revisá la vinculación push en Configuración.', err?.code || err?.message);
          if (!disposed) setNotice('Ingresaste correctamente. Revisá la activación push de este dispositivo en Configuración.');
        }
      }
      if (!disposed) setStatus('ready');
    }, () => {
      if (!disposed) {
        setError('No se pudo comprobar la sesión de Firebase.');
        setStatus('login');
      }
    });
    // cleanup: cuando cambia el componente raíz, cancelar los resultados tardíos.
  }, []);

  async function login(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      setPassword('');
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearOtherAccount() {
    setBusy(true);
    try { await signOut(auth); setOtherAccount(''); }
    catch(err) { setError(authError(err)); }
    finally { setBusy(false); }
  }

  if (status === 'ready') return <>{notice && <div className="login-notice" role="status">{notice}</div>}{children}</>;

  return <div className="login-shell">
    <div className="login-art" aria-hidden="true">
      <div className="login-big-icon"><ShieldCheck size={70}/></div>
      <div><span className="login-kicker">GESTIÓN SEGUROS</span><h1>Tu cartera, tus cobranzas y tus vencimientos en un solo lugar.</h1><p>Administración organizada de pólizas, cuotas y caja diaria.</p></div>
      <small>Versión demostrativa · Datos ficticios</small>
    </div>
    <main className="login-main">
      <div className="login-card">
        <div className="login-brand"><ShieldCheck size={26}/><span>GESTIÓN<b>SEGUROS</b></span></div>
        <div className="login-icon"><LockKeyhole size={23}/></div>
        <h2>Acceso de administrador</h2>
        <p className="login-description">Ingresá con tu cuenta para administrar Gestión Seguros y las notificaciones de tus dispositivos.</p>
        {status === 'loading' ? <p className="login-loading">Verificando sesión y dispositivos…</p> : <>
          {otherAccount && <div className="push-feedback warn"><AlertTriangle size={18}/><span>Hay otra cuenta abierta ({otherAccount}). Cerrala para ingresar como administrador.</span></div>}
          <form className="login-form" onSubmit={login}>
            <label>Usuario / correo<input type="email" autoComplete="username" value={ADMIN_EMAIL} readOnly aria-label="Usuario administrador"/></label>
            <label>Contraseña
              <div className="login-pass">
                <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password}
                  onChange={e=>setPassword(e.target.value)} placeholder="Ingresá tu contraseña" disabled={busy || Boolean(otherAccount)}/>
                <button type="button" className="login-eye" onClick={()=>setShowPassword(v=>!v)} title={showPassword?'Ocultar contraseña':'Mostrar contraseña'} aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}>
                  {showPassword?<EyeOff size={19}/>:<Eye size={19}/>}
                </button>
              </div>
            </label>
            <button type="submit" className="btn login-submit" disabled={busy || Boolean(otherAccount)}>{busy?'Ingresando…':'Ingresar a la aplicación'}</button>
          </form>
          {otherAccount && <button type="button" className="textbutton" disabled={busy} onClick={clearOtherAccount}>Cerrar la otra sesión</button>}
          {error && <div className="push-feedback error" role="alert"><AlertTriangle size={17}/>{error}</div>}
          <p className="login-hint">El usuario y su contraseña deben existir en Firebase Authentication. La app no guarda tu contraseña.</p>
        </>}
      </div>
    </main>
  </div>;
}
