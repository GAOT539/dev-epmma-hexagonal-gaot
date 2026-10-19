// ── Adaptador de Infraestructura: AuditoriaRepository (Consumo Directo API REST / MySQL) ──

import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
  FiltrosControlSupervisor,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria, SesionControlSupervisor } from "@/domain/models/auditoria.model";
import {
  getLogsFiltrados as mockGetLogsFiltrados,
  agregarLog as mockAgregarLog,
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
    const params = new URLSearchParams();
    if (filtros.busqueda) params.set("busqueda", filtros.busqueda);
    if (filtros.supervisorId) params.set("supervisorId", filtros.supervisorId);
    if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
    if (filtros.fechaHasta) params.set("fechaHasta", filtros.fechaHasta);

    const res = await fetch(`/api/v1/auditoria/sesiones?${params.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener sesiones de control");
    }
    return await res.json();
  }

  async registrarSesionControl(
    sesion: SesionControlSupervisor
  ): Promise<void> {
    const res = await fetch("/api/v1/auditoria/sesiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sesion),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al registrar sesión de control");
    }
  }
}

export const auditoriaRepository = new AuditoriaRepositoryImpl();
