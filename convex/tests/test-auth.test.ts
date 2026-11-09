/**
 * HU-U01 — mismas pruebas que test-auth.js del informe (CP-02 a CP-06).
 */
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { DOCENTE, esperarError, nuevoEntorno } from "./utilidades.helper";

describe("HU-U01: autenticación y OTP", () => {
  test("CP-02: registro de usuario válido", async () => {
    const t = nuevoEntorno();
    const r = await t.action(api.auth.acciones.registrar, DOCENTE);
    expect(r.estado).toBe("activo");
    await t.run(async (ctx) => {
      const u = (await ctx.db.query("usuarios").collect())[0];
      expect(u.correo).toBe("estudiante_5871@unmsm.edu.pe"); // se normaliza a minúsculas
      expect(u.password_hash).not.toBe(DOCENTE.password); // nunca en texto plano
      expect(u.estado_validacion).toBeUndefined();
    });
  });

  test("CP-02b: datos inválidos se rechazan", async () => {
    const t = nuevoEntorno();
    await esperarError(t.action(api.auth.acciones.registrar, { ...DOCENTE, codigo_dni: "12" }), "DATOS_INVALIDOS");
    await esperarError(t.action(api.auth.acciones.registrar, { ...DOCENTE, correo: "no-es-correo" }), "DATOS_INVALIDOS");
    await esperarError(t.action(api.auth.acciones.registrar, { ...DOCENTE, password: "123" }), "DATOS_INVALIDOS");
  });

  test("CP-03: no se permiten duplicados por DNI o correo", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    await esperarError(t.action(api.auth.acciones.registrar, { ...DOCENTE, correo: "otro@unmsm.edu.pe" }), "DUPLICADO");
    await esperarError(t.action(api.auth.acciones.registrar, { ...DOCENTE, codigo_dni: "99999999", correo: "ESTUDIANTE_5871@UNMSM.EDU.PE" }), "DUPLICADO");
  });

  test("CP-04: login con código, DNI o correo devuelve token y perfil", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    const porCodigo = await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: DOCENTE.password });
    const porCorreo = await t.action(api.auth.acciones.iniciarSesion, { identificador: "estudiante_5871@unmsm.edu.pe", password: DOCENTE.password });
    expect(porCodigo.token).toHaveLength(64);
    expect(porCorreo.usuario.rol).toBe("docente");
    expect(porCorreo.usuario).not.toHaveProperty("password_hash");
    const yo = await t.query(api.auth.acciones.yo, { token: porCodigo.token });
    expect(yo?.nombre).toBe(DOCENTE.nombre);
    // TEST 4 del informe: cerrar sesión invalida el token
    await t.mutation(api.auth.acciones.cerrarSesion, { token: porCodigo.token });
    expect(await t.query(api.auth.acciones.yo, { token: porCodigo.token })).toBeNull();
  });

  test("CP-05: la cuenta se bloquea al tercer intento fallido", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    const login = (password: string) => t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password });
    const e1 = await esperarError(login("mala1"), "CREDENCIALES");
    expect(e1.detalle).toContain("2 intentos");
    const e2 = await esperarError(login("mala2"), "CREDENCIALES");
    expect(e2.detalle).toContain("1 intento");
    await esperarError(login("mala3"), "BLOQUEADA");
    // Ni con la contraseña correcta entra
    await esperarError(login(DOCENTE.password), "BLOQUEADA");
  });

  test("CP-05b: un login correcto reinicia el contador", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    const login = (password: string) => t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password });
    await esperarError(login("mala1"), "CREDENCIALES");
    await esperarError(login("mala2"), "CREDENCIALES");
    await login(DOCENTE.password);
    const e = await esperarError(login("mala3"), "CREDENCIALES");
    expect(e.detalle).toContain("2 intentos");
  });

  test("CP-06: doble factor, OTP y desbloqueo", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    for (const p of ["a1", "a2", "a3"]) {
      await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: p }).catch(() => {});
    }
    // CA-04: correo que no corresponde al DNI -> rechazado
    await esperarError(t.action(api.auth.acciones.solicitarCodigo, { codigo_dni: DOCENTE.codigo_dni, correo: "intruso@gmail.com" }), "NO_COINCIDE");

    const r = await t.action(api.auth.acciones.solicitarCodigo, { codigo_dni: DOCENTE.codigo_dni, correo: DOCENTE.correo });
    expect(r.correo).toBe("e***1@unmsm.edu.pe");

    // Para la prueba se reemplaza el OTP por uno conocido (el real solo viaja por correo)
    const bcrypt = (await import("bcryptjs")).default;
    await t.run(async (ctx) => {
      const u = (await ctx.db.query("usuarios").collect())[0];
      expect(u.otp_hash).toBeDefined();
      expect(u.otp_expira! - Date.now()).toBeGreaterThan(14 * 60 * 1000);
      await ctx.db.patch(u._id, { otp_hash: await bcrypt.hash("123456", 4) });
    });

    await esperarError(t.action(api.auth.acciones.restablecer, { codigo_dni: DOCENTE.codigo_dni, otp: "000000", password: "nueva123" }), "OTP_INVALIDO");
    await t.action(api.auth.acciones.restablecer, { codigo_dni: DOCENTE.codigo_dni, otp: "123456", password: "nueva123" });

    await t.run(async (ctx) => {
      const u = (await ctx.db.query("usuarios").collect())[0];
      expect(u.bloqueado).toBe(false);
      expect(u.intentos_fallidos).toBe(0);
      expect(u.otp_hash).toBeUndefined();
    });
    // TEST 9 del informe: reingreso con la nueva contraseña
    const login = await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: "nueva123" });
    expect(login.token).toBeTruthy();
    // El OTP ya no sirve una segunda vez
    await esperarError(t.action(api.auth.acciones.restablecer, { codigo_dni: DOCENTE.codigo_dni, otp: "123456", password: "otra123" }), "OTP_INVALIDO");
  });

  test("CP-06b: el OTP vence a los 15 minutos", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    await t.action(api.auth.acciones.solicitarCodigo, { codigo_dni: DOCENTE.codigo_dni, correo: DOCENTE.correo });
    await t.run(async (ctx) => {
      const u = (await ctx.db.query("usuarios").collect())[0];
      await ctx.db.patch(u._id, { otp_expira: Date.now() - 1 });
    });
    await esperarError(t.action(api.auth.acciones.restablecer, { codigo_dni: DOCENTE.codigo_dni, otp: "123456", password: "nueva123" }), "OTP_VENCIDO");
  });
});
