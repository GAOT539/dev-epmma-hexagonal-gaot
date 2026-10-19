// ── API Route: POST /api/v1/auth/change-password ──────────────────────────────

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/infrastructure/database/prisma";
import { AUTH_COOKIE_NAME, verificarTokenJwt } from "@/infrastructure/auth/jwt.utils";
import {
  hashPassword,
  verifyPasswordHash,
  validatePasswordComplexity,
} from "@/infrastructure/auth/password.utils";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    let userId: string | null = null;

    if (token) {
      const payload = await verificarTokenJwt(token);
      if (payload?.sub) {
        userId = payload.sub;
      }
    }

    const body = await request.json();
    const { currentPassword, newPassword, targetUserId } = body;

    // Permitir targetUserId si no hay cookie pero viene especificado o si hay sesión
    const finalUserId = userId || targetUserId;
    if (!finalUserId) {
      return NextResponse.json(
        { success: false, error: "No hay sesión activa ni usuario identificado." },
        { status: 401 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: finalUserId },
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    // Si no está obligado a cambiarla en primer login, verificar la clave actual
    if (!usuario.mustChangePassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Debe ingresar la contraseña actual." },
          { status: 400 }
        );
      }
      const match = await verifyPasswordHash(currentPassword, usuario.passwordHash);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "La contraseña actual es incorrecta." },
          { status: 400 }
        );
      }
    }

    // Validar complejidad de la nueva clave
    const valResult = validatePasswordComplexity(newPassword);
    if (!valResult.valid) {
      return NextResponse.json(
        { success: false, error: valResult.error || "Contraseña inválida." },
        { status: 400 }
      );
    }

    // Hashear y guardar
    const newHash = await hashPassword(newPassword);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente.",
    });
  } catch (error) {
    console.error("Error en POST /api/v1/auth/change-password:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al cambiar la contraseña." },
      { status: 500 }
    );
  }
}
