import { format } from "date-fns";
import type {
  Nave,
  PlanoEspacialNave,
  CeldaPlano,
  Puesto,
  TipoCeldaPlano,
} from "@/domain/models/nave.model";
import type { Comerciante } from "@/domain/models/comerciante.model";

export function colIndexToLetter(index: number): string {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function getCoordenadasEtiqueta(
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

export interface CoincidenciaPuestoComerciante {
  comerciante: Comerciante | null;
  puesto: Puesto | null;
  esVacante: boolean;
  codigoReal: string;
}

/**
 * Ordena los puestos de una nave de forma determinista y natural:
 * 1. Categoría o prefijo: BODEGA, CUBICULO, NUCLEO, ZCF/ZONA, N-/P-, otros.
 * 2. Comparación alfanumérica natural (numeric: true, sensitivity: "base").
 */
export function ordenarPuestosDeNave(
  puestos: Puesto[],
  comerciantes?: Comerciante[]
): Puesto[] {
  const getCategoriaPeso = (codigo: string): number => {
    const upper = codigo.trim().toUpperCase();
    if (upper.startsWith("BODEGA")) return 1;
    if (upper.startsWith("CUBICULO") || upper.startsWith("CUBÍCULO")) return 2;
    if (upper.startsWith("NUCLEO") || upper.startsWith("NÚCLEO")) return 3;
    if (upper.startsWith("ZCF") || upper.startsWith("ZONA")) return 4;
    if (upper.startsWith("N-") || upper.startsWith("P-")) return 5;
    return 6;
  };

  const comMap = comerciantes
    ? new Map(comerciantes.map((c) => [c.idInterno, c]))
    : null;

  return [...puestos].sort((a, b) => {
    const pesoA = getCategoriaPeso(a.codigo);
    const pesoB = getCategoriaPeso(b.codigo);
    if (pesoA !== pesoB) return pesoA - pesoB;

    const diff = a.codigo.trim().localeCompare(b.codigo.trim(), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (diff !== 0) return diff;

    if (comMap && a.comercianteId && b.comercianteId) {
      const nomA = comMap.get(a.comercianteId)?.contribuyente ?? "";
      const nomB = comMap.get(b.comercianteId)?.contribuyente ?? "";
      return nomA.localeCompare(nomB);
    }
    return 0;
  });
}

export function encontrarComercianteYPuesto(
  codigoPuesto: string | undefined,
  naveId: string,
  naveNombre: string,
  comerciantes: Comerciante[],
  puestos: Puesto[]
): CoincidenciaPuestoComerciante {
  if (!codigoPuesto) {
    return { comerciante: null, puesto: null, esVacante: true, codigoReal: "" };
  }

  const codLimpio = codigoPuesto.trim().replace(/^#/, "").trim().toUpperCase();
  const puestosNave = puestos.filter((p) => !naveId || p.naveId === naveId);
  const puestosOrdenados = ordenarPuestosDeNave(puestosNave, comerciantes);

  // Paso A: Coincidencia exacta por código o ID
  let puestoEncontrado =
    puestosNave.find((p) => {
      const pCod = p.codigo.trim().toUpperCase();
      const pId = p.id.trim().toUpperCase();
      return pCod === codLimpio || pId === codLimpio;
    }) ?? null;

  // Paso B: Coincidencia por índice secuencial 1..N
  if (!puestoEncontrado && /^\d+$/.test(codLimpio)) {
    const pIndex = parseInt(codLimpio, 10) - 1;
    if (pIndex >= 0 && pIndex < puestosOrdenados.length) {
      puestoEncontrado = puestosOrdenados[pIndex];
    }
  }

  // Paso C: Coincidencia por sufijo numérico solo cuando no hay ambigüedad
  if (!puestoEncontrado) {
    const sufijoMatch = codLimpio.match(/(\d+)$/);
    if (sufijoMatch) {
      const numSufijo = parseInt(sufijoMatch[1], 10);
      const candidatos = puestosNave.filter((p) => {
        const pMatch = p.codigo.trim().toUpperCase().match(/(\d+)$/);
        return pMatch && parseInt(pMatch[1], 10) === numSufijo;
      });
      if (candidatos.length === 1) {
        puestoEncontrado = candidatos[0];
      }
    }
  }

  // Si se encontró el puesto en la nave, buscar comerciante activo asignado
  if (puestoEncontrado) {
    const comerciante =
      (puestoEncontrado.comercianteId
        ? comerciantes.find(
            (c) =>
              c.idInterno === puestoEncontrado.comercianteId &&
              c.estadoRegistro !== "Deshabilitado"
          )
        : null) ||
      comerciantes.find(
        (c) =>
          c.estadoRegistro !== "Deshabilitado" &&
          c.puestoId &&
          (c.puestoId.trim().toUpperCase() === puestoEncontrado.codigo.trim().toUpperCase() ||
            c.puestoId.trim().toUpperCase() === puestoEncontrado.id.trim().toUpperCase())
      ) ||
      null;

    return {
      comerciante,
      puesto: puestoEncontrado,
      esVacante: !comerciante,
      codigoReal: puestoEncontrado.codigo,
    };
  }

  // Paso D: Coincidencia directa por catálogo de comerciantes
  const comercianteDirecto =
    comerciantes.find((c) => {
      if (c.estadoRegistro === "Deshabilitado") return false;
      const naveMatch =
        c.nave &&
        (c.nave.trim().toUpperCase() === naveNombre.trim().toUpperCase() ||
          c.nave.trim().toLowerCase() === naveId.toLowerCase());
      if (!naveMatch && !c.puestoId) return false;

      if (c.puestoId) {
        const cPuestoId = c.puestoId.trim().toUpperCase();
        return cPuestoId === codLimpio;
      }
      return false;
    }) ?? null;

  if (comercianteDirecto) {
    return {
      comerciante: comercianteDirecto,
      puesto: null,
      esVacante: false,
      codigoReal: comercianteDirecto.puestoId || codigoPuesto,
    };
  }

  return { comerciante: null, puesto: null, esVacante: true, codigoReal: codigoPuesto };
}

export function getColorZonaClasses(
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

export interface GenerarPlanoEspacialPDFParams {
  planoActual: PlanoEspacialNave;
  naveSeleccionada: Nave;
  limitePuestos: number;
  metricasPlano: {
    puestosEnPlano: number;
    ocupados: number;
    vacantes: number;
  };
  boundingBox: {
    filasEfectivas: number;
    columnasEfectivas: number;
  };
  celdasCubiertas: Set<string>;
  celdasMap: Map<string, CeldaPlano>;
  comerciantes: Comerciante[];
  puestosNaveActual: Puesto[];
}

export async function generarPlanoEspacialPDF({
  naveSeleccionada,
  limitePuestos,
  metricasPlano,
  boundingBox,
  celdasCubiertas,
  celdasMap,
  comerciantes,
  puestosNaveActual,
}: GenerarPlanoEspacialPDFParams): Promise<void> {
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

      // Colores de relleno y borde
      if (celda.tipo === "PUESTO") {
        if (celda.colorZona === "amarillo") {
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
        const codText = `${celda.codigoPuesto || coincidencia?.codigoReal || "S/N"}`.trim();
        const maxTextW = Math.max(8, w - 2);
        const fontSize = Math.max(4.8, Math.min(8, h * 0.26));
        doc.setFontSize(fontSize);
        doc.setTextColor(33, 37, 41);
        const lineas = doc.splitTextToSize(codText, maxTextW);
        const lineLeading = fontSize * 0.42;
        const totalH = lineas.length * lineLeading;
        const startYPos = y + h / 2 - totalH / 2 + lineLeading * 0.8;
        doc.text(lineas, x + w / 2, startYPos, {
          align: "center",
          lineHeightFactor: 1.15,
        });
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
}

export const exportarPlanoNavePDF = generarPlanoEspacialPDF;
