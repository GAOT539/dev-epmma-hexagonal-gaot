"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  Search,
  User,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  Check,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays, isBefore } from "date-fns";
import { toast } from "sonner";
import { auditoriaService } from "@/application/services/auditoria.service";
import { usuarioService } from "@/application/services/usuario.service";
import type {
  SesionControlSupervisor,
  EtiquetaControlSupervisor,
} from "@/domain/models/auditoria.model";
import type { Usuario } from "@/domain/models/usuario.model";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ITEMS_POR_PAGINA = 10;

// ── Componente de Badge / Globito de Control ─────────────────────────────────

function BadgeControl({ etiqueta, faltantes }: { etiqueta: EtiquetaControlSupervisor; faltantes?: number }) {
  switch (etiqueta) {
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
    case "COMPLETA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 shadow-2xs">
          <Check size={11} className="shrink-0" />
          Completa
        </span>
      );
    case "INCOMPLETA":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 shadow-2xs">
          <AlertTriangle size={11} className="shrink-0" />
          {faltantes && faltantes > 0 ? `Faltan ${faltantes} por tomar` : "Incompleta"}
        </span>
      );
    default:
      return null;
  }
}

// ── Página de Control de Supervisores ────────────────────────────────────────

export default function ControlSupervisoresPage() {
  const [supervisores, setSupervisores] = useState<Usuario[]>([]);
  const [sesiones, setSesiones] = useState<SesionControlSupervisor[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState("");
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(() => subDays(new Date(), 21));
  const [fechaFin, setFechaFin] = useState<Date | undefined>(() => new Date());
  const [calendarInicioOpen, setCalendarInicioOpen] = useState(false);
  const [calendarFinOpen, setCalendarFinOpen] = useState(false);

  const [pagina, setPagina] = useState(1);

  // Modal de Detalle
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionControlSupervisor | null>(null);
  const [filtroDetalleModal, setFiltroDetalleModal] = useState<"TODOS" | "FALTANTES" | "TOMADOS" | "MODIFICADOS">("TODOS");

  const fechaDesdeStr = fechaInicio ? format(fechaInicio, "yyyy-MM-dd") : undefined;
  const fechaHastaStr = fechaFin ? format(fechaFin, "yyyy-MM-dd") : undefined;

  // Cargar usuarios con rol SUPERVISOR
  useEffect(() => {
    usuarioService.obtenerUsuarios().then((users) => {
      setSupervisores(users.filter((u) => u.rol === "SUPERVISOR"));
    });
  }, []);

  // Cargar sesiones de control según filtros
  useEffect(() => {
    let cancel = false;
    async function cargarSesiones() {
      setCargando(true);
      try {
        const datos = await auditoriaService.obtenerSesionesControl({
          busqueda: busqueda || undefined,
          supervisorId: supervisorSeleccionado || undefined,
          fechaDesde: fechaDesdeStr,
          fechaHasta: fechaHastaStr,
        });
        if (!cancel) {
          setSesiones(datos);
        }
      } catch (err) {
        console.error("Error al cargar sesiones de control de supervisores", err);
      } finally {
        if (!cancel) setCargando(false);
      }
    }
    cargarSesiones();
    return () => {
      cancel = true;
    };
  }, [busqueda, supervisorSeleccionado, fechaDesdeStr, fechaHastaStr]);

  // Manejadores de fechas independientes con validación
  function handleSelectFechaInicio(date: Date | undefined) {
    if (!date) return;
    setFechaInicio(date);
    if (fechaFin && isBefore(fechaFin, date)) {
      setFechaFin(date);
    }
    setCalendarInicioOpen(false);
    setPagina(1);
  }

  function handleSelectFechaFin(date: Date | undefined) {
    if (!date) return;
    if (fechaInicio && isBefore(date, fechaInicio)) {
      toast.error("La Fecha de Fin no puede ser anterior a la Fecha de Inicio");
      return;
    }
    setFechaFin(date);
    setCalendarFinOpen(false);
    setPagina(1);
  }

  // Paginación
  const totalPaginas = Math.ceil(sesiones.length / ITEMS_POR_PAGINA);
  const sesionesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return sesiones.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [sesiones, pagina]);

  // Filtrado interno dentro del modal
  const comerciantesFiltradosEnModal = useMemo(() => {
    if (!sesionSeleccionada) return [];
    const list = sesionSeleccionada.detallesComerciantes;
    switch (filtroDetalleModal) {
      case "FALTANTES":
        return list.filter((c) => c.estado === "Pendiente");
      case "TOMADOS":
        return list.filter((c) => c.estado !== "Pendiente");
      case "MODIFICADOS":
        return list.filter((c) => c.metodo === "MODIFICADO_TRAS_PERSISTENCIA");
      default:
        return list;
    }
  }, [sesionSeleccionada, filtroDetalleModal]);

  // ── Generación de PDF General ──────────────────────────────────────────────

  function handleExportPDFGeneral() {
    const doc = new jsPDF({ orientation: "landscape" });

    try {
      doc.addImage("/logopdf.png", "PNG", 10, 10, 30, 30);
    } catch {
      // Continúa si no está disponible la imagen en el entorno
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
      doc.internal.pageSize.width / 2,
      18,
      { align: "center" }
    );

    doc.setFontSize(12);
    doc.text("Reporte de Control de Supervisores", doc.internal.pageSize.width / 2, 33, {
      align: "center",
    });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const periodoStr = `Período: ${fechaDesdeStr || "Inicio"} al ${fechaHastaStr || "Hoy"}  |  Fecha de exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
    doc.text(periodoStr, doc.internal.pageSize.width / 2, 40, { align: "center" });

    const headers = [
      ["Fecha Lista", "Inicio Toma", "Supervisor", "Nave", "Acción", "Estado / Anotaciones", "Avance"],
    ];

    const data = sesiones.map((s) => {
      const anotaciones = s.etiquetas
        .map((e) => {
          if (e === "CON_PERSISTENCIA") return "Con Persistencia";
          if (e === "MODIFICADO_TRAS_PERSISTENCIA") return "Modif. tras persistencia";
          if (e === "CON_RETRASO") return "Con Retraso";
          if (e === "EN_FECHA") return "En Fecha";
          if (e === "COMPLETA") return "Completa";
          if (e === "INCOMPLETA") return `Faltan ${s.resumen.faltantes}`;
          return e;
        })
        .join(" • ");

      const porcentaje = Math.round(
        (s.resumen.tomados / (s.resumen.totalOcupados || 1)) * 100
      );

      return [
        format(new Date(s.fechaJornada + "T00:00:00"), "dd/MM/yyyy"),
        format(new Date(s.timestampInicio), "dd/MM/yyyy HH:mm"),
        s.supervisorNombre,
        s.naveNombre,
        s.accion,
        anotaciones,
        `${s.resumen.tomados}/${s.resumen.totalOcupados} (${porcentaje}%)`,
      ];
    });

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 46,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [69, 116, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 32 },
        2: { cellWidth: 42 },
        3: { cellWidth: 25 },
        4: { cellWidth: 42 },
        5: { cellWidth: 72 },
        6: { cellWidth: 30 },
      },
    });

    doc.save(`control-supervisores-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  }

  // ── Generación de PDF Individual ───────────────────────────────────────────

  function handleExportPDFIndividual(sesion: SesionControlSupervisor) {
    const doc = new jsPDF({ orientation: "portrait" });

    try {
      doc.addImage("/logopdf.png", "PNG", 10, 10, 30, 30);
    } catch {
      // Continúa
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
      doc.internal.pageSize.width / 2,
      18,
      { align: "center" }
    );

    doc.setFontSize(11);
    doc.text("Reporte de Control de Supervisores", doc.internal.pageSize.width / 2, 31, {
      align: "center",
    });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Detalle Individual de Toma de Lista - Jornada: ${format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy")}`,
      doc.internal.pageSize.width / 2,
      37,
      { align: "center" }
    );

    // Bloque descriptivo
    doc.setFontSize(8.5);
    doc.text(`Supervisor: ${sesion.supervisorNombre}`, 14, 46);
    doc.text(`Nave: ${sesion.naveNombre}`, 14, 51);
    doc.text(`Inicio de Toma: ${format(new Date(sesion.timestampInicio), "dd/MM/yyyy HH:mm")}`, 14, 56);
    if (sesion.timestampUltimaModificacion) {
      doc.text(`Última Modificación: ${format(new Date(sesion.timestampUltimaModificacion), "dd/MM/yyyy HH:mm")}`, 14, 61);
    }

    doc.text(`Total Puestos Ocupados: ${sesion.resumen.totalOcupados}`, 115, 46);
    doc.text(`Presentes: ${sesion.resumen.presentes}  |  Ausentes: ${sesion.resumen.ausentes}  |  Permisos: ${sesion.resumen.permisos}`, 115, 51);
    doc.text(`Faltantes (Sin tomar): ${sesion.resumen.faltantes}`, 115, 56);

    let startY = 66;

    if (sesion.esPersistencia) {
      doc.setFont("helvetica", "bold");
      doc.text("Registro con Persistencia:", 14, startY);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Datos arrastrados desde ${sesion.fechaOrigenPersistencia || "jornada previa"}. Justificación: ${sesion.comentarioPersistencia || "Sin justificación registrada"}`,
        14,
        startY + 4
      );
      startY += 10;
    }

    if (sesion.tieneRetraso) {
      doc.setFont("helvetica", "bold");
      doc.text("Registro con Retraso:", 14, startY);
      doc.setFont("helvetica", "normal");
      doc.text(
        sesion.detalleRetraso || "La lista fue registrada manualmente con posterioridad a la jornada.",
        14,
        startY + 4
      );
      startY += 10;
    }

    const headers = [["Puesto", "CIU", "Cédula", "Contribuyente", "Estado", "Método", "Hora"]];
    const data = sesion.detallesComerciantes.map((d) => [
      d.puesto,
      d.ciu,
      d.cedula,
      d.contribuyente,
      d.estado === "Pendiente" ? "Sin tomar" : d.estado,
      d.metodo === "MODIFICADO_TRAS_PERSISTENCIA"
        ? "Modif. tras persistencia"
        : d.metodo === "PERSISTENCIA"
        ? "Persistencia"
        : d.metodo === "FALTANTE"
        ? "Faltante"
        : "Manual",
      d.horaRegistro || "-",
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: startY + 2,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [69, 116, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 24 },
        2: { cellWidth: 24 },
        3: { cellWidth: 48 },
        4: { cellWidth: 22 },
        5: { cellWidth: 36 },
        6: { cellWidth: 18 },
      },
    });

    doc.save(`control-${sesion.naveNombre.replace(/\s+/g, "_")}-${sesion.fechaJornada}.pdf`);
  }

  return (
    <div className="min-h-[100dvh] bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      {/* ── Encabezado Institucional ── */}
      <header className="mb-6 w-full max-w-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText size={24} className="text-institucional-green" aria-hidden="true" />
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Control de Supervisores
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-700 font-medium">
            Monitoreo y radiografía en tiempo real de toma de listas, persistencia operativa y retrasos.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleExportPDFGeneral}
          disabled={sesiones.length === 0}
          className={[
            "flex items-center gap-2 h-10 rounded-lg px-5 text-xs font-semibold shadow-sm transition-colors",
            sesiones.length > 0
              ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
              : "bg-institucional-whiteSmokeBlack/30 text-gray-700 cursor-not-allowed",
          ].join(" ")}
        >
          <Download size={15} />
          <span>Descargar PDF</span>
        </Button>
      </header>

      <div className="w-full max-w-none space-y-4">
        {/* ── Filtros Quirúrgicos ── */}
        <div className="rounded-2xl bg-base-white p-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Buscador de texto */}
            <div className="w-full">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
                />
                <input
                  type="text"
                  placeholder="Supervisor, nave, acción..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPagina(1);
                  }}
                  className="h-10 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                />
              </div>
            </div>

            {/* Selector de Supervisor (Rol SUPERVISOR exclusivo) */}
            <div className="w-full">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Supervisor
              </label>
              <select
                value={supervisorSeleccionado}
                onChange={(e) => {
                  setSupervisorSeleccionado(e.target.value);
                  setPagina(1);
                }}
                className="h-10 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 pr-8 text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="">Todos los supervisores</option>
                {supervisores.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.nombres} {sup.apellidos}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector Fecha Inicio */}
            <div className="w-full">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Fecha de Inicio
              </label>
              <Popover open={calendarInicioOpen} onOpenChange={setCalendarInicioOpen}>
                <PopoverTrigger className="h-10 w-full inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30">
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
                  <span>{fechaInicio ? format(fechaInicio, "dd/MM/yyyy") : "Seleccionar"}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaInicio}
                    onSelect={handleSelectFechaInicio}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Selector Fecha Fin */}
            <div className="w-full">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Fecha de Fin
              </label>
              <Popover open={calendarFinOpen} onOpenChange={setCalendarFinOpen}>
                <PopoverTrigger className="h-10 w-full inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30">
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
                  <span>{fechaFin ? format(fechaFin, "dd/MM/yyyy") : "Seleccionar"}</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaFin}
                    onSelect={handleSelectFechaFin}
                    disabled={(date) => (fechaInicio ? isBefore(date, fechaInicio) : false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ── Tabla Principal con Globitos e Interacción al Clic ── */}
        <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {sesiones.length} sesiones de control registradas
            </p>
            <p className="text-xs text-gray-600 hidden sm:block">
              Haz clic en cualquier fila para ver la radiografía detallada
            </p>
          </div>

          <div className="p-3 md:p-0">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-medium text-gray-600">
                  Cargando control de supervisores...
                </span>
              </div>
            ) : (
              <table className="w-full text-sm block md:table">
                <thead className="hidden md:table-header-group">
                  <tr className="bg-institucional-green/5 border-b border-institucional-whiteSmokeBlack/15">
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[110px]">
                      Fecha de Lista
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                      Inicio Toma (Real)
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[150px]">
                      Supervisor
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[100px]">
                      Nave
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                      Acción
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[200px]">
                      Estado / Anotaciones
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-base-eerieBlack min-w-[110px]">
                      Avance
                    </th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group space-y-3 md:space-y-0">
                  {sesionesPaginadas.map((sesion) => {
                    const porcentaje = Math.round(
                      (sesion.resumen.tomados / (sesion.resumen.totalOcupados || 1)) * 100
                    );

                    return (
                      <tr
                        key={sesion.id}
                        onClick={() => {
                          setSesionSeleccionada(sesion);
                          setFiltroDetalleModal("TODOS");
                        }}
                        className="flex flex-col md:table-row rounded-xl md:rounded-none border border-institucional-whiteSmokeBlack/20 md:border-0 md:border-t md:border-institucional-whiteSmokeBlack/10 p-3.5 md:p-0 bg-base-white mb-3 md:mb-0 shadow-sm md:shadow-none cursor-pointer hover:bg-institucional-green/5 transition-colors"
                      >
                        {/* Fecha Jornada */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-base-eerieBlack text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Fecha Lista:</span>
                          <span className="font-bold text-base-eerieBlack">
                            {format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy")}
                          </span>
                        </td>

                        {/* Inicio Toma Real */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Inicio Toma:</span>
                          <div className="text-right md:text-left">
                            <p className="font-medium text-xs text-base-eerieBlack">
                              {format(new Date(sesion.timestampInicio), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-gray-700">
                              {format(new Date(sesion.timestampInicio), "hh:mm a")}
                            </p>
                          </div>
                        </td>

                        {/* Supervisor */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Supervisor:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green">
                              <User size={12} />
                            </div>
                            <span className="font-medium text-base-eerieBlack truncate max-w-[160px]">
                              {sesion.supervisorNombre}
                            </span>
                          </div>
                        </td>

                        {/* Nave */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Nave:</span>
                          <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-800">
                            {sesion.naveNombre}
                          </span>
                        </td>

                        {/* Acción */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Acción:</span>
                          <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">
                            {sesion.accion}
                          </span>
                        </td>

                        {/* Globitos / Badges */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Estado:</span>
                          <div className="flex flex-wrap items-center gap-1.5 justify-end md:justify-start">
                            {sesion.etiquetas.map((etq) => (
                              <BadgeControl
                                key={etq}
                                etiqueta={etq}
                                faltantes={sesion.resumen.faltantes}
                              />
                            ))}
                          </div>
                        </td>

                        {/* Avance */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell text-right">
                          <span className="font-semibold text-gray-700 md:hidden">Avance:</span>
                          <div className="text-right">
                            <span className="font-bold text-xs text-base-eerieBlack">
                              {sesion.resumen.tomados} / {sesion.resumen.totalOcupados}
                            </span>
                            <span className="text-xs text-gray-600 ml-1">({porcentaje}%)</span>
                            <div className="mt-1 h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden ml-auto">
                              <div
                                className="h-full bg-institucional-green rounded-full transition-all"
                                style={{ width: `${Math.min(porcentaje, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {sesionesPaginadas.length === 0 && (
                    <tr className="block md:table-row">
                      <td
                        colSpan={7}
                        className="block md:table-cell px-4 py-12 text-center text-sm text-gray-700"
                      >
                        No se encontraron registros de control con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="px-5 py-3 border-t border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
              <p className="text-xs text-gray-700 font-medium">
                Página {pagina} de {totalPaginas}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base-eerieBlack transition-colors hover:bg-institucional-green/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagina(p)}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                        p === pagina
                          ? "bg-institucional-green text-base-white shadow-sm"
                          : "text-base-eerieBlack hover:bg-institucional-green/10",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base-eerieBlack transition-colors hover:bg-institucional-green/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Detalle de Toma de Lista (Radiografía Completa) ── */}
      <Dialog
        open={Boolean(sesionSeleccionada)}
        disablePointerDismissal={true}
        onOpenChange={(open) => {
          if (!open) setSesionSeleccionada(null);
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-4xl sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-6 bg-base-white rounded-2xl shadow-2xl"
        >
          {sesionSeleccionada && (
            <>
              {/* Header Modal */}
              <DialogHeader className="p-0 pb-5 border-b border-gray-200 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-lg bg-institucional-green/15 text-institucional-green font-bold text-xs px-2.5 py-1 uppercase tracking-wider shrink-0">
                        {sesionSeleccionada.naveNombre}
                      </span>
                      <DialogTitle className="text-lg sm:text-xl font-bold text-base-eerieBlack">
                        Control de Toma de Lista
                      </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-gray-700 mt-1">
                      Jornada correspondiente al:{" "}
                      <strong className="text-base-eerieBlack font-semibold">
                        {format(new Date(sesionSeleccionada.fechaJornada + "T00:00:00"), "dd/MM/yyyy")}
                      </strong>
                    </DialogDescription>
                  </div>

                  {/* Botón Imprimir Detalle PDF */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleExportPDFIndividual(sesionSeleccionada)}
                    className="flex shrink-0 items-center gap-2 bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
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
                      {sesionSeleccionada.supervisorNombre}
                    </strong>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                    <span className="text-gray-700 block">Inicio de toma</span>
                    <strong className="text-base-eerieBlack block">
                      {format(new Date(sesionSeleccionada.timestampInicio), "dd/MM/yy hh:mm a")}
                    </strong>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                    <span className="text-gray-700 block">Última modif.</span>
                    <strong className="text-base-eerieBlack block">
                      {sesionSeleccionada.timestampUltimaModificacion
                        ? format(new Date(sesionSeleccionada.timestampUltimaModificacion), "dd/MM/yy hh:mm a")
                        : "Sin modificaciones"}
                    </strong>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200 min-w-0">
                    <span className="text-gray-700 block">Acción</span>
                    <strong className="text-base-eerieBlack block truncate">
                      {sesionSeleccionada.accion}
                    </strong>
                  </div>
                </div>

                {/* Bloque de Persistencia (si aplica) */}
                {sesionSeleccionada.esPersistencia && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                    <div className="flex items-center gap-1.5 font-bold text-blue-800">
                      <RefreshCw size={13} />
                      <span>Registro ejecutado con Persistencia</span>
                    </div>
                    <p className="mt-1">
                      Asistencia arrastrada desde la jornada del{" "}
                      <strong>
                        {sesionSeleccionada.fechaOrigenPersistencia
                          ? format(new Date(sesionSeleccionada.fechaOrigenPersistencia + "T00:00:00"), "dd/MM/yyyy")
                          : "día hábil anterior"}
                      </strong>
                      .
                      {sesionSeleccionada.comentarioPersistencia && (
                        <span className="block mt-1 italic text-blue-800">
                          Justificación: &ldquo;{sesionSeleccionada.comentarioPersistencia}&rdquo;
                        </span>
                      )}
                    </p>
                    {sesionSeleccionada.modificadoTrasPersistencia && (
                      <p className="mt-1 text-amber-800 font-semibold flex items-center gap-1">
                        <Layers size={12} />
                        Se registraron modificaciones manuales posteriores en comerciantes individuales.
                      </p>
                    )}
                  </div>
                )}

                {/* Bloque de Retraso (si aplica) */}
                {sesionSeleccionada.tieneRetraso && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-xs text-orange-900">
                    <div className="flex items-center gap-1.5 font-bold text-orange-800">
                      <Clock size={13} />
                      <span>Toma de Lista con Retraso (Retroactiva)</span>
                    </div>
                    <p className="mt-1">
                      {sesionSeleccionada.detalleRetraso ||
                        `La jornada corresponde al ${format(new Date(sesionSeleccionada.fechaJornada + "T00:00:00"), "dd/MM/yyyy")} pero fue registrada manualmente en fecha ${format(new Date(sesionSeleccionada.timestampInicio), "dd/MM/yyyy HH:mm")}.`}
                    </p>
                  </div>
                )}
              </DialogHeader>

              {/* Cuerpo del Modal con Resumen y Radiografía de Comerciantes */}
              <div className="pt-4 space-y-4">
                {/* Tarjetas de Resumen Numérico */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-base-white p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-gray-700 block">Total Puestos</span>
                    <span className="text-lg font-bold text-base-eerieBlack">
                      {sesionSeleccionada.resumen.totalOcupados}
                    </span>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-base-white p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-gray-700 block">Tomados</span>
                    <span className="text-lg font-bold text-institucional-green">
                      {sesionSeleccionada.resumen.tomados}
                    </span>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-green-700 block">Presentes</span>
                    <span className="text-lg font-bold text-green-800">
                      {sesionSeleccionada.resumen.presentes}
                    </span>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-red-700 block">Ausentes</span>
                    <span className="text-lg font-bold text-red-800">
                      {sesionSeleccionada.resumen.ausentes}
                    </span>
                  </div>
                  <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-purple-700 block">Permisos</span>
                    <span className="text-lg font-bold text-purple-800">
                      {sesionSeleccionada.resumen.permisos}
                    </span>
                  </div>
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-3.5 text-center min-w-0 shadow-2xs">
                    <span className="text-xs text-yellow-800 block">Faltantes</span>
                    <span className="text-lg font-bold text-yellow-900">
                      {sesionSeleccionada.resumen.faltantes}
                    </span>
                  </div>
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
                    Todos ({sesionSeleccionada.detallesComerciantes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroDetalleModal("FALTANTES")}
                    className={[
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                      filtroDetalleModal === "FALTANTES"
                        ? "bg-yellow-500 text-base-white"
                        : "text-yellow-800 hover:bg-yellow-50",
                    ].join(" ")}
                  >
                    Faltantes por tomar ({sesionSeleccionada.resumen.faltantes})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroDetalleModal("TOMADOS")}
                    className={[
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                      filtroDetalleModal === "TOMADOS"
                        ? "bg-institucional-green text-base-white"
                        : "text-gray-700 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    Tomados ({sesionSeleccionada.resumen.tomados})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroDetalleModal("MODIFICADOS")}
                    className={[
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
                      filtroDetalleModal === "MODIFICADOS"
                        ? "bg-amber-600 text-base-white"
                        : "text-amber-800 hover:bg-amber-50",
                    ].join(" ")}
                  >
                    Modificados tras Persistencia (
                    {
                      sesionSeleccionada.detallesComerciantes.filter(
                        (c) => c.metodo === "MODIFICADO_TRAS_PERSISTENCIA"
                      ).length
                    }
                    )
                  </button>
                </div>

                {/* Tabla de Comerciantes de la Sesión */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 text-base-eerieBlack font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Puesto</th>
                        <th className="px-3 py-2 text-left">CIU</th>
                        <th className="px-3 py-2 text-left">Cédula</th>
                        <th className="px-3 py-2 text-left">Contribuyente</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                        <th className="px-3 py-2 text-left">Origen / Método</th>
                        <th className="px-3 py-2 text-right">Hora</th>
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
                        } else {
                          estadoBadge = (
                            <span className="rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 px-2 py-0.5 font-bold">
                              Sin tomar / Pendiente
                            </span>
                          );
                        }

                        let metodoBadge = null;
                        if (com.metodo === "PERSISTENCIA") {
                          metodoBadge = (
                            <span className="text-blue-700 font-medium">Persistencia</span>
                          );
                        } else if (com.metodo === "MODIFICADO_TRAS_PERSISTENCIA") {
                          metodoBadge = (
                            <span className="text-amber-800 font-bold">
                              Modificado tras persistencia
                            </span>
                          );
                        } else if (com.metodo === "FALTANTE") {
                          metodoBadge = (
                            <span className="text-yellow-800 font-medium">Faltante</span>
                          );
                        } else {
                          metodoBadge = (
                            <span className="text-gray-700 font-medium">Manual</span>
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
                            <td className="px-3 py-2">{metodoBadge}</td>
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
              <DialogFooter className="pt-4 border-t border-gray-200 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSesionSeleccionada(null)}
                  className="px-5 font-semibold text-xs"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
