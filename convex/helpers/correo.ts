"use node";
/**
 * Envío de correos con Nodemailer (igual que el informe).
 *  - Si existen las variables SMTP_HOST, SMTP_USER y SMTP_PASS (configuradas con
 *    `pnpm convex env set ...`), se usa ese servidor (por ejemplo Gmail con
 *    contraseña de aplicación).
 *  - Si no, se crea una cuenta de prueba de Ethereal Email y se devuelve el
 *    enlace de "Bandeja de prueba" que muestra la figura 7 del informe.
 *  - Con CORREO_MODO=simulado (pruebas automáticas) no se envía nada.
 */
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

type Resultado = { enviado: boolean; vistaPrevia: string | null };

export const enviar = internalAction({
  args: { para: v.string(), asunto: v.string(), html: v.string(), texto: v.string() },
  handler: async (_ctx, correo): Promise<Resultado> => {
    if (process.env.CORREO_MODO === "simulado") return { enviado: true, vistaPrevia: null };
    try {
      const nodemailer = (await import("nodemailer")).default;
      const usaSmtpPropio = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      let transporte;
      let remitente = process.env.SMTP_FROM ?? "Sistema de Reservas FISI <no-reply@fisi.unmsm.edu.pe>";
      if (usaSmtpPropio) {
        const puerto = Number(process.env.SMTP_PORT ?? 587);
        transporte = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: puerto,
          secure: puerto === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        remitente = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
      } else {
        const cuenta = await nodemailer.createTestAccount();
        transporte = nodemailer.createTransport({
          host: cuenta.smtp.host,
          port: cuenta.smtp.port,
          secure: cuenta.smtp.secure,
          auth: { user: cuenta.user, pass: cuenta.pass },
        });
      }
      const info = await transporte.sendMail({ from: remitente, to: correo.para, subject: correo.asunto, text: correo.texto, html: correo.html });
      const vistaPrevia = usaSmtpPropio ? null : nodemailer.getTestMessageUrl(info) || null;
      console.log(`Correo enviado a ${correo.para}: ${correo.asunto}${vistaPrevia ? ` (bandeja de prueba: ${vistaPrevia})` : ""}`);
      return { enviado: true, vistaPrevia };
    } catch (error) {
      // El fallo del correo no debe romper el flujo; queda registrado en los logs de Convex.
      console.error(`No se pudo enviar el correo a ${correo.para}:`, error);
      return { enviado: false, vistaPrevia: null };
    }
  },
});
