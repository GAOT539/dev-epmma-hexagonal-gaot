// ── API Route: GET /api/v1/auth/me ────────────────────────────────────────────

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/infrastructure/database/prisma";
import { AUTH_COOKIE_NAME, verificarTokenJwt } from "@/infrastructure/auth/jwt.utils";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = await verificarTokenJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!usuario || usuario.estado !== "Habilitado") {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const naves = Array.isArray(usuario.navesAsignadas)
      ? (usuario.navesAsignadas as string[])
      : [];

    return NextResponse.json({
      user: {
        id: usuario.id,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo ?? undefined,
        rol: usuario.rol,
        mustChangePassword: usuario.mustChangePassword,
        navesAsignadas: naves,
        estado: usuario.estado,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/v1/auth/me:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
