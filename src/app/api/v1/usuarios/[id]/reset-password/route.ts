// ── API Route: POST /api/v1/usuarios/[id]/reset-password ─────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/infrastructure/auth/password.utils";
import { logError } from "@/infrastructure/logger/system-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    // Restablecer a la clave inicial institucional: ${cedula}*
    const nuevaClave = `${usuario.cedula}*`;
    const passwordHash = await hashPassword(nuevaClave);

    await prisma.usuario.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Contraseña restablecida exitosamente para el usuario ${usuario.nombres} ${usuario.apellidos}. La clave temporal es su cédula seguida de un asterisco.`,
    });
  } catch (error) {
    logError("USUARIOS:RESET-PASSWORD", "Error en POST /api/v1/usuarios/[id]/reset-password", error);
    return NextResponse.json(
      { error: "Error interno al restablecer la contraseña." },
      { status: 500 }
    );
  }
}
