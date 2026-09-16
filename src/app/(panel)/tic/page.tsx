"use client";

import { useCallback, useState } from "react";
import {
  Monitor,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import {
  generarRegistrosEjemplo,
  simularImportacion,
  parsearXML,
  parsearCSV,
  XML_EJEMPLO,
  CSV_EJEMPLO,
} from "@/infrastructure/mocks/importador.mock";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import { toast } from "sonner";

// ── Página TIC / Catastro ────────────────────────────────────────────────────

export default function TicPage() {
  const [registros, setRegistros] = useState<ImportacionRegistro[]>([]);
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");

  // Simular lectura de archivo
  function handleFileInput(contenido: string, nombre: string) {
    setArchivoNombre(nombre);

    let parsed: ImportacionRegistro[];
    if (nombre.endsWith(".xml")) {
      parsed = parsearXML(contenido);
    } else if (nombre.endsWith(".csv")) {
      parsed = parsearCSV(contenido);
    } else {
      toast.error("Formato no soportado", {
        description: "Solo se aceptan archivos XML o CSV.",
      });
      return;
    }

    if (parsed.length === 0) {
      toast.error("Archivo vacío", {
        description: "No se encontraron registros en el archivo.",
      });
      return;
    }

    setRegistros(parsed);
    setPaso("preview");
    toast.success(`${parsed.length} registros cargados`, {
      description: `Archivo: ${nombre}`,
    });
  }

  // Simular drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleFileInput(text, file.name);
    };
    reader.readAsText(file);
  }

  // Cargar datos de ejemplo
  function handleCargarEjemploXML() {
    handleFileInput(XML_EJEMPLO, "ejemplo_catastro.xml");
  }

  function handleCargarEjemploCSV() {
    handleFileInput(CSV_EJEMPLO, "ejemplo_catastro.csv");
  }

  // Procesar importación
  function handleProcesar() {
    const res = simularImportacion(registros);
    setResultado(res);
    setPaso("resultado");

    if (res.errores.length === 0) {
      toast.success("Importación completada sin errores", {
        description: `${res.exitosos} registros procesados exitosamente.`,
      });
    } else {
      toast.warning("Importación con errores", {
        description: `${res.exitosos} exitosos, ${res.errores.length} errores.`,
      });
    }
  }

  // Reiniciar
  function handleReiniciar() {
    setRegistros([]);
    setResultado(null);
    setArchivoNombre("");
    setPaso("cargar");
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Monitor size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Catastro – Carga Masiva
          </h1>
        </div>
        <p className="mt-2 text-sm text-institucional-whiteSmokeBlack">
          Importa datos de contribuyentes y puestos desde archivos XML o CSV.
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* ── Paso 1: Carga ── */}
        {paso === "cargar" && (
          <>
            {/* Zona de drag & drop */}
            <div
              className={[
                "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all",
                isDragOver
                  ? "border-institucional-green bg-institucional-green/5 scale-[1.01]"
                  : "border-institucional-whiteSmokeBlack/30 bg-base-white hover:border-institucional-green/50",
              ].join(" ")}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload
                size={40}
                className={
                  isDragOver
                    ? "text-institucional-green"
                    : "text-institucional-whiteSmokeBlack/40"
                }
              />
              <p className="mt-3 text-sm font-medium text-base-eerieBlack">
                Arrastre un archivo XML o CSV aquí
              </p>
              <p className="mt-1 text-xs text-institucional-whiteSmokeBlack">
                Formato: Nave, Contribuyente, NumBodega, Gen01Codi
              </p>

              {/* Input de archivo */}
              <label className="mt-4 cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                  <FileSpreadsheet size={14} />
                  Seleccionar archivo
                </span>
                <input
                  type="file"
                  accept=".xml,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      handleFileInput(ev.target?.result as string, file.name);
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>

            {/* Datos de ejemplo */}
            <div className="rounded-2xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
              <h2 className="text-sm font-bold text-base-eerieBlack mb-3 flex items-center gap-2">
                <FileText size={16} className="text-institucional-green" />
                Cargar Datos de Ejemplo
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCargarEjemploXML}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-acento-azul1/10 px-4 py-3 text-xs font-semibold text-acento-azul1 transition-colors hover:bg-acento-azul1/20"
                >
                  <FileSpreadsheet size={16} />
                  Ejemplo XML (3 registros)
                </button>
                <button
                  type="button"
                  onClick={handleCargarEjemploCSV}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-acento-verdeOliva1/10 px-4 py-3 text-xs font-semibold text-acento-verdeOliva1 transition-colors hover:bg-acento-verdeOliva1/20"
                >
                  <FileSpreadsheet size={16} />
                  Ejemplo CSV (5 registros)
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Paso 2: Preview ── */}
        {paso === "preview" && (
          <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-base-eerieBlack">
                  Vista Previa de Importación
                </h2>
                <p className="text-xs text-institucional-whiteSmokeBlack mt-0.5">
                  Archivo: {archivoNombre} · {registros.length} registros
                </p>
              </div>
              <button
                type="button"
                onClick={handleReiniciar}
                className="flex items-center gap-1 text-xs font-medium text-base-red hover:underline"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-institucional-green/10">
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      #
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Nave
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Contribuyente
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      NumBodega
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Gen01Codi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((reg, i) => (
                    <tr
                      key={i}
                      className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50"
                    >
                      <td className="px-4 py-2 text-institucional-whiteSmokeBlack font-medium">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2 text-base-eerieBlack font-medium">
                        {reg.nave}
                      </td>
                      <td className="px-4 py-2 text-base-eerieBlack">
                        {reg.contribuyente}
                      </td>
                      <td className="px-4 py-2 text-base-eerieBlack">
                        {reg.numBodega}
                      </td>
                      <td className="px-4 py-2 text-base-eerieBlack">
                        {reg.gen01Codi}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-institucional-whiteSmokeBlack/15 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReiniciar}
                className="h-9 rounded-lg px-5 text-xs font-semibold text-base-eerieBlack ring-1 ring-institucional-whiteSmokeBlack/30 transition-colors hover:bg-institucional-whiteSmoke"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcesar}
                className="h-9 rounded-lg bg-institucional-green px-6 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1"
              >
                Procesar Importación
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Resultado ── */}
        {paso === "resultado" && resultado && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-base-white p-5 shadow-sm ring-1 ring-acento-verdeOliva1/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-acento-verdeOliva1/10">
                    <CheckCircle2
                      size={20}
                      className="text-acento-verdeOliva1"
                    />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-acento-verdeOliva1">
                      {resultado.exitosos}
                    </p>
                    <p className="text-xs text-institucional-whiteSmokeBlack">
                      Exitosos
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-base-white p-5 shadow-sm ring-1 ring-base-red/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-base-red/10">
                    <AlertCircle size={20} className="text-base-red" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-base-red">
                      {resultado.errores.length}
                    </p>
                    <p className="text-xs text-institucional-whiteSmokeBlack">
                      Errores
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalle de errores */}
            {resultado.errores.length > 0 && (
              <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-base-red/20 overflow-hidden">
                <div className="px-5 py-3 border-b border-base-red/10 bg-base-red/5">
                  <h3 className="text-sm font-bold text-base-red flex items-center gap-2">
                    <AlertCircle size={16} />
                    Detalle de Errores
                  </h3>
                </div>
                <ul className="divide-y divide-institucional-whiteSmokeBlack/10">
                  {resultado.errores.map((err, i) => (
                    <li key={i} className="px-5 py-3 flex items-start gap-3">
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-base-red/10 text-[10px] font-bold text-base-red">
                        {err.fila}
                      </span>
                      <p className="text-xs text-base-eerieBlack">
                        {err.mensaje}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleReiniciar}
                className="h-9 rounded-lg bg-institucional-green px-6 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1"
              >
                Nueva Importación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
