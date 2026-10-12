// ── Puerto del Dominio: IComercianteRepository ───────────────────────────────

import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";

export interface IComercianteRepository {
  obtenerComerciantes(): Promise<Comerciante[]>;
  obtenerComerciantePorId(id: string): Promise<Comerciante | null>;
  obtenerComerciantePorPuesto(puestoId: string): Promise<Comerciante | null>;
  obtenerPuestosPorNave(naveId: string): Promise<Puesto[]>;
  crearComerciante(
    comerciante: Omit<Comerciante, "idInterno">
  ): Promise<Comerciante>;
  actualizarComerciante(
    id: string,
    datos: Partial<Omit<Comerciante, "idInterno">>
  ): Promise<Comerciante | null>;
  eliminarComerciante(id: string): Promise<boolean>;
}
