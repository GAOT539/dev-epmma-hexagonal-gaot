"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye as EyeIcon,
  MessageSquareWarning,
  ShieldAlert,
  X,
  XCircle,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { es } from "date-fns/locale";
import type {
  EstadoAsistencia,
  Puesto,
  Comerciante,
} from "@/domain/models/comerciante.model";
import type { RegistroAsistencia, TipoObservacion } from "@/domain/models/asistencia.model";
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
  Permiso: {
    bg: "bg-purple-700",
    text: "text-white",
    ring: "ring-purple-700/30",
    label: "Permiso",
  },
  Vacante: {
    bg: "bg-amber-500",
    text: "text-white",
    ring: "ring-amber-500/35",
    label: "Vacante",
  },
};

export function BadgeTipoObservacion({
  tipo,
  numeroDocumento,
}: {
  tipo?: TipoObservacion;
  numeroDocumento?: string;
}) {
  if (tipo === "Citaciones") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
        Citación{numeroDocumento ? ` - Doc: #${numeroDocumento}` : ""}
      </span>
    );
  }
  if (tipo === "Notificación") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
        Notificación{numeroDocumento ? ` - Doc: #${numeroDocumento}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[10px]">
      General
    </span>
  );
}

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
  onSave: (texto: string, tipo?: TipoObservacion, numeroDocumento?: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoObservacion>("ObservacionesGeneral");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [texto, setTexto] = useState("");

  const requiereDocumento = tipo === "Citaciones" || tipo === "Notificación";
  const puedeGuardar = texto.trim().length > 0 && (!requiereDocumento || numeroDocumento.trim().length > 0);

  function handleSave() {
    if (!puedeGuardar) return;
    onSave(texto.trim(), tipo, requiereDocumento ? numeroDocumento.trim() : undefined);
    setTexto("");
    setNumeroDocumento("");
    setTipo("ObservacionesGeneral");
  }

  function handleClose() {
    setTexto("");
    setNumeroDocumento("");
    setTipo("ObservacionesGeneral");
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

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Tipo de Observación</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoObservacion)}
              className="w-full h-9 rounded-lg border border-gray-300 bg-base-white px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ObservacionesGeneral">Observación General</option>
              <option value="Citaciones">Citación</option>
              <option value="Notificación">Notificación</option>
            </select>
          </div>

          {requiereDocumento && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">
                Número de Referencia / Documento <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ingrese Nro. de referencia o documento..."
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                className="text-xs border-blue-200 focus-visible:ring-blue-500"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Detalle / Motivo</label>
            <Textarea
              placeholder="Describa la novedad o situación observada..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="resize-none border-blue-200 focus-visible:ring-blue-500 text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!puedeGuardar}
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
  soloLectura = false,
}: {
  comerciante: Comerciante;
  puesto: Puesto;
  estado: EstadoAsistencia;
  fecha: string;
  onClose: () => void;
  onPermisoAsignado: (inicio: string, fin: string, motivo?: string) => void;
  onNovedadGuardada: (comercianteId: string, texto: string, tipo?: TipoObservacion, numeroDocumento?: string) => Promise<void> | void;
  onEstadoChange: (estado: EstadoAsistencia) => void;
  soloLectura?: boolean;
}) {
  const [registroActual, setRegistroActual] = useState<RegistroAsistencia | null>(null);
  const [registroAyer, setRegistroAyer] = useState<RegistroAsistencia | null>(null);
  const [estadoActual, setEstadoActual] = useState<EstadoAsistencia>(estadoInicial);
  const [novedadTexto, setNovedadTexto] = useState("");
  const [tipoObservacion, setTipoObservacion] = useState<TipoObservacion>("ObservacionesGeneral");
  const [numeroDocumentoObs, setNumeroDocumentoObs] = useState("");
  const [permisoMotivo, setPermisoMotivo] = useState("");
  const [fechaInicioPermiso, setFechaInicioPermiso] = useState<Date | undefined>(
    () => new Date(fecha + "T00:00:00")
  );
  const [fechaFinPermiso, setFechaFinPermiso] = useState<Date | undefined>(
    () => new Date(fecha + "T00:00:00")
  );
  const [openInicio, setOpenInicio] = useState(false);
  const [openFin, setOpenFin] = useState(false);
  const [permisoError, setPermisoError] = useState("");
  const [fechaInicioJust, setFechaInicioJust] = useState<Date | undefined>(
    () => new Date(fecha + "T00:00:00")
  );
  const [fechaFinJust, setFechaFinJust] = useState<Date | undefined>(
    () => new Date(fecha + "T00:00:00")
  );
  const [openInicioJust, setOpenInicioJust] = useState(false);
  const [openFinJust, setOpenFinJust] = useState(false);
  const [motivoJust, setMotivoJust] = useState("");
  const [justificandoFalta, setJustificandoFalta] = useState(false);
  const [justificarError, setJustificarError] = useState("");
  const [mostrarJustificarFalta, setMostrarJustificarFalta] = useState(false);
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
          if (actual.permisoInicio && actual.permisoFin) {
            setFechaInicioPermiso(new Date(actual.permisoInicio + "T00:00:00"));
            setFechaFinPermiso(new Date(actual.permisoFin + "T00:00:00"));
          }
        }
      }
    }
    cargarHistorial();
    return () => {
      cancel = true;
    };
  }, [comerciante.idInterno, fecha]);

  const observacionExistente = registroActual?.observacionTexto || registroActual?.observacion || "";
  const tieneObservacionPrevia = Boolean(observacionExistente.trim()) || Boolean(registroActual?.observaciones && registroActual.observaciones.length > 0);
  const tienePermisoPrevio = estadoInicial === "Permiso" || Boolean(registroActual?.permisoInicio) || Boolean(registroActual?.permisos && registroActual.permisos.length > 0);

  const [confirmAlert, setConfirmAlert] = useState<{
    isOpen: boolean;
    nuevoEstado: "Presente" | "Ausente";
    tipo: "permiso";
    mensaje: string;
  } | null>(null);

  const [panelActivo, setPanelActivo] = useState<"observacion" | "permiso" | null>(() => {
    if (estadoInicial === "Permiso") return "permiso";
    return null;
  });

  const estadoConfig = ESTADO_CONFIG[estadoActual] ?? ESTADO_CONFIG["Presente"];

  const observacionAnterior =
    registroAyer?.observacionTexto || registroAyer?.observacion || null;

  async function handleSeleccionarEstado(nuevoEstado: "Presente" | "Ausente") {
    if (estadoActual === nuevoEstado && panelActivo === null) return;

    if (estadoActual === "Permiso" || tienePermisoPrevio) {
      setConfirmAlert({
        isOpen: true,
        nuevoEstado,
        tipo: "permiso",
        mensaje:
          "Cambiar la asistencia a " + nuevoEstado + " modificará el estado del comerciante. ¿Desea continuar?",
      });
      return;
    }

    setPanelActivo(null);
    setMostrarJustificarFalta(false);
    setEstadoActual(nuevoEstado);
    await asistenciaService.registrarAsistencia(comerciante.idInterno, fecha, nuevoEstado);
    onEstadoChange(nuevoEstado);
    toast.success(`Asistencia registrada como ${nuevoEstado}`);
  }

  async function handleConfirmarCambio() {
    if (!confirmAlert) return;
    const { nuevoEstado } = confirmAlert;

    setFechaInicioPermiso(undefined);
    setFechaFinPermiso(undefined);
    setPanelActivo(null);
    setMostrarJustificarFalta(false);
    setEstadoActual(nuevoEstado);
    await asistenciaService.registrarAsistencia(comerciante.idInterno, fecha, nuevoEstado, undefined, undefined);
    onEstadoChange(nuevoEstado);
    toast.success(`Asistencia registrada como ${nuevoEstado}`, {
      description: "Se eliminó el permiso asignado.",
    });

    setConfirmAlert(null);
  }

  function handleToggleObservacion() {
    setPanelActivo((actual) => (actual === "observacion" ? null : "observacion"));
    setMostrarJustificarFalta(false);
  }

  function handleTogglePermiso() {
    setPanelActivo((actual) => {
      if (actual === "permiso") {
        setMostrarJustificarFalta(false);
        return null;
      }
      return "permiso";
    });
  }

  const fechaInicioSel = fechaInicioPermiso ? format(fechaInicioPermiso, "yyyy-MM-dd") : "";
  const fechaFinSel = fechaFinPermiso ? format(fechaFinPermiso, "yyyy-MM-dd") : "";

  const yaExistePermisoRango = Boolean(
    registroActual?.permisos?.some(
      (p) => p.fechaInicio === fechaInicioSel && p.fechaFin === fechaFinSel
    )
  );

  async function handleGuardarObservacion() {
    if (!novedadTexto.trim()) return;
    const requiereDoc = tipoObservacion === "Citaciones" || tipoObservacion === "Notificación";
    if (requiereDoc && !numeroDocumentoObs.trim()) return;

    // Requerimiento 1: Aditivo en el historial, NO muta el estado principal
    await onNovedadGuardada(
      comerciante.idInterno,
      novedadTexto.trim(),
      tipoObservacion,
      requiereDoc ? numeroDocumentoObs.trim() : undefined
    );
    setNovedadTexto("");
    setNumeroDocumentoObs("");
    setTipoObservacion("ObservacionesGeneral");
    const actualizado = await asistenciaService.obtenerAsistenciaComerciantePorFecha(
      comerciante.idInterno,
      fecha
    );
    setRegistroActual(actualizado);
    toast.success("Observación registrada exitosamente");
  }

  async function handleGuardarPermiso() {
    setPermisoError("");
    if (!fechaInicioSel || !fechaFinSel) {
      setPermisoError("Debe seleccionar la Fecha de Inicio y la Fecha de Fin.");
      return;
    }
    if (fechaFinPermiso! < fechaInicioPermiso!) {
      setPermisoError("La Fecha de Fin no puede ser anterior a la Fecha de Inicio.");
      return;
    }
    if (!permisoMotivo.trim()) {
      setPermisoError("Debe ingresar el Motivo / N° Doc. del permiso.");
      return;
    }
    if (yaExistePermisoRango) {
      setPermisoError("Ya existe un permiso registrado para este rango de fechas.");
      return;
    }
    await onPermisoAsignado(fechaInicioSel, fechaFinSel, permisoMotivo.trim());
    setEstadoActual("Permiso");
    onEstadoChange("Permiso");
    const actualizado = await asistenciaService.obtenerAsistenciaComerciantePorFecha(
      comerciante.idInterno,
      fecha
    );
    setRegistroActual(actualizado);
    toast.success("Permiso asignado exitosamente", {
      description: `Vigencia: ${fechaInicioSel} al ${fechaFinSel}.`,
    });
  }

  async function handleJustificarFalta() {
    setJustificarError("");
    if (!fechaInicioJust || !fechaFinJust) {
      setJustificarError("Debe seleccionar la Fecha de Inicio y la Fecha de Fin.");
      return;
    }
    if (fechaFinJust < fechaInicioJust) {
      setJustificarError("La Fecha de Fin no puede ser anterior a la Fecha de Inicio.");
      return;
    }
    if (!motivoJust.trim()) {
      setJustificarError("Debe ingresar el Motivo / N° Doc. de la justificación.");
      return;
    }
    try {
      setJustificandoFalta(true);
      const iniStr = format(fechaInicioJust, "yyyy-MM-dd");
      const finStr = format(fechaFinJust, "yyyy-MM-dd");
      await asistenciaService.justificarFaltaComerciante(
        comerciante.idInterno,
        iniStr,
        finStr,
        motivoJust.trim()
      );
      toast.success("Falta justificada y anotada en las observaciones de la fecha seleccionada.");
      setMotivoJust("");
      setMostrarJustificarFalta(false);
      const fechaAyer = formatDate(subDays(new Date(fecha + "T00:00:00"), 1));
      const [actual, ayer] = await Promise.all([
        asistenciaService.obtenerAsistenciaComerciantePorFecha(comerciante.idInterno, fecha),
        asistenciaService.obtenerAsistenciaComerciantePorFecha(comerciante.idInterno, fechaAyer),
      ]);
      setRegistroActual(actual);
      setRegistroAyer(ayer);
      if (actual) {
        setEstadoActual(actual.estado);
        onEstadoChange(actual.estado);
      }
    } catch (err: unknown) {
      setJustificarError(err instanceof Error ? err.message : "Error al justificar falta");
    } finally {
      setJustificandoFalta(false);
    }
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
        className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl gap-0 shadow-2xl border-0"
      >
        {/* Header con botón X explícito */}
        <div className="bg-institucional-green px-6 py-4 flex items-center justify-between shrink-0">
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Info del comerciante */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

          {/* 1. Acciones Rápidas (4 Botones o 2 en modo consulta) */}
          <div className={soloLectura ? "grid grid-cols-2 gap-3 mb-3" : "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3"}>
            {!soloLectura && (
              <>
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
              </>
            )}

            {/* Observación (Panel de Metadatos) */}
            <Button
              type="button"
              variant={panelActivo === "observacion" ? "default" : "outline"}
              className={
                panelActivo === "observacion"
                  ? "bg-blue-600 text-white hover:bg-blue-600/90 shadow-sm"
                  : "text-blue-600 border-blue-600/30 hover:bg-blue-600/10"
              }
              onClick={handleToggleObservacion}
            >
              <EyeIcon className="w-4 h-4 mr-1.5 shrink-0" />
              Observación
              {registroActual?.observaciones && registroActual.observaciones.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-blue-100 text-blue-700 font-bold">
                  {registroActual.observaciones.length}
                </span>
              )}
            </Button>

            {/* Permiso */}
            <Button
              type="button"
              variant={estadoActual === "Permiso" || panelActivo === "permiso" ? "default" : "outline"}
              className={
                estadoActual === "Permiso" || panelActivo === "permiso"
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
                {soloLectura ? "Observaciones Registradas" : "Registrar Observación"}
              </h3>

              {soloLectura ? (
                registroActual?.observaciones && registroActual.observaciones.length > 0 ? (
                  <div className="space-y-1.5 pb-2">
                    <span className="text-xs font-semibold text-blue-900 block">
                      Observaciones registradas ({registroActual.observaciones.length}):
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {registroActual.observaciones.map((obs) => (
                        <div
                          key={obs.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-base-white px-2.5 py-1.5 border border-blue-200 text-xs shadow-xs"
                        >
                          <div className="min-w-0 flex-1 leading-snug space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-blue-700 text-xs">
                                {obs.fechaHora}
                              </span>
                              <BadgeTipoObservacion tipo={obs.tipo} numeroDocumento={obs.numeroDocumento} />
                            </div>
                            <p className="text-gray-800 break-words text-xs">{obs.texto}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic py-2 text-center bg-base-white/60 rounded-lg border border-blue-100">
                    Sin observaciones registradas en esta jornada.
                  </p>
                )
              ) : (
                <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 items-start">
                  {/* Izquierda: Formulario (lg:col-span-6) */}
                  <div className="space-y-3 lg:col-span-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Tipo de Observación</label>
                      <select
                        value={tipoObservacion}
                        onChange={(e) => setTipoObservacion(e.target.value as TipoObservacion)}
                        className="w-full h-8 rounded-lg border border-gray-300 bg-base-white px-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ObservacionesGeneral">Observación General</option>
                        <option value="Citaciones">Citación</option>
                        <option value="Notificación">Notificación</option>
                      </select>
                    </div>

                    {(tipoObservacion === "Citaciones" || tipoObservacion === "Notificación") && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700">
                          Número de Referencia / Documento <span className="text-red-500">*</span>
                        </label>
                        <Input
                          placeholder="Ingrese Nro. de referencia o documento..."
                          value={numeroDocumentoObs}
                          onChange={(e) => setNumeroDocumentoObs(e.target.value)}
                          className="text-xs border-blue-200 focus-visible:ring-blue-500 bg-base-white"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Detalle de la Observación</label>
                      <Textarea
                        placeholder="Escriba la nueva observación o situación a reportar..."
                        value={novedadTexto}
                        onChange={(e) => setNovedadTexto(e.target.value)}
                        rows={3}
                        className="resize-none text-xs bg-base-white border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleGuardarObservacion}
                      disabled={
                        !novedadTexto.trim() ||
                        ((tipoObservacion === "Citaciones" || tipoObservacion === "Notificación") &&
                          !numeroDocumentoObs.trim())
                      }
                      size="sm"
                      className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                    >
                      {tieneObservacionPrevia ? "Registrar Novedad Adicional" : "Registrar Observación"}
                    </Button>
                  </div>

                  {/* Derecha: Historial y observación anterior (lg:col-span-6) */}
                  <div className="space-y-3 lg:col-span-6">
                    {registroActual?.observaciones && registroActual.observaciones.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-blue-900 block">
                          Observaciones registradas ({registroActual.observaciones.length}):
                        </span>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {registroActual.observaciones.map((obs) => (
                            <div
                              key={obs.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-base-white px-2.5 py-1.5 border border-blue-200 text-xs shadow-xs"
                            >
                              <div className="min-w-0 flex-1 leading-snug space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-blue-700 text-xs">
                                    {obs.fechaHora}
                                  </span>
                                  <BadgeTipoObservacion tipo={obs.tipo} numeroDocumento={obs.numeroDocumento} />
                                </div>
                                <p className="text-gray-800 break-words text-xs">{obs.texto}</p>
                              </div>
                              {!soloLectura && (
                                <button
                                  type="button"
                                  onClick={() => setItemAEliminar({ id: obs.id, tipo: "observacion" })}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 shrink-0"
                                  title="Eliminar observación"
                                  aria-label="Eliminar observación"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic py-2 text-center bg-base-white/60 rounded-lg border border-blue-100">
                        Sin observaciones previas registradas en esta jornada.
                      </p>
                    )}

                    {observacionAnterior && (
                      <div className="rounded-lg bg-blue-100/60 p-3 ring-1 ring-blue-200">
                        <p className="text-xs font-semibold text-blue-700 mb-1">
                          📋 Observación anterior:
                        </p>
                        <p className="text-xs text-blue-900 leading-relaxed">
                          {observacionAnterior}
                        </p>
                      </div>
                    )}
                  </div>
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
                  {soloLectura
                    ? "Permisos Registrados"
                    : tienePermisoPrevio
                    ? "Editar Permiso"
                    : "Asignar Permiso"}
                </h3>
                {tienePermisoPrevio && (
                  <span className="text-xs font-semibold text-acento-morado bg-purple-100 rounded-full px-2.5 py-0.5">
                    Permiso Activo
                  </span>
                )}
              </div>

              {soloLectura ? (
                <div className="space-y-2.5">
                  {((registroActual?.permisos && registroActual.permisos.length > 0) || (registroActual?.permisoInicio && registroActual?.permisoFin)) ? (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-purple-900 block">
                        Permisos activos / registrados:
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {registroActual?.permisos && registroActual.permisos.length > 0 ? (
                          registroActual.permisos.map((perm) => (
                            <div
                              key={perm.id}
                              className="rounded-lg bg-base-white p-2.5 border border-purple-200 text-xs shadow-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-acento-morado font-semibold">
                                <span>Vigencia: {perm.fechaInicio || perm.fecha} al {perm.fechaFin || perm.fecha}</span>
                                <span className="text-[11px] bg-purple-100 text-purple-800 rounded px-1.5 py-0.5">Activo</span>
                              </div>
                              <p className="text-gray-800 break-words font-medium">
                                <span className="text-gray-500 font-normal">Motivo: </span>{perm.motivo || "Permiso concedido"}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-base-white p-2.5 border border-purple-200 text-xs shadow-xs space-y-1">
                            <div className="flex items-center justify-between text-acento-morado font-semibold">
                              <span>Vigencia: {registroActual?.permisoInicio} al {registroActual?.permisoFin}</span>
                              <span className="text-[11px] bg-purple-100 text-purple-800 rounded px-1.5 py-0.5">Activo</span>
                            </div>
                            {registroActual?.observacion && (
                              <p className="text-gray-800 break-words font-medium">
                                <span className="text-gray-500 font-normal">Motivo: </span>{registroActual.observacion}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic py-2 text-center bg-base-white/60 rounded-lg border border-purple-100">
                      Este comerciante no registra permisos en esta fecha.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 items-start">
                  {/* Izquierda: Formulario de Permiso (lg:col-span-6) */}
                  <div className="space-y-3 lg:col-span-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Fecha de Inicio
                        </label>
                        <Popover open={openInicio} onOpenChange={setOpenInicio}>
                          <PopoverTrigger
                            type="button"
                            className="w-full inline-flex items-center justify-start rounded-lg border border-purple-200 bg-base-white px-2.5 py-1.5 text-xs font-normal text-left shadow-xs hover:bg-purple-50/50 transition-colors cursor-pointer"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-acento-morado shrink-0" />
                            <span className="truncate">{fechaInicioPermiso ? format(fechaInicioPermiso, "dd/MM/yyyy") : "Seleccionar inicio"}</span>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={fechaInicioPermiso}
                              onSelect={(d) => {
                                if (d) {
                                  setFechaInicioPermiso(d);
                                  setOpenInicio(false);
                                  setPermisoError("");
                                  if (fechaFinPermiso && d > fechaFinPermiso) {
                                    setFechaFinPermiso(d);
                                  }
                                }
                              }}
                              locale={es}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Fecha de Fin
                        </label>
                        <Popover open={openFin} onOpenChange={setOpenFin}>
                          <PopoverTrigger
                            type="button"
                            className="w-full inline-flex items-center justify-start rounded-lg border border-purple-200 bg-base-white px-2.5 py-1.5 text-xs font-normal text-left shadow-xs hover:bg-purple-50/50 transition-colors cursor-pointer"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-acento-morado shrink-0" />
                            <span className="truncate">{fechaFinPermiso ? format(fechaFinPermiso, "dd/MM/yyyy") : "Seleccionar fin"}</span>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={fechaFinPermiso}
                              onSelect={(d) => {
                                if (d) {
                                  setFechaFinPermiso(d);
                                  setOpenFin(false);
                                  setPermisoError("");
                                }
                              }}
                              disabled={(date) => (fechaInicioPermiso ? date < fechaInicioPermiso : false)}
                              locale={es}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-700">
                        Motivo / N° Doc. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={permisoMotivo}
                        onChange={(e) => setPermisoMotivo(e.target.value)}
                        placeholder="Ej. Cita médica, Oficio #123..."
                        className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
                      />
                    </div>

                    {/* Alerta proactiva si la fecha ya tiene un permiso */}
                    {yaExistePermisoRango && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800 border border-amber-200">
                        <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                        <span>Ya existe un permiso registrado para el rango seleccionado ({fechaInicioSel} al {fechaFinSel}).</span>
                      </div>
                    )}

                    {permisoError && (
                      <p className="text-xs text-base-red font-medium">{permisoError}</p>
                    )}

                    <Button
                      type="button"
                      onClick={handleGuardarPermiso}
                      disabled={yaExistePermisoRango || !fechaInicioSel}
                      size="sm"
                      className="w-full bg-acento-morado hover:bg-acento-morado/90 text-white font-semibold disabled:opacity-40"
                    >
                      Confirmar Permiso
                    </Button>
                  </div>

                  {/* Derecha: Historial de permisos y Acordeón Justificar Falta (lg:col-span-6) */}
                  <div className="space-y-3 lg:col-span-6">
                    {/* Listado Histórico de Permisos */}
                    {registroActual?.permisos && registroActual.permisos.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-purple-900 block">
                          Permisos registrados ({registroActual.permisos.length}):
                        </span>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
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

                    {/* Apartado Desplegable: Justificar Falta (Días Anteriores) */}
                    <div className="pt-2 border-t border-purple-200/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMostrarJustificarFalta((prev) => !prev);
                          setJustificarError("");
                        }}
                        className="w-full flex items-center justify-between rounded-lg bg-amber-50/80 hover:bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-300/70 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Justificar Falta (Días Anteriores)</span>
                        </span>
                        {mostrarJustificarFalta ? (
                          <ChevronUp className="text-amber-800 shrink-0" size={15} />
                        ) : (
                          <ChevronDown className="text-amber-800 shrink-0" size={15} />
                        )}
                      </button>

                      {mostrarJustificarFalta && (
                        <div className="mt-2 space-y-2.5 rounded-lg bg-amber-50/40 p-3 ring-1 ring-amber-200/60 animate-in fade-in-50 duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[11px] font-medium text-gray-700 block mb-1">
                                Fecha de Inicio
                              </label>
                              <Popover open={openInicioJust} onOpenChange={setOpenInicioJust}>
                                <PopoverTrigger
                                  type="button"
                                  className="w-full inline-flex items-center justify-start rounded-lg border border-amber-300/80 bg-base-white px-2.5 py-1.5 text-xs font-normal text-left shadow-xs hover:bg-amber-50/50 transition-colors cursor-pointer"
                                >
                                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-amber-700 shrink-0" />
                                  <span className="truncate">{fechaInicioJust ? format(fechaInicioJust, "dd/MM/yyyy") : "Seleccionar inicio"}</span>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={fechaInicioJust}
                                    onSelect={(d) => {
                                      if (d) {
                                        setFechaInicioJust(d);
                                        setOpenInicioJust(false);
                                        setJustificarError("");
                                        if (fechaFinJust && d > fechaFinJust) {
                                          setFechaFinJust(d);
                                        }
                                      }
                                    }}
                                    disabled={(date) => {
                                      const hoy = new Date();
                                      hoy.setHours(23, 59, 59, 999);
                                      return date > hoy;
                                    }}
                                    locale={es}
                                    autoFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>

                            <div>
                              <label className="text-[11px] font-medium text-gray-700 block mb-1">
                                Fecha de Fin
                              </label>
                              <Popover open={openFinJust} onOpenChange={setOpenFinJust}>
                                <PopoverTrigger
                                  type="button"
                                  className="w-full inline-flex items-center justify-start rounded-lg border border-amber-300/80 bg-base-white px-2.5 py-1.5 text-xs font-normal text-left shadow-xs hover:bg-amber-50/50 transition-colors cursor-pointer"
                                >
                                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-amber-700 shrink-0" />
                                  <span className="truncate">{fechaFinJust ? format(fechaFinJust, "dd/MM/yyyy") : "Seleccionar fin"}</span>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={fechaFinJust}
                                    onSelect={(d) => {
                                      if (d) {
                                        setFechaFinJust(d);
                                        setOpenFinJust(false);
                                        setJustificarError("");
                                      }
                                    }}
                                    disabled={(date) => {
                                      const hoy = new Date();
                                      hoy.setHours(23, 59, 59, 999);
                                      if (date > hoy) return true;
                                      if (fechaInicioJust) {
                                        const iniDate = new Date(format(fechaInicioJust, "yyyy-MM-dd") + "T00:00:00");
                                        return date < iniDate;
                                      }
                                      return false;
                                    }}
                                    locale={es}
                                    autoFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-gray-700 block">
                              Motivo / N° Doc. <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={motivoJust}
                              onChange={(e) => setMotivoJust(e.target.value)}
                              placeholder="Ej. Certificado médico #452, calamidad..."
                              className="mt-1 h-8 w-full rounded-lg border border-amber-300/80 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/30"
                            />
                          </div>

                          {justificarError && (
                            <p className="text-xs text-base-red font-medium">{justificarError}</p>
                          )}

                          <Button
                            type="button"
                            onClick={handleJustificarFalta}
                            disabled={justificandoFalta || !fechaInicioJust || !fechaFinJust || !motivoJust.trim()}
                            size="sm"
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 disabled:opacity-40"
                          >
                            {justificandoFalta ? "Justificando falta..." : "Justificar Falta"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
