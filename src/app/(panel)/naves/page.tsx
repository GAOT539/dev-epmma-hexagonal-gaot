"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Nave } from "@/domain/models/nave.model";
import { naveService } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
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

export default function NavesPage() {
  const [naves, setNaves] = useState<Nave[]>([]);
  const [cargando, setCargando] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [supervisoresDisponibles, setSupervisoresDisponibles] = useState<string[]>([]);

  useEffect(() => {
    let activo = true;
    Promise.all([
      naveService.obtenerNaves(),
      naveService.obtenerSupervisoresDisponibles(),
    ]).then(([navesData, supData]) => {
      if (activo) {
        setNaves(navesData);
        setSupervisoresDisponibles(supData);
        setCargando(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  // Estado del modal de Crear Nave
  const [isCrearOpen, setIsCrearOpen] = useState(false);
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

    const naveCreada = await naveService.crearNave(nombre, cantidad, nuevoSupervisores);
    const navesActualizadas = await naveService.obtenerNaves();
    setNaves(navesActualizadas);
    setIsCrearOpen(false);

    toast.success(`Nave ${naveCreada.nombre} creada exitosamente`, {
      description: `Capacidad registrada: ${naveCreada.cantidadPuestos} puestos.`,
    });
  }

  // ── Manejadores de Edición ────────────────────────────────────────────────

  async function handleOpenEditar(nave: Nave) {
    setEditingNave(nave);
    setEditNombre(nave.nombre);
    setEditCantidad(String(nave.cantidadPuestos));
    setEditSupervisores(nave.supervisores ? [...nave.supervisores] : []);
    setEditarError("");

    // Cálculo de puestos actualmente ocupados por comerciantes en esta nave
    const comerciantes = await comercianteService.obtenerComerciantes();
    const puestosOcupadosEnNave = new Set(
      (nave.puestos ?? [])
        .filter((p) => p.estado === "Ocupado" && p.comercianteId)
        .map((p) => p.comercianteId)
    );
    const comerciantesEnNave = comerciantes.filter(
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
              <thead className="hidden md:table-header-group sticky top-0 z-10">
                <tr className="bg-institucional-green/10">
                  <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                    NAVE
                  </th>
                  <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-10">
                    CANTIDAD DE PUESTOS
                  </th>
                  <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                    SUPERVISOR(ES)
                  </th>
                  <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-10">
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
                    className="flex flex-col md:table-row rounded-xl md:rounded-none border border-institucional-whiteSmokeBlack/20 md:border-0 md:border-t md:border-institucional-whiteSmokeBlack/10 p-3.5 md:p-0 bg-base-white mb-3 md:mb-0 shadow-sm md:shadow-none transition-colors hover:bg-institucional-whiteSmoke/50"
                  >
                    {/* NAVE */}
                    <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 font-semibold text-base-eerieBlack text-sm md:table-cell">
                      <span className="font-semibold text-gray-700 md:hidden">Nave:</span>
                      <span>{nave.nombre}</span>
                    </td>

                    {/* CANTIDAD DE PUESTOS */}
                    <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 font-mono text-sm md:text-center md:table-cell">
                      <span className="font-semibold text-gray-700 md:hidden">Cantidad de Puestos:</span>
                      <span>{nave.cantidadPuestos}</span>
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
                          onClick={() => handleOpenEditar(nave)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                          title="Editar"
                          aria-label="Editar Nave"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEliminar(nave)}
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
      </div>

      {/* ── Modal: Crear Nave ── */}
      <Dialog
        open={isCrearOpen}
        disablePointerDismissal={true}
        onOpenChange={(open) => !open && setIsCrearOpen(false)}
      >
        <DialogContent className="sm:max-w-md bg-base-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-base-eerieBlack">
              <Building2 className="text-institucional-green" size={20} />
              Crear Nueva Nave
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-700 pt-1">
              Ingrese los datos identificadores, la capacidad y los supervisores asignados.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCrearNave} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                Nombre de la Nave *
              </label>
              <Input
                type="text"
                placeholder="Ej. NAVE F"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="bg-base-white text-sm h-9"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                Cantidad Inicial de Puestos *
              </label>
              <Input
                type="number"
                min={1}
                max={1000}
                placeholder="Ej. 100"
                value={nuevaCantidad}
                onChange={(e) => setNuevaCantidad(e.target.value)}
                className="bg-base-white text-sm h-9"
                required
              />
            </div>

            {/* Asignar Supervisor(es) */}
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                Asignar Supervisor(es)
              </label>
              <div className="space-y-1.5 rounded-lg border border-border bg-base-white p-3 max-h-48 overflow-y-auto">
                {supervisoresDisponibles.map((sup) => {
                  const isChecked = nuevoSupervisores.includes(sup);
                  return (
                    <label
                      key={sup}
                      className="flex items-center gap-2.5 text-xs text-base-eerieBlack cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSupervisorNuevo(sup)}
                        className="rounded border-gray-300 text-institucional-green focus:ring-institucional-green h-4 w-4"
                      />
                      <span className="font-medium">{sup}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {crearError && (
              <p className="text-xs text-base-red font-medium">{crearError}</p>
            )}

            <DialogFooter className="gap-2 sm:justify-end pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCrearOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Guardar Nave
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar Nave ── */}
      <Dialog
        open={Boolean(editingNave)}
        disablePointerDismissal={true}
        onOpenChange={(open) => !open && setEditingNave(null)}
      >
        <DialogContent className="sm:max-w-md bg-base-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-base-eerieBlack">
              <Pencil className="text-institucional-green" size={18} />
              Editar Nave
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-700 pt-1">
              Modifique el nombre, la cantidad de puestos y los supervisores asignados.
            </DialogDescription>
          </DialogHeader>

          {editingNave && (
            <form onSubmit={handleGuardarEditar} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Nombre de la Nave *
                </label>
                <Input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="bg-base-white text-sm h-9"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Cantidad de Puestos *
                </label>
                <Input
                  type="number"
                  min={puestosOcupados}
                  max={1000}
                  value={editCantidad}
                  onChange={(e) => setEditCantidad(e.target.value)}
                  className="bg-base-white text-sm h-9"
                  required
                />
                <p className="text-sm text-gray-700 mt-1.5">
                  Puestos actualmente ocupados: {puestosOcupados}. No puede reducir la capacidad por debajo de este número.
                </p>
              </div>

              {/* Asignar Supervisor(es) */}
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Supervisor(es) Asignado(s)
                </label>
                <div className="space-y-1.5 rounded-lg border border-border bg-base-white p-3 max-h-48 overflow-y-auto">
                  {supervisoresDisponibles.map((sup) => {
                    const isChecked = editSupervisores.includes(sup);
                    return (
                      <label
                        key={sup}
                        className="flex items-center gap-2.5 text-xs text-base-eerieBlack cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSupervisorEdit(sup)}
                          className="rounded border-gray-300 text-institucional-green focus:ring-institucional-green h-4 w-4"
                        />
                        <span className="font-medium">{sup}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editarError && (
                <p className="text-xs text-base-red font-medium">{editarError}</p>
              )}

              <DialogFooter className="gap-2 sm:justify-end pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingNave(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
                >
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
