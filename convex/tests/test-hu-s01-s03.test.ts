/**
 * Pruebas de HU-S01 (reserva de espacio), HU-S02 (préstamo simple o conjunto)
 * y HU-S03 (consultar y filtrar mis solicitudes).
 */
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { hoyLima, sumarDias } from "../helpers/fechas";
import { DOCENTE, Entorno, esperarError, loginAdminSuperior, nuevoEntorno } from "./utilidades.helper";

const BASE = sumarDias(hoyLima(), 40);

/** Entorno con semilla, un admin, un docente con sesión y bloques en BASE. */
async function preparar() {
  const t = nuevoEntorno();
  const admin = await loginAdminSuperior(t);
  await t.action(api.auth.acciones.registrar, DOCENTE);
  const { token } = await t.action(api.auth.acciones.iniciarSesion, { identificador: DOCENTE.codigo_dni, password: DOCENTE.password });
  const lugares = await t.query(api.recursos.lugares.disponibles, { token });
  const objetos = await t.query(api.recursos.objetos.disponibles, { token });
  const auditorio = lugares.find((l) => l.nombre.startsWith("Auditorio"))!;
  const patio = lugares.find((l) => l.nombre.startsWith("Patio"))!;
  const proyector = objetos.find((o) => o.nombre.startsWith("Proyector"))!; // stock 4
  for (const [ini, fin] of [["08:00", "10:00"], ["10:00", "12:00"]]) {
    await t.mutation(api.recursos.horarios.crear, { token: admin, id_lugar: auditorio._id, fecha: BASE, hora_inicio: ini, hora_fin: fin });
    await t.mutation(api.recursos.horarios.crear, { token: admin, id_lugar: patio._id, fecha: BASE, hora_inicio: ini, hora_fin: fin });
    await t.mutation(api.recursos.horarios.crear, { token: admin, id_objeto: proyector._id, fecha: BASE, hora_inicio: ini, hora_fin: fin });
  }
  const bloques = async (r: { id_lugar?: typeof auditorio._id; id_objeto?: typeof proyector._id }) =>
    await t.query(api.recursos.horarios.deRecurso, { token, ...r, desde: BASE, hasta: BASE });
  return { t, admin, token, auditorio, patio, proyector, bloques };
}

async function otroUsuario(t: Entorno, rol: "alumno" | "foraneo" | "externo", sufijo: string) {
  const datos = { codigo_dni: `2026${sufijo}`, nombre: `Usuario ${sufijo}`, correo: `u${sufijo}@gmail.com`, password: "clave123", rol };
  await t.action(api.auth.acciones.registrar, datos);
  return (await t.action(api.auth.acciones.iniciarSesion, { identificador: datos.codigo_dni, password: datos.password })).token;
}

describe("HU-S01: reserva de espacio", () => {
  test("CP-S01-1: reserva con motivo, queda pendiente y con prioridad normal", async () => {
    const { t, token, auditorio, bloques } = await preparar();
    const [b1, b2] = await bloques({ id_lugar: auditorio._id });
    expect(b1.seleccionable).toBe(true);
    const s = await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Conferencia de IA", espacios: [b1._id, b2._id] });
    expect(s).toMatchObject({ tipo: "reserva", estado: "pendiente", prioridad: "normal", motivo: "Conferencia de IA" });
    expect(s.espacios.map((e) => e.hora_inicio)).toEqual(["08:00", "10:00"]);
    expect(s.espacios[0].recurso).toBe(auditorio.nombre);
  });

  test("CP-S01-2: el motivo es obligatorio y se elige al menos un horario", async () => {
    const { t, token, auditorio, bloques } = await preparar();
    const [b1] = await bloques({ id_lugar: auditorio._id });
    await esperarError(t.mutation(api.solicitudes.reservas.crear, { token, motivo: " ", espacios: [b1._id] }), "DATOS_INVALIDOS");
    await esperarError(t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Taller", espacios: [] }), "DATOS_INVALIDOS");
  });

  test("CP-S01-3: la reserva aparta el horario y nadie más puede elegirlo", async () => {
    const { t, token, auditorio, bloques } = await preparar();
    const [b1] = await bloques({ id_lugar: auditorio._id });
    await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Taller", espacios: [b1._id] });
    const [despues] = await bloques({ id_lugar: auditorio._id });
    expect(despues).toMatchObject({ estado: "ocupado", seleccionable: false });
    const alumno = await otroUsuario(t, "alumno", "0001");
    await esperarError(t.mutation(api.solicitudes.reservas.crear, { token: alumno, motivo: "Ensayo", espacios: [b1._id] }), "CONFLICTO");
  });

  test("CP-S01-4: no permite elegir horarios no disponibles", async () => {
    const { t, admin, token, auditorio, bloques } = await preparar();
    const [b1] = await bloques({ id_lugar: auditorio._id });
    await t.mutation(api.recursos.horarios.marcarNoDisponible, { token: admin, id: b1._id, motivo: "Mantenimiento" });
    expect((await bloques({ id_lugar: auditorio._id }))[0].seleccionable).toBe(false);
    const e = await esperarError(t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Taller", espacios: [b1._id] }), "CONFLICTO");
    expect(e.mensaje).toContain("Mantenimiento");
  });

  test("CP-S01-5: una solicitud tiene un solo espacio", async () => {
    const { t, token, auditorio, patio, bloques } = await preparar();
    const [a] = await bloques({ id_lugar: auditorio._id });
    const [p] = await bloques({ id_lugar: patio._id });
    await esperarError(t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Feria", espacios: [a._id, p._id] }), "DATOS_INVALIDOS");
  });

  test("CP-S01-6: respeta los roles permitidos de cada espacio", async () => {
    const { t, admin } = await preparar();
    const foraneo = await otroUsuario(t, "foraneo", "0002");
    const lugares = await t.query(api.recursos.lugares.disponibles, { token: foraneo });
    expect(lugares.some((l) => l.nombre === "Sala de Reuniones Docentes")).toBe(false);
    expect(lugares.length).toBeGreaterThan(0);
    // El personal administrativo gestiona, no solicita
    await esperarError(t.query(api.recursos.lugares.disponibles, { token: admin }), "SIN_PERMISO");
  });
});

describe("HU-S02: préstamo de equipos", () => {
  test("CP-S02-1: préstamo simple con prioridad elegida y control de stock", async () => {
    const { t, token, proyector, bloques } = await preparar();
    const [b1] = await bloques({ id_objeto: proyector._id });
    expect(b1.libres).toBe(4);
    const s = await t.mutation(api.solicitudes.prestamos.crear, {
      token,
      motivo: "Exposición de tesis",
      prioridad: "alta",
      equipos: [{ id_horario: b1._id, cantidad: 3 }],
    });
    expect(s).toMatchObject({ tipo: "prestamo", prioridad: "alta", estado: "pendiente" });
    expect(s.equipos[0]).toMatchObject({ recurso: proyector.nombre, cantidad: 3 });

    const [despues] = await bloques({ id_objeto: proyector._id });
    expect(despues).toMatchObject({ libres: 1, estado: "disponible", seleccionable: true });
    const alumno = await otroUsuario(t, "alumno", "0003");
    const e = await esperarError(
      t.mutation(api.solicitudes.prestamos.crear, { token: alumno, motivo: "Clase", equipos: [{ id_horario: b1._id, cantidad: 2 }] }),
      "CONFLICTO",
    );
    expect(e.mensaje).toContain("Solo quedan 1 unidad");
    await t.mutation(api.solicitudes.prestamos.crear, { token: alumno, motivo: "Clase", equipos: [{ id_horario: b1._id, cantidad: 1 }] });
    expect((await bloques({ id_objeto: proyector._id }))[0]).toMatchObject({ libres: 0, estado: "ocupado", seleccionable: false });
  });

  test("CP-S02-2: solicitud conjunta de espacio y equipos en un solo envío", async () => {
    const { t, token, auditorio, proyector, bloques } = await preparar();
    const [a] = await bloques({ id_lugar: auditorio._id });
    const [p] = await bloques({ id_objeto: proyector._id });
    const s = await t.mutation(api.solicitudes.reservas.crear, {
      token,
      motivo: "Congreso",
      espacios: [a._id],
      equipos: [{ id_horario: p._id, cantidad: 1 }],
    });
    expect(s.tipo).toBe("conjunta");
    expect(s.espacios).toHaveLength(1);
    expect(s.equipos).toHaveLength(1);
  });

  test("CP-S02-3: asocia equipos a una reserva existente y la vuelve conjunta", async () => {
    const { t, token, auditorio, proyector, bloques } = await preparar();
    const [a] = await bloques({ id_lugar: auditorio._id });
    const reserva = await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Charla", espacios: [a._id] });
    const asociables = await t.query(api.solicitudes.prestamos.reservasParaAsociar, { token });
    expect(asociables.map((r) => r._id)).toEqual([reserva._id]);

    const [p] = await bloques({ id_objeto: proyector._id });
    const s = await t.mutation(api.solicitudes.prestamos.agregarEquipos, {
      token,
      id_solicitud: reserva._id,
      prioridad: "baja",
      equipos: [{ id_horario: p._id, cantidad: 2 }],
    });
    expect(s).toMatchObject({ _id: reserva._id, tipo: "conjunta", prioridad: "baja" });
    // Sigue disponible para sumar más equipos mientras esté pendiente
    expect((await t.query(api.solicitudes.prestamos.reservasParaAsociar, { token })).map((r) => r.tipo)).toEqual(["conjunta"]);
  });

  test("CP-S02-3b: se pueden sumar más equipos a una conjunta pendiente", async () => {
    const { t, token, auditorio, proyector, bloques } = await preparar();
    const [a] = await bloques({ id_lugar: auditorio._id });
    const [p] = await bloques({ id_objeto: proyector._id });
    const conjunta = await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Congreso", espacios: [a._id], equipos: [{ id_horario: p._id, cantidad: 1 }] });

    // Mismo equipo y horario: se suma la cantidad; otro equipo: se agrega
    const microfono = (await t.query(api.recursos.objetos.disponibles, { token })).find((o) => o.nombre.startsWith("Micrófono"))!;
    const admin = await loginAdminSuperior(t);
    await t.mutation(api.recursos.horarios.crear, { token: admin, id_objeto: microfono._id, fecha: BASE, hora_inicio: "08:00", hora_fin: "10:00" });
    const [m] = await bloques({ id_objeto: microfono._id });
    const s = await t.mutation(api.solicitudes.prestamos.agregarEquipos, {
      token,
      id_solicitud: conjunta._id,
      equipos: [{ id_horario: p._id, cantidad: 2 }, { id_horario: m._id, cantidad: 1 }],
    });
    expect(s.equipos.map((e) => [e.recurso, e.cantidad]).sort()).toEqual([[microfono.nombre, 1], [proyector.nombre, 3]].sort());
    expect((await bloques({ id_objeto: proyector._id }))[0].libres).toBe(1);
    // Un préstamo sin espacio no admite asociaciones
    const prestamo = await t.mutation(api.solicitudes.prestamos.crear, { token, motivo: "Clase", equipos: [{ id_horario: m._id, cantidad: 1 }] });
    await esperarError(t.mutation(api.solicitudes.prestamos.agregarEquipos, { token, id_solicitud: prestamo._id, equipos: [{ id_horario: p._id, cantidad: 1 }] }), "CONFLICTO");
  });

  test("CP-S02-4: valida cantidades y no deja pedir equipos no disponibles", async () => {
    const { t, admin, token, proyector, bloques } = await preparar();
    const [p1, p2] = await bloques({ id_objeto: proyector._id });
    await esperarError(
      t.mutation(api.solicitudes.prestamos.crear, { token, motivo: "x", equipos: [{ id_horario: p1._id, cantidad: 0 }] }),
      "DATOS_INVALIDOS",
    );
    await esperarError(
      t.mutation(api.solicitudes.prestamos.crear, { token, motivo: "x", equipos: [{ id_horario: p1._id, cantidad: 5 }] }),
      "CONFLICTO",
    );
    await t.mutation(api.recursos.horarios.marcarNoDisponible, { token: admin, id: p2._id, motivo: "En reparación" });
    await esperarError(
      t.mutation(api.solicitudes.prestamos.crear, { token, motivo: "x", equipos: [{ id_horario: p2._id, cantidad: 1 }] }),
      "CONFLICTO",
    );
  });
});

describe("HU-S03: mis solicitudes", () => {
  test("CP-S03-1 a 4: lista, filtros por estado, tipo y fechas, y detalle", async () => {
    const { t, token, auditorio, patio, proyector, bloques } = await preparar();
    const [a] = await bloques({ id_lugar: auditorio._id });
    const [, pt] = await bloques({ id_lugar: patio._id });
    const [p] = await bloques({ id_objeto: proyector._id });
    await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Uno", espacios: [a._id] });
    await t.mutation(api.solicitudes.prestamos.crear, { token, motivo: "Dos", equipos: [{ id_horario: p._id, cantidad: 1 }] });
    const tercera = await t.mutation(api.solicitudes.reservas.crear, { token, motivo: "Tres", espacios: [pt._id] });

    const todas = await t.query(api.solicitudes.historial.mias, { token });
    expect(todas.map((s) => s.motivo)).toEqual(["Tres", "Dos", "Uno"]);
    expect(await t.query(api.solicitudes.historial.mias, { token, estado: "pendiente" })).toHaveLength(3);
    expect(await t.query(api.solicitudes.historial.mias, { token, estado: "aceptada" })).toHaveLength(0);
    expect((await t.query(api.solicitudes.historial.mias, { token, tipo: "prestamo" })).map((s) => s.motivo)).toEqual(["Dos"]);
    expect(await t.query(api.solicitudes.historial.mias, { token, desde: BASE, hasta: BASE })).toHaveLength(3);
    expect(await t.query(api.solicitudes.historial.mias, { token, desde: sumarDias(BASE, 1) })).toHaveLength(0);

    const d = await t.query(api.solicitudes.historial.detalle, { token, id: tercera._id });
    expect(d).toMatchObject({ prioridad: "normal", estado: "pendiente", comentarios: [] });
    expect(d.espacios[0]).toMatchObject({ recurso: patio.nombre, hora_inicio: "10:00" });

    // Nadie ve las solicitudes de otro
    const alumno = await otroUsuario(t, "externo", "0004");
    expect(await t.query(api.solicitudes.historial.mias, { token: alumno })).toHaveLength(0);
    await esperarError(t.query(api.solicitudes.historial.detalle, { token: alumno, id: tercera._id }), "NO_ENCONTRADO");
  });
});
