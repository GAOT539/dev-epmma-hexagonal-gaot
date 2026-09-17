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
    passwordHash: "123456789*",
    passwordActual: "123456789*",
  },
  {
    id: "u-dir-01",
    cedula: "1802345678",
    nombres: "Patricia",
    apellidos: "Sánchez López",
    rol: "DIRECTOR",
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
  },
  {
    id: "u-jefe-01",
    cedula: "1803456789",
    nombres: "Roberto",
    apellidos: "Vargas Mendoza",
    rol: "JEFE_OPERATIVO",
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
  },
  {
    id: "u-sup-01",
    cedula: "1804567890",
    nombres: "María",
    apellidos: "Torres Guzmán",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
    navesAsignadas: ["nave-a", "nave-b"],
  },
  {
    id: "u-sup-02",
    cedula: "1805678901",
    nombres: "Jorge",
    apellidos: "Castillo Vera",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
    navesAsignadas: ["nave-c", "nave-d"],
  },
  {
    id: "u-sup-03",
    cedula: "1806789012",
    nombres: "Elena",
    apellidos: "Mora Salcedo",
    rol: "SUPERVISOR",
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
    navesAsignadas: ["nave-e"],
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

/** Verificar contraseña actual de un usuario */
export function verifyPassword(userId: string, password: string): boolean {
  const user = usuarios.find((u) => u.id === userId);
  if (!user) return false;
  return user.passwordActual === password;
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

// ── CRUD de Usuarios ─────────────────────────────────────────────────────────

let nextUserId = usuarios.length + 1;

export function crearUsuario(data: {
  cedula: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  navesAsignadas?: string[];
}): Usuario {
  const id = `u-new-${String(nextUserId++).padStart(2, "0")}`;
  const nuevoUsuario: MockUsuario = {
    id,
    cedula: data.cedula,
    nombres: data.nombres,
    apellidos: data.apellidos,
    rol: data.rol,
    mustChangePassword: true,
    passwordHash: "123456789*",
    passwordActual: "123456789*",
    navesAsignadas: data.navesAsignadas,
  };
  usuarios.push(nuevoUsuario);
  return toUsuario(nuevoUsuario);
}

export function editarUsuario(
  id: string,
  data: {
    nombres?: string;
    apellidos?: string;
    cedula?: string;
    rol?: Rol;
    navesAsignadas?: string[];
  }
): Usuario | null {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  usuarios[idx] = {
    ...usuarios[idx],
    ...(data.nombres !== undefined && { nombres: data.nombres }),
    ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
    ...(data.cedula !== undefined && { cedula: data.cedula }),
    ...(data.rol !== undefined && { rol: data.rol }),
    ...(data.navesAsignadas !== undefined && { navesAsignadas: data.navesAsignadas }),
  };

  return toUsuario(usuarios[idx]);
}

export function eliminarUsuario(id: string): boolean {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  // No permitir eliminar al superadmin
  if (usuarios[idx].id === "u-super") return false;
  usuarios.splice(idx, 1);
  return true;
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
    navesAsignadas: m.navesAsignadas,
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
