/**
 * HU-S02: enviar solicitud de préstamo de equipos, simple o conjunta con un espacio.
 *
 * Reglas del backend:
 *  - Solo alumnos, docentes, foráneos y externos piden, y solo los equipos cuyo
 *    roles_permitidos incluye su rol.
 *  - Se respeta el stock de cada bloque: pasa a 'ocupado' cuando se agotan las unidades.
 *  - Hasta 10 equipos por solicitud. A una reserva o conjunta pendiente se le pueden
 *    seguir sumando equipos (mismo horario: se suma la cantidad).
 */
import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { prioridadSolicitud, RolUsuario } from "../helpers/enums";
import { fallar } from "../helpers/errores";
import { checkRole, puedeUsar, ROLES_SOLICITANTES } from "../helpers/permisos";
import { hoyLima, yaEmpezo } from "../helpers/fechas";
import { unidadesOcupadas } from "../recursos/objetos";
import { avisarPorCorreo, conDetalle, insertarSolicitud, validarMotivo } from "./comun";

export const MAX_EQUIPOS = 10;

export const equipoPedido = v.object({ id_horario: v.id("horarios"), cantidad: v.number() });
export type EquipoPedido = { id_horario: Id<"horarios">; cantidad: number };

/** Criterio 3: verifica la disponibilidad (y el stock) de cada equipo. */
export async function validarEquipos(ctx: QueryCtx, pedidos: EquipoPedido[], rol: RolUsuario) {
  if (pedidos.length > MAX_EQUIPOS) fallar("DATOS_INVALIDOS", `Puedes pedir como máximo ${MAX_EQUIPOS} equipos por solicitud.`);
  if (new Set(pedidos.map((p) => p.id_horario)).size !== pedidos.length) {
    fallar("DATOS_INVALIDOS", "Elegiste el mismo equipo y horario dos veces; ajusta la cantidad.");
  }
  const validados = [];
  for (const p of pedidos) {
    const h = await ctx.db.get(p.id_horario);
    if (!h || !h.id_objeto) fallar("NO_ENCONTRADO", "Uno de los horarios de equipo ya no existe.");
    const objeto = await ctx.db.get(h.id_objeto);
    if (!objeto || !puedeUsar(objeto, rol)) fallar("SIN_PERMISO", "No puedes pedir este equipo con tu tipo de cuenta.");
    if (!Number.isInteger(p.cantidad) || p.cantidad < 1) fallar("DATOS_INVALIDOS", "La cantidad de cada equipo debe ser al menos 1.");
    if (yaEmpezo(h)) fallar("DATOS_INVALIDOS", "No puedes elegir un horario que ya pasó.");
    if (h.estado === "no_disponible") fallar("CONFLICTO", `"${objeto.nombre}" no está disponible el ${h.fecha} de ${h.hora_inicio} a ${h.hora_fin}: ${h.motivo_no_disponible}.`);
    const libres = objeto.stock - (await unidadesOcupadas(ctx, h._id));
    if (p.cantidad > libres) {
      fallar(
        "CONFLICTO",
        libres <= 0
          ? `"${objeto.nombre}" ya no tiene unidades libres el ${h.fecha} de ${h.hora_inicio} a ${h.hora_fin}.`
          : `Solo quedan ${libres} ${libres === 1 ? "unidad" : "unidades"} de "${objeto.nombre}" el ${h.fecha} de ${h.hora_inicio} a ${h.hora_fin}.`,
      );
    }
    validados.push({ horario: h, objeto, cantidad: p.cantidad, libres });
  }
  return validados;
}

/** Guarda los préstamos de la solicitud y devuelve su monto. */
export async function guardarEquipos(
  ctx: MutationCtx,
  id_solicitud: Id<"solicitudes">,
  equipos: Awaited<ReturnType<typeof validarEquipos>>,
) {
  let monto = 0;
  for (const e of equipos) {
    // UNIQUE (id_solicitud, id_horario): si el equipo ya estaba en ese horario, se suma la cantidad
    const previo = await ctx.db
      .query("prestamos")
      .withIndex("by_solicitud", (q) => q.eq("id_solicitud", id_solicitud).eq("id_horario", e.horario._id))
      .unique();
    if (previo) await ctx.db.patch(previo._id, { cantidad: previo.cantidad + e.cantidad });
    else await ctx.db.insert("prestamos", { id_solicitud, id_horario: e.horario._id, id_objeto: e.objeto._id, cantidad: e.cantidad });
    if (e.cantidad >= e.libres) await ctx.db.patch(e.horario._id, { estado: "ocupado", fecha_actualizacion: Date.now() });
    monto += e.objeto.precio * e.cantidad;
  }
  return monto;
}

/** Criterio 1: préstamo independiente (solo equipos, con su propio motivo). */
export const crear = mutation({
  args: {
    token: v.string(),
    motivo: v.string(),
    prioridad: v.optional(prioridadSolicitud),
    equipos: v.array(equipoPedido),
  },
  handler: async (ctx, args) => {
    const u = await checkRole(ctx, args.token, ROLES_SOLICITANTES);
    const motivo = validarMotivo(args.motivo);
    if (args.equipos.length === 0) fallar("DATOS_INVALIDOS", "Elige al menos un equipo con su horario.");
    const equipos = await validarEquipos(ctx, args.equipos, u.rol);

    const id = await insertarSolicitud(ctx, { id_usuario: u._id, tipo: "prestamo", prioridad: args.prioridad, motivo });
    const monto = await guardarEquipos(ctx, id, equipos);
    if (monto > 0) await ctx.db.patch(id, { monto_total: monto });
    return await avisarPorCorreo(ctx, u, id);
  },
});

/** Criterio 2: reservas y conjuntas pendientes del usuario, para asociarles equipos. */
export const reservasParaAsociar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const u = await checkRole(ctx, token, ROLES_SOLICITANTES);
    const pendientes = await ctx.db
      .query("solicitudes")
      .withIndex("by_usuario_estado", (q) => q.eq("id_usuario", u._id).eq("estado", "pendiente"))
      .collect();
    const resultado = [];
    // Reservas y conjuntas pendientes: a una conjunta se le pueden seguir sumando equipos
    for (const s of pendientes.filter((s) => s.tipo !== "prestamo").sort((a, b) => b.fecha_creacion - a.fecha_creacion)) {
      const d = await conDetalle(ctx, s);
      if (d.espacios.length > 0 && !d.espacios.some((e) => e.fecha < hoyLima())) resultado.push(d);
    }
    return resultado;
  },
});

/**
 * Criterio 2: agrega equipos a una reserva (o conjunta) pendiente propia; queda como conjunta.
 * Se puede repetir mientras siga pendiente.
 */
export const agregarEquipos = mutation({
  args: {
    token: v.string(),
    id_solicitud: v.id("solicitudes"),
    prioridad: v.optional(prioridadSolicitud),
    equipos: v.array(equipoPedido),
  },
  handler: async (ctx, args) => {
    const u = await checkRole(ctx, args.token, ROLES_SOLICITANTES);
    const s = await ctx.db.get(args.id_solicitud);
    if (!s || s.id_usuario !== u._id) fallar("NO_ENCONTRADO", "No se encontró la reserva elegida.");
    if (s.tipo === "prestamo") fallar("CONFLICTO", "Solo se pueden agregar equipos a una solicitud que incluye un espacio.");
    if (s.estado !== "pendiente") fallar("CONFLICTO", "Solo se pueden agregar equipos mientras la solicitud está pendiente.");
    if (args.equipos.length === 0) fallar("DATOS_INVALIDOS", "Elige al menos un equipo.");

    const equipos = await validarEquipos(ctx, args.equipos, u.rol);
    const monto = await guardarEquipos(ctx, s._id, equipos);
    await ctx.db.patch(s._id, {
      tipo: "conjunta",
      prioridad: args.prioridad ?? s.prioridad,
      monto_total: s.monto_total + monto,
      fecha_actualizacion: Date.now(),
    });
    return await avisarPorCorreo(ctx, u, s._id);
  },
});
