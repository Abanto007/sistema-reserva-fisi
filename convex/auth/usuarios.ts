/**
 * Usuarios y roles (RBAC).
 *  - Funciones internas sobre la tabla usuarios: las usan las actions de
 *    auth/acciones.ts, que necesitan bcrypt y no tocan la base de datos directamente.
 *  - HU-U02: panel de validación de personal administrativo (figuras 12 y 13).
 *    Solo un administrativo ya aprobado puede ver, aprobar o rechazar.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { rolUsuario } from "../helpers/enums";
import { fallar } from "../helpers/errores";
import { checkRole, DURACION_SESION_MS } from "../helpers/permisos";
import { validarTextoObligatorio, normalizarCorreo } from "../helpers/validaciones";
import { plantillaValidacion } from "../helpers/plantillas";

export const MAX_INTENTOS = 3;

/** Datos del usuario que sí pueden salir al navegador (nunca hashes). */
export function datosPublicos(u: Doc<"usuarios">) {
  return {
    _id: u._id,
    codigo_dni: u.codigo_dni,
    nombre: u.nombre,
    correo: u.correo,
    rol: u.rol,
    estado_validacion: u.estado_validacion ?? null,
    documento_validacion: u.documento_validacion ?? null,
    fecha_creacion: u.fecha_creacion,
  };
}

async function porCodigo(ctx: QueryCtx, codigo: string) {
  return await ctx.db
    .query("usuarios")
    .withIndex("by_codigo_dni", (q) => q.eq("codigo_dni", codigo))
    .unique();
}

async function porCorreo(ctx: QueryCtx, correo: string) {
  return await ctx.db
    .query("usuarios")
    .withIndex("by_correo", (q) => q.eq("correo", normalizarCorreo(correo)))
    .unique();
}

/** CA-01 (informe): se entra con código universitario, DNI o correo. */
export const buscarPorIdentificador = internalQuery({
  args: { identificador: v.string() },
  handler: async (ctx, { identificador }) => {
    const limpio = identificador.trim();
    if (limpio.includes("@")) return await porCorreo(ctx, limpio);
    return await porCodigo(ctx, limpio);
  },
});

export const buscarPorCodigo = internalQuery({
  args: { codigo_dni: v.string() },
  handler: async (ctx, { codigo_dni }) => await porCodigo(ctx, codigo_dni.trim()),
});

/** Inserta un usuario ya validado por auth.registrar. Aplica los UNIQUE del SQL. */
export const insertar = internalMutation({
  args: {
    codigo_dni: v.string(),
    nombre: v.string(),
    correo: v.string(),
    password_hash: v.string(),
    rol: rolUsuario,
    documento_validacion: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"usuarios">> => {
    // uq_usuarios_codigo_dni y uq_usuarios_correo (CP-03 del informe)
    if (await porCodigo(ctx, args.codigo_dni)) {
      fallar("DUPLICADO", "El código o DNI ya se encuentra registrado.");
    }
    if (await porCorreo(ctx, args.correo)) {
      fallar("DUPLICADO", "El correo electrónico ya se encuentra registrado.");
    }
    const ahora = Date.now();
    const esAdmin = args.rol === "administrativo";
    return await ctx.db.insert("usuarios", {
      codigo_dni: args.codigo_dni,
      nombre: args.nombre,
      correo: normalizarCorreo(args.correo),
      password_hash: args.password_hash,
      rol: args.rol,
      intentos_fallidos: 0,
      bloqueado: false,
      // chk_usuarios_admin_validacion: solo el administrativo lleva datos de validación
      ...(esAdmin ? { documento_validacion: args.documento_validacion, estado_validacion: "pendiente" as const } : {}),
      fecha_creacion: ahora,
      fecha_actualizacion: ahora,
    });
  },
});

/** CA-03 (informe): al tercer intento fallido la cuenta se bloquea. */
export const registrarFallo = internalMutation({
  args: { id: v.id("usuarios") },
  handler: async (ctx, { id }) => {
    const u = await ctx.db.get(id);
    if (!u) return { bloqueado: false, restantes: 0 };
    const intentos = u.intentos_fallidos + 1;
    const bloqueado = intentos >= MAX_INTENTOS;
    await ctx.db.patch(id, { intentos_fallidos: intentos, bloqueado, fecha_actualizacion: Date.now() });
    if (bloqueado) {
      // Una cuenta bloqueada pierde sus sesiones abiertas
      const sesiones = await ctx.db.query("sesiones").withIndex("by_usuario", (q) => q.eq("id_usuario", id)).collect();
      for (const s of sesiones) await ctx.db.delete(s._id);
    }
    return { bloqueado, restantes: Math.max(0, MAX_INTENTOS - intentos) };
  },
});

/** Login correcto: reinicia los intentos y guarda el hash del token de sesión. */
export const crearSesion = internalMutation({
  args: { id: v.id("usuarios"), token_hash: v.string() },
  handler: async (ctx, { id, token_hash }) => {
    const ahora = Date.now();
    await ctx.db.patch(id, { intentos_fallidos: 0, fecha_actualizacion: ahora });
    await ctx.db.insert("sesiones", {
      id_usuario: id,
      token_hash,
      expira: ahora + DURACION_SESION_MS,
      fecha_creacion: ahora,
    });
  },
});

/** CA-05 (informe): OTP de 6 dígitos con 15 minutos de vigencia. Solo se guarda su hash. */
export const guardarOtp = internalMutation({
  args: { id: v.id("usuarios"), otp_hash: v.string(), otp_expira: v.number() },
  handler: async (ctx, { id, otp_hash, otp_expira }) => {
    // chk_usuarios_otp: hash y vencimiento van juntos
    await ctx.db.patch(id, { otp_hash, otp_expira, fecha_actualizacion: Date.now() });
  },
});

/** CA-05 (informe): nueva contraseña, se borra el OTP y la cuenta se desbloquea. */
export const restablecerPassword = internalMutation({
  args: { id: v.id("usuarios"), password_hash: v.string() },
  handler: async (ctx, { id, password_hash }) => {
    await ctx.db.patch(id, {
      password_hash,
      otp_hash: undefined,
      otp_expira: undefined,
      intentos_fallidos: 0,
      bloqueado: false,
      fecha_actualizacion: Date.now(),
    });
    // Por seguridad se cierran las sesiones anteriores
    const sesiones = await ctx.db.query("sesiones").withIndex("by_usuario", (q) => q.eq("id_usuario", id)).collect();
    for (const s of sesiones) await ctx.db.delete(s._id);
  },
});

// ---------------------------------------------------------------------------
// HU-U02: validación de personal administrativo
// ---------------------------------------------------------------------------

/** Criterio 3: lista de registros administrativos en espera, los más antiguos primero. */
export const pendientes = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await checkRole(ctx, token, ["administrativo"]);
    const filas = await ctx.db
      .query("usuarios")
      .withIndex("by_estado_validacion", (q) => q.eq("estado_validacion", "pendiente"))
      .order("asc")
      .collect();
    return filas.map(datosPublicos);
  },
});

async function postulantePendiente(ctx: MutationCtx, id: Id<"usuarios">, adminId: Id<"usuarios">) {
  const u = await ctx.db.get(id);
  if (!u || u.rol !== "administrativo") fallar("NO_ENCONTRADO", "No se encontró la solicitud de registro.");
  if (u.estado_validacion !== "pendiente") fallar("CONFLICTO", "Esta solicitud ya fue procesada por otro administrador.");
  // chk_usuarios_no_autovalidacion
  if (u._id === adminId) fallar("SIN_PERMISO", "No puedes validar tu propia cuenta.");
  return u;
}

/** Criterio 4: al aprobar, el usuario obtiene el rol administrativo y se le avisa por correo. */
export const aprobar = mutation({
  args: { token: v.string(), id: v.id("usuarios") },
  handler: async (ctx, { token, id }) => {
    const admin = await checkRole(ctx, token, ["administrativo"]);
    const u = await postulantePendiente(ctx, id, admin._id);
    const ahora = Date.now();
    await ctx.db.patch(id, {
      estado_validacion: "aprobado",
      comentario_validacion: undefined,
      fecha_validacion: ahora,
      validado_por: admin._id,
      fecha_actualizacion: ahora,
    });
    const correo = plantillaValidacion(u.nombre, true);
    await ctx.scheduler.runAfter(0, internal.helpers.correo.enviar, { para: u.correo, ...correo });
    return { nombre: u.nombre };
  },
});

/** Criterio 5: el rechazo exige motivo, se guarda y se notifica por correo. */
export const rechazar = mutation({
  args: { token: v.string(), id: v.id("usuarios"), motivo: v.string() },
  handler: async (ctx, { token, id, motivo }) => {
    const admin = await checkRole(ctx, token, ["administrativo"]);
    // chk_usuarios_rechazo_con_motivo
    const comentario = validarTextoObligatorio(motivo, "Motivo del rechazo");
    const u = await postulantePendiente(ctx, id, admin._id);
    const ahora = Date.now();
    await ctx.db.patch(id, {
      estado_validacion: "rechazado",
      comentario_validacion: comentario,
      fecha_validacion: ahora,
      validado_por: admin._id,
      fecha_actualizacion: ahora,
    });
    const correo = plantillaValidacion(u.nombre, false, comentario);
    await ctx.scheduler.runAfter(0, internal.helpers.correo.enviar, { para: u.correo, ...correo });
    return { nombre: u.nombre };
  },
});
