/**
 * HU-S03 — Consultar y filtrar mis solicitudes.
 * Lista en tiempo real con búsqueda, filtros por estado, tipo y rango de fechas de uso,
 * y el detalle de cada solicitud (horario, prioridad, estado, comentarios).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import LayoutInterno from "../components/LayoutInterno";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import DetalleSolicitud from "../components/solicitudes/DetalleSolicitud";
import { useSesion } from "../hooks/useSesion";
import { codigoSolicitud, ESTADOS_SOLICITUD, fechaHoraPe, fechaPe, PRIORIDADES, TIPOS } from "../lib/solicitudes";

const FILTROS_ESTADO = ["pendiente", "recibida", "aceptada", "declinada"];

export default function MisSolicitudes() {
  const { token } = useSesion();
  const navegar = useNavigate();
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(null);

  const filas = useQuery(api.solicitudes.historial.mias, {
    token,
    ...(estado ? { estado } : {}),
    ...(tipo ? { tipo } : {}),
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  });
  const todas = useQuery(api.solicitudes.historial.mias, { token });

  const conteo = useMemo(() => {
    const c = {};
    for (const s of todas ?? []) c[s.estado] = (c[s.estado] ?? 0) + 1;
    return c;
  }, [todas]);

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!filas || !q) return filas;
    return filas.filter((s) =>
      [codigoSolicitud(s._id), s.motivo, ...s.espacios.map((e) => e.recurso), ...s.equipos.map((e) => e.recurso)].some((t) => t.toLowerCase().includes(q)),
    );
  }, [filas, texto]);

  const hayFiltros = estado || tipo || desde || hasta || texto;
  const limpiar = () => {
    setEstado("");
    setTipo("");
    setDesde("");
    setHasta("");
    setTexto("");
  };

  return (
    <LayoutInterno titulo="Mis Solicitudes">
      <div className="encabezado-pagina">
        <div>
          <h1 className="encabezado-pagina__titulo">Historial de Solicitudes (HU-S03)</h1>
          <p className="encabezado-pagina__subtitulo">Sigue el estado de tus reservas y préstamos. La lista se actualiza sola.</p>
        </div>
        <div className="encabezado-pagina__acciones">
          <Button variante="gris" chico onClick={() => navegar("/solicitudes/equipos")}>
            💻 Pedir equipos
          </Button>
          <Button variante="azul" chico onClick={() => navegar("/solicitudes/espacio")}>
            🏛️ Reservar espacio
          </Button>
        </div>
      </div>

      <div className="filtros">
        <div className="filtros__estados" role="tablist" aria-label="Filtrar por estado">
          <button role="tab" aria-selected={!estado} className={!estado ? "activo" : ""} onClick={() => setEstado("")}>
            Todas <span>{todas?.length ?? 0}</span>
          </button>
          {FILTROS_ESTADO.map((e) => (
            <button role="tab" key={e} aria-selected={estado === e} className={estado === e ? "activo" : ""} onClick={() => setEstado(e)}>
              <i className={`punto-estado punto-estado--${e}`} /> {ESTADOS_SOLICITUD[e]} <span>{conteo[e] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filtros__campos">
          <label className="filtro">
            <span>Buscar</span>
            <input className="campo__control" type="search" placeholder="Código, espacio, equipo o motivo" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <label className="filtro">
            <span>Tipo</span>
            <select className="campo__control" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t.texto}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro">
            <span>Fecha de uso desde</span>
            <input className="campo__control" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="filtro">
            <span>Hasta</span>
            <input className="campo__control" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <Button variante="gris" chico disabled={!hayFiltros} onClick={limpiar}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      <div className="tabla-contenedor">
        <table className="tabla tabla--clicable">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Recursos</th>
              <th>Fecha de uso</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Enviada</th>
            </tr>
          </thead>
          <tbody>
            {visibles === undefined ? (
              <tr>
                <td className="tabla-vacia" colSpan={7}>
                  Cargando solicitudes...
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td className="tabla-vacia" colSpan={7}>
                  {todas?.length === 0 ? (
                    <>
                      Aún no tienes solicitudes. <a onClick={() => navegar("/solicitudes/espacio")}>Haz tu primera reserva</a>.
                    </>
                  ) : (
                    "Ninguna solicitud coincide con los filtros."
                  )}
                </td>
              </tr>
            ) : (
              visibles.map((s) => (
                <tr key={s._id} tabIndex={0} onClick={() => setAbierta(s)} onKeyDown={(e) => e.key === "Enter" && setAbierta(s)}>
                  <td>
                    <span className="chip-codigo">{codigoSolicitud(s._id)}</span>
                  </td>
                  <td>
                    <Badge color={TIPOS[s.tipo].color}>{TIPOS[s.tipo].texto}</Badge>
                  </td>
                  <td>
                    <span className="tabla__fuerte">{resumenRecursos(s)}</span>
                  </td>
                  <td>
                    {fechaPe(s.fecha_uso_desde)}
                    {s.fecha_uso_hasta !== s.fecha_uso_desde && ` – ${fechaPe(s.fecha_uso_hasta)}`}
                  </td>
                  <td>
                    <span className={`prioridad prioridad--${s.prioridad}`}>{PRIORIDADES[s.prioridad]}</span>
                  </td>
                  <td>
                    <span className={`estado-solicitud estado-solicitud--${s.estado}`}>{ESTADOS_SOLICITUD[s.estado]}</span>
                  </td>
                  <td className="tabla__tenue">{fechaHoraPe(s.fecha_creacion)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {abierta && <ModalDetalle token={token} id={abierta._id} inicial={abierta} onCerrar={() => setAbierta(null)} />}
    </LayoutInterno>
  );
}

function resumenRecursos(s) {
  const nombres = [...new Set([...s.espacios.map((e) => e.recurso), ...s.equipos.map((e) => e.recurso)])];
  return nombres.length > 2 ? `${nombres.slice(0, 2).join(", ")} +${nombres.length - 2}` : nombres.join(", ");
}

/** Criterio 4: detalle de la solicitud (se mantiene actualizado en tiempo real). */
function ModalDetalle({ token, id, inicial, onCerrar }) {
  const s = useQuery(api.solicitudes.historial.detalle, { token, id }) ?? inicial;
  return (
    <Modal
      abierto
      ancho
      titulo={`Solicitud ${codigoSolicitud(s._id)}`}
      texto={`Enviada el ${fechaHoraPe(s.fecha_creacion)}`}
      onCerrar={onCerrar}
      acciones={
        <Button variante="gris" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      <div className="confirmacion__datos confirmacion__datos--modal">
        <div>
          <span>Estado</span>
          <span className={`estado-solicitud estado-solicitud--${s.estado}`}>{ESTADOS_SOLICITUD[s.estado]}</span>
        </div>
        <div>
          <span>Tipo</span>
          <Badge color={TIPOS[s.tipo].color}>
            {TIPOS[s.tipo].icono} {TIPOS[s.tipo].texto}
          </Badge>
        </div>
        <div>
          <span>Prioridad</span>
          <span className={`prioridad prioridad--${s.prioridad}`}>{PRIORIDADES[s.prioridad]}</span>
        </div>
      </div>
      <p className="detalle-motivo">
        <strong>Motivo:</strong> {s.motivo}
      </p>
      <DetalleSolicitud solicitud={s} />
      <div className="comentarios">
        <h4>💬 Comentarios del personal administrativo</h4>
        {s.comentarios.length === 0 ? (
          <p className="texto-tenue">Aún no hay comentarios. Aparecerán aquí cuando revisen tu solicitud.</p>
        ) : (
          s.comentarios.map((c, i) => (
            <p key={i}>
              <strong>{c.autor}:</strong> {c.texto}
            </p>
          ))
        )}
      </div>
    </Modal>
  );
}
