/**
 * Selector de horarios de un espacio o equipo: semana, días y bloques.
 * Los bloques ocupados, no disponibles o pasados se muestran bloqueados (HU-S01 criterio 4).
 * Se usa con key={recurso._id} para que cada recurso empiece en la semana actual.
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DIAS_CORTOS, diaSemana, fechaCorta, fechaLarga, hoyLima, inicioSemana, rangoSemana, sumarDias } from "../../lib/fechas";

export default function SelectorHorarios({ token, recurso, esEquipo, seleccionados, onAlternar }) {
  const hoy = hoyLima();
  const [lunes, setLunes] = useState(inicioSemana(hoy));
  const [diaElegido, setDia] = useState(null);
  const domingo = sumarDias(lunes, 6);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);

  const bloques = useQuery(api.recursos.horarios.deRecurso, {
    token,
    ...(esEquipo ? { id_objeto: recurso._id } : { id_lugar: recurso._id }),
    desde: lunes,
    hasta: domingo,
  });

  const libresPorDia = useMemo(() => {
    const m = {};
    for (const b of bloques ?? []) if (b.seleccionable) m[b.fecha] = (m[b.fecha] ?? 0) + 1;
    return m;
  }, [bloques]);

  // Día visible: el elegido por el usuario o, si no eligió uno de esta semana, el primero con horarios libres
  const sugerido = dias.find((d) => libresPorDia[d]) ?? dias.find((d) => d >= hoy) ?? lunes;
  const dia = diaElegido && dias.includes(diaElegido) ? diaElegido : sugerido;

  const delDia = (bloques ?? []).filter((b) => b.fecha === dia);

  function etiquetaBloque(b) {
    if (b.pasado) return "Ya pasó";
    if (b.estado === "no_disponible") return `No disponible${b.motivo_no_disponible ? `: ${b.motivo_no_disponible}` : ""}`;
    if (!b.seleccionable) return esEquipo ? "Sin unidades libres" : "Ocupado";
    return esEquipo ? `${b.libres} de ${recurso.stock} libres` : "Disponible";
  }

  return (
    <div className="selector-horarios">
      <div className="semana-nav semana-nav--compacta">
        <button type="button" className="semana-nav__flecha" aria-label="Semana anterior" disabled={lunes <= inicioSemana(hoy)} onClick={() => setLunes(sumarDias(lunes, -7))}>
          ‹
        </button>
        <span className="semana-nav__rango">{rangoSemana(lunes, domingo)}</span>
        <button type="button" className="semana-nav__flecha" aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))}>
          ›
        </button>
      </div>

      <div className="tira-dias">
        {dias.map((d) => (
          <button
            type="button"
            key={d}
            className={`tira-dias__dia ${d === dia ? "activo" : ""} ${d < hoy ? "pasado" : ""}`}
            onClick={() => setDia(d)}
          >
            <span>{DIAS_CORTOS[diaSemana(d)]}</span>
            <strong>{fechaCorta(d)}</strong>
            <em>{bloques === undefined ? "…" : libresPorDia[d] ? `${libresPorDia[d]} libre${libresPorDia[d] > 1 ? "s" : ""}` : "—"}</em>
          </button>
        ))}
      </div>

      {dia && <p className="selector-horarios__dia">Horarios del {fechaLarga(dia)}</p>}
      {bloques === undefined ? (
        <p className="selector-horarios__vacio">Cargando horarios...</p>
      ) : delDia.length === 0 ? (
        <p className="selector-horarios__vacio">No hay horarios publicados para este día. Prueba con otro día o semana.</p>
      ) : (
        <div className="grilla-bloques">
          {delDia.map((b) => {
            const elegido = seleccionados.includes(b._id);
            return (
              <button
                type="button"
                key={b._id}
                disabled={!b.seleccionable && !elegido}
                aria-pressed={elegido}
                className={`opcion-bloque ${elegido ? "opcion-bloque--elegido" : ""} ${b.seleccionable ? "" : "opcion-bloque--bloqueado"}`}
                onClick={() => onAlternar(b)}
              >
                <strong>
                  {b.hora_inicio} – {b.hora_fin}
                </strong>
                <span>{elegido ? "✓ Seleccionado" : etiquetaBloque(b)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
