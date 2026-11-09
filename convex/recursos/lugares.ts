/**
 * Espacios de la FISI (tabla lugares): auditorios, laboratorios, salas.
 * La gestión del catálogo (crear, editar, desactivar) queda para la iteración 3
 * (HU-H03 propuesta); por ahora el catálogo lo carga `pnpm seed`.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { checkRole, puedeUsar, ROLES_SOLICITANTES, withAuth } from "../helpers/permisos";

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre);

/** Catálogo completo de espacios (lo usa la gestión de horarios, H01/H02). */
export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await withAuth(ctx, token);
    return (await ctx.db.query("lugares").collect()).sort(porNombre);
  },
});

/** Espacios que el usuario puede reservar según su rol (S01). */
export const disponibles = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const u = await checkRole(ctx, token, ROLES_SOLICITANTES);
    return (await ctx.db.query("lugares").collect()).filter((l) => puedeUsar(l, u.rol)).sort(porNombre);
  },
});
