"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Scale,
  ArrowUpLeft,
  RefreshCw,
  Download,
  AlertCircle,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/infrastructure/auth/auth-context";
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
import {
  generarCertificacionVacantesPDF,
  type ItemReporteVacante,
} from "./reporte-vacantes-pdf.utils";

interface ModalReporteVacantesProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModalReporteVacantes({ isOpen, onClose }: ModalReporteVacantesProps) {
  const { user } = useAuth();

  const [items, setItems] = useState<ItemReporteVacante[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tituloPeriodo, setTituloPeriodo] = useState("");
  const [elaboradoPorNombre, setElaboradoPorNombre] = useState("");
  const [elaboradoPorCargo, setElaboradoPorCargo] = useState(
    "SUPERVISOR DE OPERACIONES CONTROL Y ORDEN EP-EMA"
  );
  const [revisadoPorNombre, setRevisadoPorNombre] = useState("");
  const [revisadoPorCargo, setRevisadoPorCargo] = useState(
    "DIRECTOR COMERCIAL OPERACIONES Y COMUNICACIÓN SOCIAL EP-EMA"
  );
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Inicializar título por defecto con el mes y año actual en mayúsculas
  const calcularTituloDefecto = useCallback(() => {
    const fecha = new Date();
    const nombreMes = fecha.toLocaleString("es-ES", { month: "long" }).toUpperCase();
    const anio = fecha.getFullYear();
    return `ESPACIOS PÚBLICOS VACANTES ${nombreMes} ${anio}`;
  }, []);

  // Limpieza y cierre del modal
  const handleCloseModal = useCallback(() => {
    setBusqueda("");
    setItems([]);
    onClose();
  }, [onClose]);

  // Carga reactiva de datos al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    let activo = true;
    naveService
      .obtenerReporteVacantes()
      .then((data) => {
        if (!activo) return;
        setItems(data.items || []);
        setTituloPeriodo(calcularTituloDefecto());

        if (user && user.rol === "JEFE_OPERATIVO") {
          const nombreSesion = `${user.nombres} ${user.apellidos}`.replace(/\s+/g, " ").trim().toUpperCase();
          setElaboradoPorNombre(nombreSesion);
        } else if (data.firmantes?.elaboradoPorNombre) {
          setElaboradoPorNombre(data.firmantes.elaboradoPorNombre);
        }

        if (data.firmantes?.elaboradoPorCargo) {
          setElaboradoPorCargo(data.firmantes.elaboradoPorCargo);
        }

        if (data.firmantes?.revisadoPorNombre) {
          setRevisadoPorNombre(data.firmantes.revisadoPorNombre);
        }

        if (data.firmantes?.revisadoPorCargo) {
          setRevisadoPorCargo(data.firmantes.revisadoPorCargo);
        }
        setCargando(false);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        const msg = err instanceof Error ? err.message : "Error al cargar datos del reporte";
        toast.error(msg);
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [isOpen, calcularTituloDefecto, user]);

  // Recarga manual al presionar el botón Actualizar
  const handleRecargarDatos = async () => {
    setCargando(true);
    try {
      const data = await naveService.obtenerReporteVacantes();
      setItems(data.items || []);
      setTituloPeriodo(calcularTituloDefecto());

      if (user && user.rol === "JEFE_OPERATIVO") {
        const nombreSesion = `${user.nombres} ${user.apellidos}`.replace(/\s+/g, " ").trim().toUpperCase();
        setElaboradoPorNombre(nombreSesion);
      } else if (data.firmantes?.elaboradoPorNombre) {
        setElaboradoPorNombre(data.firmantes.elaboradoPorNombre);
      }

      if (data.firmantes?.elaboradoPorCargo) {
        setElaboradoPorCargo(data.firmantes.elaboradoPorCargo);
      }

      if (data.firmantes?.revisadoPorNombre) {
        setRevisadoPorNombre(data.firmantes.revisadoPorNombre);
      }

      if (data.firmantes?.revisadoPorCargo) {
        setRevisadoPorCargo(data.firmantes.revisadoPorCargo);
      }
      toast.success("Datos del reporte actualizados.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar datos";
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  // Actualización reactiva de campos editables de una fila
  const handleActualizarFila = (
    id: string,
    campo: keyof ItemReporteVacante,
    valor: string | boolean
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  // Mover fila entre vacantes normales y en proceso judicial
  const handleToggleJudicial = (id: string, enProcesoJudicial: boolean) => {
    handleActualizarFila(id, "enProcesoJudicial", enProcesoJudicial);
    toast.success(
      enProcesoJudicial
        ? "Puesto trasladado a Proceso Judicial"
        : "Puesto restituido a Vacantes Normales"
    );
  };

  // Excluir fila del reporte
  const handleEliminarFila = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.info("Puesto excluido de la certificación.");
  };

  // Agregar fila manual
  const handleAgregarFilaManual = () => {
    const nuevaFila: ItemReporteVacante = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      naveId: "",
      ubicacionNave: "",
      giroNegocio: "",
      espacioComercializacion: "PUESTO",
      numeroEspacioComercial: "",
      areaM2: "6",
      enProcesoJudicial: false,
    };
    setItems((prev) => [nuevaFila, ...prev]);
    toast.info("Se ha añadido una nueva fila al reporte para edición manual.");
  };

  // Filtrado reactivo para la búsqueda
  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.ubicacionNave.toLowerCase().includes(q) ||
        item.giroNegocio.toLowerCase().includes(q) ||
        item.numeroEspacioComercial.toLowerCase().includes(q) ||
        item.espacioComercializacion.toLowerCase().includes(q)
    );
  }, [items, busqueda]);

  const itemsNormales = useMemo(
    () => itemsFiltrados.filter((it) => !it.enProcesoJudicial),
    [itemsFiltrados]
  );

  const itemsJudiciales = useMemo(
    () => itemsFiltrados.filter((it) => it.enProcesoJudicial),
    [itemsFiltrados]
  );

  // Conteo total independientemente del filtro de búsqueda
  const totalNormales = useMemo(() => items.filter((it) => !it.enProcesoJudicial).length, [items]);
  const totalJudiciales = useMemo(() => items.filter((it) => it.enProcesoJudicial).length, [items]);

  // Generador del PDF
  const handleDescargarPDF = async () => {
    const normalesExport = items
      .filter((it) => !it.enProcesoJudicial)
      .map((it) => ({
        ...it,
        ubicacionNave: it.ubicacionNave.trim().toUpperCase(),
        giroNegocio: it.giroNegocio.trim().toUpperCase(),
        espacioComercializacion: it.espacioComercializacion.trim().toUpperCase(),
        numeroEspacioComercial: it.numeroEspacioComercial.trim().toUpperCase(),
        areaM2: it.areaM2.trim(),
      }));

    const judicialesExport = items
      .filter((it) => it.enProcesoJudicial)
      .map((it) => ({
        ...it,
        ubicacionNave: it.ubicacionNave.trim().toUpperCase(),
        giroNegocio: it.giroNegocio.trim().toUpperCase(),
        espacioComercializacion: it.espacioComercializacion.trim().toUpperCase(),
        numeroEspacioComercial: it.numeroEspacioComercial.trim().toUpperCase(),
        areaM2: it.areaM2.trim(),
      }));

    if (normalesExport.length === 0 && judicialesExport.length === 0) {
      toast.error("No existen puestos vacantes para incluir en la certificación.");
      return;
    }

    setGenerandoPdf(true);
    try {
      await generarCertificacionVacantesPDF({
        itemsNormales: normalesExport,
        itemsJudiciales: judicialesExport,
        tituloPeriodo: tituloPeriodo.trim() || calcularTituloDefecto(),
        elaboradoPorNombre: elaboradoPorNombre.trim().toUpperCase(),
        elaboradoPorCargo: elaboradoPorCargo.trim(),
        revisadoPorNombre: revisadoPorNombre.trim().toUpperCase(),
        revisadoPorCargo: revisadoPorCargo.trim(),
      });
      toast.success("Certificación de Espacios Vacantes generada exitosamente.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al generar el archivo PDF";
      toast.error(msg);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseModal()}>
      <DialogContent className="sm:max-w-6xl max-w-[96vw] w-full bg-base-white p-4 sm:p-6 rounded-2xl max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal */}
        <DialogHeader className="shrink-0 border-b border-institucional-whiteSmokeBlack/20 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-base-eerieBlack">
                <FileText className="text-institucional-green shrink-0" size={24} />
                Certificación de Espacios Públicos Vacantes
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-institucional-green/10 text-institucional-green border border-institucional-green/20">
                  {tituloPeriodo || calcularTituloDefecto()}
                </span>
                <span>
                  • Configure los firmantes autorizados y verifique los puestos antes de expedir el PDF oficial.
                </span>
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecargarDatos}
              disabled={cargando}
              className="text-xs h-8 self-start sm:self-auto gap-1.5"
            >
              <RefreshCw size={13} className={cargando ? "animate-spin" : ""} />
              Actualizar Datos
            </Button>
          </div>
        </DialogHeader>

        {/* Panel Superior: Parámetros de Firmantes Autorizados */}
        <div className="shrink-0 pt-3 pb-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-institucional-whiteSmoke/50 p-3 rounded-xl border border-institucional-whiteSmokeBlack/20">
            {/* Elaborado Por */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                Elaborado Por (Jefe Operativo)
              </label>
              <Input
                value={elaboradoPorNombre}
                onChange={(e) => setElaboradoPorNombre(e.target.value)}
                placeholder="Ing. Nombre Apellido, Mg."
                className="h-8 text-xs font-semibold bg-base-white border-institucional-whiteSmokeBlack/40"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block truncate" title={elaboradoPorCargo}>
                {elaboradoPorCargo}
              </span>
            </div>

            {/* Revisado Por */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                Revisado Por (Director Comercial)
              </label>
              <Input
                value={revisadoPorNombre}
                onChange={(e) => setRevisadoPorNombre(e.target.value)}
                placeholder="Director Comercial..."
                className="h-8 text-xs font-semibold bg-base-white border-institucional-whiteSmokeBlack/40"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block truncate" title={revisadoPorCargo}>
                {revisadoPorCargo}
              </span>
            </div>
          </div>

          {/* Barra de Búsqueda y Botón de Fila Manual */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                type="text"
                placeholder="Filtrar por nave, giro de negocio o número de puesto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-8.5 w-full pl-9 text-xs bg-base-white border-institucional-whiteSmokeBlack/30"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAgregarFilaManual}
              className="border-institucional-green text-institucional-green hover:bg-institucional-green/10 h-8.5 text-xs font-semibold shrink-0 gap-1.5"
            >
              <Plus size={14} />
              Agregar Fila Manual
            </Button>
          </div>
        </div>

        {/* Área desplazable: Tablas de Puestos */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 mt-1">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 rounded-full border-3 border-institucional-green/30 border-t-institucional-green animate-spin" />
              <p className="text-xs text-gray-500 font-medium">
                Consultando espacios vacantes y resolviendo giros de negocio...
              </p>
            </div>
          ) : (
            <>
              {/* Tabla 1: Espacios Públicos Vacantes (Lista Principal) */}
              <div className="rounded-xl border border-institucional-whiteSmokeBlack/25 overflow-hidden shadow-xs bg-base-white">
                <div className="px-4 py-2.5 bg-[#eef5f0] border-b border-institucional-whiteSmokeBlack/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="text-institucional-green" size={16} />
                    <span className="text-xs font-bold text-base-eerieBlack uppercase tracking-wide">
                      Espacios Públicos Vacantes (Lista Principal)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-institucional-green/15 text-institucional-green">
                    {itemsNormales.length} registros
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-gray-100/80 text-gray-700 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-2 text-center w-10">#</th>
                        <th className="py-2 px-3 text-center w-28">UBICACIÓN - NAVE</th>
                        <th className="py-2 px-3 text-left">SECCIÓN - GIRO DE NEGOCIO</th>
                        <th className="py-2 px-3 text-center w-44">ESPACIOS DE COMERCIALIZACIÓN</th>
                        <th className="py-2 px-3 text-center w-32">NÚMERO ESPACIO</th>
                        <th className="py-2 px-2 text-center w-20">ÁREA M2</th>
                        <th className="py-2 px-3 text-center w-28">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itemsNormales.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400 text-xs">
                            {busqueda
                              ? "No hay puestos vacantes normales que coincidan con la búsqueda."
                              : "No se encontraron puestos vacantes registrados."}
                          </td>
                        </tr>
                      ) : (
                        itemsNormales.map((item, index) => (
                          <tr
                            key={item.id}
                            className="hover:bg-institucional-whiteSmoke/40 transition-colors"
                          >
                            {/* # */}
                            <td className="py-1.5 px-2 text-center font-bold text-gray-600">
                              {index + 1}
                            </td>

                            {/* Ubicación - Nave */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.ubicacionNave}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "ubicacionNave",
                                    e.target.value
                                  )
                                }
                                placeholder="G, B, C..."
                                className="h-7 text-xs text-center font-bold uppercase"
                              />
                            </td>

                            {/* Giro de Negocio */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.giroNegocio}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "giroNegocio",
                                    e.target.value
                                  )
                                }
                                placeholder="GIRO DE NEGOCIO..."
                                className="h-7 text-xs font-medium uppercase"
                              />
                            </td>

                            {/* Espacios de Comercialización */}
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={item.espacioComercializacion}
                                  onChange={(e) =>
                                    handleActualizarFila(
                                      item.id,
                                      "espacioComercializacion",
                                      e.target.value
                                    )
                                  }
                                  placeholder="PUESTO..."
                                  className="h-7 text-xs text-center font-semibold uppercase flex-1"
                                />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleActualizarFila(item.id, "espacioComercializacion", e.target.value);
                                    }
                                  }}
                                  className="h-7 w-4 px-0 text-gray-500 bg-transparent border-0 cursor-pointer text-xs"
                                  title="Opciones rápidas de tipo de espacio"
                                >
                                  <option value="" disabled>▾</option>
                                  <option value="PUESTO">PUESTO</option>
                                  <option value="BODEGA">BODEGA</option>
                                  <option value="CUBÍCULO">CUBÍCULO</option>
                                  <option value="NÚCLEO">NÚCLEO</option>
                                  <option value="LOCAL">LOCAL</option>
                                  <option value="COCINA">COCINA</option>
                                  <option value="ESPACIO">ESPACIO</option>
                                </select>
                              </div>
                            </td>

                            {/* Número de Espacio */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.numeroEspacioComercial}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "numeroEspacioComercial",
                                    e.target.value
                                  )
                                }
                                placeholder="001, N-G-004A..."
                                className="h-7 text-xs text-center font-mono font-semibold"
                              />
                            </td>

                            {/* Área M2 */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.areaM2}
                                onChange={(e) =>
                                  handleActualizarFila(item.id, "areaM2", e.target.value)
                                }
                                placeholder="6"
                                className="h-7 text-xs text-center font-mono font-medium"
                              />
                            </td>

                            {/* Acciones */}
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleJudicial(item.id, true)}
                                  className="h-7 px-2 text-[11px] text-amber-700 border-amber-300 hover:bg-amber-50 gap-1"
                                  title="Pasar a Proceso Judicial Contencioso Administrativo"
                                >
                                  <Scale size={12} />
                                  <span className="hidden sm:inline">A Judicial</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEliminarFila(item.id)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Quitar del reporte"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla 2: Apartado "EN PROCESO JUDICIAL CONTENCIOSO ADMINISTRATIVO" */}
              <div className="rounded-xl border border-amber-200 overflow-hidden shadow-xs bg-base-white">
                <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="text-amber-700" size={16} />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      En Proceso Judicial Contencioso Administrativo
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                    {itemsJudiciales.length} registros
                  </span>
                </div>

                {itemsJudiciales.length === 0 ? (
                  <div className="p-4 bg-amber-50/30 flex items-center gap-2.5 text-xs text-amber-800">
                    <AlertCircle size={15} className="shrink-0 text-amber-600" />
                    <span>
                      No hay puestos asignados a Proceso Judicial Contencioso Administrativo. (Este apartado no se mostrará en el PDF a menos que traslade algún puesto aquí mediante el botón &quot;A Judicial&quot;).
                    </span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[760px]">
                      <thead className="bg-amber-100/60 text-amber-950 font-semibold border-b border-amber-200">
                        <tr>
                          <th className="py-2 px-2 text-center w-10">#</th>
                          <th className="py-2 px-3 text-center w-28">UBICACIÓN - NAVE</th>
                          <th className="py-2 px-3 text-left">SECCIÓN - GIRO DE NEGOCIO</th>
                          <th className="py-2 px-3 text-center w-44">ESPACIOS DE COMERCIALIZACIÓN</th>
                          <th className="py-2 px-3 text-center w-32">NÚMERO ESPACIO</th>
                          <th className="py-2 px-2 text-center w-20">ÁREA M2</th>
                          <th className="py-2 px-3 text-center w-28">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {itemsJudiciales.map((item, index) => (
                          <tr
                            key={item.id}
                            className="hover:bg-amber-50/40 transition-colors"
                          >
                            {/* # (Continuando la numeración secuencial tras los normales) */}
                            <td className="py-1.5 px-2 text-center font-bold text-amber-900">
                              {itemsNormales.length + index + 1}
                            </td>

                            {/* Ubicación - Nave */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.ubicacionNave}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "ubicacionNave",
                                    e.target.value
                                  )
                                }
                                placeholder="G, B, C..."
                                className="h-7 text-xs text-center font-bold uppercase border-amber-200"
                              />
                            </td>

                            {/* Giro de Negocio */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.giroNegocio}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "giroNegocio",
                                    e.target.value
                                  )
                                }
                                placeholder="GIRO DE NEGOCIO..."
                                className="h-7 text-xs font-medium uppercase border-amber-200"
                              />
                            </td>

                            {/* Espacios de Comercialización */}
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={item.espacioComercializacion}
                                  onChange={(e) =>
                                    handleActualizarFila(
                                      item.id,
                                      "espacioComercializacion",
                                      e.target.value
                                    )
                                  }
                                  placeholder="PUESTO..."
                                  className="h-7 text-xs text-center font-semibold uppercase border-amber-200 flex-1"
                                />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleActualizarFila(item.id, "espacioComercializacion", e.target.value);
                                    }
                                  }}
                                  className="h-7 w-4 px-0 text-gray-500 bg-transparent border-0 cursor-pointer text-xs"
                                  title="Opciones rápidas de tipo de espacio"
                                >
                                  <option value="" disabled>▾</option>
                                  <option value="PUESTO">PUESTO</option>
                                  <option value="BODEGA">BODEGA</option>
                                  <option value="CUBÍCULO">CUBÍCULO</option>
                                  <option value="NÚCLEO">NÚCLEO</option>
                                  <option value="LOCAL">LOCAL</option>
                                  <option value="COCINA">COCINA</option>
                                  <option value="ESPACIO">ESPACIO</option>
                                </select>
                              </div>
                            </td>

                            {/* Número de Espacio */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.numeroEspacioComercial}
                                onChange={(e) =>
                                  handleActualizarFila(
                                    item.id,
                                    "numeroEspacioComercial",
                                    e.target.value
                                  )
                                }
                                placeholder="001, N-G-004A..."
                                className="h-7 text-xs text-center font-mono font-semibold border-amber-200"
                              />
                            </td>

                            {/* Área M2 */}
                            <td className="py-1.5 px-2">
                              <Input
                                value={item.areaM2}
                                onChange={(e) =>
                                  handleActualizarFila(item.id, "areaM2", e.target.value)
                                }
                                placeholder="6"
                                className="h-7 text-xs text-center font-mono font-medium border-amber-200"
                              />
                            </td>

                            {/* Acciones */}
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleJudicial(item.id, false)}
                                  className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                                  title="Devolver a Vacantes Normales"
                                >
                                  <ArrowUpLeft size={12} />
                                  <span className="hidden sm:inline">A Normal</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEliminarFila(item.id)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Quitar del reporte"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Pie del Modal */}
        <DialogFooter className="shrink-0 border-t border-institucional-whiteSmokeBlack/20 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 font-medium">
            <span className="font-bold text-base-eerieBlack">{totalNormales}</span> vacantes normales |{" "}
            <span className="font-bold text-amber-700">{totalJudiciales}</span> en proceso judicial (
            {items.length} total)
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseModal}
              disabled={generandoPdf}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDescargarPDF}
              disabled={generandoPdf || cargando || items.length === 0}
              className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 h-9 px-4 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {generandoPdf ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Generar y Descargar PDF
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
