"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  X,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Layers,
  Calendar,
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
import type {
  ReporteSupervisoresData,
  DetalleSupervisorReporte,
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
  fechaInicioDefault?: string;
  fechaFinDefault?: string;
  supervisorIdDefault?: string;
}

export function ModalReporteSupervisores({
  isOpen,
  onClose,
  supervisores,
  fechaInicioDefault,
  fechaFinDefault,
  supervisorIdDefault = "",
}: ModalReporteSupervisoresProps) {
  const [cargando, setCargando] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  // Filtros internos del modal
  const [fechaDesde, setFechaDesde] = useState(
    fechaInicioDefault || format(new Date(), "yyyy-MM-01")
  );
  const [fechaHasta, setFechaHasta] = useState(
    fechaFinDefault || format(new Date(), "yyyy-MM-dd")
  );
  const [supervisorFiltro, setSupervisorFiltro] = useState(supervisorIdDefault);

  // Datos cargados desde el endpoint
  const [datosReporte, setDatosReporte] = useState<ReporteSupervisoresData | null>(null);

  // Pestañas del modal: "HOJA1" (Resumen) | "HOJAS_DETALLE" (Detalle por Supervisor)
  const [pestañaActiva, setPestañaActiva] = useState<"HOJA1" | "HOJAS_DETALLE">("HOJA1");

  // Supervisor seleccionado en la Vista 2
  const [supervisorSeleccionadoId, setSupervisorSeleccionadoId] = useState<string>("");

  // Cargar datos del reporte
  async function cargarReporte() {
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
      setDatosReporte(data);

      if (data.detallesPorSupervisor.length > 0) {
        setSupervisorSeleccionadoId((prev) => {
          const existe = data.detallesPorSupervisor.some((d) => d.supervisorId === prev);
          return existe ? prev : data.detallesPorSupervisor[0].supervisorId;
        });
      }
    } catch (err) {
      console.error("Error al cargar reporte de supervisores:", err);
      toast.error("Error al cargar la información del reporte consolidado.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void cargarReporte();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Supervisor activo para la Vista 2
  const supervisorActivo: DetalleSupervisorReporte | undefined = useMemo(() => {
    if (!datosReporte) return undefined;
    return (
      datosReporte.detallesPorSupervisor.find(
        (d) => d.supervisorId === supervisorSeleccionadoId
      ) || datosReporte.detallesPorSupervisor[0]
    );
  }, [datosReporte, supervisorSeleccionadoId]);

  // Manejadores de exportación
  async function handleExportarPDF() {
    if (!datosReporte) return;
    setExportandoPDF(true);
    try {
      await exportarReporteSupervisoresPDF(datosReporte);
      toast.success("Reporte PDF generado exitosamente.");
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
      await exportarReporteSupervisoresExcel(datosReporte);
      toast.success("Reporte Excel (.xlsx) generado exitosamente.");
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      toast.error("Ocurrió un error al generar el Excel del reporte.");
    } finally {
      setExportandoExcel(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} disablePointerDismissal={true}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw] sm:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border border-institucional-whiteSmokeBlack/30 bg-base-white shadow-2xl rounded-2xl gap-0"
      >
        {/* ── Encabezado Institucional del Modal ── */}
        <DialogHeader className="px-6 py-3.5 border-b border-institucional-whiteSmokeBlack/20 bg-institucional-whiteSmoke/40 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-institucional-green/10 text-institucional-green shrink-0">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-institucional-green">
                  Reporte Consolidado y Detallado de Supervisores
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-600">
                  Resumen de justificaciones, permisos, novedades y auditoría de asistencia por supervisor (EP-EMA).
                </DialogDescription>
              </div>
            </div>

            {/* Botones de Exportación y Cierre */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                type="button"
                size="sm"
                onClick={handleExportarPDF}
                disabled={cargando || exportandoPDF || !datosReporte}
                className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-semibold bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {exportandoPDF ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span>Descargar Reporte PDF</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportarExcel}
                disabled={cargando || exportandoExcel || !datosReporte}
                className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-semibold border-institucional-green text-institucional-green hover:bg-institucional-green/10 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {exportandoExcel ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={13} />
                )}
                <span>Descargar Reporte Excel (.xlsx)</span>
              </Button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-1 cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Barra de Filtros Internos y Pestañas ── */}
        <div className="px-6 py-3 border-b border-institucional-whiteSmokeBlack/15 bg-base-white flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Pestañas de Navegación */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-institucional-whiteSmoke border border-institucional-whiteSmokeBlack/20 shrink-0">
            <button
              type="button"
              onClick={() => setPestañaActiva("HOJA1")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                pestañaActiva === "HOJA1"
                  ? "bg-base-white text-institucional-green shadow-xs"
                  : "text-gray-600 hover:text-base-eerieBlack",
              ].join(" ")}
            >
              <Layers size={13} />
              <span>Hoja 1: Resumen y Permisos</span>
            </button>
            <button
              type="button"
              onClick={() => setPestañaActiva("HOJAS_DETALLE")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                pestañaActiva === "HOJAS_DETALLE"
                  ? "bg-base-white text-institucional-green shadow-xs"
                  : "text-gray-600 hover:text-base-eerieBlack",
              ].join(" ")}
            >
              <FileText size={13} />
              <span>Hojas Siguientes: Detalle por Supervisor</span>
            </button>
          </div>

          {/* Filtros de Fecha y Supervisor */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-8 rounded-lg border border-institucional-whiteSmokeBlack/30 px-2 text-xs bg-base-white outline-none focus:border-institucional-green"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-8 rounded-lg border border-institucional-whiteSmokeBlack/30 px-2 text-xs bg-base-white outline-none focus:border-institucional-green"
              />
            </div>

            <select
              value={supervisorFiltro}
              onChange={(e) => setSupervisorFiltro(e.target.value)}
              className="h-8 rounded-lg border border-institucional-whiteSmokeBlack/30 px-2 text-xs bg-base-white outline-none focus:border-institucional-green"
            >
              <option value="">Todos los supervisores</option>
              {supervisores.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.nombres} {sup.apellidos}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cargarReporte}
              disabled={cargando}
              className="h-8 px-2.5 text-xs font-semibold cursor-pointer border-institucional-green/40 text-institucional-green hover:bg-institucional-green/10"
            >
              <RefreshCw size={12} className={cargando ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>

        {/* ── Contenedor Principal de Visualización ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
               VISTA 1: HOJA 1 - RESUMEN CONSOLIDADO Y PERMISOS DE SUPERVISORES
               ════════════════════════════════════════════════════════════════════ */
            <div className="space-y-6">
              {/* Tabla 1: Resumen de Gestión */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-institucional-green flex items-center gap-1.5">
                    <UserCheck size={16} />
                    <span>Tabla 1: Resumen Consolidado de Gestión por Supervisor</span>
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {datosReporte.resumenSupervisores.length} supervisor(es)
                  </span>
                </div>

                <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-xs">
                  <table className="w-full text-xs">
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
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Calendar size={16} />
                    <span>Tabla 2: Registro de Permisos de Supervisores y Cobertura Aplicada</span>
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {datosReporte.permisosSupervisoresPeriodo.length} registro(s)
                  </span>
                </div>

                <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-xs">
                  <table className="w-full text-xs">
                    <thead className="bg-[#e2eaf4] text-base-eerieBlack font-semibold">
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
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
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
               VISTA 2: HOJAS SIGUIENTES - DETALLE CRONOLÓGICO POR SUPERVISOR
               ════════════════════════════════════════════════════════════════════ */
            <div className="space-y-5">
              {/* Selector horizontal de Supervisores */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-institucional-whiteSmokeBlack/15">
                {datosReporte.detallesPorSupervisor.map((sup) => (
                  <button
                    key={sup.supervisorId}
                    type="button"
                    onClick={() => setSupervisorSeleccionadoId(sup.supervisorId)}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer",
                      supervisorActivo?.supervisorId === sup.supervisorId
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

              {supervisorActivo ? (
                <div className="space-y-4">
                  {/* Tarjeta de Encabezado y Métricas Rápidas del Supervisor */}
                  <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/70 p-4 shadow-2xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-institucional-green">
                            {supervisorActivo.supervisorNombre}
                          </h4>
                          <span className="rounded-md bg-gray-200/80 px-2 py-0.5 text-[11px] font-semibold text-gray-800">
                            Naves: {supervisorActivo.navesAsignadas}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Total de eventos registrados en el período:{" "}
                          <strong>{supervisorActivo.eventos.length}</strong>
                        </p>
                      </div>

                      {/* Contadores rápidos en línea */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold">
                          Justificaciones: {supervisorActivo.metricas.justificaciones}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 font-semibold">
                          Permisos: {supervisorActivo.metricas.permisos}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-gray-200 text-gray-800 font-semibold">
                          Obs: {supervisorActivo.metricas.observacionesGenerales}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold">
                          Citaciones: {supervisorActivo.metricas.citaciones}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-semibold">
                          Notificaciones: {supervisorActivo.metricas.notificaciones}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            supervisorActivo.metricas.diasSinIngreso > 0
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          Días sin ingreso: {supervisorActivo.metricas.diasSinIngreso}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tabla Cronológica Detallada del Supervisor */}
                  <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-xs">
                    <table className="w-full text-xs">
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
                        {supervisorActivo.eventos.map((ev: EventoDetalladoSupervisor, idx: number) => {
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
                        {supervisorActivo.eventos.length === 0 && (
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
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
