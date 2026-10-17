"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  Eraser,
  Car,
  FileText,
  Save,
  MousePointerClick,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  Tag,
  Eye,
  Download,
  Bath,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type {
  Nave,
  PlanoEspacialNave,
  CeldaPlanoNave,
  TipoCeldaPlano,
} from "@/domain/models/nave.model";
import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";
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

// ── Funciones Auxiliares para el Planificador Espacial ─────────────────────────

function colIndexToLetter(index: number): string {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function getCoordenadasEtiqueta(
  fila: number,
  columna: number,
  rowSpan = 1,
  colSpan = 1
): string {
  const start = `${colIndexToLetter(columna)}${fila + 1}`;
  if (rowSpan <= 1 && colSpan <= 1) return start;
  const end = `${colIndexToLetter(columna + colSpan - 1)}${fila + rowSpan}`;
  return `${start}:${end}`;
}

interface CoincidenciaPuestoComerciante {
  comerciante: Comerciante | null;
  puesto: Puesto | null;
  esVacante: boolean;
}

function encontrarComercianteYPuesto(
  codigoPuesto: string | undefined,
  naveId: string,
  naveNombre: string,
  comerciantes: Comerciante[],
  puestos: Puesto[]
): CoincidenciaPuestoComerciante {
  if (!codigoPuesto) {
    return { comerciante: null, puesto: null, esVacante: true };
  }

  const codLimpio = codigoPuesto.trim().toUpperCase();
  const codNum = codLimpio
    .replace(/^P-/, "")
    .replace(/^[A-Z]-?/, "")
    .replace(/^0+/, "");

  // 1. Coincidencia en los puestos de la nave
  const puestoEncontrado =
    puestos.find((p) => {
      if (p.naveId !== naveId) return false;
      const pCod = p.codigo.trim().toUpperCase();
      const pId = p.id.trim().toUpperCase();
      if (pCod === codLimpio || pId === codLimpio) return true;
      const pNum = pCod
        .replace(/^P-/, "")
        .replace(/^[A-Z]-?/, "")
        .replace(/^0+/, "");
      return Boolean(pNum && codNum && pNum === codNum);
    }) ?? null;

  if (puestoEncontrado && puestoEncontrado.comercianteId) {
    const comerciante =
      comerciantes.find(
        (c) =>
          c.idInterno === puestoEncontrado.comercianteId &&
          c.estadoRegistro !== "Deshabilitado"
      ) ?? null;
    if (comerciante) {
      return { comerciante, puesto: puestoEncontrado, esVacante: false };
    }
  }

  // 2. Coincidencia directa por datos del comerciante
  const comercianteDirecto =
    comerciantes.find((c) => {
      if (c.estadoRegistro === "Deshabilitado") return false;
      const naveMatch =
        c.nave &&
        (c.nave.trim().toUpperCase() === naveNombre.trim().toUpperCase() ||
          c.nave.trim().toLowerCase() === naveId.toLowerCase());
      if (!naveMatch && puestoEncontrado?.id !== c.puestoId) return false;

      if (c.puestoId) {
        const cPuestoId = c.puestoId.trim().toUpperCase();
        if (cPuestoId === codLimpio) return true;
        const cNum = cPuestoId
          .replace(/^P-/, "")
          .replace(/^[A-Z]-?/, "")
          .replace(/^0+/, "");
        if (cNum && codNum && cNum === codNum) return true;
      }
      return false;
    }) ?? null;

  if (comercianteDirecto) {
    return {
      comerciante: comercianteDirecto,
      puesto: puestoEncontrado,
      esVacante: false,
    };
  }

  return { comerciante: null, puesto: puestoEncontrado, esVacante: true };
}

function getColorZonaClasses(
  colorZona: "amarillo" | "rosado" | "naranja" | "azul" | "verde" | "gris" | undefined,
  tipo: TipoCeldaPlano,
  esVacante: boolean
): string {
  if (tipo === "VACIO") {
    return "border-dashed border-gray-300/80 bg-white/70 hover:border-institucional-green/50 hover:bg-white text-gray-300";
  }
  if (tipo === "PARQUEADERO") {
    return "bg-rose-100/90 border-rose-300 text-rose-900";
  }
  if (tipo === "DELIMITACION") {
    return "bg-slate-200/90 border-slate-400 text-slate-900";
  }
  if (tipo === "ANOTACION") {
    return "bg-amber-50 border-amber-400 text-amber-950 border-l-4";
  }
  if (tipo === "BANO") {
    return "bg-cyan-100/90 border-cyan-400 text-cyan-950";
  }
  // Tipo PUESTO
  if (esVacante) {
    return "bg-yellow-200/90 border-yellow-500 text-yellow-950 font-bold shadow-xs";
  }
  if (colorZona === "amarillo") return "bg-amber-100/90 border-amber-300 text-amber-950";
  if (colorZona === "rosado") return "bg-pink-100/90 border-pink-300 text-pink-950";
  if (colorZona === "naranja") return "bg-orange-100/90 border-orange-300 text-orange-950";
  if (colorZona === "azul") return "bg-sky-100/90 border-sky-300 text-sky-950";
  if (colorZona === "verde") return "bg-emerald-100/90 border-emerald-300 text-emerald-950";
  if (colorZona === "gris") return "bg-gray-100/90 border-gray-300 text-gray-900";
  return "bg-emerald-50 border-emerald-200 text-emerald-950";
}

export default function NavesPage() {
  const [naves, setNaves] = useState<Nave[]>([]);
  const [cargando, setCargando] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [supervisoresDisponibles, setSupervisoresDisponibles] = useState<string[]>([]);

  // ── Estados del Planificador Espacial ──────────────────────────────────────
  const [navePlanoId, setNavePlanoId] = useState<string>("");
  const [planoActual, setPlanoActual] = useState<PlanoEspacialNave | null>(null);
  const [cargandoPlano, setCargandoPlano] = useState<boolean>(false);
  const [guardandoPlano, setGuardandoPlano] = useState<boolean>(false);
  const [comerciantes, setComerciantes] = useState<Comerciante[]>([]);
  const [puestosNaveActual, setPuestosNaveActual] = useState<Puesto[]>([]);
  const [modoVista, setModoVista] = useState<"VER" | "EDITAR">("VER");
  const [modoHerramienta, setModoHerramienta] = useState<
    "SELECCIONAR" | "PUESTO_RAPIDO" | "VACIO" | "PARQUEADERO" | "DELIMITACION" | "BANO"
  >("SELECCIONAR");
  const [draggedCelda, setDraggedCelda] = useState<{ fila: number; columna: number } | null>(null);
  const [dragOverCelda, setDragOverCelda] = useState<{ fila: number; columna: number } | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState<boolean>(false);

  // Modal de Detalle de Celda
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<{
    fila: number;
    columna: number;
    celda: CeldaPlanoNave;
  } | null>(null);
  const [formTipo, setFormTipo] = useState<TipoCeldaPlano>("PUESTO");
  const [formCodigo, setFormCodigo] = useState("");
  const [formTexto, setFormTexto] = useState("");
  const [formSubtexto, setFormSubtexto] = useState("");
  const [formColor, setFormColor] = useState<
    "amarillo" | "rosado" | "naranja" | "azul" | "verde" | "gris" | undefined
  >(undefined);
  const [formRowSpan, setFormRowSpan] = useState<number>(1);
  const [formColSpan, setFormColSpan] = useState<number>(1);
  const [hoverRowSpan, setHoverRowSpan] = useState<number | null>(null);
  const [hoverColSpan, setHoverColSpan] = useState<number | null>(null);
  const [modoManualPuesto, setModoManualPuesto] = useState(false);
  const [modalError, setModalError] = useState("");

  const celdasAbsorbidasModal = useMemo(() => {
    if (!celdaEnEdicion || !planoActual) return [];
    const { fila, columna } = celdaEnEdicion;
    const rSpan = formRowSpan;
    const cSpan = formColSpan;
    if (rSpan <= 1 && cSpan <= 1) return [];
    return planoActual.celdas.filter(
      (c) =>
        c.fila >= fila &&
        c.fila < fila + rSpan &&
        c.columna >= columna &&
        c.columna < columna + cSpan &&
        !(c.fila === fila && c.columna === columna) &&
        (c.tipo !== "VACIO" || Boolean(c.codigoPuesto) || Boolean(c.texto))
    );
  }, [celdaEnEdicion, planoActual, formRowSpan, formColSpan]);

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

  // Carga reactiva del plano y puestos cuando cambia la nave activa del planificador
  useEffect(() => {
    if (!navePlanoId) return;
    let activo = true;
    Promise.all([
      naveService.obtenerPlanoNave(navePlanoId),
      comercianteService.obtenerPuestosPorNave(navePlanoId),
    ])
      .then(([planoData, puestosData]) => {
        if (activo) {
          setPlanoActual(planoData);
          setPuestosNaveActual(puestosData);
          setCargandoPlano(false);
        }
      })
      .catch((err) => {
        if (activo) {
          console.error("Error al cargar plano de nave:", err);
          setCargandoPlano(false);
        }
      });
    return () => {
      activo = false;
    };
  }, [navePlanoId]);

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

  // ── Lógica del Planificador Espacial y Cuadrícula ───────────────────────────

  const naveSeleccionada = useMemo(
    () => naves.find((n) => n.id === navePlanoId) ?? naves[0] ?? null,
    [naves, navePlanoId]
  );

  const limitePuestos = naveSeleccionada?.cantidadPuestos ?? 100;

  // Mapa rápido de celdas por clave "fila-columna"
  const celdasMap = useMemo(() => {
    const map = new Map<string, CeldaPlanoNave>();
    if (planoActual) {
      for (const celda of planoActual.celdas) {
        map.set(`${celda.fila}-${celda.columna}`, celda);
      }
    }
    return map;
  }, [planoActual]);

  // Lista de códigos de puestos ya utilizados en el plano
  const codigosPuestosUbicados = useMemo(() => {
    const set = new Set<string>();
    if (planoActual) {
      for (const celda of planoActual.celdas) {
        if (celda.tipo === "PUESTO" && celda.codigoPuesto) {
          set.add(celda.codigoPuesto.trim().toUpperCase());
        }
      }
    }
    return set;
  }, [planoActual]);

  // Puestos registrados en la nave pendientes por ubicar en la cuadrícula
  const puestosNavePendientes = useMemo(() => {
    return puestosNaveActual.filter((p) => {
      const cod = p.codigo.trim().toUpperCase();
      const id = p.id.trim().toUpperCase();
      return !codigosPuestosUbicados.has(cod) && !codigosPuestosUbicados.has(id);
    });
  }, [puestosNaveActual, codigosPuestosUbicados]);

  // Métricas y conteos en vivo (con conteo inteligente de cupo por puestos únicos)
  const metricasPlano = useMemo(() => {
    if (!planoActual) {
      return {
        puestosEnPlano: 0,
        ocupados: 0,
        vacantes: 0,
        parqueaderos: 0,
        delimitaciones: 0,
        anotaciones: 0,
        banos: 0,
        vacios: 0,
      };
    }

    const codigosPuestosSet = new Set<string>();
    let parqueaderos = 0;
    let delimitaciones = 0;
    let anotaciones = 0;
    let banos = 0;
    let vacios = 0;

    const naveId = naveSeleccionada?.id ?? "";
    const naveNombre = naveSeleccionada?.nombre ?? "";

    for (const celda of planoActual.celdas) {
      if (celda.tipo === "PUESTO") {
        const cod = celda.codigoPuesto?.trim().toUpperCase();
        if (cod) {
          codigosPuestosSet.add(cod);
        }
      } else if (celda.tipo === "PARQUEADERO") {
        parqueaderos++;
      } else if (celda.tipo === "DELIMITACION") {
        delimitaciones++;
      } else if (celda.tipo === "ANOTACION") {
        anotaciones++;
      } else if (celda.tipo === "BANO") {
        banos++;
      } else {
        vacios++;
      }
    }

    let ocupados = 0;
    let vacantes = 0;
    for (const cod of codigosPuestosSet) {
      const { esVacante } = encontrarComercianteYPuesto(
        cod,
        naveId,
        naveNombre,
        comerciantes,
        puestosNaveActual
      );
      if (esVacante) {
        vacantes++;
      } else {
        ocupados++;
      }
    }

    return {
      puestosEnPlano: codigosPuestosSet.size,
      ocupados,
      vacantes,
      parqueaderos,
      delimitaciones,
      anotaciones,
      banos,
      vacios,
    };
  }, [planoActual, naveSeleccionada, comerciantes, puestosNaveActual]);

  // Cálculo de Bounding Box (recorte visual y para exportación PDF)
  const boundingBox = useMemo(() => {
    if (!planoActual) return { filasEfectivas: 1, columnasEfectivas: 1 };
    const celdasConInfo = planoActual.celdas.filter(
      (c) =>
        c.tipo !== "VACIO" ||
        Boolean(c.codigoPuesto && c.codigoPuesto.trim()) ||
        Boolean(c.texto && c.texto.trim())
    );
    if (celdasConInfo.length === 0) {
      return {
        filasEfectivas: Math.min(planoActual.filas, 6),
        columnasEfectivas: Math.min(planoActual.columnas, 6),
      };
    }
    const maxR = Math.max(
      0,
      ...celdasConInfo.map((c) => c.fila + (c.rowSpan || 1) - 1)
    );
    const maxC = Math.max(
      0,
      ...celdasConInfo.map((c) => c.columna + (c.colSpan || 1) - 1)
    );
    return {
      filasEfectivas: Math.max(1, Math.min(planoActual.filas, maxR + 1)),
      columnasEfectivas: Math.max(1, Math.min(planoActual.columnas, maxC + 1)),
    };
  }, [planoActual]);

  // Celdas cubiertas por la expansión de rowSpan o colSpan de otra celda principal
  const celdasCubiertas = useMemo(() => {
    const set = new Set<string>();
    if (!planoActual) return set;
    for (const c of planoActual.celdas) {
      const rSpan = c.rowSpan || 1;
      const cSpan = c.colSpan || 1;
      if (rSpan > 1 || cSpan > 1) {
        for (let r = 0; r < rSpan; r++) {
          for (let col = 0; col < cSpan; col++) {
            if (r !== 0 || col !== 0) {
              set.add(`${c.fila + r}-${c.columna + col}`);
            }
          }
        }
      }
    }
    return set;
  }, [planoActual]);

  function handleSeleccionarNaveParaPlano(naveId: string) {
    if (naveId !== navePlanoId) {
      setCargandoPlano(true);
      setNavePlanoId(naveId);
    }
    setTimeout(() => {
      const el = document.getElementById("planificador-espacial");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  function actualizarCeldaEnPlano(
    fila: number,
    columna: number,
    nuevaCelda: CeldaPlanoNave
  ) {
    if (!planoActual) return;
    const rSpan = nuevaCelda.rowSpan || 1;
    const cSpan = nuevaCelda.colSpan || 1;
    // Eliminar la celda que se actualiza y cualquier celda que quede absorbida por debajo
    const nuevasCeldas = planoActual.celdas.filter(
      (c) =>
        !(
          c.fila >= fila &&
          c.fila < fila + rSpan &&
          c.columna >= columna &&
          c.columna < columna + cSpan
        )
    );
    nuevasCeldas.push(nuevaCelda);
    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      celdas: nuevasCeldas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
  }

  // ── Drag & Drop Nativo para Mover / Reubicar Puestos ─────────────────────────
  function handleDragStart(e: React.DragEvent, fila: number, columna: number) {
    if (modoVista !== "EDITAR") return;
    setDraggedCelda({ fila, columna });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${fila}-${columna}`);
  }

  function handleDragOver(e: React.DragEvent, fila: number, columna: number) {
    if (modoVista !== "EDITAR") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCelda?.fila !== fila || dragOverCelda?.columna !== columna) {
      setDragOverCelda({ fila, columna });
    }
  }

  function handleDragLeave() {
    setDragOverCelda(null);
  }

  function handleDrop(targetFila: number, targetColumna: number) {
    setDragOverCelda(null);
    if (!draggedCelda || !planoActual) return;
    const { fila: sFila, columna: sCol } = draggedCelda;
    setDraggedCelda(null);
    if (sFila === targetFila && sCol === targetColumna) return;

    const celdaOrigen = celdasMap.get(`${sFila}-${sCol}`);
    if (!celdaOrigen || celdaOrigen.tipo === "VACIO") return;

    const celdaDestino = celdasMap.get(`${targetFila}-${targetColumna}`);

    const nuevasCeldas = planoActual.celdas.filter(
      (c) =>
        !(c.fila === sFila && c.columna === sCol) &&
        !(c.fila === targetFila && c.columna === targetColumna)
    );

    // Mover origen a posición destino
    nuevasCeldas.push({
      ...celdaOrigen,
      fila: targetFila,
      columna: targetColumna,
    });

    // Si destino tenía contenido, lo intercambiamos; de lo contrario queda como VACIO
    if (celdaDestino && celdaDestino.tipo !== "VACIO") {
      nuevasCeldas.push({
        ...celdaDestino,
        fila: sFila,
        columna: sCol,
      });
    } else {
      nuevasCeldas.push({
        fila: sFila,
        columna: sCol,
        tipo: "VACIO",
      });
    }

    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      celdas: nuevasCeldas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
    toast.success(
      `Puesto trasladado a [${colIndexToLetter(targetColumna)}${targetFila + 1}]`
    );
  }

  function handleClickCelda(fila: number, columna: number) {
    if (!planoActual) return;
    if (modoVista === "VER") return;

    const celdaExistente = celdasMap.get(`${fila}-${columna}`) ?? {
      fila,
      columna,
      tipo: "VACIO",
    };

    if (modoHerramienta === "SELECCIONAR") {
      setCeldaEnEdicion({ fila, columna, celda: celdaExistente });
      setFormTipo(celdaExistente.tipo);
      setFormCodigo(celdaExistente.codigoPuesto ?? "");
      setFormTexto(celdaExistente.texto ?? "");
      setFormSubtexto(celdaExistente.subtexto ?? "");
      setFormColor(celdaExistente.colorZona);
      setFormRowSpan(celdaExistente.rowSpan || 1);
      setFormColSpan(celdaExistente.colSpan || 1);
      setHoverRowSpan(null);
      setHoverColSpan(null);
      setModoManualPuesto(false);
      setModalError("");
      return;
    }

    if (modoHerramienta === "VACIO") {
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "VACIO",
      });
      return;
    }

    if (modoHerramienta === "PARQUEADERO") {
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "PARQUEADERO",
        texto: "PARQUEADERO",
        subtexto: "ZONA VEHICULAR",
        colorZona: "rosado",
      });
      return;
    }

    if (modoHerramienta === "DELIMITACION") {
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "DELIMITACION",
        texto: "SECCIÓN",
        subtexto: "CABECERA",
        colorZona: "azul",
      });
      return;
    }

    if (modoHerramienta === "BANO") {
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "BANO",
        texto: "BAÑO / BATERÍA SANITARIA",
        subtexto: "SERVICIOS HIGIÉNICOS",
        colorZona: "azul",
      });
      return;
    }

    if (modoHerramienta === "PUESTO_RAPIDO") {
      const codigosActuales = new Set(
        planoActual.celdas
          .filter(
            (c) =>
              c.tipo === "PUESTO" &&
              c.codigoPuesto?.trim() &&
              !(c.fila === fila && c.columna === columna)
          )
          .map((c) => c.codigoPuesto!.trim().toUpperCase())
      );

      if (codigosActuales.size >= limitePuestos) {
        toast.error(
          `Capacidad máxima alcanzada: Esta nave tiene un límite estricto de ${limitePuestos} puestos.`
        );
        return;
      }

      // Buscar el siguiente número disponible
      let siguienteNum = 1;
      while (siguienteNum <= limitePuestos) {
        const strNum = String(siguienteNum);
        if (!codigosPuestosUbicados.has(strNum)) {
          break;
        }
        siguienteNum++;
      }

      if (siguienteNum > limitePuestos) {
        toast.error(
          `Todos los puestos del 1 al ${limitePuestos} ya están ubicados en el plano.`
        );
        return;
      }

      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "PUESTO",
        codigoPuesto: String(siguienteNum),
        subtexto: "MÓDULO ESTÁNDAR",
      });

      toast.info(
        `Puesto #${siguienteNum} asignado en celda [${colIndexToLetter(columna)}${fila + 1}]`
      );
    }
  }

  function handleGuardarCeldaModal(e: React.FormEvent) {
    e.preventDefault();
    if (!celdaEnEdicion || !planoActual) return;
    setModalError("");

    const { fila, columna } = celdaEnEdicion;
    const rSpan = formRowSpan > 1 ? formRowSpan : undefined;
    const cSpan = formColSpan > 1 ? formColSpan : undefined;

    if (formTipo === "PUESTO") {
      const cod = formCodigo.trim();
      if (!cod) {
        setModalError("El código o número del puesto es obligatorio.");
        return;
      }

      // Validar capacidad según códigos de puestos únicos (permitiendo mismo código en celdas modulares adyacentes)
      const codigosUnicosActuales = new Set(
        planoActual.celdas
          .filter(
            (c) =>
              c.tipo === "PUESTO" &&
              c.codigoPuesto?.trim() &&
              !(c.fila === fila && c.columna === columna)
          )
          .map((c) => c.codigoPuesto!.trim().toUpperCase())
      );

      const codUpper = cod.toUpperCase();
      if (
        !codigosUnicosActuales.has(codUpper) &&
        codigosUnicosActuales.size >= limitePuestos
      ) {
        setModalError(
          `No se puede registrar otro puesto nuevo. La nave alcanzó su capacidad máxima (${limitePuestos} puestos).`
        );
        return;
      }

      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "PUESTO",
        codigoPuesto: cod,
        subtexto: formSubtexto.trim() || undefined,
        colorZona: formColor,
        rowSpan: rSpan,
        colSpan: cSpan,
      });
    } else if (formTipo === "VACIO") {
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: "VACIO",
      });
    } else {
      const texto = formTexto.trim();
      if (!texto) {
        setModalError("El texto principal es obligatorio.");
        return;
      }
      actualizarCeldaEnPlano(fila, columna, {
        fila,
        columna,
        tipo: formTipo,
        texto,
        subtexto: formSubtexto.trim() || undefined,
        colorZona: formColor,
        rowSpan: rSpan,
        colSpan: cSpan,
      });
    }

    setCeldaEnEdicion(null);
  }

  function handleVaciarCeldaModal() {
    if (!celdaEnEdicion) return;
    const { fila, columna } = celdaEnEdicion;
    actualizarCeldaEnPlano(fila, columna, {
      fila,
      columna,
      tipo: "VACIO",
    });
    setCeldaEnEdicion(null);
  }

  async function handleGuardarDistribucion() {
    if (!planoActual || !navePlanoId) return;
    setGuardandoPlano(true);
    try {
      const guardado = await naveService.guardarPlanoNave(navePlanoId, planoActual);
      setPlanoActual(guardado);
      toast.success("Distribución espacial guardada exitosamente", {
        description: `Se sincronizó el croquis con ${
          guardado.celdas.filter((c) => c.tipo === "PUESTO").length
        } puestos ubicados.`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al guardar el plano de la nave.";
      toast.error(msg);
    } finally {
      setGuardandoPlano(false);
    }
  }

  function handleAgregarFila() {
    if (!planoActual) return;
    const nuevaFila = planoActual.filas;
    const celdasNuevas = [...planoActual.celdas];
    for (let c = 0; c < planoActual.columnas; c++) {
      celdasNuevas.push({
        fila: nuevaFila,
        columna: c,
        tipo: "VACIO",
      });
    }
    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      filas: nuevaFila + 1,
      celdas: celdasNuevas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
  }

  function handleEliminarFila() {
    if (!planoActual) return;
    if (planoActual.filas <= 2) {
      toast.error("La cuadrícula debe tener al menos 2 filas.");
      return;
    }
    const filaAEliminar = planoActual.filas - 1;
    const tienePuestos = planoActual.celdas.some(
      (c) => c.fila === filaAEliminar && c.tipo === "PUESTO"
    );
    if (tienePuestos) {
      toast.error(
        `No se puede eliminar la Fila ${filaAEliminar + 1} porque contiene puestos asignados. Límpielos antes de continuar.`
      );
      return;
    }
    const celdasFiltradas = planoActual.celdas.filter((c) => c.fila !== filaAEliminar);
    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      filas: filaAEliminar,
      celdas: celdasFiltradas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
  }

  function handleAgregarColumna() {
    if (!planoActual) return;
    const nuevaColumna = planoActual.columnas;
    const celdasNuevas = [...planoActual.celdas];
    for (let r = 0; r < planoActual.filas; r++) {
      celdasNuevas.push({
        fila: r,
        columna: nuevaColumna,
        tipo: "VACIO",
      });
    }
    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      columnas: nuevaColumna + 1,
      celdas: celdasNuevas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
  }

  function handleEliminarColumna() {
    if (!planoActual) return;
    if (planoActual.columnas <= 2) {
      toast.error("La cuadrícula debe tener al menos 2 columnas.");
      return;
    }
    const colAEliminar = planoActual.columnas - 1;
    const tienePuestos = planoActual.celdas.some(
      (c) => c.columna === colAEliminar && c.tipo === "PUESTO"
    );
    if (tienePuestos) {
      toast.error(
        `No se puede eliminar la Columna ${colIndexToLetter(
          colAEliminar
        )} porque contiene puestos asignados. Límpielos antes de continuar.`
      );
      return;
    }
    const celdasFiltradas = planoActual.celdas.filter((c) => c.columna !== colAEliminar);
    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      columnas: colAEliminar,
      celdas: celdasFiltradas,
    };
    setPlanoActual(nuevoPlano);
    if (navePlanoId) {
      naveService.guardarPlanoNave(navePlanoId, nuevoPlano).catch(console.error);
    }
  }

  // ── Descargar Croquis / Plano en PDF (1 sola hoja landscape con Bounding Box) ──
  async function handleDescargarPDF() {
    if (!planoActual || !naveSeleccionada) return;
    setGenerandoPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = 297;
      const pageHeight = 210;

      // 1. Logo institucional en la esquina superior izquierda
      try {
        const imgRes = await fetch("/logopdf.png");
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          const imgBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imgBlob);
          });
          doc.addImage(imgBase64, "PNG", 12, 7, 22, 22);
        }
      } catch {
        // Continuar si el logo no está disponible
      }

      // 2. Encabezado institucional oficial centrado
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(24, 75, 49); // institucional-green
      doc.text(
        "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
        pageWidth / 2,
        11,
        { align: "center" }
      );

      doc.setFontSize(10.5);
      doc.setTextColor(33, 37, 41);
      doc.text(
        `PLANO ESPACIAL Y DISTRIBUCIÓN DE PUESTOS — ${naveSeleccionada.nombre}`,
        pageWidth / 2,
        22,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      const fechaStr = format(new Date(), "dd/MM/yyyy HH:mm");
      doc.text(
        `Capacidad: ${limitePuestos} puestos | Ubicados: ${metricasPlano.puestosEnPlano} | Ocupados: ${metricasPlano.ocupados} | Vacantes: ${metricasPlano.vacantes} | Fecha: ${fechaStr}`,
        pageWidth / 2,
        28,
        { align: "center" }
      );

      // 3. Cálculo de Bounding Box y Escalado a UNA SOLA HOJA
      const totalFilas = boundingBox.filasEfectivas;
      const totalCols = boundingBox.columnasEfectivas;

      const startX = 12;
      const startY = 34;
      const anchoDisponible = pageWidth - 24; // 273mm
      const altoDisponible = pageHeight - startY - 12; // 164mm

      const cellW = anchoDisponible / totalCols;
      const cellH = altoDisponible / totalFilas;

      // 4. Dibujar celdas activas
      for (let r = 0; r < totalFilas; r++) {
        for (let c = 0; c < totalCols; c++) {
          if (celdasCubiertas.has(`${r}-${c}`)) continue;

          const celda = celdasMap.get(`${r}-${c}`);
          if (!celda || celda.tipo === "VACIO") continue;

          const rSpan = celda.rowSpan || 1;
          const cSpan = celda.colSpan || 1;
          const x = startX + c * cellW;
          const y = startY + r * cellH;
          const w = cellW * cSpan;
          const h = cellH * rSpan;

          let coincidencia = null;
          if (celda.tipo === "PUESTO") {
            coincidencia = encontrarComercianteYPuesto(
              celda.codigoPuesto,
              naveSeleccionada.id,
              naveSeleccionada.nombre,
              comerciantes,
              puestosNaveActual
            );
          }
          const esVacante = Boolean(coincidencia?.esVacante);
          const comerciante = coincidencia?.comerciante;

          // Colores de relleno y borde
          if (celda.tipo === "PUESTO") {
            if (esVacante) {
              doc.setFillColor(254, 240, 138); // yellow-200
              doc.setDrawColor(202, 138, 4); // yellow-600
            } else if (celda.colorZona === "amarillo") {
              doc.setFillColor(254, 243, 199);
              doc.setDrawColor(245, 158, 11);
            } else if (celda.colorZona === "rosado") {
              doc.setFillColor(252, 231, 243);
              doc.setDrawColor(244, 114, 182);
            } else if (celda.colorZona === "naranja") {
              doc.setFillColor(255, 237, 213);
              doc.setDrawColor(251, 146, 60);
            } else if (celda.colorZona === "azul") {
              doc.setFillColor(224, 242, 254);
              doc.setDrawColor(56, 189, 248);
            } else if (celda.colorZona === "verde") {
              doc.setFillColor(220, 252, 231);
              doc.setDrawColor(74, 222, 128);
            } else if (celda.colorZona === "gris") {
              doc.setFillColor(243, 244, 246);
              doc.setDrawColor(156, 163, 175);
            } else {
              doc.setFillColor(236, 253, 245); // emerald-50
              doc.setDrawColor(110, 231, 183);
            }
          } else if (celda.tipo === "PARQUEADERO") {
            doc.setFillColor(255, 228, 230); // rose-100
            doc.setDrawColor(251, 113, 133);
          } else if (celda.tipo === "DELIMITACION") {
            doc.setFillColor(226, 232, 240); // slate-200
            doc.setDrawColor(148, 163, 184);
          } else if (celda.tipo === "ANOTACION") {
            doc.setFillColor(254, 243, 199); // amber-100
            doc.setDrawColor(251, 191, 36);
          } else if (celda.tipo === "BANO") {
            doc.setFillColor(207, 250, 254); // cyan-100
            doc.setDrawColor(34, 211, 238); // cyan-400
          }

          doc.setLineWidth(0.2);
          doc.roundedRect(x + 0.25, y + 0.25, w - 0.5, h - 0.5, 0.6, 0.6, "FD");

          const baseFontSize = Math.max(4.5, Math.min(8, h * 0.22));

          if (celda.tipo === "PUESTO") {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(Math.max(5, Math.min(8.5, h * 0.26)));
            doc.setTextColor(33, 37, 41);
            const numText = `#${celda.codigoPuesto || "S/N"}`;
            doc.text(numText, x + w - 1.5, y + Math.min(h * 0.35, 4.5), {
              align: "right",
            });

            if (comerciante) {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(baseFontSize);
              doc.setTextColor(20, 24, 30);
              const nombreCorto =
                comerciante.contribuyente.length > 18
                  ? comerciante.contribuyente.substring(0, 16) + "..."
                  : comerciante.contribuyente;
              doc.text(nombreCorto, x + 1.5, y + Math.min(h * 0.45, 6));

              if (h > 9 && comerciante.actividad) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(Math.max(4, baseFontSize - 1.5));
                doc.setTextColor(75, 85, 99);
                const actCorto =
                  comerciante.actividad.length > 20
                    ? comerciante.actividad.substring(0, 18) + "..."
                    : comerciante.actividad;
                doc.text(actCorto, x + 1.5, y + Math.min(h * 0.72, 9.5));
              }
            } else {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(Math.max(4.5, baseFontSize - 0.5));
              doc.setTextColor(146, 64, 14); // yellow-800
              doc.text("VACANTE", x + 1.5, y + Math.min(h * 0.45, 6));
            }
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(baseFontSize);
            doc.setTextColor(30, 41, 59);
            const titulo = (celda.texto || celda.tipo).toUpperCase();
            const titCorto =
              titulo.length > 22 ? titulo.substring(0, 20) + "..." : titulo;
            doc.text(
              titCorto,
              x + w / 2,
              y + h / 2 - (celda.subtexto ? 1.5 : 0),
              { align: "center" }
            );

            if (celda.subtexto && h > 8) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(Math.max(4, baseFontSize - 1.5));
              doc.setTextColor(75, 85, 99);
              const subCorto =
                celda.subtexto.length > 24
                  ? celda.subtexto.substring(0, 22) + "..."
                  : celda.subtexto;
              doc.text(subCorto, x + w / 2, y + h / 2 + 3, { align: "center" });
            }
          }
        }
      }

      // 5. Pie de página institucional
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text("Documento Oficial de Distribución Física — EP-EMA", 12, 204);
      doc.text("Página 1 de 1", pageWidth - 12, 204, { align: "right" });

      const nombreArchivo = `Plano_Espacial_${naveSeleccionada.nombre.replace(
        /\s+/g,
        "_"
      )}.pdf`;
      doc.save(nombreArchivo);
      toast.success("Plano descargado en PDF exitosamente", {
        description: `Se exportó "${nombreArchivo}" en una sola hoja.`,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al generar el documento PDF.";
      toast.error(msg);
    } finally {
      setGenerandoPdf(false);
    }
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
                          onClick={() => handleSeleccionarNaveParaPlano(nave.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-institucional-green hover:bg-institucional-green/10 transition-colors"
                          title="Planificar espacio en cuadrícula"
                          aria-label="Planificar espacio en cuadrícula"
                        >
                          <LayoutGrid size={13} />
                        </button>

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

        {/* ── Planificador Espacial de Naves y Distribución de Puestos (Croquis / Mapa) ── */}
        <section
          id="planificador-espacial"
          className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 p-4 sm:p-6 space-y-5"
        >
          {/* Barra Superior de Selección y Métricas en Vivo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-institucional-whiteSmokeBlack/15">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-institucional-green/10 text-institucional-green shrink-0">
                <LayoutGrid size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-base-eerieBlack sm:text-xl leading-tight">
                  Planificador Espacial de Naves y Distribución de Puestos
                </h2>
                <p className="text-xs text-gray-700">
                  Croquis interactivo y distribución física de puestos comerciales, bodegas y pasillos de EP-EMA.
                </p>
              </div>
            </div>

            {/* Controles de la Barra Superior: Selector de Modo y Selector de Nave */}
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
              {/* Selector / Toggle: VER vs EDITAR */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-institucional-whiteSmokeBlack/20 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setModoVista("VER")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVista === "VER"
                      ? "bg-institucional-green text-base-white shadow-xs"
                      : "text-gray-700 hover:text-base-eerieBlack hover:bg-slate-200/60"
                  }`}
                >
                  <Eye size={14} />
                  Modo Ver
                </button>
                <button
                  type="button"
                  onClick={() => setModoVista("EDITAR")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modoVista === "EDITAR"
                      ? "bg-institucional-green text-base-white shadow-xs"
                      : "text-gray-700 hover:text-base-eerieBlack hover:bg-slate-200/60"
                  }`}
                >
                  <Pencil size={14} />
                  Modo Editar
                </button>
              </div>

              {/* Selector de Nave Activa */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="select-nave-plano"
                  className="text-xs font-semibold text-gray-700 shrink-0"
                >
                  Nave Activa:
                </label>
                <select
                  id="select-nave-plano"
                  value={navePlanoId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== navePlanoId) {
                      setCargandoPlano(true);
                      setNavePlanoId(val);
                    }
                  }}
                  className="h-9 rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 py-1 text-sm font-semibold text-base-eerieBlack shadow-xs focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                >
                  {naves.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nombre} ({n.cantidadPuestos} puestos)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Barra de Métricas y Controles Rápidos */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-institucional-whiteSmokeBlack/15">
            {/* Indicadores de Cupo de Puestos (Candado de Capacidad) */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 bg-base-white px-2.5 py-1.5 rounded-lg border border-institucional-whiteSmokeBlack/20 shadow-2xs">
                <span className="font-semibold text-gray-700">Puestos ubicados:</span>
                <span className="font-mono font-bold text-base-eerieBlack">
                  {metricasPlano.puestosEnPlano} / {limitePuestos}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-base-white px-2.5 py-1.5 rounded-lg border border-institucional-whiteSmokeBlack/20 shadow-2xs">
                <span className="font-semibold text-gray-700">Restantes por ubicar:</span>
                <span className="font-mono font-bold text-acento-azul1">
                  {Math.max(0, limitePuestos - metricasPlano.puestosEnPlano)}
                </span>
              </div>

              {metricasPlano.puestosEnPlano === limitePuestos && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-2xs">
                  <CheckCircle2 size={13} />
                  Capacidad completa en plano
                </span>
              )}

              {metricasPlano.puestosEnPlano > limitePuestos && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-300 shadow-2xs">
                  <AlertTriangle size={13} />
                  Capacidad excedida ({metricasPlano.puestosEnPlano - limitePuestos} puestos extra)
                </span>
              )}

              {metricasPlano.puestosEnPlano < limitePuestos && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-300 shadow-2xs">
                  <Info size={13} />
                  {limitePuestos - metricasPlano.puestosEnPlano} cupos disponibles
                </span>
              )}
            </div>

            {/* Acciones según Modo: Descargar PDF en Modo VER / Controles en Modo EDITAR */}
            {modoVista === "VER" ? (
              <Button
                type="button"
                size="sm"
                disabled={generandoPdf}
                onClick={handleDescargarPDF}
                className="h-8 gap-1.5 bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 text-xs font-semibold shadow-2xs"
              >
                <Download size={14} />
                {generandoPdf ? "Generando..." : "Descargar Plano PDF"}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {/* Controles de Fila */}
                <div className="flex items-center rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white p-0.5 shadow-2xs">
                  <span className="px-2 text-xs font-semibold text-gray-700">
                    Filas: {planoActual?.filas ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={handleAgregarFila}
                    className="h-7 w-7 flex items-center justify-center rounded text-gray-700 hover:bg-slate-100 transition-colors"
                    title="Agregar Fila (+)"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleEliminarFila}
                    className="h-7 w-7 flex items-center justify-center rounded text-gray-700 hover:bg-slate-100 transition-colors"
                    title="Eliminar Última Fila (-)"
                  >
                    <Minus size={14} />
                  </button>
                </div>

                {/* Controles de Columna */}
                <div className="flex items-center rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white p-0.5 shadow-2xs">
                  <span className="px-2 text-xs font-semibold text-gray-700">
                    Columnas: {planoActual?.columnas ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={handleAgregarColumna}
                    className="h-7 w-7 flex items-center justify-center rounded text-gray-700 hover:bg-slate-100 transition-colors"
                    title="Agregar Columna (+)"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleEliminarColumna}
                    className="h-7 w-7 flex items-center justify-center rounded text-gray-700 hover:bg-slate-100 transition-colors"
                    title="Eliminar Última Columna (-)"
                  >
                    <Minus size={14} />
                  </button>
                </div>

                {/* Botón Guardar Distribución */}
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    guardandoPlano ||
                    metricasPlano.puestosEnPlano > limitePuestos
                  }
                  onClick={handleGuardarDistribucion}
                  className="h-8 gap-1.5 bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 text-xs font-semibold shadow-2xs"
                >
                  <Save size={14} />
                  {guardandoPlano ? "Guardando..." : "Guardar Distribución"}
                </Button>
              </div>
            )}
          </div>

          {/* Barra de Herramientas de Edición Rápida (Solo visible en Modo EDITAR) */}
          {modoVista === "EDITAR" && (
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/70 border border-institucional-whiteSmokeBlack/15">
              <span className="text-xs font-bold text-gray-700 px-2 shrink-0">
                Herramienta de Clic:
              </span>

              <button
                type="button"
                onClick={() => setModoHerramienta("SELECCIONAR")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "SELECCIONAR"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <MousePointerClick size={14} />
                1. Seleccionar / Editar Detalle
              </button>

              <button
                type="button"
                onClick={() => setModoHerramienta("PUESTO_RAPIDO")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "PUESTO_RAPIDO"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <Layers size={14} />
                2. Colocar Puesto Rápido (Secuencial)
              </button>

              <button
                type="button"
                onClick={() => setModoHerramienta("VACIO")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "VACIO"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <Eraser size={14} />
                3. Espacio en Blanco / Pasillo
              </button>

              <button
                type="button"
                onClick={() => setModoHerramienta("PARQUEADERO")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "PARQUEADERO"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <Car size={14} />
                4. Parqueadero
              </button>

              <button
                type="button"
                onClick={() => setModoHerramienta("DELIMITACION")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "DELIMITACION"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <Tag size={14} />
                5. Delimitación / Anotación
              </button>

              <button
                type="button"
                onClick={() => setModoHerramienta("BANO")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modoHerramienta === "BANO"
                    ? "bg-institucional-green text-base-white shadow-xs ring-1 ring-institucional-green"
                    : "bg-base-white text-gray-700 hover:bg-slate-50 border border-institucional-whiteSmokeBlack/20"
                }`}
              >
                <Bath size={14} />
                6. Baño / Sanitario
              </button>
            </div>
          )}

          {/* Lienzo de la Cuadrícula Adaptable (Croquis / Mapa Físico en CSS Grid) */}
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[640px] rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/50 p-3 sm:p-4 shadow-inner">
            {cargandoPlano ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-700">
                <div className="h-8 w-8 rounded-full border-3 border-institucional-green/30 border-t-institucional-green animate-spin" />
                <span className="text-sm font-medium">Cargando plano espacial de la nave...</span>
              </div>
            ) : !planoActual ? (
              <div className="text-center py-12 text-sm text-gray-700">
                No hay un plano configurado para esta nave.
              </div>
            ) : (
              <div className="inline-block min-w-full">
                {/* En Modo EDITAR: Encabezado de Columnas (A, B, C...) */}
                {modoVista === "EDITAR" && (
                  <div
                    className="grid gap-1.5 pb-1.5 sticky top-0 bg-slate-50/95 z-20"
                    style={{
                      gridTemplateColumns: `36px repeat(${planoActual.columnas}, minmax(112px, 1fr))`,
                      minWidth: `${36 + planoActual.columnas * 118}px`,
                    }}
                  >
                    <div className="w-9 shrink-0 text-center font-mono text-[10px] font-bold text-gray-700 py-1" />
                    {Array.from({ length: planoActual.columnas }).map((_, cIdx) => (
                      <div
                        key={`col-hdr-${cIdx}`}
                        className="text-center font-mono text-[11px] font-bold text-gray-700 bg-slate-200/70 border border-slate-300/80 py-1 rounded"
                      >
                        {colIndexToLetter(cIdx)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Contenedor CSS Grid de Celdas */}
                <div
                  className="grid gap-1.5"
                  style={
                    modoVista === "EDITAR"
                      ? {
                          gridTemplateColumns: `36px repeat(${planoActual.columnas}, minmax(112px, 1fr))`,
                          gridAutoRows: "minmax(76px, auto)",
                          minWidth: `${36 + planoActual.columnas * 118}px`,
                        }
                      : {
                          gridTemplateColumns: `repeat(${boundingBox.columnasEfectivas}, minmax(112px, 1fr))`,
                          gridAutoRows: "minmax(76px, auto)",
                          minWidth: `${boundingBox.columnasEfectivas * 118}px`,
                        }
                  }
                >
                  {/* En Modo EDITAR: Encabezados de Fila (1, 2, 3...) en Columna 1 */}
                  {modoVista === "EDITAR" &&
                    Array.from({ length: planoActual.filas }).map((_, rIdx) => (
                      <div
                        key={`row-hdr-${rIdx}`}
                        style={{
                          gridColumn: "1 / span 1",
                          gridRow: `${rIdx + 1} / span 1`,
                        }}
                        className="sticky left-0 z-10 flex items-center justify-center font-mono text-[11px] font-bold text-gray-700 bg-slate-200/70 border border-slate-300/80 rounded select-none min-h-[76px]"
                      >
                        {rIdx + 1}
                      </div>
                    ))}

                  {/* Celdas de la Matriz */}
                  {Array.from({
                    length:
                      modoVista === "EDITAR"
                        ? planoActual.filas
                        : boundingBox.filasEfectivas,
                  }).map((_, rIdx) =>
                    Array.from({
                      length:
                        modoVista === "EDITAR"
                          ? planoActual.columnas
                          : boundingBox.columnasEfectivas,
                    }).map((_, cIdx) => {
                      if (celdasCubiertas.has(`${rIdx}-${cIdx}`)) {
                        return null;
                      }

                      const celda = celdasMap.get(`${rIdx}-${cIdx}`) ?? {
                        fila: rIdx,
                        columna: cIdx,
                        tipo: "VACIO",
                      };

                      const rSpan = celda.rowSpan || 1;
                      const cSpan = celda.colSpan || 1;

                      // En Modo VER, las celdas VACIO son pasillos limpios e invisibles
                      if (modoVista === "VER" && celda.tipo === "VACIO") {
                        return (
                          <div
                            key={`celda-${rIdx}-${cIdx}`}
                            style={{
                              gridColumn: `${cIdx + 1} / span 1`,
                              gridRow: `${rIdx + 1} / span 1`,
                            }}
                            className="border-transparent bg-transparent pointer-events-none select-none min-h-[76px]"
                          />
                        );
                      }

                      const coincidencia =
                        celda.tipo === "PUESTO"
                          ? encontrarComercianteYPuesto(
                              celda.codigoPuesto,
                              naveSeleccionada?.id ?? "",
                              naveSeleccionada?.nombre ?? "",
                              comerciantes,
                              puestosNaveActual
                            )
                          : null;

                      const esVacante = Boolean(coincidencia?.esVacante);
                      const comerciante = coincidencia?.comerciante;

                      const estiloZona = getColorZonaClasses(
                        celda.colorZona,
                        celda.tipo,
                        esVacante
                      );

                      const gridColStart =
                        modoVista === "EDITAR" ? cIdx + 2 : cIdx + 1;
                      const gridRowStart = rIdx + 1;

                      const isDragOver =
                        dragOverCelda?.fila === rIdx &&
                        dragOverCelda?.columna === cIdx;

                      return (
                        <div
                          key={`celda-${rIdx}-${cIdx}`}
                          draggable={
                            modoVista === "EDITAR" && celda.tipo !== "VACIO"
                          }
                          onDragStart={(e) => handleDragStart(e, rIdx, cIdx)}
                          onDragOver={(e) => handleDragOver(e, rIdx, cIdx)}
                          onDragLeave={handleDragLeave}
                          onDrop={() => handleDrop(rIdx, cIdx)}
                          onClick={() => handleClickCelda(rIdx, cIdx)}
                          role={modoVista === "EDITAR" ? "button" : undefined}
                          tabIndex={modoVista === "EDITAR" ? 0 : undefined}
                          title={`[${getCoordenadasEtiqueta(
                            rIdx,
                            cIdx,
                            rSpan,
                            cSpan
                          )}] ${
                            celda.tipo === "PUESTO"
                              ? `Puesto: ${celda.codigoPuesto || "S/N"} ${
                                  comerciante
                                    ? `- ${comerciante.contribuyente}`
                                    : "(Vacante)"
                                }`
                              : celda.texto || celda.tipo
                          }`}
                          onKeyDown={(e) => {
                            if (
                              modoVista === "EDITAR" &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              handleClickCelda(rIdx, cIdx);
                            }
                          }}
                          style={{
                            gridColumn: `${gridColStart} / span ${cSpan}`,
                            gridRow: `${gridRowStart} / span ${rSpan}`,
                          }}
                          className={`min-w-[112px] min-h-[76px] p-2 rounded-lg border transition-all flex flex-col justify-between text-xs select-none ${
                            modoVista === "EDITAR"
                              ? "cursor-pointer hover:shadow-md hover:scale-[1.01]"
                              : "cursor-default"
                          } ${
                            modoVista === "EDITAR" && celda.tipo !== "VACIO"
                              ? "cursor-grab active:cursor-grabbing"
                              : ""
                          } ${
                            isDragOver
                              ? "ring-2 ring-institucional-green ring-offset-2 scale-[1.02] shadow-lg"
                              : ""
                          } ${estiloZona}`}
                        >
                          {/* Renderizado según tipo de celda */}
                          {celda.tipo === "PUESTO" && (
                            <>
                              <div className="space-y-0.5">
                                {comerciante ? (
                                  <>
                                    <p className="line-clamp-2 font-bold text-[11px] leading-tight text-base-eerieBlack">
                                      {comerciante.contribuyente}
                                    </p>
                                    <p className="text-[10px] text-gray-700 truncate">
                                      {comerciante.actividad}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-black uppercase bg-yellow-400 text-yellow-950 rounded tracking-wider shadow-2xs">
                                      VACANTE
                                    </span>
                                    {celda.subtexto && (
                                      <p className="text-[10px] text-yellow-950/80 font-medium truncate pt-0.5">
                                        {celda.subtexto}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1 mt-auto">
                                {modoVista === "EDITAR" && (
                                  <span className="text-[9px] text-gray-700 font-mono font-semibold">
                                    {getCoordenadasEtiqueta(
                                      rIdx,
                                      cIdx,
                                      rSpan,
                                      cSpan
                                    )}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-black font-mono shadow-2xs border ${
                                    esVacante
                                      ? "bg-yellow-300 text-yellow-950 border-yellow-600/40"
                                      : "bg-base-white/90 text-base-eerieBlack border-black/10"
                                  } ${modoVista === "VER" ? "ml-auto" : ""}`}
                                >
                                  #{celda.codigoPuesto || "S/N"}
                                </span>
                              </div>
                            </>
                          )}

                          {celda.tipo === "VACIO" && modoVista === "EDITAR" && (
                            <div className="h-full w-full flex flex-col items-center justify-center text-center opacity-40 hover:opacity-100 transition-opacity">
                              <span className="font-mono text-[9px] text-gray-700">
                                {colIndexToLetter(cIdx)}
                                {rIdx + 1}
                              </span>
                            </div>
                          )}

                          {celda.tipo === "PARQUEADERO" && (
                            <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1">
                              <Car size={16} className="text-rose-800" />
                              <span className="font-black text-[10px] uppercase tracking-wider text-rose-950 leading-tight">
                                {celda.texto || "PARQUEADERO"}
                              </span>
                              {celda.subtexto && (
                                <span className="text-[9px] text-rose-800 font-semibold truncate max-w-full">
                                  {celda.subtexto}
                                </span>
                              )}
                              {modoVista === "EDITAR" && (rSpan > 1 || cSpan > 1) && (
                                <span className="text-[8px] text-rose-900/70 font-mono">
                                  [{getCoordenadasEtiqueta(rIdx, cIdx, rSpan, cSpan)}]
                                </span>
                              )}
                            </div>
                          )}

                          {celda.tipo === "DELIMITACION" && (
                            <div className="h-full w-full flex flex-col items-center justify-center text-center gap-0.5">
                              <span className="font-black text-[11px] uppercase tracking-wide text-slate-950 leading-tight">
                                {celda.texto || "DELIMITACIÓN"}
                              </span>
                              {celda.subtexto && (
                                <span className="text-[9px] text-slate-700 font-bold uppercase truncate max-w-full">
                                  {celda.subtexto}
                                </span>
                              )}
                              {modoVista === "EDITAR" && (rSpan > 1 || cSpan > 1) && (
                                <span className="text-[8px] text-slate-900/70 font-mono">
                                  [{getCoordenadasEtiqueta(rIdx, cIdx, rSpan, cSpan)}]
                                </span>
                              )}
                            </div>
                          )}

                          {celda.tipo === "BANO" && (
                            <div className="h-full w-full flex flex-col items-center justify-center text-center gap-1">
                              <Bath size={16} className="text-cyan-800" />
                              <span className="font-black text-[10px] uppercase tracking-wider text-cyan-950 leading-tight">
                                {celda.texto || "BAÑO / BATERÍA SANITARIA"}
                              </span>
                              {celda.subtexto && (
                                <span className="text-[9px] text-cyan-800 font-semibold truncate max-w-full">
                                  {celda.subtexto}
                                </span>
                              )}
                              {modoVista === "EDITAR" && (rSpan > 1 || cSpan > 1) && (
                                <span className="text-[8px] text-cyan-900/70 font-mono">
                                  [{getCoordenadasEtiqueta(rIdx, cIdx, rSpan, cSpan)}]
                                </span>
                              )}
                            </div>
                          )}

                          {celda.tipo === "ANOTACION" && (
                            <div className="h-full w-full flex flex-col justify-between">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-amber-900 font-bold text-[10px]">
                                  <FileText size={11} />
                                  <span className="truncate">{celda.texto || "Nota"}</span>
                                </div>
                                {celda.subtexto && (
                                  <p className="text-[9px] text-amber-950 leading-tight line-clamp-2">
                                    {celda.subtexto}
                                  </p>
                                )}
                              </div>
                              {modoVista === "EDITAR" && (
                                <span className="text-[8px] text-amber-800 font-mono self-end">
                                  {getCoordenadasEtiqueta(
                                    rIdx,
                                    cIdx,
                                    rSpan,
                                    cSpan
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Leyenda Inferior en Vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-institucional-whiteSmokeBlack/15 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-400 inline-block" />
                <span>
                  Ocupados: <strong className="text-emerald-800">{metricasPlano.ocupados}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-yellow-200 border border-yellow-500 inline-block" />
                <span>
                  Vacantes en Plano: <strong className="text-yellow-950">{metricasPlano.vacantes}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-blue-100 border border-blue-400 inline-block" />
                <span>
                  Pendientes por Ubicar:{" "}
                  <strong className="text-blue-800">
                    {Math.max(0, limitePuestos - metricasPlano.puestosEnPlano)}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-rose-100 border border-rose-400 inline-block" />
                <span>
                  Parqueaderos: <strong className="text-rose-900">{metricasPlano.parqueaderos}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-cyan-100 border border-cyan-400 inline-block" />
                <span>
                  Baños: <strong className="text-cyan-900">{metricasPlano.banos}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="h-3 w-3 rounded bg-white border border-dashed border-gray-400 inline-block" />
                <span>
                  Pasillos / Vacíos: <strong className="text-gray-700">{metricasPlano.vacios}</strong>
                </span>
              </div>
            </div>

            {planoActual && (
              <span className="text-[11px] text-gray-700 italic">
                {modoVista === "VER"
                  ? `Dimensiones del croquis: ${boundingBox.filasEfectivas} filas × ${boundingBox.columnasEfectivas} columnas (recorte visual)`
                  : `Dimensiones de la matriz: ${planoActual.filas} filas × ${planoActual.columnas} columnas (${planoActual.filas * planoActual.columnas} celdas en cuadrícula)`}
              </span>
            )}
          </div>
        </section>
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

      {/* ── Modal: Edición Detallada de Celda Individual (disablePointerDismissal) ── */}
      <Dialog
        open={Boolean(celdaEnEdicion)}
        disablePointerDismissal={true}
        onOpenChange={(open) => !open && setCeldaEnEdicion(null)}
      >
        <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl lg:max-w-3xl p-6 bg-base-white rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-base-eerieBlack">
              <LayoutGrid className="text-institucional-green" size={20} />
              Configurar Celda [
              {celdaEnEdicion
                ? `${colIndexToLetter(celdaEnEdicion.columna)}${
                    celdaEnEdicion.fila + 1
                  }`
                : ""}
              ]
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-700 pt-1">
              Defina el tipo de espacio físico, código de puesto, dimensiones modulares o anotación espacial para esta coordenada.
            </DialogDescription>
          </DialogHeader>

          {celdaEnEdicion && (
            <form onSubmit={handleGuardarCeldaModal} className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ── Columna Izquierda: Datos del Espacio ── */}
                <div className="space-y-4">
                  {/* Selector de Tipo de Celda */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Tipo de Espacio *
                    </label>
                    <select
                      value={formTipo}
                      onChange={(e) => {
                        const nuevoTipo = e.target.value as TipoCeldaPlano;
                        setFormTipo(nuevoTipo);
                        setModalError("");
                      }}
                      className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 py-1 text-sm font-medium text-base-eerieBlack shadow-xs focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                    >
                      <option value="PUESTO">Puesto Comercial / Bodega (Cuenta en capacidad)</option>
                      <option value="VACIO">Espacio en Blanco / Pasillo de Circulación</option>
                      <option value="PARQUEADERO">Parqueadero / Zona Vehicular</option>
                      <option value="DELIMITACION">Delimitación Espacial (Norte, Sur, Sección)</option>
                      <option value="BANO">Baño / Batería Sanitaria</option>
                      <option value="ANOTACION">Anotación / Nota Administrativa</option>
                    </select>
                  </div>

                  {/* Campos específicos para PUESTO */}
                  {formTipo === "PUESTO" && (
                    <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-3">
                      {/* Control Unificado de Asignación de Puesto */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Puesto Asignado *
                          </label>
                          {puestosNaveActual.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setModoManualPuesto((prev) => !prev)}
                              className="text-[11px] font-semibold text-institucional-green hover:underline cursor-pointer"
                            >
                              {modoManualPuesto ? "🔍 Seleccionar de lista" : "✏️ Escribir manual"}
                            </button>
                          )}
                        </div>

                        {puestosNaveActual.length > 0 && !modoManualPuesto ? (
                          <select
                            value={formCodigo}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "__MANUAL__") {
                                setModoManualPuesto(true);
                                return;
                              }
                              setFormCodigo(val);
                              setModalError("");
                            }}
                            className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 py-1 text-xs text-base-eerieBlack shadow-xs focus:border-institucional-green"
                          >
                            <option value="">
                              -- Seleccionar puesto ({puestosNaveActual.length} registrados, {puestosNavePendientes.length} pendientes) --
                            </option>
                            {puestosNaveActual.map((p) => {
                              const com = comerciantes.find((c) => c.idInterno === p.comercianteId);
                              const estaUbicado = codigosPuestosUbicados.has(p.codigo.trim().toUpperCase());
                              return (
                                <option key={p.id} value={p.codigo}>
                                  {p.codigo} {com ? `- ${com.contribuyente} (${com.actividad})` : "- Vacante"} {estaUbicado ? "(Ya en plano)" : "★ Pendiente"}
                                </option>
                              );
                            })}
                            <option value="__MANUAL__">✏️ Escribir otro código manualmente...</option>
                          </select>
                        ) : (
                          <Input
                            type="text"
                            placeholder="Ej. 1, 01, 129, 4A, N-I-04, S/N"
                            value={formCodigo}
                            onChange={(e) => {
                              setFormCodigo(e.target.value);
                              setModalError("");
                            }}
                            className="bg-base-white text-sm h-9 font-mono font-semibold"
                            required
                            autoFocus
                          />
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Detalle Secundario / Metraje (Opcional)
                        </label>
                        <Input
                          type="text"
                          placeholder="Ej. 72M², Bodega o Con Baño"
                          value={formSubtexto}
                          onChange={(e) => setFormSubtexto(e.target.value)}
                          className="bg-base-white text-sm h-9"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Color de Zona / Bloque
                        </label>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            { id: undefined, label: "Predeterminado", bg: "bg-emerald-100 border-emerald-400" },
                            { id: "amarillo", label: "Amarillo", bg: "bg-amber-100 border-amber-400" },
                            { id: "rosado", label: "Rosado", bg: "bg-pink-100 border-pink-400" },
                            { id: "naranja", label: "Naranja", bg: "bg-orange-100 border-orange-400" },
                            { id: "azul", label: "Azul", bg: "bg-sky-100 border-sky-400" },
                            { id: "verde", label: "Verde", bg: "bg-emerald-100 border-emerald-400" },
                            { id: "gris", label: "Gris", bg: "bg-gray-200 border-gray-400" },
                          ].map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => setFormColor(c.id as typeof formColor)}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border transition-all ${
                                formColor === c.id
                                  ? "ring-2 ring-institucional-green font-bold shadow-xs"
                                  : "opacity-80 hover:opacity-100"
                              } ${c.bg}`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campos para PARQUEADERO, DELIMITACION, BANO o ANOTACION */}
                  {(formTipo === "PARQUEADERO" ||
                    formTipo === "DELIMITACION" ||
                    formTipo === "BANO" ||
                    formTipo === "ANOTACION") && (
                    <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-3">
                      {/* Chips contextuales de ayuda rápida */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Sugerencias Rápidas
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {formTipo === "DELIMITACION" &&
                            ["NORTE", "SUR", "ESTE", "OESTE", "ACCESO", "SECCIÓN"].map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  setFormTexto(sug);
                                  setModalError("");
                                }}
                                className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-[11px] font-bold hover:bg-slate-300 transition-colors"
                              >
                                {sug}
                              </button>
                            ))}

                          {formTipo === "BANO" &&
                            [
                              "BAÑO HOMBRES / MUJERES",
                              "BATERÍA SANITARIA",
                              "PUERTA LANFORT CON BAÑO",
                            ].map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  setFormTexto(sug);
                                  setModalError("");
                                }}
                                className="px-2 py-1 rounded bg-cyan-100 text-cyan-900 border border-cyan-300 text-[11px] font-bold hover:bg-cyan-200 transition-colors"
                              >
                                {sug}
                              </button>
                            ))}

                          {formTipo === "PARQUEADERO" &&
                            ["PARQUEADERO DE GRANOS", "ZONA DE DESCARGA", "PARQUEADERO CLIENTES"].map(
                              (sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => {
                                    setFormTexto(sug);
                                    setModalError("");
                                  }}
                                  className="px-2 py-1 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-bold hover:bg-rose-200 transition-colors"
                                >
                                  {sug}
                                </button>
                              )
                            )}

                          {formTipo === "ANOTACION" &&
                            ["MEMORANDO", "OBSERVACIÓN DE ESPACIO", "RESERVA ADMINISTRATIVA"].map(
                              (sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => {
                                    setFormTexto(sug);
                                    setModalError("");
                                  }}
                                  className="px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold hover:bg-amber-200 transition-colors"
                                >
                                  {sug}
                                </button>
                              )
                            )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Texto Principal *
                        </label>
                        <Input
                          type="text"
                          placeholder={
                            formTipo === "BANO"
                              ? "Ej. BAÑO HOMBRES / BATERÍA SANITARIA"
                              : formTipo === "PARQUEADERO"
                              ? "Ej. PARQUEADERO DE CARGA"
                              : formTipo === "DELIMITACION"
                              ? "Ej. NORTE o SECCIÓN PAPAS"
                              : "Ej. PUERTA LANFORT o MEMORANDO"
                          }
                          value={formTexto}
                          onChange={(e) => {
                            setFormTexto(e.target.value);
                            setModalError("");
                          }}
                          className="bg-base-white text-sm h-9 uppercase font-bold"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Subtexto / Detalle Técnico (Opcional)
                        </label>
                        <Input
                          type="text"
                          placeholder={
                            formTipo === "BANO"
                              ? "Ej. SERVICIOS HIGIÉNICOS o ACCESO CONTROLADO"
                              : "Ej. Batería Sanitaria, Camiones de 10 Toneladas..."
                          }
                          value={formSubtexto}
                          onChange={(e) => setFormSubtexto(e.target.value)}
                          className="bg-base-white text-sm h-9"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                          Color de Zona
                        </label>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            { id: undefined, label: "Predeterminado", bg: "bg-slate-100 border-slate-300" },
                            { id: "azul", label: "Azul", bg: "bg-sky-100 border-sky-400" },
                            { id: "rosado", label: "Rosado", bg: "bg-pink-100 border-pink-400" },
                            { id: "naranja", label: "Naranja", bg: "bg-orange-100 border-orange-400" },
                            { id: "amarillo", label: "Amarillo", bg: "bg-amber-100 border-amber-400" },
                            { id: "verde", label: "Verde", bg: "bg-emerald-100 border-emerald-400" },
                            { id: "gris", label: "Gris", bg: "bg-gray-200 border-gray-400" },
                          ].map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              onClick={() => setFormColor(c.id as typeof formColor)}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border transition-all ${
                                formColor === c.id
                                  ? "ring-2 ring-institucional-green font-bold shadow-xs"
                                  : "opacity-80 hover:opacity-100"
                              } ${c.bg}`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Columna Derecha: Dimensiones Modulares del Espacio ── */}
                <div className="space-y-4">
                  {formTipo !== "VACIO" ? (
                    <div className="space-y-3 rounded-xl border border-institucional-whiteSmokeBlack/20 bg-slate-50/60 p-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Dimensiones Modulares del Espacio
                        </label>
                        <p className="text-[11px] text-gray-700 mt-0.5">
                          Pase el cursor o haga clic sobre la matriz para expandir el bloque.
                        </p>
                      </div>

                      {/* Selector Gráfico Matricial Interactivo (6 x 6) */}
                      <div className="p-3 bg-base-white rounded-xl border border-institucional-whiteSmokeBlack/20 shadow-inner flex flex-col items-center">
                        <div
                          className="grid grid-cols-6 gap-1.5"
                          onMouseLeave={() => {
                            setHoverRowSpan(null);
                            setHoverColSpan(null);
                          }}
                        >
                          {Array.from({ length: 6 }).map((_, rIdx) => {
                            const r = rIdx + 1;
                            return Array.from({ length: 6 }).map((_, cIdx) => {
                              const c = cIdx + 1;
                              const effectiveR = hoverRowSpan ?? formRowSpan;
                              const effectiveC = hoverColSpan ?? formColSpan;
                              const isSelected = r <= effectiveR && c <= effectiveC;

                              return (
                                <button
                                  key={`matrix-${r}-${c}`}
                                  type="button"
                                  onMouseEnter={() => {
                                    setHoverRowSpan(r);
                                    setHoverColSpan(c);
                                  }}
                                  onClick={() => {
                                    setFormRowSpan(r);
                                    setFormColSpan(c);
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md border text-[10px] font-bold transition-all flex items-center justify-center ${
                                    isSelected
                                      ? "bg-institucional-green/20 border-institucional-green text-institucional-green shadow-xs"
                                      : "bg-slate-50 border-slate-200 text-gray-400 hover:border-institucional-green/40 hover:bg-slate-100"
                                  }`}
                                  title={`${r} fila(s) × ${c} columna(s)`}
                                >
                                  {r}×{c}
                                </button>
                              );
                            });
                          })}
                        </div>

                        {/* Etiqueta de Tamaño de Bloque */}
                        <div className="mt-3 text-center space-y-0.5">
                          <p className="text-xs font-bold text-base-eerieBlack">
                            Tamaño del bloque: {formRowSpan} fila(s) × {formColSpan} columna(s)
                          </p>
                          <p className="text-[11px] text-gray-600 font-mono">
                            Ocupará desde{" "}
                            {getCoordenadasEtiqueta(
                              celdaEnEdicion.fila,
                              celdaEnEdicion.columna,
                              formRowSpan,
                              formColSpan
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Ajuste Fino (+ / -) hasta 10 celdas */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="rounded-lg bg-base-white p-2.5 border border-institucional-whiteSmokeBlack/20">
                          <label className="text-[11px] font-semibold text-gray-700 block mb-1.5 text-center">
                            Alto en Filas
                          </label>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFormRowSpan((prev) => Math.max(1, prev - 1))}
                              className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-sm w-6 text-center">
                              {formRowSpan}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormRowSpan((prev) => Math.min(10, prev + 1))}
                              className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg bg-base-white p-2.5 border border-institucional-whiteSmokeBlack/20">
                          <label className="text-[11px] font-semibold text-gray-700 block mb-1.5 text-center">
                            Ancho en Columnas
                          </label>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFormColSpan((prev) => Math.max(1, prev - 1))}
                              className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-sm w-6 text-center">
                              {formColSpan}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormColSpan((prev) => Math.min(10, prev + 1))}
                              className="h-7 w-7 rounded border border-gray-300 bg-slate-50 hover:bg-slate-100 text-gray-700 font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Alerta de Celdas Absorbidas */}
                      {celdasAbsorbidasModal.length > 0 && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium">
                          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                          <span>
                            Este bloque absorberá <strong>{celdasAbsorbidasModal.length} espacio(s)</strong> registrado(s) debajo (
                            {celdasAbsorbidasModal
                              .map((c) => (c.codigoPuesto ? `#${c.codigoPuesto}` : c.texto || c.tipo))
                              .join(", ")}
                            ). Serán eliminados automáticamente al guardar.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs space-y-1">
                      <p className="font-semibold text-gray-700">Espacio en Blanco / Pasillo</p>
                      <p>Los pasillos ocupan una celda estándar y permiten el libre tránsito en el croquis.</p>
                    </div>
                  )}
                </div>
              </div>

              {modalError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-base-red font-medium">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-between pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleVaciarCeldaModal}
                  className="bg-red-50 text-base-red border border-red-200 hover:bg-red-100"
                >
                  <Eraser size={14} className="mr-1.5" />
                  Vaciar a Pasillo
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCeldaEnEdicion(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
                  >
                    Guardar Celda
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
