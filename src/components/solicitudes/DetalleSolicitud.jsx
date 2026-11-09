/** Lista de bloques de espacio y equipos de una solicitud. */
import { fechaPe } from "../../lib/solicitudes";

export default function DetalleSolicitud({ solicitud }) {
  return (
    <div className="detalle-solicitud">
      {solicitud.espacios.length > 0 && (
        <div>
          <h4>🏛️ Espacio</h4>
          <ul>
            {solicitud.espacios.map((e) => (
              <li key={e.id_horario}>
                <strong>{e.recurso}</strong> · {fechaPe(e.fecha)} · {e.hora_inicio} – {e.hora_fin}
              </li>
            ))}
          </ul>
        </div>
      )}
      {solicitud.equipos.length > 0 && (
        <div>
          <h4>💻 Equipos</h4>
          <ul>
            {solicitud.equipos.map((e) => (
              <li key={e.id_horario}>
                <strong>
                  {e.recurso} ×{e.cantidad}
                </strong>{" "}
                · {fechaPe(e.fecha)} · {e.hora_inicio} – {e.hora_fin}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
