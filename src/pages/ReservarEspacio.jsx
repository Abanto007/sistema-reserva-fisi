/**
 * HU-S01 — Enviar solicitud de reserva de espacio.
 * 1) espacio, 2) fecha y horario disponible, 3) motivo. Queda pendiente con prioridad normal.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { fechaPe } from "../lib/solicitudes";

const MAX_BLOQUES = 4;

export default function ReservarEspacio() {
  const { token } = useSesion();
  const navegar = useNavigate();
  const lugares = useQuery(api.recursos.lugares.disponibles, { token });
  const crear = useMutation(api.solicitudes.reservas.crear);

  const [espacio, setEspacio] = useState(null);
  const [bloques, setBloques] = useState([]); // bloques elegidos (objetos completos)
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(null);

  function elegirEspacio(r) {
    if (r._id === espacio?._id) return;
    setEspacio(r);
    setBloques([]);
    setError(null);
  }

  function alternar(b) {
    setError(null);
    setBloques((actual) => {
      if (actual.some((x) => x._id === b._id)) return actual.filter((x) => x._id !== b._id);
      if (actual.length >= MAX_BLOQUES) {
        setError({ mensaje: `Puedes elegir como máximo ${MAX_BLOQUES} bloques por solicitud.` });
        return actual;
      }
      return [...actual, b].sort((x, y) => (x.fecha + x.hora_inicio).localeCompare(y.fecha + y.hora_inicio));
    });
  }

  async function enviar(e) {
    e.preventDefault();
    if (!espacio) return setError({ mensaje: "Elige un espacio." });
    if (bloques.length === 0) return setError({ mensaje: "Elige al menos un horario disponible." });
    if (!motivo.trim()) return setError({ mensaje: "Indica el motivo de la reserva." });
    setEnviando(true);
    setError(null);
    try {
      setEnviada(await crear({ token, motivo, espacios: bloques.map((b) => b._id) }));
    } catch (err) {
      setError(leerError(err));
      // Si alguien tomó el horario mientras tanto, se quita de la selección
      if (leerError(err).codigo === "CONFLICTO") setBloques([]);
    }
    setEnviando(false);
  }

  function reiniciar() {
    setEnviada(null);
    setEspacio(null);
    setBloques([]);
    setMotivo("");
  }

  if (enviada) {
    return (
      <LayoutInterno titulo="Reserva de Espacios">
        <Confirmacion solicitud={enviada}>
          <Button variante="azul" onClick={() => navegar("/mis-solicitudes")}>
            Ver mis solicitudes
          </Button>
          <Button variante="gris" onClick={() => navegar(`/solicitudes/equipos?reserva=${enviada._id}`)}>
            💻 Agregar equipos a esta reserva
          </Button>
          <Button variante="gris" onClick={reiniciar}>
            Hacer otra reserva
          </Button>
        </Confirmacion>
      </LayoutInterno>
    );
  }

  return (
    <LayoutInterno titulo="Reserva de Espacios">
      <div className="encabezado-pagina">
        <div>
          <h1 className="encabezado-pagina__titulo">Reserva de Espacios (HU-S01)</h1>
          <p className="encabezado-pagina__subtitulo">Elige el espacio, el horario disponible y cuéntanos para qué lo necesitas.</p>
        </div>
      </div>

      <form className="flujo-solicitud" onSubmit={enviar} noValidate>
        <div className="flujo-solicitud__pasos">
          <section className="paso">
            <h2 className="paso__titulo">
              <span className="paso__numero">1</span> Elige el espacio
            </h2>
            <ListaRecursos recursos={lugares} elegido={espacio?._id} onElegir={elegirEspacio} />
          </section>

          <section className={`paso ${espacio ? "" : "paso--inactivo"}`}>
            <h2 className="paso__titulo">
              <span className="paso__numero">2</span> Elige la fecha y el horario
            </h2>
            {espacio ? (
              <SelectorHorarios key={espacio._id} token={token} recurso={espacio} seleccionados={bloques.map((b) => b._id)} onAlternar={alternar} />
            ) : (
              <p className="selector-horarios__vacio">Primero elige un espacio.</p>
            )}
          </section>

          <section className={`paso ${bloques.length ? "" : "paso--inactivo"}`}>
            <h2 className="paso__titulo">
              <span className="paso__numero">3</span> Motivo de la reserva
            </h2>
            <Field
              id="motivo"
              etiqueta="Motivo *"
              as="textarea"
              maxLength={500}
              placeholder="Ej. Exposición final del curso de Ingeniería de Software con 60 asistentes."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </section>
        </div>

        <aside className="resumen-solicitud">
          <h3>Resumen de tu solicitud</h3>
          <dl>
            <dt>Espacio</dt>
            <dd>{espacio ? espacio.nombre : <span className="texto-tenue">Sin elegir</span>}</dd>
            <dt>Horarios</dt>
            <dd>
              {bloques.length === 0 ? (
                <span className="texto-tenue">Sin elegir</span>
              ) : (
                <ul className="resumen-solicitud__lista">
                  {bloques.map((b) => (
                    <li key={b._id}>
                      {fechaPe(b.fecha)} · {b.hora_inicio} – {b.hora_fin}
                      <button type="button" aria-label="Quitar" onClick={() => alternar(b)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Prioridad</dt>
            <dd>Normal</dd>
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
            Enviar Solicitud
          </Button>
          <p className="resumen-solicitud__nota">El horario queda apartado para ti mientras tu solicitud esté en revisión.</p>
          <p className="paso__ayuda">
            💻 ¿Necesitas proyector, micrófono u otro equipo? Al enviar podrás <strong>agregar equipos a esta reserva</strong> y quedará como solicitud conjunta.
          </p>
        </aside>
      </form>
    </LayoutInterno>
  );
}
