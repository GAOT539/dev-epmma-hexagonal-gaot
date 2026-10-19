// ── API Route: POST /api/v1/auth/forgot-password ──────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword, generateTemporaryPassword } from "@/infrastructure/auth/password.utils";
import { enviarCorreoRestablecimiento } from "@/infrastructure/mail/resend.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identificador } = body;

    if (!identificador) {
      return NextResponse.json(
        { success: false, error: "Identificador o correo requerido." },
        { status: 400 }
      );
    }

    const cleanId = String(identificador).trim();

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { cedula: cleanId },
          { correo: cleanId },
          ...(cleanId.toLowerCase() === "admin"
            ? [{ rol: "SUPERADMIN" as const }]
            : []),
        ],
      },
    });

    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró ningún usuario con los datos proporcionados.",
        },
        { status: 404 }
      );
    }

    // Generar contraseña temporal segura
    const tempPassword = generateTemporaryPassword();
    const tempHash = await hashPassword(tempPassword);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: tempHash,
        mustChangePassword: true,
      },
    });

    const destinoCorreo = usuario.correo || `${usuario.cedula}@ep-ema.gob.ec`;
    const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();

    // Enviar correo transaccional vía Resend
    const resultadoEnvio = await enviarCorreoRestablecimiento({
      correoDestino: destinoCorreo,
      nombreUsuario: nombreCompleto,
      passwordTemporal: tempPassword,
    });

    return NextResponse.json({
      success: true,
      mensaje: `Se ha generado y enviado una contraseña temporal a ${destinoCorreo}.`,
      correoDestino: destinoCorreo,
      modo: resultadoEnvio.modo,
      // Solo en modo desarrollo exponemos la clave para facilidad de pruebas
      ...(resultadoEnvio.modo === "desarrollo" ? { tempPasswordDev: tempPassword } : {}),
    });
  } catch (error) {
    console.error("Error en POST /api/v1/auth/forgot-password:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar el restablecimiento." },
      { status: 500 }
    );
  }
}
