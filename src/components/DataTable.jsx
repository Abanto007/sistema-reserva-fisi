/**
 * Tabla con cabecera azul noche (figura 12).
 * columnas: [{ clave, titulo, render?(fila) }]
 */
export default function DataTable({ columnas, filas, claveFila = (f) => f._id, vacio = "No hay registros." }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td className="tabla-vacia" colSpan={columnas.length}>
                {vacio}
              </td>
            </tr>
          ) : (
            filas.map((f) => (
              <tr key={claveFila(f)}>
                {columnas.map((c) => (
                  <td key={c.clave}>{c.render ? c.render(f) : f[c.clave]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
