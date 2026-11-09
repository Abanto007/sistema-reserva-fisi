/**
 * HU-S03: consultar y filtrar mis solicitudes (reservas, préstamos y conjuntas).
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { estadoSolicitud, tipoSolicitud } from "../helpers/enums";
import { fallar } from "../helpers/errores";
import { checkRole, ROLES_SOLICITANTES } from "../helpers/permisos";
import { conDetalle } from "./comun";

/**
 * Criterios 1 a 3: lista de mis solicitudes, de la más reciente a la más antigua,
 * con filtros por estado, tipo y rango de fechas de uso (fecha de los horarios).
 */
export const mias = query({
  args: {
    token: v.string(),
    estado: v.optional(estadoSolicitud),
    tipo: v.optional(tipoSolicitud),
    desde: v.optional(v.string()),
    hasta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const u = await checkRole(ctx, args.token, ROLES_SOLICITANTES);
    let filas: Doc<"solicitudes">[];
    if (args.estado) {
      filas = await ctx.db.query("solicitudes").withIndex("by_usuario_estado", (q) => q.eq("id_usuario", u._id).eq("estado", args.estado!)).collect();
    } else if (args.tipo) {
      filas = await ctx.db.query("solicitudes").withIndex("by_usuario_tipo", (q) => q.eq("id_usuario", u._id).eq("tipo", args.tipo!)).collect();
    } else {
      filas = await ctx.db.query("solicitudes").withIndex("by_usuario", (q) => q.eq("id_usuario", u._id)).collect();
    }
    if (args.tipo) filas = filas.filter((s) => s.tipo === args.tipo);
    filas.sort((a, b) => b.fecha_creacion - a.fecha_creacion);

    const resultado = [];
    for (const s of filas) {
      const d = await conDetalle(ctx, s);
      if (args.desde && (d.fecha_uso_hasta ?? "") < args.desde) continue;
      if (args.hasta && (d.fecha_uso_desde ?? "9999") > args.hasta) continue;
      resultado.push(d);
    }
    return resultado;
  },
});

/** Criterio 4: detalle de una solicitud propia (horario, prioridad, estado, comentarios). */
export const detalle = query({
  args: { token: v.string(), id: v.id("solicitudes") },
  handler: async (ctx, { token, id }) => {
    const u = await checkRole(ctx, token, ROLES_SOLICITANTES);
    const s = await ctx.db.get(id);
    if (!s || s.id_usuario !== u._id) fallar("NO_ENCONTRADO", "No se encontró la solicitud.");
    return await conDetalle(ctx, s);
  },
});
