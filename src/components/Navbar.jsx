/**
 * Barra superior azul noche con borde rojo (figuras 4, 12, 13 y 14).
 */
import Button from "./Button";

export default function Navbar({ titulo = "Sistema de Reservas y Préstamos", usuario, onCerrarSesion, extra }) {
  return (
    <header className="navbar">
      <div className="navbar__contenido">
        <div className="navbar__marca">
          <span className="logo-fisi">FISI • UNMSM</span>
          <span className="navbar__titulo">{titulo}</span>
        </div>
        <div className="navbar__acciones">
          {usuario && (
            <div className="navbar__usuario">
              <div className="navbar__nombre">{usuario.nombre}</div>
              <div className="navbar__correo">{usuario.correo}</div>
            </div>
          )}
          {extra}
          {onCerrarSesion && (
            <Button variante="contorno" onClick={onCerrarSesion}>
              Cerrar Sesión
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
