/**
 * Sesión del usuario en el navegador. El token lo entrega Convex al iniciar
 * sesión y se envía en cada query/mutation privada. El perfil se obtiene con
 * la query reactiva auth.yo: si un administrador cambia algo, se actualiza solo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const CLAVE = "fisi_token";
const SesionContext = createContext(null);

function leerToken() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function SesionProvider({ children }) {
  const [token, setToken] = useState(leerToken);
  const usuario = useQuery(api.auth.acciones.yo, token ? { token } : "skip");
  const cerrarEnServidor = useMutation(api.auth.acciones.cerrarSesion);

  const guardarSesion = useCallback((nuevo) => {
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* almacenamiento bloqueado: la sesión dura lo que dure la pestaña */
    }
    setToken(nuevo);
  }, []);

  const limpiarSesion = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada que limpiar */
    }
    setToken(null);
  }, []);

  const cerrarSesion = useCallback(async () => {
    const actual = token;
    limpiarSesion();
    if (actual) await cerrarEnServidor({ token: actual }).catch(() => {});
  }, [token, limpiarSesion, cerrarEnServidor]);

  // Token vencido o inválido: se limpia
  useEffect(() => {
    if (token && usuario === null) limpiarSesion();
  }, [token, usuario, limpiarSesion]);

  const valor = useMemo(
    () => ({
      token,
      usuario: token ? usuario : null, // undefined = cargando
      cargando: Boolean(token) && usuario === undefined,
      guardarSesion,
      cerrarSesion,
    }),
    [token, usuario, guardarSesion, cerrarSesion],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de <SesionProvider>");
  return ctx;
}
