# Login de administrador — Gestión Seguros

## Cuenta solicitada

- Usuario de acceso: `admin@seg.com`.
- Contraseña: se establece **exclusivamente en Firebase Authentication**, no en GitHub, Netlify ni el código fuente.

La aplicación muestra la pantalla de login al entrar. No permite acceder al panel con sesiones anónimas. La autenticación se valida con Firebase Authentication y la pantalla admite un único correo de administrador.

**No se crea automáticamente una cuenta de Firebase desde el frontend.** Esto evita que una persona no autorizada se registre como administrador.

## Crear la cuenta una sola vez

1. Ir a https://console.firebase.google.com/project/gestion-seg/authentication/providers y habilitar **Correo electrónico/Contraseña**.
2. Abrir Firebase Authentication → **Usuarios** → **Agregar usuario**.
3. Introducir `admin@seg.com` y la contraseña elegida para el proyecto. La contraseña fue compartida por chat y es corta; por seguridad conviene usar una nueva contraseña más larga y exclusiva antes de poner datos reales.
4. Guardar. No es necesario repetir este proceso en cada dispositivo.
5. Abrir la PWA de Netlify y entrar con el correo y la contraseña. Firebase conserva la sesión entre visitas.
6. Volver a publicar las reglas `firestore.rules` del repositorio: ahora solamente aceptan registros de dispositivos del usuario autenticado con Correo/Contraseña `admin@seg.com`.

## Push en dispositivos que ya estaban anónimos

Al iniciar sesión, si ese navegador **ya autorizó** notificaciones y estaba registrado bajo UID anónimo, la app intenta transferir el registro de su token FCM al UID nuevo sin pedir permiso otra vez. Si la operación falla (sin conexión, reglas pendientes, etc.) muestra un aviso para activar de nuevo desde Configuración → Notificaciones push.

Los documentos anteriores asociados al usuario anónimo pueden permanecer como registros obsoletos en Firestore; el emisor solo usa la cuenta autorizada. Para limpiarlos puede usarse más adelante una tarea de administración que identifique los documentos anónimos sin usuarios activos.

Cerrar sesión desvincula el token del equipo para no seguir recibiendo avisos en un dispositivo compartido.

## Emisor de Netlify

La aplicación debe tener en Netlify la variable privada:

```text
GESTION_FIREBASE_SERVICE_ACCOUNT_JSON
```

El valor es el JSON de la cuenta de servicio de **gestion-seg**; se guarda solamente en Netlify para las funciones de servidor, nunca en GitHub ni chat.

El backend autoriza por defecto el correo `admin@seg.com`. La variable `GESTION_PUSH_ALLOWED_EMAILS` pasa a ser **opcional** para este administrador; si existe, debe incluir `admin@seg.com` o prevalecerá el valor escrito allí.

La VAPID pública y los datos web de Firebase siguen configurados en el repositorio.

## Limitaciones importantes

- Los clientes y movimientos de demostración siguen en `localStorage`; iniciar sesión **no** los sincroniza entre dispositivos.
- La pantalla de login es obligatoria, pero antes de cargar datos reales todavía es necesario trasladar la cartera a Firestore con reglas seguras, controles de roles y auditoría.
- La compilación de GitHub valida el código, pero **no crea el usuario ni configura Netlify**.
- Una prueba local no equivale a una push real. Para verificar FCM: Configuración → Activar push → **Probar push real desde la app**.
