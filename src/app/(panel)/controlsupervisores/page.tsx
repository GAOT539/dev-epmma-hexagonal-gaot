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
  UserCheck,
  CalendarOff,
} from "lucide-react";
import { format, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";
import { toast } from "sonner";
import { auditoriaService } from "@/application/services/auditoria.service";
import { usuarioService } from "@/application/services/usuario.service";
import type { SesionControlSupervisor } from "@/domain/models/auditoria.model";
import type { Usuario } from "@/domain/models/usuario.model";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  exportarControlSupervisoresGeneralPDF,
  exportarControlSupervisorIndividualPDF,
} from "./components/control-pdf.utils";
import {
  BadgeControl,
  ModalDetalleControl,
} from "./components/ModalDetalleControl";
import { ModalPermisosSupervisores } from "./components/ModalPermisosSupervisores";
import { ModalDiasNoLaborables } from "./components/ModalDiasNoLaborables";

const ITEMS_POR_PAGINA = 10;

// ── Página de Control de Supervisores ────────────────────────────────────────

export default function ControlSupervisoresPage() {
  const [supervisores, setSupervisores] = useState<Usuario[]>([]);
  const [sesiones, setSesiones] = useState<SesionControlSupervisor[]>([]);
  const [cargando, setCargando] = useState(true);

  // Límites dinámicos de fechas obtenidos de la base de datos
  const [limites, setLimites] = useState<{ minFecha: string; maxFecha: string; hoy: string }>({
    minFecha: format(new Date(), "yyyy-MM-dd"),
    maxFecha: format(new Date(), "yyyy-MM-dd"),
    hoy: format(new Date(), "yyyy-MM-dd"),
  });

  // Filtros inicializados en el rango real (minFecha .. hoy)
  const [busqueda, setBusqueda] = useState("");
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState("");
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(() => new Date());
  const [fechaFin, setFechaFin] = useState<Date | undefined>(() => new Date());
  const [calendarInicioOpen, setCalendarInicioOpen] = useState(false);
  const [calendarFinOpen, setCalendarFinOpen] = useState(false);

  const [pagina, setPagina] = useState(1);

  // Modal de Detalle
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionControlSupervisor | null>(null);

  // Modales de Gestión Operativa Independientes (Permisos / Días No Laborables)
  const [modalPermisosOpen, setModalPermisosOpen] = useState(false);
  const [modalDiasNoLabOpen, setModalDiasNoLabOpen] = useState(false);
  const [versionCarga, setVersionCarga] = useState(0);

  const fechaDesdeStr = fechaInicio ? format(fechaInicio, "yyyy-MM-dd") : undefined;
  const fechaHastaStr = fechaFin ? format(fechaFin, "yyyy-MM-dd") : undefined;

  // Cargar límites de fechas reales de la base de datos
  useEffect(() => {
    let activo = true;
    fetch("/api/v1/asistencia?meta=limites")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!activo || !data) return;
        setLimites({
          minFecha: data.minFecha || format(new Date(), "yyyy-MM-dd"),
          maxFecha: data.maxFecha || format(new Date(), "yyyy-MM-dd"),
          hoy: data.hoy || format(new Date(), "yyyy-MM-dd"),
        });
        if (data.minFecha) {
          setFechaInicio(parseISO(data.minFecha));
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

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
  }, [busqueda, supervisorSeleccionado, fechaDesdeStr, fechaHastaStr, versionCarga]);

  // Manejadores de fechas independientes con validación
  function handleSelectFechaInicio(date: Date | undefined) {
    if (!date) return;
    const minD = limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date());
    if (date > endOfDay(new Date()) || date < minD) return;
    setFechaInicio(date);
    if (fechaFin && isBefore(fechaFin, date)) {
      setFechaFin(date);
    }
    setCalendarInicioOpen(false);
    setPagina(1);
  }

  function handleSelectFechaFin(date: Date | undefined) {
    if (!date) return;
    const minD = fechaInicio
      ? startOfDay(fechaInicio)
      : (limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date()));
    if (date > endOfDay(new Date()) || date < minD) {
      toast.error("La Fecha de Fin no puede ser anterior a la Fecha de Inicio ni posterior a hoy");
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

  // ── Generación de PDF General ──────────────────────────────────────────────

  function handleExportPDFGeneral() {
    exportarControlSupervisoresGeneralPDF({
      sesiones,
      fechaDesdeStr: fechaDesdeStr || "",
      fechaHastaStr: fechaHastaStr || "",
    });
  }

  // ── Generación de PDF Individual ───────────────────────────────────────────

  function handleExportPDFIndividual(sesion: SesionControlSupervisor) {
    exportarControlSupervisorIndividualPDF(sesion);
  }

  return (
    <div className="flex flex-col min-h-[100dvh] md:h-[100dvh] bg-institucional-whiteSmoke px-4 py-6 sm:px-6 lg:px-10">
      {/* ── Encabezado Institucional ── */}
      <header className="mb-4 shrink-0 w-full max-w-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalPermisosOpen(true)}
            className="flex items-center gap-1.5 h-10 rounded-lg px-3.5 text-xs font-semibold border-institucional-green/40 text-institucional-green hover:bg-institucional-green/10 shadow-2xs cursor-pointer"
          >
            <UserCheck size={15} />
            <span>Permisos y Cobertura</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setModalDiasNoLabOpen(true)}
            className="flex items-center gap-1.5 h-10 rounded-lg px-3.5 text-xs font-semibold border-amber-600/40 text-amber-700 hover:bg-amber-50 shadow-2xs cursor-pointer"
          >
            <CalendarOff size={15} />
            <span>Días No Laborables</span>
          </Button>

          <Button
            type="button"
            onClick={handleExportPDFGeneral}
            disabled={sesiones.length === 0}
            className={[
              "flex items-center gap-2 h-10 rounded-lg px-4 text-xs font-semibold shadow-sm transition-colors",
              sesiones.length > 0
                ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
                : "bg-institucional-whiteSmokeBlack/30 text-gray-700 cursor-not-allowed",
            ].join(" ")}
          >
            <Download size={15} />
            <span>Descargar PDF</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* ── Filtros Quirúrgicos ── */}
        <div className="shrink-0 rounded-2xl bg-base-white p-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
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
                    disabled={(date) => {
                      const minD = limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date());
                      return date > endOfDay(new Date()) || date < minD;
                    }}
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
                    disabled={(date) => {
                      const minD = fechaInicio
                        ? startOfDay(fechaInicio)
                        : (limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date()));
                      return date > endOfDay(new Date()) || date < minD;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ── Tabla Principal con Globitos e Interacción al Clic ── */}
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
          <div className="shrink-0 px-5 py-3 border-b border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {sesiones.length} sesiones de control registradas
            </p>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 p-3 md:p-0">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-medium text-gray-600">
                  Cargando control de supervisores...
                </span>
              </div>
            ) : (
              <table className="w-full text-sm block md:table">
                <thead className="hidden md:table-header-group sticky top-0 z-20">
                  <tr className="bg-[#e6efe9] border-b border-institucional-whiteSmokeBlack/15">
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[110px]">
                      Fecha de Lista
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                      Inicio Toma (Real)
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[150px]">
                      Supervisor
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[100px]">
                      Nave
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                      Acción
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-left font-semibold text-base-eerieBlack min-w-[200px]">
                      Estado / Anotaciones
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-3 text-right font-semibold text-base-eerieBlack min-w-[130px]">
                      Puestos / Asistencia
                    </th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group space-y-3 md:space-y-0">
                  {sesionesPaginadas.map((sesion) => {
                    return (
                      <tr
                        key={sesion.id}
                        onClick={() => {
                          setSesionSeleccionada(sesion);
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
                              />
                            ))}
                          </div>
                        </td>

                        {/* Puestos / Asistencia */}
                        <td className="flex justify-between items-center py-1 md:px-4 md:py-3.5 text-sm md:table-cell text-right">
                          <span className="font-semibold text-gray-700 md:hidden">Puestos / Asistencia:</span>
                          <div className="text-right">
                            <span className="font-bold text-xs text-base-eerieBlack">
                              Total: {sesion.resumen.totalOcupados}
                            </span>
                            <div className="text-xs mt-0.5 flex items-center justify-end gap-1.5 font-medium">
                              <span className="text-green-700 font-semibold">{sesion.resumen.presentes} P</span>
                              <span>•</span>
                              <span className="text-red-700 font-semibold">{sesion.resumen.ausentes} A</span>
                              <span>•</span>
                              <span className="text-purple-700 font-semibold">{sesion.resumen.permisos} Pm</span>
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
            <div className="shrink-0 px-5 py-3 border-t border-institucional-whiteSmokeBlack/15 flex items-center justify-between bg-base-white">
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
      <ModalDetalleControl
        sesion={sesionSeleccionada}
        onCerrar={() => setSesionSeleccionada(null)}
        onExportarPDF={handleExportPDFIndividual}
      />

      {/* ── Modales de Gestión Operativa Independientes ── */}
      <ModalPermisosSupervisores
        isOpen={modalPermisosOpen}
        onClose={() => setModalPermisosOpen(false)}
        supervisores={supervisores}
        onCambioRealizado={() => setVersionCarga((v) => v + 1)}
      />

      <ModalDiasNoLaborables
        isOpen={modalDiasNoLabOpen}
        onClose={() => setModalDiasNoLabOpen(false)}
        onCambioRealizado={() => setVersionCarga((v) => v + 1)}
      />
    </div>
  );
}
