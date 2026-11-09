/** Textos y colores compartidos por las pantallas de solicitudes. */
export const codigoSolicitud = (id) => `SOL-${String(id).slice(-6).toUpperCase()}`;

export const TIPOS = {
  reserva: { texto: "Reserva", icono: "🏛️", color: "azul" },
  prestamo: { texto: "Préstamo", icono: "💻", color: "morado" },
  conjunta: { texto: "Conjunta", icono: "🧩", color: "ambar" },
};

export const ESTADOS_SOLICITUD = {
  pendiente: "Pendiente",
  recibida: "Recibida",
  aceptada: "Aceptada",
  declinada: "Declinada",
  cancelada: "Cancelada",
};

export const PRIORIDADES = { baja: "Baja", normal: "Normal", alta: "Alta" };

/** "10/11/2026" */
export const fechaPe = (f) => (f ? f.split("-").reverse().join("/") : "—");

export const fechaHoraPe = (ms) =>
  new Date(ms).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
