"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Store,
  Search,
  Save,
  Check,
  RefreshCw,
  User,
  AlertCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { Nave } from "@/domain/models/nave.model";
import type { Puesto, Comerciante } from "@/domain/models/comerciante.model";
import { naveService } from "@/application/services/nave.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ModalPuestosNaveProps {
  nave: Nave | null;
  isOpen: boolean;
  onClose: () => void;
  onPuestosActualizados: () => Promise<void> | void;
  comerciantes?: Comerciante[];
}

export function ModalPuestosNave({
  nave,
  isOpen,
  onClose,
  onPuestosActualizados,
  comerciantes = [],
}: ModalPuestosNaveProps) {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "OCUPADOS" | "VACANTES">("TODOS");
  const [cambiosCodigos, setCambiosCodigos] = useState<Record<string, string>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCloseModal = useCallback(() => {
    setBusqueda("");
    setFiltroEstado("TODOS");
    setCambiosCodigos({});
    setErrorMsg("");
    setPuestos([]);
    onClose();
  }, [onClose]);

  // Si puestos del fetch aún no cargaron o pertenecen a otra nave, usar puestos de la nave actual como fallback inmediato
  const puestosEfectivos = useMemo(() => {
    if (puestos.length > 0 && (!nave || puestos[0]?.naveId === nave.id)) return puestos;
    if (!nave?.puestos || nave.puestos.length === 0) return [];
    return nave.puestos.map((p) => {
      const com = comerciantes.find((c) => c.idInterno === p.comercianteId);
      return {
        id: p.id,
        codigo: p.codigo,
        naveId: p.naveId,
        estado: p.estado,
        comercianteId: p.comercianteId ?? null,
        comerciante: com
          ? {
              idInterno: com.idInterno,
              ciu: com.ciu,
              cedula: com.cedula,
              contribuyente: com.contribuyente,
              actividad: com.actividad,
            }
          : p.comerciante,
      };
    });
  }, [puestos, nave, comerciantes]);

  useEffect(() => {
    if (!isOpen || !nave) {
      return;
    }

    let activo = true;
    naveService
      .obtenerPuestosNave(nave.id)
      .then((data) => {
        if (activo) {
          setPuestos(Array.isArray(data) ? data : []);
          setCambiosCodigos({});
          setCargando(false);
        }
      })
      .catch((err: unknown) => {
        if (activo) {
          const msg = err instanceof Error ? err.message : "Error al cargar los puestos";
          setErrorMsg(msg);
          toast.error(msg);
          setCargando(false);
        }
      });
    return () => {
      activo = false;
    };
  }, [isOpen, nave]);

  // Contadores en tiempo real
  const total = puestosEfectivos.length;
  const ocupados = puestosEfectivos.filter((p) => p.estado === "Ocupado").length;
  const vacantes = puestosEfectivos.filter((p) => p.estado === "Vacante").length;

  // Filtrado de puestos
  const puestosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return puestosEfectivos.filter((p) => {
      // Filtro por pestaña
      if (filtroEstado === "OCUPADOS" && p.estado !== "Ocupado") return false;
      if (filtroEstado === "VACANTES" && p.estado !== "Vacante") return false;

      // Filtro por texto de búsqueda
      if (!q) return true;
      const codigoMatch = (cambiosCodigos[p.id] ?? p.codigo).toLowerCase().includes(q);
      const contribuyenteMatch = p.comerciante?.contribuyente?.toLowerCase().includes(q) ?? false;
      const ciuMatch = p.comerciante?.ciu?.toLowerCase().includes(q) ?? false;
      const cedulaMatch = p.comerciante?.cedula?.toLowerCase().includes(q) ?? false;
      const actividadMatch = p.comerciante?.actividad?.toLowerCase().includes(q) ?? false;

      return codigoMatch || contribuyenteMatch || ciuMatch || cedulaMatch || actividadMatch;
    });
  }, [puestosEfectivos, busqueda, filtroEstado, cambiosCodigos]);

  // Manejo de cambio de texto en un puesto
  const handleCodigoChange = (puestoId: string, val: string) => {
    setCambiosCodigos((prev) => ({
      ...prev,
      [puestoId]: val,
    }));
  };

  // Guardar fila individual
  const handleGuardarFila = async (puesto: Puesto) => {
    if (!nave) return;
    const nuevoCodigo = (cambiosCodigos[puesto.id] ?? puesto.codigo).trim().toUpperCase();

    if (!nuevoCodigo) {
      toast.error("El código del puesto no puede estar vacío");
      return;
    }

    if (nuevoCodigo === puesto.codigo) {
      // Sin cambios reales
      setCambiosCodigos((prev) => {
        const copy = { ...prev };
        delete copy[puesto.id];
        return copy;
      });
      return;
    }

    setGuardandoId(puesto.id);
    try {
      const pActualizado = await naveService.actualizarCodigoPuesto(nave.id, puesto.id, nuevoCodigo);
      setPuestos((prev) => {
        const base = prev.length > 0 ? prev : puestosEfectivos;
        return base.map((item) => (item.id === puesto.id ? { ...item, codigo: pActualizado.codigo } : item));
      });
      setCambiosCodigos((prev) => {
        const copy = { ...prev };
        delete copy[puesto.id];
        return copy;
      });
      toast.success(`Puesto actualizado a "${pActualizado.codigo}"`);
      await onPuestosActualizados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar el puesto";
      toast.error(msg);
    } finally {
      setGuardandoId(null);
    }
  };

  // Cantidad de cambios pendientes
  const cambiosPendientes = useMemo(() => {
    return Object.entries(cambiosCodigos).filter(([id, val]) => {
      const p = puestosEfectivos.find((x) => x.id === id);
      return p && val.trim().toUpperCase() !== p.codigo && val.trim() !== "";
    });
  }, [cambiosCodigos, puestosEfectivos]);

  // Guardar todos los cambios en lote
  const handleGuardarLote = async () => {
    if (!nave || cambiosPendientes.length === 0) return;

    setGuardandoLote(true);
    try {
      const payload = cambiosPendientes.map(([puestoId, val]) => ({
        puestoId,
        nuevoCodigo: val.trim().toUpperCase(),
      }));

      const puestosActualizados = await naveService.actualizarCodigosPuestosNave(nave.id, payload);
      setPuestos(puestosActualizados);
      setCambiosCodigos({});
      toast.success(`${payload.length} puesto(s) actualizado(s) correctamente`);
      await onPuestosActualizados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar los puestos";
      toast.error(msg);
    } finally {
      setGuardandoLote(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseModal()}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] w-full bg-base-white p-6 rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0 border-b border-institucional-whiteSmokeBlack/15 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-base-eerieBlack">
                <Store className="text-institucional-green" size={22} />
                Gestión de Puestos - {nave?.nombre}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-600 mt-1">
                Visualice, asigne y renombre los códigos de puestos de la nave. Los cambios se sincronizan
                automáticamente con Catastro y el Croquis espacial.
              </DialogDescription>
            </div>

            {/* Contadores en vivo */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-gray-700 ring-1 ring-inset ring-gray-200">
                <FileText size={12} />
                Total: <strong className="text-base-eerieBlack">{total}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <Check size={12} />
                Ocupados: <strong>{ocupados}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <AlertCircle size={12} />
                Vacantes: <strong>{vacantes}</strong>
              </span>
            </div>
          </div>

          {/* Barra de Búsqueda y Pestañas de Filtro */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                type="text"
                placeholder="Buscar por código de puesto, comerciante, CIU o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-8.5 w-full bg-base-white pl-9 pr-3 text-xs placeholder:text-gray-400 focus:border-institucional-green"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setFiltroEstado("TODOS")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filtroEstado === "TODOS"
                    ? "bg-base-white text-base-eerieBlack shadow-sm"
                    : "text-gray-600 hover:text-base-eerieBlack"
                }`}
              >
                Todos ({total})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado("OCUPADOS")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filtroEstado === "OCUPADOS"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-700 hover:bg-emerald-100/50"
                }`}
              >
                Ocupados ({ocupados})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado("VACANTES")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filtroEstado === "VACANTES"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-amber-700 hover:bg-amber-100/50"
                }`}
              >
                Vacantes ({vacantes})
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Cuerpo con Tabla Scrollable y Cabecera Fija #e6efe9 */}
        <div className="flex-1 overflow-hidden my-3 min-h-[300px] flex flex-col">
          {errorMsg && (
            <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2 border border-red-200">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto rounded-xl border border-institucional-whiteSmokeBlack/20 shadow-inner">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#e6efe9]">
                <tr className="border-b border-institucional-whiteSmokeBlack/20 text-base-eerieBlack">
                  <th className="py-2.5 px-3 text-center font-bold w-12 bg-[#e6efe9]">#</th>
                  <th className="py-2.5 px-3 text-left font-bold w-48 bg-[#e6efe9]">
                    CÓDIGO DE PUESTO
                  </th>
                  <th className="py-2.5 px-3 text-center font-bold w-28 bg-[#e6efe9]">
                    ESTADO
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold bg-[#e6efe9]">
                    COMERCIANTE ASIGNADO
                  </th>
                  <th className="py-2.5 px-3 text-center font-bold w-20 bg-[#e6efe9]">
                    ACCIÓN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-institucional-whiteSmokeBlack/10 bg-base-white">
                {cargando ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-institucional-green" />
                        <span className="text-xs">Cargando puestos de la nave...</span>
                      </div>
                    </td>
                  </tr>
                ) : puestosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-500">
                      No se encontraron puestos con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  puestosFiltrados.map((puesto, index) => {
                    const valorActual = cambiosCodigos[puesto.id] ?? puesto.codigo;
                    const haCambiado =
                      valorActual.trim().toUpperCase() !== puesto.codigo.trim().toUpperCase() &&
                      valorActual.trim() !== "";
                    const estaGuardando = guardandoId === puesto.id;

                    return (
                      <tr
                        key={puesto.id}
                        className={`transition-colors hover:bg-institucional-whiteSmoke/40 ${
                          haCambiado ? "bg-amber-50/40" : ""
                        }`}
                      >
                        {/* # */}
                        <td className="py-2 px-3 text-center font-mono text-gray-500 font-medium">
                          {index + 1}
                        </td>

                        {/* CÓDIGO DE PUESTO (Editable) */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="text"
                              value={valorActual}
                              onChange={(e) => handleCodigoChange(puesto.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && haCambiado) {
                                  e.preventDefault();
                                  handleGuardarFila(puesto);
                                }
                              }}
                              className={`h-7.5 text-xs font-mono font-semibold uppercase px-2 w-full rounded-md ${
                                haCambiado
                                  ? "border-amber-500 bg-amber-50/70 text-amber-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-500/30"
                                  : "border-gray-300 bg-white text-base-eerieBlack focus:border-institucional-green"
                              }`}
                              placeholder="Ej. BODEGA N-A-01"
                            />
                            {haCambiado && (
                              <span
                                className="h-2 w-2 rounded-full bg-amber-500 shrink-0"
                                title="Cambio no guardado"
                              />
                            )}
                          </div>
                        </td>

                        {/* ESTADO */}
                        <td className="py-2 px-3 text-center">
                          {puesto.estado === "Ocupado" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              Ocupado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                              Vacante
                            </span>
                          )}
                        </td>

                        {/* COMERCIANTE ASIGNADO */}
                        <td className="py-2 px-3">
                          {puesto.estado === "Ocupado" && puesto.comerciante ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-base-eerieBlack">
                                <User size={12} className="text-institucional-green shrink-0" />
                                <span>{puesto.comerciante.contribuyente || "Sin nombre registrado"}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                <span>
                                  CIU: <strong className="font-mono text-gray-700">{puesto.comerciante.ciu || "-"}</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Cédula: <span className="font-mono">{puesto.comerciante.cedula || "-"}</span>
                                </span>
                                {puesto.comerciante.actividad && (
                                  <>
                                    <span>•</span>
                                    <span className="text-gray-600 italic">
                                      {puesto.comerciante.actividad}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic font-mono text-[11px]">
                              Disponible / Vacante
                            </span>
                          )}
                        </td>

                        {/* ACCIÓN (Guardar individual) */}
                        <td className="py-2 px-3 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!haCambiado || estaGuardando}
                            onClick={() => handleGuardarFila(puesto)}
                            className={`h-7 px-2 text-xs font-semibold rounded-md ${
                              haCambiado
                                ? "bg-institucional-green/10 text-institucional-green hover:bg-institucional-green hover:text-white"
                                : "text-gray-300 cursor-not-allowed"
                            }`}
                            title={haCambiado ? "Guardar cambio de este puesto" : "Sin cambios"}
                          >
                            {estaGuardando ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : haCambiado ? (
                              <Save size={13} />
                            ) : (
                              <Check size={13} />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie del modal con botón de guardado en lote */}
        <DialogFooter className="shrink-0 flex items-center justify-between border-t border-institucional-whiteSmokeBlack/15 pt-3 gap-3">
          <div className="text-xs text-gray-600">
            {cambiosPendientes.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                <AlertCircle size={14} />
                {cambiosPendientes.length} cambio(s) de código pendiente(s) por guardar
              </span>
            ) : (
              <span className="text-gray-500">
                Todos los códigos de puestos están guardados y sincronizados.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={guardandoLote}
              className="h-8.5 text-xs font-medium"
            >
              Cerrar
            </Button>

            <Button
              type="button"
              onClick={handleGuardarLote}
              disabled={cambiosPendientes.length === 0 || guardandoLote}
              className="h-8.5 text-xs font-semibold bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 flex items-center gap-1.5"
            >
              {guardandoLote ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Guardando Cambios...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Guardar Cambios de Puestos ({cambiosPendientes.length})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
