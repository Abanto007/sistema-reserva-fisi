/**
 * Validaciones que en el SQL son CHECK y UNIQUE.
 */
import { fallar } from "./errores";

// chk_usuarios_codigo_dni_formato
export const RE_CODIGO_DNI = /^[A-Za-z0-9]{6,20}$/;
// chk_usuarios_correo_formato
export const RE_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MIN_PASSWORD = 6;

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function validarCodigoDni(codigo: string): string {
  const limpio = codigo.trim();
  if (!RE_CODIGO_DNI.test(limpio)) {
    fallar("DATOS_INVALIDOS", "El código o DNI debe tener entre 6 y 20 letras o números.");
  }
  return limpio;
}

export function validarCorreo(correo: string): string {
  const limpio = normalizarCorreo(correo);
  if (!RE_CORREO.test(limpio)) fallar("DATOS_INVALIDOS", "El correo electrónico no es válido.");
  return limpio;
}

export function validarTextoObligatorio(valor: string | undefined, campo: string): string {
  const limpio = (valor ?? "").trim();
  if (limpio.length === 0) fallar("DATOS_INVALIDOS", `El campo "${campo}" es obligatorio.`);
  return limpio;
}

// chk_horarios_rango
export function validarRangoHorario(fecha: string, inicio: string, fin: string) {
  if (!RE_FECHA.test(fecha)) fallar("DATOS_INVALIDOS", "La fecha debe tener el formato AAAA-MM-DD.");
  if (!RE_HORA.test(inicio) || !RE_HORA.test(fin)) {
    fallar("DATOS_INVALIDOS", "Las horas deben tener el formato HH:MM.");
  }
  if (fin <= inicio) fallar("DATOS_INVALIDOS", "La hora de fin debe ser mayor que la de inicio.");
}

// Dos rangos [a1, a2) y [b1, b2) se cruzan si a1 < b2 y a2 > b1
export function seSuperponen(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 < b2 && a2 > b1;
}
