"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { format, eachDayOfInterval, startOfDay, parseISO, subDays } from "date-fns";
import { useAuth } from "@/application/services/auth.service";
import { naveService, esNavePermitidaParaUsuario } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
import { asistenciaService } from "@/application/services/asistencia.service";
import type { Nave } from "@/domain/models/nave.model";
import type {
  Comerciante,
  RegistroAsistencia,
} from "@/domain/models/comerciante.model";

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
import { ReportesFiltros } from "./components/ReportesFiltros";

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
        const naveEncontrada = !info
          ? allNaves.find(
              (n) =>
                n.nombre.trim().toUpperCase() === (com.nave || "").trim().toUpperCase() ||
                n.id.trim().toLowerCase() === (com.nave || "").trim().toLowerCase()
            )
          : undefined;
        const naveId = info?.naveId || naveEncontrada?.id || (com.nave || "sin-nave").trim().toLowerCase();
        const naveNombre =
          info?.naveNombre || naveEncontrada?.nombre || com.nave?.trim().toUpperCase() || "SIN NAVE";
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
            {/* ── Controles Unificados (Modularizado) ── */}
            <ReportesFiltros
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedNaveId={selectedNaveId}
              setSelectedNaveId={setSelectedNaveId}
              naves={naves}
              fechaInicioDate={fechaInicioDate}
              setFechaInicioDate={setFechaInicioDate}
              fechaFinDate={fechaFinDate}
              setFechaFinDate={setFechaFinDate}
              openInicio={openInicio}
              setOpenInicio={setOpenInicio}
              openFin={openFin}
              setOpenFin={setOpenFin}
              limites={limites}
              incluirObservaciones={incluirObservaciones}
              setIncluirObservaciones={setIncluirObservaciones}
              soloObservaciones={soloObservaciones}
              setSoloObservaciones={setSoloObservaciones}
              hayDatos={hayDatos}
              exportandoPDF={exportandoPDF}
              exportandoExcel={exportandoExcel}
              onDescargarPDF={handleDescargarPDF}
              onDescargarExcel={handleDescargarExcel}
            />

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
