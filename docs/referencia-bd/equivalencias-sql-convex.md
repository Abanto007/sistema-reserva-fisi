# Equivalencias: diseño SQL (PostgreSQL) → Convex

Referencia: `HU-H02_acumulado.sql` (iteración 2 completa). El esquema real está en `convex/schema.ts`.

## Tipos

| PostgreSQL | Convex | Nota |
| --- | --- | --- |
| `SERIAL` (id) | `_id` automático | Las FK usan `v.id("tabla")` |
| `TIMESTAMP` | `v.number()` | Milisegundos (`Date.now()`) |
| `DATE` | `v.string()` | `"AAAA-MM-DD"` |
| `TIME` | `v.string()` | `"HH:MM"` |
| `NUMERIC(10,2)` | `v.number()` | Soles |
| `ENUM` | `v.union(v.literal(...))` | En `convex/helpers/enums.ts`, mismos valores |
| `rol_usuario[]` | `v.array(rolUsuario)` | |
| Columna `NULL` | `v.optional(...)` | |

## Tablas

| SQL | Convex | Cambios |
| --- | --- | --- |
| `usuarios` | `usuarios` | `correo` se guarda en minúsculas (equivale a `UNIQUE (LOWER(correo))`) |
| (no existe) | `sesiones` | Reemplaza al JWT: guarda el hash del token y su vencimiento |
| `lugares` | `lugares` | Igual |
| `objetos` | `objetos` | Igual |
| `horarios` | `horarios` | Igual (`id_lugar` u `id_objeto`, nunca ambos) |
| `solicitudes` | `solicitudes` | Igual |
| `reservas` | `reservas` | Igual |
| `prestamos` | `prestamos` | Igual |

## Restricciones (dónde se validan ahora)

Convex no tiene UNIQUE, CHECK ni FK. Cada una se valida dentro de las funciones, que son transaccionales.

| Restricción SQL | Dónde se valida |
| --- | --- |
| `uq_usuarios_codigo_dni`, `uq_usuarios_correo` | Registro (HU-U01), con los índices `by_codigo_dni` y `by_correo` |
| `chk_usuarios_codigo_dni_formato`, `chk_usuarios_correo_formato` | `convex/helpers/validaciones.ts` |
| `chk_usuarios_admin_validacion`, `chk_usuarios_rechazo_con_motivo`, `chk_usuarios_validacion_con_fecha`, `chk_usuarios_no_autovalidacion` | Registro y panel de validación (HU-U02) |
| `uq_lugares_nombre`, `uq_objetos_nombre` | Altas de recursos y semilla, índice `by_nombre` |
| `chk_horarios_rango`, `chk_horarios_un_recurso`, `uq_horarios_lugar_inicio`, `uq_horarios_objeto_inicio` | Creación de horarios (HU-H01), índices `by_lugar_fecha` / `by_objeto_fecha` |
| `chk_horarios_motivo` | Cambio de disponibilidad (HU-H02) |
| `chk_solicitudes_motivo`, `chk_solicitudes_monto` | Creación de solicitudes (HU-S01/S02) |
| `uq_reservas_solicitud_horario`, `uq_prestamos_solicitud_horario`, FK compuestas | Creación de solicitudes, índices `by_solicitud` |
| `ON DELETE RESTRICT` de horarios | Editar/eliminar horario verifica que no tenga reservas ni préstamos (índices `by_horario`) |

## Índices

| SQL | Convex |
| --- | --- |
| `idx_usuarios_validacion_pendiente` | `usuarios.by_estado_validacion` |
| `idx_horarios_lugar_fecha` | `horarios.by_lugar_fecha` |
| `idx_horarios_objeto_fecha` | `horarios.by_objeto_fecha` |
| `idx_horarios_fecha` | `horarios.by_fecha_estado` |
| `idx_solicitudes_usuario` | `solicitudes.by_usuario` |
| `idx_solicitudes_usuario_estado` | `solicitudes.by_usuario_estado` |
| `idx_solicitudes_usuario_tipo` | `solicitudes.by_usuario_tipo` |
| `idx_reservas_horario` | `reservas.by_horario` |
| `idx_prestamos_horario` | `prestamos.by_horario` |
