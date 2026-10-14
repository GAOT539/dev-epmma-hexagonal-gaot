import type {
  IAuditoriaRepository,
  FiltrosAuditoria,
  FiltrosControlSupervisor,
} from "@/domain/ports/auditoria.repository";
import type { LogAuditoria, SesionControlSupervisor } from "@/domain/models/auditoria.model";
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

  async obtenerSesionesControl(
    filtros: FiltrosControlSupervisor
  ): Promise<SesionControlSupervisor[]> {
    return this.repository.obtenerSesionesControl(filtros);
  }

  async registrarSesionControl(
    sesion: SesionControlSupervisor
  ): Promise<void> {
    return this.repository.registrarSesionControl(sesion);
  }
}

export const auditoriaService = new AuditoriaService(auditoriaRepository);
