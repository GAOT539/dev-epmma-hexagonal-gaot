"use client";

import { useMemo, useState } from "react";
import {
  ScrollText,
  Search,
  Calendar as CalendarIcon,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getLogsFiltrados } from "@/infrastructure/mocks/auditoria.mock";
import { getUsuarios } from "@/infrastructure/mocks/auth.mock";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

// ── Colores por tipo de acción ───────────────────────────────────────────────

const ACCION_COLORES: Record<string, { bg: string; text: string }> = {
  LOGIN: { bg: "bg-acento-verdeOliva1/15", text: "text-acento-verdeOliva1" },
  LOGOUT: { bg: "bg-institucional-whiteSmokeBlack/15", text: "text-institucional-whiteSmokeBlack" },
  CAMBIO_ESTADO: { bg: "bg-acento-azul1/15", text: "text-acento-azul1" },
  IMPORTACION_XML: { bg: "bg-acento-morado/15", text: "text-acento-morado" },
  CAMBIO_CONTRASEÑA: { bg: "bg-acento-naranjaSalmon1/15", text: "text-acento-naranjaSalmon1" },
  ASIGNACION_PERMISO: { bg: "bg-acento-morado/15", text: "text-acento-morado" },
  MODIFICACION_PUESTO: { bg: "bg-acento-azul1/15", text: "text-acento-azul1" },
  CONSULTA_REPORTE: { bg: "bg-institucional-green/15", text: "text-institucional-green" },
  EXPORTACION_PDF: { bg: "bg-institucional-green/15", text: "text-institucional-green" },
  CONFIGURACION_ACTUALIZADA: { bg: "bg-acento-naranjaSalmon1/15", text: "text-acento-naranjaSalmon1" },
};

const ITEMS_POR_PAGINA = 12;

// ── Página de Auditoría ──────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const usuarios = getUsuarios();

  const [busqueda, setBusqueda] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [pagina, setPagina] = useState(1);

  // DateRangePicker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const fechaDesde = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const fechaHasta = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  // Obtener logs filtrados
  const logs = useMemo(() => {
    return getLogsFiltrados({
      busqueda: busqueda || undefined,
      usuarioId: filtroUsuario || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
    });
  }, [busqueda, filtroUsuario, fechaDesde, fechaHasta]);

  // Paginación
  const totalPaginas = Math.ceil(logs.length / ITEMS_POR_PAGINA);
  const logsPaginados = logs.slice(
    (pagina - 1) * ITEMS_POR_PAGINA,
    pagina * ITEMS_POR_PAGINA
  );

  function handleBusquedaChange(value: string) {
    setBusqueda(value);
    setPagina(1);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <ScrollText size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Auditoría del Sistema
          </h1>
        </div>
        <p className="mt-2 text-sm text-institucional-whiteSmokeBlack">
          Registro de todas las acciones realizadas en el sistema.
        </p>
      </header>

      <div className="mx-auto max-w-5xl space-y-4">
        {/* ── Filtros ── */}
        <div className="rounded-2xl bg-base-white p-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
          <div className="flex flex-wrap items-end gap-3">
            {/* Búsqueda */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-semibold text-institucional-whiteSmokeBlack uppercase tracking-wider">
                Buscar
              </label>
              <div className="relative mt-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-institucional-whiteSmokeBlack"
                />
                <input
                  type="text"
                  placeholder="Buscar en acciones, detalles o usuarios..."
                  value={busqueda}
                  onChange={(e) => handleBusquedaChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                />
              </div>
            </div>

            {/* Filtro por usuario */}
            <div>
              <label className="text-[10px] font-semibold text-institucional-whiteSmokeBlack uppercase tracking-wider">
                Usuario
              </label>
              <select
                value={filtroUsuario}
                onChange={(e) => {
                  setFiltroUsuario(e.target.value);
                  setPagina(1);
                }}
                className="mt-1 h-9 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 pr-8 text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombres} {u.apellidos}
                  </option>
                ))}
              </select>
            </div>

            {/* DateRangePicker */}
            <div>
              <label className="text-[10px] font-semibold text-institucional-whiteSmokeBlack uppercase tracking-wider">
                Rango de Fechas
              </label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger
                    className="mt-1 h-9 inline-flex items-center justify-start gap-1.5 rounded-lg border border-border bg-background px-2.5 text-left text-sm font-normal min-w-[220px] hover:bg-muted transition-all outline-none"
                  >
                    <CalendarIcon size={14} className="mr-2 text-institucional-whiteSmokeBlack" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy")} –{" "}
                          {format(dateRange.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span className="text-institucional-whiteSmokeBlack">
                        Todas las fechas
                      </span>
                    )}
                  </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      setPagina(1);
                      if (range?.from && range?.to) {
                        setDatePickerOpen(false);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    numberOfMonths={2}
                    locale={es}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ── Tabla de logs ── */}
        <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
          {/* Header de la tabla */}
          <div className="px-5 py-3 border-b border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
            <p className="text-xs font-medium text-institucional-whiteSmokeBlack">
              {logs.length} registros encontrados
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-institucional-green/5">
                  <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                    Fecha / Hora
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack min-w-[130px]">
                    Usuario
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack min-w-[140px]">
                    Acción
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {logsPaginados.map((log) => {
                  const accionColor =
                    ACCION_COLORES[log.accion] ?? {
                      bg: "bg-institucional-whiteSmokeBlack/10",
                      text: "text-institucional-whiteSmokeBlack",
                    };
                  return (
                    <tr
                      key={log.id}
                      className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-base-eerieBlack">
                        <p className="font-medium">
                          {format(new Date(log.timestamp), "dd/MM/yyyy")}
                        </p>
                        <p className="text-[10px] text-institucional-whiteSmokeBlack">
                          {format(new Date(log.timestamp), "HH:mm:ss")}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green">
                            <User size={12} />
                          </div>
                          <span className="font-medium text-base-eerieBlack truncate max-w-[120px]">
                            {log.usuarioNombre}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${accionColor.bg} ${accionColor.text}`}
                        >
                          {log.accion.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-institucional-whiteSmokeBlack max-w-[300px]">
                        <span className="line-clamp-2">{log.detalle}</span>
                      </td>
                    </tr>
                  );
                })}

                {logsPaginados.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-institucional-whiteSmokeBlack"
                    >
                      No se encontraron registros con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="px-5 py-3 border-t border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
              <p className="text-xs text-institucional-whiteSmokeBlack">
                Página {pagina} de {totalPaginas}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => setPagina(pagina - 1)}
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
                  onClick={() => setPagina(pagina + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base-eerieBlack transition-colors hover:bg-institucional-green/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
