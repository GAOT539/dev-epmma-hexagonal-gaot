"use client";

import { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { importadorService } from "@/application/services/importador.service";
import type { ImportacionRegistro, ImportacionResultado } from "@/domain/models/comerciante.model";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function IngresoCatastroPage() {
  const [registros, setRegistros] = useState<ImportacionRegistro[]>([]);
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  async function handleFileInput(contenido: string, nombre: string) {
    setArchivoNombre(nombre);
    let parsed: ImportacionRegistro[];
    try {
      if (nombre.endsWith(".xml")) {
        parsed = await importadorService.parsearXML(contenido);
      } else if (nombre.endsWith(".csv")) {
        parsed = await importadorService.parsearCSV(contenido);
      } else {
        toast.error("Formato no soportado. Debe ser un archivo .xml o .csv");
        return;
      }
      if (parsed.length === 0) {
        toast.error("El archivo no contiene registros válidos.");
        return;
      }
      setRegistros(parsed);
      setPaso("preview");
      toast.success(`${parsed.length} registros cargados exitosamente.`);
    } catch {
      toast.error("Error al procesar el archivo. Verifique el formato e intente nuevamente.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await handleFileInput(ev.target?.result as string, file.name);
    };
    reader.readAsText(file);
  }

  async function handleProcesar() {
    setProcesando(true);
    try {
      const res = await importadorService.simularImportacion(registros);
      setResultado(res);
      setPaso("resultado");
      if (res.errores.length === 0) {
        toast.success("Importación completada exitosamente.");
      } else {
        toast.warning("Importación finalizada con observaciones o errores.");
      }
    } catch {
      toast.error("Error al importar registros al catastro.");
    } finally {
      setProcesando(false);
    }
  }

  function handleReiniciar() {
    setRegistros([]);
    setResultado(null);
    setArchivoNombre("");
    setPaso("cargar");
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[100dvh] bg-institucional-whiteSmoke">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Encabezado Institucional ── */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-institucional-green" aria-hidden="true" />
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Ingreso de Catastro e Importación Masiva
            </h1>
          </div>
          <p className="text-sm font-medium text-gray-700">
            Carga masiva, validación y procesamiento de comerciantes desde archivos XML y CSV.
          </p>
        </header>

        {/* ── Formatos de Estructura Requerida ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
              <FileSpreadsheet size={16} className="text-institucional-green" />
              <span>Estructura CSV requerida (.csv)</span>
            </div>
            <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`Nave,Contribuyente,NumBodega,Gen01Codi
Nave A,Juan Pérez Morales,B-001,GC-00001
Nave B,María Torres Guzmán,B-002,GC-00002`}
            </pre>
          </div>

          <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
              <FileText size={16} className="text-acento-azul1" />
              <span>Estructura XML requerida (.xml)</span>
            </div>
            <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`<Importacion>
  <Registro>
    <Nave>Nave A</Nave>
    <Contribuyente>Juan Pérez Morales</Contribuyente>
    <NumBodega>B-001</NumBodega>
    <Gen01Codi>GC-00001</Gen01Codi>
  </Registro>
</Importacion>`}
            </pre>
          </div>
        </div>

        {/* ── Paso 1: Carga de Archivo ── */}
        {paso === "cargar" && (
          <div
            className={[
              "flex-1 min-h-[260px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all",
              isDragOver
                ? "border-institucional-green bg-institucional-green/5"
                : "border-institucional-whiteSmokeBlack/30 bg-base-white",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={40} className="text-institucional-whiteSmokeBlack/40" />
            <p className="mt-3 text-sm font-medium text-base-eerieBlack">
              Arrastre y suelte un archivo XML o CSV aquí
            </p>
            <label className="mt-4 cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                <FileSpreadsheet size={14} /> Seleccionar archivo
              </span>
              <input
                type="file"
                accept=".xml,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    await handleFileInput(ev.target?.result as string, file.name);
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        )}

        {/* ── Paso 2: Vista Previa y Validación ── */}
        {paso === "preview" && (
          <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-base text-base-eerieBlack">Vista Previa de Comerciantes</h2>
                <p className="text-xs text-gray-700">{registros.length} registros listos para importar</p>
              </div>
              <button
                type="button"
                onClick={handleReiniciar}
                className="text-base-red text-xs hover:underline flex items-center gap-1 font-medium"
              >
                <X size={14} /> Cancelar
              </button>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-institucional-green/10 sticky top-0 z-10">
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Nave</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Contribuyente</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Puesto / Bodega</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Cód. Interno</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-base-eerieBlack">{r.nave}</td>
                      <td className="px-4 py-2.5 font-semibold text-base-eerieBlack">{r.contribuyente}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-900">{r.numBodega}</td>
                      <td className="px-4 py-2.5 font-mono text-acento-azul1 font-medium">{r.gen01Codi || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex justify-end gap-3 border-t border-institucional-whiteSmokeBlack/15 bg-base-white">
              <Button variant="outline" onClick={handleReiniciar} disabled={procesando}>
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirmModalOpen(true)}
                disabled={procesando}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Procesar e Importar"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Resumen de Resultados ── */}
        {paso === "resultado" && resultado && (
          <div className="flex-1 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-base-white p-5 ring-1 ring-acento-verdeOliva1/20 shadow-sm">
                <p className="text-2xl font-bold text-acento-verdeOliva1">{resultado.exitosos}</p>
                <p className="text-xs text-gray-700 font-medium">Registros importados con éxito</p>
              </div>
              <div className="rounded-xl bg-base-white p-5 ring-1 ring-base-red/20 shadow-sm">
                <p className="text-2xl font-bold text-base-red">{resultado.errores.length}</p>
                <p className="text-xs text-gray-700 font-medium">Errores u observaciones</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleReiniciar}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Nueva Importación
              </Button>
            </div>
          </div>
        )}

        {/* ── Modal de Confirmación ── */}
        <Dialog
          open={confirmModalOpen}
          disablePointerDismissal={true}
          onOpenChange={(o) => !o && setConfirmModalOpen(false)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-eerieBlack font-bold">
                <AlertCircle className="text-amber-500" size={20} />
                Confirmar Carga de Catastro
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-700 pt-1">
                ¿Está seguro de procesar estos {registros.length} registros? Esta operación registrará o actualizará comerciantes en las naves asignadas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end pt-3">
              <Button
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setConfirmModalOpen(false);
                  await handleProcesar();
                }}
                disabled={procesando}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Aceptar y Procesar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
