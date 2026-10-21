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
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%&*";
  const all = uppers + lowers + digits + specials;

  // Garantizar al menos un carácter de cada grupo exigido por la política de seguridad
  const chars = [
    uppers[randomInt(uppers.length)],
    lowers[randomInt(lowers.length)],
    digits[randomInt(digits.length)],
    specials[randomInt(specials.length)],
  ];

  for (let i = chars.length; i < 16; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  // Barajado Fisher-Yates con randomInt criptográfico para máxima entropía
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
}

export {
  validatePassword as validatePasswordComplexity,
  generarPasswordTemporal as generateTemporaryPassword,
};
