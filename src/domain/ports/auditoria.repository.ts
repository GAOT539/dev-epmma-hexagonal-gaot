// ── Puerto del Dominio: IAuditoriaRepository ─────────────────────────────────
import type { LogAuditoria } from "@/domain/models/auditoria.model";

export interface FiltrosAuditoria {
  busqueda?: string;
  usuarioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface IAuditoriaRepository {
  obtenerLogsFiltrados(filtros: FiltrosAuditoria): Promise<LogAuditoria[]>;
  agregarLog(log: Omit<LogAuditoria, "id" | "timestamp">): Promise<void>;
}
