// ── Puerto del Dominio: IAsistenciaRepository ────────────────────────────────

import type {
  EstadoAsistencia,
  RegistroAsistencia,
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
}
