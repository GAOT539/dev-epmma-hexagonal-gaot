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
import {
  generarRegistrosEjemplo,
  simularImportacion,
  parsearXML,
  parsearCSV,
  XML_EJEMPLO,
  CSV_EJEMPLO,
} from "@/infrastructure/mocks/importador.mock";
import {
  getComerciantes,
  getNaves,
  getSectoresPorNave,
  getPuestosVacantesPorSector,
  agregarComerciante,
  editarComerciante,
  eliminarComerciante,
} from "@/infrastructure/mocks/mercado.mock";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  Comerciante,
} from "@/domain/models/comerciante.model";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [nombres, setNombres] = useState(comerciante?.nombres ?? "");
  const [apellidos, setApellidos] = useState(comerciante?.apellidos ?? "");
  const [actividad, setActividad] = useState(comerciante?.actividad ?? "");
  const [naveId, setNaveId] = useState(naves[0]?.id ?? "");
  const [sectorId, setSectorId] = useState("");
  const [puestoId, setPuestoId] = useState("");
  const [error, setError] = useState("");

  const sectores = getSectoresPorNave(naveId);
  const puestosVacantes = sectorId ? getPuestosVacantesPorSector(sectorId) : [];

  function handleNaveChange(id: string) {
    setNaveId(id);
    setSectorId("");
    setPuestoId("");
  }

  function handleSectorChange(id: string) {
    setSectorId(id);
    setPuestoId("");
  }

  function handleSubmit() {
    setError("");

    if (!ciu.trim() || !nombres.trim() || !actividad.trim()) {
      setError("CIU, Nombres y Actividad son obligatorios.");
      return;
    }

    if (isEdit && comerciante) {
      editarComerciante(comerciante.idInterno, {
        ciu: ciu.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        actividad: actividad.trim(),
        ...(puestoId && { puestoId, naveId, sectorId }),
      });
      toast.success("Comerciante actualizado", {
        description: `${nombres} ${apellidos} editado correctamente.`,
      });
    } else {
      if (!naveId || !sectorId || !puestoId) {
        setError("Debe seleccionar Nave, Sector y Puesto para un nuevo comerciante.");
        return;
      }
      agregarComerciante({
        ciu: ciu.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        actividad: actividad.trim(),
        naveId,
        sectorId,
        puestoId,
      });
      toast.success("Comerciante creado", {
        description: `${nombres} ${apellidos} agregado correctamente.`,
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombres">Nombres</Label>
              <Input
                id="nombres"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan Carlos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Pérez López"
              />
            </div>
          </div>

          {/* Nave / Sector / Puesto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nave">Nave</Label>
              <select
                id="nave"
                value={naveId}
                onChange={(e) => handleNaveChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                {naves.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">Sector</Label>
              <select
                id="sector"
                value={sectorId}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="">Seleccionar...</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
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
              {comerciante?.nombres} {comerciante?.apellidos}
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
  const [registros, setRegistros] = useState<ImportacionRegistro[]>([]);
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");

  // CRUD state
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingComerciante, setEditingComerciante] = useState<Comerciante | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comerciante | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const comerciantes = getComerciantes();

  // Filtrar comerciantes
  const comerciantesFiltrados = searchQuery.trim()
    ? comerciantes.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.nombres.toLowerCase().includes(q) ||
          c.apellidos.toLowerCase().includes(q) ||
          c.ciu.toLowerCase().includes(q) ||
          c.cedula.includes(q)
        );
      })
    : comerciantes;

  // Simular lectura de archivo
  function handleFileInput(contenido: string, nombre: string) {
    setArchivoNombre(nombre);

    let parsed: ImportacionRegistro[];
    if (nombre.endsWith(".xml")) {
      parsed = parsearXML(contenido);
    } else if (nombre.endsWith(".csv")) {
      parsed = parsearCSV(contenido);
    } else {
      toast.error("Formato no soportado", {
        description: "Solo se aceptan archivos XML o CSV.",
      });
      return;
    }

    if (parsed.length === 0) {
      toast.error("Archivo vacío", {
        description: "No se encontraron registros en el archivo.",
      });
      return;
    }

    setRegistros(parsed);
    setPaso("preview");
    toast.success(`${parsed.length} registros cargados`, {
      description: `Archivo: ${nombre}`,
    });
  }

  // Simular drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleFileInput(text, file.name);
    };
    reader.readAsText(file);
  }

  // Cargar datos de ejemplo
  function handleCargarEjemploXML() {
    handleFileInput(XML_EJEMPLO, "ejemplo_catastro.xml");
  }

  function handleCargarEjemploCSV() {
    handleFileInput(CSV_EJEMPLO, "ejemplo_catastro.csv");
  }

  // Procesar importación
  function handleProcesar() {
    const res = simularImportacion(registros);
    setResultado(res);
    setPaso("resultado");

    if (res.errores.length === 0) {
      toast.success("Importación completada sin errores", {
        description: `${res.exitosos} registros procesados exitosamente.`,
      });
    } else {
      toast.warning("Importación con errores", {
        description: `${res.exitosos} exitosos, ${res.errores.length} errores.`,
      });
    }
  }

  // Reiniciar
  function handleReiniciar() {
    setRegistros([]);
    setResultado(null);
    setArchivoNombre("");
    setPaso("cargar");
  }

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
    eliminarComerciante(deleteTarget.idInterno);
    toast.success("Comerciante eliminado", {
      description: `${deleteTarget.nombres} ${deleteTarget.apellidos} eliminado correctamente.`,
    });
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Monitor size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Catastro — Gestión de Comerciantes
          </h1>
        </div>
        <p className="mt-2 text-sm text-institucional-whiteSmokeBlack">
          Importa datos desde archivos XML/CSV o gestiona comerciantes manualmente.
        </p>
      </header>

      <div className="mx-auto max-w-4xl">
        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Users size={14} />
              Ingreso Manual
            </TabsTrigger>
            <TabsTrigger value="masiva" className="flex items-center gap-2">
              <Upload size={14} />
              Carga Masiva
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Ingreso Manual (CRUD) ── */}
          <TabsContent value="manual" className="space-y-4">
            {/* Barra de herramientas */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
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
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                        CIU
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                        Nombres
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                        Actividad
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                        Puesto
                      </th>
                      <th className="px-4 py-2.5 text-center font-semibold text-base-eerieBlack">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comerciantesFiltrados.slice(0, 50).map((com) => (
                      <tr
                        key={com.idInterno}
                        className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-acento-azul1 font-medium">
                          {com.ciu}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-base-eerieBlack">
                          {com.nombres} {com.apellidos}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack">
                          {com.actividad}
                        </td>
                        <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack font-mono">
                          {com.puestoId ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditar(com)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminar(com)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-base-red hover:bg-base-red/10 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
              {comerciantesFiltrados.length > 50 && (
                <div className="px-5 py-2 border-t border-institucional-whiteSmokeBlack/15 text-xs text-institucional-whiteSmokeBlack">
                  Mostrando los primeros 50 resultados. Refine su búsqueda.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Carga Masiva ── */}
          <TabsContent value="masiva" className="space-y-6">
            {/* ── Paso 1: Carga ── */}
            {paso === "cargar" && (
              <>
                {/* Zona de drag & drop */}
                <div
                  className={[
                    "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all",
                    isDragOver
                      ? "border-institucional-green bg-institucional-green/5 scale-[1.01]"
                      : "border-institucional-whiteSmokeBlack/30 bg-base-white hover:border-institucional-green/50",
                  ].join(" ")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload
                    size={40}
                    className={
                      isDragOver
                        ? "text-institucional-green"
                        : "text-institucional-whiteSmokeBlack/40"
                    }
                  />
                  <p className="mt-3 text-sm font-medium text-base-eerieBlack">
                    Arrastre un archivo XML o CSV aquí
                  </p>
                  <p className="mt-1 text-xs text-institucional-whiteSmokeBlack">
                    Formato: Nave, Contribuyente, NumBodega, Gen01Codi
                  </p>

                  {/* Input de archivo */}
                  <label className="mt-4 cursor-pointer">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                      <FileSpreadsheet size={14} />
                      Seleccionar archivo
                    </span>
                    <input
                      type="file"
                      accept=".xml,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          handleFileInput(ev.target?.result as string, file.name);
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>

                {/* Datos de ejemplo */}
                <div className="rounded-2xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
                  <h2 className="text-sm font-bold text-base-eerieBlack mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-institucional-green" />
                    Cargar Datos de Ejemplo
                  </h2>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCargarEjemploXML}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-acento-azul1/10 px-4 py-3 text-xs font-semibold text-acento-azul1 transition-colors hover:bg-acento-azul1/20"
                    >
                      <FileSpreadsheet size={16} />
                      Ejemplo XML (3 registros)
                    </button>
                    <button
                      type="button"
                      onClick={handleCargarEjemploCSV}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-acento-verdeOliva1/10 px-4 py-3 text-xs font-semibold text-acento-verdeOliva1 transition-colors hover:bg-acento-verdeOliva1/20"
                    >
                      <FileSpreadsheet size={16} />
                      Ejemplo CSV (5 registros)
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Paso 2: Preview ── */}
            {paso === "preview" && (
              <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
                <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-base-eerieBlack">
                      Vista Previa de Importación
                    </h2>
                    <p className="text-xs text-institucional-whiteSmokeBlack mt-0.5">
                      Archivo: {archivoNombre} · {registros.length} registros
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReiniciar}
                    className="flex items-center gap-1 text-xs font-medium text-base-red hover:underline"
                  >
                    <X size={14} />
                    Cancelar
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-institucional-green/10">
                        <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                          #
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                          Nave
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                          Contribuyente
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                          NumBodega
                        </th>
                        <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                          Gen01Codi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((reg, i) => (
                        <tr
                          key={i}
                          className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50"
                        >
                          <td className="px-4 py-2 text-institucional-whiteSmokeBlack font-medium">
                            {i + 1}
                          </td>
                          <td className="px-4 py-2 text-base-eerieBlack font-medium">
                            {reg.nave}
                          </td>
                          <td className="px-4 py-2 text-base-eerieBlack">
                            {reg.contribuyente}
                          </td>
                          <td className="px-4 py-2 text-base-eerieBlack">
                            {reg.numBodega}
                          </td>
                          <td className="px-4 py-2 text-base-eerieBlack">
                            {reg.gen01Codi}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-4 border-t border-institucional-whiteSmokeBlack/15 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleReiniciar}
                    className="h-9 rounded-lg px-5 text-xs font-semibold text-base-eerieBlack ring-1 ring-institucional-whiteSmokeBlack/30 transition-colors hover:bg-institucional-whiteSmoke"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleProcesar}
                    className="h-9 rounded-lg bg-institucional-green px-6 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1"
                  >
                    Procesar Importación
                  </button>
                </div>
              </div>
            )}

            {/* ── Paso 3: Resultado ── */}
            {paso === "resultado" && resultado && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-base-white p-5 shadow-sm ring-1 ring-acento-verdeOliva1/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-acento-verdeOliva1/10">
                        <CheckCircle2 size={20} className="text-acento-verdeOliva1" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-acento-verdeOliva1">
                          {resultado.exitosos}
                        </p>
                        <p className="text-xs text-institucional-whiteSmokeBlack">
                          Exitosos
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-base-white p-5 shadow-sm ring-1 ring-base-red/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-base-red/10">
                        <AlertCircle size={20} className="text-base-red" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-base-red">
                          {resultado.errores.length}
                        </p>
                        <p className="text-xs text-institucional-whiteSmokeBlack">
                          Errores
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {resultado.errores.length > 0 && (
                  <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-base-red/20 overflow-hidden">
                    <div className="px-5 py-3 border-b border-base-red/10 bg-base-red/5">
                      <h3 className="text-sm font-bold text-base-red flex items-center gap-2">
                        <AlertCircle size={16} />
                        Detalle de Errores
                      </h3>
                    </div>
                    <ul className="divide-y divide-institucional-whiteSmokeBlack/10">
                      {resultado.errores.map((err, i) => (
                        <li key={i} className="px-5 py-3 flex items-start gap-3">
                          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-base-red/10 text-[10px] font-bold text-base-red">
                            {err.fila}
                          </span>
                          <p className="text-xs text-base-eerieBlack">
                            {err.mensaje}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleReiniciar}
                    className="h-9 rounded-lg bg-institucional-green px-6 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1"
                  >
                    Nueva Importación
                  </button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
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
