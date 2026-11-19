# Push reales desde Gestión Seguros — como SII Pallets

## Funciona desde la aplicación, NO desde Firebase Console

La versión 0.3 agrega el mismo patrón utilizado en SII Pallets: **React + FCM + Service Worker + Netlify Functions con Firebase Admin y envío desde la propia app**.

- `Configuración → Cuenta de la productora`: iniciar sesión con Firebase Email/Contraseña.
- `Configuración → Push por dispositivo`: activar permisos y guardar token del equipo; un mismo usuario puede activar PC, Android e iPhone PWA.
- `Probar push real desde la app`: ejecuta `/.netlify/functions/push-test` y Firebase Admin envía un mensaje al dispositivo actual; no hace falta entrar a la consola para enviar la prueba.
- Alta de clientes, nuevas pólizas, movimientos de caja, pagos, confirmaciones, rendiciones y cierres envían aviso FCM a **los dispositivos del mismo UID autenticado**, mediante `push-event`. Si otro equipo usa otra cuenta, no recibe el evento; la vinculación multiusuario requiere gestión por agencia y roles.
- Las fechas ficticias de cuotas y pólizas se sincronizan automáticamente desde el navegador al documento `gestion_push_schedules/{uid}`, sin nombres, DNI, patente, teléfono ni importes.
- `push-tick` revisa esa agenda **todos los días a las 12:00 UTC (09:00 Argentina)**. Envía un resumen genérico al mismo UID, con deduplicación diaria, incluso con la aplicación cerrada.
- Las notificaciones con la pestaña enfocada se muestran dentro de la app; cuando está en segundo plano, interviene el Service Worker y las notificaciones del sistema.

## Tres pasos necesarios para encender el envío

### 1. Firebase Authentication — Email/contraseña

En https://console.firebase.google.com/project/gestion-seg/authentication/providers

1. Habilitá **Correo electrónico/Contraseña** además del modo Anónimo ya habilitado.
2. En la lista de Usuarios, creá **una cuenta real para la persona autorizada**, con su correo y una contraseña fuerte. No guardes ni compartas contraseñas por chat.
3. En cada PC o celular de la agencia, entrá con **esa misma cuenta** en Configuración para asociar los dispositivos al mismo UID; luego presioná Activar push en ese equipo.
4. La demo de clientes/pólizas sigue local, abierta sin ingreso de usuario. No la uses para asegurados reales hasta completar seguridad de la cartera.

### 2. Firebase Admin — generar credencial de servidor (privada)

Abrí https://console.firebase.google.com/project/gestion-seg/settings/serviceaccounts

- Elegí **Generar nueva clave privada** en Cuentas de servicio de Firebase.
- Guardá el archivo JSON en un lugar privado.
- **No lo pegues en ChatGPT, no lo subas a GitHub y no lo agregues al código**.
- Desde Netlify → Project configuration → Environment variables, creá una variable **solo de servidor**:

```text
GESTION_FIREBASE_SERVICE_ACCOUNT_JSON
```

Su valor es **todo el contenido JSON del archivo** (no la ruta del archivo). No lleva prefijo `VITE_`. Marcala como secreta/sensible si Netlify ofrece esa opción.

### 3. Netlify — cuenta autorizada

Creá otra variable de entorno en Netlify:

```text
GESTION_PUSH_ALLOWED_EMAILS
```

Su valor debe ser el mismo correo creado en Firebase Authentication; admite varios correos separados por coma (ejemplo ficticio: `agente@ejemplo.com,empleada@ejemplo.com`). Las credenciales y las contraseñas nunca forman parte de esta variable.

Publicá nuevamente el deploy de `main`. La VAPID pública y las seis variables Web de Firebase **ya están incluidas** en el código con respaldo.

## Procedimiento de prueba real

1. Abrí la app HTTPS de Netlify y recargá una vez.
2. Configuración → Cuenta de la productora: ingresar con correo y contraseña.
3. Configuración → Push por dispositivo: presionar Activar si todavía no quedó registrado con el UID de la cuenta. Aceptar permisos.
4. Pulsar **Probar push real desde la app**. El servidor valida el ID Token del usuario y que el equipo pertenezca a su UID; envía un mensaje FCM real. No se usan notificaciones locales para esta prueba.
5. Verificar el aviso con la pestaña en segundo plano. Si la pestaña está abierta, se muestra un aviso interno (toast); no se garantiza un banner del sistema cuando la app tiene foco.
6. Registrar una operación ficticia en Caja o el pago de una cuota. La app solicita el envío del evento al servidor; otros equipos con **la misma cuenta** y push activa deberían recibirlo.
7. Pulsar **Sincronizar vencimientos demo** si se desea confirmar las fechas que la función programada revisará mañana.
8. Para iPhone, instalar la PWA en pantalla de inicio y usarla desde el icono.

## Seguridad y limitaciones

- **El backend exige Firebase Auth Email/Contraseña y la lista autorizada de correos**. Las cuentas anónimas solo pueden registrar sus propios tokens de demo, pero NO ejecutar el emisor.
- Los mensajes que llegan al sistema operativo usan textos genéricos, sin información sensible.
- Netlify administra Firebase Admin; la clave privada nunca llega al navegador.
- La emisión por operaciones funciona mientras una operadora autorizada usa la app y registra acciones locales ficticias.
- **Los datos de clientes siguen en localStorage**. Un cliente creado en una PC no aparece en otra; las push no son sincronización de cartera. Para uso real se necesita migración a Firestore, reglas por agencia, backend con eventos verificados y auditoría.
- El envío programado trabaja únicamente con fechas demo sincronizadas por la usuaria. Si se modifica la agenda en otro equipo, el último dispositivo que sincronice puede modificar el resumen; producción requiere una base compartida.
- Cada usuario debe activar permisos en cada dispositivo. El permiso de Windows/Chrome y las políticas de notificaciones del sistema siguen determinando si se ve un banner.
- `firestore.rules` existentes permiten a cada usuario administrar **sus tokens**, no clientes, caja ni agenda (la agenda solo la escribe el backend con Firebase Admin).
- Las notificaciones se agrupan y se deduplican para reducir costos de Firestore y evitar avisos repetidos.

## Diagnósticos

- `ADMIN_MISSING`: falta `GESTION_FIREBASE_SERVICE_ACCOUNT_JSON` en Netlify.
- `ALLOWLIST_MISSING`: falta `GESTION_PUSH_ALLOWED_EMAILS` en Netlify.
- `403`: cuenta anónima o correo no autorizado. Revisar correo/contraseña y lista de Netlify.
- `NO_DEVICES`: volver a activar push con la sesión autenticada, luego probar.
- `FCM_DELIVERY`: token registrado, pero FCM lo rechazó; reactivar dispositivo.
- `429`: cooldown de prueba (20 segundos) o límite temporal.
- Para errores del servidor: Netlify → Functions → `push-test` / `push-event` → Logs.

## Código

- `netlify/lib/gestion-push.mjs`: autenticación, Firebase Admin y envío.
- `netlify/functions/push-test.mjs`: prueba real desde la app.
- `netlify/functions/push-event.mjs`: eventos al registrar una operación ficticia.
- `netlify/functions/push-schedule.mjs`: guarda fechas de prueba en Firestore.
- `netlify/functions/push-tick.mjs`: revisión programada diaria.
- `src/pushServerClient.js`: cola, API y sincronización de fechas.
- `src/PushOperatorAuth.jsx`: ingreso de la operadora.
- `src/DevicePushPanel.jsx`: activación y prueba desde la app.
