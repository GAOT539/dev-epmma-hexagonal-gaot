// ── Adaptador de Infraestructura: NaveRepository (Mock Asíncrono) ─────────────
import type { INaveRepository } from "@/domain/ports/nave.repository";
import type { Nave } from "@/domain/models/nave.model";
import {
  eliminarNave,
  obtenerSupervisoresDisponibles,
} from "@/infrastructure/mocks/naves.mock";
import {
  getNaves,
  crearNave,
  actualizarNave,
} from "@/infrastructure/mocks/mercado.mock";

export class NaveMockRepository implements INaveRepository {
  async obtenerNaves(): Promise<Nave[]> {
    return Promise.resolve([...getNaves()]);
  }

  async obtenerNavePorId(id: string): Promise<Nave | null> {
    const nave = getNaves().find((n) => n.id === id) ?? null;
    return Promise.resolve(nave ? { ...nave } : null);
  }

  async crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores: string[] = []
  ): Promise<Nave> {
    const nueva = crearNave(nombre, cantidadPuestos, supervisores);
    return Promise.resolve({ ...nueva });
  }

  async actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null> {
    const actualizada = actualizarNave(id, data);
    return Promise.resolve(actualizada ? { ...actualizada } : null);
  }

  async eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }> {
    const resultado = eliminarNave(id);
    return Promise.resolve(resultado);
  }

  async obtenerSupervisoresDisponibles(): Promise<string[]> {
    return Promise.resolve([...obtenerSupervisoresDisponibles()]);
  }
}

export const naveRepository = new NaveMockRepository();
