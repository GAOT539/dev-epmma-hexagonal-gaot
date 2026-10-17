"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Eye,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download,
  Plus,
  Minus,
  Save,
  MousePointerClick,
  Layers,
  Eraser,
  Car,
  Tag,
  Bath,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { naveService } from "@/application/services/nave.service";
import { comercianteService } from "@/application/services/comerciante.service";
import type {
  Nave,
  PlanoEspacialNave,
  CeldaPlano as CeldaPlanoNave,
  Puesto,
  TipoCeldaPlano,
} from "@/domain/models/nave.model";
import type { Comerciante } from "@/domain/models/comerciante.model";
import { Button } from "@/components/ui/button";
import {
  colIndexToLetter,
  getCoordenadasEtiqueta,
  encontrarComercianteYPuesto,
  getColorZonaClasses,
  generarPlanoEspacialPDF,
} from "./plano-nave.utils";
import { ModalConfigurarCelda } from "./ModalConfigurarCelda";

export type ModoHerramienta =
  | "SELECCIONAR"
  | "PUESTO_RAPIDO"
  | "VACIO"
  | "PARQUEADERO"
  | "DELIMITACION"
  | "ANOTACION"
  | "BANO";

interface PlanificadorEspacialProps {
  naves: Nave[];
  naveActivaId: string;
  onCambiarNaveActiva: (naveId: string) => void;
  comerciantes: Comerciante[];
}

export function PlanificadorEspacial({
  naves,
  naveActivaId,
  onCambiarNaveActiva,
  comerciantes,
}: PlanificadorEspacialProps) {
  const [planoActual, setPlanoActual] = useState<PlanoEspacialNave | null>(null);
  const [cargandoPlano, setCargandoPlano] = useState<boolean>(false);
  const [guardandoPlano, setGuardandoPlano] = useState<boolean>(false);
  const [puestosNaveActual, setPuestosNaveActual] = useState<Puesto[]>([]);
  const [modoVista, setModoVista] = useState<"VER" | "EDITAR">("VER");
  const [modoHerramienta, setModoHerramienta] = useState<ModoHerramienta>("SELECCIONAR");
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

  const naveSeleccionada = useMemo(
    () => naves.find((n) => n.id === naveActivaId) ?? naves[0] ?? null,
    [naves, naveActivaId]
  );

  const limitePuestos = naveSeleccionada?.cantidadPuestos ?? 100;

  // Carga reactiva del plano y puestos cuando cambia la nave activa
  useEffect(() => {
    if (!naveActivaId) return;
    let activo = true;
    queueMicrotask(() => {
      if (activo) setCargandoPlano(true);
    });
    Promise.all([
      naveService.obtenerPlanoNave(naveActivaId),
      comercianteService.obtenerPuestosPorNave(naveActivaId),
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
  }, [naveActivaId]);

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

  // Métricas y conteos en vivo
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

  // Celdas cubiertas por la expansión de rowSpan o colSpan
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

  // Celdas absorbidas en el modal de configuración de celda
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

  function actualizarCeldaEnPlano(
    fila: number,
    columna: number,
    nuevaCelda: CeldaPlanoNave
  ) {
    if (!planoActual) return;
    const rSpan = nuevaCelda.rowSpan || 1;
    const cSpan = nuevaCelda.colSpan || 1;
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
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
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

    const origRSpan = celdaOrigen.rowSpan || 1;
    const origCSpan = celdaOrigen.colSpan || 1;
    const esModular = origRSpan > 1 || origCSpan > 1;

    const rSpanEfectivo = Math.min(origRSpan, planoActual.filas - targetFila);
    const cSpanEfectivo = Math.min(origCSpan, planoActual.columnas - targetColumna);

    const celdaDestino = celdasMap.get(`${targetFila}-${targetColumna}`);

    // Filtrar celdas eliminadas/absorbidas (origen y celdas cubiertas por el rectángulo destino)
    const nuevasCeldas = planoActual.celdas.filter((c) => {
      // Excluir celda de origen
      if (c.fila === sFila && c.columna === sCol) return false;

      // Excluir cualquier celda dentro del rectángulo destino ocupado por el bloque
      if (
        c.fila >= targetFila &&
        c.fila < targetFila + rSpanEfectivo &&
        c.columna >= targetColumna &&
        c.columna < targetColumna + cSpanEfectivo
      ) {
        return false;
      }

      return true;
    });

    // Mover origen a posición destino con spans efectivos
    nuevasCeldas.push({
      ...celdaOrigen,
      fila: targetFila,
      columna: targetColumna,
      rowSpan: rSpanEfectivo > 1 ? rSpanEfectivo : undefined,
      colSpan: cSpanEfectivo > 1 ? cSpanEfectivo : undefined,
    });

    // Origen queda como VACIO o intercambia si era 1x1 con celda no vacía
    if (esModular) {
      nuevasCeldas.push({
        fila: sFila,
        columna: sCol,
        tipo: "VACIO",
        rowSpan: 1,
        colSpan: 1,
      });
    } else {
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
    }

    const nuevoPlano: PlanoEspacialNave = {
      ...planoActual,
      celdas: nuevasCeldas,
    };
    setPlanoActual(nuevoPlano);
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
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
    if (!planoActual || !naveActivaId) return;
    setGuardandoPlano(true);
    try {
      const guardado = await naveService.guardarPlanoNave(naveActivaId, planoActual);
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
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
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
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
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
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
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
    if (naveActivaId) {
      naveService.guardarPlanoNave(naveActivaId, nuevoPlano).catch(console.error);
    }
  }

  // ── Descargar Croquis / Plano en PDF ──
  async function handleDescargarPDF() {
    if (!planoActual || !naveSeleccionada) return;
    setGenerandoPdf(true);
    try {
      await generarPlanoEspacialPDF({
        planoActual,
        naveSeleccionada,
        limitePuestos,
        metricasPlano,
        boundingBox,
        celdasCubiertas,
        celdasMap,
        comerciantes,
        puestosNaveActual,
      });
      toast.success("Plano descargado en PDF exitosamente", {
        description: `Se exportó el plano de "${naveSeleccionada.nombre}" en una sola hoja.`,
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
    <>
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
                Ver
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
                Editar
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
                value={naveActivaId}
                onChange={(e) => onCambiarNaveActiva(e.target.value)}
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

      {/* ── Modal: Edición Detallada de Celda Individual ── */}
      <ModalConfigurarCelda
        celdaEnEdicion={celdaEnEdicion}
        onCerrar={() => setCeldaEnEdicion(null)}
        formTipo={formTipo}
        setFormTipo={setFormTipo}
        formCodigo={formCodigo}
        setFormCodigo={setFormCodigo}
        formTexto={formTexto}
        setFormTexto={setFormTexto}
        formSubtexto={formSubtexto}
        setFormSubtexto={setFormSubtexto}
        formColor={formColor}
        setFormColor={setFormColor}
        formRowSpan={formRowSpan}
        setFormRowSpan={setFormRowSpan}
        formColSpan={formColSpan}
        setFormColSpan={setFormColSpan}
        hoverRowSpan={hoverRowSpan}
        setHoverRowSpan={setHoverRowSpan}
        hoverColSpan={hoverColSpan}
        setHoverColSpan={setHoverColSpan}
        modoManualPuesto={modoManualPuesto}
        setModoManualPuesto={setModoManualPuesto}
        modalError={modalError}
        setModalError={setModalError}
        puestosNaveActual={puestosNaveActual}
        puestosNavePendientes={puestosNavePendientes}
        codigosPuestosUbicados={codigosPuestosUbicados}
        comerciantes={comerciantes}
        celdasAbsorbidasModal={celdasAbsorbidasModal}
        handleGuardarCeldaModal={handleGuardarCeldaModal}
        handleVaciarCeldaModal={handleVaciarCeldaModal}
      />
    </>
  );
}
