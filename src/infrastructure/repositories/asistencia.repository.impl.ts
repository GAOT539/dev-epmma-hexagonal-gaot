// ── Adaptador de Infraestructura: AsistenciaRepository (Consumo Directo API REST / MySQL) ──

import type { IAsistenciaRepository } from "@/domain/ports/asistencia.repository";
import type {
  EstadoAsistencia,
  RegistroAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
  TipoObservacion,
} from "@/domain/models/asistencia.model";

export class AsistenciaRepositoryImpl implements IAsistenciaRepository {
  async obtenerAsistenciaPorFecha(fecha: string): Promise<RegistroAsistencia[]> {
    const res = await fetch(`/api/v1/asistencia?fecha=${encodeURIComponent(fecha)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener asistencia por fecha");
    }
    return await res.json();
  }

  async obtenerAsistenciaComerciantePorFecha(
    comercianteId: string,
    fecha: string
  ): Promise<RegistroAsistencia | null> {
    const res = await fetch(
      `/api/v1/asistencia?comercianteId=${encodeURIComponent(comercianteId)}&fecha=${encodeURIComponent(fecha)}`
    );
    if (!res.ok) {
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener asistencia del comerciante");
    }
    return await res.json();
  }

  async obtenerAsistenciaComercianteRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    const res = await fetch(
      `/api/v1/asistencia?comercianteId=${encodeURIComponent(comercianteId)}&fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener asistencia en rango");
    }
    return await res.json();
  }

  async obtenerAsistenciaNaveRango(
    naveId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    const res = await fetch(
      `/api/v1/asistencia?naveId=${encodeURIComponent(naveId)}&fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener asistencia de nave en rango");
    }
    return await res.json();
  }

  async obtenerAsistenciaRango(
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroAsistencia[]> {
    const res = await fetch(
      `/api/v1/asistencia?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener asistencia en rango general");
    }
    return await res.json();
  }

  async registrarAsistencia(
    comercianteId: string,
    fecha: string,
    estado: EstadoAsistencia,
    observacion?: string,
    observacionTexto?: string
  ): Promise<void> {
    const res = await fetch("/api/v1/asistencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercianteId, fecha, estado, observacion, observacionTexto }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al registrar asistencia");
    }
  }

  async asignarPermisoRango(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<void> {
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al asignar permiso");
    }
  }

  async agregarObservacion(
    comercianteId: string,
    fecha: string,
    texto: string,
    tipo?: TipoObservacion,
    numeroDocumento?: string,
    fechaHora?: string
  ): Promise<ObservacionDetalle> {
    const res = await fetch("/api/v1/asistencia/observaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercianteId, fecha, texto, tipo, numeroDocumento, fechaHora }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al registrar la observación");
    }
    return await res.json();
  }

  async eliminarObservacion(
    comercianteId: string,
    fecha: string,
    observacionId: string
  ): Promise<void> {
    const res = await fetch(
      `/api/v1/asistencia/observaciones?comercianteId=${encodeURIComponent(comercianteId)}&fecha=${encodeURIComponent(fecha)}&observacionId=${encodeURIComponent(observacionId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al eliminar la observación");
    }
  }

  async agregarPermiso(
    comercianteId: string,
    fechaAsignacion: string,
    motivo: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<PermisoDetalle> {
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al registrar el permiso");
    }
    return await res.json();
  }

  async eliminarPermiso(
    comercianteId: string,
    fecha: string,
    permisoId: string
  ): Promise<void> {
    const res = await fetch(
      `/api/v1/asistencia/permisos?comercianteId=${encodeURIComponent(comercianteId)}&permisoId=${encodeURIComponent(permisoId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al eliminar el permiso");
    }
  }

  async registrarAsistenciaConPersistencia(
    naveId: string,
    fechaHasta: string,
    supervisorNombre: string,
    comentario?: string
  ): Promise<{ fechaOrigen: string; diasCubiertos: number }> {
    const res = await fetch("/api/v1/asistencia/persistencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naveId, fechaHasta, supervisorNombre, comentario }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al registrar asistencia con persistencia");
    }
    return await res.json();
  }

  async justificarFaltaComerciante(
    comercianteId: string,
    fechaInicio: string,
    fechaFin: string,
    motivo: string
  ): Promise<{ diasJustificados: number }> {
    const res = await fetch("/api/v1/asistencia/justificar-falta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comercianteId, fechaInicio, fechaFin, motivo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al justificar la falta");
    }
    return await res.json();
  }
}

export const asistenciaRepository = new AsistenciaRepositoryImpl();
