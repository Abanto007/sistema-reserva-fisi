/**
 * Fechas de calendario ("YYYY-MM-DD") en hora de Lima (UTC-5, sin horario de verano).
 * Se trabaja con cadenas para que el orden alfabético coincida con el cronológico.
 */
const LIMA_MS = -5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha de hoy en Lima. */
export function hoyLima(ahora = Date.now()): string {
  return new Date(ahora + LIMA_MS).toISOString().slice(0, 10);
}

/** Hora actual en Lima como "HH:MM". */
export function horaLima(ahora = Date.now()): string {
  return new Date(ahora + LIMA_MS).toISOString().slice(11, 16);
}

function aUtc(fecha: string): number {
  return Date.parse(`${fecha}T12:00:00Z`);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export function diaSemana(fecha: string): number {
  return new Date(aUtc(fecha)).getUTCDay();
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
}

/** Fechas desde `desde` hasta `hasta` (inclusive) cuyo día de semana está en `dias`. */
export function fechasRecurrentes(desde: string, hasta: string, dias: number[]): string[] {
  const resultado: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (dias.includes(diaSemana(f))) resultado.push(f);
  }
  return resultado;
}

/** true si el bloque ya empezó o es de un día anterior (no se puede pedir). */
export function yaEmpezo(h: { fecha: string; hora_inicio: string }, ahora = Date.now()): boolean {
  const hoy = hoyLima(ahora);
  return h.fecha < hoy || (h.fecha === hoy && h.hora_inicio <= horaLima(ahora));
}
