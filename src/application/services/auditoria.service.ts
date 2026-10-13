// ── Capa de Aplicación: Servicio de Auditoría ─────────────────────────────────
import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria } from "@/domain/models/auditoria.model";
import { auditoriaRepository } from "@/infrastructure/repositories/auditoria.repository.impl";

export class AuditoriaService {
  constructor(private readonly repository: IAuditoriaRepository) {}

  async obtenerLogsFiltrados(
    filtros: FiltrosAuditoria
  ): Promise<LogAuditoria[]> {
    return this.repository.obtenerLogsFiltrados(filtros);
  }

  async registrarLog(
    log: Omit<LogAuditoria, "id" | "timestamp">
  ): Promise<void> {
    return this.repository.agregarLog(log);
  }
}

export const auditoriaService = new AuditoriaService(auditoriaRepository);
