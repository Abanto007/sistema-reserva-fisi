/** Tarjetas seleccionables de espacios o equipos. */
export default function ListaRecursos({ recursos, elegido, onElegir, esEquipo }) {
  if (recursos === undefined) return <p className="selector-horarios__vacio">Cargando...</p>;
  if (recursos.length === 0) {
    return <p className="selector-horarios__vacio">No hay {esEquipo ? "equipos" : "espacios"} disponibles para tu tipo de cuenta.</p>;
  }
  return (
    <div className="grilla-recursos">
      {recursos.map((r) => (
        <button type="button" key={r._id} className={`recurso ${elegido === r._id ? "recurso--elegido" : ""}`} onClick={() => onElegir(r)} aria-pressed={elegido === r._id}>
          <span className="recurso__icono" aria-hidden="true">
            {esEquipo ? "💻" : "🏛️"}
          </span>
          <strong>{r.nombre}</strong>
          <span className="recurso__meta">{esEquipo ? `Stock: ${r.stock} ${r.stock === 1 ? "unidad" : "unidades"}` : `${r.ubicacion ?? ""} · ${r.capacidad} personas`}</span>
          {r.descripcion && <span className="recurso__desc">{r.descripcion}</span>}
        </button>
      ))}
    </div>
  );
}
