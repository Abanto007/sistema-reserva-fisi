/**
 * HU-S01: enviar solicitud de reserva de espacio.
 *
 * Reglas del backend (en SQL serían triggers o lógica de negocio):
 *  - Solo alumnos, docentes, foráneos y externos reservan, y solo los espacios cuyo
 *    roles_permitidos incluye su rol.
 *  - Una solicitud tiene un solo espacio (hasta 4 bloques de ese espacio).
 *  - Una solicitud pendiente ya aparta el horario: el bloque pasa a 'ocupado'.
 *  - No se pueden elegir bloques 'no_disponible', 'ocupado' ni pasados.
 *  - Si además se envían equipos, la solicitud queda como conjunta (S02).
 */
import { v } from "convex/values";
import { mutation, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { prioridadSolicitud, RolUsuario } from "../helpers/enums";
import { fallar } from "../helpers/errores";
import { checkRole, puedeUsar, ROLES_SOLICITANTES } from "../helpers/permisos";
import { yaEmpezo } from "../helpers/fechas";
import { avisarPorCorreo, insertarSolicitud, validarMotivo } from "./comun";
import { equipoPedido, guardarEquipos, validarEquipos } from "./prestamos";

export const MAX_BLOQUES_ESPACIO = 4;

/** Valida los bloques de espacio pedidos y devuelve el lugar. */
async function validarEspacios(ctx: QueryCtx, ids: Id<"horarios">[], rol: RolUsuario) {
  if (ids.length > MAX_BLOQUES_ESPACIO) fallar("DATOS_INVALIDOS", `Puedes reservar como máximo ${MAX_BLOQUES_ESPACIO} bloques por solicitud.`);
  if (new Set(ids).size !== ids.length) fallar("DATOS_INVALIDOS", "Elegiste el mismo bloque dos veces.");
  let lugar: Doc<"lugares"> | null = null;
  const bloques: Doc<"horarios">[] = [];
  for (const id of ids) {
    const h = await ctx.db.get(id);
    if (!h || !h.id_lugar) fallar("NO_ENCONTRADO", "Uno de los horarios elegidos ya no existe.");
    if (lugar && h.id_lugar !== lugar._id) fallar("DATOS_INVALIDOS", "Una solicitud solo puede incluir un espacio.");
    lugar ??= await ctx.db.get(h.id_lugar);
    if (!lugar || !puedeUsar(lugar, rol)) fallar("SIN_PERMISO", "No puedes reservar este espacio con tu tipo de cuenta.");
    if (yaEmpezo(h)) fallar("DATOS_INVALIDOS", "No puedes elegir un horario que ya pasó.");
    // Criterio 4 de S01 y criterio 2 de H02
    if (h.estado === "no_disponible") fallar("CONFLICTO", `El bloque ${h.hora_inicio}–${h.hora_fin} del ${h.fecha} no está disponible: ${h.motivo_no_disponible}.`);
    if (h.estado === "ocupado") fallar("CONFLICTO", `El bloque ${h.hora_inicio}–${h.hora_fin} del ${h.fecha} ya fue reservado por otra persona.`);
    bloques.push(h);
  }
  return { lugar: lugar!, bloques };
}

/**
 * Crea una reserva de espacio (o una conjunta si también se envían equipos).
 * Queda 'pendiente' con prioridad 'normal', salvo que se elija otra.
 */
export const crear = mutation({
  args: {
    token: v.string(),
    motivo: v.string(),
    prioridad: v.optional(prioridadSolicitud),
    espacios: v.array(v.id("horarios")),
    equipos: v.optional(v.array(equipoPedido)),
  },
  handler: async (ctx, args) => {
    const u = await checkRole(ctx, args.token, ROLES_SOLICITANTES);
    const motivo = validarMotivo(args.motivo);
    if (args.espacios.length === 0) fallar("DATOS_INVALIDOS", "Elige al menos un horario disponible del espacio.");

    const { lugar, bloques } = await validarEspacios(ctx, args.espacios, u.rol);
    const equipos = await validarEquipos(ctx, args.equipos ?? [], u.rol);
    const tipo = equipos.length > 0 ? "conjunta" : "reserva";

    const id = await insertarSolicitud(ctx, { id_usuario: u._id, tipo, prioridad: args.prioridad, motivo });
    const ahora = Date.now();
    let monto = 0;
    for (const h of bloques) {
      await ctx.db.insert("reservas", { id_solicitud: id, id_horario: h._id, id_lugar: lugar._id });
      await ctx.db.patch(h._id, { estado: "ocupado", fecha_actualizacion: ahora }); // aparta el horario
      monto += lugar.precio;
    }
    monto += await guardarEquipos(ctx, id, equipos);
    if (monto > 0) await ctx.db.patch(id, { monto_total: monto });

    // Criterio 5: confirmación con el detalle
    return await avisarPorCorreo(ctx, u, id);
  },
});
