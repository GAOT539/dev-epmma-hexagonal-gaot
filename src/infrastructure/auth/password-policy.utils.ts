// ── Infraestructura: Políticas de Contraseñas y Menú por Rol ──────────────────
// Seguro para ejecución en Cliente (React) y Servidor (Node.js) sin dependencias de criptografía

import type { Rol } from "@/domain/models/comerciante.model";

/** Mapa de rutas y secciones permitidas por rol institucional */
export const MENU_POR_ROL: Record<Rol, string[]> = {
  SUPERADMIN: [
    "/listas",
    "/reportes",
    "/catastro",
    "/naves",
    "/controlsupervisores",
    "/ingreso-catastro",
    "/configuracion",
  ],
  TIC: [
    "/listas",
    "/reportes",
    "/catastro",
    "/naves",
    "/controlsupervisores",
    "/ingreso-catastro",
    "/configuracion",
  ],
  DIRECTOR: [
    "/listas",
    "/reportes",
    "/catastro",
    "/naves",
    "/controlsupervisores",
    "/ingreso-catastro",
    "/configuracion",
  ],
  JEFE_OPERATIVO: [
    "/listas",
    "/reportes",
    "/catastro",
    "/naves",
    "/controlsupervisores",
    "/ingreso-catastro",
    "/configuracion",
  ],
  SUPERVISOR: [
    "/listas",
    "/reportes",
    "/catastro",
    "/ingreso-catastro",
    "/configuracion",
  ],
};

/**
 * Valida las reglas de complejidad institucional para contraseñas:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos un dígito
 * - Al menos un carácter especial
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || password.length < 8) {
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
