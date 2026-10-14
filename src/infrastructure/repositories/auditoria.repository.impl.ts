// ── Adaptador de Infraestructura: AuditoriaRepository (Mock Asíncrono) ────────
import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
  FiltrosControlSupervisor,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria, SesionControlSupervisor } from "@/domain/models/auditoria.model";
import {
  getLogsFiltrados,
  agregarLog,
  getSesionesControl,
  registrarSesionControl,
} from "@/infrastructure/mocks/auditoria.mock";

export class AuditoriaMockRepository implements IAuditoriaRepository {
  async obtenerLogsFiltrados(
    filtros: FiltrosAuditoria
  ): Promise<LogAuditoria[]> {
    return Promise.resolve([...getLogsFiltrados(filtros)]);
  }

  async agregarLog(
    log: Omit<LogAuditoria, "id" | "timestamp">
  ): Promise<void> {
    agregarLog(log);
    return Promise.resolve();
  }

  async obtenerSesionesControl(
    filtros: FiltrosControlSupervisor
  ): Promise<SesionControlSupervisor[]> {
    return Promise.resolve([...getSesionesControl(filtros)]);
  }

  async registrarSesionControl(
    sesion: SesionControlSupervisor
  ): Promise<void> {
    registrarSesionControl(sesion);
    return Promise.resolve();
  }
}

export const auditoriaRepository = new AuditoriaMockRepository();
