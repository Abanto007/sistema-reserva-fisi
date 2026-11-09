/**
 * Plantillas de correo con la identidad visual del sistema.
 */
function marco(titulo: string, cuerpo: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border-top:5px solid #b91c1c;padding:28px">
    <div style="display:inline-block;background:#b91c1c;color:#fff;font-weight:800;font-size:13px;padding:5px 12px;border-radius:6px">FISI • UNMSM</div>
    <h2 style="color:#0e2b5c;margin:18px 0 8px">${titulo}</h2>
    ${cuerpo}
    <p style="color:#94a3b8;font-size:12px;margin-top:28px">Sistema de Reservas y Préstamos - FISI UNMSM. Este es un mensaje automático.</p>
  </div>
</div>`;
}

export function plantillaOtp(nombre: string, otp: string) {
  return {
    asunto: "Código de seguridad para recuperar tu contraseña - FISI",
    texto: `Hola ${nombre}. Tu código de seguridad es ${otp}. Vence en 15 minutos. Si no lo solicitaste, ignora este correo.`,
    html: marco(
      "Recuperación de contraseña",
      `<p style="color:#334155">Hola <b>${nombre}</b>, usa este código para restablecer tu contraseña y desbloquear tu cuenta:</p>
       <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0e2b5c;text-align:center;background:#f1f5f9;border-radius:8px;padding:14px">${otp}</p>
       <p style="color:#64748b">El código vence en <b>15 minutos</b>. Si no lo solicitaste, ignora este correo.</p>`,
    ),
  };
}

export function plantillaValidacion(nombre: string, aprobado: boolean, motivo?: string) {
  return aprobado
    ? {
        asunto: "Tu cuenta administrativa fue aprobada - FISI",
        texto: `Hola ${nombre}. Tu cuenta de Personal Administrativo fue aprobada. Ya puedes iniciar sesión.`,
        html: marco(
          "Cuenta aprobada",
          `<p style="color:#334155">Hola <b>${nombre}</b>, tu registro como <b>Personal Administrativo</b> fue validado. Ya puedes iniciar sesión y acceder a los módulos de gestión.</p>`,
        ),
      }
    : {
        asunto: "Tu solicitud de cuenta administrativa fue rechazada - FISI",
        texto: `Hola ${nombre}. Tu solicitud fue rechazada. Motivo: ${motivo ?? "-"}`,
        html: marco(
          "Solicitud rechazada",
          `<p style="color:#334155">Hola <b>${nombre}</b>, tu solicitud de cuenta administrativa fue rechazada.</p>
           <p style="background:#fee2e2;border-left:4px solid #b91c1c;color:#991b1b;padding:12px;border-radius:6px"><b>Motivo:</b> ${motivo ?? "-"}</p>`,
        ),
      };
}

type DetalleSolicitud = {
  _id: string;
  tipo: "reserva" | "prestamo" | "conjunta";
  prioridad: string;
  motivo: string;
  espacios: { recurso: string; fecha: string; hora_inicio: string; hora_fin: string }[];
  equipos: { recurso: string; cantidad: number; fecha: string; hora_inicio: string; hora_fin: string }[];
};

/** Código corto y legible de una solicitud: SOL-XXXXXX */
export const codigoSolicitud = (id: string) => `SOL-${id.slice(-6).toUpperCase()}`;

const TIPOS = { reserva: "reserva de espacio", prestamo: "préstamo de equipos", conjunta: "solicitud conjunta" } as const;
const fechaPe = (f: string) => f.split("-").reverse().join("/");

/** HU-S01 / HU-S02 criterio 5: confirmación con el detalle de lo solicitado. */
export function plantillaSolicitud(nombre: string, s: DetalleSolicitud) {
  const filas = [
    ...s.espacios.map((e) => `🏛️ ${e.recurso}: ${fechaPe(e.fecha)}, ${e.hora_inicio}–${e.hora_fin}`),
    ...s.equipos.map((e) => `💻 ${e.recurso} ×${e.cantidad}: ${fechaPe(e.fecha)}, ${e.hora_inicio}–${e.hora_fin}`),
  ];
  const codigo = codigoSolicitud(s._id);
  return {
    asunto: `Solicitud ${codigo} recibida - FISI`,
    texto: `Hola ${nombre}. Registramos tu ${TIPOS[s.tipo]} ${codigo} en estado PENDIENTE.\n${filas.join("\n")}\nMotivo: ${s.motivo}`,
    html: marco(
      "Solicitud enviada",
      `<p style="color:#334155">Hola <b>${nombre}</b>, registramos tu <b>${TIPOS[s.tipo]}</b> con el código <b>${codigo}</b>. Está <b>pendiente</b> de revisión por el personal administrativo.</p>
       <ul style="color:#0f172a;padding-left:18px">${filas.map((f) => `<li style="margin:4px 0">${f}</li>`).join("")}</ul>
       <p style="color:#64748b"><b>Motivo:</b> ${s.motivo}<br><b>Prioridad:</b> ${s.prioridad}</p>`,
    ),
  };
}
