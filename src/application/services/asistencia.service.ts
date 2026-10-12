// ── Capa de Aplicación: Servicio de Asistencia ───────────────────────────────

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
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
}

export const asistenciaService = new AsistenciaService(asistenciaRepository);
