// ── Dominio: Modelo de Asistencia y Novedades ─────────────────────────────────

export type EstadoAsistencia =
  | "Presente"
  | "Ausente"
  | "Permiso"
  | "Pendiente"
  | "Vacante";

export interface ObservacionDetalle {
  id: string;
  texto: string;
  fechaHora: string;
}

export interface PermisoDetalle {
  id: string;
  motivo: string;
  fechaAsignacion: string; // YYYY-MM-DD (cuándo se registró el permiso)
  fechaInicio: string;     // YYYY-MM-DD
  fechaFin: string;        // YYYY-MM-DD
  fecha?: string;          // YYYY-MM-DD (para retrocompatibilidad)
}

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
  observaciones?: ObservacionDetalle[];
  permisos?: PermisoDetalle[];
}

export interface ConfiguracionSupervisor {
  supervisorId: string;
  persistenciaAsistencia: boolean;
  vistaDefault: "lista" | "treemap";
}
