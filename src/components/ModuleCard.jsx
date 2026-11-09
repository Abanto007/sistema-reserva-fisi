/**
 * Tarjeta de módulo del dashboard (figura 4). Si recibe `to`, es un enlace activo.
 */
import { Link } from "react-router-dom";

export default function ModuleCard({ icono, titulo, descripcion, etiqueta, to }) {
  const contenido = (
    <>
      <div className="modulo__icono" aria-hidden="true">
        {icono}
      </div>
      <h3 className="modulo__titulo">{titulo}</h3>
      <p className="modulo__descripcion">{descripcion}</p>
      {etiqueta && <span className={`etiqueta-modulo ${to ? "etiqueta-modulo--activa" : ""}`}>{etiqueta}</span>}
    </>
  );
  return to ? (
    <Link className="modulo" to={to}>
      {contenido}
    </Link>
  ) : (
    <article className="modulo">{contenido}</article>
  );
}
