/**
 * Tipos enumerados, iguales a los CREATE TYPE del SQL.
 */
import { v, Infer } from "convex/values";

export const ROLES = ["alumno", "docente", "administrativo", "foraneo", "externo"] as const;
export const rolUsuario = v.union(
  v.literal("alumno"),
  v.literal("docente"),
  v.literal("administrativo"),
  v.literal("foraneo"),
  v.literal("externo"),
);
export type RolUsuario = Infer<typeof rolUsuario>;

export const estadoValidacionUsuario = v.union(
  v.literal("pendiente"),
  v.literal("aprobado"),
  v.literal("rechazado"),
);

export const estadoRecurso = v.union(
  v.literal("activo"),
  v.literal("mantenimiento"),
  v.literal("inactivo"),
);

export const estadoHorario = v.union(
  v.literal("disponible"),
  v.literal("no_disponible"),
  v.literal("ocupado"),
);

export const tipoSolicitud = v.union(
  v.literal("reserva"),
  v.literal("prestamo"),
  v.literal("conjunta"),
);

export const prioridadSolicitud = v.union(
  v.literal("baja"),
  v.literal("normal"),
  v.literal("alta"),
);

export const estadoSolicitud = v.union(
  v.literal("pendiente"),
  v.literal("recibida"),
  v.literal("aceptada"),
  v.literal("declinada"),
  v.literal("cancelada"),
);
