/**
 * HU-U01 / HU-U02 — Iniciar Sesión (figuras 1, 5, 9 y 11 del informe).
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import AuthCard from "../components/AuthCard";
import Field from "../components/Field";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { useSesion } from "../hooks/useSesion";
import { leerError } from "../lib/errores";

function AvisoError({ error }) {
  if (!error) return null;
  switch (error.codigo) {
    case "BLOQUEADA":
      return (
        <Banner tipo="error" icono="⚠️" titulo="Cuenta Bloqueada:">
          {error.mensaje}
          <div style={{ marginTop: 6 }}>
            <Link to="/recuperar" style={{ textDecoration: "underline" }}>
              Haz clic aquí para recuperar tu contraseña y desbloquear tu cuenta.
            </Link>
          </div>
        </Banner>
      );
    case "PENDIENTE":
      return (
        <Banner tipo="aviso" className="banner--aviso-login" icono="⏳" titulo="Cuenta Pendiente de Validación:">
          {error.mensaje}
        </Banner>
      );
    case "RECHAZADA":
      return (
        <Banner tipo="error" icono="⛔" titulo="Solicitud Rechazada:">
          {error.mensaje}
          {error.detalle && (
            <div style={{ marginTop: 6 }}>
              <strong>Motivo:</strong> {error.detalle}
            </div>
          )}
        </Banner>
      );
    default:
      return (
        <Banner tipo="error" icono="⚠️" titulo="Error de acceso:">
          {error.mensaje} {error.detalle}
        </Banner>
      );
  }
}

export default function Login() {
  const iniciarSesion = useAction(api.auth.acciones.iniciarSesion);
  const { guardarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [identificador, setIdentificador] = useState(ubicacion.state?.identificador ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { token } = await iniciarSesion({ identificador, password });
      guardarSesion(token);
      navegar("/inicio", { replace: true });
    } catch (err) {
      setError(leerError(err));
      setEnviando(false);
    }
  }

  return (
    <AuthCard
      titulo="Iniciar Sesión"
      subtitulo="Sistema de Reservas y Préstamos"
      pie={
        <>
          ¿Aún no tienes cuenta? <Link to="/registro">Regístrate aquí</Link>
        </>
      }
    >
      <form className="form" onSubmit={alEnviar} noValidate>
        {ubicacion.state?.aviso && !error && <Banner tipo="exito">{ubicacion.state.aviso}</Banner>}
        <AvisoError error={error} />
        <Field
          id="identificador"
          etiqueta="Código Universitario, DNI o Correo"
          placeholder="Ej. 20200123, 72345678 o correo"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          autoComplete="username"
          required
        />
        <Field
          id="password"
          etiqueta="Contraseña"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          enlace={
            <Link className="campo__enlace" to="/recuperar">
              ¿Olvidaste tu contraseña?
            </Link>
          }
        />
        <Button type="submit" cargando={enviando}>
          Ingresar al Sistema
        </Button>
      </form>
    </AuthCard>
  );
}
