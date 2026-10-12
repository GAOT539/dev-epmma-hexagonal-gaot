// ── Dominio: Modelos de negocio del Mercado EPMMA ────────────────────────────

// ── Roles y Usuarios ─────────────────────────────────────────────────────────

export type Rol =
  | "SUPERADMIN"
  | "TIC"
  | "TICs"
  | "TI"
  | "DIRECTOR"
  | "JEFE_OPERATIVO"
  | "SUPERVISOR";

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

// ── Estados ──────────────────────────────────────────────────────────────────

export type EstadoAsistencia =
  | "Presente"
  | "Ausente"
  | "Observacion"
  | "Permiso"
  | "Pendiente"
  | "Vacante";

export type EstadoPuesto = "Ocupado" | "Vacante";

// ── Comerciante ──────────────────────────────────────────────────────────────

export interface Comerciante {
  idInterno: string;
  ciu: string;
  cedula: string;
  contribuyente: string;
  actividad: string;
  puestoId: string | null;
  estadoRegistro: "Habilitado" | "Deshabilitado";
  creadoPor?: string;
  modificadoPor?: string;
  deshabilitadoPor?: string;
}

// ── Puesto, Nave ─────────────────────────────────────────────────────────────

export interface Puesto {
  id: string;
  codigo: string;
  naveId: string;
  estado: EstadoPuesto;
  comercianteId: string | null;
}

export type { Nave, EstadoRegistroNave } from "./nave.model";

// ── Asistencia ───────────────────────────────────────────────────────────────

export interface RegistroAsistencia {
  id: string;
  comercianteId: string;
  puestoId: string;
  fecha: string; // YYYY-MM-DD
  estado: EstadoAsistencia;
  observacion?: string;
  /** Texto detallado de la novedad/observación */
  observacionTexto?: string;
  permisoInicio?: string; // YYYY-MM-DD
  permisoFin?: string;    // YYYY-MM-DD
}

// ── Auditoría ────────────────────────────────────────────────────────────────

export interface LogAuditoria {
  id: string;
  timestamp: string; // ISO
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  detalle: string;
}

// ── Configuración del Supervisor ─────────────────────────────────────────────

export interface ConfiguracionSupervisor {
  supervisorId: string;
  persistenciaAsistencia: boolean;
  vistaDefault: "lista" | "treemap";
}

// ── Importación XML/CSV ──────────────────────────────────────────────────────

export interface ImportacionRegistro {
  nave: string;
  contribuyente: string;
  numBodega: string;
  gen01Codi: string;
}

export interface ImportacionResultado {
  exitosos: number;
  errores: { fila: number; mensaje: string }[];
}
