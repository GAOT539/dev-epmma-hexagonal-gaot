// ── Adaptador de Infraestructura: AuditoriaRepository (API REST + Respaldo Mock) 

import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
  FiltrosControlSupervisor,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria, SesionControlSupervisor } from "@/domain/models/auditoria.model";
import {
  getLogsFiltrados as mockGetLogsFiltrados,
  agregarLog as mockAgregarLog,
  getSesionesControl as mockGetSesionesControl,
  registrarSesionControl as mockRegistrarSesionControl,
} from "@/infrastructure/mocks/auditoria.mock";

export class AuditoriaRepositoryImpl implements IAuditoriaRepository {
  async obtenerLogsFiltrados(
    filtros: FiltrosAuditoria
  ): Promise<LogAuditoria[]> {
    return Promise.resolve([...mockGetLogsFiltrados(filtros)]);
  }

  async agregarLog(
    log: Omit<LogAuditoria, "id" | "timestamp">
  ): Promise<void> {
    mockAgregarLog(log);
    return Promise.resolve();
  }

  async obtenerSesionesControl(
    filtros: FiltrosControlSupervisor
  ): Promise<SesionControlSupervisor[]> {
    try {
      const params = new URLSearchParams();
      if (filtros.busqueda) params.set("busqueda", filtros.busqueda);
      if (filtros.supervisorId) params.set("supervisorId", filtros.supervisorId);
      if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
      if (filtros.fechaHasta) params.set("fechaHasta", filtros.fechaHasta);

      const res = await fetch(`/api/v1/auditoria/sesiones?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockGetSesionesControl(filtros)]);
  }

  async registrarSesionControl(
    sesion: SesionControlSupervisor
  ): Promise<void> {
    try {
      const res = await fetch("/api/v1/auditoria/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sesion),
      });
      if (res.ok) {
        return;
      }
    } catch {
      // Fallback
    }
    mockRegistrarSesionControl(sesion);
    return Promise.resolve();
  }
}

export const auditoriaRepository = new AuditoriaRepositoryImpl();
