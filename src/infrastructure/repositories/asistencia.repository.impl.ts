// ── Adaptador de Infraestructura: AsistenciaRepository (Mock Asíncrono) ───────

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
  TipoObservacion,
} from "@/domain/models/asistencia.model";
import {
  getAsistenciaPorFecha,
  getAsistenciaComerciantePorFecha,
  getAsistenciaComercianteRango,
  getAsistenciaNaveRango,
  getAsistenciaRango,
  setEstadoAsistencia,
  setPermisoComercianteRango,
  agregarObservacionMock,
  eliminarObservacionMock,
  agregarPermisoMock,
  eliminarPermisoMock,
  registrarAsistenciaConPersistenciaMock,
} from "@/infrastructure/mocks/mercado.mock";

export class AsistenciaMockRepository implements IAsistenciaRepository {
  async obtenerAsistenciaPorFecha(fecha: string): Promise<RegistroAsistencia[]> {
    return Promise.resolve([...getAsistenciaPorFecha(fecha)]);
  }

  async obtenerAsistenciaComerciantePorFecha(
    comercianteId: string,
    fecha: string
  ): Promise<RegistroAsistencia | null> {
    const reg = getAsistenciaComerciantePorFecha(comercianteId, fecha);
    return Promise.resolve(reg ? { ...reg } : null);
  }

  async obtenerAsistenciaComercianteRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return Promise.resolve([
      ...getAsistenciaComercianteRango(comercianteId, fechaInicio, fechaFin),
    ]);
  }

  async obtenerAsistenciaNaveRango(
    naveId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return Promise.resolve([
      ...getAsistenciaNaveRango(naveId, fechaInicio, fechaFin),
    ]);
  }

  async obtenerAsistenciaRango(
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    return Promise.resolve([
      ...getAsistenciaRango(fechaInicio, fechaFin),
    ]);
  }

  async registrarAsistencia(
    comercianteId: string,
    fecha: string,
    estado: EstadoAsistencia,
    observacion?: string,
    observacionTexto?: string
  ): Promise<void> {
    setEstadoAsistencia(
      comercianteId,
      fecha,
      estado,
      observacion,
      observacionTexto
    );
    return Promise.resolve();
  }

  async asignarPermisoRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<void> {
    setPermisoComercianteRango(comercianteId, fechaInicio, fechaFin);
    return Promise.resolve();
  }

  async agregarObservacion(
    comercianteId: string,
    fecha: string,
    texto: string,
    tipo?: TipoObservacion,
    numeroDocumento?: string,
    fechaHora?: string
  ): Promise<ObservacionDetalle> {
    return Promise.resolve(
      agregarObservacionMock(comercianteId, fecha, texto, tipo, numeroDocumento, fechaHora)
    );
  }

  async eliminarObservacion(
    comercianteId: string,
    fecha: string,
    observacionId: string
  ): Promise<void> {
    eliminarObservacionMock(comercianteId, fecha, observacionId);
    return Promise.resolve();
  }

  async agregarPermiso(
    comercianteId: string,
    fechaAsignacion: string,
    motivo: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<PermisoDetalle> {
    return Promise.resolve(
      agregarPermisoMock(
        comercianteId,
        fechaAsignacion,
        motivo,
        fechaInicio,
        fechaFin
      )
    );
  }

  async eliminarPermiso(
    comercianteId: string,
    fecha: string,
    permisoId: string
  ): Promise<void> {
    eliminarPermisoMock(comercianteId, fecha, permisoId);
    return Promise.resolve();
  }

  async registrarAsistenciaConPersistencia(
    naveId: string,
    fechaHasta: string,
    supervisorNombre: string,
    comentario?: string
  ): Promise<{ fechaOrigen: string; diasCubiertos: number }> {
    return Promise.resolve(
      registrarAsistenciaConPersistenciaMock(
        naveId,
        fechaHasta,
        supervisorNombre,
        comentario
      )
    );
  }
}

export const asistenciaRepository = new AsistenciaMockRepository();
