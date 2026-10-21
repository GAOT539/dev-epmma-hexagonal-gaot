// ── Infraestructura: Utilidades de Criptografía de Contraseñas ───────────────

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const SALT_ROUNDS = 10;

/** Genera el hash unidireccional de una contraseña con bcryptjs */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compara una contraseña en texto plano contra un hash bcrypt */
export async function verifyPasswordHash(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Validación de complejidad de contraseña (client-side y server-side) */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return { valid: false, error: "Mínimo 8 caracteres." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Debe contener al menos una mayúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Debe contener al menos un número." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      error: "Debe contener al menos un carácter especial.",
    };
  }
  return { valid: true };
}

/** Genera una contraseña temporal aleatoria segura que cumple todas las reglas de complejidad */
export function generarPasswordTemporal(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "EpEma!";
  for (let index = password.length; index < 18; index++) {
    password += alphabet[randomInt(alphabet.length)];
  }
  return password;
}

export {
  validatePassword as validatePasswordComplexity,
  generarPasswordTemporal as generateTemporaryPassword,
};
