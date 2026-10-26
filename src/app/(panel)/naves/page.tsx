"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Search,
  Plus,
  Trash2,
  Pencil,
  LayoutGrid,
  Store,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { naveService } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
import type { Nave } from "@/domain/models/nave.model";
import type { Comerciante } from "@/domain/models/comerciante.model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalesCrudNave } from "./components/ModalesCrudNave";
import { PlanificadorEspacial } from "./components/PlanificadorEspacial";
import { ModalPuestosNave } from "./components/ModalPuestosNave";
import { ModalReporteVacantes } from "./components/ModalReporteVacantes";

export default function NavesPage() {
  const [naves, setNaves] = useState<Nave[]>([]);
  const [cargando, setCargando] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [supervisoresDisponibles, setSupervisoresDisponibles] = useState<string[]>([]);
  const [comerciantes, setComerciantes] = useState<Comerciante[]>([]);
  const [navePlanoId, setNavePlanoId] = useState<string>("");

  // Estado del modal de Crear Nave
  const [isCrearOpen, setIsCrearOpen] = useState(false);
  const [isReporteVacantesOpen, setIsReporteVacantesOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("100");
  const [nuevoSupervisores, setNuevoSupervisores] = useState<string[]>([]);
  const [crearError, setCrearError] = useState("");

  // Estado del modal de Editar Nave
  const [editingNave, setEditingNave] = useState<Nave | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [editSupervisores, setEditSupervisores] = useState<string[]>([]);
  const [puestosOcupados, setPuestosOcupados] = useState(0);
  const [editarError, setEditarError] = useState("");
  const [guardandoNave, setGuardandoNave] = useState(false);

  // Estado del modal de Gestión de Puestos de Nave
  const [navePuestosModal, setNavePuestosModal] = useState<Nave | null>(null);

  const handleOpenPuestos = (nave: Nave) => {
    setNavePuestosModal(nave);
  };

  const handleClosePuestos = () => {
    setNavePuestosModal(null);
  };

  const handlePuestosActualizados = async () => {
    const [navesActualizadas, commsActualizados] = await Promise.all([
      naveService.obtenerNaves(),
      comercianteService.obtenerComerciantes(),
    ]);
    setNaves(navesActualizadas);
    setComerciantes(commsActualizados);
    if (navePuestosModal) {
      const encontrada = navesActualizadas.find((n) => n.id === navePuestosModal.id);
      if (encontrada) {
        setNavePuestosModal(encontrada);
      }
    }
  };

  useEffect(() => {
    let activo = true;
    Promise.all([
      naveService.obtenerNaves(),
      naveService.obtenerSupervisoresDisponibles(),
      comercianteService.obtenerComerciantes(),
    ]).then(([navesData, supData, commsData]) => {
      if (activo) {
        setNaves(navesData);
        setSupervisoresDisponibles(supData);
        setComerciantes(commsData);
        if (navesData.length > 0) {
          setNavePlanoId((prev) => prev || navesData[0].id);
        }
        setCargando(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  // Filtrado de naves por búsqueda
  const navesFiltradas = naves.filter((nave) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const matchSupervisores = nave.supervisores?.some((s) =>
      s.toLowerCase().includes(q)
    );
    return (
      nave.nombre.toLowerCase().includes(q) ||
      nave.id.toLowerCase().includes(q) ||
      Boolean(matchSupervisores)
    );
  });

  // Cálculo de puestos actualmente ocupados por nave
  const puestosOcupadosPorNave = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of naves) {
      const puestosOcupadosEnNave = new Set(
        (n.puestos ?? [])
          .filter((p) => p.estado === "Ocupado" && p.comercianteId)
          .map((p) => p.comercianteId)
      );
      const comerciantesEnNave = comerciantes.filter(
        (c) =>
          c.estadoRegistro !== "Deshabilitado" &&
          ((c.nave && c.nave.trim().toUpperCase() === n.nombre.trim().toUpperCase()) ||
            puestosOcupadosEnNave.has(c.idInterno))
      );
      const puestosOcupadosNave = (n.puestos ?? []).filter((p) => p.estado === "Ocupado").length;
      const ocupados = Math.max(comerciantesEnNave.length, puestosOcupadosNave);
      map.set(n.id, ocupados);
    }
    return map;
  }, [naves, comerciantes]);

  // ── Manejadores de Creación ───────────────────────────────────────────────

  function handleOpenCrear() {
    setNuevoNombre("");
    setNuevaCantidad("100");
    setNuevoSupervisores([]);
    setCrearError("");
    setIsCrearOpen(true);
  }

  function handleToggleSupervisorNuevo(sup: string) {
    setNuevoSupervisores((prev) =>
      prev.includes(sup) ? prev.filter((s) => s !== sup) : [...prev, sup]
    );
  }

  async function handleCrearNave(e: React.FormEvent) {
    e.preventDefault();
    setCrearError("");

    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setCrearError("El nombre de la nave es obligatorio.");
      return;
    }

    const cantidad = parseInt(nuevaCantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      setCrearError("La cantidad de puestos debe ser un número mayor a cero.");
      return;
    }

    setGuardandoNave(true);
    try {
      const naveCreada = await naveService.crearNave(nombre, cantidad, nuevoSupervisores);
      const navesActualizadas = await naveService.obtenerNaves();
      setNaves(navesActualizadas);
      setIsCrearOpen(false);

      toast.success(`Nave ${naveCreada.nombre} creada exitosamente`, {
        description: `Capacidad registrada: ${naveCreada.cantidadPuestos} puestos.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear la nave.";
      setCrearError(msg);
      toast.error(msg);
    } finally {
      setGuardandoNave(false);
    }
  }

  // ── Manejadores de Edición ────────────────────────────────────────────────

  async function handleOpenEditar(nave: Nave) {
    setEditingNave(nave);
    setEditNombre(nave.nombre);
    setEditCantidad(String(nave.cantidadPuestos));
    setEditSupervisores(nave.supervisores ? [...nave.supervisores] : []);
    setEditarError("");

    // Cálculo de puestos actualmente ocupados por comerciantes en esta nave
    const comerciantesLista = await comercianteService.obtenerComerciantes();
    const puestosOcupadosEnNave = new Set(
      (nave.puestos ?? [])
        .filter((p) => p.estado === "Ocupado" && p.comercianteId)
        .map((p) => p.comercianteId)
    );
    const comerciantesEnNave = comerciantesLista.filter(
      (c) =>
        c.estadoRegistro !== "Deshabilitado" &&
        ((c.nave && c.nave.trim().toUpperCase() === nave.nombre.trim().toUpperCase()) ||
          puestosOcupadosEnNave.has(c.idInterno))
    );
    const puestosOcupadosNave = (nave.puestos ?? []).filter((p) => p.estado === "Ocupado").length;
    const ocupados = Math.max(comerciantesEnNave.length, puestosOcupadosNave);
    setPuestosOcupados(ocupados);
  }

  function handleToggleSupervisorEdit(sup: string) {
    setEditSupervisores((prev) =>
      prev.includes(sup) ? prev.filter((s) => s !== sup) : [...prev, sup]
    );
  }

  async function handleGuardarEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNave) return;
    setEditarError("");

    const nombre = editNombre.trim();
    if (!nombre) {
      setEditarError("El nombre de la nave no puede estar vacío.");
      return;
    }

    const cantidad = parseInt(editCantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      setEditarError("Debe ingresar una cantidad válida mayor a cero.");
      return;
    }

    // Regla de Negocio: No se puede reducir la capacidad por debajo de los comerciantes ocupados
    if (cantidad < puestosOcupados) {
      toast.error(
        "No se puede reducir la capacidad. Hay " +
          puestosOcupados +
          " comerciantes actualmente asignados a esta nave."
      );
      return;
    }

    setGuardandoNave(true);
    try {
      const actualizada = await naveService.actualizarNave(editingNave.id, {
        nombre,
        cantidadPuestos: cantidad,
        supervisores: editSupervisores,
      });

      if (actualizada) {
        const navesActualizadas = await naveService.obtenerNaves();
        setNaves(navesActualizadas);
        setEditingNave(null);
        toast.success(`Nave ${actualizada.nombre} actualizada correctamente`);
      } else {
        setEditarError("No se pudo actualizar la nave seleccionada.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar la nave.";
      setEditarError(msg);
      toast.error(msg);
    } finally {
      setGuardandoNave(false);
    }
  }

  // ── Manejador de Eliminación (Validación de Regla de Negocio) ──────────────

  async function handleEliminar(nave: Nave) {
    const resultado = await naveService.eliminarNave(nave.id);

    if (!resultado.exito) {
      toast.error(
        resultado.mensaje ||
          "No se puede eliminar la nave porque tiene comerciantes asignados."
      );
      return;
    }

    const navesActualizadas = await naveService.obtenerNaves();
    setNaves(navesActualizadas);
    toast.success(resultado.mensaje);
  }

  function handleSeleccionarNaveParaPlano(naveId: string) {
    if (naveId !== navePlanoId) {
      setNavePlanoId(naveId);
    }
    setTimeout(() => {
      const el = document.getElementById("planificador-espacial");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  return (
    <div className="min-h-[100dvh] bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      {/* ── Encabezado Limpio ── */}
      <header className="mb-6 w-full max-w-none px-4">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Gestión de Naves y Puestos
          </h1>
        </div>
      </header>

      <div className="w-full max-w-none px-4 space-y-4">
        {/* ── Layout Responsivo: Buscador y Botón Crear Nave en la misma línea ── */}
        <div className="flex w-full items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
            />
            <Input
              type="text"
              placeholder="Buscar nave por nombre o supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full flex-1 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsReporteVacantesOpen(true)}
            className="border-institucional-green text-institucional-green hover:bg-institucional-green/10 shrink-0 whitespace-nowrap h-9 font-semibold"
          >
            <FileText className="mr-2" size={14} />
            Generar Reporte
          </Button>

          <Button
            type="button"
            onClick={handleOpenCrear}
            className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 shrink-0 whitespace-nowrap h-9 font-semibold"
          >
            <Plus size={14} className="mr-2" />
            Crear Nave
          </Button>
        </div>

        {/* ── Tabla de Naves (Replicando exactamente el diseño de Comerciantes) ── */}
        <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-institucional-whiteSmokeBlack/15">
            <p className="text-xs font-medium text-gray-700">
              {navesFiltradas.length} de {naves.length} naves
            </p>
          </div>
          <div className="max-h-[500px] overflow-y-auto p-3 md:p-0">
            <table className="w-full text-sm block md:table">
              <thead className="hidden md:table-header-group sticky top-0 z-20">
                <tr className="bg-[#e6efe9]">
                  <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-20">
                    NAVE
                  </th>
                  <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-20">
                    CANTIDAD DE PUESTOS
                  </th>
                  <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-20">
                    SUPERVISOR(ES)
                  </th>
                  <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-20">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group space-y-3 md:space-y-0">
                {cargando ? (
                  <tr className="block md:table-row">
                    <td
                      colSpan={4}
                      className="block md:table-cell px-4 py-10 text-center text-sm text-gray-700"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 rounded-full border-2 border-institucional-green/30 border-t-institucional-green animate-spin" />
                        <span>Cargando naves del mercado...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  navesFiltradas.map((nave) => (
                    <tr
                      key={nave.id}
                      onClick={() => handleOpenPuestos(nave)}
                      className="cursor-pointer flex flex-col md:table-row rounded-xl md:rounded-none border border-institucional-whiteSmokeBlack/20 md:border-0 md:border-t md:border-institucional-whiteSmokeBlack/10 p-3.5 md:p-0 bg-base-white mb-3 md:mb-0 shadow-sm md:shadow-none transition-colors hover:bg-institucional-whiteSmoke/60"
                    >
                      {/* NAVE */}
                      <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 font-semibold text-base-eerieBlack text-sm md:table-cell">
                        <span className="font-semibold text-gray-700 md:hidden">Nave:</span>
                        <span className="hover:text-institucional-green transition-colors">{nave.nombre}</span>
                      </td>

                      {/* CANTIDAD DE PUESTOS */}
                      <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 text-sm md:text-center md:table-cell">
                        <span className="font-semibold text-gray-700 md:hidden">Puestos Ocupados / Capacidad:</span>
                        {(() => {
                          const ocupados = puestosOcupadosPorNave.get(nave.id) ?? 0;
                          const porcentaje = Math.min(100, Math.round((ocupados / (nave.cantidadPuestos || 1)) * 100));
                          return (
                            <div className="flex flex-col md:items-center items-end gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold font-mono text-sm text-base-eerieBlack">
                                  {ocupados}
                                </span>
                                <span className="text-gray-400 font-mono text-xs">/</span>
                                <span className="font-mono text-xs text-gray-600 font-medium">
                                  {nave.cantidadPuestos}
                                </span>
                                <span className="ml-1 inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                  {porcentaje}%
                                </span>
                              </div>
                              {/* Mini barra de ocupación */}
                              <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden ring-1 ring-black/5">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    porcentaje >= 100
                                      ? "bg-amber-600"
                                      : porcentaje >= 75
                                      ? "bg-institucional-green"
                                      : "bg-acento-azul1"
                                  }`}
                                  style={{ width: `${porcentaje}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 hidden md:inline">
                                {ocupados} ocupados de {nave.cantidadPuestos}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* SUPERVISOR(ES) */}
                      <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-700 text-sm md:table-cell">
                        <span className="font-semibold text-gray-700 md:hidden">Supervisor(es):</span>
                        <div className="flex flex-wrap justify-end md:justify-start gap-1">
                          {nave.supervisores && nave.supervisores.length > 0 ? (
                            nave.supervisores.map((sup, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
                              >
                                {sup}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-700 italic">
                              Sin asignar
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ACCIONES */}
                      <td className="flex justify-between items-center pt-2.5 mt-1 border-t border-institucional-whiteSmokeBlack/10 md:border-t-0 md:pt-0 md:px-4 md:py-2.5 text-center md:table-cell">
                        <span className="font-semibold text-gray-700 md:hidden">Acciones:</span>
                        <div className="flex items-center justify-end md:justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPuestos(nave);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Ver y Editar Puestos"
                            aria-label="Ver y Editar Puestos"
                          >
                            <Store size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeleccionarNaveParaPlano(nave.id);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-institucional-green hover:bg-institucional-green/10 transition-colors"
                            title="Planificar espacio en cuadrícula"
                            aria-label="Planificar espacio en cuadrícula"
                          >
                            <LayoutGrid size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditar(nave);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                            title="Editar"
                            aria-label="Editar Nave"
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEliminar(nave);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-base-red hover:bg-base-red/10"
                            title="Eliminar"
                            aria-label="Eliminar Nave"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {!cargando && navesFiltradas.length === 0 && (
                  <tr className="block md:table-row">
                    <td
                      colSpan={4}
                      className="block md:table-cell px-4 py-10 text-center text-sm text-gray-700"
                    >
                      No se encontraron naves que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Planificador Espacial de Naves y Distribución de Puestos (Croquis / Mapa) ── */}
        <PlanificadorEspacial
          naves={naves}
          naveActivaId={navePlanoId}
          onCambiarNaveActiva={handleSeleccionarNaveParaPlano}
          comerciantes={comerciantes}
        />
      </div>

      {/* ── Modales CRUD de Naves ── */}
      <ModalesCrudNave
        isCrearOpen={isCrearOpen}
        setIsCrearOpen={setIsCrearOpen}
        nuevoNombre={nuevoNombre}
        setNuevoNombre={setNuevoNombre}
        nuevaCantidad={nuevaCantidad}
        setNuevaCantidad={setNuevaCantidad}
        nuevoSupervisores={nuevoSupervisores}
        handleToggleSupervisorNuevo={handleToggleSupervisorNuevo}
        crearError={crearError}
        handleCrearNave={handleCrearNave}
        editingNave={editingNave}
        setEditingNave={setEditingNave}
        editNombre={editNombre}
        setEditNombre={setEditNombre}
        editCantidad={editCantidad}
        setEditCantidad={setEditCantidad}
        editSupervisores={editSupervisores}
        handleToggleSupervisorEdit={handleToggleSupervisorEdit}
        editarError={editarError}
        puestosOcupados={puestosOcupados}
        handleGuardarEditar={handleGuardarEditar}
        supervisoresDisponibles={supervisoresDisponibles}
        guardando={guardandoNave}
      />

      {/* ── Modal de Gestión Interactiva de Puestos por Nave ── */}
      <ModalPuestosNave
        nave={navePuestosModal}
        isOpen={Boolean(navePuestosModal)}
        onClose={handleClosePuestos}
        onPuestosActualizados={handlePuestosActualizados}
        comerciantes={comerciantes}
      />

      {/* ── Modal de Certificación de Espacios Públicos Vacantes ── */}
      <ModalReporteVacantes
        isOpen={isReporteVacantesOpen}
        onClose={() => setIsReporteVacantesOpen(false)}
      />
    </div>
  );
}
