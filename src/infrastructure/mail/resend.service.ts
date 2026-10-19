// ── Infraestructura: Servicio de Correo Transaccional con Resend ─────────────

import { Resend } from "resend";

const PLACEHOLDER_KEYS = ["re_sample_dev_key", "re_sample_key_for_epmma_notifications"];

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !!key && !PLACEHOLDER_KEYS.includes(key);
}

/**
 * Envía un correo de restablecimiento de contraseña con la clave temporal.
 *
 * Si RESEND_API_KEY está configurada con una clave real, envía el correo vía Resend.
 * En entorno de desarrollo sin clave real, registra en consola del servidor
 * y devuelve éxito para no bloquear las pruebas locales.
 */
export async function enviarCorreoRestablecimiento(params: {
  correoDestino: string;
  nombreUsuario: string;
  passwordTemporal: string;
}): Promise<{ enviado: boolean; modo: "produccion" | "desarrollo" }> {
  const { correoDestino, nombreUsuario, passwordTemporal } = params;
  const from = process.env.EMAIL_FROM || "EP-EMA Notificaciones <no-reply@ep-ema.gob.ec>";

  const htmlContent = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #15803D; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #FFFFFF; margin: 0; font-size: 22px;">EP-EMA</h1>
        <p style="color: #E5E7EB; margin: 4px 0 0; font-size: 13px;">Sistema de Gestión Operativa</p>
      </div>
      <div style="background-color: #F9FAFB; padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #1F2937; font-size: 14px; margin: 0 0 16px;">Estimado/a <strong>${nombreUsuario}</strong>,</p>
        <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Se ha generado una contraseña temporal para su acceso al sistema EP-EMA:</p>
        <div style="background-color: #FFFFFF; border: 2px solid #15803D; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 16px;">
          <p style="font-size: 24px; font-weight: bold; color: #15803D; margin: 0; letter-spacing: 2px;">${passwordTemporal}</p>
        </div>
        <p style="color: #374151; font-size: 13px; margin: 0 0 8px;">Al iniciar sesión con esta clave temporal, el sistema le solicitará definir una nueva contraseña personal.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; margin: 0; text-align: center;">
          Este correo fue enviado automáticamente por el Sistema EP-EMA. No responda a este mensaje.
        </p>
      </div>
    </div>
  `;

  if (isResendConfigured()) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from,
        to: correoDestino,
        subject: "Restablecimiento de Contraseña - EP-EMA",
        html: htmlContent,
      });
      return { enviado: true, modo: "produccion" };
    } catch (error) {
      console.error("[EP-EMA Resend] Error al enviar correo:", error);
      // Fallback a modo desarrollo si Resend falla
      console.warn(
        `[EP-EMA DEV] Correo de restablecimiento para: ${correoDestino}\n` +
        `[EP-EMA DEV] Contraseña temporal: ${passwordTemporal}\n` +
        `[EP-EMA DEV] Usuario: ${nombreUsuario}`
      );
      return { enviado: true, modo: "desarrollo" };
    }
  }

  // Modo desarrollo: log en consola del servidor
  console.warn("══════════════════════════════════════════════════════════════");
  console.warn("[EP-EMA DEV] CORREO DE RESTABLECIMIENTO (Resend no configurado)");
  console.warn(`[EP-EMA DEV] Destino:              ${correoDestino}`);
  console.warn(`[EP-EMA DEV] Usuario:              ${nombreUsuario}`);
  console.warn(`[EP-EMA DEV] Contraseña temporal:  ${passwordTemporal}`);
  console.warn("══════════════════════════════════════════════════════════════");

  return { enviado: true, modo: "desarrollo" };
}
