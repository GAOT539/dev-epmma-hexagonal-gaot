// ── Dominio: Modelo de Nave del Mercado EP-EMA ────────────────────────────────

import type { Puesto } from "./comerciante.model";
export type { Puesto } from "./comerciante.model";

export type CeldaPlano = CeldaPlanoNave;

export type EstadoRegistroNave = "Habilitado" | "Deshabilitado";

export type TipoCeldaPlano =
  | "PUESTO"        // Puesto comercial o bodega (cuenta para el límite de puestos de la nave)
  | "VACIO"         // Espacio en blanco / Pasillo / Corredor de circulación
  | "PARQUEADERO"   // Delimitación de parqueadero o zona vehicular (ej. PARQUEADERO DE GRANOS)
  | "DELIMITACION"  // Referencias espaciales o cabeceras (ej. NORTE, SUR, SECCIÓN PAPAS, PUERTA LANFORT)
  | "ANOTACION"     // Notas administrativas o técnicas (ej. Memorandos, observaciones de espacio)
  | "BANO";         // Servicios higiénicos, baños o baterías sanitarias

export interface CeldaPlanoNave {
  fila: number;
  columna: number;
  tipo: TipoCeldaPlano;
  /** Código o número del puesto asignado a esta celda (ej. "1", "129", "4A", "N-I-04", "S/N") */
  codigoPuesto?: string;
  /** Texto libre para Parqueaderos, Delimitaciones (Norte/Sur/Sección) o Anotaciones */
  texto?: string;
  /** Nota secundaria o detalle adicional (ej. "72M2", "puerta lanfort: con Baño", "Memorando...") */
  subtexto?: string;
  /** Color visual opcional para distinguir secciones o estados */
  colorZona?: "amarillo" | "rosado" | "naranja" | "azul" | "verde" | "gris";
  /** Alto en celdas para puestos modulares (por defecto 1) */
  rowSpan?: number;
  /** Ancho en celdas para puestos modulares (por defecto 1) */
  colSpan?: number;
}

export interface PlanoEspacialNave {
  naveId: string;
  filas: number;
  columnas: number;
  celdas: CeldaPlanoNave[];
  actualizadoEn: string;
}

export interface Nave {
  id: string;
  nombre: string;
  cantidadPuestos: number;
  supervisores: string[];
  estadoRegistro?: EstadoRegistroNave;
  limitePuestos: number;
  puestos: Puesto[];
  plano?: PlanoEspacialNave;
}

export interface ItemReporteVacante {
  id: string;
  naveId: string;
  ubicacionNave: string;
  giroNegocio: string;
  espacioComercializacion: string;
  numeroEspacioComercial: string;
  areaM2: string;
  enProcesoJudicial: boolean;
}

export interface ReporteVacantesResponse {
  items: ItemReporteVacante[];
  firmantes?: {
    elaboradoPorNombre: string;
    elaboradoPorCargo: string;
    revisadoPorNombre: string;
    revisadoPorCargo: string;
  };
}
