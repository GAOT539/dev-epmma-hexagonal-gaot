// ── Capa de Aplicación: Servicio de Comerciantes y Puestos ───────────────────

import type { IComercianteRepository } from "@/domain/ports/comerciante.repository";
import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";
import { comercianteRepository } from "@/infrastructure/repositories/comerciante.repository.impl";

export class ComercianteService {
  constructor(private readonly repository: IComercianteRepository) {}

  async obtenerComerciantes(): Promise<Comerciante[]> {
    return this.repository.obtenerComerciantes();
  }

  async obtenerComerciantePorId(id: string): Promise<Comerciante | null> {
    return this.repository.obtenerComerciantePorId(id);
  }

  async obtenerComerciantePorPuesto(puestoId: string): Promise<Comerciante | null> {
    return this.repository.obtenerComerciantePorPuesto(puestoId);
  }

  async obtenerPuestosPorNave(naveId: string): Promise<Puesto[]> {
    return this.repository.obtenerPuestosPorNave(naveId);
  }

  async crearComerciante(
    comerciante: Omit<Comerciante, "idInterno">
  ): Promise<Comerciante> {
    return this.repository.crearComerciante(comerciante);
  }

  async actualizarComerciante(
    id: string,
    datos: Partial<Omit<Comerciante, "idInterno">>
  ): Promise<Comerciante | null> {
    return this.repository.actualizarComerciante(id, datos);
  }

  async eliminarComerciante(id: string): Promise<boolean> {
    return this.repository.eliminarComerciante(id);
  }
}

export const comercianteService = new ComercianteService(comercianteRepository);
