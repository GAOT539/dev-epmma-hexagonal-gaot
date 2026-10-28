"use client";

import { useEffect, useState, useMemo } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  startOfDay,
  endOfDay,
  isBefore,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  X,
  UserCheck,
  AlertTriangle,
  Layers,
  Calendar as CalendarIcon,
  Search,
} from "lucide-react";
import type { Usuario } from "@/domain/models/usuario.model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
  ReporteSupervisoresData,
  EventoDetalladoSupervisor,
} from "./reporte-supervisores-export.utils";
import {
  exportarReporteSupervisoresPDF,
  exportarReporteSupervisoresExcel,
} from "./reporte-supervisores-export.utils";

interface ModalReporteSupervisoresProps {
  isOpen: boolean;
  onClose: () => void;
  supervisores: Usuario[];
  limites?: { minFecha: string; maxFecha: string; hoy: string };
  fechaInicioDefault?: string;
  fechaFinDefault?: string;
  supervisorIdDefault?: string;
}

function calcularFechaDesdeInicial(limites?: { minFecha: string; maxFecha: string; hoy: string }): Date {
  const hoyStr = limites?.hoy || format(new Date(), "yyyy-MM-dd");
  const hoyDate = parseISO(hoyStr);
  const primeroDelMes = startOfMonth(hoyDate);
  if (!limites?.minFecha) return primeroDelMes;
  const minBD = startOfDay(parseISO(limites.minFecha));
  return isBefore(primeroDelMes, minBD) ? minBD : primeroDelMes;
}

function calcularFechaHastaInicial(limites?: { minFecha: string; maxFecha: string; hoy: string }): Date {
  const hoyStr = limites?.hoy || format(new Date(), "yyyy-MM-dd");
  return parseISO(hoyStr);
}

function ModalReporteSupervisoresContenido({
  onClose,
  supervisores,
  limites,
  fechaInicioDefault,
  fechaFinDefault,
  supervisorIdDefault = "",
}: Omit<ModalReporteSupervisoresProps, "isOpen">) {
  const [cargando, setCargando] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  // Filtros internos inteligentes de fechas
  const [fechaDesdeDate, setFechaDesdeDate] = useState<Date>(() =>
    fechaInicioDefault ? parseISO(fechaInicioDefault) : calcularFechaDesdeInicial(limites)
  );
  const [fechaHastaDate, setFechaHastaDate] = useState<Date>(() =>
    fechaFinDefault ? parseISO(fechaFinDefault) : calcularFechaHastaInicial(limites)
  );
  const [calendarDesdeOpen, setCalendarDesdeOpen] = useState(false);
  const [calendarHastaOpen, setCalendarHastaOpen] = useState(false);

  const [supervisorFiltro, setSupervisorFiltro] = useState(supervisorIdDefault);

  // Datos cargados desde el endpoint
  const [datosReporte, setDatosReporte] = useState<ReporteSupervisoresData | null>(null);

  // Pestañas del modal: "HOJA1" (Resumen y Permisos) | "HOJAS_DETALLE" (Detalle por Supervisor)
  const [pestañaActiva, setPestañaActiva] = useState<"HOJA1" | "HOJAS_DETALLE">("HOJA1");

  // Selección en la pestaña de detalle
  const [supervisorDetalleSeleccionadoId, setSupervisorDetalleSeleccionadoId] = useState<string>("TODOS");
  const [busquedaDetalle, setBusquedaDetalle] = useState<string>("");

  const fechaDesde = format(fechaDesdeDate, "yyyy-MM-dd");
  const fechaHasta = format(fechaHastaDate, "yyyy-MM-dd");

  const hoyStr = limites?.hoy || format(new Date(), "yyyy-MM-dd");
  const minBD = limites?.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfMonth(parseISO(hoyStr));
  const hoyEnd = endOfDay(parseISO(hoyStr));

  // Recarga automática reactiva al cambiar fechas o supervisor
  useEffect(() => {
    let activo = true;

    async function ejecutarCarga() {
      setCargando(true);
      try {
        const params = new URLSearchParams({
          fechaDesde,
          fechaHasta,
        });
        if (supervisorFiltro) {
          params.set("supervisorId", supervisorFiltro);
        }

        const res = await fetch(`/api/v1/auditoria/reporte-supervisores?${params.toString()}`);
        if (!res.ok) {
          throw new Error("No se pudo obtener el reporte consolidado");
        }
        const data: ReporteSupervisoresData = await res.json();
        if (!activo) return;
        setDatosReporte(data);
      } catch (err) {
        if (!activo) return;
        console.error("Error al cargar reporte de supervisores:", err);
        toast.error("Error al cargar la información del reporte consolidado.");
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void ejecutarCarga();

    return () => {
      activo = false;
    };
  }, [fechaDesde, fechaHasta, supervisorFiltro]);

  // Lista de supervisores a mostrar en la pestaña de Detalle
  const supervisoresAMostrar = useMemo(() => {
    if (!datosReporte) return [];
    let list = datosReporte.detallesPorSupervisor;

    if (supervisorDetalleSeleccionadoId !== "TODOS") {
      list = list.filter((s) => s.supervisorId === supervisorDetalleSeleccionadoId);
    }

    if (busquedaDetalle.trim()) {
      const q = busquedaDetalle.toLowerCase().trim();
      list = list.filter((s) => s.supervisorNombre.toLowerCase().includes(q));
    }

    return list;
  }, [datosReporte, supervisorDetalleSeleccionadoId, busquedaDetalle]);

  // Manejadores de exportación separados por modo
  async function handleExportarPDF() {
    if (!datosReporte) return;
    setExportandoPDF(true);
    try {
      if (pestañaActiva === "HOJA1") {
        await exportarReporteSupervisoresPDF(datosReporte, { modo: "RESUMEN" });
        toast.success("Reporte Resumen PDF generado exitosamente.");
      } else {
        const supervisoresADescargar =
          supervisoresAMostrar.length > 0
            ? supervisoresAMostrar
            : datosReporte.detallesPorSupervisor;
        await exportarReporteSupervisoresPDF(
          { ...datosReporte, detallesPorSupervisor: supervisoresADescargar },
          { modo: "DETALLE" }
        );
        toast.success("Reporte Detalle PDF generado exitosamente.");
      }
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      toast.error("Ocurrió un error al generar el PDF del reporte.");
    } finally {
      setExportandoPDF(false);
    }
  }

  async function handleExportarExcel() {
    if (!datosReporte) return;
    setExportandoExcel(true);
    try {
      if (pestañaActiva === "HOJA1") {
        await exportarReporteSupervisoresExcel(datosReporte, { modo: "RESUMEN" });
        toast.success("Reporte Resumen Excel (.xlsx) generado exitosamente.");
      } else {
        const supervisoresADescargar =
          supervisoresAMostrar.length > 0
            ? supervisoresAMostrar
            : datosReporte.detallesPorSupervisor;
        await exportarReporteSupervisoresExcel(
          { ...datosReporte, detallesPorSupervisor: supervisoresADescargar },
          { modo: "DETALLE" }
        );
        toast.success("Reporte Detalle Excel (.xlsx) generado exitosamente.");
      }
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      toast.error("Ocurrió un error al generar el Excel del reporte.");
    } finally {
      setExportandoExcel(false);
    }
  }

  return (
    <>
      {/* ── Encabezado Institucional del Modal ── */}
      <DialogHeader className="px-3.5 py-3 sm:px-6 sm:py-3.5 border-b border-institucional-whiteSmokeBlack/20 bg-institucional-whiteSmoke/40 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-institucional-green/10 text-institucional-green shrink-0">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-institucional-green">
                  Reporte Consolidado y Detallado de Supervisores
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs text-gray-600 line-clamp-1 sm:line-clamp-none">
                  Resumen de justificaciones, permisos, novedades y auditoría de asistencia por supervisor (EP-EMA).
                </DialogDescription>
              </div>
            </div>

            {/* Botón de cierre en pantallas móviles */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Botones de Exportación y Cierre en Desktop */}
          <div className="grid grid-cols-2 w-full sm:w-auto sm:flex sm:items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleExportarPDF}
              disabled={cargando || exportandoPDF || !datosReporte}
              className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-semibold bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {exportandoPDF ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span>Descargar PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportarExcel}
              disabled={cargando || exportandoExcel || !datosReporte}
              className="flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-semibold border-institucional-green text-institucional-green hover:bg-institucional-green/10 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {exportandoExcel ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={13} />
              )}
              <span>Descargar Excel</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-1 cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </DialogHeader>

      {/* ── Barra de Filtros Internos y Pestañas ── */}
      <div className="px-3.5 py-2.5 sm:px-6 sm:py-3 border-b border-institucional-whiteSmokeBlack/15 bg-base-white flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        {/* Pestañas de Navegación */}
        <div className="grid grid-cols-2 w-full md:w-auto md:flex items-center gap-1 p-1 rounded-xl bg-institucional-whiteSmoke border border-institucional-whiteSmokeBlack/20 shrink-0">
          <button
            type="button"
            onClick={() => setPestañaActiva("HOJA1")}
            className={[
              "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              pestañaActiva === "HOJA1"
                ? "bg-base-white text-institucional-green shadow-xs"
                : "text-gray-600 hover:text-base-eerieBlack",
            ].join(" ")}
          >
            <Layers size={13} />
            <span>Resumen y Permisos</span>
          </button>
          <button
            type="button"
            onClick={() => setPestañaActiva("HOJAS_DETALLE")}
            className={[
              "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              pestañaActiva === "HOJAS_DETALLE"
                ? "bg-base-white text-institucional-green shadow-xs"
                : "text-gray-600 hover:text-base-eerieBlack",
            ].join(" ")}
          >
            <FileText size={13} />
            <span>Detalle por Supervisor</span>
          </button>
        </div>

        {/* Filtros Inteligentes de Fechas y Supervisor */}
        <div className="grid grid-cols-2 sm:flex w-full md:w-auto gap-2 items-center">
          {/* Selector Desde con Popover + Calendar */}
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <span className="shrink-0">Desde:</span>
            <Popover open={calendarDesdeOpen} onOpenChange={setCalendarDesdeOpen}>
              <PopoverTrigger className="flex h-8 w-full sm:w-auto items-center justify-between sm:justify-start gap-1.5 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-2 text-xs text-gray-800 font-medium hover:border-institucional-green focus:outline-none cursor-pointer transition-colors">
                <CalendarIcon size={13} className="text-institucional-green shrink-0" />
                <span>{format(fechaDesdeDate, "dd/MM/yyyy")}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={fechaDesdeDate}
                  onSelect={(date) => {
                    if (date) {
                      setFechaDesdeDate(date);
                      if (isBefore(fechaHastaDate, date)) {
                        setFechaHastaDate(date);
                      }
                      setCalendarDesdeOpen(false);
                    }
                  }}
                  locale={es}
                  disabled={(date) => isBefore(date, minBD) || date > hoyEnd}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Selector Hasta con Popover + Calendar */}
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <span className="shrink-0">Hasta:</span>
            <Popover open={calendarHastaOpen} onOpenChange={setCalendarHastaOpen}>
              <PopoverTrigger className="flex h-8 w-full sm:w-auto items-center justify-between sm:justify-start gap-1.5 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-2 text-xs text-gray-800 font-medium hover:border-institucional-green focus:outline-none cursor-pointer transition-colors">
                <CalendarIcon size={13} className="text-institucional-green shrink-0" />
                <span>{format(fechaHastaDate, "dd/MM/yyyy")}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={fechaHastaDate}
                  onSelect={(date) => {
                    if (date) {
                      setFechaHastaDate(date);
                      setCalendarHastaOpen(false);
                    }
                  }}
                  locale={es}
                  disabled={(date) => isBefore(date, startOfDay(fechaDesdeDate)) || date > hoyEnd}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Selector de Supervisor */}
          <div className="col-span-2 sm:w-auto">
            <select
              value={supervisorFiltro}
              onChange={(e) => {
                setSupervisorFiltro(e.target.value);
                setSupervisorDetalleSeleccionadoId("TODOS");
              }}
              className="h-8 w-full sm:w-auto rounded-lg border border-institucional-whiteSmokeBlack/30 px-2 text-xs bg-base-white outline-none focus:border-institucional-green cursor-pointer"
            >
              <option value="">Todos los supervisores</option>
              {supervisores.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.nombres} {sup.apellidos}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Contenedor Principal de Visualización ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-institucional-green">
            <Loader2 className="h-9 w-9 animate-spin" />
            <p className="text-sm font-semibold text-gray-600">
              Consolidando métricas, novedades y asistencias de supervisores...
            </p>
          </div>
        ) : !datosReporte ? (
          <div className="text-center py-20 text-gray-500 text-sm">
            No se han podido cargar los datos del reporte.
          </div>
        ) : pestañaActiva === "HOJA1" ? (
          /* ════════════════════════════════════════════════════════════════════
             VISTA 1: RESUMEN Y PERMISOS
             ════════════════════════════════════════════════════════════════════ */
          <div className="space-y-6">
            {/* Tabla 1: Resumen de Gestión */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-base-eerieBlack flex items-center gap-1.5">
                  <UserCheck size={16} className="text-base-eerieBlack" />
                  <span>Tabla 1: Resumen Consolidado de Gestión por Supervisor</span>
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {datosReporte.resumenSupervisores.length} supervisor(es)
                </span>
              </div>

              <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 shadow-xs">
                <table className="w-full text-xs min-w-[680px]">
                  <thead className="bg-[#e6efe9] text-base-eerieBlack font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-10">#</th>
                      <th className="px-3 py-2.5 text-left">Supervisor</th>
                      <th className="px-3 py-2.5 text-left">Naves a Cargo</th>
                      <th className="px-3 py-2.5 text-center font-bold text-blue-800">
                        Justificaciones
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-purple-800">Permisos</th>
                      <th className="px-3 py-2.5 text-center">Obs. Generales</th>
                      <th className="px-3 py-2.5 text-center font-bold text-amber-800">Citaciones</th>
                      <th className="px-3 py-2.5 text-center font-bold text-sky-800">Notificaciones</th>
                      <th className="px-3 py-2.5 text-center font-bold text-red-700">
                        Días Sin Ingreso
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-institucional-whiteSmokeBlack/15">
                    {datosReporte.resumenSupervisores.map((sup) => (
                      <tr key={sup.supervisorId} className="hover:bg-institucional-green/5 transition-colors">
                        <td className="px-3 py-2.5 text-center font-bold text-gray-500">{sup.numero}</td>
                        <td className="px-3 py-2.5 font-bold text-base-eerieBlack">{sup.supervisorNombre}</td>
                        <td className="px-3 py-2.5 text-gray-700">{sup.navesACargo}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-blue-700">
                          {sup.justificaciones}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-purple-700">
                          {sup.permisos}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-700">
                          {sup.observacionesGenerales}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-amber-700">
                          {sup.citaciones}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-sky-700">
                          {sup.notificaciones}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {sup.diasSinIngreso > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                              <AlertTriangle size={10} />
                              {sup.diasSinIngreso} d.
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {datosReporte.resumenSupervisores.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          No se encontraron datos para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 2: Permisos de Supervisores en el período */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-base-eerieBlack flex items-center gap-1.5">
                  <CalendarIcon size={16} className="text-base-eerieBlack" />
                  <span>Tabla 2: Registro de Permisos de Supervisores y Cobertura Aplicada</span>
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {datosReporte.permisosSupervisoresPeriodo.length} registro(s)
                </span>
              </div>

              <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 shadow-xs">
                <table className="w-full text-xs min-w-[680px]">
                  <thead className="bg-[#e6efe9] text-base-eerieBlack font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Supervisor</th>
                      <th className="px-3 py-2.5 text-left">Vigencia (Desde - Hasta)</th>
                      <th className="px-3 py-2.5 text-left">Motivo</th>
                      <th className="px-3 py-2.5 text-left">Nave</th>
                      <th className="px-3 py-2.5 text-left">Acción / Cobertura Aplicada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-institucional-whiteSmokeBlack/15">
                    {datosReporte.permisosSupervisoresPeriodo.map((p, idx) => (
                      <tr key={idx} className="hover:bg-institucional-green/5 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-base-eerieBlack">{p.supervisorNombre}</td>
                        <td className="px-3 py-2.5 text-gray-700">{p.vigenciaTexto}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{p.motivo}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-800">{p.naveNombre}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              p.accionCobertura.includes("Reemplazo") ||
                              p.accionCobertura.includes("cargo")
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : "bg-cyan-100 text-cyan-800 border border-cyan-200"
                            }`}
                          >
                            {p.accionCobertura}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {datosReporte.permisosSupervisoresPeriodo.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                          No se registraron permisos de supervisores en este período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════
             VISTA 2: DETALLE POR SUPERVISOR
             ════════════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* Buscador rápido y selector de supervisor en tiempo real */}
            {datosReporte.detallesPorSupervisor.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-institucional-whiteSmokeBlack/15">
                {/* Píldoras de filtrado */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  <button
                    type="button"
                    onClick={() => setSupervisorDetalleSeleccionadoId("TODOS")}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer",
                      supervisorDetalleSeleccionadoId === "TODOS"
                        ? "bg-institucional-green text-base-white shadow-xs"
                        : "text-gray-700 hover:bg-institucional-whiteSmoke bg-base-white border border-institucional-whiteSmokeBlack/20",
                    ].join(" ")}
                  >
                    <span>Todos los supervisores ({datosReporte.detallesPorSupervisor.length})</span>
                  </button>

                  {datosReporte.detallesPorSupervisor.map((sup) => (
                    <button
                      key={sup.supervisorId}
                      type="button"
                      onClick={() => setSupervisorDetalleSeleccionadoId(sup.supervisorId)}
                      className={[
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer",
                        supervisorDetalleSeleccionadoId === sup.supervisorId
                          ? "bg-institucional-green text-base-white shadow-xs"
                          : "text-gray-700 hover:bg-institucional-whiteSmoke bg-base-white border border-institucional-whiteSmokeBlack/20",
                      ].join(" ")}
                    >
                      <span>{sup.supervisorNombre}</span>
                      {sup.metricas.diasSinIngreso > 0 && (
                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Buscador de texto en tiempo real */}
                <div className="relative sm:w-56 shrink-0">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaDetalle}
                    onChange={(e) => setBusquedaDetalle(e.target.value)}
                    placeholder="Buscar supervisor..."
                    className="h-8 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 pl-8 pr-2 text-xs bg-base-white outline-none focus:border-institucional-green"
                  />
                </div>
              </div>
            )}

            {/* Lista de supervisores a mostrar */}
            {supervisoresAMostrar.length > 0 ? (
              <div className="space-y-6">
                {supervisoresAMostrar.map((sup) => (
                  <div
                    key={sup.supervisorId}
                    className="space-y-3 pb-4 border-b border-institucional-whiteSmokeBlack/15 last:border-b-0"
                  >
                    {/* Tarjeta de Encabezado y Métricas Rápidas del Supervisor */}
                    <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/70 p-4 shadow-2xs">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-institucional-green">
                              {sup.supervisorNombre}
                            </h4>
                            <span className="rounded-md bg-gray-200/80 px-2 py-0.5 text-[11px] font-semibold text-gray-800">
                              Naves: {sup.navesAsignadas}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Total de eventos registrados en el período:{" "}
                            <strong>{sup.eventos.length}</strong>
                          </p>
                        </div>

                        {/* Contadores rápidos en línea */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold">
                            Justificaciones: {sup.metricas.justificaciones}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 font-semibold">
                            Permisos: {sup.metricas.permisos}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-gray-200 text-gray-800 font-semibold">
                            Obs: {sup.metricas.observacionesGenerales}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold">
                            Citaciones: {sup.metricas.citaciones}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-semibold">
                            Notificaciones: {sup.metricas.notificaciones}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold ${
                              sup.metricas.diasSinIngreso > 0
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            Días sin ingreso: {sup.metricas.diasSinIngreso}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tabla Cronológica Detallada del Supervisor */}
                    <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 shadow-xs">
                      <table className="w-full text-xs min-w-[680px]">
                        <thead className="bg-[#e6efe9] text-base-eerieBlack font-semibold">
                          <tr>
                            <th className="px-3 py-2.5 text-center w-24">Fecha</th>
                            <th className="px-3 py-2.5 text-left w-28">Nave</th>
                            <th className="px-3 py-2.5 text-center w-20">Puesto</th>
                            <th className="px-3 py-2.5 text-left w-48">Contribuyente</th>
                            <th className="px-3 py-2.5 text-left w-44">Tipo Novedad / Evento</th>
                            <th className="px-3 py-2.5 text-left">Motivo / Detalle</th>
                            <th className="px-3 py-2.5 text-center w-24">N° Doc / Ref.</th>
                            <th className="px-3 py-2.5 text-left w-40">Tiempo / Vigencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-institucional-whiteSmokeBlack/15">
                          {sup.eventos.map((ev: EventoDetalladoSupervisor, idx: number) => {
                            let filaClase = "hover:bg-gray-50/70 transition-colors";
                            let badgeClase = "bg-gray-100 text-gray-800";

                            if (ev.tipoEvento === "SIN INGRESO AL SISTEMA") {
                              filaClase = "bg-red-50/60 hover:bg-red-100/50";
                              badgeClase = "bg-red-600 text-white font-bold";
                            } else if (
                              ev.tipoEvento === "Permiso Asignado" ||
                              ev.tipoEvento === "Permiso de Supervisor"
                            ) {
                              filaClase = "bg-purple-50/50 hover:bg-purple-100/40";
                              badgeClase = "bg-purple-600 text-white font-semibold";
                            } else if (ev.tipoEvento === "Justificación de Falta") {
                              filaClase = "bg-blue-50/50 hover:bg-blue-100/40";
                              badgeClase = "bg-blue-600 text-white font-semibold";
                            } else if (ev.tipoEvento === "Citación") {
                              filaClase = "bg-amber-50/50 hover:bg-amber-100/40";
                              badgeClase = "bg-amber-600 text-white font-semibold";
                            } else if (ev.tipoEvento === "Notificación") {
                              filaClase = "bg-sky-50/50 hover:bg-sky-100/40";
                              badgeClase = "bg-sky-600 text-white font-semibold";
                            }

                            return (
                              <tr key={idx} className={filaClase}>
                                <td className="px-3 py-2 text-center font-bold text-gray-700">
                                  {format(parseISO(ev.fecha), "dd/MM/yyyy")}
                                </td>
                                <td className="px-3 py-2 font-medium text-gray-800">{ev.naveNombre}</td>
                                <td className="px-3 py-2 text-center font-bold text-base-eerieBlack">
                                  {ev.puestoCodigo}
                                </td>
                                <td className="px-3 py-2 text-gray-800">{ev.comercianteNombre}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${badgeClase}`}
                                  >
                                    {ev.tipoEvento}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-gray-800">{ev.motivo}</td>
                                <td className="px-3 py-2 text-center text-gray-600 font-medium">
                                  {ev.documentoRef}
                                </td>
                                <td className="px-3 py-2 text-gray-700 text-[11px]">{ev.vigenciaTexto}</td>
                              </tr>
                            );
                          })}
                          {sup.eventos.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                                No hay eventos ni novedades registradas para este supervisor en el período.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 text-sm">
                No se encontraron supervisores coincidentes con la búsqueda o filtro aplicado.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function ModalReporteSupervisores({
  isOpen,
  onClose,
  ...props
}: ModalReporteSupervisoresProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} disablePointerDismissal={true}>
      <DialogContent
        showCloseButton={false}
        className="w-[98vw] max-w-[98vw] sm:w-[96vw] sm:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[94dvh] sm:max-h-[92dvh] flex flex-col p-0 overflow-hidden border border-institucional-whiteSmokeBlack/30 bg-base-white shadow-2xl rounded-2xl gap-0"
      >
        {isOpen && <ModalReporteSupervisoresContenido onClose={onClose} {...props} />}
      </DialogContent>
    </Dialog>
  );
}
