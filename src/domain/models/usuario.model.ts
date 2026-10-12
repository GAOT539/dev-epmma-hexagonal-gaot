// ── Dominio: Modelo de Roles y Usuarios ──────────────────────────────────────

export type Rol = "SUPERADMIN" | "TIC" | "DIRECTOR" | "JEFE_OPERATIVO" | "SUPERVISOR";

export interface Usuario {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  mustChangePassword: boolean;
  debeCambiarPassword?: boolean;
  /** Hash simulado – en mock simplemente comparamos strings */
  passwordHash: string;
  /** Naves asignadas al supervisor (solo aplica para rol SUPERVISOR) */
  navesAsignadas?: string[];
  estado?: "Habilitado" | "Deshabilitado";
}
