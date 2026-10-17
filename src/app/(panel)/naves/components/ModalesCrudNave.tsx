"use client";

import React from "react";
import { Building2, Pencil } from "lucide-react";
import type { Nave } from "@/domain/models/nave.model";
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

interface ModalesCrudNaveProps {
  // Modal Crear
  isCrearOpen: boolean;
  setIsCrearOpen: (open: boolean) => void;
  nuevoNombre: string;
  setNuevoNombre: (nombre: string) => void;
  nuevaCantidad: string;
  setNuevaCantidad: (cantidad: string) => void;
  nuevoSupervisores: string[];
  handleToggleSupervisorNuevo: (sup: string) => void;
  crearError: string;
  handleCrearNave: (e: React.FormEvent) => void;

  // Modal Editar
  editingNave: Nave | null;
  setEditingNave: (nave: Nave | null) => void;
  editNombre: string;
  setEditNombre: (nombre: string) => void;
  editCantidad: string;
  setEditCantidad: (cantidad: string) => void;
  editSupervisores: string[];
  handleToggleSupervisorEdit: (sup: string) => void;
  editarError: string;
  puestosOcupados: number;
  handleGuardarEditar: (e: React.FormEvent) => void;

  // Compartido
  supervisoresDisponibles: string[];
}

export function ModalesCrudNave({
  isCrearOpen,
  setIsCrearOpen,
  nuevoNombre,
  setNuevoNombre,
  nuevaCantidad,
  setNuevaCantidad,
  nuevoSupervisores,
  handleToggleSupervisorNuevo,
  crearError,
  handleCrearNave,
  editingNave,
  setEditingNave,
  editNombre,
  setEditNombre,
  editCantidad,
  setEditCantidad,
  editSupervisores,
  handleToggleSupervisorEdit,
  editarError,
  puestosOcupados,
  handleGuardarEditar,
  supervisoresDisponibles,
}: ModalesCrudNaveProps) {
  return (
    <>
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
    </>
  );
}
