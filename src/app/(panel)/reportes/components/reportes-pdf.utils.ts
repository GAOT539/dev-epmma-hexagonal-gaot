import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Comerciante, RegistroAsistencia } from "@/domain/models/comerciante.model";
import type { PermisoDetalle } from "@/domain/models/asistencia.model";
import type { Nave } from "@/domain/models/nave.model";

// ── Tipos y Colores de Estados Oficiales ─────────────────────────────────────

export type EstadoReporteCelda = "Presente" | "Ausente" | "Permiso" | "Justificado" | "Vacante" | "—";

export const ESTADO_COLORES: Record<
  string,
  { bg: string; text: string; hex: string; rgb: [number, number, number] }
> = {
  Presente:    { bg: "bg-green-700",  text: "text-white", hex: "#15803D", rgb: [21, 128, 61] },
  Ausente:     { bg: "bg-red-700",    text: "text-white", hex: "#B91C1C", rgb: [185, 28, 28] },
  Permiso:     { bg: "bg-purple-700", text: "text-white", hex: "#7E22CE", rgb: [126, 34, 206] },
  Justificado: { bg: "bg-blue-700",   text: "text-white", hex: "#1D4ED8", rgb: [29, 78, 216] },
  Vacante:     { bg: "bg-amber-500",  text: "text-white", hex: "#D97706", rgb: [217, 119, 6] },
};

export const ESTADO_LABELS: Record<string, string> = {
  Presente: "P",
  Ausente: "A",
  Permiso: "Pm",
  Justificado: "J",
  Vacante: "V",
};

export function compararCodigosPuesto(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function obtenerInicialDiaSemana(fechaStr: string): string {
  try {
    const day = new Date(fechaStr + "T00:00:00").getDay();
    const dias = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
    return dias[day] || "";
  } catch {
    return "";
  }
}

// ── Normalización de texto (insensible a tildes y mayúsculas) ───────────────

export const normalizeText = (text: string): string => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export function formatearNovedadesReporte(registros: RegistroAsistencia[]): string {
  const permisosMap = new Map<string, PermisoDetalle>();
  const obsList: string[] = [];
  const seenObs = new Set<string>();

  registros.forEach((r) => {
    // 1. Permisos estructurados (agrupados para evitar repetición)
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
        let entry = "";
        if (obs.tipo === "Citaciones") {
          entry = `${r.fecha} [Citación - Ref/Doc: ${obs.numeroDocumento || "S/N"}]: ${obs.texto}`;
        } else if (obs.tipo === "Notificación") {
          entry = `${r.fecha} [Notificación - Ref/Doc: ${obs.numeroDocumento || "S/N"}]: ${obs.texto}`;
        } else {
          entry = `${r.fecha} [Obs. General]: ${obs.texto}`;
        }
        if (!seenObs.has(entry)) {
          seenObs.add(entry);
          obsList.push(entry);
        }
      });
    } else if (r.observacion && r.estado !== "Permiso") {
      const entry = `${r.fecha} [Obs. General]: ${r.observacion}`;
      if (!seenObs.has(entry)) {
        seenObs.add(entry);
        obsList.push(entry);
      }
    }
  });

  const permisosFormatted = Array.from(permisosMap.values()).map((p) => {
    const fAsign = p.fechaAsignacion || p.fechaInicio;
    return `${fAsign} [Permiso]: ${p.motivo || "Permiso concedido"} (Vigencia: ${p.fechaInicio} al ${p.fechaFin})`;
  });

  const todas = [...permisosFormatted, ...obsList];
  return todas.join("\n");
}

export interface ReporteItem {
  comerciante: Comerciante;
  puestoCode: string;
  naveNombre: string;
  naveId: string;
  estados: EstadoReporteCelda[];
  observaciones: string;
  esVacante?: boolean;
}

export interface ReglaNoLaborableParam {
  id: string;
  motivo: string;
  tipoRegla: string;
  fechaInicio: string;
  fechaFin: string;
  diasSemana?: number[];
  aplicaTodasNaves: boolean;
  navesIds?: string[];
  fechasExpandidas: string[];
}

export interface ExportarReportePDFParams {
  reporteFiltrado: ReporteItem[];
  fechas: string[];
  fechaInicio: string;
  fechaFin: string;
  soloObservaciones: boolean;
  incluirObservaciones: boolean;
  navesDisponibles?: Nave[];
  reglasNoLaborables?: ReglaNoLaborableParam[];
}

export function calcularTextosPeriodo(fechaInicio: string, fechaFin: string) {
  if (!fechaInicio || !fechaFin) {
    return {
      periodoTexto: "—",
      textoMes: "—",
      anio: new Date().getFullYear().toString(),
      diaInicio: "01",
      diaFin: "30",
    };
  }
  const dInicio = new Date(fechaInicio + "T00:00:00");
  const dFin = new Date(fechaFin + "T00:00:00");
  const diaInicio = format(dInicio, "dd");
  const diaFin = format(dFin, "dd");
  const periodoTexto = `${diaInicio} al ${diaFin}`;

  const mesInicioStr = format(dInicio, "MMMM", { locale: es });
  const mesFinStr = format(dFin, "MMMM", { locale: es });
  const anioInicio = format(dInicio, "yyyy");
  const anioFin = format(dFin, "yyyy");
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let textoMes = "";
  if (mesInicioStr.toLowerCase() === mesFinStr.toLowerCase() && anioInicio === anioFin) {
    textoMes = `${cap(mesInicioStr)} ${anioInicio}`;
  } else if (anioInicio === anioFin) {
    textoMes = `${cap(mesInicioStr)} - ${cap(mesFinStr)} ${anioInicio}`;
  } else {
    textoMes = `${cap(mesInicioStr)} ${anioInicio} - ${cap(mesFinStr)} ${anioFin}`;
  }

  return { periodoTexto, textoMes, anio: anioFin, diaInicio, diaFin };
}

// ── Exportación a PDF por Nave ──────────────────────────────────────────────

export async function exportarReporteAsistenciaPDF({
  reporteFiltrado,
  fechas,
  fechaInicio,
  fechaFin,
  soloObservaciones,
  incluirObservaciones,
  navesDisponibles = [],
}: ExportarReportePDFParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;

  // Cargar logo institucional una sola vez
  let logoBase64: string | null = null;
  try {
    const imgRes = await fetch("/logopdf.png");
    if (imgRes.ok) {
      const imgBlob = await imgRes.blob();
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
    }
  } catch {
    // Continuar si falla la lectura del logo
  }

  // Agrupar filas por Nave
  const navesMap = new Map<string, { id: string; nombre: string; items: ReporteItem[] }>();
  reporteFiltrado.forEach((item) => {
    const naveId = item.naveId || "sin-nave";
    const existing = navesMap.get(naveId);
    if (existing) {
      existing.items.push(item);
    } else {
      navesMap.set(naveId, {
        id: naveId,
        nombre: item.naveNombre || "Nave",
        items: [item],
      });
    }
  });

  const gruposNaves = Array.from(navesMap.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: "base" })
  );

  const { periodoTexto, textoMes } = calcularTextosPeriodo(fechaInicio, fechaFin);

  gruposNaves.forEach((grupo, idxNave) => {
    if (idxNave > 0) {
      doc.addPage();
    }

    const naveObj = navesDisponibles.find((n) => n.id === grupo.id || n.nombre === grupo.nombre);
    const supervisoresList = Array.isArray(naveObj?.supervisores)
      ? naveObj.supervisores.filter(Boolean)
      : [];
    const textoSupervisor =
      supervisoresList.length > 0 ? supervisoresList.join(", ") : "No existe supervisor a cargo";

    // 1. Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 10, 7, 20, 20);
      } catch {
        // Ignorar si hay problema con la imagen
      }
    }

    // 2. Encabezado institucional central
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO",
      pageWidth / 2,
      12,
      { align: "center" }
    );

    doc.setFontSize(10.5);
    doc.text(
      soloObservaciones
        ? "REPORTE DE OBSERVACIONES Y NOVEDADES POR NAVE"
        : "CONTROL DE ASISTENCIA EP-EMA",
      pageWidth / 2,
      18,
      { align: "center" }
    );

    // 3. Cuadro Izquierdo (Datos de la Nave: x = 10, y = 24, ancho = 95mm)
    const leftX = 10;
    const leftY = 24;
    const leftW = 95;
    const rowH = 4.8;
    const labelW = 24;

    const filasIzq = [
      { label: "Nave:", val: grupo.nombre },
      { label: "Período:", val: periodoTexto },
      { label: "Mes:", val: textoMes },
      { label: "Supervisor:", val: textoSupervisor },
    ];

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);

    filasIzq.forEach((f, idx) => {
      const curY = leftY + idx * rowH;
      doc.setFillColor(230, 239, 233);
      doc.rect(leftX, curY, labelW, rowH, "FD");
      doc.setFillColor(255, 255, 255);
      doc.rect(leftX + labelW, curY, leftW - labelW, rowH, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(33, 37, 41);
      doc.text(f.label, leftX + 2, curY + 3.3);

      doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
      doc.setFontSize(idx === 3 && f.val.length > 34 ? 5.8 : 7);
      doc.text(f.val, leftX + labelW + 2, curY + 3.3);
    });

    // 4. Cuadro Derecho (Descripción: x = pageWidth - 95, y = 24, ancho = 85mm)
    const rightW = 85;
    const rightX = pageWidth - 95;
    const rightY = 24;

    doc.setFillColor(230, 239, 233);
    doc.rect(rightX, rightY, rightW, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(33, 37, 41);
    doc.text("Descripción", rightX + rightW / 2, rightY + 2.8, { align: "center" });

    const badges = [
      { key: "P", desc: "Presente", col: [21, 128, 61] as [number, number, number] },
      { key: "A", desc: "Ausente", col: [185, 28, 28] as [number, number, number] },
      { key: "Pm", desc: "Permiso", col: [126, 34, 206] as [number, number, number] },
      { key: "J", desc: "Justifica", col: [29, 78, 216] as [number, number, number] },
      { key: "V", desc: "Vacante", col: [217, 119, 6] as [number, number, number] },
    ];

    const subH = 5;
    const layout = [
      { item: badges[0], x: rightX, y: rightY + 4, w: 42.5 },
      { item: badges[3], x: rightX + 42.5, y: rightY + 4, w: 42.5 },
      { item: badges[1], x: rightX, y: rightY + 4 + subH, w: 42.5 },
      { item: badges[4], x: rightX + 42.5, y: rightY + 4 + subH, w: 42.5 },
      { item: badges[2], x: rightX, y: rightY + 4 + subH * 2, w: 42.5 },
    ];

    doc.setFillColor(255, 255, 255);
    doc.rect(rightX + 42.5, rightY + 4 + subH * 2, 42.5, subH, "FD");

    layout.forEach(({ item, x, y, w }) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, w, subH, "FD");

      const badgeW = 9;
      doc.setFillColor(...item.col);
      doc.rect(x + 1.5, y + 1, badgeW, subH - 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(item.key, x + 1.5 + badgeW / 2, y + subH / 2 + 0.8, { align: "center", baseline: "middle" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(33, 37, 41);
      doc.text(item.desc, x + 1.5 + badgeW + 2, y + subH / 2 + 0.8, { baseline: "middle" });
    });

    // 5. Ordenar filas de la nave: vacantes primero, luego ocupados
    const vacantes = grupo.items
      .filter((i) => i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const ocupados = grupo.items
      .filter((i) => !i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const filasNave = [...vacantes, ...ocupados];

    // 6. Encabezado de 2 Niveles
    let headers: Array<Array<{ content: string; rowSpan?: number; colSpan?: number; styles?: Record<string, unknown> }>>;

    if (soloObservaciones) {
      headers = [
        [
          { content: "#", styles: { halign: "center", valign: "middle" } },
          { content: "CÉDULA", styles: { halign: "center", valign: "middle" } },
          { content: "CONTRIBUYENTE", styles: { halign: "left", valign: "middle" } },
          { content: "PRODUCTO", styles: { halign: "left", valign: "middle" } },
          { content: "PUESTO", styles: { halign: "center", valign: "middle" } },
          {
            content: "OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS",
            styles: { halign: "left", valign: "middle" },
          },
        ],
      ];
    } else {
      const headRow1: Array<{ content: string; rowSpan?: number; styles?: Record<string, unknown> }> = [
        { content: "#", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "CÉDULA", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "CONTRIBUYENTE", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
        { content: "PRODUCTO", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
        { content: "PUESTO", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
      ];

      fechas.forEach((f) => {
        headRow1.push({
          content: obtenerInicialDiaSemana(f),
          styles: { halign: "center", fontSize: 5.5, valign: "middle" },
        });
      });

      if (incluirObservaciones) {
        headRow1.push({
          content: "OBSERVACIONES",
          rowSpan: 2,
          styles: { valign: "middle", halign: "left" },
        });
      }

      const headRow2: Array<{ content: string; styles?: Record<string, unknown> }> = [];
      fechas.forEach((f) => {
        const diaNum = String(parseInt(f.split("-")[2], 10));
        headRow2.push({
          content: diaNum,
          styles: { halign: "center", fontSize: 5.5, valign: "middle" },
        });
      });

      headers = [headRow1, headRow2];
    }

    // 7. Cuerpo de la tabla
    const bodyData = filasNave.map((row, i) => {
      const idxStr = String(i + 1);
      if (row.esVacante) {
        const baseRow = [idxStr, "-", "-", "-", row.puestoCode];
        if (soloObservaciones) {
          return [...baseRow, "—"];
        }
        const datesRow = row.estados.map((e) => ESTADO_LABELS[e] ?? e);
        const obsRow = incluirObservaciones ? ["—"] : [];
        return [...baseRow, ...datesRow, ...obsRow];
      }

      const baseRow = [
        idxStr,
        row.comerciante.cedula || "—",
        row.comerciante.contribuyente || "—",
        row.comerciante.actividad || "—",
        row.puestoCode || "—",
      ];
      if (soloObservaciones) {
        return [...baseRow, row.observaciones || "—"];
      }
      const datesRow = row.estados.map((e) => ESTADO_LABELS[e] ?? e);
      const obsRow = incluirObservaciones ? [row.observaciones || "—"] : [];
      return [...baseRow, ...datesRow, ...obsRow];
    });

    autoTable(doc, {
      head: headers as unknown as string[][],
      body: bodyData,
      startY: 50,
      theme: "grid",
      styles: { fontSize: 6, cellPadding: 1.2 },
      headStyles: {
        fillColor: [51, 117, 51], // institucional-green
        textColor: 255,
        fontStyle: "bold",
        fontSize: 5.8,
      },
      columnStyles: soloObservaciones
        ? {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 22, halign: "center" },
            2: { cellWidth: 48, halign: "left" },
            3: { cellWidth: 32, halign: "left" },
            4: { cellWidth: 16, halign: "center" },
            5: { cellWidth: "auto", halign: "left" },
          }
        : {
            0: { cellWidth: 7, halign: "center" },
            1: { cellWidth: 18, halign: "center" },
            2: { cellWidth: incluirObservaciones ? 38 : 46, halign: "left" },
            3: { cellWidth: incluirObservaciones ? 26 : 32, halign: "left" },
            4: { cellWidth: 14, halign: "center" },
          },
      didDrawCell: (cellData: {
        section: string;
        column: { index: number };
        cell: { x: number; y: number; width: number; height: number; text: string[] };
      }) => {
        if (
          !soloObservaciones &&
          cellData.section === "body" &&
          cellData.column.index >= 5 &&
          cellData.column.index < 5 + fechas.length
        ) {
          const value = cellData.cell.text[0];
          const colorMap: Record<string, [number, number, number]> = {
            P: [21, 128, 61],
            A: [185, 28, 28],
            Pm: [126, 34, 206],
            J: [29, 78, 216],
            V: [217, 119, 6],
          };
          const color = colorMap[value];
          if (color) {
            doc.setFillColor(...color);
            doc.rect(cellData.cell.x, cellData.cell.y, cellData.cell.width, cellData.cell.height, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5.5);
            doc.setFont("helvetica", "bold");
            doc.text(
              value,
              cellData.cell.x + cellData.cell.width / 2,
              cellData.cell.y + cellData.cell.height / 2 + 0.8,
              { align: "center", baseline: "middle" }
            );
          } else if (value === "—") {
            doc.setFillColor(254, 243, 199);
            doc.rect(cellData.cell.x, cellData.cell.y, cellData.cell.width, cellData.cell.height, "F");
            doc.setTextColor(180, 83, 9);
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.text(
              value,
              cellData.cell.x + cellData.cell.width / 2,
              cellData.cell.y + cellData.cell.height / 2 + 0.8,
              { align: "center", baseline: "middle" }
            );
          }
        }
      },
    });
  });

  // 8. Pie de página en todas las hojas
  const totalPages = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${p} de ${totalPages} — Control de Asistencia • EP-EMA`,
      pageWidth / 2,
      204,
      { align: "center" }
    );
  }

  doc.save(
    `${soloObservaciones ? "reporte-observaciones-novedades" : "reporte-asistencia"}-${fechaInicio}-a-${fechaFin}.pdf`
  );
}
