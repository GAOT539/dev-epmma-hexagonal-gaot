// ── Puerto del Dominio: IAsistenciaRepository ────────────────────────────────

import type {
  EstadoAsistencia,
  RegistroAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
} from "@/domain/models/asistencia.model";

export interface IAsistenciaRepository {
  obtenerAsistenciaPorFecha(fecha: string): Promise<RegistroAsistencia[]>;
  obtenerAsistenciaComerciantePorFecha(
    comercianteId: string,
    fecha: string
  ): Promise<RegistroAsistencia | null>;
  obtenerAsistenciaComercianteRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]>;
  obtenerAsistenciaNaveRango(
    naveId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]>;
  obtenerAsistenciaRango(
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]>;
  registrarAsistencia(
    comercianteId: string,
    fecha: string,
    estado: EstadoAsistencia,
    observacion?: string,
    observacionTexto?: string
  ): Promise<void>;
  asignarPermisoRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<void>;
  agregarObservacion(
    comercianteId: string,
    fecha: string,
    texto: string,
    fechaHora?: string
  ): Promise<ObservacionDetalle>;
  eliminarObservacion(
    comercianteId: string,
    fecha: string,
    observacionId: string
  ): Promise<void>;
  agregarPermiso(
    comercianteId: string,
    fechaAsignacion: string,
    motivo: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<PermisoDetalle>;
  eliminarPermiso(
    comercianteId: string,
    fecha: string,
    permisoId: string
  ): Promise<void>;
}
