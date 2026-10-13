// ── Capa de Aplicación: Servicio de Naves ─────────────────────────────────────
import type { INaveRepository } from "@/domain/ports/nave.repository";
import type { Nave } from "@/domain/models/nave.model";
import { naveRepository } from "@/infrastructure/repositories/nave.repository.impl";

export class NaveService {
  constructor(private readonly repository: INaveRepository) {}

  async obtenerNaves(): Promise<Nave[]> {
    return this.repository.obtenerNaves();
  }

  async obtenerNavePorId(id: string): Promise<Nave | null> {
    return this.repository.obtenerNavePorId(id);
  }

  async crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores: string[] = []
  ): Promise<Nave> {
    return this.repository.crearNave(nombre, cantidadPuestos, supervisores);
  }

  async actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null> {
    return this.repository.actualizarNave(id, data);
  }

  async eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }> {
    return this.repository.eliminarNave(id);
  }

  async obtenerSupervisoresDisponibles(): Promise<string[]> {
    return this.repository.obtenerSupervisoresDisponibles();
  }
}

export const naveService = new NaveService(naveRepository);
