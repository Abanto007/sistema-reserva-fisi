/**
 * HU-S02 — Enviar solicitud de préstamo de equipos, simple o conjunta.
 * Se eligen uno o más equipos con su horario y cantidad. La solicitud puede ir sola
 * o asociarse a una reserva de espacio pendiente (queda como solicitud conjunta).
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import LayoutInterno from "../components/LayoutInterno";
import Button from "../components/Button";
import Banner from "../components/Banner";
import Field from "../components/Field";
import ListaRecursos from "../components/solicitudes/ListaRecursos";
import SelectorHorarios from "../components/solicitudes/SelectorHorarios";
import Confirmacion from "../components/solicitudes/Confirmacion";
import { useSesion } from "../hooks/useSesion";
import { leerError } from "../lib/errores";
import { codigoSolicitud, fechaPe, PRIORIDADES } from "../lib/solicitudes";

const MAX_EQUIPOS = 10;

export default function PedirEquipos() {
  const { token } = useSesion();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const objetos = useQuery(api.recursos.objetos.disponibles, { token });
  const reservas = useQuery(api.solicitudes.prestamos.reservasParaAsociar, { token });
  const crear = useMutation(api.solicitudes.prestamos.crear);
  const agregarEquipos = useMutation(api.solicitudes.prestamos.agregarEquipos);

  const [modo, setModo] = useState(parametros.get("reserva") ? "asociar" : "independiente");
  const [idReserva, setIdReserva] = useState(parametros.get("reserva") ?? "");
  const [equipo, setEquipo] = useState(null);
  const [carrito, setCarrito] = useState([]); // [{ bloque, objeto, cantidad }]
  const [prioridad, setPrioridad] = useState("normal");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(null);

  // Si la reserva elegida ya no se puede asociar, se elige la primera; sin reservas, el préstamo es independiente
  useEffect(() => {
    if (!reservas) return;
    if (!reservas.some((r) => r._id === idReserva)) setIdReserva(reservas[0]?._id ?? "");
    if (reservas.length === 0) setModo("independiente");
  }, [reservas]); // eslint-disable-line react-hooks/exhaustive-deps

  function cambiarModo(m) {
    setModo(m);
    setError(null);
  }

  const reserva = reservas?.find((r) => r._id === idReserva) ?? null;

  function alternar(bloque) {
    setError(null);
    const existe = carrito.some((c) => c.bloque._id === bloque._id);
    if (existe) return setCarrito(carrito.filter((c) => c.bloque._id !== bloque._id));
    if (carrito.length >= MAX_EQUIPOS) return setError({ mensaje: `Puedes pedir como máximo ${MAX_EQUIPOS} equipos por solicitud.` });
    setCarrito(
      [...carrito, { bloque, objeto: equipo, cantidad: 1 }].sort((a, b) =>
        (a.bloque.fecha + a.bloque.hora_inicio + a.objeto.nombre).localeCompare(b.bloque.fecha + b.bloque.hora_inicio + b.objeto.nombre),
      ),
    );
  }

  const cambiarCantidad = (id, delta) =>
    setCarrito(carrito.map((c) => (c.bloque._id === id ? { ...c, cantidad: Math.min(c.bloque.libres, Math.max(1, c.cantidad + delta)) } : c)));

  async function enviar(e) {
    e.preventDefault();
    if (carrito.length === 0) return setError({ mensaje: "Agrega al menos un equipo con su horario." });
    if (modo === "asociar" && !reserva) return setError({ mensaje: "Elige la reserva a la que quieres asociar los equipos." });
    if (modo === "independiente" && !motivo.trim()) return setError({ mensaje: "Indica el motivo del préstamo." });
    const equipos = carrito.map((c) => ({ id_horario: c.bloque._id, cantidad: c.cantidad }));
    setEnviando(true);
    setError(null);
    try {
      setEnviada(
        modo === "asociar"
          ? await agregarEquipos({ token, id_solicitud: reserva._id, prioridad, equipos })
          : await crear({ token, motivo, prioridad, equipos }),
      );
    } catch (err) {
      setError(leerError(err));
    }
    setEnviando(false);
  }

  if (enviada) {
    return (
      <LayoutInterno titulo="Préstamo de Recursos">
        <Confirmacion solicitud={enviada} titulo={enviada.tipo === "conjunta" ? "¡Solicitud conjunta registrada!" : undefined}>
          <Button variante="azul" onClick={() => navegar("/mis-solicitudes")}>
            Ver mis solicitudes
          </Button>
          <Button
            variante="gris"
            onClick={() => {
              setEnviada(null);
              setCarrito([]);
              setMotivo("");
              setEquipo(null);
            }}
          >
            Pedir más equipos
          </Button>
        </Confirmacion>
      </LayoutInterno>
    );
  }

  return (
    <LayoutInterno titulo="Préstamo de Recursos">
      <div className="encabezado-pagina">
        <div>
          <h1 className="encabezado-pagina__titulo">Préstamo de Equipos (HU-S02)</h1>
          <p className="encabezado-pagina__subtitulo">Pide uno o varios equipos, solos o junto con una de tus reservas de espacio.</p>
        </div>
      </div>

      <form className="flujo-solicitud" onSubmit={enviar} noValidate>
        <div className="flujo-solicitud__pasos">
          <section className="paso">
            <h2 className="paso__titulo">
              <span className="paso__numero">1</span> ¿Cómo quieres enviarlo?
            </h2>
            <div className="opciones-modo">
              <label className={`opcion-modo ${modo === "independiente" ? "opcion-modo--activa" : ""}`}>
                <input type="radio" name="modo" checked={modo === "independiente"} onChange={() => cambiarModo("independiente")} />
                <strong>Préstamo independiente</strong>
                <span>Solo equipos, con su propio motivo.</span>
              </label>
              <label className={`opcion-modo ${modo === "asociar" ? "opcion-modo--activa" : ""} ${reservas?.length === 0 ? "opcion-modo--deshabilitada" : ""}`}>
                <input type="radio" name="modo" checked={modo === "asociar"} disabled={reservas?.length === 0} onChange={() => cambiarModo("asociar")} />
                <strong>Asociar a una de mis reservas (conjunta)</strong>
                <span>{reservas?.length === 0 ? "No tienes reservas de espacio pendientes." : "Los equipos se suman a una reserva de espacio pendiente, aunque ya tenga equipos."}</span>
              </label>
            </div>
            {modo === "asociar" && reservas?.length > 0 && (
              <Field id="reserva" etiqueta="Reserva de espacio *" as="select" value={idReserva} onChange={(e) => { setIdReserva(e.target.value); setError(null); }}>
                {reservas.map((r) => (
                  <option key={r._id} value={r._id}>
                    {codigoSolicitud(r._id)} · {r.espacios[0].recurso} · {fechaPe(r.espacios[0].fecha)} {r.espacios[0].hora_inicio}–{r.espacios.at(-1).hora_fin}
                    {r.equipos.length > 0 ? ` · ya tiene ${r.equipos.length} equipo${r.equipos.length > 1 ? "s" : ""}` : ""}
                  </option>
                ))}
              </Field>
            )}
          </section>

          <section className="paso">
            <h2 className="paso__titulo">
              <span className="paso__numero">2</span> Elige los equipos y su horario
            </h2>
            {reserva && modo === "asociar" && (
              <p className="paso__ayuda">
                Tu reserva es el {fechaPe(reserva.espacios[0].fecha)} de {reserva.espacios[0].hora_inicio} a {reserva.espacios.at(-1).hora_fin}. Elige equipos en ese
                horario.
              </p>
            )}
            <ListaRecursos recursos={objetos} elegido={equipo?._id} onElegir={setEquipo} esEquipo />
            {equipo && (
              <SelectorHorarios
                key={equipo._id}
                token={token}
                recurso={equipo}
                esEquipo
                seleccionados={carrito.filter((c) => c.objeto._id === equipo._id).map((c) => c.bloque._id)}
                onAlternar={alternar}
              />
            )}
          </section>

          <section className="paso">
            <h2 className="paso__titulo">
              <span className="paso__numero">3</span> Prioridad {modo === "independiente" && "y motivo"}
            </h2>
            <div className="campo">
              <span className="campo__etiqueta">Prioridad *</span>
              <div className="segmentado segmentado--prioridad">
                {Object.entries(PRIORIDADES).map(([valor, texto]) => (
                  <button type="button" key={valor} className={prioridad === valor ? "activo" : ""} onClick={() => setPrioridad(valor)}>
                    {texto}
                  </button>
                ))}
              </div>
            </div>
            {modo === "independiente" ? (
              <Field
                id="motivo"
                etiqueta="Motivo *"
                as="textarea"
                maxLength={500}
                placeholder="Ej. Sustentación de tesis en el aula 205."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            ) : (
              reserva && (
                <p className="paso__ayuda">
                  Se usará el motivo de tu reserva: <strong>{reserva.motivo}</strong>
                </p>
              )
            )}
          </section>
        </div>

        <aside className="resumen-solicitud">
          <h3>Resumen de tu solicitud</h3>
          <dl>
            <dt>Tipo</dt>
            <dd>{modo === "asociar" ? "Conjunta (espacio + equipos)" : "Préstamo de equipos"}</dd>
            {modo === "asociar" && reserva && (
              <>
                <dt>Espacio</dt>
                <dd>{reserva.espacios[0].recurso}</dd>
                {reserva.equipos.length > 0 && (
                  <>
                    <dt>Equipos que ya tiene</dt>
                    <dd>
                      {reserva.equipos.map((e) => (
                        <div key={e.id_horario} className="texto-tenue">
                          {e.recurso} ×{e.cantidad} · {e.hora_inicio}–{e.hora_fin}
                        </div>
                      ))}
                    </dd>
                  </>
                )}
              </>
            )}
            <dt>{modo === "asociar" && reserva?.equipos.length ? "Equipos a agregar" : "Equipos"}</dt>
            <dd>
              {carrito.length === 0 ? (
                <span className="texto-tenue">Sin elegir</span>
              ) : (
                <ul className="resumen-solicitud__lista">
                  {carrito.map((c) => (
                    <li key={c.bloque._id}>
                      <div>
                        <strong>{c.objeto.nombre}</strong>
                        <small>
                          {fechaPe(c.bloque.fecha)} · {c.bloque.hora_inicio} – {c.bloque.hora_fin}
                        </small>
                      </div>
                      <span className="contador">
                        <button type="button" aria-label="Menos" disabled={c.cantidad <= 1} onClick={() => cambiarCantidad(c.bloque._id, -1)}>
                          −
                        </button>
                        {c.cantidad}
                        <button type="button" aria-label="Más" disabled={c.cantidad >= c.bloque.libres} onClick={() => cambiarCantidad(c.bloque._id, 1)}>
                          +
                        </button>
                      </span>
                      <button type="button" aria-label="Quitar" onClick={() => alternar(c.bloque)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Prioridad</dt>
            <dd>{PRIORIDADES[prioridad]}</dd>
            <dt>Estado inicial</dt>
            <dd>
              <span className="estado-solicitud estado-solicitud--pendiente">Pendiente</span>
            </dd>
          </dl>
          {error && (
            <Banner tipo="error" icono="⚠️">
              {error.mensaje}
            </Banner>
          )}
          <Button type="submit" cargando={enviando}>
            {modo === "asociar" ? "Agregar a mi Reserva" : "Enviar Solicitud"}
          </Button>
          <p className="resumen-solicitud__nota">El sistema verifica las unidades libres de cada equipo antes de registrar tu solicitud.</p>
        </aside>
      </form>
    </LayoutInterno>
  );
}
