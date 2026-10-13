"use client";

import { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
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
  const [archivoNombre, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [parseando, setParseando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  async function procesarArchivo(file: File) {
    setArchivoNombre(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase();
    setParseando(true);

    try {
      let parsed: ImportacionRegistro[] = [];

      if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        parsed = await importadorService.parsearExcel(buffer);
      } else if (extension === "csv") {
        const buffer = await file.arrayBuffer();
        try {
          parsed = await importadorService.parsearExcel(buffer);
        } catch {
          const texto = await file.text();
          parsed = await importadorService.parsearCSV(texto);
        }
      } else if (extension === "xml") {
        const texto = await file.text();
        parsed = await importadorService.parsearXML(texto);
      } else {
        toast.error("Formato no soportado. Cargue un archivo .xlsx, .xls, .csv o .xml");
        return;
      }

      if (parsed.length === 0) {
        toast.error("No se detectaron comerciantes válidos con cédula en el archivo.");
        return;
      }

      setRegistros(parsed);
      setPaso("preview");
      toast.success(`${parsed.length} comerciantes detectados correctamente.`);
    } catch (error) {
      console.error("Error al procesar el archivo:", error);
      toast.error("Error al interpretar el archivo. Verifique el formato e intente nuevamente.");
    } finally {
      setParseando(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      procesarArchivo(file);
    }
  }

  async function handleConfirmarImportacion() {
    setProcesando(true);
    try {
      const res = await importadorService.guardarImportacion(registros);
      setResultado(res);
      setPaso("resultado");

      if (res.exitosos > 0) {
        toast.success(`Se importaron ${res.exitosos} comerciantes exitosamente al catastro.`);
      }
      if (res.errores.length > 0) {
        toast.warning(`${res.errores.length} registros no pudieron ser procesados.`);
      }
    } catch (error) {
      console.error("Error al guardar importación:", error);
      toast.error("Ocurrió un error al persistir los comerciantes en el sistema.");
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
            Importación inteligente de reportes (.xlsx, .xls) con celdas combinadas, CSV y XML.
          </p>
        </header>

        {/* ── Formatos y Ayuda Visual ── */}
        {paso === "cargar" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileSpreadsheet size={16} className="text-institucional-green" />
                <span>Reportes Excel (.xls / .xlsx) con Parser Heurístico</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Compatible con exportaciones del sistema anterior. Identifica automáticamente la <strong>Nave</strong>,
                la <strong>Actividad</strong>, la <strong>Cédula</strong> (10 o 13 dígitos), el <strong>Nombre</strong> y el <strong>Puesto</strong>, descartando metros y columnas intermedias.
              </p>
            </div>

            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileText size={16} className="text-acento-azul1" />
                <span>Archivos Estructurados (CSV / XML)</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-mono">
                Columnas estándar: Nave, Contribuyente, NumBodega, Gen01Codi.
                Reconoce estructuras tabulares delimitadas por comas o etiquetas XML.
              </p>
            </div>
          </div>
        )}

        {/* ── Paso 1: Carga de Archivo ── */}
        {paso === "cargar" && (
          <div
            className={[
              "flex-1 min-h-[280px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all text-center",
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
            {parseando ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="text-institucional-green animate-spin" />
                <p className="text-sm font-semibold text-gray-800">
                  Analizando estructura de celdas y extrayendo comerciantes...
                </p>
                <p className="text-xs text-gray-500">Por favor espere un momento.</p>
              </div>
            ) : (
              <>
                <Upload size={44} className="text-institucional-whiteSmokeBlack/40" />
                <p className="mt-3 text-base font-semibold text-base-eerieBlack">
                  Arrastre y suelte su archivo Excel (.xlsx, .xls), CSV o XML aquí
                </p>
                <p className="mt-1 text-xs text-gray-600 max-w-md">
                  El sistema analizará el archivo en memoria y le mostrará una vista previa con los datos extraídos antes de aplicar cualquier cambio.
                </p>
                <label className="mt-5 cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                    <FileSpreadsheet size={15} /> Seleccionar archivo desde el equipo
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        procesarArchivo(file);
                      }
                    }}
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* ── Paso 2: Vista Previa y Confirmación ── */}
        {paso === "preview" && (
          <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="font-bold text-base text-base-eerieBlack">
                  Vista Previa de Comerciantes Detectados
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Archivo: <span className="font-medium text-gray-900">{archivoNombre}</span> •{" "}
                  <span className="font-semibold text-institucional-green">{registros.length}</span> registros listos para revisión.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReiniciar}
                className="text-base-red text-xs hover:underline flex items-center gap-1 font-medium self-start sm:self-center"
              >
                <X size={14} /> Cancelar y subir otro archivo
              </button>
            </div>

            {/* Tabla con scroll horizontal */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-institucional-green/10 sticky top-0 z-10 border-b border-institucional-whiteSmokeBlack/20">
                    <th className="px-3 py-2.5 text-center font-semibold text-base-eerieBlack w-12">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">CIU</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">CÉDULA</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">NOMBRES</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">ACTIVIDAD</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">NAVE</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">PUESTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-institucional-whiteSmokeBlack/10">
                  {registros.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-institucional-whiteSmoke/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-center text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-gray-500 font-medium">{r.ciu || "-"}</td>
                      <td className="px-4 py-2 font-mono font-medium text-base-eerieBlack">{r.cedula}</td>
                      <td className="px-4 py-2 font-semibold text-base-eerieBlack">{r.nombre}</td>
                      <td className="px-4 py-2 text-gray-700">{r.actividad}</td>
                      <td className="px-4 py-2 font-medium text-acento-azul1">{r.nave}</td>
                      <td className="px-4 py-2 font-mono text-gray-900 font-semibold">{r.puesto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de Acciones Inferior */}
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-institucional-whiteSmokeBlack/15 bg-base-white">
              <span className="text-xs text-gray-500 order-2 sm:order-1">
                Revise la correspondencia de puestos y nombres antes de confirmar.
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end order-1 sm:order-2">
                <Button
                  variant="outline"
                  onClick={handleReiniciar}
                  disabled={procesando}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={procesando}
                  className="w-full sm:w-auto bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold shadow-sm"
                >
                  {procesando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    "Confirmar e Importar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 3: Resumen de Resultados ── */}
        {paso === "resultado" && resultado && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="rounded-2xl bg-base-white p-6 sm:p-8 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 border border-green-200 shadow-inner">
                <CheckCircle2 size={36} className="text-institucional-green" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-base-eerieBlack">Proceso de Importación Finalizado</h2>
              <p className="mt-1 text-sm text-gray-600">
                Los datos analizados del archivo <span className="font-semibold text-gray-800">{archivoNombre}</span> han sido procesados.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto text-left">
                <div className="rounded-xl bg-green-50/60 p-4 border border-green-200">
                  <p className="text-2xl font-bold text-institucional-green">{resultado.exitosos}</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">Comerciantes registrados con éxito</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-2xl font-bold text-gray-700">{resultado.errores.length}</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">Observaciones o descartes</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={handleReiniciar}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Importar otro archivo
                </Button>
                <Link
                  href="/catastro"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-institucional-green px-5 py-2 text-sm font-semibold text-base-white shadow-sm hover:bg-acento-verdeOliva1 transition-colors"
                >
                  <span>Ver Comerciantes en Catastro</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal de Confirmación de Importación ── */}
        <Dialog
          open={confirmModalOpen}
          disablePointerDismissal={true}
          onOpenChange={(o) => !o && setConfirmModalOpen(false)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-eerieBlack font-bold">
                <AlertCircle className="text-amber-500" size={20} />
                Confirmar e Importar al Catastro
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-700 pt-1 leading-relaxed">
                ¿Está seguro de ingresar estos <strong>{registros.length} comerciantes</strong> al sistema? Esta operación actualizará el catastro general con la distribución de naves y puestos detectados.
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
                  await handleConfirmarImportacion();
                }}
                disabled={procesando}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Aceptar y Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
