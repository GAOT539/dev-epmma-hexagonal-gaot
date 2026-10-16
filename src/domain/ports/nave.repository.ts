// ── Puerto del Dominio: INaveRepository ──────────────────────────────────────
import type { Nave, PlanoEspacialNave } from "@/domain/models/nave.model";

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
  obtenerPlanoNave(naveId: string): Promise<PlanoEspacialNave>;
  guardarPlanoNave(naveId: string, plano: PlanoEspacialNave): Promise<PlanoEspacialNave>;
  generarPlanoAutomatico(naveId: string): Promise<PlanoEspacialNave>;
}
