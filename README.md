# Gestión Seguros — Versión 0.1 (demo)

Aplicación React + Vite para productoras de seguros, preparada para Netlify.

**ATENCIÓN:** esta es una demostración con datos ficticios almacenados solo en el navegador usando `localStorage`. **No cargar datos reales**: aún no hay autenticación ni base de datos compartida, las push no están activas y no existe almacenamiento seguro para comprobantes.

## Módulos
- Panel de control, saldos y próximos vencimientos.
- Caja diaria con movimientos de efectivo y transferencias, filtros, datos de comprobantes, CSV y cierre diario.
- Clientes: altas, edición, filtro por nombre, DNI, patente y teléfono.
- Pólizas: cobro en oficina o pago directo a la aseguradora, cuotas y estado.
- Cobranza en oficina: ingreso en caja más rendición posterior a la compañía. Pago directo: actualización de cuota sin movimiento de caja.
- Vencimientos: agenda y apertura de chat WhatsApp con mensaje precargado; apertura no es confirmación de envío.
- Reportes y configuración.

## Arranque local

```bash
npm install
npm run dev
```

## Publicar en Netlify

**GitHub:** `rpmartinrodriguez/gestion-seguros`. Importar desde Git en Netlify. Build command `npm run build`, publish directory `dist`, Node.js `22`. La configuración ya se encuentra en `netlify.toml`.

## Próxima etapa Firebase

Conectar Firebase Auth, Firestore, Cloud Storage y FCM. Establecer reglas con permisos de administrador y operador, índices, funciones programadas para vencimientos y auditoría. No agregar contraseñas al código. Las variables de `.env.example` son solo placeholders: no conectan Firebase en esta demo. Las reglas iniciales de `firestore.rules` deniegan todo hasta construir la seguridad.

## Criterios contables

Los cobros de primas para rendición no son ingresos propios de la agencia. Las transferencias informadas requieren validación; sin conciliación con aseguradoras, un pago registrado no certifica vigencia de cobertura. La demo no reemplaza un sistema de gestión aseguradora autorizado.
