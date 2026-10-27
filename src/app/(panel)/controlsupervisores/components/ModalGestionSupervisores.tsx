"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarOff,
  UserCheck,
  AlertTriangle,
  Trash2,
  Lock,
  Layers,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Calendar,
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

interface ReglaNoLaborableItem {
  id: string;
  motivo: string;
  tipoRegla: "DIA_UNICO" | "RANGO_CONTINUO" | "RECURRENTE_SEMANAL";
  fechaInicio: string;
  fechaFin: string;
  diasSemana?: number[];
  aplicaTodasNaves: boolean;
  navesIds?: string[];
  navesNombres?: string[];
  fechasExpandidas: string[];
  creadoPorNombre: string;
  creadoEn: string;
}

interface ModalGestionSupervisoresProps {
  isOpen: boolean;
  onClose: () => void;
  tabInicial?: "permisos" | "diasNoLaborables";
  supervisores: Usuario[];
  onCambioRealizado?: () => void;
}

const DIAS_SEMANA_OPCIONES = [
  { val: 1, label: "Lunes" },
  { val: 2, label: "Martes" },
  { val: 3, label: "Miércoles" },
  { val: 4, label: "Jueves" },
  { val: 5, label: "Viernes" },
  { val: 6, label: "Sábado" },
  { val: 0, label: "Domingo" },
];

export function ModalGestionSupervisores({
  isOpen,
  onClose,
  tabInicial = "permisos",
  supervisores,
  onCambioRealizado,
}: ModalGestionSupervisoresProps) {
  const [tabActiva, setTabActiva] = useState<"permisos" | "diasNoLaborables">(tabInicial);
  const [todasLasNaves, setTodasLasNaves] = useState<Nave[]>([]);
  const [cargandoNaves, setCargandoNaves] = useState(false);

  // ── PESTAÑA 1: Permisos y Coberturas ──
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

  // ── PESTAÑA 2: Días No Laborables ──
  const [reglasNoLab, setReglasNoLab] = useState<ReglaNoLaborableItem[]>([]);
  const [cargandoReglas, setCargandoReglas] = useState(false);
  const [guardandoRegla, setGuardandoRegla] = useState(false);

  // Formulario Regla
  const [tipoRegla, setTipoRegla] = useState<"DIA_UNICO" | "RANGO_CONTINUO" | "RECURRENTE_SEMANAL">(
    "DIA_UNICO"
  );
  const [reglaFechaInicio, setReglaFechaInicio] = useState(hoyStr);
  const [reglaFechaFin, setReglaFechaFin] = useState(hoyStr);
  const [diasSemanaSeleccionados, setDiasSemanaSeleccionados] = useState<number[]>([]);
  const [aplicaTodasNaves, setAplicaTodasNaves] = useState(true);
  const [navesSeleccionadas, setNavesSeleccionadas] = useState<string[]>([]);
  const [reglaMotivo, setReglaMotivo] = useState("");

  // Conflicto de Borrado con Contraseña
  const [alertaConflicto, setAlertaConflicto] = useState<{
    fechasConRegistros: string[];
    totalRegistrosAfectados: number;
    mensaje: string;
  } | null>(null);
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");

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

  // Cargar lista de reglas de días no laborables
  const cargarReglas = async () => {
    try {
      const res = await fetch("/api/v1/auditoria/dias-no-laborables");
      if (res.ok) {
        const data = await res.json();
        setReglasNoLab(data.reglas || []);
      }
    } catch (err) {
      console.error("Error al cargar reglas de días no laborables:", err);
    } finally {
      setCargandoReglas(false);
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
      .catch((err) => console.error(err))
      .finally(() => {
        if (activo) setCargandoPermisos(false);
      });

    fetch("/api/v1/auditoria/dias-no-laborables")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo && data?.reglas) {
          setReglasNoLab(data.reglas);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (activo) setCargandoReglas(false);
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

  // ── Manejadores de Permisos ──
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

  // ── Manejadores de Días No Laborables ──
  const toggleDiaSemana = (dia: number) => {
    setDiasSemanaSeleccionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const toggleNaveSeleccionada = (naveId: string) => {
    setNavesSeleccionadas((prev) =>
      prev.includes(naveId) ? prev.filter((id) => id !== naveId) : [...prev, naveId]
    );
  };

  const handleGuardarReglaNoLaborable = async (
    e?: React.FormEvent,
    passConfirmada?: string
  ) => {
    if (e) e.preventDefault();

    if (!reglaMotivo.trim()) {
      toast.error("El motivo del día no laborable es obligatorio.");
      return;
    }

    const fInicio = reglaFechaInicio;
    const fFin = tipoRegla === "DIA_UNICO" ? reglaFechaInicio : reglaFechaFin;

    if (fInicio > fFin) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    if (tipoRegla === "RECURRENTE_SEMANAL" && diasSemanaSeleccionados.length === 0) {
      toast.error("Seleccione al menos un día recurrente de la semana.");
      return;
    }

    if (!aplicaTodasNaves && navesSeleccionadas.length === 0) {
      toast.error("Seleccione al menos una nave o marque 'Todas las naves'.");
      return;
    }

    setGuardandoRegla(true);
    try {
      const payload: Record<string, unknown> = {
        motivo: reglaMotivo.trim(),
        tipoRegla,
        fechaInicio: fInicio,
        fechaFin: fFin,
        diasSemana: tipoRegla === "RECURRENTE_SEMANAL" ? diasSemanaSeleccionados : undefined,
        aplicaTodasNaves,
        navesIds: aplicaTodasNaves ? undefined : navesSeleccionadas,
      };

      if (passConfirmada || passwordConfirmacion) {
        payload.passwordConfirmacion = passConfirmada || passwordConfirmacion;
      }

      const res = await fetch("/api/v1/auditoria/dias-no-laborables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Conflicto 409 con registros existentes en fechas seleccionadas
      if (res.status === 409 && data.requiereConfirmacionPassword) {
        setAlertaConflicto({
          fechasConRegistros: data.fechasConRegistros || [],
          totalRegistrosAfectados: data.totalRegistrosAfectados || 0,
          mensaje: data.mensaje || "Existen registros de asistencia en esas fechas.",
        });
        toast.warning("Se requiere confirmación con contraseña para eliminar asistencias previas.");
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Error al configurar el día no laborable.");
        return;
      }

      toast.success("Regla de día no laborable guardada exitosamente.");
      setReglaMotivo("");
      setTipoRegla("DIA_UNICO");
      setReglaFechaInicio(hoyStr);
      setReglaFechaFin(hoyStr);
      setDiasSemanaSeleccionados([]);
      setAplicaTodasNaves(true);
      setNavesSeleccionadas([]);
      setAlertaConflicto(null);
      setPasswordConfirmacion("");
      await cargarReglas();
      onCambioRealizado?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la regla de día no laborable.");
    } finally {
      setGuardandoRegla(false);
    }
  };

  const handleEliminarRegla = async (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar esta regla de día no laborable?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/auditoria/dias-no-laborables?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al eliminar la regla.");
        return;
      }
      toast.success("Regla de día no laborable eliminada.");
      await cargarReglas();
      onCambioRealizado?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la regla.");
    }
  };

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal={true}
      onOpenChange={(open) => {
        if (!open && !guardandoPermiso && !guardandoRegla) onClose();
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
                {tabActiva === "permisos" ? <UserCheck size={22} /> : <CalendarOff size={22} />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-institucional-green">
                  Gestión Operativa de Supervisión y Calendario
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-600">
                  Configure justificaciones con cobertura por nave o establezca días no laborables oficiales.
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

          {/* Navegación por pestañas */}
          <div className="flex items-center gap-2 mt-3 border-b border-institucional-whiteSmokeBlack/20">
            <button
              type="button"
              onClick={() => {
                setTabActiva("permisos");
                setAlertaConflicto(null);
              }}
              className={[
                "flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all",
                tabActiva === "permisos"
                  ? "border-institucional-green text-institucional-green font-bold bg-institucional-green/5 rounded-t-lg"
                  : "border-transparent text-gray-600 hover:text-institucional-green",
              ].join(" ")}
            >
              <UserCheck size={16} />
              <span>1. Permisos y Coberturas de Supervisores</span>
              {permisos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-institucional-green/15 text-institucional-green">
                  {permisos.filter((p) => p.estado === "ACTIVO").length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setTabActiva("diasNoLaborables");
              }}
              className={[
                "flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all",
                tabActiva === "diasNoLaborables"
                  ? "border-amber-600 text-amber-700 font-bold bg-amber-50/50 rounded-t-lg"
                  : "border-transparent text-gray-600 hover:text-amber-700",
              ].join(" ")}
            >
              <CalendarOff size={16} />
              <span>2. Días No Laborables / Feriados</span>
              {reglasNoLab.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {reglasNoLab.length}
                </span>
              )}
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ══════════════════════════════════════════════════════════════════════════
              PESTAÑA 1: PERMISOS Y COBERTURAS POR NAVE
             ══════════════════════════════════════════════════════════════════════════ */}
          {tabActiva === "permisos" && (
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
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              PESTAÑA 2: DÍAS NO LABORABLES / FERIADOS / RECURRENTES
             ══════════════════════════════════════════════════════════════════════════ */}
          {tabActiva === "diasNoLaborables" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda: Formulario (lg:col-span-5) */}
              <div className="lg:col-span-5">
                <form
                  onSubmit={(e) => handleGuardarReglaNoLaborable(e)}
                  className="rounded-2xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/50 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-institucional-whiteSmokeBlack/15">
                    <CalendarOff size={18} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-800">
                      Configurar Días No Laborables / Exclusión de Toma de Lista
                    </h3>
                  </div>

                  {/* Tipo de Regla (3 botones) */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                      Tipo de Regla de Descanso / Feriado:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoRegla("DIA_UNICO")}
                        className={[
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                          tipoRegla === "DIA_UNICO"
                            ? "border-amber-600 bg-amber-50 text-amber-900 shadow-2xs"
                            : "border-institucional-whiteSmokeBlack/25 bg-base-white text-gray-600 hover:bg-institucional-whiteSmoke/40",
                        ].join(" ")}
                      >
                        <Calendar size={14} />
                        <span>Día Único</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipoRegla("RANGO_CONTINUO")}
                        className={[
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                          tipoRegla === "RANGO_CONTINUO"
                            ? "border-amber-600 bg-amber-50 text-amber-900 shadow-2xs"
                            : "border-institucional-whiteSmokeBlack/25 bg-base-white text-gray-600 hover:bg-institucional-whiteSmoke/40",
                        ].join(" ")}
                      >
                        <Layers size={14} />
                        <span>Rango</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipoRegla("RECURRENTE_SEMANAL")}
                        className={[
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                          tipoRegla === "RECURRENTE_SEMANAL"
                            ? "border-amber-600 bg-amber-50 text-amber-900 shadow-2xs"
                            : "border-institucional-whiteSmokeBlack/25 bg-base-white text-gray-600 hover:bg-institucional-whiteSmoke/40",
                        ].join(" ")}
                      >
                        <CalendarDays size={14} />
                        <span>Semanal</span>
                      </button>
                    </div>
                  </div>

                  {/* Selectores de Fechas según tipo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">
                        {tipoRegla === "DIA_UNICO" ? "Fecha del Feriado" : "Fecha Inicio"}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={reglaFechaInicio}
                        onChange={(e) => setReglaFechaInicio(e.target.value)}
                        required
                        className="h-9 text-xs bg-base-white"
                      />
                    </div>

                    {tipoRegla !== "DIA_UNICO" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          Fecha Fin <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="date"
                          value={reglaFechaFin}
                          min={reglaFechaInicio}
                          onChange={(e) => setReglaFechaFin(e.target.value)}
                          required
                          className="h-9 text-xs bg-base-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Selector de días de la semana si es RECURRENTE_SEMANAL */}
                  {tipoRegla === "RECURRENTE_SEMANAL" && (
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-2">
                      <span className="text-xs font-bold text-amber-900 block">
                        Días de la semana sin laborar en el rango:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {DIAS_SEMANA_OPCIONES.map((dia) => {
                          const seleccionado = diasSemanaSeleccionados.includes(dia.val);
                          return (
                            <button
                              key={dia.val}
                              type="button"
                              onClick={() => toggleDiaSemana(dia.val)}
                              className={[
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                                seleccionado
                                  ? "bg-amber-600 text-white border-amber-600 font-bold shadow-2xs"
                                  : "bg-base-white text-gray-700 border-institucional-whiteSmokeBlack/30 hover:border-amber-400",
                              ].join(" ")}
                            >
                              {dia.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ámbito de Naves */}
                  <div className="space-y-2 pt-2 border-t border-institucional-whiteSmokeBlack/15">
                    <span className="text-xs font-semibold text-gray-700 block">
                      Ámbito de Aplicación:
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-800">
                        <input
                          type="radio"
                          name="ambito_naves"
                          checked={aplicaTodasNaves}
                          onChange={() => setAplicaTodasNaves(true)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-bold">Todas las Naves</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-800">
                        <input
                          type="radio"
                          name="ambito_naves"
                          checked={!aplicaTodasNaves}
                          onChange={() => setAplicaTodasNaves(false)}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Naves Específicas</span>
                      </label>
                    </div>

                    {!aplicaTodasNaves && (
                      <div className="p-3 rounded-xl bg-institucional-whiteSmoke/50 border border-institucional-whiteSmokeBlack/20 space-y-2">
                        <span className="text-[11px] font-semibold text-gray-600 block">
                          Marque las naves que tendrán descanso:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {todasLasNaves.map((n) => {
                            const seleccionada = navesSeleccionadas.includes(n.id);
                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => toggleNaveSeleccionada(n.id)}
                                className={[
                                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                                  seleccionada
                                    ? "bg-institucional-green text-white border-institucional-green font-bold shadow-2xs"
                                    : "bg-base-white text-gray-700 border-institucional-whiteSmokeBlack/30 hover:border-institucional-green",
                                ].join(" ")}
                              >
                                {n.nombre}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Motivo del Día No Laborable <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Ej. Feriado Nacional de Difuntos, Mantenimiento..."
                      value={reglaMotivo}
                      onChange={(e) => setReglaMotivo(e.target.value)}
                      required
                      className="h-9 text-xs bg-base-white"
                    />
                  </div>

                  {/* Recuadro de Alerta Roja/Ámbar con Contraseña ante Conflicto de Borrado */}
                  {alertaConflicto && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5 text-red-900">
                        <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold">{alertaConflicto.mensaje}</p>
                          <p className="text-gray-700">
                            Fechas con registros:{" "}
                            <span className="font-mono font-bold text-red-800">
                              {alertaConflicto.fechasConRegistros.join(", ")}
                            </span>{" "}
                            ({alertaConflicto.totalRegistrosAfectados} registros afectados).
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-red-200/80 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <div className="relative flex-1">
                          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <Input
                            type="password"
                            placeholder="Ingrese su contraseña actual..."
                            value={passwordConfirmacion}
                            onChange={(e) => setPasswordConfirmacion(e.target.value)}
                            className="pl-9 h-9 text-xs border-red-300 bg-base-white text-base-eerieBlack focus:border-red-600 focus:ring-red-200"
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleGuardarReglaNoLaborable(undefined, passwordConfirmacion)}
                          disabled={guardandoRegla || !passwordConfirmacion.trim()}
                          className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold h-9 px-4 shrink-0 shadow-xs"
                        >
                          {guardandoRegla ? (
                            <>
                              <Loader2 size={14} className="animate-spin mr-1.5" />
                              Eliminando...
                            </>
                          ) : (
                            <>
                              <Trash2 size={14} className="mr-1.5" />
                              Confirmar y Eliminar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!alertaConflicto && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={guardandoRegla || !reglaMotivo.trim()}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-base-white text-xs font-bold h-9 px-5 shadow-xs"
                      >
                        {guardandoRegla ? (
                          <>
                            <Loader2 size={14} className="animate-spin mr-1.5" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} className="mr-1.5" />
                            Guardar Día(s) No Laborable(s)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </div>

              {/* Columna Derecha: Listado de Reglas Activas (lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Reglas de Días No Laborables Activas ({reglasNoLab.length})
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cargarReglas}
                    className="h-7 text-xs text-amber-700"
                  >
                    <RotateCcw size={12} className="mr-1" />
                    Actualizar
                  </Button>
                </div>

                {cargandoReglas ? (
                  <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin text-amber-600" />
                    Cargando reglas...
                  </div>
                ) : reglasNoLab.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-institucional-whiteSmoke/40 border border-institucional-whiteSmokeBlack/20 text-xs text-gray-600">
                    No se han configurado días no laborables aún.
                  </div>
                ) : (
                  <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#fef3c7] text-amber-950 font-bold border-b border-amber-200">
                          <tr>
                            <th className="px-3 py-2.5">Motivo</th>
                            <th className="px-3 py-2.5">Tipo</th>
                            <th className="px-3 py-2.5">Rango / Días</th>
                            <th className="px-3 py-2.5">Naves Afectadas</th>
                            <th className="px-3 py-2.5 text-center">Fechas</th>
                            <th className="px-3 py-2.5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-institucional-whiteSmokeBlack/15 bg-base-white">
                          {reglasNoLab.map((r) => {
                            const fechasCount = Array.isArray(r.fechasExpandidas)
                              ? r.fechasExpandidas.length
                              : 0;
                            return (
                              <tr key={r.id} className="hover:bg-institucional-whiteSmoke/30 transition-colors">
                                <td className="px-3 py-2.5 font-semibold text-gray-900">{r.motivo}</td>
                                <td className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    {r.tipoRegla === "DIA_UNICO"
                                      ? "Día Único"
                                      : r.tipoRegla === "RANGO_CONTINUO"
                                      ? "Rango Continuo"
                                      : "Semanal Recurrente"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-gray-700">
                                  {r.fechaInicio} al {r.fechaFin}
                                  {r.tipoRegla === "RECURRENTE_SEMANAL" && Array.isArray(r.diasSemana) && (
                                    <div className="text-[10px] text-amber-700 font-sans mt-0.5">
                                      Días:{" "}
                                      {r.diasSemana
                                        .map((d) => DIAS_SEMANA_OPCIONES.find((o) => o.val === d)?.label)
                                        .filter(Boolean)
                                        .join(", ")}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700">
                                  {r.aplicaTodasNaves ? (
                                    <span className="font-bold text-institucional-green">
                                      Todas las Naves
                                    </span>
                                  ) : Array.isArray(r.navesNombres) && r.navesNombres.length > 0 ? (
                                    r.navesNombres.join(", ")
                                  ) : (
                                    "Naves seleccionadas"
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-gray-900 font-mono">
                                  {fechasCount} {fechasCount === 1 ? "día" : "días"}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEliminarRegla(r.id)}
                                    className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 size={13} className="mr-1" />
                                    Eliminar
                                  </Button>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
