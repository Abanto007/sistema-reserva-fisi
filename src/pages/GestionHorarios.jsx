/**
 * HU-H01 y HU-H02 — Gestión de Horarios (personal administrativo).
 * Calendario semanal por recurso: crear bloques (también recurrentes), editarlos,
 * eliminarlos, marcarlos como no disponibles y revertirlos.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Banner from "../components/Banner";
import Modal from "../components/Modal";
import Field from "../components/Field";
import { useSesion } from "../hooks/useSesion";
import { leerError } from "../lib/errores";
import {
  DIAS_CORTOS,
  diaSemana,
  fechaCorta,
  fechaLarga,
  fechasRecurrentes,
  horasDelDia,
  hoyLima,
  inicioSemana,
  rangoSemana,
  sumarDias,
} from "../lib/fechas";

const ESTADOS = {
  disponible: { texto: "Disponible", clase: "disponible" },
  ocupado: { texto: "Ocupado", clase: "ocupado" },
  no_disponible: { texto: "No disponible", clase: "no-disponible" },
};
const MOTIVOS_RAPIDOS = ["Mantenimiento", "Reserva previa", "Evento institucional", "Limpieza"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // lunes primero
const HORAS = horasDelDia();

export default function GestionHorarios() {
  const { token, usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const hoy = hoyLima();

  const [tipo, setTipo] = useState("lugar"); // "lugar" | "objeto"
  const [lunes, setLunes] = useState(inicioSemana(hoy));
  const domingo = sumarDias(lunes, 6);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);

  const lugares = useQuery(api.recursos.lugares.listar, { token });
  const objetos = useQuery(api.recursos.objetos.listar, { token });
  const recursos = useMemo(() => (lugares && objetos ? { lugares, objetos } : undefined), [lugares, objetos]);
  const bloques = useQuery(api.recursos.horarios.calendario, { token, desde: lunes, hasta: domingo });

  const [aviso, setAviso] = useState(null);
  const [creando, setCreando] = useState(false);
  const [seleccion, setSeleccion] = useState(null); // { bloque, recurso }

  const lista = recursos ? (tipo === "lugar" ? recursos.lugares : recursos.objetos) : [];
  const bloquesDelTipo = (bloques ?? []).filter((b) => (tipo === "lugar" ? b.id_lugar : b.id_objeto));
  const porCelda = useMemo(() => {
    const mapa = new Map();
    for (const b of bloquesDelTipo) {
      const clave = `${b.id_lugar ?? b.id_objeto}|${b.fecha}`;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(b);
    }
    return mapa;
  }, [bloquesDelTipo]);
  const resumen = bloquesDelTipo.reduce((acc, b) => ({ ...acc, [b.estado]: (acc[b.estado] ?? 0) + 1 }), {});

  async function salir() {
    await cerrarSesion();
    navegar("/login", { replace: true });
  }

  return (
    <div className="pagina">
      <Navbar
        titulo="Gestión de Horarios"
        usuario={usuario}
        extra={
          <Button variante="rojo-navbar" onClick={() => navegar("/inicio")}>
            Volver al Inicio
          </Button>
        }
        onCerrarSesion={salir}
      />
      <main className="contenedor contenedor--ancho">
        <div className="encabezado-pagina">
          <div>
            <h1 className="encabezado-pagina__titulo">Gestión de Horarios (HU-H01 / HU-H02)</h1>
            <p className="encabezado-pagina__subtitulo">
              Crea bloques de horario y controla la disponibilidad de los espacios y equipos de la facultad.
            </p>
          </div>
          <Button variante="azul" chico onClick={() => setCreando(true)}>
            ＋ Crear Horario
          </Button>
        </div>

        {aviso && (
          <div className="banner--exito-panel">
            <Banner tipo={aviso.tipo} titulo={aviso.titulo}>
              {aviso.texto}
            </Banner>
          </div>
        )}

        <div className="calendario-barra">
          <div className="segmentado" role="tablist">
            <button role="tab" aria-selected={tipo === "lugar"} className={tipo === "lugar" ? "activo" : ""} onClick={() => setTipo("lugar")}>
              🏛️ Espacios
            </button>
            <button role="tab" aria-selected={tipo === "objeto"} className={tipo === "objeto" ? "activo" : ""} onClick={() => setTipo("objeto")}>
              💻 Equipos
            </button>
          </div>

          <div className="semana-nav">
            <button className="semana-nav__flecha" aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))}>
              ‹
            </button>
            <span className="semana-nav__rango">{rangoSemana(lunes, domingo)}</span>
            <button className="semana-nav__flecha" aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))}>
              ›
            </button>
            <Button variante="gris" chico onClick={() => setLunes(inicioSemana(hoy))} disabled={lunes === inicioSemana(hoy)}>
              Hoy
            </Button>
          </div>

          <div className="leyenda">
            {Object.entries(ESTADOS).map(([clave, e]) => (
              <span key={clave} className="leyenda__item">
                <span className={`leyenda__punto leyenda__punto--${e.clase}`} />
                {e.texto} <strong>{resumen[clave] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="calendario" style={{ "--columnas": 7 }}>
          <div className="calendario__esquina">{tipo === "lugar" ? "Espacio" : "Equipo"}</div>
          {dias.map((d) => (
            <div key={d} className={`calendario__dia ${d === hoy ? "calendario__dia--hoy" : ""} ${d < hoy ? "calendario__dia--pasado" : ""}`}>
              <span>{DIAS_CORTOS[diaSemana(d)]}</span>
              <strong>{fechaCorta(d)}</strong>
            </div>
          ))}

          {recursos === undefined || bloques === undefined ? (
            <div className="calendario__vacio">Cargando calendario...</div>
          ) : lista.length === 0 ? (
            <div className="calendario__vacio">No hay {tipo === "lugar" ? "espacios" : "equipos"} registrados.</div>
          ) : (
            lista.map((r) => (
              <FilaRecurso key={r._id} recurso={r} tipo={tipo} dias={dias} hoy={hoy} porCelda={porCelda} onElegir={(b) => setSeleccion({ bloque: b, recurso: r })} />
            ))
          )}
        </div>
        <p className="calendario__nota">Haz clic en un bloque para editarlo, eliminarlo o cambiar su disponibilidad.</p>
      </main>

      {creando && recursos && (
        <ModalCrear
          token={token}
          recursos={recursos}
          tipoInicial={tipo}
          onCerrar={() => setCreando(false)}
          onCreado={(r, nombre, primera) => {
            setCreando(false);
            setLunes(inicioSemana(primera));
            setAviso({
              tipo: "exito",
              texto: `✅ Se ${r.creados === 1 ? "creó 1 bloque" : `crearon ${r.creados} bloques`} de horario para "${nombre}". Ya están disponibles para las solicitudes.`,
            });
          }}
        />
      )}

      {seleccion && (
        <ModalBloque
          token={token}
          {...seleccion}
          hoy={hoy}
          onCerrar={() => setSeleccion(null)}
          onHecho={(texto, tipoAviso = "exito") => {
            setSeleccion(null);
            setAviso({ tipo: tipoAviso, texto });
          }}
        />
      )}
    </div>
  );
}

function FilaRecurso({ recurso, tipo, dias, hoy, porCelda, onElegir }) {
  return (
    <>
      <div className="calendario__recurso">
        <strong>{recurso.nombre}</strong>
        <span>{tipo === "lugar" ? `${recurso.ubicacion ?? ""} · ${recurso.capacidad} personas` : `Stock: ${recurso.stock} unidades`}</span>
        {recurso.estado !== "activo" && <span className="badge badge--gris calendario__estado-recurso">{recurso.estado}</span>}
      </div>
      {dias.map((d) => {
        const celda = porCelda.get(`${recurso._id}|${d}`) ?? [];
        return (
          <div key={d} className={`calendario__celda ${d < hoy ? "calendario__celda--pasada" : ""}`}>
            {celda.map((b) => (
              <button
                key={b._id}
                className={`bloque bloque--${ESTADOS[b.estado].clase}`}
                onClick={() => onElegir(b)}
                title={b.motivo_no_disponible ?? (b.solicitante ? `Solicitado por ${b.solicitante.nombre}` : ESTADOS[b.estado].texto)}
              >
                <span className="bloque__hora">
                  {b.hora_inicio} – {b.hora_fin}
                </span>
                {b.estado !== "disponible" && <span className="bloque__estado">{ESTADOS[b.estado].texto}</span>}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Crear horario (HU-H01 criterios 1 a 4)
// ---------------------------------------------------------------------------
function ModalCrear({ token, recursos, tipoInicial, onCerrar, onCreado }) {
  const crear = useMutation(api.recursos.horarios.crear);
  const manana = sumarDias(hoyLima(), 1);
  const [tipo, setTipo] = useState(tipoInicial);
  const lista = (tipo === "lugar" ? recursos.lugares : recursos.objetos).filter((r) => r.estado !== "inactivo");
  const [idRecurso, setIdRecurso] = useState(lista[0]?._id ?? "");
  const [fecha, setFecha] = useState(manana);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("10:00");
  const [repetir, setRepetir] = useState(false);
  const [diasSemana, setDiasSemana] = useState([diaSemana(manana)]);
  const [hasta, setHasta] = useState(sumarDias(manana, 27));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const fechas = repetir ? fechasRecurrentes(fecha, hasta, diasSemana) : fecha ? [fecha] : [];

  function cambiarTipo(t) {
    setTipo(t);
    const nueva = (t === "lugar" ? recursos.lugares : recursos.objetos).filter((r) => r.estado !== "inactivo");
    setIdRecurso(nueva[0]?._id ?? "");
  }

  function cambiarFecha(f) {
    setFecha(f);
    if (f && !repetir) setDiasSemana([diaSemana(f)]);
  }

  const alternarDia = (d) => setDiasSemana((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!idRecurso) return setError({ mensaje: "Selecciona un espacio o equipo." });
    if (fin <= inicio) return setError({ mensaje: "La hora de fin debe ser mayor que la de inicio." });
    if (repetir && diasSemana.length === 0) return setError({ mensaje: "Elige al menos un día de la semana." });
    setEnviando(true);
    try {
      const r = await crear({
        token,
        ...(tipo === "lugar" ? { id_lugar: idRecurso } : { id_objeto: idRecurso }),
        fecha,
        hora_inicio: inicio,
        hora_fin: fin,
        ...(repetir ? { repetir: { dias: diasSemana, hasta } } : {}),
      });
      onCreado(r, lista.find((x) => x._id === idRecurso)?.nombre ?? "", r.fechas[0]);
    } catch (err) {
      setError(leerError(err));
    }
    setEnviando(false);
  }

  return (
    <Modal abierto ancho titulo="Crear horario" texto="Define el recurso, la fecha y el rango horario del nuevo bloque." onCerrar={onCerrar}>
      <form className="form form--compacto" onSubmit={guardar} noValidate>
        {error && (
          <Banner tipo="error" icono="⚠️">
            {error.mensaje}
            {error.detalle && <div className="banner__detalle">{error.detalle}</div>}
          </Banner>
        )}
        <div className="segmentado segmentado--ancho">
          <button type="button" className={tipo === "lugar" ? "activo" : ""} onClick={() => cambiarTipo("lugar")}>
            🏛️ Espacio
          </button>
          <button type="button" className={tipo === "objeto" ? "activo" : ""} onClick={() => cambiarTipo("objeto")}>
            💻 Equipo
          </button>
        </div>
        <Field id="recurso" etiqueta={tipo === "lugar" ? "Espacio *" : "Equipo *"} as="select" value={idRecurso} onChange={(e) => setIdRecurso(e.target.value)}>
          {lista.map((r) => (
            <option key={r._id} value={r._id}>
              {r.nombre}
            </option>
          ))}
        </Field>
        <div className="form-fila form-fila--3">
          <Field id="fecha" etiqueta={repetir ? "Desde *" : "Fecha *"} type="date" min={hoyLima()} value={fecha} onChange={(e) => cambiarFecha(e.target.value)} />
          <Field id="inicio" etiqueta="Hora inicio *" as="select" value={inicio} onChange={(e) => setInicio(e.target.value)}>
            {HORAS.slice(0, -1).map((h) => (
              <option key={h}>{h}</option>
            ))}
          </Field>
          <Field id="fin" etiqueta="Hora fin *" as="select" value={fin} onChange={(e) => setFin(e.target.value)}>
            {HORAS.slice(1).map((h) => (
              <option key={h}>{h}</option>
            ))}
          </Field>
        </div>

        <label className="casilla">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
          Repetir cada semana (horario recurrente)
        </label>

        {repetir && (
          <div className="campo-destacado">
            <div className="campo">
              <span className="campo__etiqueta">Días de la semana *</span>
              <div className="dias-semana">
                {ORDEN_DIAS.map((d) => (
                  <button type="button" key={d} className={diasSemana.includes(d) ? "activo" : ""} onClick={() => alternarDia(d)} aria-pressed={diasSemana.includes(d)}>
                    {DIAS_CORTOS[d]}
                  </button>
                ))}
              </div>
            </div>
            <Field id="hasta" etiqueta="Hasta *" type="date" min={fecha} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        )}

        <p className="resumen-creacion">
          {fechas.length === 0
            ? "Ningún día coincide con la selección."
            : fechas.length === 1
              ? `Se creará 1 bloque: ${fechaLarga(fechas[0])}, ${inicio} – ${fin}.`
              : `Se crearán ${fechas.length} bloques de ${inicio} a ${fin}, del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas.at(-1))}.`}
        </p>

        <div className="modal__acciones">
          <Button type="button" variante="gris" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" variante="azul" chico cargando={enviando} disabled={fechas.length === 0}>
            Crear {fechas.length > 1 ? `${fechas.length} bloques` : "bloque"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detalle de un bloque: editar, eliminar (H01 criterio 5), no disponible y revertir (H02)
// ---------------------------------------------------------------------------
function ModalBloque({ token, bloque, recurso, hoy, onCerrar, onHecho }) {
  const editar = useMutation(api.recursos.horarios.editar);
  const eliminar = useMutation(api.recursos.horarios.eliminar);
  const marcarNoDisponible = useMutation(api.recursos.horarios.marcarNoDisponible);
  const marcarDisponible = useMutation(api.recursos.horarios.marcarDisponible);

  const [modo, setModo] = useState("ver"); // ver | editar | bloquear | eliminar
  const [fecha, setFecha] = useState(bloque.fecha);
  const [inicio, setInicio] = useState(bloque.hora_inicio);
  const [fin, setFin] = useState(bloque.hora_fin);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const pasado = bloque.fecha < hoy;
  const rango = `${bloque.hora_inicio} – ${bloque.hora_fin}`;
  const estado = ESTADOS[bloque.estado];

  async function ejecutar(accion, mensaje) {
    setError(null);
    setEnviando(true);
    try {
      await accion();
      onHecho(mensaje);
    } catch (err) {
      setError(leerError(err));
      setEnviando(false);
    }
  }

  const acciones = {
    ver: (
      <>
        <Button variante="gris" onClick={onCerrar}>
          Cerrar
        </Button>
        {!pasado && bloque.estado === "disponible" && (
          <>
            <Button variante="rojo" chico className="boton--contorno-rojo" onClick={() => setModo("eliminar")}>
              Eliminar
            </Button>
            <Button variante="azul" chico onClick={() => setModo("editar")}>
              Editar
            </Button>
            <Button variante="rojo" chico onClick={() => setModo("bloquear")}>
              Marcar no disponible
            </Button>
          </>
        )}
        {!pasado && bloque.estado === "no_disponible" && (
          <Button
            variante="verde"
            chico
            cargando={enviando}
            onClick={() => ejecutar(() => marcarDisponible({ token, id: bloque._id }), `✅ El bloque ${rango} de "${recurso.nombre}" volvió a estar disponible.`)}
          >
            Revertir a disponible
          </Button>
        )}
      </>
    ),
    editar: (
      <>
        <Button variante="gris" onClick={() => setModo("ver")}>
          Volver
        </Button>
        <Button
          variante="azul"
          chico
          cargando={enviando}
          onClick={() =>
            ejecutar(
              () => editar({ token, id: bloque._id, fecha, hora_inicio: inicio, hora_fin: fin }),
              `✅ Se actualizó el bloque de "${recurso.nombre}" al ${fechaCorta(fecha)}, ${inicio} – ${fin}.`,
            )
          }
        >
          Guardar cambios
        </Button>
      </>
    ),
    bloquear: (
      <>
        <Button variante="gris" onClick={() => setModo("ver")}>
          Volver
        </Button>
        <Button
          variante="rojo"
          chico
          cargando={enviando}
          onClick={() =>
            motivo.trim()
              ? ejecutar(
                  () => marcarNoDisponible({ token, id: bloque._id, motivo }),
                  `Se marcó como no disponible el bloque ${rango} de "${recurso.nombre}". Los usuarios ya no podrán seleccionarlo.`,
                )
              : setError({ mensaje: "Indica el motivo." })
          }
        >
          Confirmar
        </Button>
      </>
    ),
    eliminar: (
      <>
        <Button variante="gris" onClick={() => setModo("ver")}>
          Volver
        </Button>
        <Button
          variante="rojo"
          chico
          cargando={enviando}
          onClick={() => ejecutar(() => eliminar({ token, id: bloque._id }), `Se eliminó el bloque ${rango} del ${fechaCorta(bloque.fecha)} de "${recurso.nombre}".`)}
        >
          Sí, eliminar
        </Button>
      </>
    ),
  }[modo];

  return (
    <Modal abierto ancho titulo={recurso.nombre} texto={`${fechaLarga(bloque.fecha)} · ${rango}`} onCerrar={onCerrar} acciones={acciones}>
      <div className="detalle-bloque">
        <span className={`estado-pill estado-pill--${estado.clase}`}>{estado.texto}</span>
        {bloque.motivo_no_disponible && (
          <p>
            <strong>Motivo:</strong> {bloque.motivo_no_disponible}
          </p>
        )}
        {bloque.solicitante && (
          <p>
            <strong>Solicitado por:</strong> {bloque.solicitante.nombre} (solicitud {bloque.solicitante.estado})
          </p>
        )}
        {bloque.estado === "ocupado" && <p className="texto-ayuda">Este bloque tiene una solicitud, por eso no se puede editar ni eliminar.</p>}
        {pasado && <p className="texto-ayuda">Es un horario pasado; ya no se puede modificar.</p>}
      </div>

      {error && (
        <Banner tipo="error" icono="⚠️">
          {error.mensaje}
        </Banner>
      )}

      {modo === "editar" && (
        <div className="form form--compacto">
          <Field id="editarFecha" etiqueta="Fecha *" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <div className="form-fila">
            <Field id="editarInicio" etiqueta="Hora inicio *" as="select" value={inicio} onChange={(e) => setInicio(e.target.value)}>
              {HORAS.slice(0, -1).map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Field>
            <Field id="editarFin" etiqueta="Hora fin *" as="select" value={fin} onChange={(e) => setFin(e.target.value)}>
              {HORAS.slice(1).map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Field>
          </div>
        </div>
      )}

      {modo === "bloquear" && (
        <div className="form form--compacto">
          <div className="motivos-rapidos">
            {MOTIVOS_RAPIDOS.map((m) => (
              <button type="button" key={m} className={motivo === m ? "activo" : ""} onClick={() => setMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
          <Field
            id="motivoNoDisponible"
            etiqueta="Motivo *"
            as="textarea"
            placeholder="Ej. Mantenimiento del sistema de sonido."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {modo === "eliminar" && (
        <Banner tipo="aviso" icono="⚠️">
          ¿Seguro que deseas eliminar este bloque? Esta acción no se puede deshacer.
        </Banner>
      )}
    </Modal>
  );
}
