/** Confirmación de envío (HU-S01 y HU-S02, criterio 5). */
import Badge from "../Badge";
import DetalleSolicitud from "./DetalleSolicitud";
import { codigoSolicitud, PRIORIDADES, TIPOS } from "../../lib/solicitudes";

export default function Confirmacion({ solicitud, titulo = "¡Solicitud enviada correctamente!", children }) {
  const tipo = TIPOS[solicitud.tipo];
  return (
    <section className="confirmacion">
      <div className="confirmacion__icono" aria-hidden="true">
        ✓
      </div>
      <h2 className="confirmacion__titulo">{titulo}</h2>
      <p className="confirmacion__texto">
        Tu solicitud <span className="chip-codigo">{codigoSolicitud(solicitud._id)}</span> quedó registrada en estado <strong>Pendiente</strong>. El personal
        administrativo la revisará y te enviamos el detalle a tu correo.
      </p>
      <div className="confirmacion__datos">
        <div>
          <span>Tipo</span>
          <Badge color={tipo.color}>
            {tipo.icono} {tipo.texto}
          </Badge>
        </div>
        <div>
          <span>Prioridad</span>
          <strong>{PRIORIDADES[solicitud.prioridad]}</strong>
        </div>
        <div>
          <span>Motivo</span>
          <strong>{solicitud.motivo}</strong>
        </div>
      </div>
      <DetalleSolicitud solicitud={solicitud} />
      <div className="confirmacion__acciones">{children}</div>
    </section>
  );
}
