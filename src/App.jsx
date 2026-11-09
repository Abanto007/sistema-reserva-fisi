/**
 * Componente raíz: rutas de la aplicación.
 *  - Públicas: login, registro, recuperación de contraseña.
 *  - Privadas: dashboard.
 *  - Alumno, docente, foráneo y externo: reservar, pedir equipos y mis solicitudes.
 *  - Solo administrativo aprobado: validación de personal y gestión de horarios.
 */
import { Navigate, Route, Routes } from "react-router-dom";
import { RutaAdministrativo, RutaPrivada, RutaPublica, RutaSolicitante } from "./components/Rutas";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Recuperar from "./pages/Recuperar";
import Dashboard from "./pages/Dashboard";
import ValidacionPersonal from "./pages/ValidacionPersonal";
import GestionHorarios from "./pages/GestionHorarios";
import ReservarEspacio from "./pages/ReservarEspacio";
import PedirEquipos from "./pages/PedirEquipos";
import MisSolicitudes from "./pages/MisSolicitudes";
import Componentes from "./pages/Componentes";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<RutaPublica />}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
      </Route>
      <Route path="/recuperar" element={<Recuperar />} />
      <Route element={<RutaPrivada />}>
        <Route path="/inicio" element={<Dashboard />} />
      </Route>
      <Route element={<RutaSolicitante />}>
        <Route path="/solicitudes/espacio" element={<ReservarEspacio />} />
        <Route path="/solicitudes/equipos" element={<PedirEquipos />} />
        <Route path="/mis-solicitudes" element={<MisSolicitudes />} />
      </Route>
      <Route element={<RutaAdministrativo />}>
        <Route path="/admin/validacion" element={<ValidacionPersonal />} />
        <Route path="/admin/horarios" element={<GestionHorarios />} />
      </Route>
      <Route path="/componentes" element={<Componentes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
