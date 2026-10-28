import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
  ResultadoSimulacionCatastro,
} from "@/domain/models/comerciante.model";
import { importadorRepository } from "@/infrastructure/repositories/importador.repository.impl";
import {
  filtrarDuplicadosExactos100,
  aplicarReglaPuestosAmbulantes,
} from "@/infrastructure/database/catastro-reconciliacion.service";

export { filtrarDuplicadosExactos100, aplicarReglaPuestosAmbulantes };

export class ImportadorService {
  constructor(private readonly repository: IImportadorRepository) {}

  async simularImportacion(
    registros: ImportacionRegistro[],
    opcionesONaveDetectada?: OpcionesImportacion | string | null,
    naveIdManual?: string
  ): Promise<ResultadoSimulacionCatastro> {
    return this.repository.simularImportacion(
      registros,
      opcionesONaveDetectada,
      naveIdManual
    );
  }

  async guardarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado> {
    return this.repository.guardarImportacion(registros, opciones);
  }

  async parsearExcel(
    data: ArrayBuffer | Uint8Array,
    fileName?: string
  ): Promise<ImportacionRegistro[]> {
    return this.repository.parsearExcel(data, fileName);
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
