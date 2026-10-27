// ── Capa de Aplicación: Servicio de Asistencia ───────────────────────────────

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
  TipoObservacion,
} from "@/domain/models/asistencia.model";
import { asistenciaRepository } from "@/infrastructure/repositories/asistencia.repository.impl";

export class AsistenciaService {
  constructor(private readonly repository: IAsistenciaRepository) {}

  async obtenerAsistenciaPorFecha(fecha: string): Promise<RegistroAsistencia[]> {
    return this.repository.obtenerAsistenciaPorFecha(fecha);
  }

  async obtenerAsistenciaComerciantePorFecha(
    comercianteId: string,
    fecha: string
  ): Promise<RegistroAsistencia | null> {
    return this.repository.obtenerAsistenciaComerciantePorFecha(comercianteId, fecha);
  }

  async obtenerAsistenciaComercianteRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return this.repository.obtenerAsistenciaComercianteRango(
      comercianteId,
      fechaInicio,
      fechaFin
    );
  }

  async obtenerAsistenciaNaveRango(
    naveId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return this.repository.obtenerAsistenciaNaveRango(
      naveId,
      fechaInicio,
      fechaFin
    );
  }

  async obtenerAsistenciaRango(
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return this.repository.obtenerAsistenciaRango(fechaInicio, fechaFin);
  }

  async registrarAsistencia(
    comercianteId: string,
    fecha: string,
    estado: EstadoAsistencia,
    observacion?: string,
    observacionTexto?: string
  ): Promise<void> {
    return this.repository.registrarAsistencia(
      comercianteId,
      fecha,
      estado,
      observacion,
      observacionTexto
    );
  }

  async asignarPermisoRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<void> {
    return this.repository.asignarPermisoRango(comercianteId, fechaInicio, fechaFin);
  }

  async agregarObservacion(
    comercianteId: string,
    fecha: string,
    texto: string,
    tipo?: TipoObservacion,
    numeroDocumento?: string,
    fechaHora?: string
  ): Promise<ObservacionDetalle> {
    return this.repository.agregarObservacion(
      comercianteId,
      fecha,
      texto,
      tipo,
      numeroDocumento,
      fechaHora
    );
  }

  async eliminarObservacion(
    comercianteId: string,
    fecha: string,
    observacionId: string
  ): Promise<void> {
    return this.repository.eliminarObservacion(
      comercianteId,
      fecha,
      observacionId
    );
  }

  async agregarPermiso(
    comercianteId: string,
    fechaAsignacion: string,
    motivo: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<PermisoDetalle> {
    return this.repository.agregarPermiso(
      comercianteId,
      fechaAsignacion,
      motivo,
      fechaInicio,
      fechaFin
    );
  }

  async eliminarPermiso(
    comercianteId: string,
    fecha: string,
    permisoId: string
  ): Promise<void> {
    return this.repository.eliminarPermiso(
      comercianteId,
      fecha,
      permisoId
    );
  }

  async registrarAsistenciaConPersistencia(
    naveId: string,
    fechaHasta: string,
    supervisorNombre: string,
    comentario?: string
  ): Promise<{ fechaOrigen: string; diasCubiertos: number }> {
    return this.repository.registrarAsistenciaConPersistencia(
      naveId,
      fechaHasta,
      supervisorNombre,
      comentario
    );
  }

  async justificarFaltaComerciante(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string,
    motivo: string
  ): Promise<{ diasJustificados: number }> {
    return this.repository.justificarFaltaComerciante(
      comercianteId,
      fechaInicio,
      fechaFin,
      motivo
    );
  }
}

export const asistenciaService = new AsistenciaService(asistenciaRepository);
