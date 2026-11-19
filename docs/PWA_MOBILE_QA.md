# Gestión Seguros — Revisión responsive PWA móvil

## Alcance de la corrección

Esta actualización modifica únicamente la interfaz (React JSX, CSS y viewport meta). **No altera Firebase Auth, Firestore, FCM, Netlify Functions, tokens ni permisos push.** Mantiene los datos ficticios existentes de `localStorage`.

### Cambios
- Vista PWA con `viewport-fit=cover` y paddings de `safe-area-inset-*` para cámara/notch y barra de gestos.
- Navegación inferior de 5 accesos: Inicio, Caja, Pólizas, Avisos y Más. Menú lateral mantiene Clientes, Vencimientos, Reportes y Configuración.
- Menú lateral móvil con ancho adaptable, scroll propio, botón de cerrar y superposición de fondo.
- Cabecera compacta y tarjeta de inicio reorganizada.
- Valores de las tarjetas con tipografía adaptable, evitando cortes de importes.
- Tablas de Caja, Cierres, Clientes y Reportes: tarjetas verticales con etiquetas de cada dato en pantalla estrecha. La versión de escritorio sigue usando tablas.
- Pólizas y cuotas: información y acciones en una sola columna móvil.
- Vencimientos: fecha y datos arriba, importe y acción de WhatsApp abajo, botón táctil amplio.
- Modales de registro: presentación tipo hoja inferior en móvil, scroll interno y espacio para la barra de gestos.
- Inputs de 16 px en móviles: evita el zoom automático de Safari al enfocar un campo.
- Login y Configuración: adaptación a pantalla pequeña y teclado virtual.
- Avisos, filtros, selector de mes y botones push: controles táctiles más accesibles.

## Verificaciones sugeridas después de publicar Netlify

1. **iPhone PWA instalada** a 375–430 px: ingreso sin corte de campos, acceso a menú, botones visibles y hoja de formularios desplazable.
2. **Android PWA instalada** a 360–412 px: cabecera sin scroll lateral y navegación inferior siempre accesible.
3. **Pantallas pequeñas** de 320–350 px: importes legibles y ajustes de push en una sola columna cuando corresponda.
4. **Caja**: abrir todos los movimientos y verificar tarjetas verticales; registrar ingreso y egreso sin que aparezca scroll horizontal.
5. **Clientes**: buscar, editar y revisar datos sin necesidad de zoom lateral.
6. **Pólizas**: abrir una póliza con muchas cuotas; probar registrar pago o rendición.
7. **Vencimientos**: probar los filtros desplazables y abrir el WhatsApp preparado.
8. **Reportes**: cambiar período y exportar CSV.
9. **Configuración**: activar/desactivar notificaciones por dispositivo, probar push real y consultar diagnóstico.
10. **Login**: abrir sesión, enfocar contraseña (teclado virtual) y confirmar que el botón Ingresar no queda oculto.
11. **PC**: verificar que conserva sidebar, tablas tradicionales y gráficos/tarjetas sin cambios en experiencia.
12. **Datos**: no borrar caché/datos del navegador ni reinstalar PWA durante la prueba; eso podría eliminar datos ficticios locales.

Una compilación exitosa de GitHub garantiza que se construye el frontend, pero **no equivale a una prueba real en iPhone/Android**. Si algún control se superpone en un modelo concreto, adjuntar una captura y el modelo/versión del dispositivo para corregir el detalle.


## Ajustes posteriores de limpieza visual

- En móvil, **no hay campanita ni hamburguesa en la cabecera**; toda la navegación está en la barra inferior, con Avisos y Más. La cabecera conserva el título y el avatar.
- En el menú completo, **Vencimientos** muestra calendario y **Notificaciones** la campana.
- Cada formulario separa campos (área desplazable) y acciones (pie fijo) dentro del modal. La capa del modal se ajusta al `visualViewport` para acompañar el teclado en iOS. No hay scroll de la página mientras se edita.
- Configuración → Notificaciones solo muestra estado, **Activar notificaciones**, **Probar notificación** (push FCM real) y un enlace secundario para desactivar. Se ocultan token, diagnóstico, sincronización manual y prueba local, sin tocar el emisor remoto ni la sincronización de agenda.
- Se aumenta contraste en tarjetas, textos secundarios, estados, bordes y separadores; también en cabecera y pie de los modales.

**Regresión a probar:** crear/editar cliente, nueva póliza, registrar movimiento y cuota, cierre de caja; comprobar que Guardar / Cancelar permanecen visibles al recorrer campos y abrir teclado. Verificar envío FCM real desde Configuración en dispositivo ya registrado, sin volver a conceder permisos. Verificar que el aviso se ve al tocar Avisos en la barra inferior y que Más abre el menú.
