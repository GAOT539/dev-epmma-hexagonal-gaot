// ── Infraestructura: Servicio de Correo Transaccional con Gmail SMTP ─────────

import nodemailer from "nodemailer";
import { logInfo, logError } from "@/infrastructure/logger/system-logger";

interface ParametrosRestablecimiento {
  correoDestino: string;
  nombreUsuario: string;
  cedulaUsuario: string;
  rolUsuario: string;
  passwordTemporal: string;
}

/**
 * Obtiene la fecha y hora actual en la zona horaria de Ecuador (America/Guayaquil)
 * formateada de forma legible en español (ej. "24/10/2026, 16:05").
 */
function obtenerFechaHoraEcuadorLegible(): string {
  try {
    return new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Crea el transporte de correo SMTP utilizando variables de entorno de forma segura.
 * Remueve espacios de la contraseña de aplicación de Google para autenticación limpia.
 */
function crearTransporterSMTP() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const isSecure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || "";
  const rawPass = process.env.SMTP_PASS || "";
  const pass = rawPass.replace(/\s+/g, "");

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Envía el correo institucional con la contraseña temporal de restablecimiento
 * mediante el servidor SMTP oficial de Gmail.
 */
export async function enviarCorreoRestablecimiento(
  params: ParametrosRestablecimiento
): Promise<{ enviado: boolean; errorDetalle?: string }> {
  const { correoDestino, nombreUsuario, cedulaUsuario, rolUsuario, passwordTemporal } = params;
  const from = process.env.EMAIL_FROM || "EP-EMA Sistema de Gestión <sistema.epema@gmail.com>";
  const fechaHoraEcuador = obtenerFechaHoraEcuadorLegible();
  const anioActual = new Date().getFullYear();

  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <!-- Encabezado Institucional -->
      <div style="background-color: #15803D; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px;">EP-EMA</h1>
        <p style="margin: 6px 0 0; font-size: 14px; font-weight: 600; color: #f0fdf4;">Empresa Pública – Empresa Municipal Mercado Mayorista de Ambato</p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #dcfce7; font-style: italic;">Sistema de Gestión Operativa, Catastro y Control de Asistencia</p>
      </div>

      <!-- Cuerpo del Mensaje -->
      <div style="padding: 28px 24px; color: #1f2937;">
        <p style="font-size: 15px; margin: 0 0 14px;">Estimado/a <strong>${nombreUsuario}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px; color: #374151;">
          Se ha procesado una solicitud de restablecimiento de contraseña para su cuenta institucional en el Sistema de Gestión EP-EMA.
        </p>

        <!-- Resumen de Datos de la Cuenta -->
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #374151;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 45%;">Cédula / Identificación:</td>
              <td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${cedulaUsuario}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Correo Registrado:</td>
              <td style="padding: 4px 0;">${correoDestino}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Rol en el Sistema:</td>
              <td style="padding: 4px 0;">${rolUsuario}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Fecha y Hora de Solicitud:</td>
              <td style="padding: 4px 0;">${fechaHoraEcuador} (Ecuador)</td>
            </tr>
          </table>
        </div>

        <!-- Recuadro Central Clave Temporal -->
        <div style="background-color: #f0fdf4; border: 2px dashed #15803D; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">
            SU CONTRASEÑA TEMPORAL DE ACCESO ES:
          </p>
          <p style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: bold; color: #15803D; letter-spacing: 3px; margin: 8px 0 0;">
            ${passwordTemporal}
          </p>
        </div>

        <!-- Instrucciones Paso a Paso -->
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin-bottom: 18px;">
          <p style="margin: 0 0 8px; font-weight: 700; font-size: 13px;">Pasos obligatorios para ingresar:</p>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li>Diríjase a la pantalla de inicio de sesión del sistema EP-EMA.</li>
            <li>En el campo <strong>Correo / Cédula</strong>, ingrese su correo electrónico (<code>${correoDestino}</code>) o su número de cédula (<code>${cedulaUsuario}</code>).</li>
            <li>Ingrese la <strong>contraseña temporal</strong> mostrada arriba.</li>
            <li><strong>Cambio obligatorio:</strong> Por su seguridad, inmediatamente al iniciar sesión el sistema le solicitará crear una <strong>nueva contraseña personal</strong> (mínimo 8 caracteres, una letra mayúscula, un número y un carácter especial).</li>
          </ol>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.4; margin: 0;">
          Si usted no solicitó este cambio o requiere asistencia técnica, comuníquese con la Unidad de TIC de EP-EMA.
        </p>
      </div>

      <!-- Pie de Página Institucional -->
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0;">
          © ${anioActual} EP-EMA · Mercado Mayorista de Ambato. Este es un mensaje automático, por favor no responda a este correo.
        </p>
      </div>
    </div>
  `;

  try {
    const transporter = crearTransporterSMTP();
    const info = await transporter.sendMail({
      from,
      to: correoDestino,
      subject: "🔐 Recuperación de Contraseña Temporal — Sistema EP-EMA",
      html: htmlContent,
    });

    if (info.accepted && info.accepted.length > 0) {
      logInfo(
        "SMTP",
        `Correo de restablecimiento enviado exitosamente a '${correoDestino}' (MessageId: ${info.messageId}).`
      );
      return { enviado: true };
    }

    const detalle = "El servidor SMTP no aceptó la entrega del mensaje.";
    logError("SMTP", `Fallo en entrega a '${correoDestino}': ${detalle}`, info);
    return { enviado: false, errorDetalle: detalle };
  } catch (error) {
    const errorMensaje = error instanceof Error ? error.message : String(error);
    logError("SMTP", `Error al enviar correo de restablecimiento a '${correoDestino}': ${errorMensaje}`, error);
    return { enviado: false, errorDetalle: errorMensaje };
  }
}
