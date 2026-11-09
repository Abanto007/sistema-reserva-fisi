/**
 * Control de acceso (RBAC) descrito en el documento de arquitectura:
 * withAuth resuelve el usuario a partir del token de sesión y checkRole
 * exige un rol. Todas las queries y mutations privadas los usan.
 */
import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { fallar } from "./errores";
import { RolUsuario } from "./enums";

export const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // 8 horas, como el JWT del informe

/** SHA-256 en hexadecimal. Solo se guarda el hash del token, nunca el token. */
export async function hashToken(token: string): Promise<string> {
  const datos = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Devuelve el usuario dueño del token o null si no hay sesión válida. */
export async function usuarioDeToken(
  ctx: QueryCtx,
  token: string | undefined | null,
): Promise<Doc<"usuarios"> | null> {
  if (!token) return null;
  const hash = await hashToken(token);
  const fila = await ctx.db
    .query("sesiones")
    .withIndex("by_token_hash", (q) => q.eq("token_hash", hash))
    .unique();
  if (!fila || fila.expira < Date.now()) return null;
  const usuario = await ctx.db.get(fila.id_usuario);
  if (!usuario || usuario.bloqueado) return null;
  return usuario;
}

/** withAuth: exige una sesión válida. */
export async function withAuth(ctx: QueryCtx, token: string | undefined | null) {
  const usuario = await usuarioDeToken(ctx, token);
  if (!usuario) fallar("SIN_SESION", "Tu sesión expiró. Vuelve a iniciar sesión.");
  return usuario;
}

/**
 * checkRole: exige sesión y uno de los roles indicados. Un administrativo
 * solo cuenta como tal si su validación fue aprobada (HU-U02).
 */
export async function checkRole(
  ctx: QueryCtx,
  token: string | undefined | null,
  roles: RolUsuario[],
) {
  const usuario = await withAuth(ctx, token);
  if (!roles.includes(usuario.rol)) {
    fallar("SIN_PERMISO", "No tienes permisos para realizar esta acción.");
  }
  if (usuario.rol === "administrativo" && usuario.estado_validacion !== "aprobado") {
    fallar("SIN_PERMISO", "Tu cuenta administrativa aún no ha sido validada.");
  }
  return usuario;
}

/** Roles que envían solicitudes. El administrativo no pide: solo gestiona. */
export const ROLES_SOLICITANTES: RolUsuario[] = ["alumno", "docente", "foraneo", "externo"];

/** Un recurso se puede pedir si está activo y su roles_permitidos incluye el rol del usuario. */
export function puedeUsar(recurso: Doc<"lugares"> | Doc<"objetos">, rol: RolUsuario) {
  return recurso.estado === "activo" && recurso.roles_permitidos.includes(rol);
}
