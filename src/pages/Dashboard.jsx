/**
 * Dashboard principal (figuras 4 y 14 del informe). Desde la iteración 2 los
 * módulos son enlaces activos: solicitudes para alumnos/docentes y gestión para el administrativo.
 */
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { BadgeRol } from "../components/Badge";
import ModuleCard from "../components/ModuleCard";
import { useSesion } from "../hooks/useSesion";

const MODULOS = [
  { icono: "🏛️", titulo: "Reserva de Espacios (HU-S01)", descripcion: "Reserva de auditorio, aulas de cómputo, laboratorios o salas de estudio de la facultad.", to: "/solicitudes/espacio" },
  { icono: "💻", titulo: "Préstamo de Recursos (HU-S02)", descripcion: "Solicitud de proyectores, laptops, cables y accesorios para presentaciones académicas.", to: "/solicitudes/equipos" },
  { icono: "📋", titulo: "Historial de Solicitudes (HU-S03)", descripcion: "Seguimiento en tiempo real del estado de tus solicitudes (Aprobado, En Revisión, Rechazado).", to: "/mis-solicitudes" },
];

const MODULOS_ADMIN = [
  { icono: "🪪", titulo: "Validación de Personal (HU-U02)", descripcion: "Aprueba o rechaza los registros de personal administrativo.", to: "/admin/validacion" },
  { icono: "📅", titulo: "Gestión de Horarios (HU-H01 / H02)", descripcion: "Crea bloques de horario y controla la disponibilidad de espacios y equipos.", to: "/admin/horarios" },
  { icono: "📥", titulo: "Atención de Solicitudes (HU-A01)", descripcion: "Acepta o rechaza las solicitudes de reserva y préstamo de los usuarios." },
];

export default function Dashboard() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const esAdmin = usuario.rol === "administrativo" && usuario.estado_validacion === "aprobado";
  const esSolicitante = usuario.rol !== "administrativo";

  async function salir() {
    await cerrarSesion();
    navegar("/login", { replace: true });
  }

  const datos = (
    <div className="caja-datos">
      <div>
        <strong>Código / DNI:</strong> {usuario.codigo_dni}
      </div>
      <div>
        <strong>Correo:</strong> {usuario.correo}
      </div>
      <div>
        <strong>Estado:</strong> <span className="estado-activo">● Activo</span>
      </div>
    </div>
  );

  return (
    <div className="pagina">
      <Navbar usuario={usuario} onCerrarSesion={salir} />
      <main className="contenedor">
        <section className={`bienvenida ${esAdmin ? "bienvenida--columna" : ""}`}>
          <div>
            <BadgeRol rol={usuario.rol} />
            <h1 className="bienvenida__titulo">¡Bienvenido/a, {usuario.nombre}!</h1>
            <p className="bienvenida__texto">Has iniciado sesión correctamente en el Sistema Oficial de Reservas de la FISI.</p>
          </div>
          {esAdmin && (
            <div className="bienvenida__botones">
              <Button variante="azul" onClick={() => navegar("/admin/validacion")}>
                Ir al Panel de Validación de Personal
              </Button>
              <Button variante="azul" onClick={() => navegar("/admin/horarios")}>
                📅 Gestionar Horarios
              </Button>
            </div>
          )}
          {datos}
        </section>

        <h2 className="seccion-titulo">Módulos del Sistema</h2>
        <div className="grilla-modulos">
          {(esAdmin ? MODULOS_ADMIN : esSolicitante ? MODULOS : []).map((m) => (
            <ModuleCard key={m.titulo} {...m} etiqueta={m.to ? "Ingresar →" : "Disponible en iteración 3"} />
          ))}
        </div>
      </main>
    </div>
  );
}
