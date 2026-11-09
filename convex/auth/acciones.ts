/**
 * HU-U01: registro, inicio de sesión, bloqueo por intentos y recuperación con OTP.
 * HU-U02: el registro administrativo exige código de trabajador y queda pendiente.
 *
 * Las operaciones con contraseñas son actions (bcrypt es lento y necesita
 * aleatoriedad segura); leen y escriben la BD mediante las funciones internas
 * de auth/usuarios.ts.
 */
import bcrypt from "bcryptjs";
import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { rolUsuario } from "../helpers/enums";
import { fallar } from "../helpers/errores";
import { hashToken, usuarioDeToken } from "../helpers/permisos";
import { MIN_PASSWORD, normalizarCorreo, validarCodigoDni, validarCorreo, validarTextoObligatorio } from "../helpers/validaciones";
import { datosPublicos } from "./usuarios";
import { Doc } from "../_generated/dataModel";

type UsuarioPublico = ReturnType<typeof datosPublicos>;
import { plantillaOtp } from "../helpers/plantillas";

const RONDAS_BCRYPT = 10;
const VIGENCIA_OTP_MS = 15 * 60 * 1000;

function tokenAleatorio(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function otpAleatorio(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}

/** "estudiante_5871@unmsm.edu.pe" -> "e***1@unmsm.edu.pe" (figura 7 del informe) */
export function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio || usuario.length === 0) return correo;
  const ultimo = usuario.length > 1 ? usuario.at(-1) : "";
  return `${usuario[0]}***${ultimo}@${dominio}`;
}

function validarPassword(password: string) {
  if (password.length < MIN_PASSWORD) {
    fallar("DATOS_INVALIDOS", `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
}

// ---------------------------------------------------------------------------
// Registro (CA-02 del informe / HU-U02 criterios 1 y 2)
// ---------------------------------------------------------------------------
export const registrar = action({
  args: {
    codigo_dni: v.string(),
    nombre: v.string(),
    correo: v.string(),
    password: v.string(),
    rol: rolUsuario,
    documento_validacion: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ estado: "activo" | "pendiente" }> => {
    const codigo_dni = validarCodigoDni(args.codigo_dni);
    const nombre = validarTextoObligatorio(args.nombre, "Nombre Completo");
    const correo = validarCorreo(args.correo);
    validarPassword(args.password);

    let documento_validacion: string | undefined;
    if (args.rol === "administrativo") {
      // HU-U02 criterio 1 (CP-07): sin código de trabajador no hay registro
      documento_validacion = validarTextoObligatorio(args.documento_validacion, "Código de Trabajador / Documento");
    }

    const password_hash = await bcrypt.hash(args.password, RONDAS_BCRYPT);
    await ctx.runMutation(internal.auth.usuarios.insertar, {
      codigo_dni,
      nombre,
      correo,
      password_hash,
      rol: args.rol,
      documento_validacion,
    });
    return { estado: args.rol === "administrativo" ? "pendiente" : "activo" };
  },
});

// ---------------------------------------------------------------------------
// Inicio de sesión (CA-01, CA-03 / HU-U02 criterios 2 y 5)
// ---------------------------------------------------------------------------
export const iniciarSesion = action({
  args: { identificador: v.string(), password: v.string() },
  handler: async (ctx, { identificador, password }): Promise<{ token: string; usuario: UsuarioPublico }> => {
    if (!identificador.trim() || !password) {
      fallar("DATOS_INVALIDOS", "Ingresa tu código, DNI o correo y tu contraseña.");
    }
    const usuario: Doc<"usuarios"> | null = await ctx.runQuery(internal.auth.usuarios.buscarPorIdentificador, { identificador });
    if (!usuario) fallar("CREDENCIALES", "Usuario o contraseña incorrectos.");

    if (usuario.bloqueado) {
      fallar("BLOQUEADA", "Cuenta bloqueada por superar los 3 intentos fallidos. Utilice la opción de recuperación de contraseña.");
    }

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      const { bloqueado, restantes }: { bloqueado: boolean; restantes: number } = await ctx.runMutation(internal.auth.usuarios.registrarFallo, { id: usuario._id });
      if (bloqueado) {
        fallar("BLOQUEADA", "Cuenta bloqueada por superar los 3 intentos fallidos. Utilice la opción de recuperación de contraseña.");
      }
      fallar(
        "CREDENCIALES",
        "Usuario o contraseña incorrectos.",
        `Te ${restantes === 1 ? "queda 1 intento" : `quedan ${restantes} intentos`} antes de que la cuenta se bloquee.`,
      );
    }

    if (usuario.rol === "administrativo") {
      if (usuario.estado_validacion === "pendiente") {
        fallar(
          "PENDIENTE",
          "Tu cuenta administrativa se encuentra en estado PENDIENTE de validación por un administrador superior.",
        );
      }
      if (usuario.estado_validacion === "rechazado") {
        fallar(
          "RECHAZADA",
          "Tu solicitud de cuenta administrativa fue rechazada.",
          usuario.comentario_validacion ?? undefined,
        );
      }
    }

    const token = tokenAleatorio();
    await ctx.runMutation(internal.auth.usuarios.crearSesion, { id: usuario._id, token_hash: await hashToken(token) });
    return { token, usuario: datosPublicos(usuario) };
  },
});

/** Usuario de la sesión actual, o null si el token no es válido. */
export const yo = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const usuario = await usuarioDeToken(ctx, token);
    return usuario ? datosPublicos(usuario) : null;
  },
});

/** Cierre de sesión (TEST 4 del informe): invalida el token en el servidor. */
export const cerrarSesion = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hash = await hashToken(token);
    const sesion = await ctx.db
      .query("sesiones")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", hash))
      .unique();
    if (sesion) await ctx.db.delete(sesion._id);
  },
});

// ---------------------------------------------------------------------------
// Recuperación de contraseña (CA-04 y CA-05 del informe)
// ---------------------------------------------------------------------------
export const solicitarCodigo = action({
  args: { codigo_dni: v.string(), correo: v.string() },
  handler: async (ctx, args): Promise<{ correo: string; vistaPrevia: string | null }> => {
    const codigo = args.codigo_dni.trim();
    if (!codigo || !args.correo.trim()) fallar("DATOS_INVALIDOS", "Ingresa tu código o DNI y tu correo.");
    const usuario: Doc<"usuarios"> | null = await ctx.runQuery(internal.auth.usuarios.buscarPorCodigo, { codigo_dni: codigo });
    // CA-04: doble factor. Si el correo no coincide con el del DNI, se rechaza.
    if (!usuario || usuario.correo !== normalizarCorreo(args.correo)) {
      fallar("NO_COINCIDE", "Los datos ingresados no coinciden con ninguna cuenta registrada.");
    }

    const otp = otpAleatorio();
    await ctx.runMutation(internal.auth.usuarios.guardarOtp, {
      id: usuario._id,
      otp_hash: await bcrypt.hash(otp, RONDAS_BCRYPT),
      otp_expira: Date.now() + VIGENCIA_OTP_MS,
    });

    const { asunto, html, texto } = plantillaOtp(usuario.nombre, otp);
    const envio: { enviado: boolean; vistaPrevia: string | null } = await ctx.runAction(internal.helpers.correo.enviar, { para: usuario.correo, asunto, html, texto });
    return { correo: enmascararCorreo(usuario.correo), vistaPrevia: envio.vistaPrevia };
  },
});

export const restablecer = action({
  args: { codigo_dni: v.string(), otp: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const usuario: Doc<"usuarios"> | null = await ctx.runQuery(internal.auth.usuarios.buscarPorCodigo, { codigo_dni: args.codigo_dni.trim() });
    if (!usuario || !usuario.otp_hash || !usuario.otp_expira) {
      fallar("OTP_INVALIDO", "No hay un código de seguridad vigente. Solicita uno nuevo.");
    }
    if (usuario.otp_expira < Date.now()) {
      fallar("OTP_VENCIDO", "El código de seguridad venció (15 minutos). Solicita uno nuevo.");
    }
    if (!/^\d{6}$/.test(args.otp.trim()) || !(await bcrypt.compare(args.otp.trim(), usuario.otp_hash))) {
      fallar("OTP_INVALIDO", "El código de seguridad es incorrecto.");
    }
    validarPassword(args.password);
    await ctx.runMutation(internal.auth.usuarios.restablecerPassword, {
      id: usuario._id,
      password_hash: await bcrypt.hash(args.password, RONDAS_BCRYPT),
    });
    return { ok: true };
  },
});
