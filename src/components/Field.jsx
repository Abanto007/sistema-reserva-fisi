/**
 * Campo de formulario: etiqueta en negrita + input gris claro con foco azul.
 * Usa `as="select"` o `as="textarea"` para otros controles.
 */
import { useId } from "react";

export default function Field({ etiqueta, as = "input", enlace, error, ayuda, className = "", children, ...props }) {
  const id = useId();
  const Control = as;
  const clases = ["campo__control", error ? "campo__control--invalido" : "", className].filter(Boolean).join(" ");
  return (
    <div className="campo">
      {(etiqueta || enlace) && (
        <div className="campo__cabecera">
          {etiqueta && (
            <label className="campo__etiqueta" htmlFor={props.id ?? id}>
              {etiqueta}
            </label>
          )}
          {enlace}
        </div>
      )}
      <Control id={props.id ?? id} className={clases} aria-invalid={Boolean(error)} {...props}>
        {children}
      </Control>
      {error ? <span className="campo__error">{error}</span> : ayuda ? <span className="campo__ayuda">{ayuda}</span> : null}
    </div>
  );
}
