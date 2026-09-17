// ── Dominio: Modelos de negocio del Mercado EPMMA ────────────────────────────

// ── Roles y Usuarios ─────────────────────────────────────────────────────────

export type Rol =
  | "SUPERADMIN"
  | "TIC"
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
  /** Hash simulado – en mock simplemente comparamos strings */
  passwordHash: string;
  /** Naves asignadas al supervisor (solo aplica para rol SUPERVISOR) */
  navesAsignadas?: string[];
}

// ── Estados ──────────────────────────────────────────────────────────────────

export type EstadoAsistencia =
  | "Presente"
  | "Ausente"
  | "Novedad"
  | "Observacion"
  | "Permiso"
  | "Pendiente";

export type EstadoPuesto = "Ocupado" | "Vacante";

// ── Comerciante ──────────────────────────────────────────────────────────────

export interface Comerciante {
  idInterno: string;
  ciu: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  actividad: string;
  puestoId: string | null;
}

// ── Puesto, Sector, Nave ─────────────────────────────────────────────────────

export interface Puesto {
  id: string;
  codigo: string;
  naveId: string;
  sectorId: string;
  estado: EstadoPuesto;
  comercianteId: string | null;
}

export interface Sector {
  id: string;
  nombre: string;
  naveId: string;
}

export interface Nave {
  id: string;
  nombre: string;
  limitePuestos: number;
  sectores: Sector[];
}

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
