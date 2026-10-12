// ── Adaptador de Infraestructura: ComercianteRepository (Mock Asíncrono) ──────

import type { IComercianteRepository } from "@/domain/ports/comerciante.repository";
import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";
import {
  getComerciantes,
  getComerciantePorId,
  getComerciantePorPuesto,
  getPuestosPorNave,
  agregarComerciante,
  editarComerciante,
  eliminarComerciante,
} from "@/infrastructure/mocks/mercado.mock";

export class ComercianteMockRepository implements IComercianteRepository {
  async obtenerComerciantes(): Promise<Comerciante[]> {
    return Promise.resolve([...getComerciantes()]);
  }

  async obtenerComerciantePorId(id: string): Promise<Comerciante | null> {
    const com = getComerciantePorId(id);
    return Promise.resolve(com ? { ...com } : null);
  }

  async obtenerComerciantePorPuesto(puestoId: string): Promise<Comerciante | null> {
    const com = getComerciantePorPuesto(puestoId);
    return Promise.resolve(com ? { ...com } : null);
  }

  async obtenerPuestosPorNave(naveId: string): Promise<Puesto[]> {
    return Promise.resolve([...getPuestosPorNave(naveId)]);
  }

  async crearComerciante(
    comerciante: Omit<Comerciante, "idInterno">
  ): Promise<Comerciante> {
    const creado = agregarComerciante(comerciante);
    return Promise.resolve({ ...creado });
  }

  async actualizarComerciante(
    id: string,
    datos: Partial<Omit<Comerciante, "idInterno">>
  ): Promise<Comerciante | null> {
    const actualizado = editarComerciante(id, datos);
    return Promise.resolve(actualizado ? { ...actualizado } : null);
  }

  async eliminarComerciante(id: string): Promise<boolean> {
    const eliminado = eliminarComerciante(id);
    return Promise.resolve(eliminado);
  }
}

export const comercianteRepository = new ComercianteMockRepository();
