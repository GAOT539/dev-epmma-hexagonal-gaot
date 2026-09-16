// ── Infraestructura: Mock de Autenticación ───────────────────────────────────

import type { Rol, Usuario } from "@/domain/models/comerciante.model";

// ── Datos de usuarios simulados ──────────────────────────────────────────────

const SUPERADMIN_USER = "admin";
const SUPERADMIN_PASS = "1500888985*admin";

interface MockUsuario extends Usuario {
  passwordActual: string;
}

const mockUsuarios: MockUsuario[] = [
  {
    id: "u-super",
    cedula: "admin",
    nombres: "Administrador",
    apellidos: "Sistema",
    rol: "SUPERADMIN",
    mustChangePassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
  },
  {
    id: "u-tic-01",
    cedula: "1801234567",
    nombres: "Carlos",
    apellidos: "Medina Ruiz",
    rol: "TIC",
    mustChangePassword: true,
    passwordHash: "1801234567*",
    passwordActual: "1801234567*",
  },
  {
    id: "u-dir-01",
    cedula: "1802345678",
    nombres: "Patricia",
    apellidos: "Sánchez López",
    rol: "DIRECTOR",
    mustChangePassword: true,
    passwordHash: "1802345678*",
    passwordActual: "1802345678*",
  },
  {
    id: "u-jefe-01",
    cedula: "1803456789",
    nombres: "Roberto",
    apellidos: "Vargas Mendoza",
    rol: "JEFE_OPERATIVO",
    mustChangePassword: true,
    passwordHash: "1803456789*",
    passwordActual: "1803456789*",
  },
  {
    id: "u-sup-01",
    cedula: "1804567890",
    nombres: "María",
    apellidos: "Torres Guzmán",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "1804567890*",
    passwordActual: "1804567890*",
  },
  {
    id: "u-sup-02",
    cedula: "1805678901",
    nombres: "Jorge",
    apellidos: "Castillo Vera",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "1805678901*",
    passwordActual: "1805678901*",
  },
  {
    id: "u-sup-03",
    cedula: "1806789012",
    nombres: "Elena",
    apellidos: "Mora Salcedo",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "1806789012*",
    passwordActual: "1806789012*",
  },
];

// ── Almacén en memoria ───────────────────────────────────────────────────────

let usuarios = [...mockUsuarios];

export function resetMockUsuarios() {
  usuarios = [...mockUsuarios];
}

// ── Funciones de autenticación ───────────────────────────────────────────────

export function authenticateUser(
  identificador: string,
  password: string
): Usuario | null {
  // Superusuario oculto
  if (identificador === SUPERADMIN_USER && password === SUPERADMIN_PASS) {
    const su = usuarios.find((u) => u.id === "u-super");
    return su ? toUsuario(su) : null;
  }

  // Usuarios normales: buscar por cédula
  const user = usuarios.find(
    (u) => u.cedula === identificador && u.passwordActual === password
  );
  return user ? toUsuario(user) : null;
}

export function changePassword(
  userId: string,
  newPassword: string
): { success: boolean; error?: string } {
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const idx = usuarios.findIndex((u) => u.id === userId);
  if (idx === -1) return { success: false, error: "Usuario no encontrado." };

  usuarios[idx] = {
    ...usuarios[idx],
    passwordActual: newPassword,
    passwordHash: newPassword,
    mustChangePassword: false,
  };

  return { success: true };
}

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

export function getUsuarios(): Usuario[] {
  return usuarios.map(toUsuario);
}

export function getUsuarioById(id: string): Usuario | null {
  const u = usuarios.find((u) => u.id === id);
  return u ? toUsuario(u) : null;
}

export function getSupervisores(): Usuario[] {
  return usuarios
    .filter((u) => u.rol === "SUPERVISOR")
    .map(toUsuario);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toUsuario(m: MockUsuario): Usuario {
  return {
    id: m.id,
    cedula: m.cedula,
    nombres: m.nombres,
    apellidos: m.apellidos,
    rol: m.rol,
    mustChangePassword: m.mustChangePassword,
    passwordHash: m.passwordHash,
  };
}

/** Mapa de ítems de menú permitidos por rol */
export const MENU_POR_ROL: Record<Rol, string[]> = {
  SUPERADMIN: ["/dashboard", "/listas", "/reportes", "/tic", "/auditoria", "/configuracion"],
  TIC: ["/dashboard", "/tic", "/auditoria", "/configuracion"],
  DIRECTOR: ["/dashboard", "/reportes", "/configuracion"],
  JEFE_OPERATIVO: ["/dashboard", "/reportes", "/configuracion"],
  SUPERVISOR: ["/dashboard", "/listas", "/configuracion"],
};
