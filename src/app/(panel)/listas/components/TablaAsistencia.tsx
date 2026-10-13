"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye as EyeIcon,
  ShieldAlert,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  EstadoAsistencia,
  Puesto,
  Comerciante,
} from "@/domain/models/comerciante.model";
import type { RegistroAsistencia } from "@/domain/models/asistencia.model";
import { asistenciaService } from "@/application/services/asistencia.service";
import { ESTADO_CONFIG } from "./ModalNovedad";

// ── Botón de acción de estado ────────────────────────────────────────────────

export function AccionBtn({
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

// ── Tarjeta de puesto/comerciante ────────────────────────────────────────────

export function PuestoCard({
  puesto,
  comerciante,
  estado,
  fecha,
  registro,
  onEstadoChange,
  onDoubleClick,
  onObservacionGuardada,
  onPermisoAsignado,
  onActualizarAsistencia,
}: {
  puesto: Puesto;
  comerciante: Comerciante | null;
  estado: EstadoAsistencia | "Vacante";
  fecha: string;
  registro?: RegistroAsistencia | null;
  onEstadoChange: (estado: EstadoAsistencia) => void;
  onDoubleClick: () => void;
  onObservacionGuardada: (comercianteId: string, texto: string) => Promise<void> | void;
  onPermisoAsignado: (
    comercianteId: string,
    inicio: string,
    fin: string,
    motivo?: string
  ) => Promise<void> | void;
  onActualizarAsistencia?: () => Promise<void> | void;
}) {
  const config = ESTADO_CONFIG[estado];
  const isVacante = puesto.estado === "Vacante";

  const [panelActivo, setPanelActivo] = useState<"observacion" | "permiso" | null>(null);
  const [obsTexto, setObsTexto] = useState("");
  const [permisoInicio, setPermisoInicio] = useState(fecha);
  const [permisoFin, setPermisoFin] = useState(fecha);
  const [permisoMotivo, setPermisoMotivo] = useState("Permiso concedido");
  const [permisoError, setPermisoError] = useState("");

  // Estado para eliminación segura con confirmación (Fase 4)
  const [itemAEliminar, setItemAEliminar] = useState<{
    id: string;
    tipo: "observacion" | "permiso";
  } | null>(null);
  const [eliminando, setEliminando] = useState(false);

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
          <span className="inline-flex items-center rounded-full bg-institucional-whiteSmokeBlack/15 px-2 py-0.5 text-xs font-semibold text-gray-700 mt-0.5">
            Vacante
          </span>
        </div>
      </article>
    );
  }

  // Validación proactiva de fecha para permisos (Fase 3)
  const yaExistePermisoFecha = Boolean(
    registro?.permisos?.some((p) => p.fecha === permisoInicio)
  );

  async function handleGuardarObservacion(e: React.MouseEvent) {
    e.stopPropagation();
    if (!comerciante || !obsTexto.trim()) return;
    await onObservacionGuardada(comerciante.idInterno, obsTexto.trim());
    setObsTexto("");
    if (onActualizarAsistencia) {
      await onActualizarAsistencia();
    }
  }

  async function handleGuardarPermiso(e: React.MouseEvent) {
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
    if (yaExistePermisoFecha) {
      setPermisoError("Ya existe un permiso registrado para esta fecha.");
      return;
    }
    await onPermisoAsignado(
      comerciante.idInterno,
      permisoInicio,
      permisoFin,
      permisoMotivo.trim() || "Permiso concedido"
    );
    if (onActualizarAsistencia) {
      await onActualizarAsistencia();
    }
  }

  // Acción de confirmación de eliminación (Fase 4)
  async function handleConfirmarEliminacion() {
    if (!itemAEliminar || !comerciante) return;
    try {
      setEliminando(true);
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
      if (onActualizarAsistencia) {
        await onActualizarAsistencia();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setEliminando(false);
      setItemAEliminar(null);
    }
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
              <span className="text-xs text-gray-700 font-semibold">
                {puesto.codigo}
              </span>
              {comerciante && (
                <span className="text-xs text-gray-700 font-medium">
                  CIU: {comerciante.ciu}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}
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

      {/* ── Subpanel Desplegable: Observación (Fase 3 & Fase 4) ── */}
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

          {/* Listado Histórico de Observaciones con Botón de Eliminar */}
          {registro?.observaciones && registro.observaciones.length > 0 && (
            <div className="space-y-1.5 pb-1">
              <span className="text-[11px] font-semibold text-blue-900 block">
                Historial de observaciones registradas ({registro.observaciones.length}):
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {registro.observaciones.map((obs) => (
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemAEliminar({ id: obs.id, tipo: "observacion" });
                      }}
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
              Cerrar
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

      {/* ── Subpanel Desplegable: Permiso (Fase 3 & Fase 4) ── */}
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
              <label className="text-xs font-medium text-gray-700">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={permisoInicio}
                onChange={(e) => {
                  setPermisoInicio(e.target.value);
                  setPermisoError("");
                }}
                className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">
                Fecha de Fin
              </label>
              <input
                type="date"
                value={permisoFin}
                onChange={(e) => {
                  setPermisoFin(e.target.value);
                  setPermisoError("");
                }}
                className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700">
              Motivo del Permiso
            </label>
            <input
              type="text"
              value={permisoMotivo}
              onChange={(e) => setPermisoMotivo(e.target.value)}
              placeholder="Ej. Cita médica, Trámite personal..."
              className="mt-1 h-8 w-full rounded-lg border border-purple-200 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-acento-morado focus:ring-1 focus:ring-acento-morado/30"
            />
          </div>

          {/* Alerta Proactiva de Restricción de Fecha en Permisos */}
          {yaExistePermisoFecha && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800 border border-amber-200">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" />
              <span>Ya existe un permiso registrado para la fecha seleccionada ({permisoInicio}).</span>
            </div>
          )}

          {permisoError && (
            <p className="text-xs text-base-red font-medium">{permisoError}</p>
          )}

          {/* Listado Histórico de Permisos (Parte Inferior del Recuadro) */}
          {registro?.permisos && registro.permisos.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-purple-200">
              <span className="text-[11px] font-semibold text-purple-900 block">
                Historial de permisos registrados ({registro.permisos.length}):
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {registro.permisos.map((perm) => (
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemAEliminar({ id: perm.id, tipo: "permiso" });
                      }}
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

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPanelActivo(null)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={yaExistePermisoFecha || !permisoInicio || !permisoFin}
              className="h-8 text-xs bg-acento-morado hover:bg-acento-morado/90 text-white font-semibold disabled:opacity-40"
              onClick={handleGuardarPermiso}
            >
              Confirmar Permiso
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmación Seguro para Eliminación (Fase 4) ── */}
      <Dialog
        open={Boolean(itemAEliminar)}
        disablePointerDismissal={true}
        onOpenChange={(open) => {
          if (!open && !eliminando) setItemAEliminar(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-base-red">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
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
              disabled={eliminando}
              onClick={() => setItemAEliminar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={eliminando}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
              onClick={handleConfirmarEliminacion}
            >
              {eliminando ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

// ── Lista de Puestos ─────────────────────────────────────────────────────────

export function PuestosList({
  items,
  fecha,
  onEstadoChange,
  onOpenModal,
  onObservacionGuardada,
  onPermisoAsignado,
  onActualizarAsistencia,
}: {
  items: {
    puesto: Puesto;
    comerciante: Comerciante | null;
    estado: EstadoAsistencia | "Vacante";
    registro?: RegistroAsistencia | null;
  }[];
  fecha: string;
  onEstadoChange: (comercianteId: string, estado: EstadoAsistencia) => void;
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
  onObservacionGuardada: (comercianteId: string, texto: string) => Promise<void> | void;
  onPermisoAsignado: (
    comercianteId: string,
    inicio: string,
    fin: string,
    motivo?: string
  ) => Promise<void> | void;
  onActualizarAsistencia?: () => Promise<void> | void;
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
            registro={item.registro}
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
            onActualizarAsistencia={onActualizarAsistencia}
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

export function TreemapView({
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
                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                  {puesto.codigo}
                </span>

                {comerciante ? (
                  <div className="mt-auto">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {comerciante.contribuyente}
                    </p>
                    <p className="text-xs text-white/80 font-mono mt-1">
                      {comerciante.ciu}
                    </p>
                  </div>
                ) : (
                  <p className="mt-auto text-xs text-white/80 font-medium">
                    Vacante
                  </p>
                )}

                {/* Badge de estado */}
                <span className="absolute top-2 right-2 text-xs font-bold text-white bg-black/35 rounded px-2 py-0.5">
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
