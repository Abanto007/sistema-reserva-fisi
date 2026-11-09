/**
 * Datos semilla para desarrollo. Se ejecuta con:  pnpm seed
 * (equivale a `pnpm convex run seed:sembrar`). Es idempotente: si ya hay
 * datos, no duplica nada.
 *
 * Crea:
 *  - El "Administrador Superior" del informe (Carlos Admin FISI), ya aprobado.
 *    El primer administrador no tiene quién lo valide (igual que en el SQL).
 *  - Espacios y equipos de la FISI.
 *  - Bloques de horario para los próximos 14 días hábiles.
 */
import bcrypt from "bcryptjs";
import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const ADMIN_SEMILLA = {
  codigo_dni: "ADMIN0001",
  nombre: "Carlos Admin FISI",
  correo: "carlos.admin@unmsm.edu.pe",
  password: "Admin123",
  documento_validacion: "ADM-FISI-0001",
};

const LUGARES = [
  { nombre: "Auditorio Principal FISI", descripcion: "Auditorio con proyector fijo y sistema de sonido.", ubicacion: "Pabellón nuevo, 1er piso", capacidad: 200, precio: 0 },
  { nombre: "Laboratorio de Cómputo 1", descripcion: "40 computadoras con software de desarrollo.", ubicacion: "Pabellón nuevo, 2do piso", capacidad: 40, precio: 0 },
  { nombre: "Sala de Estudio 2", descripcion: "Mesas grupales y pizarra acrílica.", ubicacion: "Biblioteca FISI", capacidad: 12, precio: 0 },
  { nombre: "Patio Central", descripcion: "Área abierta para actividades recreativas.", ubicacion: "Entre pabellones", capacidad: 150, precio: 0 },
  { nombre: "Sala de Reuniones Docentes", descripcion: "Mesa de reuniones y televisor.", ubicacion: "Pabellón antiguo, 2do piso", capacidad: 15, precio: 0, roles: ["docente", "administrativo"] as const },
];

const OBJETOS = [
  { nombre: "Proyector Epson", descripcion: "Proyector multimedia con cable HDMI.", stock: 4, precio: 0 },
  { nombre: "Laptop Lenovo ThinkPad", descripcion: "Laptop para presentaciones académicas.", stock: 6, precio: 0 },
  { nombre: "Micrófono inalámbrico", descripcion: "Micrófono de mano con receptor.", stock: 5, precio: 0 },
  { nombre: "Parlante portátil", descripcion: "Parlante Bluetooth con batería.", stock: 3, precio: 0 },
  { nombre: "Kit de juegos de mesa", descripcion: "Ajedrez, cartas y juegos de estrategia.", stock: 2, precio: 0 },
];

const BLOQUES = [
  ["08:00", "10:00"],
  ["10:00", "12:00"],
  ["14:00", "16:00"],
  ["16:00", "18:00"],
] as const;

/** Roles que pueden enviar solicitudes (el administrativo las gestiona). */
const ROLES_SOLICITANTES = ["alumno", "docente", "foraneo", "externo"] as const;

/** Próximos `n` días hábiles (lunes a viernes) en hora de Lima, como "YYYY-MM-DD". */
function proximosDiasHabiles(n: number): string[] {
  const LIMA_MS = -5 * 60 * 60 * 1000;
  const dias: string[] = [];
  const cursor = new Date(Date.now() + LIMA_MS);
  cursor.setUTCHours(12, 0, 0, 0);
  while (dias.length < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dia = cursor.getUTCDay();
    if (dia !== 0 && dia !== 6) dias.push(cursor.toISOString().slice(0, 10));
  }
  return dias;
}

export const sembrar = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const password_hash = await bcrypt.hash(ADMIN_SEMILLA.password, 10);
    return await ctx.runMutation(internal.seed.insertarDatos, {
      password_hash,
      fechas: proximosDiasHabiles(14),
    });
  },
});

export const insertarDatos = internalMutation({
  args: {
    password_hash: v.string(),
    fechas: v.array(v.string()),
  },
  handler: async (ctx, { password_hash, fechas }) => {
    const ahora = Date.now();
    const informe: string[] = [];

    // 1. Administrador superior
    let admin = await ctx.db
      .query("usuarios")
      .withIndex("by_codigo_dni", (q) => q.eq("codigo_dni", ADMIN_SEMILLA.codigo_dni))
      .unique();
    if (!admin) {
      const id = await ctx.db.insert("usuarios", {
        codigo_dni: ADMIN_SEMILLA.codigo_dni,
        nombre: ADMIN_SEMILLA.nombre,
        correo: ADMIN_SEMILLA.correo,
        password_hash,
        rol: "administrativo",
        intentos_fallidos: 0,
        bloqueado: false,
        documento_validacion: ADMIN_SEMILLA.documento_validacion,
        estado_validacion: "aprobado",
        fecha_validacion: ahora,
        fecha_creacion: ahora,
        fecha_actualizacion: ahora,
      });
      admin = await ctx.db.get(id);
      informe.push(`Administrador creado: ${ADMIN_SEMILLA.correo} / ${ADMIN_SEMILLA.password}`);
    } else {
      informe.push("Administrador ya existía");
    }
    const adminId = admin!._id;

    // 2. Espacios
    const idsLugares = [];
    for (const l of LUGARES) {
      const existe = await ctx.db.query("lugares").withIndex("by_nombre", (q) => q.eq("nombre", l.nombre)).unique();
      const roles = "roles" in l && l.roles ? [...l.roles] : [...ROLES_SOLICITANTES];
      if (existe) {
        // Mantiene al día quién puede pedir cada espacio (decisión de la iteración 2)
        if (existe.roles_permitidos.join() !== roles.join()) await ctx.db.patch(existe._id, { roles_permitidos: roles });
        idsLugares.push(existe._id);
        continue;
      }
      idsLugares.push(
        await ctx.db.insert("lugares", {
          nombre: l.nombre,
          descripcion: l.descripcion,
          ubicacion: l.ubicacion,
          capacidad: l.capacidad,
          precio: l.precio,
          estado: "activo",
          roles_permitidos: roles,
          fecha_creacion: ahora,
          fecha_actualizacion: ahora,
        }),
      );
    }

    // 3. Equipos
    const idsObjetos = [];
    for (const o of OBJETOS) {
      const existe = await ctx.db.query("objetos").withIndex("by_nombre", (q) => q.eq("nombre", o.nombre)).unique();
      if (existe) {
        if (existe.roles_permitidos.join() !== ROLES_SOLICITANTES.join()) {
          await ctx.db.patch(existe._id, { roles_permitidos: [...ROLES_SOLICITANTES] });
        }
        idsObjetos.push(existe._id);
        continue;
      }
      idsObjetos.push(
        await ctx.db.insert("objetos", {
          ...o,
          estado: "activo",
          roles_permitidos: [...ROLES_SOLICITANTES],
          fecha_creacion: ahora,
          fecha_actualizacion: ahora,
        }),
      );
    }
    informe.push(`${idsLugares.length} espacios y ${idsObjetos.length} equipos listos`);

    // 4. Horarios (sin duplicar: mismo recurso, fecha y hora de inicio)
    let creados = 0;
    for (const fecha of fechas) {
      for (const [hora_inicio, hora_fin] of BLOQUES) {
        for (const id_lugar of idsLugares) {
          const existe = await ctx.db
            .query("horarios")
            .withIndex("by_lugar_fecha", (q) => q.eq("id_lugar", id_lugar).eq("fecha", fecha).eq("hora_inicio", hora_inicio))
            .first();
          if (existe) continue;
          await ctx.db.insert("horarios", {
            id_lugar, fecha, hora_inicio, hora_fin, estado: "disponible",
            creado_por: adminId, fecha_creacion: ahora, fecha_actualizacion: ahora,
          });
          creados++;
        }
        for (const id_objeto of idsObjetos) {
          const existe = await ctx.db
            .query("horarios")
            .withIndex("by_objeto_fecha", (q) => q.eq("id_objeto", id_objeto).eq("fecha", fecha).eq("hora_inicio", hora_inicio))
            .first();
          if (existe) continue;
          await ctx.db.insert("horarios", {
            id_objeto, fecha, hora_inicio, hora_fin, estado: "disponible",
            creado_por: adminId, fecha_creacion: ahora, fecha_actualizacion: ahora,
          });
          creados++;
        }
      }
    }
    informe.push(`${creados} bloques de horario nuevos`);
    return informe.join("\n");
  },
});
