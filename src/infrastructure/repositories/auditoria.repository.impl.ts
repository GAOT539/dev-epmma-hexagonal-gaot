// ── Adaptador de Infraestructura: AuditoriaRepository (Mock Asíncrono) ────────
import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria } from "@/domain/models/auditoria.model";
import {
  getLogsFiltrados,
  agregarLog,
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
}

export const auditoriaRepository = new AuditoriaMockRepository();
