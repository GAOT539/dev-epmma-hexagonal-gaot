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
  parsearExcel(
    data: ArrayBuffer | Uint8Array,
    fileName?: string
  ): Promise<ImportacionRegistro[]>;
  parsearXML(contenido: string): Promise<ImportacionRegistro[]>;
  parsearCSV(contenido: string): Promise<ImportacionRegistro[]>;
  generarRegistrosEjemplo(cantidad?: number): Promise<ImportacionRegistro[]>;
}
