"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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

export default function ConfiguracionImportacionPage() {
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
        toast.error("Formato no soportado");
        return;
      }
      if (parsed.length === 0) {
        toast.error("Archivo vacío");
        return;
      }
      setRegistros(parsed);
      setPaso("preview");
      toast.success(`${parsed.length} registros cargados`);
    } catch {
      toast.error("Error al procesar el archivo");
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
      if (res.errores.length === 0) toast.success("Importación completada");
      else toast.warning("Importación con errores");
    } catch {
      toast.error("Error al importar registros");
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
        <div className="flex flex-col gap-2 mb-2">
          <Link
            href="/configuracion"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Volver
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-institucional-green sm:text-3xl">
              Ingreso Masivo de Catastro
            </h1>
            <div className="flex items-center gap-2">
              <Link
                href="/configuracion/permisos"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
              >
                Permisos
              </Link>
              <Link
                href="/configuracion/usuarios"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
              >
                Usuarios
              </Link>
            </div>
          </div>
        </div>

        {/* Formatos de Ejemplo visuales CSV y XML */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
              <FileSpreadsheet size={16} className="text-institucional-green" />
              Estructura CSV requerida (.csv)
            </div>
            <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`CIU,CEDULA,CONTRIBUYENTE,ACTIVIDAD,NAVE,PUESTO
CIU-00001,1801234567,Juan Pérez López,Frutas y Verduras,NAVE A,P-A001
CIU-00002,1802345678,María Gómez Mora,Cárnicos y Embutidos,NAVE B,P-B015`}
            </pre>
          </div>

          <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
              <FileText size={16} className="text-acento-azul1" />
              Estructura XML requerida (.xml)
            </div>
            <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`<comerciantes>
  <comerciante>
    <ciu>CIU-00001</ciu>
    <cedula>1801234567</cedula>
    <contribuyente>Juan Pérez López</contribuyente>
    <actividad>Frutas y Verduras</actividad>
    <nave>NAVE A</nave>
    <puesto>P-A001</puesto>
  </comerciante>
</comerciantes>`}
            </pre>
          </div>
        </div>

        {/* ── Paso 1: Carga ── */}
        {paso === "cargar" && (
          <div
            className={[
              "flex-1 min-h-[260px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all",
              isDragOver ? "border-institucional-green bg-institucional-green/5" : "border-institucional-whiteSmokeBlack/30 bg-base-white",
            ].join(" ")}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={40} className="text-institucional-whiteSmokeBlack/40" />
            <p className="mt-3 text-sm font-medium text-base-eerieBlack">Arrastre un archivo XML o CSV aquí</p>
            <label className="mt-4 cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                <FileSpreadsheet size={14} /> Seleccionar archivo
              </span>
              <input
                type="file" accept=".xml,.csv" className="hidden"
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

        {/* ── Paso 2: Preview ── */}
        {paso === "preview" && (
          <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-base text-base-eerieBlack">Vista Previa</h2>
                <p className="text-xs text-institucional-whiteSmokeBlack">{registros.length} registros listos para importar</p>
              </div>
              <button onClick={handleReiniciar} className="text-base-red text-xs hover:underline flex items-center gap-1">
                <X size={14} /> Cancelar
              </button>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-institucional-green/10 sticky top-0 z-10">
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Nave</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Contribuyente</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Puesto</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, i) => (
                    <tr key={i} className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors">
                      <td className="px-4 py-2.5 font-normal text-gray-900">{r.nave}</td>
                      <td className="px-4 py-2.5 font-normal text-gray-900">{r.contribuyente}</td>
                      <td className="px-4 py-2.5 font-normal text-gray-900 font-mono">{r.numBodega}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex justify-end gap-3 border-t border-institucional-whiteSmokeBlack/15 bg-base-white">
              <Button variant="outline" onClick={handleReiniciar} disabled={procesando}>Cancelar</Button>
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
                  "Subir Archivo"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Resultado ── */}
        {paso === "resultado" && resultado && (
          <div className="flex-1 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-base-white p-5 ring-1 ring-acento-verdeOliva1/20 shadow-sm">
                <p className="text-2xl font-bold text-acento-verdeOliva1">{resultado.exitosos}</p>
                <p className="text-xs text-institucional-whiteSmokeBlack">Exitosos</p>
              </div>
              <div className="rounded-xl bg-base-white p-5 ring-1 ring-base-red/20 shadow-sm">
                <p className="text-2xl font-bold text-base-red">{resultado.errores.length}</p>
                <p className="text-xs text-institucional-whiteSmokeBlack">Errores</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleReiniciar} className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold">
                Nueva Importación
              </Button>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Carga */}
        <Dialog open={confirmModalOpen} disablePointerDismissal={true} onOpenChange={(o) => !o && setConfirmModalOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-eerieBlack font-bold">
                <AlertCircle className="text-acento-amarillo1" size={20} />
                Confirmar Carga de Datos
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-700 pt-1">
                ¿Está seguro? Subir este archivo podría modificar y sobrescribir los datos internos del sistema.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end pt-3">
              <Button variant="outline" onClick={() => setConfirmModalOpen(false)} disabled={procesando}>
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
                Aceptar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
