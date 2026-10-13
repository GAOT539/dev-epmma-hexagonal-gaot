// ── Puerto del Dominio: INaveRepository ──────────────────────────────────────
import type { Nave } from "@/domain/models/nave.model";

export interface INaveRepository {
  obtenerNaves(): Promise<Nave[]>;
  obtenerNavePorId(id: string): Promise<Nave | null>;
  crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores?: string[]
  ): Promise<Nave>;
  actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null>;
  eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }>;
  obtenerSupervisoresDisponibles(): Promise<string[]>;
}
