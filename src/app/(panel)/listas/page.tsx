"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getNaves,
  getPuestosPorSector,
  getComerciantePorId,
  getAsistenciaPorFecha,
  setEstadoAsistencia,
  setPermisoComercianteRango,
  getAsistenciaComerciantePorFecha,
} from "@/infrastructure/mocks/mercado.mock";
import type {
  EstadoAsistencia,
  Nave,
  Puesto,
  Comerciante,
  Sector,
  RegistroAsistencia,
} from "@/domain/models/comerciante.model";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye as EyeIcon,
  MessageSquareWarning,
  Search,
  ShieldAlert,
  Tag,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
  Edit3,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addDays, format, isToday, isFuture, subDays } from "date-fns";
import { es } from "date-fns/locale";

// ── Colores por estado ───────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<
  EstadoAsistencia | "Vacante",
  { bg: string; text: string; ring: string; label: string }
> = {
  Presente: {
    bg: "bg-acento-verdeOliva1/15",
    text: "text-acento-verdeOliva1",
    ring: "ring-acento-verdeOliva1/30",
    label: "Presente",
  },
  Ausente: {
    bg: "bg-base-red/10",
    text: "text-base-red",
    ring: "ring-base-red/30",
    label: "Ausente",
  },
  Novedad: {
    bg: "bg-acento-naranjaSalmon1/15",
    text: "text-acento-naranjaSalmon1",
    ring: "ring-acento-naranjaSalmon1/30",
    label: "Novedad",
  },
  Observacion: {
    bg: "bg-acento-azul1/15",
    text: "text-acento-azul1",
    ring: "ring-acento-azul1/30",
    label: "Observación",
  },
  Permiso: {
    bg: "bg-acento-morado/15",
    text: "text-acento-morado",
    ring: "ring-acento-morado/30",
    label: "Permiso",
  },
  Pendiente: {
    bg: "bg-institucional-whiteSmokeBlack/15",
    text: "text-institucional-whiteSmokeBlack",
    ring: "ring-institucional-whiteSmokeBlack/30",
    label: "Pendiente",
  },
  Vacante: {
    bg: "bg-institucional-whiteSmokeBlack/10",
    text: "text-institucional-whiteSmokeBlack",
    ring: "ring-institucional-whiteSmokeBlack/20",
    label: "Vacante",
  },
};

// ── Orden de prioridad de estados ────────────────────────────────────────────

const ESTADO_PRIORIDAD: Record<string, number> = {
  Ausente: 0,
  Observacion: 1,
  Novedad: 2,
  Permiso: 3,
  Pendiente: 4,
  Presente: 5,
};

// ── Helper: formatear fecha ──────────────────────────────────────────────────

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Botón de acción de estado ────────────────────────────────────────────────

function AccionBtn({
  label,
  Icon,
  colorClasses,
  isActive,
  onClick,
  disabled,
}: {
  label: string;
  Icon: React.ElementType;
  colorClasses: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={[
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
        "transition-all duration-150 active:scale-95",
        disabled ? "opacity-40 cursor-not-allowed" : "",
        isActive
          ? colorClasses.replace(/\/15/g, "").replace(/\/10/g, "") +
            " text-base-white shadow-sm"
          : colorClasses,
      ].join(" ")}
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </button>
  );
}

// ── Modal de Observación (textarea) ──────────────────────────────────────────

function ObservacionDialog({
  open,
  comerciante,
  onClose,
  onSave,
}: {
  open: boolean;
  comerciante: Comerciante | null;
  onClose: () => void;
  onSave: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  function handleSave() {
    if (!texto.trim()) return;
    onSave(texto.trim());
    setTexto("");
  }

  function handleClose() {
    setTexto("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-acento-naranjaSalmon1">
            <MessageSquareWarning size={20} />
            Registrar Observación
          </DialogTitle>
          <DialogDescription>
            {comerciante
              ? `Ingrese el detalle de la observación para ${comerciante.nombres} ${comerciante.apellidos} (${comerciante.ciu}).`
              : "Ingrese el detalle de la observación."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describa la novedad o situación observada..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!texto.trim()}
            className="bg-acento-naranjaSalmon1 text-base-white hover:bg-acento-naranjaSalmon2"
          >
            Guardar como Novedad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de detalle del comerciante ─────────────────────────────────────────

function ComercianteModal({
  comerciante,
  puesto,
  estado,
  fecha,
  onClose,
  onPermisoAsignado,
  onNovedadGuardada,
}: {
  comerciante: Comerciante;
  puesto: Puesto;
  estado: EstadoAsistencia;
  fecha: string;
  onClose: () => void;
  onPermisoAsignado: (inicio: string, fin: string) => void;
  onNovedadGuardada: (comercianteId: string, texto: string) => void;
}) {
  const [permisoInicio, setPermisoInicio] = useState("");
  const [permisoFin, setPermisoFin] = useState("");
  const [error, setError] = useState("");
  const [novedadTexto, setNovedadTexto] = useState("");
  const [editandoPermiso, setEditandoPermiso] = useState(false);

  const estadoConfig = ESTADO_CONFIG[estado];
  const isPermiso = estado === "Permiso";

  // Obtener registro actual para fechas de permiso
  const registroActual = getAsistenciaComerciantePorFecha(
    comerciante.idInterno,
    fecha
  );

  // Obtener observación del día anterior (si existe)
  const fechaAyer = formatDate(subDays(new Date(fecha + "T00:00:00"), 1));
  const registroAyer = getAsistenciaComerciantePorFecha(
    comerciante.idInterno,
    fechaAyer
  );
  const observacionAnterior =
    registroAyer?.estado === "Novedad" ? registroAyer.observacionTexto : null;

  function handleAsignarPermiso() {
    setError("");
    if (!permisoInicio || !permisoFin) {
      setError("Debe seleccionar fecha de inicio y fin.");
      return;
    }
    if (permisoInicio > permisoFin) {
      setError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }
    onPermisoAsignado(permisoInicio, permisoFin);
  }

  function handleGuardarNovedad() {
    if (!novedadTexto.trim()) return;
    onNovedadGuardada(comerciante.idInterno, novedadTexto.trim());
    setNovedadTexto("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-base-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-institucional-green px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-white/20 text-base-white font-bold text-lg">
              {comerciante.nombres.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-base-white">
                {comerciante.nombres} {comerciante.apellidos}
              </h2>
              <p className="text-sm text-base-white/80">CIU: {comerciante.ciu}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-base-white/10 text-base-white hover:bg-base-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="px-6 py-5 space-y-4">
          {/* Info del comerciante */}
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="Cédula" value={comerciante.cedula} />
            <InfoItem label="CIU" value={comerciante.ciu} />
            <InfoItem label="Actividad" value={comerciante.actividad} />
            <InfoItem label="Puesto" value={puesto.codigo} />
            <InfoItem label="Nave" value={puesto.naveId.replace("nave-", "Nave ").toUpperCase()} />
            <InfoItem label="Fecha" value={fecha} />
          </div>

          {/* Estado actual */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium text-institucional-whiteSmokeBlack">Estado:</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${estadoConfig.bg} ${estadoConfig.text}`}
            >
              {estadoConfig.label}
            </span>
            {isPermiso && (
              <span className="text-[10px] text-acento-morado font-medium">
                (Bloqueado por permiso activo)
              </span>
            )}
          </div>

          {/* ── Sección Novedad (textarea + observación anterior) ── */}
          <div className="rounded-xl bg-acento-naranjaSalmon1/5 p-4 space-y-3 ring-1 ring-acento-naranjaSalmon1/20">
            <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
              <AlertTriangle size={16} className="text-acento-naranjaSalmon1" />
              Registrar Novedad
            </h3>
            <Textarea
              placeholder="Escriba la novedad o situación a reportar..."
              value={novedadTexto}
              onChange={(e) => setNovedadTexto(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              onClick={handleGuardarNovedad}
              disabled={!novedadTexto.trim()}
              size="sm"
              className="w-full bg-acento-naranjaSalmon1 text-base-white hover:bg-acento-naranjaSalmon2"
            >
              Guardar Novedad
            </Button>

            {/* Observación heredada del día anterior */}
            {observacionAnterior && (
              <div className="mt-2 rounded-lg bg-acento-azul1/10 p-3 ring-1 ring-acento-azul1/20">
                <p className="text-[11px] font-semibold text-acento-azul1 mb-1">
                  📋 Observación anterior:
                </p>
                <p className="text-xs text-acento-azul2 leading-relaxed">
                  {observacionAnterior}
                </p>
              </div>
            )}
          </div>

          {/* ── Sección Permiso ── */}
          {isPermiso && registroActual ? (
            <div className="rounded-xl bg-acento-morado/5 p-4 space-y-3 ring-1 ring-acento-morado/20">
              <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                <ShieldAlert size={16} className="text-acento-morado" />
                Permiso Activo
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-base-white p-2.5">
                  <p className="text-[10px] font-medium text-institucional-whiteSmokeBlack uppercase">
                    Desde
                  </p>
                  <p className="text-sm font-semibold text-base-eerieBlack mt-0.5">
                    {registroActual.permisoInicio
                      ? format(new Date(registroActual.permisoInicio + "T00:00:00"), "dd/MM")
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-base-white p-2.5">
                  <p className="text-[10px] font-medium text-institucional-whiteSmokeBlack uppercase">
                    Hasta
                  </p>
                  <p className="text-sm font-semibold text-base-eerieBlack mt-0.5">
                    {registroActual.permisoFin
                      ? format(new Date(registroActual.permisoFin + "T00:00:00"), "dd/MM")
                      : "—"}
                  </p>
                </div>
              </div>
              {!editandoPermiso ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditandoPermiso(true)}
                  className="w-full text-acento-morado border-acento-morado/30 hover:bg-acento-morado/5"
                >
                  <Edit3 size={14} className="mr-2" />
                  Editar Permiso
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-institucional-whiteSmokeBlack">
                        Nuevo Inicio
                      </label>
                      <input
                        type="date"
                        value={permisoInicio}
                        onChange={(e) => setPermisoInicio(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-institucional-whiteSmokeBlack">
                        Nuevo Fin
                      </label>
                      <input
                        type="date"
                        value={permisoFin}
                        onChange={(e) => setPermisoFin(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="text-xs text-base-red font-medium">{error}</p>
                  )}
                  <Button
                    onClick={handleAsignarPermiso}
                    size="sm"
                    className="w-full bg-acento-morado hover:bg-acento-morado/90 text-base-white"
                  >
                    Reasignar Permiso
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* Asignación de nuevo permiso (solo si no tiene permiso activo) */
            <div className="rounded-xl bg-institucional-whiteSmoke p-4 space-y-3">
              <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                <ShieldAlert size={16} className="text-acento-morado" />
                Asignar Permiso
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-institucional-whiteSmokeBlack">
                    Inicio
                  </label>
                  <input
                    type="date"
                    value={permisoInicio}
                    onChange={(e) => setPermisoInicio(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-institucional-whiteSmokeBlack">
                    Fin
                  </label>
                  <input
                    type="date"
                    value={permisoFin}
                    onChange={(e) => setPermisoFin(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                  />
                </div>
              </div>
              {error && (
                <p className="text-xs text-base-red font-medium">{error}</p>
              )}
              <button
                onClick={handleAsignarPermiso}
                className="w-full h-9 rounded-lg bg-acento-morado hover:bg-acento-morado/90 text-base-white text-xs font-semibold transition-colors shadow-sm"
              >
                Asignar Permiso
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-institucional-whiteSmoke p-2.5">
      <p className="text-[10px] font-medium text-institucional-whiteSmokeBlack uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-semibold text-base-eerieBlack mt-0.5 truncate">
        {value}
      </p>
    </div>
  );
}

// ── Tarjeta de puesto/comerciante ────────────────────────────────────────────

function PuestoCard({
  puesto,
  comerciante,
  estado,
  onEstadoChange,
  onDoubleClick,
  onObservacion,
  isPermiso,
}: {
  puesto: Puesto;
  comerciante: Comerciante | null;
  estado: EstadoAsistencia | "Vacante";
  onEstadoChange: (estado: EstadoAsistencia) => void;
  onDoubleClick: () => void;
  onObservacion: () => void;
  isPermiso: boolean;
}) {
  const config = ESTADO_CONFIG[estado];
  const isVacante = puesto.estado === "Vacante";

  if (isVacante) {
    return (
      <article
        className={`flex items-center gap-3 rounded-xl bg-base-white/60 px-4 py-3 ring-1 ${config.ring} opacity-60`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-whiteSmokeBlack/10 text-xs font-bold text-institucional-whiteSmokeBlack">
          —
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-institucional-whiteSmokeBlack">
            {puesto.codigo}
          </p>
          <span className="inline-flex items-center rounded-full bg-institucional-whiteSmokeBlack/15 px-2 py-0.5 text-[10px] font-semibold text-institucional-whiteSmokeBlack mt-0.5">
            Vacante
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl bg-base-white px-4 py-3.5 shadow-sm ring-1 ${config.ring} sm:flex-row sm:items-center sm:justify-between cursor-pointer transition-all hover:shadow-md`}
      onDoubleClick={onDoubleClick}
      title="Doble clic para ver detalles"
    >
      {/* Info */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg} text-sm font-bold ${config.text}`}
        >
          {comerciante?.nombres.charAt(0) ?? "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-base-eerieBlack text-sm leading-tight">
            {comerciante
              ? `${comerciante.nombres} ${comerciante.apellidos}`
              : "Sin asignar"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-institucional-whiteSmokeBlack">
              {puesto.codigo}
            </span>
            {comerciante && (
              <span className="text-[10px] text-institucional-whiteSmokeBlack">
                CIU: {comerciante.ciu}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text}`}
            >
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción: Presente, Ausente, Observación */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <AccionBtn
          label="Presente"
          Icon={CheckCircle2}
          colorClasses="bg-acento-verdeOliva1/15 text-acento-verdeOliva1 hover:bg-acento-verdeOliva1 hover:text-base-white"
          isActive={estado === "Presente"}
          onClick={() => onEstadoChange("Presente")}
          disabled={isPermiso}
        />
        <AccionBtn
          label="Ausente"
          Icon={XCircle}
          colorClasses="bg-base-red/10 text-base-red hover:bg-base-red hover:text-base-white"
          isActive={estado === "Ausente"}
          onClick={() => onEstadoChange("Ausente")}
          disabled={isPermiso}
        />
        <AccionBtn
          label="Observación"
          Icon={EyeIcon}
          colorClasses="bg-acento-naranjaSalmon1/15 text-acento-naranjaSalmon1 hover:bg-acento-naranjaSalmon1 hover:text-base-white"
          isActive={estado === "Novedad" || estado === "Observacion"}
          onClick={onObservacion}
          disabled={isPermiso}
        />
      </div>
    </article>
  );
}

// ── Bloque de sector ─────────────────────────────────────────────────────────

function SectorBlock({
  sector,
  fecha,
  isOpen,
  onToggle,
  searchQuery,
  overrides,
  onEstadoChange,
  onOpenModal,
  onObservacion,
}: {
  sector: Sector;
  fecha: string;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  overrides: Record<string, EstadoAsistencia>;
  onEstadoChange: (comercianteId: string, estado: EstadoAsistencia) => void;
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
  onObservacion: (comerciante: Comerciante) => void;
}) {
  const puestos = getPuestosPorSector(sector.id);
  const asistenciaDelDia = getAsistenciaPorFecha(fecha);

  // Construir datos de renderizado
  const items = puestos.map((puesto) => {
    const comerciante = puesto.comercianteId
      ? getComerciantePorId(puesto.comercianteId)
      : null;

    let estado: EstadoAsistencia | "Vacante" = "Vacante";
    if (puesto.estado === "Ocupado" && comerciante) {
      // Check overrides first
      const overrideKey = `${comerciante.idInterno}:${fecha}`;
      if (overrides[overrideKey]) {
        estado = overrides[overrideKey];
      } else {
        const registro = asistenciaDelDia.find(
          (r) => r.comercianteId === comerciante.idInterno
        );
        estado = registro?.estado ?? "Pendiente";
      }
    }

    return { puesto, comerciante, estado };
  });

  // Filtrar por búsqueda
  const filtered = searchQuery
    ? items.filter((item) => {
        if (item.puesto.estado === "Vacante") return false;
        const q = searchQuery.toLowerCase();
        const c = item.comerciante;
        if (!c) return false;
        return (
          c.nombres.toLowerCase().includes(q) ||
          c.apellidos.toLowerCase().includes(q) ||
          c.ciu.toLowerCase().includes(q) ||
          item.puesto.codigo.toLowerCase().includes(q)
        );
      })
    : items;

  // Ordenar: Ausente → Observacion → Novedad → Permiso → Pendiente → Presente → Vacante
  const sorted = [...filtered].sort((a, b) => {
    const prioA = a.estado === "Vacante" ? 99 : (ESTADO_PRIORIDAD[a.estado] ?? 10);
    const prioB = b.estado === "Vacante" ? 99 : (ESTADO_PRIORIDAD[b.estado] ?? 10);
    return prioA - prioB;
  });

  const totalOcupados = items.filter((i) => i.puesto.estado === "Ocupado").length;
  const totalVacantes = items.filter((i) => i.puesto.estado === "Vacante").length;

  return (
    <section className="overflow-hidden rounded-xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`sector-content-${sector.id}`}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-institucional-green/5"
      >
        <Tag
          size={13}
          strokeWidth={2}
          className="text-institucional-whiteSmokeBlack"
          aria-hidden="true"
        />
        <h3 className="text-sm font-bold text-base-eerieBlack">{sector.nombre}</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full bg-acento-verdeOliva1/10 px-2 py-0.5 text-[10px] font-medium text-acento-verdeOliva1">
            {totalOcupados} ocupados
          </span>
          {totalVacantes > 0 && (
            <span className="rounded-full bg-institucional-whiteSmokeBlack/15 px-2 py-0.5 text-[10px] font-medium text-institucional-whiteSmokeBlack">
              {totalVacantes} vacantes
            </span>
          )}
        </div>
        <ChevronDown
          className={`text-institucional-green transition-transform ${isOpen ? "rotate-180" : ""}`}
          size={18}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul
          id={`sector-content-${sector.id}`}
          className="flex flex-col gap-2 border-t border-institucional-whiteSmokeBlack/15 bg-institucional-whiteSmoke/50 p-3"
          role="list"
        >
          {sorted.map((item) => (
            <li key={item.puesto.id}>
              <PuestoCard
                puesto={item.puesto}
                comerciante={item.comerciante}
                estado={item.estado}
                isPermiso={item.estado === "Permiso"}
                onEstadoChange={(nuevoEstado) => {
                  if (item.comerciante) {
                    onEstadoChange(item.comerciante.idInterno, nuevoEstado);
                  }
                }}
                onDoubleClick={() => {
                  if (item.comerciante && item.estado !== "Vacante") {
                    onOpenModal(item.puesto, item.comerciante, item.estado as EstadoAsistencia);
                  }
                }}
                onObservacion={() => {
                  if (item.comerciante) {
                    onObservacion(item.comerciante);
                  }
                }}
              />
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="py-6 text-center text-sm text-institucional-whiteSmokeBlack">
              No se encontraron resultados.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// ── Vista Treemap (Mapa de Árbol) ────────────────────────────────────────────

function TreemapView({
  nave,
  fecha,
  overrides,
  onOpenModal,
}: {
  nave: Nave;
  fecha: string;
  overrides: Record<string, EstadoAsistencia>;
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
}) {
  const asistenciaDelDia = getAsistenciaPorFecha(fecha);

  return (
    <div className="space-y-4">
      {nave.sectores.map((sector) => {
        const puestos = getPuestosPorSector(sector.id);

        return (
          <div key={sector.id}>
            <h3 className="text-sm font-bold text-base-eerieBlack mb-2">
              {sector.nombre}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {puestos.map((puesto) => {
                const comerciante = puesto.comercianteId
                  ? getComerciantePorId(puesto.comercianteId)
                  : null;

                let estado: EstadoAsistencia | "Vacante" = "Vacante";
                if (puesto.estado === "Ocupado" && comerciante) {
                  const overrideKey = `${comerciante.idInterno}:${fecha}`;
                  if (overrides[overrideKey]) {
                    estado = overrides[overrideKey];
                  } else {
                    const registro = asistenciaDelDia.find(
                      (r) => r.comercianteId === comerciante.idInterno
                    );
                    estado = registro?.estado ?? "Pendiente";
                  }
                }

                const config = ESTADO_CONFIG[estado];
                const bgColorMap: Record<string, string> = {
                  Presente: "bg-acento-verdeOliva1",
                  Ausente: "bg-base-red",
                  Novedad: "bg-acento-naranjaSalmon1",
                  Observacion: "bg-acento-azul1",
                  Permiso: "bg-acento-morado",
                  Pendiente: "bg-institucional-whiteSmokeBlack/40",
                  Vacante: "bg-institucional-whiteSmokeBlack/20",
                };

                const isInteractive = !!comerciante && estado !== "Vacante";

                return (
                  <div
                    key={puesto.id}
                    onClick={() => {
                      if (isInteractive && comerciante) {
                        onOpenModal(puesto, comerciante, estado as EstadoAsistencia);
                      }
                    }}
                    className={[
                      "min-h-[120px] p-4 rounded-lg flex flex-col justify-between transition-all relative",
                      bgColorMap[estado],
                      isInteractive
                        ? "cursor-pointer hover:scale-[1.03] hover:shadow-lg hover:z-10"
                        : "cursor-default opacity-60",
                    ].join(" ")}
                    title={
                      comerciante
                        ? `${puesto.codigo}: ${comerciante.nombres} ${comerciante.apellidos} — ${config.label}`
                        : `${puesto.codigo}: Vacante`
                    }
                  >
                    {/* Código de puesto */}
                    <span className="text-[9px] font-bold text-base-white/70 uppercase tracking-wider">
                      {puesto.codigo}
                    </span>

                    {comerciante ? (
                      <div className="mt-auto">
                        <p className="text-xs font-bold text-base-white leading-tight truncate">
                          {comerciante.nombres}
                        </p>
                        <p className="text-[10px] text-base-white/80 truncate">
                          {comerciante.apellidos}
                        </p>
                        <p className="text-[9px] text-base-white/60 font-mono mt-1">
                          {comerciante.ciu}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-auto text-[10px] text-base-white/50 font-medium">
                        Vacante
                      </p>
                    )}

                    {/* Badge de estado */}
                    <span className="absolute top-2 right-2 text-[8px] font-bold text-base-white/80 bg-base-black/20 rounded px-1.5 py-0.5">
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-4 px-1">
        {(
          ["Presente", "Ausente", "Novedad", "Observacion", "Permiso", "Pendiente", "Vacante"] as const
        ).map((key) => {
          const config = ESTADO_CONFIG[key];
          const bgMap: Record<string, string> = {
            Presente: "bg-acento-verdeOliva1",
            Ausente: "bg-base-red",
            Novedad: "bg-acento-naranjaSalmon1",
            Observacion: "bg-acento-azul1",
            Permiso: "bg-acento-morado",
            Pendiente: "bg-institucional-whiteSmokeBlack/40",
            Vacante: "bg-institucional-whiteSmokeBlack/20",
          };
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded-sm ${bgMap[key]}`} />
              <span className="text-[10px] text-institucional-whiteSmokeBlack font-medium">
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal de Listas ───────────────────────────────────────────────

export default function ListasPage() {
  const naves = getNaves();
  const [selectedNaveId, setSelectedNaveId] = useState<string | null>(null);
  const [openSector, setOpenSector] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"lista" | "treemap">("lista");
  const [overrides, setOverrides] = useState<Record<string, EstadoAsistencia>>({});

  // Modal state
  const [modalData, setModalData] = useState<{
    puesto: Puesto;
    comerciante: Comerciante;
    estado: EstadoAsistencia;
  } | null>(null);

  // Observación dialog state
  const [obsDialogOpen, setObsDialogOpen] = useState(false);
  const [obsCommerciante, setObsCommerciante] = useState<Comerciante | null>(null);

  const nave = naves.find((n) => n.id === selectedNaveId) ?? null;
  const fechaStr = formatDate(selectedDate);

  // Selector de fechas horizontal
  const endDate = isToday(selectedDate) ? selectedDate : addDays(selectedDate, 1);
  const recentDates = Array.from({ length: 6 }, (_, index) =>
    subDays(endDate, 5 - index)
  );

  function selectNave(naveId: string) {
    const selected = naves.find((n) => n.id === naveId);
    setSelectedNaveId(naveId);
    setOpenSector(selected?.sectores[0]?.id ?? null);
    setSearchQuery("");
  }

  function goBackToNaves() {
    setSelectedNaveId(null);
    setOpenSector(null);
    setSearchQuery("");
  }

  function handleEstadoChange(comercianteId: string, estado: EstadoAsistencia) {
    const key = `${comercianteId}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: estado }));
    setEstadoAsistencia(comercianteId, fechaStr, estado);
  }

  function handleOpenModal(puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) {
    setModalData({ puesto, comerciante, estado });
  }

  function handlePermisoAsignado(inicio: string, fin: string) {
    if (!modalData) return;
    setPermisoComercianteRango(modalData.comerciante.idInterno, inicio, fin);

    // Actualizar overrides para reflejar permiso en las fechas
    const startDate = new Date(inicio + "T00:00:00");
    const endDate = new Date(fin + "T00:00:00");
    const current = new Date(startDate);
    const newOverrides = { ...overrides };

    while (current <= endDate) {
      const f = formatDate(current);
      newOverrides[`${modalData.comerciante.idInterno}:${f}`] = "Permiso";
      current.setDate(current.getDate() + 1);
    }

    setOverrides(newOverrides);
    setModalData(null);
  }

  // Manejar clic en "Observación" → abrir dialog
  function handleObservacion(comerciante: Comerciante) {
    setObsCommerciante(comerciante);
    setObsDialogOpen(true);
  }

  // Guardar observación → estado cambia a Novedad
  function handleObservacionSave(texto: string) {
    if (!obsCommerciante) return;
    const key = `${obsCommerciante.idInterno}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: "Novedad" }));
    setEstadoAsistencia(
      obsCommerciante.idInterno,
      fechaStr,
      "Novedad",
      "Novedad reportada por supervisor",
      texto
    );
    setObsDialogOpen(false);
    setObsCommerciante(null);
  }

  // Manejar novedad desde el modal de detalle
  function handleNovedadDesdeModal(comercianteId: string, texto: string) {
    const key = `${comercianteId}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: "Novedad" }));
    setEstadoAsistencia(
      comercianteId,
      fechaStr,
      "Novedad",
      "Novedad reportada por supervisor",
      texto
    );
    // Actualizar el estado del modal
    if (modalData && modalData.comerciante.idInterno === comercianteId) {
      setModalData({ ...modalData, estado: "Novedad" });
    }
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Toma de Listas
          </h1>
        </div>

        {/* Selector de fechas */}
        <div
          className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Seleccionar fecha"
        >
          {recentDates.map((date) => {
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
                  "shrink-0 rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors",
                  isFutureDate
                    ? "bg-institucional-whiteSmokeBlack/10 text-institucional-whiteSmokeBlack/40 cursor-not-allowed"
                    : isSelected
                      ? "bg-institucional-green text-base-white shadow-sm"
                      : "bg-base-white text-institucional-whiteSmokeBlack ring-1 ring-institucional-whiteSmokeBlack/20 hover:text-institucional-green",
                ].join(" ")}
              >
                {isToday(date)
                  ? "Hoy"
                  : format(date, "EEE, d 'de' MMM", { locale: es })}
              </button>
            );
          })}

          {/* Calendar popover */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-white text-institucional-whiteSmokeBlack ring-1 ring-institucional-whiteSmokeBlack/20 transition-colors hover:text-institucional-green hover:ring-institucional-green/40"
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

        {/* Barra de búsqueda + toggle vista */}
        {nave && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-institucional-whiteSmokeBlack"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, CIU o puesto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-10 pr-4 text-sm text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
              />
            </div>

            {/* Toggle vista */}
            <button
              type="button"
              onClick={() =>
                setViewMode((v) => (v === "lista" ? "treemap" : "lista"))
              }
              className="flex items-center gap-2 rounded-lg bg-base-white px-4 py-2.5 text-xs font-semibold text-base-eerieBlack ring-1 ring-institucional-whiteSmokeBlack/20 transition-colors hover:ring-institucional-green/40"
            >
              {viewMode === "lista" ? (
                <ToggleLeft size={18} className="text-institucional-green" />
              ) : (
                <ToggleRight size={18} className="text-institucional-green" />
              )}
              {viewMode === "lista" ? "Vista Lista" : "Mapa de Árbol"}
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {!nave ? (
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
                <span className="text-sm text-institucional-whiteSmokeBlack">
                  {item.sectores.length} sectores · {item.limitePuestos} puestos
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
            <button
              type="button"
              onClick={goBackToNaves}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-institucional-green hover:underline"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Volver a naves
            </button>

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-institucional-green/10 text-institucional-green">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <h2 id={`nave-${nave.id}`} className="text-xl font-bold text-base-eerieBlack">
                {nave.nombre}
              </h2>
            </div>

            {viewMode === "lista" ? (
              <div className="flex flex-col gap-3">
                {nave.sectores.map((sector) => (
                  <SectorBlock
                    key={sector.id}
                    sector={sector}
                    fecha={fechaStr}
                    isOpen={openSector === sector.id}
                    onToggle={() =>
                      setOpenSector(openSector === sector.id ? null : sector.id)
                    }
                    searchQuery={searchQuery}
                    overrides={overrides}
                    onEstadoChange={handleEstadoChange}
                    onOpenModal={handleOpenModal}
                    onObservacion={handleObservacion}
                  />
                ))}
              </div>
            ) : (
              <TreemapView
                nave={nave}
                fecha={fechaStr}
                overrides={overrides}
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
    </div>
  );
}
