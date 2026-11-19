# Gestión Seguros — Versión 0.2 (demo + registro de push por dispositivo)

Aplicación React + Vite para productoras de seguros, preparada para Netlify.

**ATENCIÓN:** la cartera, clientes, pólizas, cuotas y caja siguen siendo una **demostración local con datos ficticios almacenados en `localStorage`**. No cargar datos reales: todavía no existe un sistema de usuarios y roles para la gestión de asegurados ni almacenamiento seguro de comprobantes.

## Módulos
- Inicio con saldos, alertas y próximos vencimientos.
- Caja diaria con efectivo, transferencias, datos de comprobantes, filtros y cierre.
- Clientes con búsqueda por DNI, teléfono y patente.
- Pólizas y cuotas con dos modalidades: cobro en oficina + rendición o pago directo a la compañía.
- Vencimientos y apertura de WhatsApp con texto precargado; abrir el chat no confirma el envío.
- Centro de notificaciones internas, informes y preferencias.
- **Activación de notificaciones push FCM por dispositivo**: permisos desde un botón, registro con sesión de prueba de Firebase Auth, Firestore, service worker, prueba local, copia de token para prueba FCM y desactivación del dispositivo.

**Importante:** tener el dispositivo registrado en Firebase no significa que se estén enviando recordatorios automáticos. La función programada para procesar vencimientos se agregará después de la migración segura de la cartera a Firestore.

## Arranque local
```bash
npm install
npm run dev
```

## Publicar en Netlify

Repositorio: `rpmartinrodriguez/gestion-seguros`. Seleccionar GitHub, rama `main`, build `npm run build`, publicación `dist`, Node 22. El archivo `netlify.toml` ya contiene las opciones de despliegue.

## Configuración Firebase y push

El proyecto Web de Firebase es `gestion-seg`. Sus identificadores públicos ya están disponibles como valores predeterminados en `src/firebaseConfig.js`; se pueden reemplazar con `VITE_FIREBASE_*` en Netlify.

Para habilitar la activación falta **la clave pública VAPID**, que debe cargarse en Netlify como `VITE_FIREBASE_VAPID_KEY`, más habilitar Firebase Authentication **Anónimo** (solo para la demo) y publicar las reglas restrictivas de `firestore.rules` en Firebase Console.

**Instrucciones completas:** [docs/ACTIVAR_PUSH_FIREBASE.md](docs/ACTIVAR_PUSH_FIREBASE.md).

Las reglas de Firestore solo admiten que cada usuario de demo guarde sus propios registros técnicos de tokens push. **No autorizan acceso a clientes o cartera.** Antes de usar datos reales, reemplazar sesiones anónimas por login de operadores, seguridad por agencia y almacenamiento seguro.

## Criterios contables

Los cobros de primas pendientes de rendir no son ingresos propios de la agencia. Las transferencias informadas requieren validación; sin conciliación con aseguradoras, un pago registrado no certifica vigencia de cobertura. Esta demo no reemplaza un sistema habilitado de gestión aseguradora.
