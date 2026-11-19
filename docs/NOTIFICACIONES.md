# Notificaciones de Gestión Seguros — propuesta y estado

## Estado actual
Se agregó un **centro de alertas internas** y un panel para elegir qué eventos mostrar. La lógica se calcula en el navegador con los registros ficticios de la demo. Se guarda la preferencia y el estado "vista" en `localStorage`, por lo que **no hay push remotas, no hay alertas con la app cerrada ni sincronización entre dispositivos**.

No pedir permisos de notificaciones del navegador ni registrar tokens hasta que la aplicación tenga autenticación y persistencia de datos en Firebase. Evitar llamadas de red y suscripciones simuladas.

## Eventos por prioridad

| Clave | Disparador | Destino |
|---|---|---|
| due | Cuota sin pagar, 3 días antes (configurable), hasta el día del vencimiento | Póliza / WhatsApp |
| overdue | Cuota vencida e impaga, primera alerta al día siguiente | Póliza / WhatsApp |
| renewal | Póliza que termina en 30, 15 y 7 días (y advertencias críticas a 3, 1 y 0) | Póliza |
| payments | Cuota de pago directo marcada como informada, sin confirmar | Confirmar en póliza |
| transfers | Movimiento de transferencia con estado informado | Caja / Conciliación |
| remittances | Cuota cobrada en oficina sin rendir, 48 horas después | Rendición |
| closing | Hubo movimientos hoy y falta cierre, después de las 18 horas locales | Cierre de caja |

**Importante:** el centro de alertas puede mostrar eventos más amplios que los días concretos en los que se enviaría una push. Las reglas de envío a segundo plano deben evitar duplicados y exceso de notificaciones.

## Push reales: arquitectura de la siguiente fase
1. Habilitar Firebase Authentication y roles de la agencia; no guardar tokens en colecciones públicas.
2. Migrar la cartera y movimientos de `localStorage` a Firestore con aislamiento por agencia y reglas estrictas; no desplegar datos reales antes de esto.
3. Configurar `firebaseConfig` web en variables Vite, generar una **clave pública VAPID** desde Firebase > Configuración del proyecto > Cloud Messaging. Mantener credenciales privadas de servidor fuera del frontend y de GitHub.
4. Agregar Firebase Cloud Messaging al cliente con service worker público, registro explícito desde gesto del usuario y token por dispositivo autenticado.
5. Guardar token con ID de usuario, ID de dispositivo, plataforma, `updatedAt`, revocación e indicadores de preferencia. Renovar/validar token en sesiones futuras; no solicitar permiso cada día.
6. Crear función programada en backend (Cloud Scheduler + Functions/Admin SDK): procesa solo los vencimientos registrados en Firestore, verifica preferencias, agrupa eventos, respeta horarios, inserta notificación interna y envía FCM. La deduplicación debe ser transaccional (por `tipo:entidad:fechaEvento` y usuario) para evitar duplicados por ejecuciones simultáneas.
7. El payload push debe ser breve y **sin nombre, DNI, patente, montos ni número de póliza**. Ejemplo: "Tenés 4 cuotas por vencer — Abrir agenda". Una pulsación abre la sección correspondiente.
8. Al entrar a la app, la agente pulsa **Enviar WhatsApp** y confirma manualmente el envío. La push no envía mensajes al cliente automáticamente.
9. Mantener un registro de notificaciones con `status` (nueva/vista/atendida), usuario, evento, entidad, createdAt, seenAt, resolvedAt, device(s) y resultado de entrega cuando esté disponible.

## Comportamiento por plataforma
- **Android / escritorio:** PWA en HTTPS; pedir permisos explícitos después de una acción de la usuaria.
- **iPhone:** para Web Push, agregar la web a la pantalla de inicio y abrirla desde allí. El botón "Enviar WhatsApp" debe permanecer en la pantalla de la app; no depender de acciones avanzadas en el banner del sistema.
- Si la agente usa varios dispositivos, cada dispositivo se suscribe individualmente; las alertas pendientes y el estado de lectura se comparten por usuario tras conectar Firestore.

## Política anti-spam recomendada
- Agrupar vencimientos diarios en **una push de resumen** por la mañana, además de una alerta crítica para vencimientos del día si no se atendió la gestión.
- No enviar repetidamente a la agente una push por cada cuota vencida.
- El estado de lectura no equivale a pago confirmado ni mensaje de WhatsApp enviado.
- Mantener un registro separado de si el chat de WhatsApp se abrió, si el envío fue confirmado por la usuaria y la respuesta recibida (solo si se registra manualmente o mediante integración oficial).
- Permitir configurar días y horarios de trabajo.

## Datos que faltan
- Configuración web de Firebase, clave VAPID pública, Auth habilitada, reglas por agencia, y despliegue de funciones programadas; decidir si se utilizará Cloud Functions o tareas de Netlify.
- Horario real de cierre de caja y hora del resumen diario.
