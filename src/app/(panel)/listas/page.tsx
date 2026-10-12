"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getNaves,
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
import { addDays, eachDayOfInterval, format, isToday, isFuture, subDays } from "date-fns";
import { es } from "date-fns/locale";

// ── Colores por estado ───────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<
  EstadoAsistencia | "Vacante",
  { bg: string; text: string; ring: string; label: string }
> = {
  Presente: {
    bg: "bg-green-700",
    text: "text-white",
    ring: "ring-green-700/30",
    label: "Presente",
  },
  Ausente: {
    bg: "bg-red-700",
    text: "text-white",
    ring: "ring-red-700/30",
    label: "Ausente",
  },
  Observacion: {
    bg: "bg-blue-600",
    text: "text-white",
    ring: "ring-blue-600/30",
    label: "Observación",
  },
  Permiso: {
    bg: "bg-purple-700",
    text: "text-white",
    ring: "ring-purple-700/30",
    label: "Permiso",
  },
  Pendiente: {
    bg: "bg-slate-600",
    text: "text-white",
    ring: "ring-slate-600/30",
    label: "Pendiente",
  },
  Vacante: {
    bg: "bg-gray-700",
    text: "text-white",
    ring: "ring-gray-700/30",
    label: "Vacante",
  },
};

// ── Orden de prioridad de estados ────────────────────────────────────────────

const ESTADO_PRIORIDAD: Record<string, number> = {
  Ausente: 0,
  Observacion: 1,
  Permiso: 2,
  Pendiente: 3,
  Presente: 4,
};

// ── Helper: formatear fecha ──────────────────────────────────────────────────

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Helper: normalizar texto (insensible a tildes y mayúsculas) ──────────────

const normalizeText = (text: string) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// ── Botón de acción de estado ────────────────────────────────────────────────

function AccionBtn({
  label,
  Icon,
  activeClass,
  inactiveClass,
  isActive,
  onClick,
  disabled,
}: {
  label: string;
  Icon: React.ElementType;
  activeClass: string;
  inactiveClass: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={[
        "flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
        "transition-all duration-150 active:scale-95",
        disabled ? "opacity-40 cursor-not-allowed" : "",
        isActive ? `${activeClass} shadow-sm` : inactiveClass,
      ].join(" ")}
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      <span>{label}</span>
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
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <MessageSquareWarning size={20} className="text-blue-600" />
            Registrar Observación
          </DialogTitle>
          <DialogDescription>
            {comerciante
              ? `Ingrese el detalle de la observación para ${comerciante.contribuyente} (${comerciante.ciu}).`
              : "Ingrese el detalle de la observación."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describa la novedad o situación observada..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="resize-none border-blue-200 focus-visible:ring-blue-500"
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!texto.trim()}
            className="bg-blue-600 text-white hover:bg-blue-700 font-semibold"
          >
            Guardar como Novedad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComercianteModal({
  comerciante,
  puesto,
  estado: estadoInicial,
  fecha,
  onClose,
  onPermisoAsignado,
  onNovedadGuardada,
  onEstadoChange,
}: {
  comerciante: Comerciante;
  puesto: Puesto;
  estado: EstadoAsistencia;
  fecha: string;
  onClose: () => void;
  onPermisoAsignado: (inicio: string, fin: string) => void;
  onNovedadGuardada: (comercianteId: string, texto: string) => void;
  onEstadoChange: (estado: EstadoAsistencia) => void;
}) {
  // Registro actual en la base de datos simulada (mock)
  const registroActual = getAsistenciaComerciantePorFecha(
    comerciante.idInterno,
    fecha
  );

  // Obtener datos existentes en el mock
  const observacionExistente = registroActual?.observacionTexto || registroActual?.observacion || "";
  const tieneObservacionPrevia = Boolean(observacionExistente.trim());

  const tienePermisoPrevio = estadoInicial === "Permiso" || Boolean(registroActual?.permisoInicio);
  const permisoInicioExistente = registroActual?.permisoInicio || fecha;
  const permisoFinExistente = registroActual?.permisoFin || fecha;

  // Estados locales del modal
  const [estadoActual, setEstadoActual] = useState<EstadoAsistencia>(estadoInicial);
  const [novedadTexto, setNovedadTexto] = useState(observacionExistente);
  const [permisoInicio, setPermisoInicio] = useState(permisoInicioExistente);
  const [permisoFin, setPermisoFin] = useState(permisoFinExistente);
  const [openInicio, setOpenInicio] = useState(false);
  const [openFin, setOpenFin] = useState(false);
  const [permisoError, setPermisoError] = useState("");

  const fechaInicioObj = useMemo(() => {
    if (!permisoInicio) return undefined;
    const d = new Date(permisoInicio + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [permisoInicio]);

  const fechaFinObj = useMemo(() => {
    if (!permisoFin) return undefined;
    const d = new Date(permisoFin + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [permisoFin]);

  // Estado para modal de confirmación personalizado (reemplazo de window.confirm)
  const [confirmAlert, setConfirmAlert] = useState<{
    isOpen: boolean;
    nuevoEstado: "Presente" | "Ausente";
    tipo: "observacion" | "permiso";
    mensaje: string;
  } | null>(null);

  // Subpanel desplegable (toggle): "observacion" | "permiso" | null
  const [panelActivo, setPanelActivo] = useState<"observacion" | "permiso" | null>(() => {
    if (estadoInicial === "Observacion") return "observacion";
    if (estadoInicial === "Permiso") return "permiso";
    return null;
  });

  const estadoConfig = ESTADO_CONFIG[estadoActual] ?? ESTADO_CONFIG["Pendiente"];

  // Obtener observación del día anterior (si existe) para referencia
  const fechaAyer = formatDate(subDays(new Date(fecha + "T00:00:00"), 1));
  const registroAyer = getAsistenciaComerciantePorFecha(
    comerciante.idInterno,
    fechaAyer
  );
  const observacionAnterior =
    registroAyer?.estado === "Observacion" ? (registroAyer.observacionTexto || registroAyer.observacion) : null;

  // ── Intercepción y cambio de estado a Presente / Ausente ──────────────────
  function handleSeleccionarEstado(nuevoEstado: "Presente" | "Ausente") {
    if (estadoActual === nuevoEstado && panelActivo === null) return;

    // Si tiene Observación guardada o escrita en el modal
    if (estadoActual === "Observacion" || Boolean(novedadTexto.trim())) {
      setConfirmAlert({
        isOpen: true,
        nuevoEstado,
        tipo: "observacion",
        mensaje:
          "Cambiar la asistencia eliminará la observación registrada para este día. ¿Desea continuar?",
      });
      return;
    }

    // Si tiene Permiso registrado
    if (estadoActual === "Permiso" || tienePermisoPrevio) {
      setConfirmAlert({
        isOpen: true,
        nuevoEstado,
        tipo: "permiso",
        mensaje:
          "Cambiar la asistencia eliminará el permiso asignado a este comerciante. ¿Desea continuar?",
      });
      return;
    }

    // Cambio directo sin advertencia
    setPanelActivo(null);
    setEstadoActual(nuevoEstado);
    setEstadoAsistencia(comerciante.idInterno, fecha, nuevoEstado);
    onEstadoChange(nuevoEstado);
    toast.success(`Asistencia registrada como ${nuevoEstado}`);
  }

  function handleConfirmarCambio() {
    if (!confirmAlert) return;
    const { nuevoEstado, tipo } = confirmAlert;

    if (tipo === "observacion") {
      setNovedadTexto("");
      setPanelActivo(null);
      setEstadoActual(nuevoEstado);
      setEstadoAsistencia(comerciante.idInterno, fecha, nuevoEstado, undefined, undefined);
      onEstadoChange(nuevoEstado);
      toast.success(`Asistencia registrada como ${nuevoEstado}`, {
        description: "Se eliminó la observación registrada para este día.",
      });
    } else if (tipo === "permiso") {
      setPermisoInicio("");
      setPermisoFin("");
      setPanelActivo(null);
      setEstadoActual(nuevoEstado);
      setEstadoAsistencia(comerciante.idInterno, fecha, nuevoEstado, undefined, undefined);
      onEstadoChange(nuevoEstado);
      toast.success(`Asistencia registrada como ${nuevoEstado}`, {
        description: "Se eliminó el permiso asignado.",
      });
    }

    setConfirmAlert(null);
  }

  // ── Toggles para Observación y Permiso ─────────────────────────────────────
  function handleToggleObservacion() {
    setPanelActivo((actual) => (actual === "observacion" ? null : "observacion"));
  }

  function handleTogglePermiso() {
    setPanelActivo((actual) => (actual === "permiso" ? null : "permiso"));
  }

  // ── Guardar / Editar Observación ──────────────────────────────────────────
  function handleGuardarObservacion() {
    if (!novedadTexto.trim()) return;
    onNovedadGuardada(comerciante.idInterno, novedadTexto.trim());
    setEstadoActual("Observacion");
    onEstadoChange("Observacion");
    toast.success(
      tieneObservacionPrevia ? "Observación editada exitosamente" : "Observación registrada exitosamente",
      { description: "Se ha actualizado la novedad del comerciante." }
    );
  }

  // ── Guardar / Editar Permiso ──────────────────────────────────────────────
  function handleGuardarPermiso() {
    setPermisoError("");
    if (!permisoInicio || !permisoFin) {
      setPermisoError("Debe seleccionar fecha de inicio y fin.");
      return;
    }
    if (permisoInicio > permisoFin) {
      setPermisoError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }
    onPermisoAsignado(permisoInicio, permisoFin);
    setEstadoActual("Permiso");
    onEstadoChange("Permiso");
    toast.success(
      tienePermisoPrevio ? "Permiso editado exitosamente" : "Permiso asignado exitosamente",
      { description: `Rango: ${permisoInicio} al ${permisoFin}.` }
    );
  }

  return (
    <Dialog open={true} disablePointerDismissal={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 rounded-2xl gap-0"
      >
        {/* Header con botón X explícito */}
        <div className="bg-institucional-green px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-white/20 text-base-white font-bold text-lg">
              {comerciante.contribuyente.charAt(0)}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-base-white m-0">
                {comerciante.contribuyente}
              </DialogTitle>
              <DialogDescription className="text-sm text-base-white/80 m-0">
                CIU: {comerciante.ciu}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-base-white/80 hover:text-base-white hover:bg-base-white/20 transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido del modal */}
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
            <span className="text-xs font-medium text-gray-700">Estado:</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${estadoConfig.bg} ${estadoConfig.text}`}
            >
              {estadoConfig.label}
            </span>
            {estadoActual === "Permiso" && (
              <span className="text-[10px] text-acento-morado font-medium">
                (Permiso activo)
              </span>
            )}
          </div>

          {/* 1. Acciones Rápidas (4 Botones en cuadrícula de 2 columnas) */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Presente */}
            <Button
              type="button"
              variant={estadoActual === "Presente" ? "default" : "outline"}
              className={
                estadoActual === "Presente"
                  ? "bg-acento-verdeOliva1 text-white hover:bg-acento-verdeOliva1/90 shadow-sm"
                  : "text-acento-verdeOliva1 border-acento-verdeOliva1/30 hover:bg-acento-verdeOliva1/10"
              }
              onClick={() => handleSeleccionarEstado("Presente")}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
              Presente
            </Button>

            {/* Ausente */}
            <Button
              type="button"
              variant={estadoActual === "Ausente" ? "default" : "outline"}
              className={
                estadoActual === "Ausente"
                  ? "bg-red-700 text-white hover:bg-red-700/90 shadow-sm"
                  : "text-red-700 border-red-700/30 hover:bg-red-700/10"
              }
              onClick={() => handleSeleccionarEstado("Ausente")}
            >
              <XCircle className="w-4 h-4 mr-1.5 shrink-0" />
              Ausente
            </Button>

            {/* Observación */}
            <Button
              type="button"
              variant={estadoActual === "Observacion" ? "default" : "outline"}
              className={
                estadoActual === "Observacion"
                  ? "bg-blue-600 text-white hover:bg-blue-600/90 shadow-sm"
                  : "text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
              }
              onClick={handleToggleObservacion}
            >
              <EyeIcon className="w-4 h-4 mr-1.5 shrink-0" />
              Observación
            </Button>

            {/* Permiso */}
            <Button
              type="button"
              variant={estadoActual === "Permiso" ? "default" : "outline"}
              className={
                estadoActual === "Permiso"
                  ? "bg-acento-morado text-white hover:bg-acento-morado/90 shadow-sm"
                  : "text-acento-morado border-acento-morado/30 hover:bg-acento-morado/10"
              }
              onClick={handleTogglePermiso}
            >
              <ShieldAlert className="w-4 h-4 mr-1.5 shrink-0" />
              Permiso
            </Button>
          </div>

          {/* 2 & 3. Subpanel Desplegable: Observación (Modo Registro / Edición) */}
          {panelActivo === "observacion" && (
            <div className="rounded-xl bg-blue-50/60 p-4 space-y-3 ring-1 ring-blue-200 animate-in fade-in-50 duration-150">
              <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                <AlertTriangle size={16} className="text-blue-600" />
                {tieneObservacionPrevia ? "Editar Observación" : "Registrar Observación"}
              </h3>
              <Textarea
                placeholder="Escriba la observación o situación a reportar..."
                value={novedadTexto}
                onChange={(e) => setNovedadTexto(e.target.value)}
                rows={3}
                className="resize-none text-sm bg-base-white"
              />
              <Button
                type="button"
                onClick={handleGuardarObservacion}
                disabled={!novedadTexto.trim()}
                size="sm"
                className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                {tieneObservacionPrevia ? "Editar Observación" : "Registrar Observación"}
              </Button>

              {/* Observación heredada del día anterior */}
              {observacionAnterior && (
                <div className="mt-2 rounded-lg bg-blue-100/60 p-3 ring-1 ring-blue-200">
                  <p className="text-[11px] font-semibold text-blue-700 mb-1">
                    📋 Observación anterior:
                  </p>
                  <p className="text-xs text-blue-900 leading-relaxed">
                    {observacionAnterior}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2 & 3. Subpanel Desplegable: Permiso (Modo Asignación / Edición) */}
          {panelActivo === "permiso" && (
            <div className="rounded-xl bg-purple-50/60 p-4 space-y-3 ring-1 ring-purple-200 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                  <ShieldAlert size={16} className="text-acento-morado" />
                  {tienePermisoPrevio ? "Editar Permiso" : "Asignar Permiso"}
                </h3>
                {tienePermisoPrevio && (
                  <span className="text-[10px] font-semibold text-acento-morado bg-purple-100 rounded-full px-2.5 py-0.5">
                    Permiso Activo
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Fecha de Inicio
                  </label>
                  <Popover open={openInicio} onOpenChange={setOpenInicio}>
                    <PopoverTrigger
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                    >
                      <span className="truncate">
                        {fechaInicioObj
                           ? format(fechaInicioObj, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </span>
                      <CalendarIcon size={14} className="text-gray-700 shrink-0" />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="center"
                      side="bottom"
                      avoidCollisions={true}
                      collisionBoundary={typeof window !== "undefined" ? document.body : undefined}
                    >
                      <Calendar
                        mode="single"
                        selected={fechaInicioObj}
                        onSelect={(date) => {
                          if (date) {
                            setPermisoInicio(format(date, "yyyy-MM-dd"));
                            setOpenInicio(false);
                          }
                        }}
                        locale={es}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Fecha de Fin
                  </label>
                  <Popover open={openFin} onOpenChange={setOpenFin}>
                    <PopoverTrigger
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-institucional-whiteSmokeBlack/50 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                    >
                      <span className="truncate">
                        {fechaFinObj
                          ? format(fechaFinObj, "dd/MM/yyyy", { locale: es })
                          : "Seleccionar fecha"}
                      </span>
                      <CalendarIcon size={14} className="text-gray-700 shrink-0" />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="center"
                      side="bottom"
                      avoidCollisions={true}
                      collisionBoundary={typeof window !== "undefined" ? document.body : undefined}
                    >
                      <Calendar
                        mode="single"
                        selected={fechaFinObj}
                        onSelect={(date) => {
                          if (date) {
                            setPermisoFin(format(date, "yyyy-MM-dd"));
                            setOpenFin(false);
                          }
                        }}
                        locale={es}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {permisoError && (
                <p className="text-xs text-base-red font-medium">{permisoError}</p>
              )}

              <Button
                type="button"
                onClick={handleGuardarPermiso}
                size="sm"
                className="w-full bg-acento-morado hover:bg-acento-morado/90 text-white font-semibold"
              >
                {tienePermisoPrevio ? "Editar Permiso" : "Asignar Permiso"}
              </Button>
            </div>
          )}
        </div>

        {/* Modal de Advertencia de Pérdida de Datos (shadcn/ui Dialog) */}
        <Dialog
          open={Boolean(confirmAlert?.isOpen)}
          onOpenChange={(open) => {
            if (!open) setConfirmAlert(null);
          }}
        >
          <DialogContent
            onInteractOutside={(e) => e.preventDefault()}
            className="sm:max-w-md p-6"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-base-red">
                <AlertTriangle className="h-5 w-5" />
                Advertencia de pérdida de datos
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-900 font-medium pt-2 leading-relaxed">
                {confirmAlert?.mensaje}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmAlert(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-base-red hover:bg-base-red/90 text-white font-medium"
                onClick={handleConfirmarCambio}
              >
                Aceptar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-institucional-whiteSmoke p-2.5">
      <p className="text-[10px] font-medium text-gray-700 uppercase tracking-wider">
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
  fecha,
  onEstadoChange,
  onDoubleClick,
  onObservacionGuardada,
  onPermisoAsignado,
}: {
  puesto: Puesto;
  comerciante: Comerciante | null;
  estado: EstadoAsistencia | "Vacante";
  fecha: string;
  onEstadoChange: (estado: EstadoAsistencia) => void;
  onDoubleClick: () => void;
  onObservacionGuardada: (comercianteId: string, texto: string) => void;
  onPermisoAsignado: (comercianteId: string, inicio: string, fin: string) => void;
}) {
  const config = ESTADO_CONFIG[estado];
  const isVacante = puesto.estado === "Vacante";

  const [panelActivo, setPanelActivo] = useState<"observacion" | "permiso" | null>(null);
  const [obsTexto, setObsTexto] = useState("");
  const [permisoInicio, setPermisoInicio] = useState(fecha);
  const [permisoFin, setPermisoFin] = useState(fecha);
  const [permisoError, setPermisoError] = useState("");

  if (isVacante) {
    return (
      <article
        className={`flex items-center gap-3 rounded-xl bg-base-white/60 px-4 py-3 ring-1 ${config.ring} opacity-60`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-whiteSmokeBlack/10 text-xs font-bold text-gray-700">
          —
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">
            {puesto.codigo}
          </p>
          <span className="inline-flex items-center rounded-full bg-institucional-whiteSmokeBlack/15 px-2 py-0.5 text-[10px] font-semibold text-gray-700 mt-0.5">
            Vacante
          </span>
        </div>
      </article>
    );
  }

  function handleGuardarObservacion(e: React.MouseEvent) {
    e.stopPropagation();
    if (!comerciante || !obsTexto.trim()) return;
    onObservacionGuardada(comerciante.idInterno, obsTexto.trim());
    setObsTexto("");
    setPanelActivo(null);
  }

  function handleGuardarPermiso(e: React.MouseEvent) {
    e.stopPropagation();
    setPermisoError("");
    if (!comerciante) return;
    if (!permisoInicio || !permisoFin) {
      setPermisoError("Debe seleccionar fecha de inicio y fin.");
      return;
    }
    if (permisoInicio > permisoFin) {
      setPermisoError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }
    onPermisoAsignado(comerciante.idInterno, permisoInicio, permisoFin);
    setPanelActivo(null);
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl bg-base-white px-4 py-3.5 shadow-sm ring-1 ${config.ring} cursor-pointer transition-all hover:shadow-md`}
      onDoubleClick={onDoubleClick}
      title="Doble clic para ver detalles"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
        {/* Info */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg} text-sm font-bold ${config.text}`}
          >
            {comerciante?.contribuyente.charAt(0) ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-base-eerieBlack text-sm leading-tight">
              {comerciante
                ? `${comerciante.contribuyente}`
                : "Sin asignar"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-700 font-medium">
                {puesto.codigo}
              </span>
              {comerciante && (
                <span className="text-[10px] text-gray-700 font-medium">
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

        {/* Botones de acción: Presente, Ausente, Observación, Permiso */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap w-full sm:w-auto">
          <AccionBtn
            label="Presente"
            Icon={CheckCircle2}
            activeClass="bg-acento-verdeOliva1 text-white hover:bg-acento-verdeOliva1/90"
            inactiveClass="text-acento-verdeOliva1 border border-acento-verdeOliva1/30 hover:bg-acento-verdeOliva1/10"
            isActive={estado === "Presente"}
            onClick={(e) => {
              e.stopPropagation();
              setPanelActivo(null);
              onEstadoChange("Presente");
            }}
          />
          <AccionBtn
            label="Ausente"
            Icon={XCircle}
            activeClass="bg-red-700 text-white hover:bg-red-700/90"
            inactiveClass="text-red-700 border border-red-700/30 hover:bg-red-700/10"
            isActive={estado === "Ausente"}
            onClick={(e) => {
              e.stopPropagation();
              setPanelActivo(null);
              onEstadoChange("Ausente");
            }}
          />
          <AccionBtn
            label="Observación"
            Icon={EyeIcon}
            activeClass="bg-blue-600 text-white hover:bg-blue-600/90"
            inactiveClass="text-blue-600 border border-blue-600/30 hover:bg-blue-600/10"
            isActive={estado === "Observacion" || panelActivo === "observacion"}
            onClick={(e) => {
              e.stopPropagation();
              setPanelActivo((curr) => (curr === "observacion" ? null : "observacion"));
            }}
          />
          <AccionBtn
            label="Permiso"
            Icon={ShieldAlert}
            activeClass="bg-acento-morado text-white hover:bg-acento-morado/90"
            inactiveClass="text-acento-morado border border-acento-morado/30 hover:bg-acento-morado/10"
            isActive={estado === "Permiso" || panelActivo === "permiso"}
            onClick={(e) => {
              e.stopPropagation();
              setPanelActivo((curr) => (curr === "permiso" ? null : "permiso"));
            }}
          />
        </div>
      </div>

      {/* ── Subpanel Desplegable: Observación ── */}
      {panelActivo === "observacion" && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 w-full rounded-xl bg-blue-50/60 p-3.5 space-y-2.5 ring-1 ring-blue-200 animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-base-eerieBlack flex items-center gap-1.5">
              <EyeIcon size={14} className="text-blue-600" />
              Registrar Observación
            </h4>
            <button
              type="button"
              onClick={() => setPanelActivo(null)}
              className="rounded p-1 text-institucional-whiteSmokeBlack hover:text-base-eerieBlack transition-colors"
              aria-label="Cerrar panel de observación"
            >
              <X size={14} />
            </button>
          </div>
          <Textarea
            placeholder="Describa la observación o situación observada..."
            value={obsTexto}
            onChange={(e) => setObsTexto(e.target.value)}
            rows={2}
            className="resize-none text-xs bg-base-white border-blue-200 focus-visible:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPanelActivo(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!obsTexto.trim()}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={handleGuardarObservacion}
            >
              Guardar Observación
            </Button>
          </div>
        </div>
      )}

      {/* ── Subpanel Desplegable: Permiso ── */}
      {panelActivo === "permiso" && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 w-full rounded-xl bg-purple-50/60 p-3.5 space-y-2.5 ring-1 ring-purple-200 animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-base-eerieBlack flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-acento-morado" />
              Asignar Permiso
            </h4>
            <button
              type="button"
              onClick={() => setPanelActivo(null)}
              className="rounded p-1 text-institucional-whiteSmokeBlack hover:text-base-eerieBlack transition-colors"
              aria-label="Cerrar panel de permiso"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-700">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={permisoInicio}
                onChange={(e) => setPermisoInicio(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-700">
                Fecha de Fin
              </label>
              <input
                type="date"
                value={permisoFin}
                onChange={(e) => setPermisoFin(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
              />
            </div>
          </div>

          {permisoError && (
            <p className="text-[11px] text-base-red font-medium">{permisoError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPanelActivo(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs bg-acento-morado hover:bg-acento-morado/90 text-white font-semibold"
              onClick={handleGuardarPermiso}
            >
              Confirmar Permiso
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Lista de Puestos ─────────────────────────────────────────────────────────

function PuestosList({
  items,
  fecha,
  onEstadoChange,
  onOpenModal,
  onObservacionGuardada,
  onPermisoAsignado,
}: {
  items: {
    puesto: Puesto;
    comerciante: Comerciante | null;
    estado: EstadoAsistencia | "Vacante";
  }[];
  fecha: string;
  onEstadoChange: (comercianteId: string, estado: EstadoAsistencia) => void;
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
  onObservacionGuardada: (comercianteId: string, texto: string) => void;
  onPermisoAsignado: (comercianteId: string, inicio: string, fin: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" role="list">
      {items.map((item) => (
        <li key={item.puesto.id}>
          <PuestoCard
            puesto={item.puesto}
            comerciante={item.comerciante}
            estado={item.estado}
            fecha={fecha}
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
            onObservacionGuardada={onObservacionGuardada}
            onPermisoAsignado={onPermisoAsignado}
          />
        </li>
      ))}
      {items.length === 0 && (
        <li className="py-6 text-center text-sm text-institucional-whiteSmokeBlack">
          No se encontraron resultados.
        </li>
      )}
    </ul>
  );
}

// ── Vista Treemap (Mapa de Árbol) ────────────────────────────────────────────

function TreemapView({
  items,
  onOpenModal,
}: {
  items: {
    puesto: Puesto;
    comerciante: Comerciante | null;
    estado: EstadoAsistencia | "Vacante";
  }[];
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-700 font-medium bg-base-white rounded-xl ring-1 ring-institucional-whiteSmokeBlack/10">
          No se encontraron resultados.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {items.map(({ puesto, comerciante, estado }) => {
            const config = ESTADO_CONFIG[estado];
            const bgColorMap: Record<string, string> = {
              Presente: "bg-green-700 text-white",
              Ausente: "bg-red-700 text-white",
              Observacion: "bg-blue-600 text-white",
              Permiso: "bg-purple-700 text-white",
              Pendiente: "bg-slate-600 text-white",
              Vacante: "bg-gray-700 text-white",
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
                  "min-h-[120px] p-4 rounded-lg flex flex-col justify-between transition-all relative shadow-sm",
                  bgColorMap[estado],
                  isInteractive
                    ? "cursor-pointer hover:scale-[1.03] hover:shadow-lg hover:z-10"
                    : "cursor-default opacity-85",
                ].join(" ")}
                title={
                  comerciante
                    ? `${puesto.codigo}: ${comerciante.contribuyente} — ${config.label}`
                    : `${puesto.codigo}: Vacante`
                }
              >
                {/* Código de puesto */}
                <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider">
                  {puesto.codigo}
                </span>

                {comerciante ? (
                  <div className="mt-auto">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {comerciante.contribuyente}
                    </p>
                    <p className="text-[9px] text-white/75 font-mono mt-1">
                      {comerciante.ciu}
                    </p>
                  </div>
                ) : (
                  <p className="mt-auto text-[10px] text-white/70 font-medium">
                    Vacante
                  </p>
                )}

                {/* Badge de estado */}
                <span className="absolute top-2 right-2 text-[8px] font-bold text-white bg-black/30 rounded px-1.5 py-0.5">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-4 px-1">
        {(
          ["Presente", "Ausente", "Observacion", "Permiso", "Pendiente", "Vacante"] as const
        ).map((key) => {
          const config = ESTADO_CONFIG[key];
          const bgMap: Record<string, string> = {
            Presente: "bg-green-700",
            Ausente: "bg-red-700",
            Observacion: "bg-blue-600",
            Permiso: "bg-purple-700",
            Pendiente: "bg-slate-600",
            Vacante: "bg-gray-700",
          };
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded-sm ${bgMap[key]}`} />
              <span className="text-xs text-gray-700 font-medium">
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

  // ── Puestos y Comerciantes de la Nave con estado ───────────────────────────
  const puestosConEstado = useMemo(() => {
    if (!nave) return [];
    const asistenciaDelDia = getAsistenciaPorFecha(fechaStr);

    return nave.puestos.map((puesto) => {
      const comerciante = puesto.comercianteId
        ? getComerciantePorId(puesto.comercianteId)
        : null;

      let estado: EstadoAsistencia | "Vacante" = "Vacante";
      if (puesto.estado === "Ocupado" && comerciante) {
        const overrideKey = `${comerciante.idInterno}:${fechaStr}`;
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
  }, [nave, fechaStr, overrides]);

  // ── Filtro Global y Ordenamiento Alfanumérico por Código de Puesto ────────
  const comerciantesFiltrados = useMemo(() => {
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

    return [...filtrados].sort((a, b) =>
      a.puesto.codigo.localeCompare(b.puesto.codigo, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [puestosConEstado, searchQuery]);

  // Días anteriores (excluyendo hoy, para el contenedor con scroll independiente)
  const DIAS_MOSTRADOS = 14;
  const pastDates = useMemo(() => {
    const today = new Date();
    const start = subDays(today, DIAS_MOSTRADOS);
    const end = subDays(today, 1);
    const dates = eachDayOfInterval({ start, end });
    // Si se seleccionó una fecha pasada fuera del intervalo, la incluimos
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

  function handleEstadoChange(comercianteId: string, estado: EstadoAsistencia) {
    const key = `${comercianteId}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: estado }));
    setEstadoAsistencia(comercianteId, fechaStr, estado);
  }

  function handleOpenModal(puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) {
    setModalData({ puesto, comerciante, estado });
  }

  function handleAsignarPermisoDirecto(comercianteId: string, inicio: string, fin: string) {
    setPermisoComercianteRango(comercianteId, inicio, fin);

    // Actualizar overrides para reflejar permiso en las fechas
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
    toast.success("Permiso asignado exitosamente", {
      description: `Rango: ${inicio} al ${fin}.`,
    });
  }

  function handleObservacionSaveDirecto(comercianteId: string, texto: string) {
    const key = `${comercianteId}:${fechaStr}`;
    setOverrides((prev) => ({ ...prev, [key]: "Observacion" }));
    setEstadoAsistencia(
      comercianteId,
      fechaStr,
      "Observacion",
      "Novedad reportada por supervisor",
      texto
    );
    toast.success("Observación registrada exitosamente", {
      description: "Se ha actualizado la novedad del comerciante.",
    });
  }

  function handlePermisoAsignado(inicio: string, fin: string) {
    if (!modalData) return;
    handleAsignarPermisoDirecto(modalData.comerciante.idInterno, inicio, fin);
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
    handleObservacionSaveDirecto(obsCommerciante.idInterno, texto);
    setObsDialogOpen(false);
    setObsCommerciante(null);
  }

  // Manejar novedad desde el modal de detalle
  function handleNovedadDesdeModal(comercianteId: string, texto: string) {
    handleObservacionSaveDirecto(comercianteId, texto);
    // Actualizar el estado del modal
    if (modalData && modalData.comerciante.idInterno === comercianteId) {
      setModalData({ ...modalData, estado: "Observacion" });
    }
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
          {/* Contenedor izquierdo: pastillas de fechas anteriores con scroll horizontal */}
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

        {/* Barra de búsqueda + toggle vista (forzado en una sola fila en móviles) */}
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
    </div>
  );
}
