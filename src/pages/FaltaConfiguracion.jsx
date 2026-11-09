/**
 * Se muestra si falta VITE_CONVEX_URL (todavía no se ejecutó `pnpm convex dev`).
 */
import AuthCard from "../components/AuthCard";
import Banner from "../components/Banner";
import "../assets/styles/global.css";

export default function FaltaConfiguracion() {
  return (
    <AuthCard titulo="Falta conectar Convex" subtitulo="Sistema de Reservas y Préstamos">
      <div className="form">
        <Banner tipo="aviso" titulo="Configuración pendiente:">
          no se encontró la variable <code>VITE_CONVEX_URL</code>.
        </Banner>
        <p style={{ margin: 0 }}>
          En la carpeta del proyecto ejecuta <code>pnpm convex dev</code> en una terminal. Ese comando crea el archivo{" "}
          <code>.env.local</code>. Luego, en otra terminal, ejecuta <code>pnpm dev</code> y recarga esta página.
        </p>
      </div>
    </AuthCard>
  );
}
