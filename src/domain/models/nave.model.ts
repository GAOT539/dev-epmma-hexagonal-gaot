// ── Dominio: Modelo de Nave del Mercado EPMMA ───────────────────────────────

import type { Puesto } from "./comerciante.model";

export type EstadoRegistroNave = "Habilitado" | "Deshabilitado";

export interface Nave {
  id: string;
  nombre: string;
  cantidadPuestos: number;
  supervisores: string[];
  estadoRegistro?: EstadoRegistroNave;
  limitePuestos: number;
  puestos: Puesto[];
}
