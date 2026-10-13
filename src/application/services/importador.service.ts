// ── Capa de Aplicación: Servicio de Importación Catastral ────────────────────
import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import { importadorRepository } from "@/infrastructure/repositories/importador.repository.impl";

export class ImportadorService {
  constructor(private readonly repository: IImportadorRepository) {}

  async simularImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado> {
    return this.repository.simularImportacion(registros);
  }

  async parsearXML(contenido: string): Promise<ImportacionRegistro[]> {
    return this.repository.parsearXML(contenido);
  }

  async parsearCSV(contenido: string): Promise<ImportacionRegistro[]> {
    return this.repository.parsearCSV(contenido);
  }

  async generarRegistrosEjemplo(cantidad?: number): Promise<ImportacionRegistro[]> {
    return this.repository.generarRegistrosEjemplo(cantidad);
  }
}

export const importadorService = new ImportadorService(importadorRepository);
