// ── API Route: POST /api/v1/auth/login ─────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { verifyPasswordHash } from "@/infrastructure/auth/password.utils";
import { firmarTokenJwt, AUTH_COOKIE_NAME } from "@/infrastructure/auth/jwt.utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identificador, password } = body;

    if (!identificador || !password) {
      return NextResponse.json(
        { success: false, error: "Identificador y contraseña requeridos." },
        { status: 400 }
      );
    }

    const cleanId = String(identificador).trim();

    // Buscar por cédula, correo o alias especial 'admin'
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
        { success: false, error: "Credenciales incorrectas. Verifique usuario y contraseña." },
        { status: 401 }
      );
    }

    if (usuario.estado !== "Habilitado") {
      return NextResponse.json(
        { success: false, error: "El usuario se encuentra deshabilitado. Contacte al administrador." },
        { status: 403 }
      );
    }

    const passwordValida = await verifyPasswordHash(password, usuario.passwordHash);
    if (!passwordValida) {
      return NextResponse.json(
        { success: false, error: "Credenciales incorrectas. Verifique usuario y contraseña." },
        { status: 401 }
      );
    }

    const naves = Array.isArray(usuario.navesAsignadas)
      ? (usuario.navesAsignadas as string[])
      : [];

    // Firmar JWT
    const token = await firmarTokenJwt({
      sub: usuario.id,
      cedula: usuario.cedula,
      rol: usuario.rol,
      navesAsignadas: naves,
    });

    const userResponse = {
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo ?? undefined,
      rol: usuario.rol,
      mustChangePassword: usuario.mustChangePassword,
      navesAsignadas: naves,
      estado: usuario.estado,
    };

    const response = NextResponse.json({
      success: true,
      user: userResponse,
    });

    // Guardar JWT en cookie HttpOnly
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 horas
    });

    return response;
  } catch (error) {
    console.error("Error en POST /api/v1/auth/login:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor al autenticar." },
      { status: 500 }
    );
  }
}
