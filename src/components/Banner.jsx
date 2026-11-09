/**
 * Aviso con barra lateral de color (figuras 3, 5, 7, 10, 11 y 13 del informe).
 * tipo: "exito" | "aviso" | "error" | "info"
 */
export default function Banner({ tipo = "info", titulo, icono, className = "", children, ...props }) {
  return (
    <div className={`banner banner--${tipo} ${className}`.trim()} role={tipo === "error" || tipo === "aviso" ? "alert" : "status"} {...props}>
      <div>
        {icono && <span aria-hidden="true">{icono} </span>}
        {titulo && <span className="banner__titulo">{titulo} </span>}
        {children}
      </div>
    </div>
  );
}
