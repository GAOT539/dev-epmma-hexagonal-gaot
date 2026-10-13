// ── Adaptador de Infraestructura: ImportadorRepository (Mock Asíncrono) ───────
import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import {
  simularImportacion,
  guardarImportacion,
  parsearExcel,
  parsearXML,
  parsearCSV,
  generarRegistrosEjemplo,
} from "@/infrastructure/mocks/importador.mock";

export class ImportadorMockRepository implements IImportadorRepository {
  async simularImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado> {
    const res = simularImportacion(registros);
    return Promise.resolve({ ...res });
  }

  async guardarImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado> {
    const res = guardarImportacion(registros);
    return Promise.resolve({ ...res });
  }

  async parsearExcel(data: ArrayBuffer | Uint8Array): Promise<ImportacionRegistro[]> {
    const res = parsearExcel(data);
    return Promise.resolve([...res]);
  }

  async parsearXML(contenido: string): Promise<ImportacionRegistro[]> {
    const res = parsearXML(contenido);
    return Promise.resolve([...res]);
  }

  async parsearCSV(contenido: string): Promise<ImportacionRegistro[]> {
    const res = parsearCSV(contenido);
    return Promise.resolve([...res]);
  }

  async generarRegistrosEjemplo(cantidad: number = 10): Promise<ImportacionRegistro[]> {
    const res = generarRegistrosEjemplo(cantidad);
    return Promise.resolve([...res]);
  }
}

export const importadorRepository = new ImportadorMockRepository();
