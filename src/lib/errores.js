/**
 * Traduce los errores de Convex (ConvexError con { codigo, mensaje, detalle })
 * a un objeto simple para mostrar en los banners.
 */
import { ConvexError } from "convex/values";

export function leerError(error) {
  if (error instanceof ConvexError && error.data && typeof error.data === "object") {
    return { codigo: error.data.codigo, mensaje: error.data.mensaje, detalle: error.data.detalle };
  }
  console.error(error);
  return {
    codigo: "DESCONOCIDO",
    mensaje: "No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.",
  };
}
