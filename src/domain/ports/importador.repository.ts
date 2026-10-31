// ── Puerto del Dominio: IImportadorRepository ────────────────────────────────
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
  ResultadoSimulacionCatastro,
} from "@/domain/models/comerciante.model";

export interface IImportadorRepository {
  simularImportacion(
    registros: ImportacionRegistro[],
    opcionesONaveDetectada?: OpcionesImportacion | string | null,
    naveIdManual?: string
  ): Promise<ResultadoSimulacionCatastro>;
  guardarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado>;
  ejecutarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado>;
  parsearExcel(
    data: ArrayBuffer | Uint8Array,
    fileName?: string
  ): Promise<ImportacionRegistro[]>;
  parsearArchivoCatastro(
    data: ArrayBuffer | Uint8Array | string,
    fileName?: string
  ): Promise<ImportacionRegistro[]>;
  obtenerHojasExcel(data: ArrayBuffer | Uint8Array): Promise<string[]>;
  parsearXML(contenido: string, fileName?: string): Promise<ImportacionRegistro[]>;
  parsearCSV(contenido: string, fileName?: string): Promise<ImportacionRegistro[]>;
  generarRegistrosEjemplo(cantidad?: number): Promise<ImportacionRegistro[]>;
  filtrarDuplicadosExactos100(registros: ImportacionRegistro[]): {
    registrosUnicos: ImportacionRegistro[];
    duplicadosOmitidos: ImportacionRegistro[];
  };
  aplicarReglaPuestosAmbulantes(
    registros: ImportacionRegistro[],
    naveDestino?: string
  ): ImportacionRegistro[];
}
