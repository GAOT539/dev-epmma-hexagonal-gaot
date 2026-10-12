// ── Adaptador de Infraestructura: AsistenciaRepository (Mock Asíncrono) ───────

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
} from "@/domain/models/asistencia.model";
import {
  getAsistenciaPorFecha,
  getAsistenciaComerciantePorFecha,
  getAsistenciaComercianteRango,
  setEstadoAsistencia,
  setPermisoComercianteRango,
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
}

export const asistenciaRepository = new AsistenciaMockRepository();
