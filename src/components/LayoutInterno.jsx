/**
 * Marco de las páginas internas: barra superior con "Volver al Inicio" y "Cerrar Sesión".
 */
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Button from "./Button";
import { useSesion } from "../hooks/useSesion";

export default function LayoutInterno({ titulo, children }) {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();

  async function salir() {
    await cerrarSesion();
    navegar("/login", { replace: true });
  }

  return (
    <div className="pagina">
      <Navbar
        titulo={titulo}
        usuario={usuario}
        extra={
          <Button variante="rojo-navbar" onClick={() => navegar("/inicio")}>
            Volver al Inicio
          </Button>
        }
        onCerrarSesion={salir}
      />
      <main className="contenedor contenedor--ancho">{children}</main>
    </div>
  );
}
