/**
 * Botones del sistema. Variantes: primario (rojo degradado, ancho completo),
 * azul, verde, rojo, contorno (barra superior), gris, rojo-navbar.
 */
export default function Button({ variante = "primario", chico = false, cargando = false, children, className = "", ...props }) {
  const clases = ["boton", `boton--${variante}`, chico ? "boton--chico" : "", className].filter(Boolean).join(" ");
  return (
    <button className={clases} disabled={cargando || props.disabled} {...props}>
      {cargando ? "Procesando..." : children}
    </button>
  );
}
