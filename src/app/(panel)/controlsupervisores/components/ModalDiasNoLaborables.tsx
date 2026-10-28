"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarOff,
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
import type { Nave } from "@/domain/models/nave.model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logClientError } from "@/lib/client-logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

interface ModalDiasNoLaborablesProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ModalDiasNoLaborables({
  isOpen,
  onClose,
  onCambioRealizado,
}: ModalDiasNoLaborablesProps) {
  const [todasLasNaves, setTodasLasNaves] = useState<Nave[]>([]);

  // Reglas
  const hoyStr = format(new Date(), "yyyy-MM-dd");
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

  // Conflicto de Borrado con Contraseña (Modal Sobrepuesto)
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
      .catch((err) => logClientError("DIAS-NO-LABORABLES", "Error al cargar naves", err));
    return () => {
      activo = false;
    };
  }, [isOpen]);

  // Cargar lista de reglas de días no laborables
  const cargarReglas = async () => {
    try {
      setCargandoReglas(true);
      const res = await fetch("/api/v1/auditoria/dias-no-laborables");
      if (res.ok) {
        const data = await res.json();
        setReglasNoLab(data.reglas || []);
      }
    } catch (err) {
      logClientError("DIAS-NO-LABORABLES", "Error al cargar reglas de días no laborables", err);
    } finally {
      setCargandoReglas(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let activo = true;
    fetch("/api/v1/auditoria/dias-no-laborables")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo && data?.reglas) {
          setReglasNoLab(data.reglas);
        }
      })
      .catch((err) => logClientError("DIAS-NO-LABORABLES", "Error al cargar reglas de días no laborables", err))
      .finally(() => {
        if (activo) setCargandoReglas(false);
      });
    return () => {
      activo = false;
    };
  }, [isOpen]);

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

  const handleCerrarModalConflicto = () => {
    if (guardandoRegla) return;
    setAlertaConflicto(null);
    setPasswordConfirmacion("");
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
      logClientError("DIAS-NO-LABORABLES", "Error al procesar la regla de día no laborable", err);
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
      logClientError("DIAS-NO-LABORABLES", "Error al eliminar la regla de día no laborable", err);
      toast.error("Error al eliminar la regla.");
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        disablePointerDismissal={true}
        onOpenChange={(open) => {
          if (!open && !guardandoRegla) onClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[98vw] max-w-[98vw] sm:w-[96vw] sm:max-w-5xl lg:max-w-7xl xl:max-w-[1380px] max-h-[94dvh] sm:max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200 gap-0"
        >
          <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-institucional-whiteSmokeBlack/20 bg-institucional-whiteSmoke/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700">
                  <CalendarOff size={22} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-amber-800">
                    Configuración de Días No Laborables y Feriados
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-600">
                    Establezca descansos obligatorios, feriados oficiales o exclusión recurrente de toma de lista.
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

          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda: Formulario (lg:col-span-4) */}
              <div className="lg:col-span-4 lg:sticky lg:top-0 h-fit space-y-4">
                <form
                  onSubmit={(e) => handleGuardarReglaNoLaborable(e)}
                  className="rounded-2xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/50 p-4 sm:p-5 shadow-xs space-y-4"
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
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
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
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
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
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
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
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
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
                                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
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

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={guardandoRegla || !reglaMotivo.trim()}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-base-white text-xs font-bold h-9 px-5 shadow-xs cursor-pointer"
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
                </form>
              </div>

              {/* Columna Derecha: Listado de Reglas Activas (lg:col-span-8) */}
              <div className="lg:col-span-8 flex flex-col min-w-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Reglas de Días No Laborables Activas ({reglasNoLab.length})
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cargarReglas}
                    className="h-7 text-xs text-amber-700 cursor-pointer"
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
                  <>
                    {/* Vista Tabla en Escritorio (hidden md:block) */}
                    <div className="hidden md:block rounded-xl border border-institucional-whiteSmokeBlack/20 overflow-hidden shadow-2xs">
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
                                      className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
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

                    {/* Vista Tarjetas en Móvil (md:hidden) */}
                    <div className="md:hidden space-y-3">
                      {reglasNoLab.map((r) => {
                        const fechasCount = Array.isArray(r.fechasExpandidas)
                          ? r.fechasExpandidas.length
                          : 0;
                        return (
                          <div
                            key={r.id}
                            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-sm font-bold text-slate-800">{r.motivo}</h5>
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  {r.fechaInicio} al {r.fechaFin}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                {r.tipoRegla === "DIA_UNICO"
                                  ? "Día Único"
                                  : r.tipoRegla === "RANGO_CONTINUO"
                                  ? "Rango Continuo"
                                  : "Semanal"}
                              </span>
                            </div>

                            {r.tipoRegla === "RECURRENTE_SEMANAL" && Array.isArray(r.diasSemana) && (
                              <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60">
                                <span className="font-bold">Días aplicados:</span>{" "}
                                {r.diasSemana
                                  .map((d) => DIAS_SEMANA_OPCIONES.find((o) => o.val === d)?.label)
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                              <div>
                                <span className="font-semibold text-slate-500 text-[11px] block">Ámbito:</span>
                                <span className="font-medium text-slate-800">
                                  {r.aplicaTodasNaves ? (
                                    <span className="text-institucional-green font-bold">Todas las Naves</span>
                                  ) : Array.isArray(r.navesNombres) && r.navesNombres.length > 0 ? (
                                    r.navesNombres.join(", ")
                                  ) : (
                                    "Naves seleccionadas"
                                  )}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                                {fechasCount} {fechasCount === 1 ? "día" : "días"}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEliminarRegla(r.id)}
                                className="w-full justify-center px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 h-8 cursor-pointer"
                              >
                                <Trash2 size={13} className="mr-1" />
                                Eliminar Regla
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Sobrepuesto Independiente de Conflicto de Borrado (Tarea 3) ── */}
      <Dialog
        open={Boolean(alertaConflicto)}
        disablePointerDismissal={true}
        onOpenChange={(open) => {
          if (!open) handleCerrarModalConflicto();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[92vw] max-w-md p-0 overflow-hidden border border-red-300 bg-base-white shadow-2xl rounded-2xl gap-0"
        >
          {/* Encabezado del Modal Sobrepuesto (rojo/ámbar de seguridad) */}
          <div className="bg-red-50/90 px-5 py-4 border-b border-red-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="p-2 rounded-xl bg-red-100 text-red-700 shrink-0">
                <AlertTriangle size={22} className="text-red-600 shrink-0" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-red-950 m-0">
                  Advertencia de Seguridad: Registros de Asistencia Existentes
                </DialogTitle>
                <DialogDescription className="text-[11px] text-red-800/80 m-0">
                  Autorización requerida para eliminación irreversible
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCerrarModalConflicto}
              disabled={guardandoRegla}
              className="rounded-full p-1.5 text-red-400 hover:text-red-700 hover:bg-red-100/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              aria-label="Cerrar advertencia"
            >
              <X size={18} />
            </button>
          </div>

          {/* Cuerpo del Modal Sobrepuesto */}
          <div className="p-5 space-y-4 text-xs">
            <p className="text-gray-800 leading-relaxed">
              {alertaConflicto?.mensaje ||
                "Se han detectado registros de asistencia en el rango de fechas seleccionado. La creación de este día no laborable eliminará de forma permanente dichos registros."}
            </p>

            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-1.5 text-xs">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-gray-700 shrink-0">Fechas con registros:</span>
                <span className="font-mono font-bold text-red-800 break-words">
                  {alertaConflicto?.fechasConRegistros?.join(", ") || "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-700">Registros afectados:</span>
                <span className="font-bold text-red-900 bg-red-100 px-2 py-0.5 rounded-full text-[11px]">
                  {alertaConflicto?.totalRegistrosAfectados ?? 0} registros
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Lock size={14} className="text-red-600" />
                <span>Ingrese su contraseña actual para autorizar el borrado</span>
                <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="Ingrese su contraseña actual..."
                value={passwordConfirmacion}
                onChange={(e) => setPasswordConfirmacion(e.target.value)}
                autoFocus
                className="h-9 text-xs border-red-300 bg-base-white text-base-eerieBlack focus-visible:ring-red-500 focus-visible:border-red-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && passwordConfirmacion.trim() && !guardandoRegla) {
                    e.preventDefault();
                    handleGuardarReglaNoLaborable(undefined, passwordConfirmacion);
                  }
                }}
              />
            </div>
          </div>

          {/* Pie del Modal Sobrepuesto (DialogFooter con 2 opciones exclusivas) */}
          <DialogFooter className="px-5 py-3 bg-gray-50/80 border-t border-gray-200/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCerrarModalConflicto}
              disabled={guardandoRegla}
              className="w-full sm:w-auto h-9 text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => handleGuardarReglaNoLaborable(undefined, passwordConfirmacion)}
              disabled={guardandoRegla || !passwordConfirmacion.trim()}
              className="w-full sm:w-auto h-9 text-xs font-bold bg-red-700 hover:bg-red-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              {guardandoRegla ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Eliminando y guardando...
                </>
              ) : (
                <>
                  <Trash2 size={14} className="mr-1.5" />
                  Confirmar Contraseña y Eliminar Registros
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
