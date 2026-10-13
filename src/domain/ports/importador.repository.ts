// ── Puerto del Dominio: IImportadorRepository ────────────────────────────────
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";

export interface IImportadorRepository {
  simularImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado>;
  guardarImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado>;
  parsearExcel(data: ArrayBuffer | Uint8Array): Promise<ImportacionRegistro[]>;
  parsearXML(contenido: string): Promise<ImportacionRegistro[]>;
  parsearCSV(contenido: string): Promise<ImportacionRegistro[]>;
  generarRegistrosEjemplo(cantidad?: number): Promise<ImportacionRegistro[]>;
}
