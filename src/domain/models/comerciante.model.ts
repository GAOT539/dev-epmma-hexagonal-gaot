// ── Dominio: Modelo de Comerciante y Puestos ─────────────────────────────────

export type EstadoPuesto = "Ocupado" | "Vacante";

export interface Comerciante {
  idInterno: string;
  ciu: string;
  cedula: string;
  contribuyente: string;
  actividad: string;
  puestoId: string | null;
  nave?: string;
  estadoRegistro: "Habilitado" | "Deshabilitado";
  creadoPor?: string;
  modificadoPor?: string;
  deshabilitadoPor?: string;
}

export interface Puesto {
  id: string;
  codigo: string;
  naveId: string;
  estado: EstadoPuesto;
  comercianteId: string | null;
}

export type { Nave, EstadoRegistroNave } from "./nave.model";

// ── Importación XML/CSV de Catastro ──────────────────────────────────────────

export interface ImportacionRegistro {
  ciu: string;
  cedula: string;
  nombre: string;
  contribuyente: string;
  actividad: string;
  nave: string;
  puesto: string;
  numBodega: string;
  gen01Codi?: string;
}

export interface ImportacionResultado {
  exitosos: number;
  errores: { fila: number; mensaje: string }[];
}

// ── Re-exportaciones para compatibilidad retrocompatible ─────────────────────
export type { Rol, Usuario } from "./usuario.model";
export type {
  EstadoAsistencia,
  RegistroAsistencia,
  ConfiguracionSupervisor,
  ObservacionDetalle,
  PermisoDetalle,
} from "./asistencia.model";
export type { LogAuditoria } from "./auditoria.model";
