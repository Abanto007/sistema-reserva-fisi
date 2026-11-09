/**
 * Protección de rutas por sesión y por rol.
 */
import { Navigate, Outlet } from "react-router-dom";
import { useSesion } from "../hooks/useSesion";

function Cargando() {
  return <div className="pantalla-carga">Cargando...</div>;
}

export function RutaPublica() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  return usuario ? <Navigate to="/inicio" replace /> : <Outlet />;
}

export function RutaPrivada() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RutaAdministrativo() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  const esAdmin = usuario.rol === "administrativo" && usuario.estado_validacion === "aprobado";
  return esAdmin ? <Outlet /> : <Navigate to="/inicio" replace />;
}

/** Alumno, docente, foráneo y externo: los que envían solicitudes. */
export function RutaSolicitante() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  return usuario.rol === "administrativo" ? <Navigate to="/inicio" replace /> : <Outlet />;
}
