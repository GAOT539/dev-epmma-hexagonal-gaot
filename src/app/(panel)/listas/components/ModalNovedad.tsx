"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Eye as EyeIcon,
  MessageSquareWarning,
  ShieldAlert,
  X,
  XCircle,
  Trash2,
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
import type {
  EstadoAsistencia,
  Puesto,
  Comerciante,
} from "@/domain/models/comerciante.model";
import type { RegistroAsistencia } from "@/domain/models/asistencia.model";
import { asistenciaService } from "@/application/services/asistencia.service";

export const ESTADO_CONFIG: Record<
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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-institucional-whiteSmoke p-2.5">
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-semibold text-base-eerieBlack mt-0.5 truncate">
        {value}
      </p>
    </div>
  );
}

// ── Modal de Observación (textarea rápido) ───────────────────────────────────

export function ObservacionDialog({
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
    <Dialog open={open} disablePointerDismissal={true} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
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

// ── Modal Principal de Comerciante (Detalles, Novedad, Permiso) ───────────────

export function ComercianteModal({
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
  const [registroActual, setRegistroActual] = useState<RegistroAsistencia | null>(null);
  const [registroAyer, setRegistroAyer] = useState<RegistroAsistencia | null>(null);
  const [estadoActual, setEstadoActual] = useState<EstadoAsistencia>(estadoInicial);
  const [novedadTexto, setNovedadTexto] = useState("");
  const [permisoInicio, setPermisoInicio] = useState(fecha);
  const [permisoFin, setPermisoFin] = useState(fecha);
  const [openInicio, setOpenInicio] = useState(false);
  const [openFin, setOpenFin] = useState(false);
  const [permisoError, setPermisoError] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState<{
    id: string;
    tipo: "observacion" | "permiso";
  } | null>(null);
  const [eliminandoItem, setEliminandoItem] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function cargarHistorial() {
      const fechaAyer = formatDate(subDays(new Date(fecha + "T00:00:00"), 1));
      const [actual, ayer] = await Promise.all([
        asistenciaService.obtenerAsistenciaComerciantePorFecha(comerciante.idInterno, fecha),
        asistenciaService.obtenerAsistenciaComerciantePorFecha(comerciante.idInterno, fechaAyer),
      ]);
      if (!cancel) {
        setRegistroActual(actual);
        setRegistroAyer(ayer);
        if (actual) {
          const obs = actual.observacionTexto || actual.observacion || "";
          setNovedadTexto(obs);
          if (actual.permisoInicio) setPermisoInicio(actual.permisoInicio);
          if (actual.permisoFin) setPermisoFin(actual.permisoFin);
        }
      }
    }
    cargarHistorial();
    return () => {
      cancel = true;
    };
  }, [comerciante.idInterno, fecha]);

  const observacionExistente = registroActual?.observacionTexto || registroActual?.observacion || "";
  const tieneObservacionPrevia = Boolean(observacionExistente.trim());
  const tienePermisoPrevio = estadoInicial === "Permiso" || Boolean(registroActual?.permisoInicio);

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

  const [confirmAlert, setConfirmAlert] = useState<{
    isOpen: boolean;
    nuevoEstado: "Presente" | "Ausente";
    tipo: "observacion" | "permiso";
    mensaje: string;
  } | null>(null);

  const [panelActivo, setPanelActivo] = useState<"observacion" | "permiso" | null>(() => {
    if (estadoInicial === "Observacion") return "observacion";
    if (estadoInicial === "Permiso") return "permiso";
    return null;
  });

  const estadoConfig = ESTADO_CONFIG[estadoActual] ?? ESTADO_CONFIG["Pendiente"];

  const observacionAnterior =
    registroAyer?.estado === "Observacion" ? (registroAyer.observacionTexto || registroAyer.observacion) : null;

  async function handleSeleccionarEstado(nuevoEstado: "Presente" | "Ausente") {
    if (estadoActual === nuevoEstado && panelActivo === null) return;

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

    setPanelActivo(null);
    setEstadoActual(nuevoEstado);
    await asistenciaService.registrarAsistencia(comerciante.idInterno, fecha, nuevoEstado);
    onEstadoChange(nuevoEstado);
    toast.success(`Asistencia registrada como ${nuevoEstado}`);
  }

  async function handleConfirmarCambio() {
    if (!confirmAlert) return;
    const { nuevoEstado, tipo } = confirmAlert;

    if (tipo === "observacion") {
      setNovedadTexto("");
      setPanelActivo(null);
      setEstadoActual(nuevoEstado);
      await asistenciaService.registrarAsistencia(comerciante.idInterno, fecha, nuevoEstado, undefined, undefined);
      onEstadoChange(nuevoEstado);
      toast.success(`Asistencia registrada como ${nuevoEstado}`, {
        description: "Se eliminó la observación registrada para este día.",
      });
    } else if (tipo === "permiso") {
      setPermisoInicio("");
      setPermisoFin("");
      setPanelActivo(null);
      setEstadoActual(nuevoEstado);
      await asistenciaService.registrarAsistencia(comerciante.idInterno, fecha, nuevoEstado, undefined, undefined);
      onEstadoChange(nuevoEstado);
      toast.success(`Asistencia registrada como ${nuevoEstado}`, {
        description: "Se eliminó el permiso asignado.",
      });
    }

    setConfirmAlert(null);
  }

  function handleToggleObservacion() {
    setPanelActivo((actual) => (actual === "observacion" ? null : "observacion"));
  }

  function handleTogglePermiso() {
    setPanelActivo((actual) => (actual === "permiso" ? null : "permiso"));
  }

  const yaExistePermisoParaFecha = Boolean(
    registroActual?.permisos?.some((p) => p.fecha === permisoInicio)
  );

  async function handleGuardarObservacion() {
    if (!novedadTexto.trim()) return;
    await onNovedadGuardada(comerciante.idInterno, novedadTexto.trim());
    setEstadoActual("Observacion");
    onEstadoChange("Observacion");
    setNovedadTexto("");
    const actualizado = await asistenciaService.obtenerAsistenciaComerciantePorFecha(
      comerciante.idInterno,
      fecha
    );
    setRegistroActual(actualizado);
  }

  async function handleGuardarPermiso() {
    setPermisoError("");
    if (!permisoInicio || !permisoFin) {
      setPermisoError("Debe seleccionar fecha de inicio y fin.");
      return;
    }
    if (permisoInicio > permisoFin) {
      setPermisoError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }
    if (yaExistePermisoParaFecha) {
      setPermisoError("Ya existe un permiso registrado para esta fecha.");
      return;
    }
    await onPermisoAsignado(permisoInicio, permisoFin);
    setEstadoActual("Permiso");
    onEstadoChange("Permiso");
    const actualizado = await asistenciaService.obtenerAsistenciaComerciantePorFecha(
      comerciante.idInterno,
      fecha
    );
    setRegistroActual(actualizado);
  }

  async function handleConfirmarEliminacion() {
    if (!itemAEliminar) return;
    try {
      setEliminandoItem(true);
      if (itemAEliminar.tipo === "observacion") {
        await asistenciaService.eliminarObservacion(
          comerciante.idInterno,
          fecha,
          itemAEliminar.id
        );
        toast.success("Observación eliminada correctamente");
      } else {
        await asistenciaService.eliminarPermiso(
          comerciante.idInterno,
          fecha,
          itemAEliminar.id
        );
        toast.success("Permiso eliminado correctamente");
      }
      const actualizado = await asistenciaService.obtenerAsistenciaComerciantePorFecha(
        comerciante.idInterno,
        fecha
      );
      setRegistroActual(actualizado);
      if (actualizado) {
        setEstadoActual(actualizado.estado);
        onEstadoChange(actualizado.estado);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setEliminandoItem(false);
      setItemAEliminar(null);
    }
  }

  return (
    <Dialog open={true} disablePointerDismissal={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
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
              <span className="text-xs text-acento-morado font-medium">
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

          {/* 2 & 3. Subpanel Desplegable: Observación */}
          {panelActivo === "observacion" && (
            <div className="rounded-xl bg-blue-50/60 p-4 space-y-3 ring-1 ring-blue-200 animate-in fade-in-50 duration-150">
              <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                <AlertTriangle size={16} className="text-blue-600" />
                Registrar Observación
              </h3>

              {/* Listado Histórico de Observaciones */}
              {registroActual?.observaciones && registroActual.observaciones.length > 0 && (
                <div className="space-y-1.5 pb-2">
                  <span className="text-xs font-semibold text-blue-900 block">
                    Observaciones registradas ({registroActual.observaciones.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {registroActual.observaciones.map((obs) => (
                      <div
                        key={obs.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-base-white px-2.5 py-1.5 border border-blue-200 text-xs shadow-xs"
                      >
                        <div className="min-w-0 flex-1 leading-snug">
                          <span className="font-semibold text-blue-700 mr-1.5">
                            {obs.fechaHora}
                          </span>
                          <span className="text-gray-800 break-words">- {obs.texto}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemAEliminar({ id: obs.id, tipo: "observacion" })}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 shrink-0"
                          title="Eliminar observación"
                          aria-label="Eliminar observación"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Textarea
                placeholder="Escriba la nueva observación o situación a reportar..."
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

              {observacionAnterior && (
                <div className="mt-2 rounded-lg bg-blue-100/60 p-3 ring-1 ring-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    📋 Observación anterior:
                  </p>
                  <p className="text-xs text-blue-900 leading-relaxed">
                    {observacionAnterior}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2 & 3. Subpanel Desplegable: Permiso */}
          {panelActivo === "permiso" && (
            <div className="rounded-xl bg-purple-50/60 p-4 space-y-3 ring-1 ring-purple-200 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-base-eerieBlack flex items-center gap-2">
                  <ShieldAlert size={16} className="text-acento-morado" />
                  {tienePermisoPrevio ? "Editar Permiso" : "Asignar Permiso"}
                </h3>
                {tienePermisoPrevio && (
                  <span className="text-xs font-semibold text-acento-morado bg-purple-100 rounded-full px-2.5 py-0.5">
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

              {/* Alerta proactiva si la fecha ya tiene un permiso */}
              {yaExistePermisoParaFecha && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800 border border-amber-200">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>Ya existe un permiso registrado para la fecha seleccionada ({permisoInicio}).</span>
                </div>
              )}

              {permisoError && (
                <p className="text-xs text-base-red font-medium">{permisoError}</p>
              )}

              {/* Listado Histórico de Permisos (Parte Inferior) */}
              {registroActual?.permisos && registroActual.permisos.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-purple-200">
                  <span className="text-xs font-semibold text-purple-900 block">
                    Permisos registrados ({registroActual.permisos.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {registroActual.permisos.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-base-white px-2.5 py-1.5 border border-purple-200 text-xs shadow-xs"
                      >
                        <div className="min-w-0 flex-1 leading-snug">
                          <span className="font-semibold text-acento-morado mr-1.5">
                            {perm.fecha}:
                          </span>
                          <span className="text-gray-800 break-words">{perm.motivo}</span>
                          {perm.fechaInicio && perm.fechaFin && perm.fechaInicio !== perm.fechaFin && (
                            <span className="block text-[11px] text-gray-500">
                              (Vigencia: {perm.fechaInicio} al {perm.fechaFin})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemAEliminar({ id: perm.id, tipo: "permiso" })}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 shrink-0"
                          title="Eliminar permiso"
                          aria-label="Eliminar permiso"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleGuardarPermiso}
                disabled={yaExistePermisoParaFecha || !permisoInicio || !permisoFin}
                size="sm"
                className="w-full bg-acento-morado hover:bg-acento-morado/90 text-white font-semibold disabled:opacity-40"
              >
                Confirmar Permiso
              </Button>
            </div>
          )}
        </div>

        {/* Modal de Confirmación de Eliminación Seguro (Fase 4) */}
        <Dialog
          open={Boolean(itemAEliminar)}
          disablePointerDismissal={true}
          onOpenChange={(open) => {
            if (!open && !eliminandoItem) setItemAEliminar(null);
          }}
        >
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-base-red">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Confirmar eliminación
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-700 font-medium pt-2 leading-relaxed">
                {itemAEliminar?.tipo === "observacion"
                  ? "¿Está seguro de que desea eliminar esta observación? Esta acción no se puede deshacer."
                  : "¿Está seguro de que desea eliminar este permiso? Esta acción no se puede deshacer."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={eliminandoItem}
                onClick={() => setItemAEliminar(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={eliminandoItem}
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                onClick={handleConfirmarEliminacion}
              >
                {eliminandoItem ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Advertencia de Pérdida de Datos */}
        <Dialog
          open={Boolean(confirmAlert?.isOpen)}
          disablePointerDismissal={true}
          onOpenChange={(open) => {
            if (!open) setConfirmAlert(null);
          }}
        >
          <DialogContent className="sm:max-w-md p-6">
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
