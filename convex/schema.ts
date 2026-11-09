/**
 * Esquema de la base de datos en Convex.
 *
 * Traducción de docs/referencia-bd/HU-H02_acumulado.sql (PostgreSQL).
 * Equivalencias principales:
 *   - SERIAL id            -> _id automático de Convex (v.id("tabla") en las FK)
 *   - TIMESTAMP            -> número (milisegundos desde 1970, Date.now())
 *   - DATE / TIME          -> texto "YYYY-MM-DD" / "HH:MM" (ordenan bien como texto)
 *   - NUMERIC(10,2)        -> número (soles)
 *   - ENUM                 -> v.union(v.literal(...)) en convex/helpers/enums.ts
 *   - UNIQUE, CHECK, FK    -> Convex no los tiene: se validan en las funciones
 *                             (ver convex/helpers/validaciones.ts) apoyadas en estos índices.
 *
 * Las columnas conservan el mismo nombre que en el SQL para que sea fácil
 * comparar ambos diseños.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  rolUsuario,
  estadoValidacionUsuario,
  estadoRecurso,
  estadoHorario,
  tipoSolicitud,
  prioridadSolicitud,
  estadoSolicitud,
} from "./helpers/enums";

export default defineSchema({
  // ------------------------------------------------------------------
  // PARTE 1 y 2 — HU-U01 / HU-U02
  // ------------------------------------------------------------------
  usuarios: defineTable({
    codigo_dni: v.string(), // UNIQUE, ^[A-Za-z0-9]{6,20}$
    nombre: v.string(),
    correo: v.string(), // se guarda en minúsculas -> equivale a UNIQUE (LOWER(correo))
    password_hash: v.string(),
    rol: rolUsuario,
    intentos_fallidos: v.number(), // bloqueo al 3er intento
    bloqueado: v.boolean(),
    otp_hash: v.optional(v.string()),
    otp_expira: v.optional(v.number()),
    // HU-U02: solo para rol 'administrativo'
    documento_validacion: v.optional(v.string()),
    estado_validacion: v.optional(estadoValidacionUsuario),
    comentario_validacion: v.optional(v.string()),
    fecha_validacion: v.optional(v.number()),
    validado_por: v.optional(v.id("usuarios")),
    fecha_creacion: v.number(),
    fecha_actualizacion: v.number(),
  })
    .index("by_codigo_dni", ["codigo_dni"])
    .index("by_correo", ["correo"])
    // idx_usuarios_validacion_pendiente
    .index("by_estado_validacion", ["estado_validacion", "fecha_creacion"]),

  // Sesiones activas (reemplaza al JWT del informe). Solo se guarda el hash del token.
  sesiones: defineTable({
    id_usuario: v.id("usuarios"),
    token_hash: v.string(),
    expira: v.number(),
    fecha_creacion: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_usuario", ["id_usuario"]),

  // ------------------------------------------------------------------
  // PARTE 3 — HU-S01
  // ------------------------------------------------------------------
  lugares: defineTable({
    nombre: v.string(), // UNIQUE
    descripcion: v.optional(v.string()),
    ubicacion: v.optional(v.string()),
    capacidad: v.number(), // > 0
    precio: v.number(), // >= 0
    estado: estadoRecurso,
    roles_permitidos: v.array(rolUsuario), // al menos uno
    fecha_creacion: v.number(),
    fecha_actualizacion: v.number(),
  })
    .index("by_nombre", ["nombre"])
    .index("by_estado", ["estado"]),

  // ------------------------------------------------------------------
  // PARTE 4 — HU-S02
  // ------------------------------------------------------------------
  objetos: defineTable({
    nombre: v.string(), // UNIQUE
    descripcion: v.optional(v.string()),
    stock: v.number(), // >= 0
    precio: v.number(), // >= 0, por unidad
    estado: estadoRecurso,
    roles_permitidos: v.array(rolUsuario),
    fecha_creacion: v.number(),
    fecha_actualizacion: v.number(),
  })
    .index("by_nombre", ["nombre"])
    .index("by_estado", ["estado"]),

  // Bloques de horario de un lugar O de un objeto (arco exclusivo).
  horarios: defineTable({
    id_lugar: v.optional(v.id("lugares")),
    id_objeto: v.optional(v.id("objetos")),
    fecha: v.string(), // "YYYY-MM-DD"
    hora_inicio: v.string(), // "HH:MM"
    hora_fin: v.string(), // "HH:MM", > hora_inicio
    estado: estadoHorario,
    motivo_no_disponible: v.optional(v.string()), // obligatorio si estado = no_disponible
    creado_por: v.id("usuarios"),
    fecha_creacion: v.number(),
    fecha_actualizacion: v.number(),
  })
    // idx_horarios_lugar_fecha + uq_horarios_lugar_inicio
    .index("by_lugar_fecha", ["id_lugar", "fecha", "hora_inicio"])
    // idx_horarios_objeto_fecha + uq_horarios_objeto_inicio
    .index("by_objeto_fecha", ["id_objeto", "fecha", "hora_inicio"])
    // idx_horarios_fecha (calendario general)
    .index("by_fecha_estado", ["fecha", "estado"]),

  solicitudes: defineTable({
    id_usuario: v.id("usuarios"),
    tipo: tipoSolicitud,
    prioridad: prioridadSolicitud, // 'normal' por defecto
    estado: estadoSolicitud, // 'pendiente' al crear
    motivo: v.string(), // no vacío
    monto_total: v.number(), // >= 0, informativo
    fecha_creacion: v.number(),
    fecha_actualizacion: v.number(),
  })
    // idx_solicitudes_usuario (id_usuario, fecha_creacion DESC)
    .index("by_usuario", ["id_usuario", "fecha_creacion"])
    // idx_solicitudes_usuario_estado / _tipo (HU-S03)
    .index("by_usuario_estado", ["id_usuario", "estado"])
    .index("by_usuario_tipo", ["id_usuario", "tipo"]),

  // Detalle: bloques de espacio de una solicitud. UNIQUE (id_solicitud, id_horario)
  reservas: defineTable({
    id_solicitud: v.id("solicitudes"),
    id_horario: v.id("horarios"),
    id_lugar: v.id("lugares"), // debe coincidir con horarios.id_lugar
  })
    .index("by_solicitud", ["id_solicitud", "id_horario"])
    .index("by_horario", ["id_horario"]),

  // Detalle: equipos de una solicitud. UNIQUE (id_solicitud, id_horario)
  prestamos: defineTable({
    id_solicitud: v.id("solicitudes"),
    id_horario: v.id("horarios"),
    id_objeto: v.id("objetos"), // debe coincidir con horarios.id_objeto
    cantidad: v.number(), // > 0
  })
    .index("by_solicitud", ["id_solicitud", "id_horario"])
    .index("by_horario", ["id_horario"]),
});
