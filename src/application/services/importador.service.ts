import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
  ResultadoSimulacionCatastro,
} from "@/domain/models/comerciante.model";
import { importadorRepository } from "@/infrastructure/repositories/importador.repository.impl";

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

  async ejecutarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado> {
    return this.repository.ejecutarImportacion(registros, opciones);
  }

  async parsearExcel(
    data: ArrayBuffer | Uint8Array,
    fileName?: string
  ): Promise<ImportacionRegistro[]> {
    return this.repository.parsearExcel(data, fileName);
  }

  async parsearArchivoCatastro(
    data: ArrayBuffer | Uint8Array | string,
    fileName?: string
  ): Promise<ImportacionRegistro[]> {
    return this.repository.parsearArchivoCatastro(data, fileName);
  }

  async obtenerHojasExcel(data: ArrayBuffer | Uint8Array): Promise<string[]> {
    return this.repository.obtenerHojasExcel(data);
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

  filtrarDuplicadosExactos100(registros: ImportacionRegistro[]) {
    return this.repository.filtrarDuplicadosExactos100(registros);
  }

  aplicarReglaPuestosAmbulantes(registros: ImportacionRegistro[], naveDestino?: string) {
    return this.repository.aplicarReglaPuestosAmbulantes(registros, naveDestino);
  }
}

export const importadorService = new ImportadorService(importadorRepository);

export function filtrarDuplicadosExactos100(registros: ImportacionRegistro[]) {
  return importadorService.filtrarDuplicadosExactos100(registros);
}

export function aplicarReglaPuestosAmbulantes(
  registros: ImportacionRegistro[],
  naveDestino?: string
) {
  return importadorService.aplicarReglaPuestosAmbulantes(registros, naveDestino);
}
