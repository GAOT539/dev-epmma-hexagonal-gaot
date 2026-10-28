"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Download,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import type {
  SesionControlSupervisor,
  EtiquetaControlSupervisor,
} from "@/domain/models/auditoria.model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Componente de Badge / Globito de Control ─────────────────────────────────

export function BadgeControl({
  etiqueta,
  fechaJornada,
  supervisorReemplazoNombre,
}: {
  etiqueta: EtiquetaControlSupervisor;
  fechaJornada?: string;
  supervisorReemplazoNombre?: string | null;
}) {
  switch (etiqueta) {
    case "SIN_INGRESO": {
      const fechaTexto = fechaJornada
        ? format(parseISO(fechaJornada), "dd/MM/yyyy")
        : "";
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 shadow-2xs">
          <AlertTriangle size={11} className="shrink-0 text-red-600" />
          No ingresó al sistema{fechaTexto ? ` (${fechaTexto})` : ""}
        </span>
      );
    }
    case "PERMISO_SUPERVISOR_REEMPLAZO":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 shadow-2xs">
          <UserCheck size={11} className="shrink-0 text-purple-600" />
          Permiso Supervisor (A cargo: {supervisorReemplazoNombre || "Reemplazo"})
        </span>
      );
    case "PERMISO_SUPERVISOR_PERSISTENCIA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 shadow-2xs">
          <RefreshCw size={11} className="shrink-0 text-cyan-600" />
          Permiso Supervisor (Persistencia Automática)
        </span>
      );
    case "CON_PERSISTENCIA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 shadow-2xs">
          <RefreshCw size={11} className="shrink-0" />
          Con Persistencia
        </span>
      );
    case "MODIFICADO_TRAS_PERSISTENCIA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-2xs">
          <Layers size={11} className="shrink-0" />
          Modificado tras Persistencia
        </span>
      );
    case "CON_RETRASO":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 shadow-2xs">
          <Clock size={11} className="shrink-0" />
          Con Retraso
        </span>
      );
    case "EN_FECHA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-2xs">
          <CheckCircle2 size={11} className="shrink-0" />
          En Fecha
        </span>
      );
    default:
      return null;
  }
}

interface ModalDetalleControlProps {
  sesion: SesionControlSupervisor | null;
  onCerrar: () => void;
  onExportarPDF: (sesion: SesionControlSupervisor) => void;
}

export function ModalDetalleControl({
  sesion,
  onCerrar,
  onExportarPDF,
}: ModalDetalleControlProps) {
  const [filtroDetalleModal, setFiltroDetalleModal] = useState<
    "TODOS" | "PRESENTES" | "AUSENTES" | "PERMISOS" | "CON_NOVEDADES"
  >("TODOS");

  // Filtrado interno dentro del modal
  const comerciantesFiltradosEnModal = useMemo(() => {
    if (!sesion) return [];
    const list = sesion.detallesComerciantes;
    switch (filtroDetalleModal) {
      case "PRESENTES":
        return list.filter((c) => c.estado === "Presente");
      case "AUSENTES":
        return list.filter((c) => c.estado === "Ausente");
      case "PERMISOS":
        return list.filter((c) => c.estado === "Permiso");
      case "CON_NOVEDADES":
        return list.filter(
          (c) => (c.novedades && c.novedades.length > 0) || c.estado === "Permiso"
        );
      default:
        return list;
    }
  }, [sesion, filtroDetalleModal]);

  return (
    <Dialog
      open={Boolean(sesion)}
      disablePointerDismissal={true}
      onOpenChange={(abierto) => {
        if (!abierto) {
          onCerrar();
          setFiltroDetalleModal("TODOS");
        }
      }}
    >
      <DialogContent
        className="w-[98vw] max-w-[98vw] sm:w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92dvh] flex flex-col p-3.5 sm:p-6 overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200"
      >
        {sesion && (
          <>
            {/* Header Modal */}
            <DialogHeader className="p-0 pb-4 sm:pb-5 border-b border-gray-200 text-left shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-lg bg-institucional-green/15 text-institucional-green font-bold text-xs px-2.5 py-1 uppercase tracking-wider shrink-0">
                      {sesion.naveNombre}
                    </span>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-base-eerieBlack">
                      Control de Toma de Lista
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-gray-700 mt-1">
                    Jornada correspondiente al:{" "}
                    <strong className="text-base-eerieBlack font-semibold">
                      {format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy")}
                    </strong>
                  </DialogDescription>
                </div>

                {/* Botón Imprimir Detalle PDF */}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onExportarPDF(sesion)}
                  className="w-full sm:w-auto justify-center flex shrink-0 items-center gap-2 bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
                >
                  <Download size={14} />
                  <span>Imprimir / Descargar PDF</span>
                </Button>
              </div>

              {/* Metadatos rápidos */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                  <span className="text-gray-700 block">Supervisor</span>
                  <strong className="text-base-eerieBlack block truncate">
                    {sesion.supervisorNombre}
                  </strong>
                </div>
                <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                  <span className="text-gray-700 block">Inicio de toma</span>
                  <strong className="text-base-eerieBlack block">
                    {format(new Date(sesion.timestampInicio), "dd/MM/yy hh:mm a")}
                  </strong>
                </div>
                <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                  <span className="text-gray-700 block">Última modif.</span>
                  <strong className="text-base-eerieBlack block">
                    {sesion.timestampUltimaModificacion
                      ? format(new Date(sesion.timestampUltimaModificacion), "dd/MM/yy hh:mm a")
                      : "Sin modificaciones"}
                  </strong>
                </div>
                <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                  <span className="text-gray-700 block">Acción</span>
                  <strong className="text-base-eerieBlack block truncate">
                    {sesion.accion}
                  </strong>
                </div>
              </div>

              {/* Bloque de Persistencia (si aplica) */}
              {sesion.esPersistencia && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold text-blue-800">
                    <RefreshCw size={13} />
                    <span>Registro ejecutado con Persistencia</span>
                  </div>
                  <p className="mt-1">
                    Asistencia arrastrada desde la jornada del{" "}
                    <strong>
                      {sesion.fechaOrigenPersistencia
                        ? format(new Date(sesion.fechaOrigenPersistencia + "T00:00:00"), "dd/MM/yyyy")
                        : "día hábil anterior"}
                    </strong>
                    .
                    {sesion.comentarioPersistencia && (
                      <span className="block mt-1 italic text-blue-800">
                        Justificación: &ldquo;{sesion.comentarioPersistencia}&rdquo;
                      </span>
                    )}
                  </p>
                  {sesion.modificadoTrasPersistencia && (
                    <p className="mt-1 text-amber-800 font-semibold flex items-center gap-1">
                      <Layers size={12} />
                      Se registraron modificaciones manuales posteriores en comerciantes individuales.
                    </p>
                  )}
                </div>
              )}

              {/* Bloque de Retraso (si aplica) */}
              {sesion.tieneRetraso && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-xs text-orange-900">
                  <div className="flex items-center gap-1.5 font-bold text-orange-800">
                    <Clock size={13} />
                    <span>Toma de Lista con Retraso (Retroactiva)</span>
                  </div>
                  <p className="mt-1">
                    {sesion.detalleRetraso ||
                      `La jornada corresponde al ${format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy")} pero fue registrada manualmente en fecha ${format(new Date(sesion.timestampInicio), "dd/MM/yyyy HH:mm")}.`}
                  </p>
                </div>
              )}
            </DialogHeader>

            {/* Cuerpo del Modal con Resumen y Radiografía de Comerciantes */}
            <div className="flex-1 overflow-y-auto min-h-0 pt-4 space-y-4">
              {/* Tarjetas de Resumen */}
              <div
                className={`grid grid-cols-2 ${
                  (sesion.resumen.justificados ?? 0) > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"
                } gap-3`}
              >
                <div className="rounded-xl border border-gray-200 bg-base-white p-3.5 text-center min-w-0 shadow-2xs">
                  <span className="text-xs text-gray-700 block">Total Puestos</span>
                  <span className="text-lg font-bold text-base-eerieBlack">
                    {sesion.resumen.totalOcupados}
                  </span>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                  <span className="text-xs text-green-700 block">Presentes</span>
                  <span className="text-lg font-bold text-green-800">
                    {sesion.resumen.presentes}
                  </span>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                  <span className="text-xs text-red-700 block">Ausentes</span>
                  <span className="text-lg font-bold text-red-800">
                    {sesion.resumen.ausentes}
                  </span>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                  <span className="text-xs text-purple-700 block">Permisos</span>
                  <span className="text-lg font-bold text-purple-800">
                    {sesion.resumen.permisos}
                  </span>
                </div>
                {(sesion.resumen.justificados ?? 0) > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-blue-700 block">Justificados</span>
                    <span className="text-lg font-bold text-blue-800">
                      {sesion.resumen.justificados}
                    </span>
                  </div>
                )}
              </div>

              {/* Filtros rápidos / Pestañas de comerciantes */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setFiltroDetalleModal("TODOS")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                    filtroDetalleModal === "TODOS"
                      ? "bg-institucional-green text-base-white"
                      : "text-gray-700 hover:bg-gray-100",
                  ].join(" ")}
                >
                  Todos ({sesion.detallesComerciantes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDetalleModal("PRESENTES")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                    filtroDetalleModal === "PRESENTES"
                      ? "bg-green-700 text-base-white"
                      : "text-green-800 hover:bg-green-50",
                  ].join(" ")}
                >
                  Presentes ({sesion.resumen.presentes})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDetalleModal("AUSENTES")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                    filtroDetalleModal === "AUSENTES"
                      ? "bg-red-700 text-base-white"
                      : "text-red-800 hover:bg-red-50",
                  ].join(" ")}
                >
                  Ausentes ({sesion.resumen.ausentes})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDetalleModal("PERMISOS")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                    filtroDetalleModal === "PERMISOS"
                      ? "bg-purple-700 text-base-white"
                      : "text-purple-800 hover:bg-purple-50",
                  ].join(" ")}
                >
                  Permisos ({sesion.resumen.permisos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDetalleModal("CON_NOVEDADES")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                    filtroDetalleModal === "CON_NOVEDADES"
                      ? "bg-amber-600 text-base-white"
                      : "text-amber-800 hover:bg-amber-50",
                  ].join(" ")}
                >
                  Con Observaciones / Permisos / Justificaciones (
                  {
                    sesion.detallesComerciantes.filter(
                      (c) => (c.novedades && c.novedades.length > 0) || c.estado === "Permiso"
                    ).length
                  }
                  )
                </button>
              </div>

              {/* Tabla de Comerciantes de la Sesión */}
              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-[400px] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[680px] text-xs">
                  <thead className="sticky top-0 z-20 bg-[#e6efe9] text-base-eerieBlack font-semibold">
                    <tr className="bg-[#e6efe9]">
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left">Puesto</th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left">CIU</th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left">Cédula</th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left">Contribuyente</th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left">Estado</th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-left min-w-[280px]">
                        Detalle de Permisos / Justificaciones / Observaciones
                      </th>
                      <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2 text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comerciantesFiltradosEnModal.map((com) => {
                      let estadoBadge = null;
                      if (com.estado === "Presente") {
                        estadoBadge = (
                          <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 font-bold">
                            Presente
                          </span>
                        );
                      } else if (com.estado === "Ausente") {
                        estadoBadge = (
                          <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 font-bold">
                            Ausente
                          </span>
                        );
                      } else if (com.estado === "Permiso") {
                        estadoBadge = (
                          <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 font-bold">
                            Permiso
                          </span>
                        );
                      }

                      return (
                        <tr key={com.comercianteId} className="hover:bg-gray-50/70">
                          <td className="px-3 py-2 font-bold text-base-eerieBlack">
                            {com.puesto}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{com.ciu}</td>
                          <td className="px-3 py-2 text-gray-700">{com.cedula}</td>
                          <td className="px-3 py-2 font-medium text-base-eerieBlack">
                            {com.contribuyente}
                          </td>
                          <td className="px-3 py-2">{estadoBadge}</td>
                          <td className="px-3 py-2">
                            {com.novedades && com.novedades.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {com.novedades.map((nov, idx) => {
                                  if (nov.categoria === "JUSTIFICACION") {
                                    return (
                                      <div
                                        key={idx}
                                        className="p-1.5 rounded-md bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900 leading-tight"
                                      >
                                        <div className="flex items-center gap-1 font-semibold">
                                          <span className="rounded px-1.5 py-0.2 bg-blue-600 text-white font-bold text-[10px]">
                                            Justificación
                                          </span>
                                          <span>Motivo / N° Doc: {nov.motivo}</span>
                                        </div>
                                        {nov.fechaInicio && nov.fechaFin && (
                                          <div className="mt-0.5 text-blue-700 font-medium">
                                            Fechas justificadas: Del {nov.fechaInicio} al {nov.fechaFin} (
                                            {nov.diasVigencia ?? 1} día(s))
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (nov.categoria === "PERMISO") {
                                    return (
                                      <div
                                        key={idx}
                                        className="p-1.5 rounded-md bg-purple-50/80 border border-purple-200 text-[11px] text-purple-900 leading-tight"
                                      >
                                        <div className="flex items-center gap-1 font-semibold">
                                          <span className="rounded px-1.5 py-0.2 bg-purple-600 text-white font-bold text-[10px]">
                                            Permiso
                                          </span>
                                          <span>Motivo / N° Doc: {nov.motivo}</span>
                                        </div>
                                        {nov.fechaInicio && nov.fechaFin && (
                                          <div className="mt-0.5 text-purple-700 font-medium">
                                            Vigencia asignada: Del {nov.fechaInicio} al {nov.fechaFin} (
                                            {nov.diasVigencia ?? 1} día(s))
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (nov.categoria === "CITACION" || nov.categoria === "NOTIFICACION") {
                                    const esCit = nov.categoria === "CITACION";
                                    return (
                                      <div
                                        key={idx}
                                        className={`p-1.5 rounded-md border text-[11px] leading-tight ${
                                          esCit
                                            ? "bg-amber-50/80 border-amber-200 text-amber-900"
                                            : "bg-blue-50/80 border-blue-200 text-blue-900"
                                        }`}
                                      >
                                        <span
                                          className={`rounded px-1.5 py-0.2 font-bold text-[10px] mr-1.5 ${
                                            esCit ? "bg-amber-600 text-white" : "bg-blue-600 text-white"
                                          }`}
                                        >
                                          {esCit ? "Citación" : "Notificación"}
                                        </span>
                                        <strong className="font-semibold">
                                          Doc/Ref: #{nov.numeroDocumento || "S/N"}
                                        </strong>{" "}
                                        • {nov.motivo}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div
                                      key={idx}
                                      className="p-1.5 rounded-md bg-gray-50/80 border border-gray-200 text-[11px] text-gray-800 leading-tight"
                                    >
                                      <span className="rounded px-1.5 py-0.2 bg-slate-600 text-white font-bold text-[10px] mr-1.5">
                                        Observación
                                      </span>
                                      {nov.motivo}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-400 font-medium">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            {com.horaRegistro || "-"}
                          </td>
                        </tr>
                      );
                    })}

                    {comerciantesFiltradosEnModal.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                          No hay comerciantes que coincidan con la pestaña seleccionada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <DialogFooter className="pt-4 border-t border-gray-200 flex justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onCerrar}
                className="px-5 font-semibold text-xs"
              >
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
