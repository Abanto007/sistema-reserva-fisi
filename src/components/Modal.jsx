/**
 * Ventana modal (rechazo con motivo, confirmaciones). Se cierra con Escape
 * o haciendo clic fuera.
 */
import { useEffect } from "react";

export default function Modal({ abierto, titulo, texto, onCerrar, acciones, ancho, children }) {
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e) => e.key === "Escape" && onCerrar?.();
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className={`modal ${ancho ? "modal--ancho" : ""}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <h2 className="modal__titulo">{titulo}</h2>
        {texto && <p className="modal__texto">{texto}</p>}
        {children}
        {acciones && <div className="modal__acciones">{acciones}</div>}
      </div>
    </div>
  );
}
