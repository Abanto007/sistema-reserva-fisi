/**
 * HU-U01 / HU-U02 — Crear Cuenta (figuras 2, 3 y 10 del informe).
 * Formulario a 2 columnas; el código de trabajador aparece al elegir
 * "Personal Administrativo".
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import AuthCard from "../components/AuthCard";
import Field from "../components/Field";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { leerError } from "../lib/errores";

const ROLES = [
  { valor: "alumno", texto: "Alumno (UNMSM)" },
  { valor: "docente", texto: "Docente (UNMSM)" },
  { valor: "administrativo", texto: "Personal Administrativo" },
  { valor: "foraneo", texto: "Foráneo (otra universidad)" },
  { valor: "externo", texto: "Externo" },
];

const VACIO = { codigo_dni: "", rol: "alumno", nombre: "", correo: "", documento_validacion: "", password: "", confirmar: "" };

export default function Registro() {
  const registrar = useAction(api.auth.acciones.registrar);
  const navegar = useNavigate();
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null); // "activo" | "pendiente"
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const esAdmin = datos.rol === "administrativo";

  // Validación en vivo de contraseñas (figura 2)
  const passwordCorta = datos.password.length > 0 && datos.password.length < 6;
  const noCoinciden = datos.confirmar.length > 0 && datos.confirmar !== datos.password;

  // Tras registrar: redirección automática al login (figura 3)
  useEffect(() => {
    if (!resultado) return;
    const espera = setTimeout(
      () => navegar("/login", { state: { identificador: datos.codigo_dni } }),
      resultado === "pendiente" ? 4500 : 2500,
    );
    return () => clearTimeout(espera);
  }, [resultado, navegar, datos.codigo_dni]);

  async function alEnviar(e) {
    e.preventDefault();
    if (resultado) return; // ya registrado: esperando la redirección
    setError(null);
    if (datos.password.length < 6) return setError({ mensaje: "La contraseña debe tener al menos 6 caracteres." });
    if (datos.password !== datos.confirmar) return setError({ mensaje: "Las contraseñas no coinciden." });
    setEnviando(true);
    try {
      const r = await registrar({
        codigo_dni: datos.codigo_dni,
        rol: datos.rol,
        nombre: datos.nombre,
        correo: datos.correo,
        password: datos.password,
        documento_validacion: esAdmin ? datos.documento_validacion : undefined,
      });
      setResultado(r.estado);
    } catch (err) {
      setError(leerError(err));
      setEnviando(false);
    }
  }

  const bloqueado = Boolean(resultado);
  // Figuras 3 y 5: el alumno/docente ve el formulario normal; el administrativo, el botón y el rol atenuados
  const pendiente = resultado === "pendiente";

  return (
    <AuthCard
      titulo="Crear Cuenta"
      subtitulo="Sistema de Reservas y Préstamos"
      ancho="ancha"
      pie={
        <>
          ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión aquí</Link>
        </>
      }
    >
      <form className="form" onSubmit={alEnviar} noValidate>
        {resultado === "activo" && <Banner tipo="exito">¡Registro completado con éxito! Redirigiendo al inicio de sesión...</Banner>}
        {resultado === "pendiente" && (
          <Banner tipo="pendiente">
            ¡Registro completado! Tu cuenta está en estado PENDIENTE. Un administrador validará tu cargo.
          </Banner>
        )}
        {error && (
          <Banner tipo="error" icono="⚠️" titulo="No se pudo registrar:">
            {error.mensaje}
          </Banner>
        )}

        <div className="form-fila">
          <Field id="codigo_dni" etiqueta="Código o DNI *" placeholder="20200123 / 72345678" value={datos.codigo_dni} onChange={cambiar("codigo_dni")} readOnly={bloqueado} required />
          <Field id="rol" etiqueta="Rol en FISI *" as="select" value={datos.rol} onChange={cambiar("rol")} disabled={pendiente}>
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.texto}
              </option>
            ))}
          </Field>
        </div>
        <Field id="nombre" etiqueta="Nombre Completo *" placeholder="Ej. Juan Carlos Pérez" value={datos.nombre} onChange={cambiar("nombre")} readOnly={bloqueado} required />
        <Field id="correo" etiqueta="Correo Electrónico *" type="email" placeholder="ejemplo@unmsm.edu.pe o gmail.com" value={datos.correo} onChange={cambiar("correo")} readOnly={bloqueado} required />
        {esAdmin && (
          <div className="campo-destacado">
            <Field
              id="codigoTrabajador"
              etiqueta="Código de Trabajador / Documento *"
              placeholder="ADM-FISI-XXXX"
              value={datos.documento_validacion}
              onChange={cambiar("documento_validacion")}
              readOnly={bloqueado}
              required
            />
          </div>
        )}
        <div className="form-fila">
          <Field
            id="password"
            etiqueta="Contraseña *"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={datos.password}
            onChange={cambiar("password")}
            readOnly={bloqueado}
            error={passwordCorta ? "Mínimo 6 caracteres" : null}
            autoComplete="new-password"
          />
          <Field
            id="confirmar"
            etiqueta="Confirmar *"
            type="password"
            placeholder="Repite la contraseña"
            value={datos.confirmar}
            onChange={cambiar("confirmar")}
            readOnly={bloqueado}
            error={noCoinciden ? "No coinciden" : null}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" cargando={enviando && !bloqueado} disabled={pendiente}>
          Registrarse en el Sistema
        </Button>
      </form>
    </AuthCard>
  );
}
