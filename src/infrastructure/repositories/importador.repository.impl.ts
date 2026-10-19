// ── Adaptador de Infraestructura: ImportadorRepository (API REST + Respaldo Mock) 

import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import {
  simularImportacion as mockSimularImportacion,
  guardarImportacion as mockGuardarImportacion,
  parsearExcel as parserExcel,
  parsearXML as parserXML,
  parsearCSV as parserCSV,
  generarRegistrosEjemplo as parserEjemplo,
} from "@/infrastructure/mocks/importador.mock";

export class ImportadorRepositoryImpl implements IImportadorRepository {
  async simularImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado> {
    try {
      const res = await fetch("/api/v1/catastro/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const res = mockSimularImportacion(registros);
    return Promise.resolve({ ...res });
  }

  async guardarImportacion(
    registros: ImportacionRegistro[]
  ): Promise<ImportacionResultado> {
    try {
      const res = await fetch("/api/v1/catastro/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const res = mockGuardarImportacion(registros);
    return Promise.resolve({ ...res });
  }

  async parsearExcel(data: ArrayBuffer | Uint8Array): Promise<ImportacionRegistro[]> {
    const res = parserExcel(data);
    return Promise.resolve([...res]);
  }

  async parsearXML(contenido: string): Promise<ImportacionRegistro[]> {
    const res = parserXML(contenido);
    return Promise.resolve([...res]);
  }

  async parsearCSV(contenido: string): Promise<ImportacionRegistro[]> {
    const res = parserCSV(contenido);
    return Promise.resolve([...res]);
  }

  async generarRegistrosEjemplo(cantidad: number = 10): Promise<ImportacionRegistro[]> {
    const res = parserEjemplo(cantidad);
    return Promise.resolve([...res]);
  }
}

export const importadorRepository = new ImportadorRepositoryImpl();
