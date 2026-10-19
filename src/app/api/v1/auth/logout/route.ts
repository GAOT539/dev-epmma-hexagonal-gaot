// ── API Route: POST /api/v1/auth/logout ────────────────────────────────────────

import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/jwt.utils";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Sesión cerrada correctamente." });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
