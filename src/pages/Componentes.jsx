/**
 * Guía de componentes (Fase 0). Muestra todas las piezas visuales extraídas
 * del informe técnico para revisarlas antes de armar las pantallas reales.
 * Ruta: /componentes
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "../components/Navbar";
import { PildoraFisi } from "../components/AuthCard";
import Field from "../components/Field";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { BadgeRol, ChipCodigo } from "../components/Badge";
import ModuleCard from "../components/ModuleCard";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";

const FILAS_DEMO = [
  { _id: "1", nombre: "Lic. Javier Mendoza", dni: "20277990", correo: "postulante_admin_7990@unmsm.edu.pe", codigo: "ADM-FISI-7990", fecha: "05/10/2026" },
  { _id: "2", nombre: "Lic. Ana Torres", dni: "20278588", correo: "postulante_admin_8588@unmsm.edu.pe", codigo: "ADM-FISI-8588", fecha: "05/10/2026" },
];

function EstadoConexion() {
  const salud = useQuery(api.sistema.salud);
  if (salud === undefined) return <Banner tipo="info">Conectando con Convex...</Banner>;
  return (
    <Banner tipo="exito" titulo="Conexión con Convex:">
      {salud.status} · {salud.servicio}
    </Banner>
  );
}

export default function Componentes() {
  const [modal, setModal] = useState(false);
  const [rol, setRol] = useState("alumno");

  return (
    <div className="pagina">
      <Navbar
        titulo="Guía de Componentes"
        usuario={{ nombre: "Alejandro Vargas", correo: "estudiante_5871@unmsm.edu.pe" }}
        onCerrarSesion={() => {}}
      />
      <div className="contenedor">
        <EstadoConexion />

        <h2 className="seccion-titulo">Tarjeta de bienvenida</h2>
        <section className="bienvenida">
          <div>
            <BadgeRol rol="docente" />
            <h1 className="bienvenida__titulo">¡Bienvenido/a, Alejandro Vargas!</h1>
            <p className="bienvenida__texto">Has iniciado sesión correctamente en el Sistema Oficial de Reservas de la FISI.</p>
          </div>
          <div className="caja-datos">
            <div>
              <strong>Código / DNI:</strong> 20265871
            </div>
            <div>
              <strong>Correo:</strong> estudiante_5871@unmsm.edu.pe
            </div>
            <div>
              <strong>Estado:</strong> <span className="estado-activo">● Activo</span>
            </div>
          </div>
        </section>

        <h2 className="seccion-titulo">Módulos del Sistema</h2>
        <div className="grilla-modulos">
          <ModuleCard icono="🏛️" titulo="Reserva de Espacios (HU-S01)" descripcion="Reserva de auditorio, aulas de cómputo, laboratorios o salas de estudio de la facultad." etiqueta="Disponible en iteración 2" />
          <ModuleCard icono="💻" titulo="Préstamo de Recursos (HU-S02)" descripcion="Solicitud de proyectores, laptops, cables y accesorios para presentaciones académicas." etiqueta="Disponible en iteración 2" />
          <ModuleCard icono="📋" titulo="Historial de Solicitudes (HU-S03)" descripcion="Seguimiento en tiempo real del estado de tus solicitudes (Aprobado, En Revisión, Rechazado)." etiqueta="Abrir módulo" to="/componentes" />
        </div>

        <h2 className="seccion-titulo">Avisos</h2>
        <div className="form">
          <Banner tipo="exito">¡Registro completado con éxito! Redirigiendo al inicio de sesión...</Banner>
          <Banner tipo="aviso" icono="⏳" titulo="Cuenta Pendiente de Validación:">
            Tu cuenta administrativa se encuentra en estado PENDIENTE de validación por un administrador superior.
          </Banner>
          <Banner tipo="error" icono="⚠️" titulo="Cuenta Bloqueada:">
            Cuenta bloqueada por superar los 3 intentos fallidos. Utilice la opción de recuperación de contraseña.
            <div>
              <a href="#recuperar">Haz clic aquí para recuperar tu contraseña y desbloquear tu cuenta.</a>
            </div>
          </Banner>
          <Banner tipo="info" icono="📬" titulo="Bandeja de prueba:">
            <a href="#ethereal">Abrir correo en Ethereal Email</a>
          </Banner>
        </div>

        <h2 className="seccion-titulo">Botones y etiquetas</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Button variante="azul">Ir al Panel de Validación de Personal</Button>
          <Button variante="verde" chico>
            Aprobar
          </Button>
          <Button variante="rojo" chico>
            Rechazar
          </Button>
          <Button variante="gris">Cancelar</Button>
          <Button variante="azul" chico onClick={() => setModal(true)}>
            Abrir modal
          </Button>
          <BadgeRol rol="docente" />
          <BadgeRol rol="administrativo" />
          <ChipCodigo>ADM-FISI-7990</ChipCodigo>
          <span className="etiqueta-modulo">Disponible en iteración 2</span>
        </div>

        <h2 className="seccion-titulo">Tabla</h2>
        <DataTable
          columnas={[
            { clave: "nombre", titulo: "Nombre", render: (f) => <span className="tabla__fuerte">{f.nombre}</span> },
            { clave: "dni", titulo: "DNI / Código" },
            { clave: "correo", titulo: "Correo Institucional" },
            { clave: "codigo", titulo: "Cód. Trabajador / Doc.", render: (f) => <ChipCodigo>{f.codigo}</ChipCodigo> },
            { clave: "fecha", titulo: "Fecha Reg." },
            {
              clave: "acciones",
              titulo: "Acciones",
              render: () => (
                <div className="tabla__acciones">
                  <Button variante="verde" chico>
                    Aprobar
                  </Button>
                  <Button variante="rojo" chico>
                    Rechazar
                  </Button>
                </div>
              ),
            },
          ]}
          filas={FILAS_DEMO}
        />

        <h2 className="seccion-titulo">Formulario (dentro de la tarjeta de acceso)</h2>
        <section className="auth-card auth-card--ancha" style={{ margin: "0 auto" }}>
          <div className="auth-card__cuerpo">
            <header className="auth-card__cabecera">
              <PildoraFisi />
              <h1 className="auth-card__titulo">Crear Cuenta</h1>
              <p className="auth-card__subtitulo">Sistema de Reservas y Préstamos</p>
            </header>
            <form className="form" onSubmit={(e) => e.preventDefault()}>
              <div className="form-fila">
                <Field etiqueta="Código o DNI *" placeholder="20200123 / 72345678" />
                <Field etiqueta="Rol en FISI *" as="select" value={rol} onChange={(e) => setRol(e.target.value)}>
                  <option value="alumno">Alumno (UNMSM)</option>
                  <option value="docente">Docente (UNMSM)</option>
                  <option value="administrativo">Personal Administrativo</option>
                  <option value="foraneo">Foráneo</option>
                  <option value="externo">Externo</option>
                </Field>
              </div>
              <Field etiqueta="Nombre Completo *" placeholder="Ej. Juan Carlos Pérez" />
              {rol === "administrativo" && (
                <div className="campo-destacado">
                  <Field etiqueta="Código de Trabajador / Documento *" placeholder="ADM-FISI-XXXX" />
                </div>
              )}
              <Field etiqueta="Código de Seguridad (6 dígitos) *" className="campo__control--codigo" placeholder="000000" maxLength={6} />
              <Button type="submit">Registrarse en el Sistema</Button>
            </form>
          </div>
          <footer className="auth-card__pie">
            ¿Ya tienes una cuenta? <a href="#login">Inicia sesión aquí</a>
          </footer>
        </section>
      </div>

      <Modal
        abierto={modal}
        titulo="Rechazar solicitud"
        texto="Indica el motivo del rechazo. El postulante lo verá al intentar iniciar sesión."
        onCerrar={() => setModal(false)}
        acciones={
          <>
            <Button variante="gris" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button variante="rojo" chico onClick={() => setModal(false)}>
              Confirmar rechazo
            </Button>
          </>
        }
      >
        <Field etiqueta="Motivo del rechazo *" as="textarea" placeholder="Ej. El código de trabajador no coincide con planilla." />
      </Modal>
    </div>
  );
}
