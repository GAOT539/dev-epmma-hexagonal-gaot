// ── Infraestructura: Mock de Autenticación ───────────────────────────────────

import type { Rol, Usuario } from "@/domain/models/comerciante.model";

// ── Datos de usuarios simulados ──────────────────────────────────────────────

/**
 * Contraseña maestra unificada para perfiles de prueba y desarrollo.
 * Todos los usuarios de prueba quemados comparten esta clave por defecto.
 */
const SUPERADMIN_PASS = "1500888985*admin";

interface MockUsuario extends Usuario {
  passwordActual: string;
}

/**
 * Usuarios de prueba preconfigurados con acceso inmediato (sin requerir cambio inicial de contraseña).
 * 
 * Regla de negocio para el Backend Real:
 * - Cada usuario estará registrado en la tabla `usuarios` con su hash bcrypt en `password_hash`.
 * - Los roles determinarán los permisos de acceso y el menú autorizado.
 * - Endpoint equivalente: POST /api/v1/auth/login
 */
const mockUsuarios: MockUsuario[] = [
  {
    id: "u-super",
    cedula: "admin",
    nombres: "Administrador",
    apellidos: "Sistema",
    rol: "SUPERADMIN",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    estado: "Habilitado",
  },
  {
    id: "u-dir-01",
    cedula: "1802345678",
    nombres: "Patricia",
    apellidos: "Sánchez López",
    rol: "DIRECTOR",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    estado: "Habilitado",
  },
  {
    id: "u-jefe-01",
    cedula: "1803456789",
    nombres: "Roberto",
    apellidos: "Vargas Mendoza",
    rol: "JEFE_OPERATIVO",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    estado: "Habilitado",
  },
  {
    id: "u-sup-01",
    cedula: "1804567890",
    nombres: "María",
    apellidos: "Torres Guzmán",
    rol: "SUPERVISOR",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    navesAsignadas: ["nave-a", "nave-b"],
    estado: "Habilitado",
  },
  {
    id: "u-sup-02",
    cedula: "1805678901",
    nombres: "Jorge",
    apellidos: "Castillo Vera",
    rol: "SUPERVISOR",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    navesAsignadas: ["nave-c", "nave-d"],
    estado: "Habilitado",
  },
  {
    id: "u-sup-03",
    cedula: "1806789012",
    nombres: "Elena",
    apellidos: "Mora Salcedo",
    rol: "SUPERVISOR",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    navesAsignadas: ["nave-e"],
    estado: "Habilitado",
  },
  {
    id: "u-tic-01",
    cedula: "1801234567",
    nombres: "Carlos",
    apellidos: "Medina Ruiz",
    rol: "TIC",
    mustChangePassword: false,
    debeCambiarPassword: false,
    passwordHash: SUPERADMIN_PASS,
    passwordActual: SUPERADMIN_PASS,
    estado: "Habilitado",
  },
];

// ── Almacén en memoria ───────────────────────────────────────────────────────

let usuarios = [...mockUsuarios];

export function resetMockUsuarios() {
  usuarios = [...mockUsuarios];
}

// ── Funciones de autenticación ───────────────────────────────────────────────

/**
 * Autentica un usuario verificando credenciales en memoria.
 * 
 * Reglas de negocio:
 * 1. Permite acceso por número de cédula o por identificador corto ("admin", "director", "jefe", "supervisor", "tic").
 * 2. Valida contraseña contra passwordActual.
 * 3. Bloquea el acceso si el usuario se encuentra con estado "Deshabilitado".
 * 
 * Conexión futura con backend real:
 * Se ejecutará vía POST /api/v1/auth/login, validando el identificador (cédula o alias institucional)
 * y comparando el hash de contraseña con bcrypt/argon2.
 */
export function authenticateUser(
  identificador: string,
  password: string
): Usuario | null {
  const idLimpio = identificador.trim().toLowerCase();

  const user = usuarios.find((u) => {
    // Verificar que el usuario no esté deshabilitado
    if (u.estado === "Deshabilitado") return false;

    // Coincidencia por cédula o cédula alternativa superadmin
    const coincideCedula =
      u.cedula.toLowerCase() === idLimpio ||
      (u.id === "u-super" && idLimpio === "1800000001");

    // Coincidencia por identificador corto / alias por rol
    const coincideAlias =
      (idLimpio === "admin" && (u.rol === "SUPERADMIN" || u.id === "u-super")) ||
      (idLimpio === "director" && (u.rol === "DIRECTOR" || u.id === "u-dir-01")) ||
      (idLimpio === "jefe" && (u.rol === "JEFE_OPERATIVO" || u.id === "u-jefe-01")) ||
      (idLimpio === "supervisor" && u.id === "u-sup-01") ||
      (idLimpio === "tic" && (u.rol === "TIC" || u.id === "u-tic-01"));

    return (coincideCedula || coincideAlias) && u.passwordActual === password;
  });

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

export const getUsuarioPorId = getUsuarioById;

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
    passwordHash: `${data.cedula}*`,
    passwordActual: `${data.cedula}*`,
    navesAsignadas: data.navesAsignadas,
    estado: "Habilitado",
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
  usuarios[idx] = {
    ...usuarios[idx],
    estado: "Deshabilitado",
  };
  return true;
}

export function restablecerPasswordUsuario(id: string): boolean {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  const user = usuarios[idx];
  const newPass = `${user.cedula}*`;
  usuarios[idx] = {
    ...user,
    passwordActual: newPass,
    passwordHash: newPass,
    mustChangePassword: true,
    debeCambiarPassword: true,
  };
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
    debeCambiarPassword: m.debeCambiarPassword ?? m.mustChangePassword,
    passwordHash: m.passwordHash,
    navesAsignadas: m.navesAsignadas,
    estado: m.estado ?? "Habilitado",
  };
}

/** Mapa de ítems de menú permitidos por rol */
export const MENU_POR_ROL: Record<Rol, string[]> = {
  SUPERADMIN: ["/listas", "/reportes", "/catastro", "/naves", "/auditoria", "/ingreso-catastro", "/configuracion"],
  TIC: ["/catastro", "/naves", "/auditoria", "/ingreso-catastro", "/configuracion"],
  DIRECTOR: ["/reportes", "/naves", "/ingreso-catastro", "/configuracion"],
  JEFE_OPERATIVO: ["/reportes", "/configuracion"],
  SUPERVISOR: ["/listas", "/reportes", "/catastro", "/ingreso-catastro", "/configuracion"],
};

/**
 * Sincroniza dinámicamente las naves asignadas de cada supervisor en base a las naves registradas en /naves.
 */
export function sincronizarNavesSupervisorDesdeNaves(naves: { id: string; supervisores?: string[] }[]): void {
  for (const u of usuarios) {
    if (u.rol === "SUPERVISOR") {
      const nombreCompleto = `${u.nombres} ${u.apellidos}`.trim().toLowerCase();
      const navesEncontradas = naves
        .filter((n) =>
          (n.supervisores ?? []).some((sup) => {
            const supLimpio = sup.trim().toLowerCase();
            return (
              supLimpio === nombreCompleto ||
              supLimpio.includes(nombreCompleto) ||
              nombreCompleto.includes(supLimpio)
            );
          })
        )
        .map((n) => n.id);

      u.navesAsignadas = navesEncontradas;
    }
  }
}
