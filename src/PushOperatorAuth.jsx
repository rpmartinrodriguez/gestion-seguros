import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseApp } from './firebaseConfig.js';
import { deactivatePushDevice, getSavedPushDevice } from './devicePush.js';

export default function PushOperatorAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => onAuthStateChanged(getAuth(firebaseApp), account => {
    setUser(account);
    setReady(true);
  }), []);

  async function login(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await signInWithEmailAndPassword(getAuth(firebaseApp), email.trim(), password);
      setPassword('');
      setMessage('Sesión iniciada. Activá las notificaciones con esta cuenta en cada dispositivo para vincularlos.');
    } catch(err) {
      setError('No se pudo ingresar. Revisá que Firebase Authentication tenga habilitado Correo/contraseña y que la cuenta exista. Código: ' + (err.code || err.message));
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try {
      const existing = getSavedPushDevice();
      if (existing?.active && existing.uid === user?.uid) {
        const warnings = await deactivatePushDevice();
        if (warnings.length) setError('Revisá el token del dispositivo en Firebase: ' + warnings.join(' '));
      }
      await signOut(getAuth(firebaseApp));
      setMessage('Sesión cerrada. Para recibir avisos en este equipo, ingresá nuevamente.');
    } catch(err) { setError(err.message || 'No se pudo cerrar la sesión.'); }
    finally { setBusy(false); }
  }

  if (!ready) return <article className="panel settingspanel"><p className="muted">Comprobando sesión de Firebase…</p></article>;
  return <article className="panel settingspanel operator-auth">
    <h3>Cuenta de la productora · Push reales</h3>
    {user?.email && !user.isAnonymous ? <>
      <p className="muted">Sesión activa: <b>{user.email}</b>. Todos los equipos que inicien sesión con esta cuenta y activen las push podrán recibir los mismos avisos.</p>
      <button type="button" className="btn btn-outline" onClick={logout} disabled={busy}>Cerrar sesión y desvincular este equipo</button>
    </> : <>
      <p className="muted">Para enviar push desde la aplicación, ingresá con una cuenta de Correo/contraseña creada en Firebase Authentication y autorizada mediante la variable GESTION_PUSH_ALLOWED_EMAILS de Netlify. La demostración de clientes sigue disponible sin iniciar sesión.</p>
      <form onSubmit={login} className="operator-login">
        <label>Correo de la operadora<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@agencia.com"/></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión de notificaciones'}</button>
      </form>
    </>}
    {message && <p className="push-feedback good" role="status">{message}</p>}
    {error && <p className="push-feedback error" role="alert">{error}</p>}
  </article>;
}
