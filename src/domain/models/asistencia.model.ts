// ── Dominio: Modelo de Asistencia y Novedades ─────────────────────────────────

export type EstadoAsistencia =
  | "Presente"
  | "Ausente"
  | "Observacion"
  | "Permiso"
  | "Pendiente"
  | "Vacante";

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

export interface ConfiguracionSupervisor {
  supervisorId: string;
  persistenciaAsistencia: boolean;
  vistaDefault: "lista" | "treemap";
}
