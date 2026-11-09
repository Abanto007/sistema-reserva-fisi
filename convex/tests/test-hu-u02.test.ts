/**
 * HU-U02 — mismas pruebas que test-hu-u02.js del informe (CP-07 a CP-11).
 */
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { DOCENTE, POSTULANTE, esperarError, loginAdminSuperior, nuevoEntorno } from "./utilidades.helper";

describe("HU-U02: validación de personal administrativo", () => {
  test("CP-07: registro administrativo sin código de trabajador es rechazado", async () => {
    const t = nuevoEntorno();
    await esperarError(t.action(api.auth.acciones.registrar, { ...POSTULANTE, documento_validacion: undefined }), "DATOS_INVALIDOS");
    await esperarError(t.action(api.auth.acciones.registrar, { ...POSTULANTE, documento_validacion: "   " }), "DATOS_INVALIDOS");
  });

  test("CP-08: registro con código queda PENDIENTE y el login se bloquea", async () => {
    const t = nuevoEntorno();
    const r = await t.action(api.auth.acciones.registrar, POSTULANTE);
    expect(r.estado).toBe("pendiente");
    const e = await esperarError(
      t.action(api.auth.acciones.iniciarSesion, { identificador: POSTULANTE.codigo_dni, password: POSTULANTE.password }),
      "PENDIENTE",
    );
    expect(e.mensaje).toContain("PENDIENTE");
  });

  test("CP-09: alumnos y docentes no acceden a funciones de administrador", async () => {
    const t = nuevoEntorno();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    const { token } = await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: DOCENTE.password });
    await esperarError(t.query(api.auth.usuarios.pendientes, { token }), "SIN_PERMISO");
    await esperarError(t.query(api.auth.usuarios.pendientes, { token: "inventado" }), "SIN_SESION");
  });

  test("CP-10: el administrador aprueba y el usuario aprobado inicia sesión", async () => {
    const t = nuevoEntorno();
    const token = await loginAdminSuperior(t);
    await t.action(api.auth.acciones.registrar, POSTULANTE);
    const lista = await t.query(api.auth.usuarios.pendientes, { token });
    expect(lista).toHaveLength(1);
    expect(lista[0].documento_validacion).toBe("ADM-FISI-8588");

    const r = await t.mutation(api.auth.usuarios.aprobar, { token, id: lista[0]._id });
    expect(r.nombre).toBe(POSTULANTE.nombre);
    expect(await t.query(api.auth.usuarios.pendientes, { token })).toHaveLength(0);
    // No se puede procesar dos veces
    await esperarError(t.mutation(api.auth.usuarios.aprobar, { token, id: lista[0]._id }), "CONFLICTO");

    const login = await t.action(api.auth.acciones.iniciarSesion, { identificador: POSTULANTE.correo, password: POSTULANTE.password });
    expect(login.usuario.rol).toBe("administrativo");
    expect(login.usuario.estado_validacion).toBe("aprobado");
    // El nuevo administrativo ya puede usar el panel
    expect(await t.query(api.auth.usuarios.pendientes, { token: login.token })).toHaveLength(0);
    await t.run(async (ctx) => {
      const u = await ctx.db.get(lista[0]._id);
      expect(u?.validado_por).toBeDefined();
      expect(u?.fecha_validacion).toBeDefined();
    });
  });

  test("CP-11: rechazo motivado y motivo visible al intentar entrar", async () => {
    const t = nuevoEntorno();
    const token = await loginAdminSuperior(t);
    await t.action(api.auth.acciones.registrar, POSTULANTE);
    const [p] = await t.query(api.auth.usuarios.pendientes, { token });
    await esperarError(t.mutation(api.auth.usuarios.rechazar, { token, id: p._id, motivo: "  " }), "DATOS_INVALIDOS");
    await t.mutation(api.auth.usuarios.rechazar, { token, id: p._id, motivo: "El código ADM-FISI-8588 no figura en planilla." });
    const e = await esperarError(
      t.action(api.auth.acciones.iniciarSesion, { identificador: POSTULANTE.codigo_dni, password: POSTULANTE.password }),
      "RECHAZADA",
    );
    expect(e.detalle).toBe("El código ADM-FISI-8588 no figura en planilla.");
  });
});
