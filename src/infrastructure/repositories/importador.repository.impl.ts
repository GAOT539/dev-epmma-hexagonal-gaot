// ── Adaptador de Infraestructura: ImportadorRepository (Consumo Directo API REST / MySQL) ──

import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
} from "@/domain/models/comerciante.model";
import {
  parsearExcel as parserExcel,
  parsearXML as parserXML,
  parsearCSV as parserCSV,
  generarRegistrosEjemplo as parserEjemplo,
} from "@/infrastructure/parsers/catastro-file.parser";

export class ImportadorRepositoryImpl implements IImportadorRepository {
  async simularImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado> {
    const res = await fetch("/api/v1/catastro/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registros, ...(opciones || {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al simular importación");
    }
    return await res.json();
  }

  async guardarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado> {
    const res = await fetch("/api/v1/catastro/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registros, ...(opciones || {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al guardar importación");
    }
    return await res.json();
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
