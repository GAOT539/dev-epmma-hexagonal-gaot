// ── Adaptador de Infraestructura: AsistenciaRepository (API REST + Respaldo Mock) 

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
  TipoObservacion,
} from "@/domain/models/asistencia.model";
import {
  getAsistenciaPorFecha as mockGetAsistenciaPorFecha,
  getAsistenciaComerciantePorFecha as mockGetAsistenciaComerciantePorFecha,
  getAsistenciaComercianteRango as mockGetAsistenciaComercianteRango,
  getAsistenciaNaveRango as mockGetAsistenciaNaveRango,
  getAsistenciaRango as mockGetAsistenciaRango,
  setEstadoAsistencia as mockSetEstadoAsistencia,
  setPermisoComercianteRango as mockSetPermisoComercianteRango,
  agregarObservacionMock as mockAgregarObservacion,
  eliminarObservacionMock as mockEliminarObservacion,
  agregarPermisoMock as mockAgregarPermiso,
  eliminarPermisoMock as mockEliminarPermiso,
  registrarAsistenciaConPersistenciaMock as mockRegistrarPersistencia,
} from "@/infrastructure/mocks/mercado.mock";

export class AsistenciaRepositoryImpl implements IAsistenciaRepository {
  async obtenerAsistenciaPorFecha(fecha: string): Promise<RegistroAsistencia[]> {
    try {
      const res = await fetch(`/api/v1/asistencia?fecha=${encodeURIComponent(fecha)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockGetAsistenciaPorFecha(fecha)]);
  }

  async obtenerAsistenciaComerciantePorFecha(
    comercianteId: string,
    fecha: string
  ): Promise<RegistroAsistencia | null> {
    try {
      const res = await fetch(
        `/api/v1/asistencia?comercianteId=${encodeURIComponent(comercianteId)}&fecha=${encodeURIComponent(fecha)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const reg = mockGetAsistenciaComerciantePorFecha(comercianteId, fecha);
    return Promise.resolve(reg ? { ...reg } : null);
  }

  async obtenerAsistenciaComercianteRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    try {
      const res = await fetch(
        `/api/v1/asistencia?comercianteId=${encodeURIComponent(comercianteId)}&fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([
      ...mockGetAsistenciaComercianteRango(comercianteId, fechaInicio, fechaFin),
    ]);
  }

  async obtenerAsistenciaNaveRango(
    naveId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    try {
      const res = await fetch(
        `/api/v1/asistencia?naveId=${encodeURIComponent(naveId)}&fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([
      ...mockGetAsistenciaNaveRango(naveId, fechaInicio, fechaFin),
    ]);
  }

  async obtenerAsistenciaRango(
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    try {
      const res = await fetch(
        `/api/v1/asistencia?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([
      ...mockGetAsistenciaRango(fechaInicio, fechaFin),
    ]);
  }

  async registrarAsistencia(
    comercianteId: string,
    fecha: string,
    estado: EstadoAsistencia,
    observacion?: string,
    observacionTexto?: string
  ): Promise<void> {
    try {
      const res = await fetch("/api/v1/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comercianteId, fecha, estado, observacion, observacionTexto }),
      });
      if (res.ok) {
        return;
      }
    } catch {
      // Fallback
    }
    mockSetEstadoAsistencia(comercianteId, fecha, estado, observacion, observacionTexto);
    return Promise.resolve();
  }

  async asignarPermisoRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<void> {
    try {
      const res = await fetch("/api/v1/asistencia/permisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comercianteId,
          motivo: "Permiso institucional",
          fechaInicio,
          fechaFin,
        }),
      });
      if (res.ok) {
        return;
      }
    } catch {
      // Fallback
    }
    mockSetPermisoComercianteRango(comercianteId, fechaInicio, fechaFin);
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
    try {
      const res = await fetch("/api/v1/asistencia/observaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comercianteId, fecha, texto, tipo, numeroDocumento, fechaHora }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve(
      mockAgregarObservacion(comercianteId, fecha, texto, tipo, numeroDocumento, fechaHora)
    );
  }

  async eliminarObservacion(
    comercianteId: string,
    fecha: string,
    observacionId: string
  ): Promise<void> {
    try {
      const res = await fetch(
        `/api/v1/asistencia/observaciones?comercianteId=${encodeURIComponent(comercianteId)}&fecha=${encodeURIComponent(fecha)}&observacionId=${encodeURIComponent(observacionId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        return;
      }
    } catch {
      // Fallback
    }
    mockEliminarObservacion(comercianteId, fecha, observacionId);
    return Promise.resolve();
  }

  async agregarPermiso(
    comercianteId: string,
    fechaAsignacion: string,
    motivo: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<PermisoDetalle> {
    try {
      const res = await fetch("/api/v1/asistencia/permisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comercianteId,
          fechaAsignacion,
          motivo,
          fechaInicio,
          fechaFin,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve(
      mockAgregarPermiso(comercianteId, fechaAsignacion, motivo, fechaInicio, fechaFin)
    );
  }

  async eliminarPermiso(
    comercianteId: string,
    fecha: string,
    permisoId: string
  ): Promise<void> {
    try {
      const res = await fetch(
        `/api/v1/asistencia/permisos?comercianteId=${encodeURIComponent(comercianteId)}&permisoId=${encodeURIComponent(permisoId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        return;
      }
    } catch {
      // Fallback
    }
    mockEliminarPermiso(comercianteId, fecha, permisoId);
    return Promise.resolve();
  }

  async registrarAsistenciaConPersistencia(
    naveId: string,
    fechaHasta: string,
    supervisorNombre: string,
    comentario?: string
  ): Promise<{ fechaOrigen: string; diasCubiertos: number }> {
    try {
      const res = await fetch("/api/v1/asistencia/persistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naveId, fechaHasta, supervisorNombre, comentario }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve(
      mockRegistrarPersistencia(naveId, fechaHasta, supervisorNombre, comentario)
    );
  }
}

export const asistenciaRepository = new AsistenciaRepositoryImpl();
