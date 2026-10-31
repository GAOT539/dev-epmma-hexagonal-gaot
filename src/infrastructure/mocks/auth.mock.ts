// ── Infraestructura: Mock de Autenticación ───────────────────────────────────

import type { Rol, Usuario } from "@/domain/models/comerciante.model";
import { sincronizarSupervisorEnNaves } from "./naves.mock";

// ── Datos de usuarios simulados ──────────────────────────────────────────────

/**
 * Contraseña maestra unificada para perfiles de prueba y desarrollo.
 * Todos los usuarios de prueba quemados comparten esta clave por defecto.
 */
const SUPERADMIN_PASS = "Ravine.Snooze.Cover9.Defendant";

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
    correo: "admin@ep-ema.gob.ec",
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
    correo: "director@ep-ema.gob.ec",
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
    correo: "jefe@ep-ema.gob.ec",
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
    correo: "supervisor@ep-ema.gob.ec",
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
    correo: "supervisor2@ep-ema.gob.ec",
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
    correo: "supervisor3@ep-ema.gob.ec",
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
    correo: "tic@ep-ema.gob.ec",
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

/**
 * Crea un nuevo usuario en el sistema.
 * 
 * Regla de negocio y simulación backend:
 * - Genera credenciales iniciales con clave temporal `cedula*`.
 * - Si el usuario es SUPERVISOR, sincroniza bidireccionalmente las naves asignadas
 *   con las listas de supervisores de cada nave en el módulo de Naves.
 */
export function crearUsuario(data: {
  cedula: string;
  nombres: string;
  apellidos: string;
  correo?: string;
  rol: Rol;
  navesAsignadas?: string[];
}): Usuario {
  const id = `u-new-${String(nextUserId++).padStart(2, "0")}`;
  const naves = data.rol === "SUPERVISOR" ? (data.navesAsignadas ?? []) : undefined;
  const nuevoUsuario: MockUsuario = {
    id,
    cedula: data.cedula,
    nombres: data.nombres,
    apellidos: data.apellidos,
    correo: data.correo,
    rol: data.rol,
    mustChangePassword: true,
    passwordHash: `${data.cedula}*`,
    passwordActual: `${data.cedula}*`,
    navesAsignadas: naves,
    estado: "Habilitado",
  };
  usuarios.push(nuevoUsuario);

  if (data.rol === "SUPERVISOR") {
    const nombreCompleto = `${data.nombres} ${data.apellidos}`.trim();
    sincronizarSupervisorEnNaves(nombreCompleto, naves ?? []);
  }

  return toUsuario(nuevoUsuario);
}

/**
 * Actualiza los datos de un usuario existente.
 * 
 * Regla de negocio y simulación backend:
 * - Si el rol es o era SUPERVISOR, sincroniza bidireccionalmente las naves asignadas
 *   con las listas de supervisores en cada nave (actualizando o removiendo nombres).
 */
export function editarUsuario(
  id: string,
  data: {
    nombres?: string;
    apellidos?: string;
    cedula?: string;
    correo?: string;
    rol?: Rol;
    navesAsignadas?: string[];
  }
): Usuario | null {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  const anterior = usuarios[idx];
  const nombreAnterior = `${anterior.nombres} ${anterior.apellidos}`.trim();
  const nuevoRol = data.rol !== undefined ? data.rol : anterior.rol;

  usuarios[idx] = {
    ...anterior,
    ...(data.nombres !== undefined && { nombres: data.nombres }),
    ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
    ...(data.cedula !== undefined && { cedula: data.cedula }),
    ...(data.correo !== undefined && { correo: data.correo }),
    ...(data.rol !== undefined && { rol: data.rol }),
    navesAsignadas:
      nuevoRol === "SUPERVISOR"
        ? (data.navesAsignadas !== undefined ? data.navesAsignadas : anterior.navesAsignadas ?? [])
        : undefined,
  };

  const actualizado = usuarios[idx];
  const nombreActualizado = `${actualizado.nombres} ${actualizado.apellidos}`.trim();

  // Sincronización bidireccional con naves
  if (anterior.rol === "SUPERVISOR" || actualizado.rol === "SUPERVISOR") {
    if (actualizado.rol === "SUPERVISOR") {
      sincronizarSupervisorEnNaves(
        nombreActualizado,
        actualizado.navesAsignadas ?? [],
        nombreAnterior
      );
    } else {
      sincronizarSupervisorEnNaves(nombreActualizado, [], nombreAnterior);
    }
  }

  return toUsuario(usuarios[idx]);
}

/**
 * Deshabilita un usuario en el sistema.
 * 
 * Regla de negocio y simulación backend:
 * - Si es SUPERVISOR, remueve su asignación de todas las naves en el módulo de naves.
 */
export function eliminarUsuario(id: string): boolean {
  const idx = usuarios.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  // No permitir eliminar al superadmin
  if (usuarios[idx].id === "u-super") return false;

  const user = usuarios[idx];
  usuarios[idx] = {
    ...user,
    estado: "Deshabilitado",
  };

  if (user.rol === "SUPERVISOR") {
    const nombreCompleto = `${user.nombres} ${user.apellidos}`.trim();
    sincronizarSupervisorEnNaves(nombreCompleto, []);
  }

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
    correo: m.correo,
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
  SUPERADMIN: ["/listas", "/reportes", "/catastro", "/naves", "/controlsupervisores", "/ingreso-catastro", "/configuracion"],
  TIC: ["/listas", "/reportes", "/catastro", "/naves", "/controlsupervisores", "/ingreso-catastro", "/configuracion"],
  DIRECTOR: ["/listas", "/reportes", "/catastro", "/naves", "/controlsupervisores", "/ingreso-catastro", "/configuracion"],
  JEFE_OPERATIVO: ["/listas", "/reportes", "/catastro", "/naves", "/controlsupervisores", "/ingreso-catastro", "/configuracion"],
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

/**
 * Solicita el restablecimiento de contraseña de un usuario mediante su identificador (usuario/cédula) o correo electrónico.
 *
 * =========================================================================================
 * DOCUMENTACIÓN DE INTEGRACIÓN BACKEND REAL CON GMAIL SMTP (NODEMAILER):
 * =========================================================================================
 * En el backend en producción, esta operación llama al endpoint:
 *   POST /api/v1/auth/forgot-password
 * Body: { identificador: string }
 *
 * Flujo en el servidor Node.js/Next.js API:
 * 1. Buscar al usuario en la base de datos por `cedula` o `correo`:
 * 2. Si el usuario existe y tiene correo registrado:
 *    - Generar una contraseña temporal aleatoria segura.
 *    - Enviar correo institucional mediante Gmail SMTP con Nodemailer.
 *    - Si el envío es exitoso, actualizar la contraseña temporal en la base de datos con mustChangePassword = true.
 * 3. En la simulación frontend actual:
 *    - Se busca el usuario en memoria por cédula, alias o correo.
 *    - Se genera una contraseña temporal y se actualiza mustChangePassword = true.
 *    - Se retorna éxito y el correo al cual fue enviado.
 */
export async function solicitarRestablecimientoPassword(
  identificadorOCorreo: string
): Promise<{ success: boolean; correoEnviado?: string; error?: string }> {
  const query = identificadorOCorreo.trim().toLowerCase();
  if (!query) {
    return { success: false, error: "Identificador no ingresado." };
  }

  const u = usuarios.find((user) => {
    const cedula = user.cedula.toLowerCase();
    const correo = (user.correo || "").toLowerCase();
    const esAlias =
      (query === "admin" && user.rol === "SUPERADMIN") ||
      (query === "director" && user.rol === "DIRECTOR") ||
      (query === "jefe" && user.rol === "JEFE_OPERATIVO") ||
      (query === "supervisor" && user.rol === "SUPERVISOR") ||
      (query === "tic" && user.rol === "TIC");

    return cedula === query || correo === query || esAlias;
  });

  if (!u) {
    return {
      success: false,
      error: "No se encontró ningún usuario con el usuario, cédula o correo especificado.",
    };
  }

  const correoDestino = u.correo || `${u.cedula}@ep-ema.gob.ec`;
  u.correo = correoDestino;
  const tempPass = "TempPass2026*";
  u.passwordActual = tempPass;
  u.passwordHash = tempPass;
  u.mustChangePassword = true;
  u.debeCambiarPassword = true;

  return {
    success: true,
    correoEnviado: correoDestino,
  };
}
