"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Search,
  X,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, eachDayOfInterval, startOfDay, endOfDay, parseISO, subDays } from "date-fns";
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
  normalizeText,
  formatearNovedadesReporte,
  exportarReporteAsistenciaPDF,
  compararCodigosPuesto,
  type ReporteItem,
  type EstadoReporteCelda,
} from "./components/reportes-pdf.utils";
import { exportarReporteAsistenciaExcel } from "./components/reportes-excel.utils";
import { ReportesTabla } from "./components/ReportesTabla";

// ── Página de Reportes ───────────────────────────────────────────────────────

export default function ReportesPage() {
  const { user } = useAuth();
  const [allNaves, setAllNaves] = useState<Nave[]>([]);
  const [todosLosComerciantes, setTodosLosComerciantes] = useState<Comerciante[]>([]);
  const [asistenciaData, setAsistenciaData] = useState<RegistroAsistencia[]>([]);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const [selectedNaveId, setSelectedNaveId] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [incluirObservaciones, setIncluirObservaciones] = useState(true);
  const [soloObservaciones, setSoloObservaciones] = useState(false);

  const [reglasNoLaborables, setReglasNoLaborables] = useState<
    Array<{
      id: string;
      motivo: string;
      tipoRegla: string;
      fechaInicio: string;
      fechaFin: string;
      diasSemana?: number[];
      aplicaTodasNaves: boolean;
      navesIds?: string[];
      fechasExpandidas: string[];
    }>
  >([]);

  // Límites dinámicos de fechas obtenidos de la base de datos
  const [limites, setLimites] = useState<{ minFecha: string; maxFecha: string; hoy: string }>({
    minFecha: format(new Date(), "yyyy-MM-dd"),
    maxFecha: format(new Date(), "yyyy-MM-dd"),
    hoy: format(new Date(), "yyyy-MM-dd"),
  });

  // Estados para fechas independientes: inicializados en hoy
  const [fechaInicioDate, setFechaInicioDate] = useState<Date | undefined>(() => new Date());
  const [fechaFinDate, setFechaFinDate] = useState<Date | undefined>(() => new Date());
  const [openInicio, setOpenInicio] = useState(false);
  const [openFin, setOpenFin] = useState(false);

  const fechaInicio = fechaInicioDate ? format(fechaInicioDate, "yyyy-MM-dd") : "";
  const fechaFin = fechaFinDate ? format(fechaFinDate, "yyyy-MM-dd") : "";

  // Cargar límites de fechas reales de la base de datos
  useEffect(() => {
    let activo = true;
    fetch("/api/v1/asistencia?meta=limites")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!activo || !data) return;
        const hoyStr = data.hoy || format(new Date(), "yyyy-MM-dd");
        const minFechaStr = data.minFecha || hoyStr;
        const maxFechaStr = data.maxFecha || hoyStr;

        setLimites({
          minFecha: minFechaStr,
          maxFecha: maxFechaStr,
          hoy: hoyStr,
        });

        const hace15Dias = subDays(parseISO(hoyStr), 15);
        const minFechaBD = startOfDay(parseISO(minFechaStr));

        if (hace15Dias < minFechaBD) {
          setFechaInicioDate(minFechaBD);
        } else {
          setFechaInicioDate(hace15Dias);
        }
        setFechaFinDate(parseISO(hoyStr));
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

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

  // Carga de reglas de días no laborables
  useEffect(() => {
    let activo = true;
    fetch("/api/v1/auditoria/dias-no-laborables")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!activo || !data?.reglas) return;
        setReglasNoLaborables(data.reglas);
      })
      .catch(() => {});
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

  // Fechas reales registradas en la base de datos o el día de hoy
  const fechasConRegistros = useMemo(() => {
    const s = new Set<string>();
    asistenciaData.forEach((r) => s.add(r.fecha));
    s.add(limites.hoy);
    return s;
  }, [asistenciaData, limites.hoy]);

  // Rango de fechas filtrado estrictamente: omitiendo días no laborables
  const fechas = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];
    try {
      const allDays = eachDayOfInterval({
        start: new Date(fechaInicio + "T00:00:00"),
        end: new Date(fechaFin + "T00:00:00"),
      }).map((d) => format(d, "yyyy-MM-dd"));

      return allDays.filter((f) => {
        if (f < limites.minFecha || f > limites.hoy || !fechasConRegistros.has(f)) {
          return false;
        }

        // Si hay una nave específica seleccionada: omitir si es día no laborable en esa nave
        if (selectedNaveId && selectedNaveId !== "todas") {
          const esNoLab = reglasNoLaborables.some((r) => {
            const fechasExp = Array.isArray(r.fechasExpandidas) ? (r.fechasExpandidas as string[]) : [];
            if (!fechasExp.includes(f)) return false;
            if (r.aplicaTodasNaves) return true;
            const nIds = Array.isArray(r.navesIds) ? (r.navesIds as string[]) : [];
            return nIds.includes(selectedNaveId);
          });
          if (esNoLab) return false;
        } else {
          // Si selectedNaveId === "todas": omitir si es día no laborable global
          const esNoLabGlobal = reglasNoLaborables.some((r) => {
            const fechasExp = Array.isArray(r.fechasExpandidas) ? (r.fechasExpandidas as string[]) : [];
            return r.aplicaTodasNaves && fechasExp.includes(f);
          });
          if (esNoLabGlobal) return false;
        }

        return true;
      });
    } catch {
      return [];
    }
  }, [fechaInicio, fechaFin, limites.minFecha, limites.hoy, fechasConRegistros, selectedNaveId, reglasNoLaborables]);

  // Carga asíncrona de datos de asistencia
  useEffect(() => {
    let activo = true;
    if (!fechaInicio || !fechaFin) {
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
  }, [selectedNaveId, fechaInicio, fechaFin]);

  // Filtro combinado: Nave + Buscador + Inclusión de Vacantes al Inicio
  const reporteFiltrado = useMemo<ReporteItem[]>(() => {
    const registrosMap = new Map<string, RegistroAsistencia[]>();
    asistenciaData.forEach((r) => {
      const list = registrosMap.get(r.comercianteId) || [];
      list.push(r);
      registrosMap.set(r.comercianteId, list);
    });

    const q = normalizeText(searchQuery.trim());

    // 1. Comerciantes ocupados
    const filtrados = todosLosComerciantes
      .map((com) => {
        const info = comerciantePuestoMap.get(com.idInterno);
        const naveId = info?.naveId ?? "";
        const naveNombre = info?.naveNombre ?? com.nave ?? "—";
        const puestoCode = info?.puestoCode ?? "—";

        // RBAC: solo naves permitidas para supervisores
        if (user?.rol === "SUPERVISOR") {
          const naveObj = allNaves.find(
            (n) => n.id === naveId || n.nombre.toUpperCase() === naveNombre.toUpperCase()
          );
          const esPermitida = naveObj
            ? esNavePermitidaParaUsuario(naveObj, user)
            : navesPermitidasIds.has(naveId);
          if (!esPermitida) return null;
        }

        // Filtro de Nave seleccionada
        if (selectedNaveId && selectedNaveId !== "todas") {
          if (naveId !== selectedNaveId) return null;
        }

        // Filtro de Buscador (apellidos, nombres o cédula)
        if (q) {
          const matchContribuyente = normalizeText(com.contribuyente).includes(q);
          const matchCedula = normalizeText(com.cedula).includes(q);
          const matchCiu = normalizeText(com.ciu).includes(q);
          const matchPuesto = normalizeText(puestoCode).includes(q);
          if (!matchContribuyente && !matchCedula && !matchCiu && !matchPuesto) {
            return null;
          }
        }

        const comRegistros = registrosMap.get(com.idInterno) || [];
        const regFechaMap = new Map<string, RegistroAsistencia>();
        comRegistros.forEach((r) => regFechaMap.set(r.fecha, r));

        const estados: EstadoReporteCelda[] = fechas.map((f) => {
          const reg = regFechaMap.get(f);
          if (reg) {
            // Detección de "Justificado" (J)
            if (reg.estado === "Permiso") {
              const regexJust = /justificaci[oó]n de falta|falta justificada/i;
              const obsMatch = regexJust.test(reg.observacion || "");
              const obsListMatch = reg.observaciones?.some((o) => regexJust.test(o.texto));
              const permMatch = reg.permisos?.some((p) => regexJust.test(p.motivo || ""));
              const vigMatch = comRegistros.some((cr) =>
                cr.permisos?.some(
                  (p) => regexJust.test(p.motivo || "") && f >= p.fechaInicio && f <= p.fechaFin
                )
              );

              if (obsMatch || obsListMatch || permMatch || vigMatch) {
                return "Justificado";
              }
              return "Permiso";
            }
            return reg.estado as EstadoReporteCelda;
          }

          // Si la nave específica tuvo día no laborable en fecha f, mostrar "—"
          if (naveId) {
            const esNoLabNave = reglasNoLaborables.some((r) => {
              const fechasExp = Array.isArray(r.fechasExpandidas) ? (r.fechasExpandidas as string[]) : [];
              if (!fechasExp.includes(f)) return false;
              if (r.aplicaTodasNaves) return true;
              const nIds = Array.isArray(r.navesIds) ? (r.navesIds as string[]) : [];
              return nIds.includes(naveId);
            });
            if (esNoLabNave) {
              return "—";
            }
          }

          return f === limites.hoy ? "Presente" : "Ausente";
        });

        const observaciones = formatearNovedadesReporte(comRegistros);

        return {
          comerciante: com,
          puestoCode,
          naveNombre,
          naveId,
          estados,
          observaciones,
          esVacante: false,
        };
      })
      .filter(Boolean) as ReporteItem[];

    // 2. Puestos vacantes por nave (solo si !soloObservaciones)
    const itemsVacantes: ReporteItem[] = [];
    if (!soloObservaciones) {
      const navesParaVacantes =
        selectedNaveId && selectedNaveId !== "todas"
          ? naves.filter((n) => n.id === selectedNaveId)
          : naves;

      navesParaVacantes.forEach((nave) => {
        if (!nave.puestos) return;
        nave.puestos.forEach((p) => {
          const esPuestoVacante = p.estado === "Vacante" || !p.comercianteId;
          if (!esPuestoVacante) return;

          if (q) {
            const matchPuesto = normalizeText(p.codigo).includes(q);
            const matchNave = normalizeText(nave.nombre).includes(q);
            const matchPalabraVacante = "vacante".includes(q);
            if (!matchPuesto && !matchNave && !matchPalabraVacante) {
              return;
            }
          }

          const estados: EstadoReporteCelda[] = fechas.map((f) => {
            const esNoLabNave = reglasNoLaborables.some((r) => {
              const fechasExp = Array.isArray(r.fechasExpandidas) ? (r.fechasExpandidas as string[]) : [];
              if (!fechasExp.includes(f)) return false;
              if (r.aplicaTodasNaves) return true;
              const nIds = Array.isArray(r.navesIds) ? (r.navesIds as string[]) : [];
              return nIds.includes(nave.id);
            });
            if (esNoLabNave) return "—";
            return "Vacante";
          });

          itemsVacantes.push({
            esVacante: true,
            comerciante: {
              idInterno: `vacante-${nave.id}-${p.id}`,
              ciu: "-",
              cedula: "-",
              contribuyente: "-",
              actividad: "-",
              puestoId: p.codigo,
              nave: nave.nombre,
              estadoRegistro: "Habilitado",
            },
            puestoCode: p.codigo,
            naveNombre: nave.nombre,
            naveId: nave.id,
            estados,
            observaciones: "",
          });
        });
      });
    }

    let resultado = [...itemsVacantes, ...filtrados];

    if (soloObservaciones) {
      resultado = resultado.filter((row) => row.observaciones.trim().length > 0);
    }

    // Ordenamiento obligatorio:
    // Puestos vacantes en la parte superior de cada nave, correlativos por puestoCode
    return resultado.sort((a, b) => {
      if (a.naveNombre !== b.naveNombre) {
        const compNave = a.naveNombre.localeCompare(b.naveNombre, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (compNave !== 0) return compNave;
      }
      if (a.esVacante && !b.esVacante) return -1;
      if (!a.esVacante && b.esVacante) return 1;
      return compararCodigosPuesto(a.puestoCode, b.puestoCode);
    });
  }, [
    allNaves,
    todosLosComerciantes,
    asistenciaData,
    comerciantePuestoMap,
    user,
    naves,
    navesPermitidasIds,
    selectedNaveId,
    searchQuery,
    fechas,
    soloObservaciones,
    limites.hoy,
    reglasNoLaborables,
  ]);

  const hayDatos = reporteFiltrado.length > 0;

  // ── Exportación a PDF y Excel ──────────────────────────────────────────────

  async function handleDescargarPDF() {
    if (!hayDatos || exportandoPDF) return;
    setExportandoPDF(true);
    try {
      await exportarReporteAsistenciaPDF({
        reporteFiltrado,
        fechas,
        fechaInicio,
        fechaFin,
        soloObservaciones,
        incluirObservaciones,
        navesDisponibles: naves,
        reglasNoLaborables,
      });
    } finally {
      setExportandoPDF(false);
    }
  }

  async function handleDescargarExcel() {
    if (!hayDatos || exportandoExcel) return;
    setExportandoExcel(true);
    try {
      await exportarReporteAsistenciaExcel({
        reporteFiltrado,
        fechas,
        fechaInicio,
        fechaFin,
        soloObservaciones,
        incluirObservaciones,
        navesDisponibles: naves,
        reglasNoLaborables,
      });
    } finally {
      setExportandoExcel(false);
    }
  }

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
                <div className="flex flex-col gap-1.5 w-full md:flex-1 md:min-w-[220px]">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Buscar Comerciante / Puesto
                  </label>
                  <div className="relative w-full">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <Input
                      type="text"
                      placeholder="Buscar por apellidos, nombres, cédula o puesto..."
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
                        disabled={(date) => {
                          const minD = limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date());
                          return date > endOfDay(new Date()) || date < minD;
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
                        disabled={(date) => {
                          const minD = fechaInicioDate
                            ? startOfDay(fechaInicioDate)
                            : (limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date()));
                          return date > endOfDay(new Date()) || date < minD;
                        }}
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
                      className={`text-xs font-semibold uppercase tracking-wider cursor-pointer select-none ${
                        soloObservaciones ? "text-gray-400" : "text-gray-700"
                      }`}
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

                {/* Botones de Descarga: PDF y Excel */}
                <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                  <button
                    type="button"
                    onClick={handleDescargarPDF}
                    disabled={!hayDatos || exportandoPDF}
                    className={[
                      "flex items-center justify-center gap-2 h-9 rounded-lg px-4 text-xs font-semibold shadow-sm transition-colors cursor-pointer",
                      hayDatos && !exportandoPDF
                        ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2"
                        : "bg-institucional-whiteSmokeBlack/30 text-gray-500 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {exportandoPDF ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Descargar PDF
                  </button>

                  <button
                    type="button"
                    onClick={handleDescargarExcel}
                    disabled={!hayDatos || exportandoExcel}
                    className={[
                      "flex items-center justify-center gap-2 h-9 rounded-lg px-4 text-xs font-semibold shadow-sm transition-colors cursor-pointer",
                      hayDatos && !exportandoExcel
                        ? "bg-emerald-800 text-base-white hover:bg-emerald-900 active:bg-emerald-950"
                        : "bg-institucional-whiteSmokeBlack/30 text-gray-500 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {exportandoExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                    Descargar Excel
                  </button>
                </div>
              </div>
            </div>

            {/* ── Tabla Modular de Reportes ── */}
            <ReportesTabla
              reporteFiltrado={reporteFiltrado}
              fechas={fechas}
              soloObservaciones={soloObservaciones}
              incluirObservaciones={incluirObservaciones}
              cargandoReporte={cargandoReporte}
            />
          </>
        )}
      </div>
    </div>
  );
}
