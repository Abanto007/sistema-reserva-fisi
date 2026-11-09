/**
 * Errores de negocio. Se lanzan como ConvexError con un código fijo que el
 * frontend traduce a los banners del informe (rojo, ámbar...).
 * Equivalencia con los HTTP del informe:
 *   DATOS_INVALIDOS ~ 400 · CREDENCIALES / SIN_SESION ~ 401
 *   BLOQUEADA / PENDIENTE / RECHAZADA / SIN_PERMISO ~ 403
 *   NO_ENCONTRADO ~ 404 · DUPLICADO / CONFLICTO ~ 409
 */
import { ConvexError } from "convex/values";

export type CodigoError =
  | "DATOS_INVALIDOS"
  | "CREDENCIALES"
  | "SIN_SESION"
  | "BLOQUEADA"
  | "PENDIENTE"
  | "RECHAZADA"
  | "SIN_PERMISO"
  | "NO_ENCONTRADO"
  | "DUPLICADO"
  | "CONFLICTO"
  | "NO_COINCIDE"
  | "OTP_INVALIDO"
  | "OTP_VENCIDO";

export type DatosError = { codigo: CodigoError; mensaje: string; detalle?: string };

export function fallar(codigo: CodigoError, mensaje: string, detalle?: string): never {
  const data: DatosError = detalle === undefined ? { codigo, mensaje } : { codigo, mensaje, detalle };
  throw new ConvexError(data);
}
