/**
 * Equipos de la FISI (tabla objetos): proyectores, micrófonos, laptops.
 * Cada equipo tiene un stock: varias personas pueden pedirlo en el mismo bloque
 * hasta agotar las unidades. La gestión del catálogo queda para la iteración 3.
 */
import { v } from "convex/values";
import { query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { checkRole, puedeUsar, ROLES_SOLICITANTES, withAuth } from "../helpers/permisos";

/** Estados en los que una solicitud sigue reteniendo sus horarios. */
export const ESTADOS_ACTIVOS: Doc<"solicitudes">["estado"][] = ["pendiente", "recibida", "aceptada"];

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre);

/** Unidades de un bloque de equipo ya comprometidas en solicitudes activas. */
export async function unidadesOcupadas(ctx: QueryCtx, id_horario: Id<"horarios">, excluirSolicitud?: Id<"solicitudes">) {
  const prestamos = await ctx.db.query("prestamos").withIndex("by_horario", (q) => q.eq("id_horario", id_horario)).collect();
  let total = 0;
  for (const p of prestamos) {
    if (p.id_solicitud === excluirSolicitud) continue;
    const s = await ctx.db.get(p.id_solicitud);
    if (s && ESTADOS_ACTIVOS.includes(s.estado)) total += p.cantidad;
  }
  return total;
}

/** Catálogo completo de equipos (lo usa la gestión de horarios, H01/H02). */
export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await withAuth(ctx, token);
    return (await ctx.db.query("objetos").collect()).sort(porNombre);
  },
});

/** Equipos que el usuario puede pedir según su rol (S02). */
export const disponibles = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const u = await checkRole(ctx, token, ROLES_SOLICITANTES);
    return (await ctx.db.query("objetos").collect()).filter((o) => puedeUsar(o, u.rol)).sort(porNombre);
  },
});
