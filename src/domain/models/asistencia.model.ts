// ── Dominio: Modelo de Asistencia y Novedades ─────────────────────────────────

export type EstadoAsistencia =
  | "Presente"
  | "Ausente"
  | "Observacion"
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
  fecha: string; // YYYY-MM-DD
  fechaInicio?: string;
  fechaFin?: string;
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
