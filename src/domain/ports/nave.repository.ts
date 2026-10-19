import type { Nave, PlanoEspacialNave, Puesto } from "@/domain/models/nave.model";

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
  obtenerPuestosNave(naveId: string): Promise<Puesto[]>;
  actualizarCodigoPuesto(
    naveId: string,
    puestoId: string,
    nuevoCodigo: string
  ): Promise<Puesto>;
  actualizarCodigosPuestosNave(
    naveId: string,
    cambios: Array<{ puestoId: string; nuevoCodigo: string }>
  ): Promise<Puesto[]>;
}

