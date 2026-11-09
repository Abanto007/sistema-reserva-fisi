/**
 * Ayudantes compartidos por reservas.ts (S01), prestamos.ts (S02) e historial.ts (S03).
 * No expone funciones de Convex: solo lógica que reutilizan esos módulos.
 */
import { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { fallar } from "../helpers/errores";
import { validarTextoObligatorio } from "../helpers/validaciones";
import { plantillaSolicitud } from "../helpers/plantillas";

/** Motivo obligatorio y de máximo 500 caracteres. */
export function validarMotivo(valor: string) {
  const motivo = validarTextoObligatorio(valor, "Motivo");
  if (motivo.length > 500) fallar("DATOS_INVALIDOS", "El motivo puede tener como máximo 500 caracteres.");
  return motivo;
}

/** Inserta la cabecera de la solicitud: siempre empieza 'pendiente' (prioridad 'normal' por defecto). */
export async function insertarSolicitud(
  ctx: MutationCtx,
  datos: Pick<Doc<"solicitudes">, "id_usuario" | "tipo" | "motivo"> & { prioridad?: Doc<"solicitudes">["prioridad"] },
) {
  const ahora = Date.now();
  return await ctx.db.insert("solicitudes", {
    id_usuario: datos.id_usuario,
    tipo: datos.tipo,
    prioridad: datos.prioridad ?? "normal",
    estado: "pendiente",
    motivo: datos.motivo,
    monto_total: 0,
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
  });
}

/** Detalle legible de una solicitud: bloques de espacio y equipos. */
export async function conDetalle(ctx: QueryCtx, s: Doc<"solicitudes">) {
  const reservas = await ctx.db.query("reservas").withIndex("by_solicitud", (q) => q.eq("id_solicitud", s._id)).collect();
  const prestamos = await ctx.db.query("prestamos").withIndex("by_solicitud", (q) => q.eq("id_solicitud", s._id)).collect();

  const espacios = [];
  for (const r of reservas) {
    const h = await ctx.db.get(r.id_horario);
    const l = await ctx.db.get(r.id_lugar);
    if (h && l) espacios.push({ id_horario: h._id, recurso: l.nombre, ubicacion: l.ubicacion ?? null, fecha: h.fecha, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin });
  }
  const equipos = [];
  for (const p of prestamos) {
    const h = await ctx.db.get(p.id_horario);
    const o = await ctx.db.get(p.id_objeto);
    if (h && o) equipos.push({ id_horario: h._id, recurso: o.nombre, cantidad: p.cantidad, fecha: h.fecha, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin });
  }
  const orden = (a: { fecha: string; hora_inicio: string }, b: { fecha: string; hora_inicio: string }) =>
    (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio);
  espacios.sort(orden);
  equipos.sort(orden);
  const fechas = [...espacios, ...equipos].map((x) => x.fecha).sort();

  return {
    _id: s._id,
    tipo: s.tipo,
    prioridad: s.prioridad,
    estado: s.estado,
    motivo: s.motivo,
    monto_total: s.monto_total,
    fecha_creacion: s.fecha_creacion,
    fecha_uso_desde: fechas[0] ?? null,
    fecha_uso_hasta: fechas.at(-1) ?? null,
    espacios,
    equipos,
    comentarios: [] as { autor: string; texto: string; fecha: number }[], // tabla comentarios: iteración 3
  };
}

/** Criterio 5 de S01 / S02: confirmación por correo con el detalle. Devuelve el detalle. */
export async function avisarPorCorreo(ctx: MutationCtx, usuario: Doc<"usuarios">, id: Id<"solicitudes">) {
  const s = await ctx.db.get(id);
  if (!s) fallar("NO_ENCONTRADO", "No se encontró la solicitud.");
  const d = await conDetalle(ctx, s);
  const correo = plantillaSolicitud(usuario.nombre, d);
  await ctx.scheduler.runAfter(0, internal.helpers.correo.enviar, { para: usuario.correo, ...correo });
  return d;
}
