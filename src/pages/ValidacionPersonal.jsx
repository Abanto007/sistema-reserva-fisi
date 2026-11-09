/**
 * HU-U02 — Panel de Validación de Personal (figuras 12 y 13 del informe).
 * La lista es reactiva (Convex): si otro administrador aprueba a alguien,
 * la fila desaparece sola.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { ChipCodigo } from "../components/Badge";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import { useSesion } from "../hooks/useSesion";
import { leerError } from "../lib/errores";

const fechaCorta = (ms) => new Date(ms).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function ValidacionPersonal() {
  const { token, usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const pendientes = useQuery(api.auth.usuarios.pendientes, { token });
  const aprobar = useMutation(api.auth.usuarios.aprobar);
  const rechazar = useMutation(api.auth.usuarios.rechazar);

  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [aRechazar, setARechazar] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [refrescado, setRefrescado] = useState(false);

  async function alAprobar(fila) {
    if (!window.confirm(`¿Confirmas la aprobación de ${fila.nombre} como Personal Administrativo?`)) return;
    setProcesando(fila._id);
    try {
      const r = await aprobar({ token, id: fila._id });
      setAviso({ tipo: "exito", texto: `✅ Se aprobó a ${r.nombre}. Ahora cuenta con privilegios administrativos activos y se le notificó por correo.` });
    } catch (err) {
      setAviso({ tipo: "error", texto: leerError(err).mensaje });
    }
    setProcesando(null);
  }

  async function confirmarRechazo() {
    if (!motivo.trim()) return setErrorMotivo("El motivo es obligatorio.");
    setProcesando(aRechazar._id);
    try {
      const r = await rechazar({ token, id: aRechazar._id, motivo });
      setAviso({ tipo: "rechazo", texto: `Se rechazó la solicitud de ${r.nombre}. Se le notificó el motivo por correo.` });
      cerrarModal();
    } catch (err) {
      setErrorMotivo(leerError(err).mensaje);
    }
    setProcesando(null);
  }

  function cerrarModal() {
    setARechazar(null);
    setMotivo("");
    setErrorMotivo(null);
  }

  function actualizar() {
    // La lista ya es en tiempo real; el botón solo confirma visualmente.
    setRefrescado(true);
    setTimeout(() => setRefrescado(false), 1200);
  }

  async function salir() {
    await cerrarSesion();
    navegar("/login", { replace: true });
  }

  return (
    <div className="pagina pagina--sistema">
      <Navbar
        titulo="Validación de Personal"
        usuario={usuario}
        extra={
          <>
            <Button variante="rojo-navbar" onClick={() => navegar("/inicio")}>
              Volver al Inicio
            </Button>
            <Button variante="contorno" className="navbar__boton-doble" onClick={salir}>
              Cerrar
              <br />
              Sesión
            </Button>
          </>
        }
      />
      <main className="contenedor contenedor--ancho">
        <div className="encabezado-pagina">
          <div>
            <h1 className="encabezado-pagina__titulo">Validación de Personal Administrativo (HU-U02)</h1>
            <p className="encabezado-pagina__subtitulo">Revisa y aprueba los registros de cuentas con acreditación de cargo institucional.</p>
          </div>
          <Button variante="azul" chico onClick={actualizar}>
            🔄 {refrescado ? "Lista actualizada" : "Actualizar Lista"}
          </Button>
        </div>

        {aviso && (
          <div className="banner--exito-panel">
            <Banner tipo={aviso.tipo === "error" ? "error" : aviso.tipo === "rechazo" ? "aviso" : "exito"}>{aviso.texto}</Banner>
          </div>
        )}

        {pendientes === undefined ? (
          <div className="tabla-contenedor tabla-vacia">Cargando solicitudes...</div>
        ) : (
          <DataTable
            vacio="No hay solicitudes de personal administrativo pendientes de validación."
            filas={pendientes}
            columnas={[
              { clave: "nombre", titulo: "Nombre", render: (f) => <span className="tabla__fuerte">{f.nombre}</span> },
              { clave: "codigo_dni", titulo: "DNI / Código" },
              { clave: "correo", titulo: "Correo Institucional" },
              { clave: "documento", titulo: "Cód. Trabajador / Doc.", render: (f) => <ChipCodigo>{f.documento_validacion}</ChipCodigo> },
              { clave: "fecha", titulo: "Fecha Reg.", render: (f) => fechaCorta(f.fecha_creacion) },
              {
                clave: "acciones",
                titulo: "Acciones",
                render: (f) => (
                  <div className="tabla__acciones">
                    <Button variante="verde" chico disabled={procesando === f._id} onClick={() => alAprobar(f)}>
                      Aprobar
                    </Button>
                    <Button variante="rojo" chico disabled={procesando === f._id} onClick={() => setARechazar(f)}>
                      Rechazar
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </main>

      <Modal
        abierto={Boolean(aRechazar)}
        titulo="Rechazar solicitud"
        texto={aRechazar ? `Indica el motivo del rechazo de ${aRechazar.nombre}. Lo verá al intentar iniciar sesión y le llegará por correo.` : ""}
        onCerrar={cerrarModal}
        acciones={
          <>
            <Button variante="gris" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button variante="rojo" chico cargando={Boolean(procesando)} onClick={confirmarRechazo}>
              Confirmar Rechazo
            </Button>
          </>
        }
      >
        <Field
          id="motivoRechazo"
          etiqueta="Motivo del rechazo *"
          as="textarea"
          placeholder="Ej. El código de trabajador no figura en la planilla de la FISI."
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setErrorMotivo(null);
          }}
          error={errorMotivo}
          autoFocus
        />
      </Modal>
    </div>
  );
}
