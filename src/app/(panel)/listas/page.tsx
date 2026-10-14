"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { naveService } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
import { asistenciaService } from "@/application/services/asistencia.service";
import type { Nave } from "@/domain/models/nave.model";
import type {
  EstadoAsistencia,
  Puesto,
  Comerciante,
} from "@/domain/models/comerciante.model";
import type { RegistroAsistencia } from "@/domain/models/asistencia.model";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronDown,
  Search,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { eachDayOfInterval, format, isToday, isFuture, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ObservacionDialog,
  ComercianteModal,
} from "./components/ModalNovedad";
import {
  PuestosList,
  TreemapView,
} from "./components/TablaAsistencia";

// ── Helper: formatear fecha ──────────────────────────────────────────────────

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Helper: normalizar texto ──────────────────────────────────────────────────

const normalizeText = (text: string) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// ── Página principal de Listas (Orquestador) ──────────────────────────────────

export default function ListasPage() {
  const [naves, setNaves] = useState<Nave[]>([]);
  const [selectedNaveId, setSelectedNaveId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"lista" | "treemap">("lista");
  const [overrides, setOverrides] = useState<Record<string, EstadoAsistencia>>({});

  const [asistenciaDelDia, setAsistenciaDelDia] = useState<RegistroAsistencia[]>([]);
  const [comerciantesMap, setComerciantesMap] = useState<Map<string, Comerciante>>(new Map());
  const [cargando, setCargando] = useState(true);

  // Carga inicial de Naves y Comerciantes
  useEffect(() => {
    let activo = true;
    Promise.all([
      naveService.obtenerNaves(),
      comercianteService.obtenerComerciantes(),
    ]).then(([navesData, comData]) => {
      if (activo) {
        setNaves(navesData);
        const map = new Map<string, Comerciante>();
        comData.forEach((c) => map.set(c.idInterno, c));
        setComerciantesMap(map);
        setCargando(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  const nave = naves.find((n) => n.id === selectedNaveId) ?? null;
  const fechaStr = formatDate(selectedDate);

  // Carga asíncrona de asistencias por fecha
  useEffect(() => {
    let activo = true;
    asistenciaService.obtenerAsistenciaPorFecha(fechaStr).then((datos) => {
      if (activo) {
        setAsistenciaDelDia(datos);
      }
    });
    return () => {
      activo = false;
    };
  }, [fechaStr]);

  // Modal state
  const [modalData, setModalData] = useState<{
    puesto: Puesto;
    comerciante: Comerciante;
    estado: EstadoAsistencia;
  } | null>(null);

  // Observación dialog state
  const [obsDialogOpen, setObsDialogOpen] = useState(false);
  const [obsCommerciante, setObsCommerciante] = useState<Comerciante | null>(null);

  // Estado para confirmación de sobrescritura de Permiso
  const [confirmacionEstado, setConfirmacionEstado] = useState<{
    id: string;
    nuevoEstado: EstadoAsistencia;
    tipoAdvertencia: "Permiso";
  } | null>(null);

  // ── Puestos y Comerciantes de la Nave con estado ───────────────────────────
  const puestosConEstado = !nave
    ? []
    : (() => {
        return (nave.puestos ?? []).map((puesto) => {
          const comerciante = puesto.comercianteId
            ? comerciantesMap.get(puesto.comercianteId) ?? null
            : null;

          let estado: EstadoAsistencia | "Vacante" = "Vacante";
          let registro: RegistroAsistencia | null = null;
          if (puesto.estado === "Ocupado" && comerciante) {
            registro =
              asistenciaDelDia.find(
                (r) => r.comercianteId === comerciante.idInterno
              ) ?? null;
            const overrideKey = `${comerciante.idInterno}:${fechaStr}`;
            if (overrides[overrideKey]) {
              estado = overrides[overrideKey];
            } else {
              estado = registro?.estado ?? "Pendiente";
            }
          }
          return { puesto, comerciante, estado, registro };
        });
      })();

  // ── Filtro Global y Ordenamiento Alfanumérico por Código de Puesto ────────
  const q = normalizeText(searchQuery.trim());
  const filtrados = q
    ? puestosConEstado.filter((item) => {
        if (item.puesto.estado === "Vacante") {
          return normalizeText(item.puesto.codigo).includes(q);
        }
        const c = item.comerciante;
        if (!c) return normalizeText(item.puesto.codigo).includes(q);
        return (
          normalizeText(c.contribuyente).includes(q) ||
          normalizeText(c.ciu).includes(q) ||
          normalizeText(item.puesto.codigo).includes(q)
        );
      })
    : puestosConEstado;

  const comerciantesFiltrados = [...filtrados].sort((a, b) =>
    a.puesto.codigo.localeCompare(b.puesto.codigo, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

  // Días anteriores (excluyendo hoy, para el contenedor con scroll independiente)
  const DIAS_MOSTRADOS = 14;
  const pastDates = useMemo(() => {
    const today = new Date();
    const start = subDays(today, DIAS_MOSTRADOS);
    const end = subDays(today, 1);
    const dates = eachDayOfInterval({ start, end });
    if (!isToday(selectedDate) && !dates.some((d) => formatDate(d) === formatDate(selectedDate))) {
      dates.push(selectedDate);
      dates.sort((a, b) => a.getTime() - b.getTime());
    }
    return dates;
  }, [selectedDate]);

  function selectNave(naveId: string) {
    setSelectedNaveId(naveId);
    setSearchQuery("");
  }

  function goBackToNaves() {
    setSelectedNaveId(null);
    setSearchQuery("");
  }

  async function aplicarCambioEstado(comercianteId: string, estado: EstadoAsistencia) {
    const key = `${comercianteId}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: estado }));
    await asistenciaService.registrarAsistencia(comercianteId, fechaStr, estado);
  }

  async function handleEstadoChange(comercianteId: string, estado: EstadoAsistencia) {
    const puestoActual = puestosConEstado.find(
      (p) => p.comerciante?.idInterno === comercianteId
    );
    const estadoActual = puestoActual?.estado;

    if (
      (estado === "Presente" || estado === "Ausente") &&
      estadoActual === "Permiso"
    ) {
      setConfirmacionEstado({
        id: comercianteId,
        nuevoEstado: estado,
        tipoAdvertencia: "Permiso",
      });
      return;
    }

    await aplicarCambioEstado(comercianteId, estado);
  }

  async function handleConfirmarSobrescritura() {
    if (!confirmacionEstado) return;
    await aplicarCambioEstado(confirmacionEstado.id, confirmacionEstado.nuevoEstado);
    toast.success(`Asistencia registrada como ${confirmacionEstado.nuevoEstado}`);
    setConfirmacionEstado(null);
  }

  function handleOpenModal(puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) {
    setModalData({ puesto, comerciante, estado });
  }

  const recargarAsistencias = async () => {
    const datos = await asistenciaService.obtenerAsistenciaPorFecha(fechaStr);
    setAsistenciaDelDia(datos);
  };

  async function handleAsignarPermisoDirecto(
    comercianteId: string,
    inicio: string,
    fin: string,
    motivo: string = "Permiso concedido"
  ) {
    try {
      await asistenciaService.agregarPermiso(
        comercianteId,
        fechaStr,
        motivo,
        inicio,
        fin
      );

      const startDate = new Date(inicio + "T00:00:00");
      const endDate = new Date(fin + "T00:00:00");
      const current = new Date(startDate);
      const newOverrides = { ...overrides };

      while (current <= endDate) {
        const f = formatDate(current);
        newOverrides[`${comercianteId}:${f}`] = "Permiso";
        current.setDate(current.getDate() + 1);
      }

      setOverrides(newOverrides);
      await recargarAsistencias();
      toast.success("Permiso asignado exitosamente", {
        description: `Vigencia: ${inicio} al ${fin}.`,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al asignar permiso");
    }
  }

  async function handleObservacionSaveDirecto(comercianteId: string, texto: string) {
    try {
      // Requerimiento 1: "Observación" es un metadato aditivo (NO muta el estado principal)
      await asistenciaService.agregarObservacion(comercianteId, fechaStr, texto);
      await recargarAsistencias();
      toast.success("Observación registrada exitosamente", {
        description: "Se ha agregado al historial del comerciante.",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al registrar observación");
    }
  }

  function handlePermisoAsignado(inicio: string, fin: string) {
    if (!modalData) return;
    handleAsignarPermisoDirecto(modalData.comerciante.idInterno, inicio, fin);
    setModalData(null);
  }

  function handleObservacionSave(texto: string) {
    if (!obsCommerciante) return;
    handleObservacionSaveDirecto(obsCommerciante.idInterno, texto);
    setObsDialogOpen(false);
    setObsCommerciante(null);
  }

  function handleNovedadDesdeModal(comercianteId: string, texto: string) {
    handleObservacionSaveDirecto(comercianteId, texto);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 w-full">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Toma de Listas
          </h1>
        </div>

        {/* Selector de fechas */}
        <div
          className="mt-5 flex items-center justify-between gap-4 w-full"
          aria-label="Seleccionar fecha"
        >
          {/* Contenedor izquierdo: pastillas de fechas anteriores */}
          <div className="flex-1 flex items-center overflow-x-auto gap-2 scrollbar-hide py-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {pastDates.map((date) => {
              const dateValue = formatDate(date);
              const isSelected = fechaStr === dateValue;
              const isFutureDate = isFuture(date) && !isToday(date);

              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => !isFutureDate && setSelectedDate(date)}
                  disabled={isFutureDate}
                  aria-pressed={isSelected}
                  className={[
                    "shrink-0 rounded-full px-4 py-2 text-xs font-semibold capitalize transition-all duration-150",
                    isFutureDate
                      ? "bg-institucional-whiteSmokeBlack/10 text-institucional-whiteSmokeBlack/40 cursor-not-allowed"
                      : isSelected
                        ? "bg-institucional-green text-base-white shadow-sm font-bold"
                        : "bg-base-white text-gray-700 ring-1 ring-institucional-whiteSmokeBlack/20 hover:text-institucional-green hover:bg-base-white/80",
                  ].join(" ")}
                >
                  {format(date, "EEE, d 'de' MMM", { locale: es })}
                </button>
              );
            })}
          </div>

          {/* Contenedor derecho: botones fijos de acción ("Hoy" y DatePicker) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              aria-pressed={isToday(selectedDate)}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold capitalize transition-all duration-150",
                isToday(selectedDate)
                  ? "bg-institucional-green text-base-white shadow-md font-bold ring-2 ring-institucional-green/30"
                  : "bg-base-white text-gray-700 ring-1 ring-institucional-whiteSmokeBlack/20 hover:text-institucional-green hover:bg-base-white/80",
              ].join(" ")}
            >
              Hoy
            </button>

            {/* Calendar popover */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-white text-gray-700 ring-1 ring-institucional-whiteSmokeBlack/20 transition-colors hover:text-institucional-green hover:ring-institucional-green/40 shadow-sm"
                aria-label="Seleccionar otra fecha"
              >
                <CalendarIcon size={16} strokeWidth={2} aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => isFuture(date) && !isToday(date)}
                  locale={es}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Barra de búsqueda + toggle vista */}
        {nave && (
          <div className="mt-4 flex w-full items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, CIU o puesto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full flex-1 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-10 pr-4 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
              />
            </div>

            {/* Toggle vista */}
            <button
              type="button"
              onClick={() =>
                setViewMode((v) => (v === "lista" ? "treemap" : "lista"))
              }
              className="flex shrink-0 whitespace-nowrap items-center gap-2 rounded-lg bg-base-white px-3 sm:px-4 py-2.5 text-xs font-semibold text-base-eerieBlack ring-1 ring-institucional-whiteSmokeBlack/20 transition-colors hover:ring-institucional-green/40"
            >
              {viewMode === "lista" ? (
                <ToggleLeft size={18} className="text-institucional-green shrink-0" />
              ) : (
                <ToggleRight size={18} className="text-institucional-green shrink-0" />
              )}
              <span>{viewMode === "lista" ? "Vista Lista" : "Mapa de Árbol"}</span>
            </button>
          </div>
        )}
      </header>

      <div className="w-full flex flex-col gap-4">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium text-gray-600">Cargando listas de asistencia...</span>
          </div>
        ) : !nave ? (
          /* ── Selección de nave ── */
          naves.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNave(item.id)}
              className="flex items-center gap-4 rounded-2xl bg-base-white p-5 text-left shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all hover:-translate-y-0.5 hover:ring-institucional-green/50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-institucional-green/10 text-institucional-green">
                <Building2 size={24} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-base-eerieBlack">
                  {item.nombre}
                </span>
                <span className="text-sm text-gray-700 font-medium">
                  {item.limitePuestos} puestos
                </span>
              </span>
              <ChevronDown
                className="-rotate-90 text-institucional-green"
                size={20}
                aria-hidden="true"
              />
            </button>
          ))
        ) : (
          /* ── Vista de nave seleccionada ── */
          <section aria-labelledby={`nave-${nave.id}`}>
            {/* Encabezado unificado */}
            <div className="flex items-center justify-between w-full mb-4">
              <button
                type="button"
                onClick={goBackToNaves}
                className="inline-flex items-center gap-2 text-sm font-semibold text-institucional-green hover:underline"
              >
                <ArrowLeft size={18} aria-hidden="true" />
                Volver a naves
              </button>

              <div className="flex items-center gap-2 font-semibold text-lg text-base-eerieBlack">
                <Building2 size={20} className="text-institucional-green" aria-hidden="true" />
                <h2 id={`nave-${nave.id}`}>{nave.nombre}</h2>
              </div>
            </div>

            {viewMode === "lista" ? (
              <div className="flex flex-col gap-3">
                <PuestosList
                  items={comerciantesFiltrados}
                  fecha={fechaStr}
                  onEstadoChange={handleEstadoChange}
                  onOpenModal={handleOpenModal}
                  onObservacionGuardada={handleObservacionSaveDirecto}
                  onPermisoAsignado={handleAsignarPermisoDirecto}
                  onActualizarAsistencia={recargarAsistencias}
                />
              </div>
            ) : (
              <TreemapView
                items={comerciantesFiltrados}
                onOpenModal={handleOpenModal}
              />
            )}
          </section>
        )}
      </div>

      {/* Modal de detalle */}
      {modalData && (
        <ComercianteModal
          comerciante={modalData.comerciante}
          puesto={modalData.puesto}
          estado={modalData.estado}
          fecha={fechaStr}
          onClose={() => setModalData(null)}
          onPermisoAsignado={handlePermisoAsignado}
          onNovedadGuardada={handleNovedadDesdeModal}
          onEstadoChange={(e) => {
            handleEstadoChange(modalData.comerciante.idInterno, e);
            setModalData((prev) => (prev ? { ...prev, estado: e } : null));
          }}
        />
      )}

      {/* Dialog de Observación */}
      <ObservacionDialog
        open={obsDialogOpen}
        comerciante={obsCommerciante}
        onClose={() => {
          setObsDialogOpen(false);
          setObsCommerciante(null);
        }}
        onSave={handleObservacionSave}
      />

      {/* Modal de Confirmación de Sobrescritura de Estado */}
      <Dialog
        open={Boolean(confirmacionEstado)}
        disablePointerDismissal={true}
        onOpenChange={(open) => {
          if (!open) setConfirmacionEstado(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-base-eerieBlack">
              <AlertTriangle className="h-5 w-5 text-acento-amarillo1 shrink-0" />
              Confirmar cambio de asistencia
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-700 font-medium pt-2 leading-relaxed">
              Este comerciante tiene un Permiso activo. ¿Está seguro de que desea sobrescribirlo y marcarlo como {confirmacionEstado?.nuevoEstado} para el día de hoy?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmacionEstado(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-institucional-green hover:bg-institucional-green/90 text-white font-medium"
              onClick={handleConfirmarSobrescritura}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
