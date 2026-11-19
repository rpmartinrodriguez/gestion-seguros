import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseApp } from './firebaseConfig.js';
import { deactivatePushDevice, getSavedPushDevice } from './devicePush.js';

export default function PushOperatorAuth() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(getAuth(firebaseApp), setUser), []);

  async function logout() {
    setBusy(true); setError('');
    try {
      const current = getSavedPushDevice();
      // Cerrar la sesión desvincula el token para evitar recibir alertas
      // de la agencia en un equipo compartido después del cierre.
      if (current?.active && current.uid === user?.uid) {
        const warnings = await deactivatePushDevice();
        if (warnings.length) throw new Error('No se pudo eliminar completamente el registro push de este equipo. ' + warnings.join(' '));
      }
      await signOut(getAuth(firebaseApp));
    } catch(err) {
      setError(err.message || 'No se pudo cerrar la sesión de forma segura.');
    } finally { setBusy(false); }
  }

  return <article className="panel settingspanel operator-auth">
    <h3>Cuenta del administrador</h3>
    <p className="muted">Sesión de Firebase activa: <b>{user?.email || 'Verificando…'}</b>. Este equipo puede recibir notificaciones de la agencia cuando actives las push desde el panel de abajo.</p>
    <button type="button" className="btn btn-outline" onClick={logout} disabled={busy || !user?.email}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión y desvincular este equipo'}</button>
    {error && <p className="push-feedback error" role="alert">{error}</p>}
  </article>;
}
