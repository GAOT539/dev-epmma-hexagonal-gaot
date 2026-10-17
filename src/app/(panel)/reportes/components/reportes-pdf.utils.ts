import { format } from "date-fns";
import type { Comerciante, RegistroAsistencia } from "@/domain/models/comerciante.model";
import type { EstadoAsistencia, PermisoDetalle } from "@/domain/models/asistencia.model";

// ── Colores por estado ───────────────────────────────────────────────────────

export const ESTADO_COLORES: Record<string, { bg: string; text: string; hex: string }> = {
  Presente: { bg: "bg-green-700", text: "text-white", hex: "#15803D" },
  Ausente: { bg: "bg-red-700", text: "text-white", hex: "#B91C1C" },
  Permiso: { bg: "bg-purple-700", text: "text-white", hex: "#7E22CE" },
  Vacante: { bg: "bg-gray-700", text: "text-white", hex: "#374151" },
};

export const ESTADO_LABELS: Record<string, string> = {
  Presente: "P",
  Ausente: "A",
  Permiso: "Pm",
  Vacante: "V",
};

// ── Normalización de texto (insensible a tildes y mayúsculas) ───────────────

export const normalizeText = (text: string): string => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export function formatearNovedadesReporte(registros: RegistroAsistencia[]): string {
  const permisosMap = new Map<string, PermisoDetalle>();
  const obsList: string[] = [];

  registros.forEach((r) => {
    // 1. Permisos estructurados (agrupados para evitar repetición día a día)
    if (r.permisos && r.permisos.length > 0) {
      r.permisos.forEach((p) => {
        const key = p.id || `${p.fechaInicio}-${p.fechaFin}`;
        if (!permisosMap.has(key)) {
          permisosMap.set(key, p);
        }
      });
    } else if (r.estado === "Permiso" && r.permisoInicio && r.permisoFin) {
      const key = `${r.permisoInicio}-${r.permisoFin}`;
      if (!permisosMap.has(key)) {
        permisosMap.set(key, {
          id: key,
          motivo: r.observacion || "Permiso concedido",
          fechaAsignacion: r.fecha,
          fechaInicio: r.permisoInicio,
          fechaFin: r.permisoFin,
        });
      }
    }

    // 2. Observaciones categorizadas
    if (r.observaciones && r.observaciones.length > 0) {
      r.observaciones.forEach((obs) => {
        if (obs.tipo === "Citaciones") {
          obsList.push(`${r.fecha} [Citación - Ref/Doc: ${obs.numeroDocumento || "S/N"}]: ${obs.texto}`);
        } else if (obs.tipo === "Notificación") {
          obsList.push(`${r.fecha} [Notificación - Ref/Doc: ${obs.numeroDocumento || "S/N"}]: ${obs.texto}`);
        } else {
          obsList.push(`${r.fecha} [Obs. General]: ${obs.texto}`);
        }
      });
    } else if (r.observacion && r.estado !== "Permiso") {
      obsList.push(`${r.fecha} [Obs. General]: ${r.observacion}`);
    }
  });

  // Estructura requerida: fechaAsignacion [Permiso]: motivo (Vigencia: inicio al fin)
  const permisosFormatted = Array.from(permisosMap.values()).map((p) => {
    const fAsign = p.fechaAsignacion || p.fechaInicio;
    return `${fAsign} [Permiso]: ${p.motivo || "Permiso concedido"} (Vigencia: ${p.fechaInicio} al ${p.fechaFin})`;
  });

  const todas = [...permisosFormatted, ...obsList];
  return todas.join(" | ");
}

export interface ReporteItem {
  comerciante: Comerciante;
  puestoCode: string;
  naveNombre: string;
  naveId: string;
  estados: EstadoAsistencia[];
  observaciones: string;
}

export interface ExportarReportePDFParams {
  reporteFiltrado: ReporteItem[];
  fechas: string[];
  fechaInicio: string;
  fechaFin: string;
  soloObservaciones: boolean;
  incluirObservaciones: boolean;
}

export async function exportarReporteAsistenciaPDF({
  reporteFiltrado,
  fechas,
  fechaInicio,
  fechaFin,
  soloObservaciones,
  incluirObservaciones,
}: ExportarReportePDFParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;

  // 1. Logo en el Lado Izquierdo
  try {
    const imgRes = await fetch("/logopdf.png");
    if (imgRes.ok) {
      const imgBlob = await imgRes.blob();
      const imgBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      doc.addImage(imgBase64, "PNG", 10, 7, 22, 22);
    }
  } catch {
    // Si el logo no está disponible, continuar sin él
  }

  // Cabecera Centrada
  doc.setTextColor(33, 37, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO",
    pageWidth / 2,
    16,
    { align: "center" }
  );

  doc.setFontSize(11);
  doc.text(
    soloObservaciones ? "REPORTE DE OBSERVACIONES Y NOVEDADES" : "REPORTE DE ASISTENCIA",
    pageWidth / 2,
    23,
    { align: "center" }
  );

  // 2. Limpieza de la Metadata (Solo Período)
  const formatearFecha = (f: string) => {
    if (!f) return "—";
    try {
      return format(new Date(f + "T00:00:00"), "dd/MM/yyyy");
    } catch {
      return f;
    }
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(
    `Período: ${formatearFecha(fechaInicio)} al ${formatearFecha(fechaFin)}`,
    pageWidth / 2,
    29,
    { align: "center" }
  );

  const fechaHeaders = fechas.map(
    (f) => `${format(new Date(f + "T00:00:00"), "dd/MM")}`
  );

  const baseHeaders = ["#", "CIU", "CÉDULA", "CONTRIBUYENTE", "ACTIVIDAD", "NAVE", "PUESTO"];
  const headers = soloObservaciones
    ? [[...baseHeaders, "OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS"]]
    : [[...baseHeaders, ...fechaHeaders, ...(incluirObservaciones ? ["Obs."] : [])]];

  const data = reporteFiltrado.map((row, i) => {
    const baseRow = [
      String(i + 1),
      row.comerciante.ciu,
      row.comerciante.cedula,
      row.comerciante.contribuyente,
      row.comerciante.actividad,
      row.naveNombre,
      row.puestoCode,
    ];
    if (soloObservaciones) {
      return [...baseRow, row.observaciones || "—"];
    }
    const datesRow = row.estados.map((e) => ESTADO_LABELS[e] ?? "—");
    const obsRow = incluirObservaciones ? [row.observaciones || "—"] : [];
    return [...baseRow, ...datesRow, ...obsRow];
  });

  autoTable(doc, {
    head: headers,
    body: data,
    startY: 34,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: {
      fillColor: [51, 117, 51], // institucional-green
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6,
    },
    columnStyles: soloObservaciones
      ? {
          0: { cellWidth: 8 },
          1: { cellWidth: 15 },
          2: { cellWidth: 18 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 15 },
          7: { cellWidth: "auto" },
        }
      : {
          0: { cellWidth: 8 },
          1: { cellWidth: 15 },
          2: { cellWidth: 18 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
        },
    didDrawCell: (cellData: { section: string; column: { index: number }; cell: { x: number; y: number; width: number; height: number; text: string[] } }) => {
      if (
        !soloObservaciones &&
        cellData.section === "body" &&
        cellData.column.index >= 7 &&
        cellData.column.index < 7 + fechas.length
      ) {
        const value = cellData.cell.text[0];
        const colorMap: Record<string, [number, number, number]> = {
          P: [21, 128, 61],
          A: [185, 28, 28],
          Pm: [126, 34, 206],
          V: [55, 65, 81],
        };
        const color = colorMap[value];
        if (color) {
          doc.setFillColor(...color);
          doc.rect(
            cellData.cell.x,
            cellData.cell.y,
            cellData.cell.width,
            cellData.cell.height,
            "F"
          );
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.text(
            value,
            cellData.cell.x + cellData.cell.width / 2,
            cellData.cell.y + cellData.cell.height / 2 + 1,
            { align: "center", baseline: "middle" }
          );
        }
      }
    },
  });

  // 3. Leyenda de Estados justo debajo de la tabla (solo si no es solo observaciones)
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  if (!soloObservaciones) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    doc.text(
      "P = Presente | A = Ausente | Pm = Permiso | V = Vacante",
      10,
      finalY + 5
    );
  }

  // 4. Pie de Página
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${p} de ${totalPages} — ${soloObservaciones ? "Reporte de Observaciones y Novedades" : "Reporte de Asistencia"}`,
      pageWidth / 2,
      204,
      { align: "center" }
    );
  }

  doc.save(`${soloObservaciones ? "reporte-observaciones-novedades" : "reporte-asistencia"}-${fechaInicio}-a-${fechaFin}.pdf`);
}
