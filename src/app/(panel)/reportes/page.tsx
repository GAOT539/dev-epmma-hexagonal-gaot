"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Search,
  X,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/application/services/auth.service";
import { naveService, esNavePermitidaParaUsuario } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
import { asistenciaService } from "@/application/services/asistencia.service";
import type { Nave } from "@/domain/models/nave.model";
import type {
  Comerciante,
  RegistroAsistencia,
} from "@/domain/models/comerciante.model";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  ESTADO_COLORES,
  ESTADO_LABELS,
  normalizeText,
  formatearNovedadesReporte,
  exportarReporteAsistenciaPDF,
  type ReporteItem,
} from "./components/reportes-pdf.utils";

// ── Página de Reportes ───────────────────────────────────────────────────────

export default function ReportesPage() {
  const { user } = useAuth();
  const [allNaves, setAllNaves] = useState<Nave[]>([]);
  const [todosLosComerciantes, setTodosLosComerciantes] = useState<Comerciante[]>([]);
  const [asistenciaData, setAsistenciaData] = useState<RegistroAsistencia[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  const [selectedNaveId, setSelectedNaveId] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [incluirObservaciones, setIncluirObservaciones] = useState(true);
  const [soloObservaciones, setSoloObservaciones] = useState(false);

  // Estados para fechas independientes
  const [fechaInicioDate, setFechaInicioDate] = useState<Date | undefined>(() => subDays(new Date(), 14));
  const [fechaFinDate, setFechaFinDate] = useState<Date | undefined>(() => new Date());
  const [openInicio, setOpenInicio] = useState(false);
  const [openFin, setOpenFin] = useState(false);

  const fechaInicio = fechaInicioDate ? format(fechaInicioDate, "yyyy-MM-dd") : "";
  const fechaFin = fechaFinDate ? format(fechaFinDate, "yyyy-MM-dd") : "";

  // Cargar naves y comerciantes desde la capa de aplicación
  useEffect(() => {
    let activo = true;
    Promise.all([
      naveService.obtenerNaves(),
      comercianteService.obtenerComerciantes(),
    ]).then(([navesData, comData]) => {
      if (activo) {
        setAllNaves(navesData);
        setTodosLosComerciantes(comData);
        setCargandoInicial(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  // RBAC: Supervisores solo ven sus naves asignadas
  const naves = useMemo(() => {
    return allNaves.filter((n) => esNavePermitidaParaUsuario(n, user));
  }, [allNaves, user]);

  const navesPermitidasIds = useMemo(() => new Set(naves.map((n) => n.id)), [naves]);

  // Mapa de comerciante -> puesto y nave
  const comerciantePuestoMap = useMemo(() => {
    const map = new Map<string, { puestoCode: string; naveNombre: string; naveId: string }>();
    for (const n of allNaves) {
      if (n.puestos) {
        for (const p of n.puestos) {
          if (p.comercianteId) {
            map.set(p.comercianteId, {
              puestoCode: p.codigo,
              naveNombre: n.nombre,
              naveId: n.id,
            });
          }
        }
      }
    }
    return map;
  }, [allNaves]);

  // Rango de fechas
  const fechas = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];
    try {
      return eachDayOfInterval({
        start: new Date(fechaInicio + "T00:00:00"),
        end: new Date(fechaFin + "T00:00:00"),
      }).map((d) => format(d, "yyyy-MM-dd"));
    } catch {
      return [];
    }
  }, [fechaInicio, fechaFin]);

  // Carga asíncrona de datos de asistencia
  useEffect(() => {
    let activo = true;
    if (!fechaInicio || !fechaFin || fechas.length === 0) {
      return;
    }

    queueMicrotask(() => {
      if (activo) setCargandoReporte(true);
    });

    const fetchPromise =
      selectedNaveId && selectedNaveId !== "todas"
        ? asistenciaService.obtenerAsistenciaNaveRango(selectedNaveId, fechaInicio, fechaFin)
        : asistenciaService.obtenerAsistenciaRango(fechaInicio, fechaFin);

    fetchPromise.then((asistencia) => {
      if (!activo) return;
      setAsistenciaData(asistencia);
      setCargandoReporte(false);
    });

    return () => {
      activo = false;
    };
  }, [selectedNaveId, fechaInicio, fechaFin, fechas]);

  // Filtro combinado: Nave + Buscador (apellidos, nombres o cédula)
  const reporteFiltrado = useMemo<ReporteItem[]>(() => {
    const registrosMap = new Map<string, RegistroAsistencia[]>();
    asistenciaData.forEach((r) => {
      const list = registrosMap.get(r.comercianteId) || [];
      list.push(r);
      registrosMap.set(r.comercianteId, list);
    });

    const q = normalizeText(searchQuery.trim());

    const filtrados = todosLosComerciantes
      .map((com) => {
        const info = comerciantePuestoMap.get(com.idInterno);
        const naveId = info?.naveId ?? "";
        const naveNombre = info?.naveNombre ?? com.nave ?? "—";
        const puestoCode = info?.puestoCode ?? "—";

        // 1. RBAC: solo naves permitidas para supervisores
        if (user?.rol === "SUPERVISOR") {
          const naveObj = allNaves.find(
            (n) => n.id === naveId || n.nombre.toUpperCase() === naveNombre.toUpperCase()
          );
          const esPermitida = naveObj
            ? esNavePermitidaParaUsuario(naveObj, user)
            : navesPermitidasIds.has(naveId);
          if (!esPermitida) return null;
        }

        // 2. Filtro de Nave seleccionada
        if (selectedNaveId && selectedNaveId !== "todas") {
          if (naveId !== selectedNaveId) return null;
        }

        // 3. Filtro de Buscador (apellidos, nombres o cédula)
        if (q) {
          const matchContribuyente = normalizeText(com.contribuyente).includes(q);
          const matchCedula = normalizeText(com.cedula).includes(q);
          const matchCiu = normalizeText(com.ciu).includes(q);
          if (!matchContribuyente && !matchCedula && !matchCiu) {
            return null;
          }
        }

        const comRegistros = registrosMap.get(com.idInterno) || [];
        const regFechaMap = new Map<string, RegistroAsistencia>();
        comRegistros.forEach((r) => regFechaMap.set(r.fecha, r));

        const estados = fechas.map(
          (f) => regFechaMap.get(f)?.estado ?? "Presente"
        );
        const observaciones = formatearNovedadesReporte(comRegistros);

        return {
          comerciante: com,
          puestoCode,
          naveNombre,
          naveId,
          estados,
          observaciones,
        };
      })
      .filter(Boolean) as ReporteItem[];

    let resultado = filtrados;
    if (soloObservaciones) {
      resultado = resultado.filter((row) => row.observaciones.trim().length > 0);
    }

    return resultado.sort((a, b) =>
      a.puestoCode.localeCompare(b.puestoCode, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [
    allNaves,
    todosLosComerciantes,
    asistenciaData,
    comerciantePuestoMap,
    user,
    navesPermitidasIds,
    selectedNaveId,
    searchQuery,
    fechas,
    soloObservaciones,
  ]);

  const hayDatos = reporteFiltrado.length > 0;

  // ── Exportar / Imprimir PDF ────────────────────────────────────────────────

  async function imprimirPDF() {
    await exportarReporteAsistenciaPDF({
      reporteFiltrado,
      fechas,
      fechaInicio,
      fechaFin,
      soloObservaciones,
      incluirObservaciones,
    });
  }

  const handleExportPDF = imprimirPDF;

  return (
    <div className="flex flex-col min-h-[100dvh] md:h-[100dvh] bg-institucional-whiteSmoke px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Reportes Operativos
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {cargandoInicial ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium text-gray-600">Cargando datos del módulo de reportes...</span>
          </div>
        ) : (
          <>
            {/* ── Controles Unificados ── */}
            <div className="rounded-2xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 shrink-0">
              <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-4 w-full">
                {/* Buscador de Comerciantes */}
                <div className="flex flex-col gap-1.5 w-full md:flex-1 md:min-w-[240px]">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Buscar Comerciante
                  </label>
                  <div className="relative w-full">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <Input
                      type="text"
                      placeholder="Buscar por apellidos, nombres o cédula..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 pr-8 text-xs bg-base-white border-institucional-whiteSmokeBlack/30 focus-visible:ring-institucional-green"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtro de Nave */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Nave
                  </label>
                  <select
                    value={selectedNaveId}
                    onChange={(e) => setSelectedNaveId(e.target.value)}
                    className="h-9 w-full md:w-auto rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-xs font-medium text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                  >
                    <option value="todas">Todas las Naves</option>
                    {naves.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector Fecha Inicio */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Fecha de Inicio
                  </label>
                  <Popover open={openInicio} onOpenChange={setOpenInicio}>
                    <PopoverTrigger className="h-9 w-full md:w-auto inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-xs text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30 cursor-pointer">
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
                      <span>{fechaInicioDate ? format(fechaInicioDate, "dd/MM/yyyy") : "Seleccionar"}</span>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        locale={es}
                        selected={fechaInicioDate}
                        onSelect={(date) => {
                          if (!date) return;
                          setFechaInicioDate(date);
                          if (fechaFinDate && date > fechaFinDate) {
                            setFechaFinDate(date);
                          }
                          setOpenInicio(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Selector Fecha Fin */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Fecha de Fin
                  </label>
                  <Popover open={openFin} onOpenChange={setOpenFin}>
                    <PopoverTrigger className="h-9 w-full md:w-auto inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-xs text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30 cursor-pointer">
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
                      <span>{fechaFinDate ? format(fechaFinDate, "dd/MM/yyyy") : "Seleccionar"}</span>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        locale={es}
                        selected={fechaFinDate}
                        onSelect={(date) => {
                          if (!date) return;
                          setFechaFinDate(date);
                          setOpenFin(false);
                        }}
                        disabled={(date) => (fechaInicioDate ? date < fechaInicioDate : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Toggle de observaciones */}
                <div className="flex flex-col justify-end w-full md:w-auto shrink-0">
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="toggle-obs"
                      checked={incluirObservaciones}
                      disabled={soloObservaciones}
                      onChange={(e) => setIncluirObservaciones(e.target.checked)}
                      className="rounded border-institucional-whiteSmokeBlack/30 text-institucional-green focus:ring-institucional-green w-4 h-4 cursor-pointer disabled:opacity-40"
                    />
                    <label
                      htmlFor="toggle-obs"
                      className={`text-xs font-semibold uppercase tracking-wider cursor-pointer select-none ${soloObservaciones ? "text-gray-400" : "text-gray-700"}`}
                    >
                      Incluir Observaciones
                    </label>
                  </div>
                </div>

                {/* Toggle Solo Observaciones */}
                <div className="flex flex-col justify-end w-full md:w-auto shrink-0">
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="toggle-solo-obs"
                      checked={soloObservaciones}
                      onChange={(e) => setSoloObservaciones(e.target.checked)}
                      className="rounded border-institucional-whiteSmokeBlack/30 text-institucional-green focus:ring-institucional-green w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="toggle-solo-obs"
                      className="text-xs font-semibold text-institucional-green uppercase tracking-wider cursor-pointer select-none"
                    >
                      Solo Observaciones
                    </label>
                  </div>
                </div>

                {/* Botón Descargar PDF */}
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={!hayDatos}
                  className={[
                    "flex items-center justify-center gap-2 h-9 rounded-lg px-5 text-xs font-semibold shadow-sm transition-colors w-full md:w-auto shrink-0 mt-2 md:mt-0",
                    hayDatos
                      ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2 cursor-pointer"
                      : "bg-institucional-whiteSmokeBlack/30 text-gray-700 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Download size={14} />
                  Descargar PDF
                </button>
              </div>
            </div>

            {/* ── Tabla de resultados ── */}
            <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
              <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                <table className="w-full text-xs" id="tabla-reporte">
                  <thead className="sticky top-0 z-20 bg-institucional-green text-base-white">
                    <tr className="bg-institucional-green text-base-white">
                      <th className="sticky left-0 top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold z-30">
                        #
                      </th>
                      <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[80px] z-20">
                        CIU
                      </th>
                      <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[90px] z-20">
                        CÉDULA
                      </th>
                      <th className="sticky left-8 top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[160px] z-30">
                        CONTRIBUYENTE
                      </th>
                      <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[120px] z-20">
                        ACTIVIDAD
                      </th>
                      <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[100px] z-20">
                        NAVE
                      </th>
                      <th className="sticky top-0 bg-institucional-green px-2 py-2.5 text-center font-semibold min-w-[60px] z-20">
                        PUESTO
                      </th>
                      {soloObservaciones ? (
                        <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[320px] z-20">
                          OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS
                        </th>
                      ) : (
                        <>
                          {fechas.map((f) => (
                            <th
                              key={f}
                              className="sticky top-0 bg-institucional-green px-1 py-2.5 text-center font-semibold min-w-[36px] z-20"
                            >
                              {format(new Date(f + "T00:00:00"), "dd")}
                              <br />
                              <span className="font-normal opacity-75">
                                {format(new Date(f + "T00:00:00"), "MMM", {
                                  locale: es,
                                })}
                              </span>
                            </th>
                          ))}
                          {incluirObservaciones && (
                            <th className="sticky top-0 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[150px] z-20">
                              Observaciones
                            </th>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoReporte ? (
                      <tr>
                        <td
                          colSpan={soloObservaciones ? 8 : (7 + fechas.length + (incluirObservaciones ? 1 : 0))}
                          className="px-4 py-12 text-center text-sm text-gray-700"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-6 w-6 rounded-full border-2 border-institucional-green/30 border-t-institucional-green animate-spin" />
                            <span>Generando reporte de asistencia...</span>
                          </div>
                        </td>
                      </tr>
                    ) : reporteFiltrado.length === 0 ? (
                      <tr>
                        <td
                          colSpan={soloObservaciones ? 8 : (7 + fechas.length + (incluirObservaciones ? 1 : 0))}
                          className="px-4 py-12 text-center text-sm text-gray-500"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Search size={24} className="text-gray-400" />
                            <span>No se encontraron comerciantes que coincidan con los criterios de búsqueda.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      reporteFiltrado.map((row, i) => (
                        <tr
                          key={row.comerciante.idInterno}
                          className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                        >
                          <td className="sticky left-0 bg-base-white px-3 py-2 text-gray-700 font-medium z-10">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2 text-sm font-mono font-medium text-acento-azul1">
                            {row.comerciante.ciu}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                            {row.comerciante.cedula}
                          </td>
                          <td className="sticky left-8 bg-base-white px-3 py-2 text-sm font-semibold text-base-eerieBlack z-10">
                            <div className="truncate max-w-[200px]">
                              {row.comerciante.contribuyente}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                            {row.comerciante.actividad}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                            {row.naveNombre}
                          </td>
                          <td className="px-2 py-2 text-center text-sm font-mono font-medium text-base-eerieBlack">
                            {row.puestoCode}
                          </td>
                          {soloObservaciones ? (
                            <td className="px-3 py-2 text-xs font-semibold text-gray-900 leading-relaxed">
                              {row.observaciones || "—"}
                            </td>
                          ) : (
                            <>
                              {row.estados.map((estado, j) => {
                                const config =
                                  ESTADO_COLORES[estado] ?? ESTADO_COLORES["Presente"];
                                return (
                                  <td key={j} className="px-0.5 py-1 text-center">
                                    <span
                                      className={`inline-flex min-h-5 min-w-7 px-1 py-0.5 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                                    >
                                      {ESTADO_LABELS[estado]}
                                    </span>
                                  </td>
                                );
                              })}
                              {incluirObservaciones && (
                                <td className="px-3 py-2 max-w-[200px]">
                                  <span className="line-clamp-2 text-xs font-semibold text-gray-900">
                                    {row.observaciones || "—"}
                                  </span>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Leyenda en el pie de la tarjeta */}
              {!soloObservaciones && (
                <div className="shrink-0 border-t border-institucional-whiteSmokeBlack/15 px-4 py-2.5 bg-base-white flex flex-wrap items-center gap-4 text-xs text-gray-700">
                  <span className="font-semibold text-base-eerieBlack">Leyenda:</span>
                  {Object.entries(ESTADO_LABELS).map(([estado, label]) => {
                    const config = ESTADO_COLORES[estado];
                    if (!config) return null;
                    return (
                      <div key={estado} className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex h-5 w-6 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                        >
                          {label}
                        </span>
                        <span>{estado}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
