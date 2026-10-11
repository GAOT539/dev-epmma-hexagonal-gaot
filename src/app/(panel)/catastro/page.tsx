"use client";

import { useCallback, useState } from "react";
import {
  Monitor,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
} from "lucide-react";
// Removido importador
import {
  getComerciantes,
  getNaves,
  getPuestosPorNave,
  agregarComerciante,
  editarComerciante,
  eliminarComerciante,
} from "@/infrastructure/mocks/mercado.mock";
import type { Comerciante } from "@/domain/models/comerciante.model";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/infrastructure/auth/auth-context";

// ── Modal CRUD Comerciante ───────────────────────────────────────────────────

function ComercianteFormDialog({
  open,
  comerciante,
  onClose,
  onSave,
}: {
  open: boolean;
  comerciante: Comerciante | null; // null = nuevo
  onClose: () => void;
  onSave: () => void;
}) {
  const naves = getNaves();
  const isEdit = !!comerciante;

  const [ciu, setCiu] = useState(comerciante?.ciu ?? "");
  const [contribuyente, setContribuyente] = useState(comerciante?.contribuyente ?? "");
  const [actividad, setActividad] = useState(comerciante?.actividad ?? "");
  const [naveId, setNaveId] = useState(naves[0]?.id ?? "");
  const [puestoId, setPuestoId] = useState("");
  const [error, setError] = useState("");

  const puestosNave = getPuestosPorNave(naveId);
  const puestosVacantes = puestosNave.filter(p => p.estado === "Vacante");

  function handleNaveChange(id: string) {
    setNaveId(id);
    setPuestoId("");
  }

  function handleSubmit() {
    setError("");

    if (!ciu.trim() || !contribuyente.trim() || !actividad.trim()) {
      setError("CIU, Contribuyente y Actividad son obligatorios.");
      return;
    }

    if (isEdit && comerciante) {
      editarComerciante(comerciante.idInterno, {
        ciu: ciu.trim(),
        contribuyente: contribuyente.trim(),
        actividad: actividad.trim(),
        ...(puestoId && { puestoId, naveId }),
      });
      toast.success("Comerciante actualizado", {
        description: `${contribuyente} editado correctamente.`,
      });
    } else {
      if (!naveId || !puestoId) {
        setError("Debe seleccionar Nave y Puesto para un nuevo comerciante.");
        return;
      }
      agregarComerciante({
        ciu: ciu.trim(),
        contribuyente: contribuyente.trim(),
        actividad: actividad.trim(),
        naveId,
        puestoId,
      });
      toast.success("Comerciante creado", {
        description: `${contribuyente} agregado correctamente.`,
      });
    }

    onSave();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                <Pencil size={18} className="text-acento-azul1" />
                Editar Comerciante
              </>
            ) : (
              <>
                <Plus size={18} className="text-institucional-green" />
                Nuevo Comerciante
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifique los datos del comerciante seleccionado."
              : "Complete los datos para registrar un nuevo comerciante."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ciu">CIU</Label>
              <Input
                id="ciu"
                value={ciu}
                onChange={(e) => setCiu(e.target.value)}
                placeholder="CIU-00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actividad">Actividad</Label>
              <Input
                id="actividad"
                value={actividad}
                onChange={(e) => setActividad(e.target.value)}
                placeholder="Frutas, Carnes..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contribuyente">Contribuyente</Label>
              <Input
                id="contribuyente"
                value={contribuyente}
                onChange={(e) => setContribuyente(e.target.value)}
                placeholder="Nombres y Apellidos"
              />
            </div>
          </div>

          {/* Nave / Puesto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="puesto">Puesto</Label>
              <select
                id="puesto"
                value={puestoId}
                onChange={(e) => setPuestoId(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="">
                  {isEdit ? "Mantener actual" : "Seleccionar..."}
                </option>
                {puestosVacantes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-base-red font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
          >
            {isEdit ? "Guardar Cambios" : "Crear Comerciante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Confirmación de eliminación ──────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  comerciante,
  onClose,
  onConfirm,
}: {
  open: boolean;
  comerciante: Comerciante | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base-red">
            <Trash2 size={18} />
            Eliminar Comerciante
          </DialogTitle>
          <DialogDescription>
            ¿Está seguro de que desea eliminar a{" "}
            <strong>
              {comerciante?.contribuyente}
            </strong>{" "}
            ({comerciante?.ciu})? Esta acción no se puede deshacer y el puesto
            quedará vacante.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-base-red text-base-white hover:bg-base-red/90"
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página TIC / Catastro ────────────────────────────────────────────────────

export default function TicPage() {
  const { user } = useAuth();


  // CRUD state
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingComerciante, setEditingComerciante] = useState<Comerciante | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comerciante | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedNaveId, setSelectedNaveId] = useState("");

  const naves = getNaves();
  const comerciantes = getComerciantes();

  // Filtrar comerciantes
  const comerciantesFiltrados = comerciantes.filter((c) => {
    // Filtro por nave si está seleccionado
    if (selectedNaveId) {
      const nave = naves.find(n => n.id === selectedNaveId);
      if (!nave) return false;
      const perteneceANave = nave.puestos.some(p => p.comercianteId === c.idInterno);
      if (!perteneceANave) return false;
    }

    if (!searchQuery.trim()) return true;
    
    const q = searchQuery.toLowerCase();
    return (
      c.contribuyente.toLowerCase().includes(q) ||
      c.ciu.toLowerCase().includes(q) ||
      c.cedula.includes(q)
    );
  });

  // CRUD handlers
  function handleNuevo() {
    setEditingComerciante(null);
    setFormOpen(true);
  }

  function handleEditar(com: Comerciante) {
    setEditingComerciante(com);
    setFormOpen(true);
  }

  function handleEliminar(com: Comerciante) {
    setDeleteTarget(com);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    
    // Soft Delete: en lugar de eliminar, deshabilitamos
    editarComerciante(deleteTarget.idInterno, {
      deshabilitadoPor: user ? `${user.nombres} ${user.apellidos}` : "Sistema"
    });
    
    toast.success("Comerciante deshabilitado", {
      description: `${deleteTarget.contribuyente} ha sido deshabilitado.`,
    });
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 w-full max-w-none px-4">
        <div className="flex items-center gap-2">
          <Monitor size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Catastro — Gestión de Comerciantes
          </h1>
        </div>
      </header>

      <div className="w-full max-w-none px-4 space-y-4">
        {/* Barra de herramientas */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedNaveId}
                onChange={(e) => setSelectedNaveId(e.target.value)}
                className="h-9 w-full sm:w-auto min-w-[200px] rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="">Todas las naves</option>
                {naves.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
              <div className="relative flex-1 w-full">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-institucional-whiteSmokeBlack"
                />
                <input
                  type="text"
                  placeholder="Buscar por nombre, CIU o cédula..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                />
              </div>
              <Button
                onClick={handleNuevo}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
              >
                <Plus size={14} className="mr-2" />
                Nuevo Comerciante
              </Button>
            </div>

            {/* Tabla de comerciantes */}
            <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
              <div className="px-5 py-3 border-b border-institucional-whiteSmokeBlack/15">
                <p className="text-xs font-medium text-institucional-whiteSmokeBlack">
                  {comerciantesFiltrados.length} de {comerciantes.length} comerciantes
                </p>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-institucional-green/10">
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CIU
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CÉDULA
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CONTRIBUYENTE
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        ACTIVIDAD
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        NAVE
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        PUESTO
                      </th>
                      <th className="sticky top-0 bg-institucional-green/10 px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-10">
                        ACCIONES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comerciantesFiltrados.map((com) => {
                      const isDisabled = !!com.deshabilitadoPor;
                      // Buscar nave y puesto (solo visual)
                      let naveNombre = "—";
                      let puestoCodigo = "—";
                      for (const n of naves) {
                        const p = n.puestos.find(p => p.comercianteId === com.idInterno);
                        if (p) {
                          naveNombre = n.nombre;
                          puestoCodigo = p.codigo;
                          break;
                        }
                      }
                      
                      return (
                      <tr
                        key={com.idInterno}
                        className={`border-t border-institucional-whiteSmokeBlack/10 transition-colors ${
                          isDisabled ? "opacity-50 bg-institucional-whiteSmoke/30" : "hover:bg-institucional-whiteSmoke/50"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-acento-azul1 font-medium">
                          {com.ciu}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack">
                          {com.cedula}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-base-eerieBlack flex flex-col gap-1">
                          <span>{com.contribuyente}</span>
                          {isDisabled && (
                            <span className="inline-flex max-w-fit rounded-full bg-base-red/10 px-2 py-0.5 text-[10px] font-medium text-base-red" title={`Deshabilitado por: ${com.deshabilitadoPor}`}>
                              Deshabilitado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack">
                          {com.actividad}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack">
                          {naveNombre}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack font-mono">
                          {puestoCodigo}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!isDisabled && (
                              <button
                                type="button"
                                onClick={() => handleEditar(com)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (isDisabled) {
                                  editarComerciante(com.idInterno, { deshabilitadoPor: undefined });
                                  toast.success("Habilitado");
                                  setRefreshKey(k => k + 1);
                                } else {
                                  handleEliminar(com);
                                }
                              }}
                              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                isDisabled ? "text-acento-verdeOliva1 hover:bg-acento-verdeOliva1/10" : "text-base-red hover:bg-base-red/10"
                              }`}
                              title={isDisabled ? "Habilitar" : "Deshabilitar"}
                            >
                              {isDisabled ? <CheckCircle2 size={13} /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})}
                    {comerciantesFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-institucional-whiteSmokeBlack"
                        >
                          No se encontraron comerciantes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
      </div>

      {/* Modales */}
      <ComercianteFormDialog
        key={editingComerciante?.idInterno ?? "new"}
        open={formOpen}
        comerciante={editingComerciante}
        onClose={() => {
          setFormOpen(false);
          setEditingComerciante(null);
        }}
        onSave={() => setRefreshKey((k) => k + 1)}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        comerciante={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
