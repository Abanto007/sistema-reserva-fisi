/**
 * Fechas de calendario ("YYYY-MM-DD") en hora de Lima, igual que convex/helpers/fechas.ts.
 */
const LIMA_MS = -5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const aUtc = (fecha) => Date.parse(`${fecha}T12:00:00Z`);

export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

export const hoyLima = () => new Date(Date.now() + LIMA_MS).toISOString().slice(0, 10);
export const sumarDias = (fecha, n) => new Date(aUtc(fecha) + n * DIA_MS).toISOString().slice(0, 10);
export const diaSemana = (fecha) => new Date(aUtc(fecha)).getUTCDay();

/** Lunes de la semana de `fecha`. */
export const inicioSemana = (fecha) => sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));

const partes = (fecha) => fecha.split("-").map(Number);

/** "10 nov" */
export function fechaCorta(fecha) {
  const [, m, d] = partes(fecha);
  return `${d} ${MESES[m - 1]}`;
}

/** "lunes 10 de noviembre de 2026" */
export function fechaLarga(fecha) {
  const [a, m, d] = partes(fecha);
  return `${DIAS_LARGOS[diaSemana(fecha)]} ${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

/** "10 – 16 nov 2026" o "28 oct – 3 nov 2026" */
export function rangoSemana(desde, hasta) {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  if (m1 === m2 && a1 === a2) return `${d1} – ${d2} ${MESES[m2 - 1]} ${a2}`;
  return `${d1} ${MESES[m1 - 1]}${a1 !== a2 ? ` ${a1}` : ""} – ${d2} ${MESES[m2 - 1]} ${a2}`;
}

/** Fechas entre `desde` y `hasta` (inclusive) cuyo día de semana está en `dias`. */
export function fechasRecurrentes(desde, hasta, dias) {
  const r = [];
  if (!desde || !hasta || hasta < desde) return r;
  for (let f = desde; f <= hasta && r.length < 400; f = sumarDias(f, 1)) if (dias.includes(diaSemana(f))) r.push(f);
  return r;
}

/** Horas cada 30 minutos entre apertura y cierre: ["07:00", "07:30", ...] */
export function horasDelDia(desde = "07:00", hasta = "22:00") {
  const r = [];
  for (let m = toMin(desde); m <= toMin(hasta); m += 30) r.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return r;
}
const toMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
