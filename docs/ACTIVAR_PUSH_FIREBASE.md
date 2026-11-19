> **Actualización versión 0.3:** las pruebas push reales y el envío por operaciones ya se realizan desde la aplicación mediante funciones de Netlify. La guía actualizada está en [PUSH_REALES_NETLIFY.md](PUSH_REALES_NETLIFY.md). Los pasos manuales de Firebase Console que figuran abajo son diagnósticos alternativos, no el flujo normal.\n\n# Activación de notificaciones push — Firebase `gestion-seg`

Esta etapa conecta la **configuración Web de Firebase** que proporcionó el propietario y permite **activar, registrar, probar localmente y desactivar por dispositivo**. La aplicación continúa en **modo demostración**: clientes, pólizas, cuotas y movimientos permanecen en `localStorage` con datos ficticios. No subir datos reales.

## Estado funcional
- La solicitud de permisos se realiza exclusivamente al pulsar **Activar en este dispositivo** (no aparece espontáneamente al abrir).
- Se crea o reutiliza la sesión temporal anónima de Firebase Auth **solo para registrar el token del dispositivo de prueba**.
- El token FCM se guarda en Firestore en `pushDevices/{uid}/devices/{deviceId}`, con reglas restrictivas a su dueño.
- Una visita posterior mantiene el estado y trata de actualizar el token cada 48 h, **sin volver a pedir permiso**; no hay consultas periódicas.
- Cada navegador/PWA es un dispositivo independiente, y hay un botón de desactivación para revocar el token y borrar el registro de Firestore.
- La prueba de aviso local demuestra permisos, pero **no representa un envío remoto desde Firebase**.
- Para probar envío FCM real se puede copiar el token en Configuración y usar **Enviar mensaje de prueba** desde la consola de Firebase Cloud Messaging.
- Los recordatorios automáticos basados en los vencimientos reales **NO están desplegados**: requieren migrar los datos a Firestore, autenticación de operadores y un emisor programado de servidor. No desplegar un emisor sin estas medidas.

## 1. Firebase: preparar los servicios desde Firebase Console

Abrí https://console.firebase.google.com/project/gestion-seg

**Authentication**
1. Build > Authentication > Comenzar (si aún no lo hiciste).
2. Sign-in method > habilitar **Anónimo** (solo para esta demostración de alta de dispositivos).
3. Revisar los dominios autorizados y agregar el dominio real de Netlify y cualquier dominio propio que use la app, si fuese necesario.
4. Antes de producción reemplazar cuentas anónimas por usuarios y roles de la agencia.

**Firestore Database**
1. Build > Firestore Database > Crear base (si aún no existe).
2. Abrir Reglas y pegar el contenido de `firestore.rules` de este repositorio; publicar. El archivo en GitHub **no aplica reglas por sí mismo**.
3. Las reglas solo habilitan los tokens del dispositivo autenticado y **deniegan clientes y demás colecciones**. No usar "modo de prueba" permisivo.
4. El backend Admin SDK podrá leer todos los registros autorizados cuando exista un servicio emisor.

**Cloud Messaging / VAPID**
1. ⚙ Configuración del proyecto > pestaña **Cloud Messaging**.
2. En "Certificados push web", crear o importar un par de claves.
3. Copiar **solo la clave PÚBLICA VAPID**, no la privada.
4. Crear la variable de entorno `VITE_FIREBASE_VAPID_KEY` en Netlify con ese valor.
5. Volver a desplegar; Vite incorpora esta variable **durante el build**, no cambia en una web ya publicada.
6. Si al obtener el token se informa que la API FCM Registration está deshabilitada, habilitarla en Google Cloud para el proyecto.

## 2. Variables Netlify

En Site configuration > Environment variables, configurar:

```env
VITE_FIREBASE_API_KEY=AIzaSyCDUepiYSVm0KRVoVGg4TPZ3kqgwOW5oU4
VITE_FIREBASE_AUTH_DOMAIN=gestion-seg.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gestion-seg
VITE_FIREBASE_STORAGE_BUCKET=gestion-seg.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=447212017074
VITE_FIREBASE_APP_ID=1:447212017074:web:9193f6874c5e26a42c00ab
VITE_FIREBASE_VAPID_KEY=PEGAR_AQUI_CLAVE_PUBLICA_VAPID
```

Las **seis primeras variables son configuración Web pública** proporcionada por el propietario, y existen también como valores predeterminados en `src/firebaseConfig.js`; por eso no es obligatorio recargarlas en Netlify. La **última**, VAPID, todavía no fue proporcionada: sin ella el botón de activación indicará "Configuración pendiente".

**No usar** Service Account JSON, claves de Firebase Admin, claves privadas VAPID ni credenciales de usuarios en el repositorio o variables Vite, ya que `VITE_*` se incluye en el JavaScript público del sitio.

El service worker `public/firebase-messaging-sw.js` contiene únicamente configuración Web pública, correspondiente al proyecto fijo `gestion-seg`.

## 3. Activación en cada dispositivo

- **PC y Android**: abrir el sitio HTTPS de Netlify > Configuración > Notificaciones push por dispositivo > Activar > permitir notificaciones.
- **iPhone/iPad**: abrir el sitio en Safari, elegir Compartir > Agregar a pantalla de inicio, abrir la app **desde el icono instalado**, ir a Configuración > Activar y aceptar el permiso. Requiere iOS/iPadOS compatible con Web Push.
- El contador de campanita de la demo seguirá mostrando alertas locales y **no prueba que el servidor esté enviando push**.
- Se puede pulsar **Probar aviso local** para comprobar permisos e instalación del service worker.
- Para comprobar FCM en serio, usar **Copiar token de prueba**, luego en Firebase Cloud Messaging enviar un mensaje de prueba a ese token (sin datos personales).
- Pulsar **Desactivar dispositivo** revoca el token del navegador y elimina su registro de Firestore; el permiso general del sitio no se modifica, y puede revocarse desde ajustes del sistema.

## 4. Próxima etapa: envío automático

1. Migrar clientes, pólizas y cuotas de demo a Firestore tras crear acceso con usuario/contraseña y reglas por agencia.
2. Crear función backend con Admin SDK que procese las cuotas y renovaciones, sin exponer credenciales.
3. Definir anti-duplicados por tipo de alerta, cuota y fecha; agrupar avisos.
4. Enviar solo un texto genérico sin DNI, patente ni números de póliza. Al tocar, abrir `/?section=alerts`; el botón WhatsApp dentro de la app prepara el mensaje, **no lo envía automáticamente**.
5. Reemplazar las sesiones anónimas de prueba por cuentas de operadores; migrar o volver a registrar tokens por usuario.
6. Incorporar historial centralizado, estado leído/atendido y horarios de atención.

## Diagnóstico rápido

- **"Falta VAPID"**: cargar `VITE_FIREBASE_VAPID_KEY` y volver a publicar Netlify.
- **"auth/operation-not-allowed"**: habilitar Authentication > Anónimo.
- **"permission-denied"** de Firestore: crear base y publicar `firestore.rules`.
- **"notification permission denied"**: habilitar permisos del sitio en el navegador/dispositivo.
- **iPhone no permite activar**: usar la PWA agregada a Inicio, no una pestaña de Safari.
- **Local funciona pero FCM no llega**: probar con el token del dispositivo desde Firebase Console y revisar clave VAPID, compatibilidad del navegador y API FCM Registration.

Documentación oficial: https://firebase.google.com/docs/cloud-messaging/web/get-started y https://firebase.google.com/docs/cloud-messaging/web/receive-messages


## Si pulsás «Probar aviso local» y no aparece nada en la PC

La función `showNotification()` del navegador **no puede confirmar que el sistema operativo haya mostrado un banner**. Una promesa exitosa solo indica que la solicitud fue aceptada; el aviso puede estar en el centro de notificaciones o silenciado por Windows.

1. En Configuración > Notificaciones push por dispositivo, pulsá **Diagnosticar notificaciones**. Revisá si se indica «Permiso permitido», «HTTPS correcta», «Service worker activo».
2. Pulsá **Probar aviso local**. La aplicación crea un aviso con identificador único y comprueba, cuando el navegador lo soporta, si quedó registrado con `getNotifications()`. **Esto no garantiza visibilidad en pantalla**.
3. En Windows 11: **Configuración > Sistema > Notificaciones**. Activar Notificaciones; desactivar **No molestar**; en la lista de aplicaciones permitir banners para Google Chrome / Microsoft Edge.
4. Abrir el centro de notificaciones con **Win + N**. El aviso puede figurar ahí aunque no se haya mostrado un banner emergente.
5. En Chrome: escribir `chrome://settings/content/notifications` y confirmar que el sitio real de Netlify figure entre los permitidos; si usás Edge, abrir `edge://settings/content/notifications`.
6. Recargar la PWA o pestaña con Ctrl + Shift + R tras el nuevo deploy y volver a ejecutar la prueba. Si el service worker no está activo, desactivar y volver a activar el dispositivo para reinstalarlo; no borrar datos del navegador porque eso eliminaría los datos ficticios de prueba.
7. Si el diagnóstico aparece correcto pero no hay aviso, probar primero con Chrome abierto y Windows sin No molestar. Si sigue fallando, revisar permisos de Windows para el navegador.
8. **Prueba FCM real:** una vez confirmado el registro del dispositivo, copiar el token y desde Firebase Console enviar un mensaje de prueba con la app en segundo plano. La prueba local no verifica la entrega desde los servidores de Firebase.

Referencias: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification y https://support.microsoft.com/en-us/windows/experience/notifications-and-do-not-disturb-in-windows .
