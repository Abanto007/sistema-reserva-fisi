/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";

export const modules = import.meta.glob("../**/!(*.*.*)*.*s");
export const nuevoEntorno = () => convexTest(schema, modules);
export type Entorno = ReturnType<typeof nuevoEntorno>;

/** Verifica que la promesa falle con el código de negocio indicado. */
export async function esperarError(promesa: Promise<unknown>, codigo: string) {
  try {
    await promesa;
  } catch (e) {
    const data = (e as ConvexError<{ codigo: string }>).data;
    expect(data?.codigo, `se esperaba ${codigo}, llegó ${JSON.stringify(data ?? String(e))}`).toBe(codigo);
    return data as unknown as { codigo: string; mensaje: string; detalle?: string };
  }
  throw new Error(`Se esperaba el error ${codigo} y la operación terminó bien`);
}

export const DOCENTE = {
  codigo_dni: "20265871",
  nombre: "Alejandro Vargas",
  correo: "Estudiante_5871@unmsm.edu.pe",
  password: "clave123",
  rol: "docente" as const,
};

export const POSTULANTE = {
  codigo_dni: "20278588",
  nombre: "Lic. Javier Mendoza",
  correo: "postulante_admin_8588@unmsm.edu.pe",
  password: "admin2026",
  rol: "administrativo" as const,
  documento_validacion: "ADM-FISI-8588",
};

/** Admin superior de la semilla con sesión iniciada. */
export async function loginAdminSuperior(t: Entorno) {
  await t.action(api.seed.sembrar, {});
  const r = await t.action(api.auth.acciones.iniciarSesion, { identificador: "carlos.admin@unmsm.edu.pe", password: "Admin123" });
  return r.token;
}
