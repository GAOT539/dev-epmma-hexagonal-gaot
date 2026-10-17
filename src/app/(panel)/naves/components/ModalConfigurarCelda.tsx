"use client";

import React from "react";
import { LayoutGrid, AlertTriangle, Eraser } from "lucide-react";
import type { TipoCeldaPlano, CeldaPlano, Puesto } from "@/domain/models/nave.model";
import type { Comerciante } from "@/domain/models/comerciante.model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { colIndexToLetter, getCoordenadasEtiqueta } from "./plano-nave.utils";

interface ModalConfigurarCeldaProps {
  celdaEnEdicion: { fila: number; columna: number } | null;
  onCerrar: () => void;
  formTipo: TipoCeldaPlano;
  setFormTipo: (tipo: TipoCeldaPlano) => void;
  formCodigo: string;
  setFormCodigo: (val: string) => void;
  formTexto: string;
  setFormTexto: (val: string) => void;
  formSubtexto: string;
  setFormSubtexto: (val: string) => void;
  formColor: "amarillo" | "rosado" | "naranja" | "azul" | "verde" | "gris" | undefined;
  setFormColor: (color: "amarillo" | "rosado" | "naranja" | "azul" | "verde" | "gris" | undefined) => void;
  formRowSpan: number;
  setFormRowSpan: React.Dispatch<React.SetStateAction<number>>;
  formColSpan: number;
  setFormColSpan: React.Dispatch<React.SetStateAction<number>>;
  hoverRowSpan: number | null;
  setHoverRowSpan: (val: number | null) => void;
  hoverColSpan: number | null;
  setHoverColSpan: (val: number | null) => void;
  modoManualPuesto: boolean;
  setModoManualPuesto: React.Dispatch<React.SetStateAction<boolean>>;
  modalError: string;
  setModalError: (val: string) => void;
  puestosNaveActual: Puesto[];
  puestosNavePendientes: Puesto[];
  codigosPuestosUbicados: Set<string>;
  comerciantes: Comerciante[];
  celdasAbsorbidasModal: CeldaPlano[];
  handleGuardarCeldaModal: (e: React.FormEvent) => void;
  handleVaciarCeldaModal: () => void;
}

export function ModalConfigurarCelda({
  celdaEnEdicion,
  onCerrar,
  formTipo,
  setFormTipo,
  formCodigo,
  setFormCodigo,
  formTexto,
  setFormTexto,
  formSubtexto,
  setFormSubtexto,
  formColor,
  setFormColor,
  formRowSpan,
  setFormRowSpan,
  formColSpan,
  setFormColSpan,
  hoverRowSpan,
  setHoverRowSpan,
  hoverColSpan,
  setHoverColSpan,
  modoManualPuesto,
  setModoManualPuesto,
  modalError,
  setModalError,
  puestosNaveActual,
  puestosNavePendientes,
  codigosPuestosUbicados,
  comerciantes,
  celdasAbsorbidasModal,
  handleGuardarCeldaModal,
  handleVaciarCeldaModal,
}: ModalConfigurarCeldaProps) {
  return (
    <Dialog
      open={Boolean(celdaEnEdicion)}
      disablePointerDismissal={true}
      onOpenChange={(open) => !open && onCerrar()}
    >
      <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl lg:max-w-3xl p-6 bg-base-white rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-base-eerieBlack">
            <LayoutGrid className="text-institucional-green" size={20} />
            Configurar Celda [
            {celdaEnEdicion
              ? `${colIndexToLetter(celdaEnEdicion.columna)}${
                  celdaEnEdicion.fila + 1
                }`
              : ""}
            ]
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-700 pt-1">
            Defina el tipo de espacio físico, código de puesto, dimensiones modulares o anotación espacial para esta coordenada.
          </DialogDescription>
        </DialogHeader>

        {celdaEnEdicion && (
          <form onSubmit={handleGuardarCeldaModal} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Columna Izquierda: Datos del Espacio ── */}
              <div className="space-y-4">
                {/* Selector de Tipo de Celda */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Tipo de Espacio *
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value as TipoCeldaPlano;
                      setFormTipo(nuevoTipo);
                      setModalError("");
                    }}
                    className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 py-1 text-sm font-medium text-base-eerieBlack shadow-xs focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                  >
                    <option value="PUESTO">Puesto Comercial / Bodega (Cuenta en capacidad)</option>
                    <option value="VACIO">Espacio en Blanco / Pasillo de Circulación</option>
                    <option value="PARQUEADERO">Parqueadero / Zona Vehicular</option>
                    <option value="DELIMITACION">Delimitación Espacial (Norte, Sur, Sección)</option>
                    <option value="BANO">Baño / Batería Sanitaria</option>
                    <option value="ANOTACION">Anotación / Nota Administrativa</option>
                  </select>
                </div>

                {/* Campos específicos para PUESTO */}
                {formTipo === "PUESTO" && (
                  <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-3">
                    {/* Control Unificado de Asignación de Puesto */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Puesto Asignado *
                        </label>
                        {puestosNaveActual.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setModoManualPuesto((prev) => !prev)}
                            className="text-[11px] font-semibold text-institucional-green hover:underline cursor-pointer"
                          >
                            {modoManualPuesto ? "🔍 Seleccionar de lista" : "✏️ Escribir manual"}
                          </button>
                        )}
                      </div>

                      {puestosNaveActual.length > 0 && !modoManualPuesto ? (
                        <select
                          value={formCodigo}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__MANUAL__") {
                              setModoManualPuesto(true);
                              return;
                            }
                            setFormCodigo(val);
                            setModalError("");
                          }}
                          className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 py-1 text-xs text-base-eerieBlack shadow-xs focus:border-institucional-green"
                        >
                          <option value="">
                            -- Seleccionar puesto ({puestosNaveActual.length} registrados, {puestosNavePendientes.length} pendientes) --
                          </option>
                          {puestosNaveActual.map((p) => {
                            const com = comerciantes.find((c) => c.idInterno === p.comercianteId);
                            const estaUbicado = codigosPuestosUbicados.has(p.codigo.trim().toUpperCase());
                            return (
                              <option key={p.id} value={p.codigo}>
                                {p.codigo} {com ? `- ${com.contribuyente} (${com.actividad})` : "- Vacante"} {estaUbicado ? "(Ya en plano)" : "★ Pendiente"}
                              </option>
                            );
                          })}
                          <option value="__MANUAL__">✏️ Escribir otro código manualmente...</option>
                        </select>
                      ) : (
                        <Input
                          type="text"
                          placeholder="Ej. 1, 01, 129, 4A, N-I-04, S/N"
                          value={formCodigo}
                          onChange={(e) => {
                            setFormCodigo(e.target.value);
                            setModalError("");
                          }}
                          className="bg-base-white text-sm h-9 font-mono font-semibold"
                          required
                          autoFocus
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Detalle Secundario / Metraje (Opcional)
                      </label>
                      <Input
                        type="text"
                        placeholder="Ej. 72M², Bodega o Con Baño"
                        value={formSubtexto}
                        onChange={(e) => setFormSubtexto(e.target.value)}
                        className="bg-base-white text-sm h-9"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Color de Zona / Bloque
                      </label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { id: undefined, label: "Predeterminado", bg: "bg-emerald-100 border-emerald-400" },
                          { id: "amarillo", label: "Amarillo", bg: "bg-amber-100 border-amber-400" },
                          { id: "rosado", label: "Rosado", bg: "bg-pink-100 border-pink-400" },
                          { id: "naranja", label: "Naranja", bg: "bg-orange-100 border-orange-400" },
                          { id: "azul", label: "Azul", bg: "bg-sky-100 border-sky-400" },
                          { id: "verde", label: "Verde", bg: "bg-emerald-100 border-emerald-400" },
                          { id: "gris", label: "Gris", bg: "bg-gray-200 border-gray-400" },
                        ].map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setFormColor(c.id as typeof formColor)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border transition-all ${
                              formColor === c.id
                                ? "ring-2 ring-institucional-green font-bold shadow-xs"
                                : "opacity-80 hover:opacity-100"
                            } ${c.bg}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Campos para PARQUEADERO, DELIMITACION, BANO o ANOTACION */}
                {(formTipo === "PARQUEADERO" ||
                  formTipo === "DELIMITACION" ||
                  formTipo === "BANO" ||
                  formTipo === "ANOTACION") && (
                  <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-3">
                    {/* Chips contextuales de ayuda rápida */}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Sugerencias Rápidas
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {formTipo === "DELIMITACION" &&
                          ["NORTE", "SUR", "ESTE", "OESTE", "ACCESO", "SECCIÓN"].map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setFormTexto(sug);
                                setModalError("");
                              }}
                              className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-[11px] font-bold hover:bg-slate-300 transition-colors"
                            >
                              {sug}
                            </button>
                          ))}

                        {formTipo === "BANO" &&
                          [
                            "BAÑO HOMBRES / MUJERES",
                            "BATERÍA SANITARIA",
                            "PUERTA LANFORT CON BAÑO",
                          ].map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setFormTexto(sug);
                                setModalError("");
                              }}
                              className="px-2 py-1 rounded bg-cyan-100 text-cyan-900 border border-cyan-300 text-[11px] font-bold hover:bg-cyan-200 transition-colors"
                            >
                              {sug}
                            </button>
                          ))}

                        {formTipo === "PARQUEADERO" &&
                          ["PARQUEADERO DE GRANOS", "ZONA DE DESCARGA", "PARQUEADERO CLIENTES"].map(
                            (sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  setFormTexto(sug);
                                  setModalError("");
                                }}
                                className="px-2 py-1 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-bold hover:bg-rose-200 transition-colors"
                              >
                                {sug}
                              </button>
                            )
                          )}

                        {formTipo === "ANOTACION" &&
                          ["MEMORANDO", "OBSERVACIÓN DE ESPACIO", "RESERVA ADMINISTRATIVA"].map(
                            (sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  setFormTexto(sug);
                                  setModalError("");
                                }}
                                className="px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold hover:bg-amber-200 transition-colors"
                              >
                                {sug}
                              </button>
                            )
                          )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Texto Principal *
                      </label>
                      <Input
                        type="text"
                        placeholder={
                          formTipo === "BANO"
                            ? "Ej. BAÑO HOMBRES / BATERÍA SANITARIA"
                            : formTipo === "PARQUEADERO"
                            ? "Ej. PARQUEADERO DE CARGA"
                            : formTipo === "DELIMITACION"
                            ? "Ej. NORTE o SECCIÓN PAPAS"
                            : "Ej. PUERTA LANFORT o MEMORANDO"
                        }
                        value={formTexto}
                        onChange={(e) => {
                          setFormTexto(e.target.value);
                          setModalError("");
                        }}
                        className="bg-base-white text-sm h-9 uppercase font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Subtexto / Detalle Técnico (Opcional)
                      </label>
                      <Input
                        type="text"
                        placeholder={
                          formTipo === "BANO"
                            ? "Ej. SERVICIOS HIGIÉNICOS o ACCESO CONTROLADO"
                            : "Ej. Batería Sanitaria, Camiones de 10 Toneladas..."
                        }
                        value={formSubtexto}
                        onChange={(e) => setFormSubtexto(e.target.value)}
                        className="bg-base-white text-sm h-9"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                        Color de Zona
                      </label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { id: undefined, label: "Predeterminado", bg: "bg-slate-100 border-slate-300" },
                          { id: "azul", label: "Azul", bg: "bg-sky-100 border-sky-400" },
                          { id: "rosado", label: "Rosado", bg: "bg-pink-100 border-pink-400" },
                          { id: "naranja", label: "Naranja", bg: "bg-orange-100 border-orange-400" },
                          { id: "amarillo", label: "Amarillo", bg: "bg-amber-100 border-amber-400" },
                          { id: "verde", label: "Verde", bg: "bg-emerald-100 border-emerald-400" },
                          { id: "gris", label: "Gris", bg: "bg-gray-200 border-gray-400" },
                        ].map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setFormColor(c.id as typeof formColor)}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border transition-all ${
                              formColor === c.id
                                ? "ring-2 ring-institucional-green font-bold shadow-xs"
                                : "opacity-80 hover:opacity-100"
                            } ${c.bg}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Columna Derecha: Dimensiones Modulares del Espacio ── */}
              <div className="space-y-4">
                {formTipo !== "VACIO" ? (
                  <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Dimensiones Modulares del Espacio
                      </label>
                      <p className="text-[11px] text-gray-700 mt-0.5">
                        Pase el cursor o haga clic sobre la matriz para expandir el bloque.
                      </p>
                    </div>

                    {/* Selector Gráfico Matricial Interactivo (6 x 6) */}
                    <div className="p-3 bg-base-white rounded-xl border border-institucional-whiteSmokeBlack/20 shadow-inner flex flex-col items-center">
                      <div
                        className="grid grid-cols-6 gap-1.5"
                        onMouseLeave={() => {
                          setHoverRowSpan(null);
                          setHoverColSpan(null);
                        }}
                      >
                        {Array.from({ length: 6 }).map((_, rIdx) => {
                          const r = rIdx + 1;
                          return Array.from({ length: 6 }).map((_, cIdx) => {
                            const c = cIdx + 1;
                            const effectiveR = hoverRowSpan ?? formRowSpan;
                            const effectiveC = hoverColSpan ?? formColSpan;
                            const isSelected = r <= effectiveR && c <= effectiveC;

                            return (
                              <button
                                key={`matrix-${r}-${c}`}
                                type="button"
                                onMouseEnter={() => {
                                  setHoverRowSpan(r);
                                  setHoverColSpan(c);
                                }}
                                onClick={() => {
                                  setFormRowSpan(r);
                                  setFormColSpan(c);
                                }}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md border text-[10px] font-bold transition-all flex items-center justify-center ${
                                  isSelected
                                    ? "bg-institucional-green/20 border-institucional-green text-institucional-green shadow-xs"
                                    : "bg-slate-50 border-slate-200 text-gray-400 hover:border-institucional-green/40 hover:bg-slate-100"
                                }`}
                                title={`${r} fila(s) × ${c} columna(s)`}
                              >
                                {r}×{c}
                              </button>
                            );
                          });
                        })}
                      </div>

                      {/* Etiqueta de Tamaño de Bloque */}
                      <div className="mt-3 text-center space-y-0.5">
                        <p className="text-xs font-bold text-base-eerieBlack">
                          Tamaño del bloque: {formRowSpan} fila(s) × {formColSpan} columna(s)
                        </p>
                        <p className="text-[11px] text-gray-600 font-mono">
                          Ocupará desde{" "}
                          {getCoordenadasEtiqueta(
                            celdaEnEdicion.fila,
                            celdaEnEdicion.columna,
                            formRowSpan,
                            formColSpan
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Ajuste Fino (+ / -) hasta 10 celdas */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="rounded-lg bg-base-white p-2.5 border border-institucional-whiteSmokeBlack/20">
                        <label className="text-[11px] font-semibold text-gray-700 block mb-1.5 text-center">
                          Alto en Filas
                        </label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormRowSpan((prev) => Math.max(1, prev - 1))}
                            className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-sm w-6 text-center">
                            {formRowSpan}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormRowSpan((prev) => Math.min(10, prev + 1))}
                            className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-base-white p-2.5 border border-institucional-whiteSmokeBlack/20">
                        <label className="text-[11px] font-semibold text-gray-700 block mb-1.5 text-center">
                          Ancho en Columnas
                        </label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormColSpan((prev) => Math.max(1, prev - 1))}
                            className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-sm w-6 text-center">
                            {formColSpan}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormColSpan((prev) => Math.min(10, prev + 1))}
                            className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Alerta de Celdas Absorbidas */}
                    {celdasAbsorbidasModal.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                        <span>
                          Este bloque absorberá <strong>{celdasAbsorbidasModal.length} espacio(s)</strong> registrado(s) debajo (
                          {celdasAbsorbidasModal
                            .map((c) => (c.codigoPuesto ? `#${c.codigoPuesto}` : c.texto || c.tipo))
                            .join(", ")}
                          ). Serán eliminados automáticamente al guardar.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs space-y-1">
                    <p className="font-semibold text-gray-700">Espacio en Blanco / Pasillo</p>
                    <p>Los pasillos ocupan una celda estándar y permiten el libre tránsito en el croquis.</p>
                  </div>
                )}
              </div>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-base-red font-medium">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between pt-3">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleVaciarCeldaModal}
                className="bg-red-50 text-base-red border border-red-200 hover:bg-red-100"
              >
                <Eraser size={14} className="mr-1.5" />
                Vaciar a Pasillo
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCerrar}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
                >
                  Guardar Celda
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
