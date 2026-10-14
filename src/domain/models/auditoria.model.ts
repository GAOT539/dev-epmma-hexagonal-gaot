// ── Dominio: Modelo de Logs, Auditoría y Control de Supervisores ─────────────

import type { EstadoAsistencia } from "./asistencia.model";

export interface LogAuditoria {
  id: string;
  timestamp: string; // ISO
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  detalle: string;
}

export type AuditoriaLog = LogAuditoria;

// ── Control de Supervisores ──────────────────────────────────────────────────

export type EtiquetaControlSupervisor =
  | "EN_FECHA"
  | "CON_PERSISTENCIA"
  | "MODIFICADO_TRAS_PERSISTENCIA"
  | "CON_RETRASO"
  | "COMPLETA"
  | "INCOMPLETA";

export interface DetalleComercianteControl {
  comercianteId: string;
  ciu: string;
  cedula: string;
  contribuyente: string;
  puesto: string;
  estado: EstadoAsistencia;
  horaRegistro?: string;
  metodo: "MANUAL" | "PERSISTENCIA" | "MODIFICADO_TRAS_PERSISTENCIA" | "FALTANTE";
}

export interface ResumenSesionControl {
  totalOcupados: number;
  tomados: number;
  presentes: number;
  ausentes: number;
  permisos: number;
  faltantes: number;
}

export interface SesionControlSupervisor {
  id: string;
  supervisorId: string;
  supervisorNombre: string;
  naveId: string;
  naveNombre: string;
  fechaJornada: string; // YYYY-MM-DD – día al que corresponde la lista
  timestampInicio: string; // ISO – fecha y hora real del inicio de la toma
  timestampUltimaModificacion?: string;
  accion: string;
  esPersistencia: boolean;
  fechaOrigenPersistencia?: string;
  comentarioPersistencia?: string;
  modificadoTrasPersistencia: boolean;
  tieneRetraso: boolean;
  detalleRetraso?: string;
  etiquetas: EtiquetaControlSupervisor[];
  resumen: ResumenSesionControl;
  detallesComerciantes: DetalleComercianteControl[];
}
