"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  UserCheck,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Loader2,
  X,
} from "lucide-react";
import type { Usuario } from "@/domain/models/usuario.model";
import type { Nave } from "@/domain/models/nave.model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PermisoRegistrado {
  id: string;
  supervisorId: string;
  supervisorNombre: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  estado: string;
  creadoEn: string;
  coberturas: Array<{
    id: string;
    naveId: string;
    naveNombre: string;
    tipoCobertura: "REEMPLAZO_TEMPORAL" | "PERSISTENCIA_AUTOMATICA";
    supervisorReemplazoId?: string | null;
    supervisorReemplazoNombre?: string | null;
    estado: string;
  }>;
}

interface ModalPermisosSupervisoresProps {
  isOpen: boolean;
  onClose: () => void;
  supervisores: Usuario[];
  onCambioRealizado?: () => void;
}

export function ModalPermisosSupervisores({
  isOpen,
  onClose,
  supervisores,
  onCambioRealizado,
}: ModalPermisosSupervisoresProps) {
  const [todasLasNaves, setTodasLasNaves] = useState<Nave[]>([]);
  const [cargandoNaves, setCargandoNaves] = useState(false);

  const [permisos, setPermisos] = useState<PermisoRegistrado[]>([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);

  // Formulario Permiso
  const hoyStr = format(new Date(), "yyyy-MM-dd");
  const [supervisorAusenteId, setSupervisorAusenteId] = useState("");
  const [permisoFechaInicio, setPermisoFechaInicio] = useState(hoyStr);
  const [permisoFechaFin, setPermisoFechaFin] = useState(hoyStr);
  const [permisoMotivo, setPermisoMotivo] = useState("");
  const [coberturasForm, setCoberturasForm] = useState<
    Record<
      string,
      {
        tipoCobertura: "PERSISTENCIA_AUTOMATICA" | "REEMPLAZO_TEMPORAL";
        supervisorReemplazoId?: string;
      }
    >
  >({});

  // Cargar naves completas al abrir
  useEffect(() => {
    if (!isOpen) return;
    let activo = true;
    fetch("/api/v1/naves")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!activo) return;
        if (data?.naves) {
          setTodasLasNaves(data.naves);
        }
      })
      .catch((err) => console.error("Error al cargar naves:", err))
      .finally(() => {
        if (activo) setCargandoNaves(false);
      });
    return () => {
      activo = false;
    };
  }, [isOpen]);

  // Cargar lista de permisos
  const cargarPermisos = async () => {
    try {
      setCargandoPermisos(true);
      const res = await fetch("/api/v1/auditoria/permisos-supervisores");
      if (res.ok) {
        const data = await res.json();
        setPermisos(data.permisos || []);
      }
    } catch (err) {
      console.error("Error al cargar permisos:", err);
    } finally {
      setCargandoPermisos(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let activo = true;
    fetch("/api/v1/auditoria/permisos-supervisores")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo && data?.permisos) {
          setPermisos(data.permisos);
        }
      })
      .catch((err) => console.error("Error al cargar permisos:", err))
      .finally(() => {
        if (activo) setCargandoPermisos(false);
      });
    return () => {
      activo = false;
    };
  }, [isOpen]);

  // Naves asignadas al supervisor seleccionado
  const navesDelSupervisor = useMemo(() => {
    if (!supervisorAusenteId) return [];
    const sup = supervisores.find((s) => s.id === supervisorAusenteId);
    if (!sup) return [];

    const nombreCompleto = `${sup.nombres} ${sup.apellidos}`.replace(/\s+/g, " ").trim().toLowerCase();
    const asignadas = Array.isArray(sup.navesAsignadas)
      ? (sup.navesAsignadas as string[]).map((s) => String(s).trim().toLowerCase())
      : [];

    return todasLasNaves.filter((nave) => {
      const idNorm = nave.id.trim().toLowerCase();
      const nombreNorm = nave.nombre.trim().toLowerCase();
      const matchAsignadas = asignadas.includes(idNorm) || asignadas.includes(nombreNorm);
      const matchSupervisores =
        Array.isArray(nave.supervisores) &&
        (nave.supervisores as string[]).some(
          (sn) => String(sn).trim().toLowerCase() === nombreCompleto
        );
      return matchAsignadas || matchSupervisores;
    });
  }, [supervisorAusenteId, supervisores, todasLasNaves]);

  // Manejador del cambio de supervisor ausente con inicialización directa de coberturas
  const handleCambioSupervisorAusente = (nuevoId: string) => {
    setSupervisorAusenteId(nuevoId);
    if (!nuevoId) {
      setCoberturasForm({});
      return;
    }
    const sup = supervisores.find((s) => s.id === nuevoId);
    if (!sup) {
      setCoberturasForm({});
      return;
    }
    const nombreCompleto = `${sup.nombres} ${sup.apellidos}`.replace(/\s+/g, " ").trim().toLowerCase();
    const asignadas = Array.isArray(sup.navesAsignadas)
      ? (sup.navesAsignadas as string[]).map((s) => String(s).trim().toLowerCase())
      : [];

    const naves = todasLasNaves.filter((nave) => {
      const idNorm = nave.id.trim().toLowerCase();
      const nombreNorm = nave.nombre.trim().toLowerCase();
      const matchAsignadas = asignadas.includes(idNorm) || asignadas.includes(nombreNorm);
      const matchSupervisores =
        Array.isArray(nave.supervisores) &&
        (nave.supervisores as string[]).some(
          (sn) => String(sn).trim().toLowerCase() === nombreCompleto
        );
      return matchAsignadas || matchSupervisores;
    });

    const nuevoMap: Record<
      string,
      {
        tipoCobertura: "PERSISTENCIA_AUTOMATICA" | "REEMPLAZO_TEMPORAL";
        supervisorReemplazoId?: string;
      }
    > = {};
    for (const nave of naves) {
      nuevoMap[nave.id] = { tipoCobertura: "PERSISTENCIA_AUTOMATICA" };
    }
    setCoberturasForm(nuevoMap);
  };

  const handleGuardarPermiso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorAusenteId) {
      toast.error("Seleccione al supervisor ausente.");
      return;
    }
    if (!permisoFechaInicio || !permisoFechaFin) {
      toast.error("Las fechas de inicio y fin son obligatorias.");
      return;
    }
    if (permisoFechaInicio > permisoFechaFin) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    if (!permisoMotivo.trim()) {
      toast.error("Ingrese el motivo de la justificación o permiso.");
      return;
    }
    if (navesDelSupervisor.length === 0) {
      toast.error("El supervisor seleccionado no tiene naves asignadas activas.");
      return;
    }

    const coberturasPayload = navesDelSupervisor.map((nave) => {
      const conf = coberturasForm[nave.id] || { tipoCobertura: "PERSISTENCIA_AUTOMATICA" };
      return {
        naveId: nave.id,
        tipoCobertura: conf.tipoCobertura,
        supervisorReemplazoId:
          conf.tipoCobertura === "REEMPLAZO_TEMPORAL" ? conf.supervisorReemplazoId : undefined,
      };
    });

    for (const cob of coberturasPayload) {
      if (cob.tipoCobertura === "REEMPLAZO_TEMPORAL" && !cob.supervisorReemplazoId) {
        toast.error("Seleccione al supervisor de reemplazo temporal para cada nave delegada.");
        return;
      }
    }

    setGuardandoPermiso(true);
    try {
      const res = await fetch("/api/v1/auditoria/permisos-supervisores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorId: supervisorAusenteId,
          fechaInicio: permisoFechaInicio,
          fechaFin: permisoFechaFin,
          motivo: permisoMotivo.trim(),
          coberturas: coberturasPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al registrar el permiso.");
        return;
      }

      toast.success("Permiso y coberturas por nave registrados exitosamente.");
      setSupervisorAusenteId("");
      setPermisoMotivo("");
      setPermisoFechaInicio(hoyStr);
      setPermisoFechaFin(hoyStr);
      setCoberturasForm({});
      await cargarPermisos();
      onCambioRealizado?.();
    } catch (err) {
      console.error(err);
      toast.error("Error de comunicación al guardar el permiso.");
    } finally {
      setGuardandoPermiso(false);
    }
  };

  const handleRevocarPermiso = async (id: string) => {
    if (!window.confirm("¿Está seguro de revocar esta justificación y sus coberturas asignadas?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/auditoria/permisos-supervisores?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al revocar el permiso.");
        return;
      }
      toast.success("Permiso revocado exitosamente.");
      await cargarPermisos();
      onCambioRealizado?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al revocar el permiso.");
    }
  };

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal={true}
      onOpenChange={(open) => {
        if (!open && !guardandoPermiso) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] max-w-[96vw] sm:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border border-institucional-whiteSmokeBlack/30 bg-base-white shadow-2xl rounded-2xl gap-0"
      >
        <DialogHeader className="px-6 py-4 border-b border-institucional-whiteSmokeBlack/20 bg-institucional-whiteSmoke/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-institucional-green/10 text-institucional-green">
                <UserCheck size={22} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-institucional-green">
                  Permisos, Justificaciones y Cobertura de Supervisores
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-600">
                  Configure justificaciones con persistencia automática o reemplazo temporal por nave asignada.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Formulario de Creación (lg:col-span-5) */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleGuardarPermiso}
                className="rounded-2xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/50 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-institucional-whiteSmokeBlack/15">
                  <UserCheck size={18} className="text-institucional-green" />
                  <h3 className="text-sm font-bold text-institucional-green">
                    Registrar Justificación / Permiso con Cobertura por Nave
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* Selector de Supervisor Ausente */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Supervisor Ausente <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={supervisorAusenteId}
                      onChange={(e) => handleCambioSupervisorAusente(e.target.value)}
                      required
                      className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-xs text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
                    >
                      <option value="">-- Seleccione Supervisor --</option>
                      {supervisores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombres} {s.apellidos}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha Inicio y Fin */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Fecha Inicio <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={permisoFechaInicio}
                        onChange={(e) => setPermisoFechaInicio(e.target.value)}
                        required
                        className="h-9 text-xs bg-base-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        Fecha Fin <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={permisoFechaFin}
                        min={permisoFechaInicio}
                        onChange={(e) => setPermisoFechaFin(e.target.value)}
                        required
                        className="h-9 text-xs bg-base-white"
                      />
                    </div>
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Motivo del Permiso / Justificación <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej. Cita médica IESS, Calamidad doméstica..."
                      value={permisoMotivo}
                      onChange={(e) => setPermisoMotivo(e.target.value)}
                      required
                      className="h-9 text-xs bg-base-white"
                    />
                  </div>
                </div>

                {/* Naves Asignadas y Cobertura Independiente */}
                {supervisorAusenteId && (
                  <div className="pt-2 border-t border-institucional-whiteSmokeBlack/15 space-y-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Cobertura Operativa por Nave ({navesDelSupervisor.length} naves):
                      </span>
                      <span className="text-[11px] text-gray-500 italic">
                        Configure persistencia o reemplazo temporal por nave
                      </span>
                    </div>

                    {cargandoNaves ? (
                      <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-institucional-green" />
                        Cargando naves asignadas...
                      </div>
                    ) : navesDelSupervisor.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200">
                        Este supervisor no tiene naves asignadas actualmente.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {navesDelSupervisor.map((nave) => {
                          const conf = coberturasForm[nave.id] || {
                            tipoCobertura: "PERSISTENCIA_AUTOMATICA",
                          };
                          const esReemplazo = conf.tipoCobertura === "REEMPLAZO_TEMPORAL";

                          return (
                            <div
                              key={nave.id}
                              className="rounded-xl border border-institucional-whiteSmokeBlack/25 bg-base-white p-3 space-y-2.5 transition-colors hover:border-institucional-green/40 shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-institucional-green">
                                  {nave.nombre}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-gray-700 border border-institucional-whiteSmokeBlack/20">
                                  {nave.cantidadPuestos} puestos
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs">
                                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-700">
                                    <input
                                      type="radio"
                                      name={`tipo_cob_${nave.id}`}
                                      checked={conf.tipoCobertura === "PERSISTENCIA_AUTOMATICA"}
                                      onChange={() =>
                                        setCoberturasForm((prev) => ({
                                          ...prev,
                                          [nave.id]: {
                                            tipoCobertura: "PERSISTENCIA_AUTOMATICA",
                                          },
                                        }))
                                      }
                                      className="text-institucional-green focus:ring-institucional-green"
                                    />
                                    <span>Persistencia Automática</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-700">
                                    <input
                                      type="radio"
                                      name={`tipo_cob_${nave.id}`}
                                      checked={esReemplazo}
                                      onChange={() =>
                                        setCoberturasForm((prev) => ({
                                          ...prev,
                                          [nave.id]: {
                                            tipoCobertura: "REEMPLAZO_TEMPORAL",
                                            supervisorReemplazoId:
                                              prev[nave.id]?.supervisorReemplazoId || "",
                                          },
                                        }))
                                      }
                                      className="text-institucional-green focus:ring-institucional-green"
                                    />
                                    <span>Reemplazo Temporal</span>
                                  </label>
                                </div>

                                {esReemplazo && (
                                  <div className="pt-1">
                                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                                      Supervisor de Reemplazo (acceso temporal):
                                    </label>
                                    <select
                                      value={conf.supervisorReemplazoId || ""}
                                      onChange={(e) =>
                                        setCoberturasForm((prev) => ({
                                          ...prev,
                                          [nave.id]: {
                                            ...prev[nave.id],
                                            tipoCobertura: "REEMPLAZO_TEMPORAL",
                                            supervisorReemplazoId: e.target.value,
                                          },
                                        }))
                                      }
                                      required
                                      className="h-8 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-2.5 text-xs text-base-eerieBlack outline-none focus:border-institucional-green"
                                    >
                                      <option value="">-- Seleccionar supervisor sustituto --</option>
                                      {supervisores
                                        .filter((s) => s.id !== supervisorAusenteId)
                                        .map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.nombres} {s.apellidos}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={guardandoPermiso || !supervisorAusenteId || navesDelSupervisor.length === 0}
                    className="w-full sm:w-auto bg-institucional-green hover:bg-acento-verdeOliva1 text-base-white text-xs font-bold h-9 px-5 shadow-xs"
                  >
                    {guardandoPermiso ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-1.5" />
                        Guardando y Aplicando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} className="mr-1.5" />
                        Guardar Permiso / Justificación
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Columna Derecha: Tabla de Permisos Registrados (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Permisos y Justificaciones Registradas ({permisos.length})
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cargarPermisos}
                  className="h-7 text-xs text-institucional-green"
                >
                  <RotateCcw size={12} className="mr-1" />
                  Actualizar
                </Button>
              </div>

              {cargandoPermisos ? (
                <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-institucional-green" />
                  Cargando permisos...
                </div>
              ) : permisos.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-institucional-whiteSmoke/40 border border-institucional-whiteSmokeBlack/20 text-xs text-gray-600">
                  No se han registrado permisos o justificaciones aún.
                </div>
              ) : (
                <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#e6efe9] text-base-eerieBlack font-bold border-b border-institucional-whiteSmokeBlack/20">
                        <tr>
                          <th className="px-3 py-2.5">Supervisor Ausente</th>
                          <th className="px-3 py-2.5">Fechas</th>
                          <th className="px-3 py-2.5">Motivo</th>
                          <th className="px-3 py-2.5">Detalle de Cobertura por Nave</th>
                          <th className="px-3 py-2.5 text-center">Estado</th>
                          <th className="px-3 py-2.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-institucional-whiteSmokeBlack/15 bg-base-white">
                        {permisos.map((p) => {
                          const esActivo = p.estado === "ACTIVO";
                          return (
                            <tr key={p.id} className="hover:bg-institucional-whiteSmoke/30 transition-colors">
                              <td className="px-3 py-2.5 font-semibold text-gray-900">
                                {p.supervisorNombre}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">
                                {p.fechaInicio} al {p.fechaFin}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate" title={p.motivo}>
                                {p.motivo}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1">
                                  {p.coberturas.map((cob) => (
                                    <div
                                      key={cob.id}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                                    >
                                      <span className="font-bold text-gray-900">{cob.naveNombre}:</span>
                                      {cob.tipoCobertura === "PERSISTENCIA_AUTOMATICA" ? (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                          Persistencia Automática
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                                          Reemplazo: {cob.supervisorReemplazoNombre || "Asignado"}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span
                                  className={[
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                    esActivo
                                      ? "bg-green-100 text-green-800 border border-green-300"
                                      : "bg-gray-100 text-gray-600 border border-gray-300",
                                  ].join(" ")}
                                >
                                  {p.estado}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {esActivo && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevocarPermiso(p.id)}
                                    className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 size={13} className="mr-1" />
                                    Revocar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
