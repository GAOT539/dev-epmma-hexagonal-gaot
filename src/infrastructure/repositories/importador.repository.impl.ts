// ── Adaptador de Infraestructura: ImportadorRepository (Consumo Directo API REST / MySQL) ──

import type { IImportadorRepository } from "@/domain/ports/importador.repository";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
  ResultadoSimulacionCatastro,
} from "@/domain/models/comerciante.model";
import {
  parsearExcel as parserExcel,
  parsearXML as parserXML,
  parsearCSV as parserCSV,
  generarRegistrosEjemplo as parserEjemplo,
  parsearArchivoCatastro as parserArchivoCatastro,
  obtenerHojasExcel as parserHojasExcel,
} from "@/infrastructure/parsers/catastro-file.parser";
import {
  filtrarDuplicadosExactos100 as helperDuplicados,
  aplicarReglaPuestosAmbulantes as helperAmbulantes,
} from "@/infrastructure/database/catastro-reconciliacion.service";

export class ImportadorRepositoryImpl implements IImportadorRepository {
  async simularImportacion(
    registros: ImportacionRegistro[],
    opcionesONaveDetectada?: OpcionesImportacion | string | null,
    naveIdManual?: string
  ): Promise<ResultadoSimulacionCatastro> {
    const payload =
      typeof opcionesONaveDetectada === "object" && opcionesONaveDetectada !== null
        ? { registros, ...opcionesONaveDetectada }
        : {
            registros,
            naveDetectada: opcionesONaveDetectada || undefined,
            naveIdManual: naveIdManual || undefined,
          };

    const res = await fetch("/api/v1/catastro/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async ejecutarImportacion(
    registros: ImportacionRegistro[],
    opciones?: OpcionesImportacion
  ): Promise<ImportacionResultado> {
    return this.guardarImportacion(registros, opciones);
  }

  async parsearExcel(
    data: ArrayBuffer | Uint8Array,
    fileName?: string
  ): Promise<ImportacionRegistro[]> {
    const res = parserExcel(data, fileName);
    return Promise.resolve([...res]);
  }

  async parsearArchivoCatastro(
    data: ArrayBuffer | Uint8Array | string,
    fileName?: string
  ): Promise<ImportacionRegistro[]> {
    const res = parserArchivoCatastro(data, fileName);
    return Promise.resolve([...res]);
  }

  async obtenerHojasExcel(data: ArrayBuffer | Uint8Array): Promise<string[]> {
    const res = parserHojasExcel(data);
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

  filtrarDuplicadosExactos100(registros: ImportacionRegistro[]) {
    return helperDuplicados(registros);
  }

  aplicarReglaPuestosAmbulantes(registros: ImportacionRegistro[], naveDestino?: string) {
    return helperAmbulantes(registros, naveDestino);
  }
}

export const importadorRepository = new ImportadorRepositoryImpl();
