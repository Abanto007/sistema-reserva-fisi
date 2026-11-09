/// <reference types="vite/client" />
/**
 * Fase 0: base del proyecto.
 *  - CP-01 del informe: el servicio responde OK.
 *  - Datos semilla: admin superior aprobado, espacios, equipos y horarios, sin duplicar.
 *  - withAuth / checkRole: control de acceso por token y rol.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";
import { checkRole, DURACION_SESION_MS, hashToken, withAuth } from "../helpers/permisos";

const modules = import.meta.glob("../**/!(*.*.*)*.*s");

async function crearSesion(t: ReturnType<typeof convexTest>, datos: Record<string, unknown>) {
  const token = "token-de-prueba-" + Math.random();
  const token_hash = await hashToken(token);
  await t.run(async (ctx) => {
    const ahora = Date.now();
    const id = await ctx.db.insert("usuarios", {
      codigo_dni: "20200123",
      nombre: "Usuario Prueba",
      correo: "prueba@unmsm.edu.pe",
      password_hash: "x",
      rol: "alumno",
      intentos_fallidos: 0,
      bloqueado: false,
      fecha_creacion: ahora,
      fecha_actualizacion: ahora,
      ...datos,
    } as never);
    await ctx.db.insert("sesiones", { id_usuario: id, token_hash, expira: ahora + DURACION_SESION_MS, fecha_creacion: ahora });
  });
  return token;
}

describe("Fase 0", () => {
  test("CP-01: el servicio responde OK", async () => {
    const t = convexTest(schema, modules);
    const r = await t.query(api.sistema.salud, {});
    expect(r.status).toBe("OK");
  });

  test("la semilla crea admin, recursos y horarios sin duplicar", async () => {
    const t = convexTest(schema, modules);
    await t.action(api.seed.sembrar, {});
    await t.action(api.seed.sembrar, {}); // segunda vez: no duplica
    await t.run(async (ctx) => {
      const usuarios = await ctx.db.query("usuarios").collect();
      expect(usuarios).toHaveLength(1);
      expect(usuarios[0].rol).toBe("administrativo");
      expect(usuarios[0].estado_validacion).toBe("aprobado");
      expect(usuarios[0].password_hash).not.toBe("Admin123");
      expect(await ctx.db.query("lugares").collect()).toHaveLength(5);
      expect(await ctx.db.query("objetos").collect()).toHaveLength(5);
      const horarios = await ctx.db.query("horarios").collect();
      expect(horarios).toHaveLength(14 * 4 * 10);
      // Arco exclusivo: cada bloque es de un lugar O de un objeto
      expect(horarios.every((h) => (h.id_lugar ? 1 : 0) + (h.id_objeto ? 1 : 0) === 1)).toBe(true);
    });
  });

  test("withAuth rechaza un token inválido y acepta uno válido", async () => {
    const t = convexTest(schema, modules);
    const token = await crearSesion(t, {});
    await t.run(async (ctx) => {
      await expect(withAuth(ctx, "no-existe")).rejects.toThrow(/sesión/);
      const u = await withAuth(ctx, token);
      expect(u.codigo_dni).toBe("20200123");
    });
  });

  test("checkRole: un alumno no entra a funciones de administrativo", async () => {
    const t = convexTest(schema, modules);
    const token = await crearSesion(t, {});
    await t.run(async (ctx) => {
      await expect(checkRole(ctx, token, ["administrativo"])).rejects.toThrow(/permisos/);
    });
  });

  test("checkRole: un administrativo pendiente todavía no tiene permisos", async () => {
    const t = convexTest(schema, modules);
    const token = await crearSesion(t, {
      rol: "administrativo",
      documento_validacion: "ADM-FISI-1234",
      estado_validacion: "pendiente",
    });
    await t.run(async (ctx) => {
      await expect(checkRole(ctx, token, ["administrativo"])).rejects.toThrow(/validada/);
    });
  });
});
