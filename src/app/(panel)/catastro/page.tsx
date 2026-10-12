"use client";

import { useCallback, useEffect, useState } from "react";
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
  getNaves,
} from "@/infrastructure/mocks/mercado.mock";
import { comercianteService } from "@/application/services/comerciante.service";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Buscar nave y puesto asignados si se está editando
  let initialNaveId = naves[0]?.id ?? "";
  let initialPuesto = comerciante?.puestoId ?? "";
  if (comerciante) {
    for (const n of naves) {
      const p = n.puestos.find(
        (p) =>
          p.comercianteId === comerciante.idInterno ||
          p.id === comerciante.puestoId ||
          p.codigo === comerciante.puestoId
      );
      if (p) {
        initialNaveId = n.id;
        initialPuesto = p.codigo || p.id;
        break;
      }
    }
  }

  const [ciu, setCiu] = useState(comerciante?.ciu ?? "");
  const [cedula, setCedula] = useState(comerciante?.cedula ?? "");
  const [contribuyente, setContribuyente] = useState(comerciante?.contribuyente ?? "");
  const [actividad, setActividad] = useState(comerciante?.actividad ?? "");
  const [naveId, setNaveId] = useState(initialNaveId);
  const [puesto, setPuesto] = useState(initialPuesto);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    if (!ciu.trim() || !contribuyente.trim() || !actividad.trim()) {
      setError("CIU, Contribuyente y Actividad son obligatorios.");
      return;
    }

    if (isEdit && comerciante) {
      await comercianteService.actualizarComerciante(comerciante.idInterno, {
        ciu: ciu.trim(),
        contribuyente: contribuyente.trim(),
        actividad: actividad.trim(),
        ...(puesto.trim() && { puestoId: puesto.trim(), naveId }),
      });
      if (cedula.trim()) {
        comerciante.cedula = cedula.trim();
      }
      toast.success("Comerciante actualizado", {
        description: `${contribuyente} editado correctamente.`,
      });
    } else {
      if (!naveId || !puesto.trim()) {
        setError("Debe seleccionar Nave e ingresar un Puesto.");
        return;
      }
      const nuevo = await comercianteService.crearComerciante({
        ciu: ciu.trim(),
        contribuyente: contribuyente.trim(),
        actividad: actividad.trim(),
        puestoId: puesto.trim(),
        cedula: cedula.trim() || "1800000000",
        estadoRegistro: "Habilitado",
      });
      toast.success("Comerciante creado", {
        description: `${contribuyente} agregado correctamente.`,
      });
    }

    onSave();
    onClose();
  }

  return (
    <Dialog
      open={open}
      disablePointerDismissal={true}
      onOpenChange={(o) => !o && onClose()}
    >
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

        <div className="py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="cedula">Cédula</Label>
              <Input
                id="cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="1801234567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contribuyente">Contribuyente</Label>
              <Input
                id="contribuyente"
                value={contribuyente}
                onChange={(e) => setContribuyente(e.target.value)}
                placeholder="Nombres y Apellidos"
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

            {/* Nave / Puesto */}
            <div className="space-y-1.5">
              <Label htmlFor="nave">Nave</Label>
              <Select value={naveId} onValueChange={(val) => setNaveId(val as string)}>
                <SelectTrigger id="nave" className="w-full h-9">
                  <SelectValue placeholder="Seleccionar nave..." />
                </SelectTrigger>
                <SelectContent>
                  {naves.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="puesto">Puesto</Label>
              <Input
                id="puesto"
                type="text"
                value={puesto}
                onChange={(e) => setPuesto(e.target.value)}
                placeholder="Ej. P-A002, P1, 1P"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-base-red font-medium flex items-center gap-1">
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
    <Dialog
      open={open}
      disablePointerDismissal={true}
      onOpenChange={(o) => !o && onClose()}
    >
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
  const [comerciantes, setComerciantes] = useState<Comerciante[]>([]);

  const naves = getNaves();

  useEffect(() => {
    comercianteService.obtenerComerciantes().then((datos) => {
      setComerciantes(datos);
    });
  }, [refreshKey]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    
    // Soft Delete: en lugar de eliminar, deshabilitamos
    await comercianteService.actualizarComerciante(deleteTarget.idInterno, {
      deshabilitadoPor: user ? `${user.nombres} ${user.apellidos}` : "Sistema"
    });
    
    toast.success("Comerciante deshabilitado", {
      description: `${deleteTarget.contribuyente} ha sido deshabilitado.`,
    });
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col min-h-[100dvh] md:h-[100dvh] bg-institucional-whiteSmoke px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-4 shrink-0 w-full max-w-none px-4">
        <div className="flex items-center gap-2">
          <Monitor size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Catastro — Gestión de Comerciantes
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 w-full max-w-none px-4 space-y-4">
        {/* Barra de herramientas */}
        <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
            />
            <input
              type="text"
              placeholder="Buscar por nombre, CIU o cédula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
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
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
          <div className="flex-1 overflow-y-auto lg:h-[calc(100dvh-240px)] p-3 md:p-0">
            <table className="w-full text-sm block md:table">
                  <thead className="hidden md:table-header-group sticky top-0 z-10 bg-[#e6efe9]">
                    <tr className="bg-[#e6efe9]">
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CIU
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CÉDULA
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        CONTRIBUYENTE
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        ACTIVIDAD
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        NAVE
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack z-10">
                        PUESTO
                      </th>
                      <th className="sticky top-0 bg-[#e6efe9] px-4 py-2.5 text-center font-semibold text-base-eerieBlack z-10">
                        ACCIONES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group space-y-3 md:space-y-0">
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
                        className={`flex flex-col md:table-row rounded-xl md:rounded-none border border-institucional-whiteSmokeBlack/20 md:border-0 md:border-t md:border-institucional-whiteSmokeBlack/10 p-3.5 md:p-0 bg-base-white mb-3 md:mb-0 shadow-sm md:shadow-none transition-colors ${
                          isDisabled ? "opacity-60 bg-institucional-whiteSmoke/30" : "hover:bg-institucional-whiteSmoke/50"
                        }`}
                      >
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 font-mono text-acento-azul1 font-medium text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">CIU:</span>
                          <span>{com.ciu}</span>
                        </td>
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Cédula:</span>
                          <span>{com.cedula}</span>
                        </td>
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 font-semibold text-base-eerieBlack text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Contribuyente:</span>
                          <div className="flex flex-col items-end md:items-start gap-1">
                            <span>{com.contribuyente}</span>
                            {isDisabled && (
                              <span className="inline-flex max-w-fit rounded-full bg-base-red/10 px-2 py-0.5 text-xs font-medium text-base-red" title={`Deshabilitado por: ${com.deshabilitadoPor}`}>
                                Deshabilitado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Actividad:</span>
                          <span>{com.actividad}</span>
                        </td>
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Nave:</span>
                          <span>{naveNombre}</span>
                        </td>
                        <td className="flex justify-between items-center py-1.5 md:px-4 md:py-2.5 text-gray-900 font-mono text-sm md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Puesto:</span>
                          <span>{puestoCodigo}</span>
                        </td>
                        <td className="flex justify-between items-center pt-2.5 mt-1 border-t border-institucional-whiteSmokeBlack/10 md:border-t-0 md:pt-0 md:px-4 md:py-2.5 text-center md:table-cell">
                          <span className="font-semibold text-gray-700 md:hidden">Acciones:</span>
                          <div className="flex items-center justify-end md:justify-center gap-1">
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
                                  comercianteService.actualizarComerciante(com.idInterno, { deshabilitadoPor: undefined }).then(() => {
                                    toast.success("Habilitado");
                                    setRefreshKey(k => k + 1);
                                  });
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
                      <tr className="block md:table-row">
                        <td
                          colSpan={7}
                          className="block md:table-cell px-4 py-10 text-center text-sm text-gray-700"
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
