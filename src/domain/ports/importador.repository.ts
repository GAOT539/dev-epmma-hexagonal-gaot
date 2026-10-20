// ── Puerto del Dominio: IImportadorRepository ────────────────────────────────
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
} from "@/domain/models/comerciante.model";

export interface IImportadorRepository {
  simularImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado>;
  guardarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado>;
  parsearExcel(data: ArrayBuffer | Uint8Array): Promise<ImportacionRegistro[]>;
  parsearXML(contenido: string): Promise<ImportacionRegistro[]>;
  parsearCSV(contenido: string): Promise<ImportacionRegistro[]>;
  generarRegistrosEjemplo(cantidad?: number): Promise<ImportacionRegistro[]>;
}
