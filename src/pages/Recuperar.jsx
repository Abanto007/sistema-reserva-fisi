/**
 * HU-U01 — Recuperar Contraseña en dos pasos (figuras 6, 7 y 8 del informe).
 *  Paso 1: código/DNI + correo asociado (doble factor).
 *  Paso 2: OTP de 6 dígitos + nueva contraseña; desbloquea la cuenta.
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

const VOLVER = <Link to="/login">← Volver al inicio de sesión</Link>;

export default function Recuperar() {
  const solicitarCodigo = useAction(api.auth.acciones.solicitarCodigo);
  const restablecer = useAction(api.auth.acciones.restablecer);
  const navegar = useNavigate();

  const [paso, setPaso] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [correo, setCorreo] = useState("");
  const [envio, setEnvio] = useState(null); // { correo, vistaPrevia }
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!listo) return;
    const espera = setTimeout(
      () => navegar("/login", { state: { identificador: codigo, aviso: "Contraseña actualizada. Ya puedes iniciar sesión." } }),
      3000,
    );
    return () => clearTimeout(espera);
  }, [listo, navegar, codigo]);

  async function enviarCodigo(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      setEnvio(await solicitarCodigo({ codigo_dni: codigo, correo }));
      setPaso(2);
    } catch (err) {
      setError(leerError(err));
    }
    setEnviando(false);
  }

  async function verificar(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError({ mensaje: "La nueva contraseña debe tener al menos 6 caracteres." });
    if (password !== confirmar) return setError({ mensaje: "Las contraseñas no coinciden." });
    setEnviando(true);
    try {
      await restablecer({ codigo_dni: codigo, otp, password });
      setListo(true);
    } catch (err) {
      setError(leerError(err));
    }
    setEnviando(false);
  }

  const bandeja = envio?.vistaPrevia && (
    <Banner tipo="info" icono="📬" titulo="Bandeja de prueba:">
      <a href={envio.vistaPrevia} target="_blank" rel="noreferrer">
        Abrir correo en Ethereal Email
      </a>
    </Banner>
  );

  if (paso === 1) {
    return (
      <AuthCard titulo="Recuperar Contraseña" subtitulo="Verificación de Seguridad en Dos Pasos" ancho="media" pie={VOLVER}>
        <form className="form" onSubmit={enviarCodigo} noValidate>
          {error && (
            <Banner tipo="error" icono="⚠️" titulo="Verificación fallida:">
              {error.mensaje}
            </Banner>
          )}
          <p className="texto-proteccion">
            🔒 <strong>Protección contra terceros:</strong> Para verificar que eres el titular de la cuenta, ingresa tanto tu
            Código/DNI como el correo institucional asociado.
          </p>
          <Field id="codigoRecuperacion" etiqueta="Código Universitario o DNI *" placeholder="Ej. 20200101 o 72345678" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus />
          <Field id="correoRecuperacion" etiqueta="Correo Electrónico Asociado *" type="email" placeholder="ejemplo@unmsm.edu.pe" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          <Button type="submit" cargando={enviando}>
            Enviar Código de Seguridad
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard titulo="Recuperar Contraseña" subtitulo="Verificación del Código OTP y Nueva Contraseña" ancho="media" pie={VOLVER}>
      <form className="form" onSubmit={verificar} noValidate>
        {listo ? (
          <Banner tipo="exito">¡Contraseña restablecida exitosamente! Tu cuenta ha sido desbloqueada.</Banner>
        ) : (
          <Banner tipo="exito">Código de verificación de 6 dígitos enviado a {envio?.correo}.</Banner>
        )}
        {bandeja}
        {error && (
          <Banner tipo="error" icono="⚠️" titulo="No se pudo restablecer:">
            {error.mensaje}
          </Banner>
        )}
        <Field
          id="otp"
          etiqueta="Código de Seguridad (6 dígitos) *"
          className="campo__control--codigo"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          disabled={listo}
          autoFocus
        />
        <Field id="nuevaPassword" etiqueta="Nueva Contraseña (mínimo 6 caracteres) *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={listo} autoComplete="new-password" />
        <Field
          id="confirmarPassword"
          etiqueta="Confirmar Nueva Contraseña *"
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          disabled={listo}
          error={confirmar && confirmar !== password ? "No coinciden" : null}
          autoComplete="new-password"
        />
        <Button type="submit" cargando={enviando} disabled={listo}>
          Verificar y Desbloquear Cuenta
        </Button>
      </form>
    </AuthCard>
  );
}
