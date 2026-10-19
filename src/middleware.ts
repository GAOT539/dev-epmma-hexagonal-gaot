// ── Middleware Server-Side: Protección de Rutas API y Panel ───────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verificarTokenJwt } from "@/infrastructure/auth/jwt.utils";

// Rutas públicas que no requieren autenticación
const PUBLIC_API_ROUTES = [
  "/api/v1/auth/login",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/logout",
];

// Rutas que requieren roles específicos (prefijos)
const ROLE_RESTRICTIONS: Record<string, string[]> = {
  "/api/v1/usuarios": ["SUPERADMIN", "TIC"],
  "/api/v1/auditoria": ["SUPERADMIN", "TIC", "DIRECTOR", "JEFE_OPERATIVO"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo interceptar rutas de la API v1
  if (!pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Rutas públicas: dejar pasar
  if (PUBLIC_API_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  // Obtener token de la cookie o del header Authorization
  let token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "No autorizado. Token de sesión no encontrado." },
      { status: 401 }
    );
  }

  // Verificar token JWT
  const payload = await verificarTokenJwt(token);
  if (!payload || !payload.sub || !payload.rol) {
    return NextResponse.json(
      { error: "Sesión expirada o inválida. Inicie sesión nuevamente." },
      { status: 401 }
    );
  }

  // Verificar restricciones de rol por ruta
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_RESTRICTIONS)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(payload.rol as string)) {
        return NextResponse.json(
          { error: "Acceso denegado. No tiene permisos para esta operación." },
          { status: 403 }
        );
      }
    }
  }

  // Inyectar datos del usuario en los headers para que los Route Handlers los lean
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub as string);
  requestHeaders.set("x-user-cedula", payload.cedula as string);
  requestHeaders.set("x-user-rol", payload.rol as string);
  if (payload.navesAsignadas) {
    requestHeaders.set("x-user-naves", JSON.stringify(payload.navesAsignadas));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
