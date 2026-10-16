// ── Puerto del Dominio: IAuditoriaRepository (Control de Supervisores) ─────────
import type { LogAuditoria, SesionControlSupervisor } from "@/domain/models/auditoria.model";

export interface FiltrosAuditoria {
  busqueda?: string;
  usuarioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface FiltrosControlSupervisor {
  busqueda?: string;
  supervisorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface IAuditoriaRepository {
  obtenerLogsFiltrados(filtros: FiltrosAuditoria): Promise<LogAuditoria[]>;
  agregarLog(log: Omit<LogAuditoria, "id" | "timestamp">): Promise<void>;
  obtenerSesionesControl(filtros: FiltrosControlSupervisor): Promise<SesionControlSupervisor[]>;
  registrarSesionControl(sesion: SesionControlSupervisor): Promise<void>;
}
