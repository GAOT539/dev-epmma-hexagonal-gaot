// ── API Route: POST /api/v1/auth/forgot-password ──────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword, generateTemporaryPassword } from "@/infrastructure/auth/password.utils";
import { enviarCorreoRestablecimiento } from "@/infrastructure/mail/smtp.service";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identificador } = body;

    // 1. Validar que el identificador no esté vacío
    if (!identificador || !String(identificador).trim()) {
      return NextResponse.json(
        { success: false, error: "Identificador, cédula o correo requerido." },
        { status: 400 }
      );
    }

    const cleanId = String(identificador).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 2. Si el identificador contiene '@', validar formato estricto de correo
    if (cleanId.includes("@") && !emailRegex.test(cleanId)) {
      return NextResponse.json(
        { success: false, error: "El formato del correo electrónico ingresado no es válido." },
        { status: 400 }
      );
    }

    // 3. Buscar usuario por cédula, correo (case-insensitive) o alias 'admin'
    const cleanEmail = cleanId.toLowerCase();
    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { cedula: cleanId },
          { correo: cleanId },
          { correo: cleanEmail },
          ...(cleanEmail === "admin"
            ? [{ rol: "SUPERADMIN" as const }]
            : []),
        ],
      },
    });

    // 4. Caso Usuario o Correo No Existente
    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          error: "No existe ningún usuario registrado en el sistema con el correo electrónico o número de cédula ingresado.",
        },
        { status: 404 }
      );
    }

    // 5. Caso Usuario Deshabilitado
    if (usuario.estado !== "Habilitado") {
      return NextResponse.json(
        {
          success: false,
          error: "La cuenta asociada a estos datos se encuentra deshabilitada. Contacte al administrador.",
        },
        { status: 403 }
      );
    }

    // 6. Caso Usuario sin Correo Válido en BD
    const destinoCorreo = usuario.correo?.trim();
    if (!destinoCorreo || !emailRegex.test(destinoCorreo)) {
      return NextResponse.json(
        {
          success: false,
          error: "El usuario encontrado no posee un correo electrónico válido registrado. Solicite al administrador actualizar su correo.",
        },
        { status: 400 }
      );
    }

    // 7. Atomicidad: Generar credencial temporal y enviar correo ANTES de sobrescribir BD
    const tempPassword = generateTemporaryPassword();
    const tempHash = await hashPassword(tempPassword);
    const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();

    const resultadoEnvio = await enviarCorreoRestablecimiento({
      correoDestino: destinoCorreo,
      nombreUsuario: nombreCompleto,
      cedulaUsuario: usuario.cedula,
      rolUsuario: usuario.rol,
      passwordTemporal: tempPassword,
    });

    // Si falló el envío SMTP, abortar sin tocar la contraseña actual del usuario
    if (!resultadoEnvio.enviado) {
      return NextResponse.json(
        {
          success: false,
          error:
            resultadoEnvio.errorDetalle ||
            "No fue posible enviar el correo de recuperación. Verifique que la dirección de correo sea válida e intente nuevamente.",
        },
        { status: 502 }
      );
    }

    // Solo si el correo fue efectivamente aceptado por el servidor SMTP, actualizar en BD
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: tempHash,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Se ha generado y enviado una contraseña temporal a ${destinoCorreo}.`,
      correoDestino: destinoCorreo,
      correoEnviado: destinoCorreo,
    });
  } catch (error) {
    logError("API", "Error en POST /api/v1/auth/forgot-password", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Error interno al procesar el restablecimiento." },
      { status: 500 }
    );
  }
}
