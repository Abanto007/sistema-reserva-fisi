/**
 * Pruebas de HU-H01 (creación de horarios) y HU-H02 (gestión de disponibilidad).
 */
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { diaSemana, hoyLima, sumarDias } from "../helpers/fechas";
import { DOCENTE, Entorno, esperarError, loginAdminSuperior, nuevoEntorno } from "./utilidades.helper";

// Fechas fuera de los 14 días hábiles que siembra seed.ts
const BASE = sumarDias(hoyLima(), 40);
const ANTES = sumarDias(hoyLima(), -1);

async function preparar() {
  const t = nuevoEntorno();
  const token = await loginAdminSuperior(t);
  const lugares = await t.query(api.recursos.lugares.listar, { token });
  const objetos = await t.query(api.recursos.objetos.listar, { token });
  return { t, token, auditorio: lugares[0]._id, proyector: objetos[0]._id };
}

async function bloquesDe(t: Entorno, token: string, desde: string, hasta: string) {
  return await t.query(api.recursos.horarios.calendario, { token, desde, hasta });
}

describe("HU-H01: creación de horarios", () => {
  test("CP-H01-1: crea un bloque disponible de inmediato para un espacio", async () => {
    const { t, token, auditorio } = await preparar();
    const r = await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    expect(r.creados).toBe(1);
    const bloques = await bloquesDe(t, token, BASE, BASE);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ id_lugar: auditorio, hora_inicio: "18:00", hora_fin: "20:00", estado: "disponible" });
  });

  test("CP-H01-2: crea horarios recurrentes (lunes y miércoles durante 4 semanas)", async () => {
    const { t, token, proyector } = await preparar();
    const hasta = sumarDias(BASE, 27);
    const r = await t.mutation(api.recursos.horarios.crear, {
      token,
      id_objeto: proyector,
      fecha: BASE,
      hora_inicio: "08:00",
      hora_fin: "12:00",
      repetir: { dias: [1, 3], hasta },
    });
    expect(r.creados).toBe(8);
    expect(r.fechas.every((f) => [1, 3].includes(diaSemana(f)))).toBe(true);
    const bloques = await bloquesDe(t, token, BASE, hasta);
    expect(bloques.filter((b) => b.id_objeto === proyector)).toHaveLength(8);
  });

  test("CP-H01-3: rechaza bloques duplicados o superpuestos del mismo recurso", async () => {
    const { t, token, auditorio } = await preparar();
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    await esperarError(t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" }), "CONFLICTO");
    const e = await esperarError(
      t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "19:00", hora_fin: "21:00" }),
      "CONFLICTO",
    );
    expect(e.detalle).toContain("18:00–20:00");
    // Bloques contiguos sí se permiten
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "20:00", hora_fin: "22:00" });
  });

  test("CP-H01-3b: una serie con un solo cruce no crea ningún bloque", async () => {
    const { t, token, auditorio } = await preparar();
    const choque = sumarDias(BASE, 7);
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: choque, hora_inicio: "18:00", hora_fin: "19:00" });
    await esperarError(
      t.mutation(api.recursos.horarios.crear, {
        token,
        id_lugar: auditorio,
        fecha: BASE,
        hora_inicio: "18:00",
        hora_fin: "20:00",
        repetir: { dias: [diaSemana(BASE)], hasta: sumarDias(BASE, 21) },
      }),
      "CONFLICTO",
    );
    const bloques = await bloquesDe(t, token, BASE, sumarDias(BASE, 21));
    expect(bloques).toHaveLength(1);
  });

  test("CP-H01-3c: el mismo horario en otro recurso no es cruce", async () => {
    const { t, token, auditorio, proyector } = await preparar();
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    await t.mutation(api.recursos.horarios.crear, { token, id_objeto: proyector, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    expect(await bloquesDe(t, token, BASE, BASE)).toHaveLength(2);
  });

  test("CP-H01-4: valida fechas, horas y recurso", async () => {
    const { t, token, auditorio, proyector } = await preparar();
    const base = { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "10:00", hora_fin: "12:00" };
    await esperarError(t.mutation(api.recursos.horarios.crear, { ...base, fecha: ANTES }), "DATOS_INVALIDOS");
    await esperarError(t.mutation(api.recursos.horarios.crear, { ...base, hora_fin: "09:00" }), "DATOS_INVALIDOS");
    await esperarError(t.mutation(api.recursos.horarios.crear, { ...base, hora_inicio: "06:00" }), "DATOS_INVALIDOS");
    await esperarError(t.mutation(api.recursos.horarios.crear, { ...base, id_objeto: proyector }), "DATOS_INVALIDOS");
    await esperarError(t.mutation(api.recursos.horarios.crear, { ...base, repetir: { dias: [], hasta: sumarDias(BASE, 7) } }), "DATOS_INVALIDOS");
  });

  test("CP-H01-6: solo el personal administrativo aprobado gestiona horarios", async () => {
    const { t, auditorio } = await preparar();
    await t.action(api.auth.acciones.registrar, DOCENTE);
    const { token } = await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: DOCENTE.password });
    await esperarError(
      t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" }),
      "SIN_PERMISO",
    );
    await esperarError(t.query(api.recursos.horarios.calendario, { token, desde: BASE, hasta: BASE }), "SIN_PERMISO");
  });

  test("CP-H01-5: edita y elimina un bloque libre, pero no uno reservado", async () => {
    const { t, token, auditorio } = await preparar();
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    const [bloque] = await bloquesDe(t, token, BASE, BASE);

    await t.mutation(api.recursos.horarios.editar, { token, id: bloque._id, fecha: BASE, hora_inicio: "17:00", hora_fin: "19:00" });
    expect((await bloquesDe(t, token, BASE, BASE))[0]).toMatchObject({ hora_inicio: "17:00", hora_fin: "19:00" });

    // Simula una solicitud sobre el bloque (S01 llega en la Fase 3)
    await t.run(async (ctx) => {
      const usuario = (await ctx.db.query("usuarios").first())!;
      const id_solicitud = await ctx.db.insert("solicitudes", {
        id_usuario: usuario._id,
        tipo: "reserva",
        prioridad: "normal",
        estado: "pendiente",
        motivo: "Prueba",
        monto_total: 0,
        fecha_creacion: Date.now(),
        fecha_actualizacion: Date.now(),
      });
      await ctx.db.insert("reservas", { id_solicitud, id_horario: bloque._id as Id<"horarios">, id_lugar: auditorio });
      await ctx.db.patch(bloque._id, { estado: "ocupado" });
    });
    await esperarError(t.mutation(api.recursos.horarios.editar, { token, id: bloque._id, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" }), "CONFLICTO");
    await esperarError(t.mutation(api.recursos.horarios.eliminar, { token, id: bloque._id }), "CONFLICTO");
    expect((await bloquesDe(t, token, BASE, BASE))[0].solicitante?.nombre).toBe("Carlos Admin FISI");

    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "20:00", hora_fin: "21:00" });
    const libre = (await bloquesDe(t, token, BASE, BASE)).find((b) => b.hora_inicio === "20:00")!;
    await t.mutation(api.recursos.horarios.eliminar, { token, id: libre._id });
    expect(await bloquesDe(t, token, BASE, BASE)).toHaveLength(1);
  });
});

describe("HU-H02: gestión de horarios disponibles", () => {
  test("CP-H02-1: marca un bloque como no disponible con motivo obligatorio", async () => {
    const { t, token, auditorio } = await preparar();
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    const [bloque] = await bloquesDe(t, token, BASE, BASE);
    await esperarError(t.mutation(api.recursos.horarios.marcarNoDisponible, { token, id: bloque._id, motivo: "  " }), "DATOS_INVALIDOS");
    await t.mutation(api.recursos.horarios.marcarNoDisponible, { token, id: bloque._id, motivo: "Mantenimiento del proyector fijo" });
    expect((await bloquesDe(t, token, BASE, BASE))[0]).toMatchObject({
      estado: "no_disponible",
      motivo_no_disponible: "Mantenimiento del proyector fijo",
    });
    await esperarError(t.mutation(api.recursos.horarios.marcarNoDisponible, { token, id: bloque._id, motivo: "Otra vez" }), "CONFLICTO");
  });

  test("CP-H02-3: revierte un bloque no disponible a disponible", async () => {
    const { t, token, auditorio } = await preparar();
    await t.mutation(api.recursos.horarios.crear, { token, id_lugar: auditorio, fecha: BASE, hora_inicio: "18:00", hora_fin: "20:00" });
    const [bloque] = await bloquesDe(t, token, BASE, BASE);
    await esperarError(t.mutation(api.recursos.horarios.marcarDisponible, { token, id: bloque._id }), "CONFLICTO");
    await t.mutation(api.recursos.horarios.marcarNoDisponible, { token, id: bloque._id, motivo: "Evento institucional" });
    await t.mutation(api.recursos.horarios.marcarDisponible, { token, id: bloque._id });
    expect((await bloquesDe(t, token, BASE, BASE))[0]).toMatchObject({ estado: "disponible", motivo_no_disponible: null });
  });

  test("CP-H02-4: el calendario general muestra todos los recursos de la semana", async () => {
    const { t, token } = await preparar();
    const desde = hoyLima();
    const bloques = await bloquesDe(t, token, desde, sumarDias(desde, 6));
    expect(bloques.length).toBeGreaterThan(0);
    expect(bloques.every((b) => b.estado === "disponible")).toBe(true);
    await esperarError(t.query(api.recursos.horarios.calendario, { token, desde, hasta: sumarDias(desde, 40) }), "DATOS_INVALIDOS");
  });
});
