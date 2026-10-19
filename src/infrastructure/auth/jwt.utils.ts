// ── Infraestructura: Utilidades JWT con librería jose (HS256) ─────────────────

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const AUTH_COOKIE_NAME = "ep_ema_session_token";

interface TokenPayload extends JWTPayload {
  sub: string;
  cedula: string;
  rol: string;
  navesAsignadas?: string[];
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no configurado o demasiado corto (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(secret);
}

function getExpiration(): string {
  return process.env.JWT_EXPIRES_IN || "8h";
}

/** Firma un JWT con los datos del usuario autenticado */
export async function firmarTokenJwt(payload: {
  sub: string;
  cedula: string;
  rol: string;
  navesAsignadas?: string[];
}): Promise<string> {
  const secret = getSecret();
  const expiration = getExpiration();

  return new SignJWT({ ...payload } as TokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .setIssuer("ep-ema")
    .sign(secret);
}

/** Verifica y decodifica un JWT, retornando el payload o null si es inválido */
export async function verificarTokenJwt(
  token: string
): Promise<TokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, { issuer: "ep-ema" });
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
