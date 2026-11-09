/**
 * HU-H01: creación de horarios para espacios y equipos (también recurrentes).
 * HU-H02: marcar horarios como no disponibles, revertirlos y ver el calendario general.
 * HU-S01/S02: horarios de un espacio o equipo que el solicitante puede elegir.
 *
 * Reglas que en SQL serían constraints o triggers y aquí valida el backend:
 *  - chk_horarios_recurso: el bloque es de un espacio O de un equipo, nunca de ambos.
 *  - uq_horarios_*_inicio + anti-cruce: un recurso no tiene bloques duplicados ni superpuestos.
 *  - chk_horarios_motivo: 'no_disponible' siempre lleva motivo.
 *  - Un bloque con solicitudes (reservas/prestamos) no se edita ni se elimina (ON DELETE RESTRICT).
 */
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { fallar } from "../helpers/errores";
import { checkRole, puedeUsar, ROLES_SOLICITANTES } from "../helpers/permisos";
import { seSuperponen, validarRangoHorario, validarTextoObligatorio } from "../helpers/validaciones";
import { diasEntre, fechasRecurrentes, horaLima, hoyLima, yaEmpezo } from "../helpers/fechas";
import { unidadesOcupadas } from "./objetos";

export const HORA_APERTURA = "07:00";
export const HORA_CIERRE = "22:00";
export const MAX_DIAS_RECURRENCIA = 180;
export const MAX_BLOQUES_POR_OPERACION = 120;
export const MAX_DIAS_CALENDARIO = 31;

type Recurso = { id_lugar?: Id<"lugares">; id_objeto?: Id<"objetos"> };

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

/** chk_horarios_recurso: exactamente uno de los dos. Devuelve el documento del recurso. */
async function validarRecurso(ctx: QueryCtx, r: Recurso): Promise<Doc<"lugares"> | Doc<"objetos">> {
  if (Boolean(r.id_lugar) === Boolean(r.id_objeto)) {
    fallar("DATOS_INVALIDOS", "Selecciona un espacio o un equipo.");
  }
  const doc = r.id_lugar ? await ctx.db.get(r.id_lugar) : await ctx.db.get(r.id_objeto!);
  if (!doc) fallar("NO_ENCONTRADO", "El espacio o equipo seleccionado no existe.");
  if (doc.estado === "inactivo") fallar("CONFLICTO", `"${doc.nombre}" está inactivo y no admite horarios.`);
  return doc;
}

/** Bloques de un recurso en una fecha, ordenados por hora de inicio. */
async function bloquesDelDia(ctx: QueryCtx, r: Recurso, fecha: string) {
  if (r.id_lugar) {
    return await ctx.db
      .query("horarios")
      .withIndex("by_lugar_fecha", (q) => q.eq("id_lugar", r.id_lugar).eq("fecha", fecha))
      .collect();
  }
  return await ctx.db
    .query("horarios")
    .withIndex("by_objeto_fecha", (q) => q.eq("id_objeto", r.id_objeto).eq("fecha", fecha))
    .collect();
}

/** Criterio 3 de H01: primer bloque del mismo recurso que se cruza con el rango, o null. */
async function buscarCruce(ctx: QueryCtx, r: Recurso, fecha: string, inicio: string, fin: string, excluir?: Id<"horarios">) {
  const bloques = await bloquesDelDia(ctx, r, fecha);
  return bloques.find((b) => b._id !== excluir && seSuperponen(inicio, fin, b.hora_inicio, b.hora_fin)) ?? null;
}

/** ¿El bloque ya figura en alguna solicitud? (reservas o prestamos) */
async function tieneSolicitudes(ctx: QueryCtx, id: Id<"horarios">) {
  const reserva = await ctx.db.query("reservas").withIndex("by_horario", (q) => q.eq("id_horario", id)).first();
  if (reserva) return true;
  const prestamo = await ctx.db.query("prestamos").withIndex("by_horario", (q) => q.eq("id_horario", id)).first();
  return prestamo !== null;
}

function validarHorario(fecha: string, inicio: string, fin: string) {
  validarRangoHorario(fecha, inicio, fin);
  if (inicio < HORA_APERTURA || fin > HORA_CIERRE) {
    fallar("DATOS_INVALIDOS", `El horario de atención de la FISI es de ${HORA_APERTURA} a ${HORA_CIERRE}.`);
  }
}

function validarNoPasado(fecha: string, inicio: string) {
  const hoy = hoyLima();
  if (fecha < hoy || (fecha === hoy && inicio <= horaLima())) {
    fallar("DATOS_INVALIDOS", "No se pueden crear ni modificar horarios en fechas u horas pasadas.");
  }
}

async function horarioExistente(ctx: QueryCtx, id: Id<"horarios">) {
  const h = await ctx.db.get(id);
  if (!h) fallar("NO_ENCONTRADO", "El bloque de horario ya no existe.");
  return h;
}

/** Criterio 5 de H01: solo se edita o elimina un bloque que aún no fue reservado. */
async function exigirLibre(ctx: QueryCtx, h: Doc<"horarios">, accion: string) {
  if (h.estado === "ocupado" || (await tieneSolicitudes(ctx, h._id))) {
    fallar("CONFLICTO", `No se puede ${accion} este bloque porque ya tiene una solicitud de reserva o préstamo.`);
  }
}

const rango = (h: { hora_inicio: string; hora_fin: string }) => `${h.hora_inicio}–${h.hora_fin}`;
/** "2026-11-10" -> "10/11/2026" */
const fechaLegible = (f: string) => f.split("-").reverse().join("/");

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Criterio 4 de H02: calendario general con los bloques libres, ocupados y no disponibles
 * de todos los recursos entre dos fechas (máximo un mes).
 */
export const calendario = query({
  args: { token: v.string(), desde: v.string(), hasta: v.string() },
  handler: async (ctx, { token, desde, hasta }) => {
    await checkRole(ctx, token, ["administrativo"]);
    if (hasta < desde || diasEntre(desde, hasta) > MAX_DIAS_CALENDARIO) {
      fallar("DATOS_INVALIDOS", `El rango del calendario debe ser de máximo ${MAX_DIAS_CALENDARIO} días.`);
    }
    const bloques = await ctx.db
      .query("horarios")
      .withIndex("by_fecha_estado", (q) => q.gte("fecha", desde).lte("fecha", hasta))
      .collect();

    const resultado = [];
    for (const b of bloques) {
      let solicitante: { nombre: string; estado: Doc<"solicitudes">["estado"] } | null = null;
      if (b.estado === "ocupado") {
        const detalle =
          (await ctx.db.query("reservas").withIndex("by_horario", (q) => q.eq("id_horario", b._id)).first()) ??
          (await ctx.db.query("prestamos").withIndex("by_horario", (q) => q.eq("id_horario", b._id)).first());
        const solicitud = detalle ? await ctx.db.get(detalle.id_solicitud) : null;
        const usuario = solicitud ? await ctx.db.get(solicitud.id_usuario) : null;
        if (solicitud && usuario) solicitante = { nombre: usuario.nombre, estado: solicitud.estado };
      }
      resultado.push({
        _id: b._id,
        id_lugar: b.id_lugar ?? null,
        id_objeto: b.id_objeto ?? null,
        fecha: b.fecha,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
        estado: b.estado,
        motivo_no_disponible: b.motivo_no_disponible ?? null,
        solicitante,
      });
    }
    resultado.sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
    return resultado;
  },
});

// ---------------------------------------------------------------------------
// HU-H01
// ---------------------------------------------------------------------------

/**
 * Criterios 1 a 4: crea un bloque o una serie semanal. La operación es atómica:
 * si una sola fecha se cruza con otro bloque, no se crea ninguno.
 */
export const crear = mutation({
  args: {
    token: v.string(),
    id_lugar: v.optional(v.id("lugares")),
    id_objeto: v.optional(v.id("objetos")),
    fecha: v.string(),
    hora_inicio: v.string(),
    hora_fin: v.string(),
    repetir: v.optional(v.object({ dias: v.array(v.number()), hasta: v.string() })),
  },
  handler: async (ctx, args): Promise<{ creados: number; fechas: string[] }> => {
    const admin = await checkRole(ctx, args.token, ["administrativo"]);
    const r: Recurso = { id_lugar: args.id_lugar, id_objeto: args.id_objeto };
    const recurso = await validarRecurso(ctx, r);
    validarHorario(args.fecha, args.hora_inicio, args.hora_fin);
    validarNoPasado(args.fecha, args.hora_inicio);

    let fechas = [args.fecha];
    if (args.repetir) {
      const { dias, hasta } = args.repetir;
      if (dias.length === 0 || dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        fallar("DATOS_INVALIDOS", "Elige al menos un día de la semana para la repetición.");
      }
      validarRangoHorario(hasta, args.hora_inicio, args.hora_fin);
      if (hasta < args.fecha) fallar("DATOS_INVALIDOS", "La fecha final de la repetición debe ser posterior a la inicial.");
      if (diasEntre(args.fecha, hasta) > MAX_DIAS_RECURRENCIA) {
        fallar("DATOS_INVALIDOS", `La repetición puede abarcar como máximo ${MAX_DIAS_RECURRENCIA} días.`);
      }
      fechas = fechasRecurrentes(args.fecha, hasta, dias);
      if (fechas.length === 0) fallar("DATOS_INVALIDOS", "Ningún día del rango coincide con los días elegidos.");
    }
    if (fechas.length > MAX_BLOQUES_POR_OPERACION) {
      fallar("DATOS_INVALIDOS", `Se pueden crear como máximo ${MAX_BLOQUES_POR_OPERACION} bloques a la vez (pediste ${fechas.length}).`);
    }

    const cruces: string[] = [];
    for (const fecha of fechas) {
      const cruce = await buscarCruce(ctx, r, fecha, args.hora_inicio, args.hora_fin);
      if (cruce) cruces.push(`${fechaLegible(fecha)} (${rango(cruce)})`);
    }
    if (cruces.length > 0) {
      fallar(
        "CONFLICTO",
        `El horario se cruza con ${cruces.length === 1 ? "un bloque existente" : `${cruces.length} bloques existentes`} de "${recurso.nombre}". No se creó ningún bloque.`,
        `Cruces: ${cruces.slice(0, 5).join(", ")}${cruces.length > 5 ? "…" : ""}`,
      );
    }

    const ahora = Date.now();
    for (const fecha of fechas) {
      await ctx.db.insert("horarios", {
        ...r,
        fecha,
        hora_inicio: args.hora_inicio,
        hora_fin: args.hora_fin,
        estado: "disponible", // criterio 4: disponible de inmediato
        creado_por: admin._id,
        fecha_creacion: ahora,
        fecha_actualizacion: ahora,
      });
    }
    return { creados: fechas.length, fechas };
  },
});

/** Criterio 5: editar fecha u horas de un bloque que aún no fue reservado. */
export const editar = mutation({
  args: { token: v.string(), id: v.id("horarios"), fecha: v.string(), hora_inicio: v.string(), hora_fin: v.string() },
  handler: async (ctx, args) => {
    await checkRole(ctx, args.token, ["administrativo"]);
    const h = await horarioExistente(ctx, args.id);
    await exigirLibre(ctx, h, "editar");
    validarNoPasado(h.fecha, h.hora_inicio);
    validarHorario(args.fecha, args.hora_inicio, args.hora_fin);
    validarNoPasado(args.fecha, args.hora_inicio);
    const r: Recurso = { id_lugar: h.id_lugar, id_objeto: h.id_objeto };
    const cruce = await buscarCruce(ctx, r, args.fecha, args.hora_inicio, args.hora_fin, h._id);
    if (cruce) fallar("CONFLICTO", `El nuevo horario se cruza con el bloque ${rango(cruce)} del ${fechaLegible(cruce.fecha)}.`);
    await ctx.db.patch(h._id, {
      fecha: args.fecha,
      hora_inicio: args.hora_inicio,
      hora_fin: args.hora_fin,
      fecha_actualizacion: Date.now(),
    });
  },
});

/** Criterio 5: eliminar un bloque que aún no fue reservado. */
export const eliminar = mutation({
  args: { token: v.string(), id: v.id("horarios") },
  handler: async (ctx, { token, id }) => {
    await checkRole(ctx, token, ["administrativo"]);
    const h = await horarioExistente(ctx, id);
    await exigirLibre(ctx, h, "eliminar");
    await ctx.db.delete(h._id);
  },
});

// ---------------------------------------------------------------------------
// HU-H02
// ---------------------------------------------------------------------------

/** Criterio 1: marcar como no disponible con motivo (mantenimiento, reserva previa...). */
export const marcarNoDisponible = mutation({
  args: { token: v.string(), id: v.id("horarios"), motivo: v.string() },
  handler: async (ctx, args) => {
    await checkRole(ctx, args.token, ["administrativo"]);
    const motivo = validarTextoObligatorio(args.motivo, "Motivo");
    const h = await horarioExistente(ctx, args.id);
    if (h.estado === "no_disponible") fallar("CONFLICTO", "Este bloque ya está marcado como no disponible.");
    await exigirLibre(ctx, h, "bloquear");
    if (h.fecha < hoyLima()) fallar("DATOS_INVALIDOS", "No se pueden modificar horarios pasados.");
    await ctx.db.patch(h._id, { estado: "no_disponible", motivo_no_disponible: motivo, fecha_actualizacion: Date.now() });
  },
});

/** Criterio 3: revertir un bloque no disponible a disponible. */
export const marcarDisponible = mutation({
  args: { token: v.string(), id: v.id("horarios") },
  handler: async (ctx, { token, id }) => {
    await checkRole(ctx, token, ["administrativo"]);
    const h = await horarioExistente(ctx, id);
    if (h.estado !== "no_disponible") fallar("CONFLICTO", "Solo se puede revertir un bloque marcado como no disponible.");
    if (h.fecha < hoyLima()) fallar("DATOS_INVALIDOS", "No se pueden modificar horarios pasados.");
    await ctx.db.patch(h._id, { estado: "disponible", motivo_no_disponible: undefined, fecha_actualizacion: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// HU-S01 y HU-S02: horarios que el solicitante puede elegir
// ---------------------------------------------------------------------------

/**
 * Bloques de un espacio o equipo entre dos fechas, con lo que el usuario puede elegir.
 * Los ocupados y no disponibles se devuelven para mostrarlos bloqueados (criterio 4 de S01).
 */
export const deRecurso = query({
  args: {
    token: v.string(),
    id_lugar: v.optional(v.id("lugares")),
    id_objeto: v.optional(v.id("objetos")),
    desde: v.string(),
    hasta: v.string(),
  },
  handler: async (ctx, args) => {
    const u = await checkRole(ctx, args.token, ROLES_SOLICITANTES);
    if (Boolean(args.id_lugar) === Boolean(args.id_objeto)) fallar("DATOS_INVALIDOS", "Selecciona un espacio o un equipo.");
    if (args.hasta < args.desde || diasEntre(args.desde, args.hasta) > MAX_DIAS_CALENDARIO) {
      fallar("DATOS_INVALIDOS", `El rango debe ser de máximo ${MAX_DIAS_CALENDARIO} días.`);
    }
    const recurso = args.id_lugar ? await ctx.db.get(args.id_lugar) : await ctx.db.get(args.id_objeto!);
    if (!recurso || !puedeUsar(recurso, u.rol)) fallar("SIN_PERMISO", "No puedes pedir este recurso con tu tipo de cuenta.");

    const bloques = args.id_lugar
      ? await ctx.db
          .query("horarios")
          .withIndex("by_lugar_fecha", (q) => q.eq("id_lugar", args.id_lugar).gte("fecha", args.desde).lte("fecha", args.hasta))
          .collect()
      : await ctx.db
          .query("horarios")
          .withIndex("by_objeto_fecha", (q) => q.eq("id_objeto", args.id_objeto).gte("fecha", args.desde).lte("fecha", args.hasta))
          .collect();

    const stock = "stock" in recurso ? recurso.stock : 1;
    const resultado = [];
    for (const h of bloques) {
      const libres = args.id_objeto ? Math.max(0, stock - (await unidadesOcupadas(ctx, h._id))) : h.estado === "disponible" ? 1 : 0;
      const pasado = yaEmpezo(h);
      resultado.push({
        _id: h._id,
        fecha: h.fecha,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        estado: h.estado,
        motivo_no_disponible: h.estado === "no_disponible" ? (h.motivo_no_disponible ?? null) : null,
        libres,
        seleccionable: !pasado && h.estado !== "no_disponible" && libres > 0,
        pasado,
      });
    }
    return resultado;
  },
});
