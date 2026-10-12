"use client";

import { useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Nave } from "@/domain/models/nave.model";
import {
  obtenerNaves,
  crearNave,
  actualizarNave,
  eliminarNave,
  obtenerSupervisoresDisponibles,
} from "@/infrastructure/mocks/naves.mock";
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
  const [naves, setNaves] = useState<Nave[]>(() => obtenerNaves());
  const [searchQuery, setSearchQuery] = useState("");
  const supervisoresDisponibles = obtenerSupervisoresDisponibles();

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

  function handleCrearNave(e: React.FormEvent) {
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

    const naveCreada = crearNave(nombre, cantidad, nuevoSupervisores);
    setNaves(obtenerNaves());
    setIsCrearOpen(false);

    toast.success(`Nave ${naveCreada.nombre} creada exitosamente`, {
      description: `Capacidad registrada: ${naveCreada.cantidadPuestos} puestos.`,
    });
  }

  // ── Manejadores de Edición ────────────────────────────────────────────────

  function handleOpenEditar(nave: Nave) {
    setEditingNave(nave);
    setEditNombre(nave.nombre);
    setEditCantidad(String(nave.cantidadPuestos));
    setEditSupervisores(nave.supervisores ? [...nave.supervisores] : []);
    setEditarError("");
  }

  function handleToggleSupervisorEdit(sup: string) {
    setEditSupervisores((prev) =>
      prev.includes(sup) ? prev.filter((s) => s !== sup) : [...prev, sup]
    );
  }

  function handleGuardarEditar(e: React.FormEvent) {
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

    const actualizada = actualizarNave(editingNave.id, {
      nombre,
      cantidadPuestos: cantidad,
      supervisores: editSupervisores,
    });

    if (actualizada) {
      setNaves(obtenerNaves());
      setEditingNave(null);
      toast.success(`Nave ${actualizada.nombre} actualizada correctamente`);
    } else {
      setEditarError("No se pudo actualizar la nave seleccionada.");
    }
  }

  // ── Manejador de Eliminación (Validación de Regla de Negocio) ──────────────

  function handleEliminar(nave: Nave) {
    const resultado = eliminarNave(nave.id);

    if (!resultado.exito) {
      toast.error(
        resultado.mensaje ||
          "No se puede eliminar la nave porque tiene comerciantes asignados."
      );
      return;
    }

    setNaves(obtenerNaves());
    toast.success(resultado.mensaje);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-institucional-whiteSmokeBlack"
            />
            <Input
              type="text"
              placeholder="Buscar nave por nombre o código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full flex-1 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
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
            <p className="text-xs font-medium text-institucional-whiteSmokeBlack">
              {navesFiltradas.length} de {naves.length} naves
            </p>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-institucional-green/10">
                  <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                    ID
                  </th>
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
              <tbody>
                {navesFiltradas.map((nave) => (
                  <tr
                    key={nave.id}
                    className="border-t border-institucional-whiteSmokeBlack/10 transition-colors hover:bg-institucional-whiteSmoke/50"
                  >
                    {/* ID */}
                    <td className="px-4 py-2.5 font-mono text-acento-azul1 font-medium">
                      {nave.id}
                    </td>

                    {/* NAVE */}
                    <td className="px-4 py-2.5 font-semibold text-base-eerieBlack">
                      {nave.nombre}
                    </td>

                    {/* CANTIDAD DE PUESTOS */}
                    <td className="px-4 py-2.5 text-center text-gray-900 font-mono">
                      {nave.cantidadPuestos}
                    </td>

                    {/* SUPERVISOR(ES) */}
                    <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack">
                      <div className="flex flex-wrap gap-1">
                        {nave.supervisores && nave.supervisores.length > 0 ? (
                          nave.supervisores.map((sup, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
                            >
                              {sup}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-institucional-whiteSmokeBlack/60 italic">
                            Sin asignar
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ACCIONES */}
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
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
                ))}

                {navesFiltradas.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-institucional-whiteSmokeBlack"
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
            <DialogDescription className="text-xs text-institucional-whiteSmokeBlack pt-1">
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
            <DialogDescription className="text-xs text-institucional-whiteSmokeBlack pt-1">
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
                  min={1}
                  max={1000}
                  value={editCantidad}
                  onChange={(e) => setEditCantidad(e.target.value)}
                  className="bg-base-white text-sm h-9"
                  required
                />
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
