/**
 * Etiquetas redondeadas. Incluye el badge de rol de la tarjeta de bienvenida
 * (figura 4: "DOCENTE UNMSM" ámbar, figura 14: "ADMINISTRATIVO FISI" morado).
 */
export default function Badge({ color = "gris", children }) {
  return <span className={`badge badge--${color}`}>{children}</span>;
}

const ROLES = {
  alumno: { texto: "Alumno UNMSM", color: "ambar" },
  docente: { texto: "Docente UNMSM", color: "ambar" },
  administrativo: { texto: "Administrativo FISI", color: "morado" },
  foraneo: { texto: "Foráneo", color: "azul" },
  externo: { texto: "Externo", color: "gris" },
};

export function BadgeRol({ rol }) {
  const r = ROLES[rol] ?? { texto: rol, color: "gris" };
  return <Badge color={r.color}>{r.texto}</Badge>;
}

export function ChipCodigo({ children }) {
  return <span className="chip-codigo">{children}</span>;
}
