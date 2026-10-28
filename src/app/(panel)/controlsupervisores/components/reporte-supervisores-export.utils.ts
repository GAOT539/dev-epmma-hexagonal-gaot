// ── Exportadores PDF y Excel: Reporte Consolidado y Detallado de Supervisores ──

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type {
  ResumenGestionSupervisor,
  PermisoSupervisorPeriodoItem,
  DetalleSupervisorReporte,
  EventoDetalladoSupervisor,
} from "@/app/api/v1/auditoria/reporte-supervisores/route";

export type {
  ResumenGestionSupervisor,
  PermisoSupervisorPeriodoItem,
  DetalleSupervisorReporte,
  EventoDetalladoSupervisor,
};

export interface ReporteSupervisoresData {
  resumenSupervisores: ResumenGestionSupervisor[];
  permisosSupervisoresPeriodo: PermisoSupervisorPeriodoItem[];
  detallesPorSupervisor: DetalleSupervisorReporte[];
  fechaDesde: string;
  fechaHasta: string;
}

// ── Función auxiliar para período institucional unificado ─────────────────────

function calcularTextosPeriodo(fechaInicio?: string, fechaFin?: string) {
  if (!fechaInicio || !fechaFin) {
    return {
      periodoUnificado: "Período no definido",
    };
  }
  const dInicio = new Date(fechaInicio + "T00:00:00");
  const dFin = new Date(fechaFin + "T00:00:00");
  const diaInicio = format(dInicio, "dd");
  const diaFin = format(dFin, "dd");
  const mesInicioStr = format(dInicio, "MMMM", { locale: es });
  const mesFinStr = format(dFin, "MMMM", { locale: es });
  const anioInicio = format(dInicio, "yyyy");
  const anioFin = format(dFin, "yyyy");

  let periodoUnificado = "";
  if (mesInicioStr.toLowerCase() === mesFinStr.toLowerCase() && anioInicio === anioFin) {
    if (diaInicio === diaFin) {
      periodoUnificado = `${diaInicio} de ${mesInicioStr} de ${anioFin}`;
    } else {
      periodoUnificado = `Del ${diaInicio} al ${diaFin} de ${mesInicioStr} de ${anioFin}`;
    }
  } else if (anioInicio === anioFin) {
    periodoUnificado = `${diaInicio} de ${mesInicioStr} al ${diaFin} de ${mesFinStr} de ${anioFin}`;
  } else {
    periodoUnificado = `${diaInicio} de ${mesInicioStr} de ${anioInicio} al ${diaFin} de ${mesFinStr} de ${anioFin}`;
  }

  return { periodoUnificado };
}

// ── Carga auxiliar de logo Base64 ─────────────────────────────────────────────

async function cargarLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logopdf.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. EXPORTADOR A PDF MULTI-HOJA
// ═════════════════════════════════════════════════════════════════════════════

export async function exportarReporteSupervisoresPDF(
  data: ReporteSupervisoresData
): Promise<void> {
  const { resumenSupervisores, permisosSupervisoresPeriodo, detallesPorSupervisor, fechaDesde, fechaHasta } =
    data;

  const MARGIN_X = 14;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const logoBase64 = await cargarLogoBase64();
  const { periodoUnificado } = calcularTextosPeriodo(fechaDesde, fechaHasta);

  // ── HOJA 1: RESUMEN CONSOLIDADO Y PERMISOS DE SUPERVISORES ──────────────────

  // 1. Logo institucional
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", MARGIN_X, 6, 19, 19);
    } catch {
      // Continuar si falla renderizado de imagen
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
    "REPORTE CONSOLIDADO Y DETALLADO DE SUPERVISORES — EP-EMA",
    pageWidth / 2,
    18.5,
    { align: "center" }
  );

  // 3. Cuadro superior de información (x=14, y=28, ancho=105mm)
  const leftX = MARGIN_X;
  const leftY = 28;
  const leftW = 105;
  const rowH = 5.2;
  const labelW = 28;

  const filasEncabezado = [
    { label: "Reporte:", val: "Resumen Consolidado y Cobertura Operativa" },
    { label: "Período:", val: periodoUnificado },
    { label: "Supervisores:", val: `${resumenSupervisores.length} registrado(s)` },
  ];

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  filasEncabezado.forEach((f, idx) => {
    const curY = leftY + idx * rowH;
    doc.setFillColor(230, 239, 233);
    doc.rect(leftX, curY, labelW, rowH, "FD");
    doc.setFillColor(255, 255, 255);
    doc.rect(leftX + labelW, curY, leftW - labelW, rowH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(33, 37, 41);
    doc.text(f.label, leftX + 2, curY + rowH / 2, { baseline: "middle" });

    doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
    doc.setFontSize(7);
    doc.text(f.val, leftX + labelW + 2, curY + rowH / 2, { baseline: "middle" });
  });

  // Título Tabla 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(33, 37, 41);
  doc.text("1. RESUMEN CONSOLIDADO DE GESTIÓN POR SUPERVISOR", MARGIN_X, 47);

  // Tabla 1: Resumen Consolidado de Gestión por Supervisor
  const headersTabla1 = [
    [
      "#",
      "SUPERVISOR",
      "NAVES A CARGO",
      "JUSTIFICACIONES",
      "PERMISOS",
      "OBS. GENERALES",
      "CITACIONES",
      "NOTIFICACIONES",
      "DÍAS SIN INGRESO",
    ],
  ];

  const filasTabla1 = resumenSupervisores.map((s) => [
    s.numero,
    s.supervisorNombre,
    s.navesACargo,
    s.justificaciones,
    s.permisos,
    s.observacionesGenerales,
    s.citaciones,
    s.notificaciones,
    s.diasSinIngreso,
  ]);

  autoTable(doc, {
    head: headersTabla1,
    body: filasTabla1,
    startY: 50,
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 7, cellPadding: 2, textColor: [33, 37, 41] },
    headStyles: {
      fillColor: [69, 116, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 52, fontStyle: "bold" },
      2: { cellWidth: 55 },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 28, halign: "center" },
      6: { cellWidth: 24, halign: "center" },
      7: { cellWidth: 26, halign: "center" },
      8: { cellWidth: 26, halign: "center" },
    },
  });

  const finalYTabla1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Título Tabla 2
  const startYTabla2 = finalYTabla1 + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(33, 37, 41);
  doc.text("2. REGISTRO DE PERMISOS DE SUPERVISORES Y COBERTURA APLICADA", MARGIN_X, startYTabla2);

  const headersTabla2 = [
    [
      "SUPERVISOR",
      "VIGENCIA (DESDE - HASTA)",
      "MOTIVO",
      "NAVE",
      "ACCIÓN / COBERTURA APLICADA",
    ],
  ];

  const filasTabla2 =
    permisosSupervisoresPeriodo.length > 0
      ? permisosSupervisoresPeriodo.map((p) => [
          p.supervisorNombre,
          p.vigenciaTexto,
          p.motivo,
          p.naveNombre,
          p.accionCobertura,
        ])
      : [["—", "—", "No se registraron permisos de supervisores en este período", "—", "—"]];

  autoTable(doc, {
    head: headersTabla2,
    body: filasTabla2,
    startY: startYTabla2 + 3,
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { fontSize: 7, cellPadding: 2, textColor: [33, 37, 41] },
    headStyles: {
      fillColor: [69, 116, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: 40 },
      2: { cellWidth: 65 },
      3: { cellWidth: 40 },
      4: { cellWidth: 69 },
    },
  });

  // ── HOJAS SIGUIENTES: 1 PÁGINA DETALLADA POR SUPERVISOR ─────────────────────

  detallesPorSupervisor.forEach((sup) => {
    doc.addPage();

    // 1. Logo institucional
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", MARGIN_X, 6, 19, 19);
      } catch {
        // Continuar
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
      "DETALLE CRONOLÓGICO OPERATIVO POR SUPERVISOR — EP-EMA",
      pageWidth / 2,
      18.5,
      { align: "center" }
    );

    // 3. Cuadro superior del supervisor
    const filasSup = [
      { label: "Supervisor:", val: sup.supervisorNombre },
      { label: "Naves Asignadas:", val: sup.navesAsignadas },
      { label: "Período:", val: periodoUnificado },
    ];

    filasSup.forEach((f, idx) => {
      const curY = leftY + idx * rowH;
      doc.setFillColor(230, 239, 233);
      doc.rect(leftX, curY, labelW, rowH, "FD");
      doc.setFillColor(255, 255, 255);
      doc.rect(leftX + labelW, curY, leftW - labelW + 20, rowH, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(33, 37, 41);
      doc.text(f.label, leftX + 2, curY + rowH / 2, { baseline: "middle" });

      doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
      doc.setFontSize(7);
      doc.text(f.val, leftX + labelW + 2, curY + rowH / 2, { baseline: "middle" });
    });

    // 4. Cuadro derecho resumen de contadores del supervisor
    const rightW = 135;
    const rightX = pageWidth - MARGIN_X - rightW;
    const rightY = 28;
    const rightH = rowH * 3;

    doc.setFillColor(248, 250, 252);
    doc.rect(rightX, rightY, rightW, rightH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(33, 37, 41);
    doc.text("Resumen de Novedades del Supervisor en el Período:", rightX + 3, rightY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const metricasStr1 = `Justificaciones: ${sup.metricas.justificaciones}  |  Permisos Comerciantes: ${sup.metricas.permisos}  |  Obs. Generales: ${sup.metricas.observacionesGenerales}`;
    const metricasStr2 = `Citaciones: ${sup.metricas.citaciones}  |  Notificaciones: ${sup.metricas.notificaciones}  |  Días sin ingreso al sistema: ${sup.metricas.diasSinIngreso}`;
    doc.text(metricasStr1, rightX + 3, rightY + 9.5);
    doc.text(metricasStr2, rightX + 3, rightY + 13.5);

    // 5. Tabla Cronológica Detallada del Supervisor
    const headersDetalle = [
      [
        "FECHA",
        "NAVE",
        "PUESTO",
        "CONTRIBUYENTE",
        "TIPO DE NOVEDAD / EVENTO",
        "MOTIVO / DETALLE",
        "N° DOC / REF.",
        "TIEMPO / VIGENCIA / COBERTURA",
      ],
    ];

    const filasDetalle =
      sup.eventos.length > 0
        ? sup.eventos.map((ev: EventoDetalladoSupervisor) => [
            format(parseISO(ev.fecha), "dd/MM/yyyy"),
            ev.naveNombre,
            ev.puestoCodigo,
            ev.comercianteNombre,
            ev.tipoEvento,
            ev.motivo,
            ev.documentoRef,
            ev.vigenciaTexto,
          ])
        : [["—", "—", "—", "—", "Sin novedades registradas en el período", "—", "—", "—"]];

    autoTable(doc, {
      head: headersDetalle,
      body: filasDetalle,
      startY: 48,
      margin: { left: MARGIN_X, right: MARGIN_X },
      styles: { fontSize: 6.8, cellPadding: 1.8, textColor: [33, 37, 41] },
      headStyles: {
        fillColor: [69, 116, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 25 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 42 },
        4: { cellWidth: 36, fontStyle: "bold" },
        5: { cellWidth: 64 },
        6: { cellWidth: 26, halign: "center" },
        7: { cellWidth: 40 },
      },
    });
  });

  // ── Pie de página numerado en todas las páginas ─────────────────────────────
  const totalPages = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${p} de ${totalPages} — Reporte Consolidado y Detallado de Supervisores • EP-EMA`,
      pageWidth / 2,
      204,
      { align: "center" }
    );
  }

  doc.save(`reporte-supervisores-${fechaDesde}-a-${fechaHasta}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. EXPORTADOR A EXCEL MULTI-HOJA
// ═════════════════════════════════════════════════════════════════════════════

export async function exportarReporteSupervisoresExcel(
  data: ReporteSupervisoresData
): Promise<void> {
  const { resumenSupervisores, permisosSupervisoresPeriodo, detallesPorSupervisor, fechaDesde, fechaHasta } =
    data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EP-EMA Mercado Mayorista de Ambato";
  workbook.created = new Date();

  const logoBase64 = await cargarLogoBase64();
  let logoId: number | null = null;
  if (logoBase64) {
    try {
      logoId = workbook.addImage({ base64: logoBase64, extension: "png" });
    } catch {
      // Continuar si falla
    }
  }

  const { periodoUnificado } = calcularTextosPeriodo(fechaDesde, fechaHasta);
  const bordeFino: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCCCCCC" } },
    left: { style: "thin", color: { argb: "FFCCCCCC" } },
    bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    right: { style: "thin", color: { argb: "FFCCCCCC" } },
  };

  // ── HOJA 1: RESUMEN SUPERVISORES ────────────────────────────────────────────

  const wsResumen = workbook.addWorksheet("Resumen Supervisores");
  wsResumen.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
  };

  if (wsResumen.headerFooter) {
    wsResumen.headerFooter.oddFooter = "&CPágina &P de &N — Reporte de Supervisores EP-EMA";
  }

  if (logoId !== null) {
    wsResumen.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 56, height: 56 } });
  }

  // Encabezado institucional
  wsResumen.mergeCells("B1:I1");
  const c1 = wsResumen.getCell("B1");
  c1.value = "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO";
  c1.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF212529" } };
  c1.alignment = { vertical: "middle", horizontal: "center" };
  wsResumen.getRow(1).height = 20;

  wsResumen.mergeCells("B2:I2");
  const c2 = wsResumen.getCell("B2");
  c2.value = "REPORTE CONSOLIDADO Y DETALLADO DE SUPERVISORES — EP-EMA";
  c2.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF212529" } };
  c2.alignment = { vertical: "middle", horizontal: "center" };
  wsResumen.getRow(2).height = 16;

  wsResumen.getRow(3).height = 8;

  // Cuadro informativo
  const datosCuadroResumen = [
    { label: "Reporte:", val: "Resumen Consolidado y Cobertura Operativa" },
    { label: "Período:", val: periodoUnificado },
    { label: "Supervisores:", val: `${resumenSupervisores.length} registrado(s)` },
  ];

  datosCuadroResumen.forEach((d, idx) => {
    const fNum = 4 + idx;
    const cL = wsResumen.getCell(`B${fNum}`);
    const cV = wsResumen.getCell(`C${fNum}`);

    cL.value = d.label;
    cL.font = { name: "Arial", size: 9, bold: true };
    cL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
    cL.alignment = { vertical: "middle", horizontal: "left" };
    cL.border = bordeFino;

    cV.value = d.val;
    cV.font = { name: "Arial", size: 9, bold: idx === 0 };
    cV.alignment = { vertical: "middle", horizontal: "left" };
    cV.border = bordeFino;
    wsResumen.getRow(fNum).height = 17;
  });

  // Título Sección 1
  wsResumen.getCell("A8").value = "1. RESUMEN CONSOLIDADO DE GESTIÓN POR SUPERVISOR";
  wsResumen.getCell("A8").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF212529" } };
  wsResumen.getRow(8).height = 18;

  // Cabecera Tabla 1
  const headersT1 = [
    "#",
    "SUPERVISOR",
    "NAVES A CARGO",
    "JUSTIFICACIONES",
    "PERMISOS",
    "OBS. GENERALES",
    "CITACIONES",
    "NOTIFICACIONES",
    "DÍAS SIN INGRESO",
  ];

  const filaCabT1 = wsResumen.getRow(9);
  headersT1.forEach((h, idx) => {
    const cell = filaCabT1.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF45743B" } };
    cell.alignment = { vertical: "middle", horizontal: idx === 1 || idx === 2 ? "left" : "center" };
    cell.border = bordeFino;
  });
  filaCabT1.height = 22;

  // Filas Tabla 1
  let curRowT1 = 10;
  resumenSupervisores.forEach((s) => {
    const r = wsResumen.getRow(curRowT1);
    r.getCell(1).value = s.numero;
    r.getCell(2).value = s.supervisorNombre;
    r.getCell(3).value = s.navesACargo;
    r.getCell(4).value = s.justificaciones;
    r.getCell(5).value = s.permisos;
    r.getCell(6).value = s.observacionesGenerales;
    r.getCell(7).value = s.citaciones;
    r.getCell(8).value = s.notificaciones;
    r.getCell(9).value = s.diasSinIngreso;

    for (let c = 1; c <= 9; c++) {
      const cell = r.getCell(c);
      cell.font = { name: "Arial", size: 9, bold: c === 2 };
      cell.alignment = { vertical: "middle", horizontal: c === 2 || c === 3 ? "left" : "center" };
      cell.border = bordeFino;
    }
    r.height = 18;
    curRowT1++;
  });

  // Título Sección 2 (Permisos)
  const filaTitT2 = curRowT1 + 2;
  wsResumen.getCell(`A${filaTitT2}`).value = "2. REGISTRO DE PERMISOS DE SUPERVISORES Y COBERTURA APLICADA";
  wsResumen.getCell(`A${filaTitT2}`).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF212529" } };
  wsResumen.getRow(filaTitT2).height = 18;

  const headersT2 = [
    "SUPERVISOR",
    "VIGENCIA (DESDE - HASTA)",
    "MOTIVO",
    "NAVE",
    "ACCIÓN / COBERTURA APLICADA",
  ];

  const filaCabT2 = wsResumen.getRow(filaTitT2 + 1);
  headersT2.forEach((h, idx) => {
    const cell = filaCabT2.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF45743B" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = bordeFino;
  });
  filaCabT2.height = 22;

  let curRowT2 = filaTitT2 + 2;
  if (permisosSupervisoresPeriodo.length > 0) {
    permisosSupervisoresPeriodo.forEach((p) => {
      const r = wsResumen.getRow(curRowT2);
      r.getCell(1).value = p.supervisorNombre;
      r.getCell(2).value = p.vigenciaTexto;
      r.getCell(3).value = p.motivo;
      r.getCell(4).value = p.naveNombre;
      r.getCell(5).value = p.accionCobertura;

      for (let c = 1; c <= 5; c++) {
        const cell = r.getCell(c);
        cell.font = { name: "Arial", size: 9, bold: c === 1 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = bordeFino;
      }
      r.height = 18;
      curRowT2++;
    });
  } else {
    const r = wsResumen.getRow(curRowT2);
    wsResumen.mergeCells(`A${curRowT2}:E${curRowT2}`);
    r.getCell(1).value = "No se registraron permisos de supervisores en este período";
    r.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF777777" } };
    r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(1).border = bordeFino;
    r.height = 18;
  }

  // Ajuste de columnas en Hoja 1
  wsResumen.getColumn(1).width = 6;
  wsResumen.getColumn(2).width = 30;
  wsResumen.getColumn(3).width = 35;
  wsResumen.getColumn(4).width = 18;
  wsResumen.getColumn(5).width = 15;
  wsResumen.getColumn(6).width = 18;
  wsResumen.getColumn(7).width = 15;
  wsResumen.getColumn(8).width = 18;
  wsResumen.getColumn(9).width = 18;

  // ── HOJAS SIGUIENTES: 1 HOJA POR SUPERVISOR ─────────────────────────────────

  const nombresHojasSet = new Set<string>();
  nombresHojasSet.add("RESUMEN SUPERVISORES");

  detallesPorSupervisor.forEach((sup) => {
    // Sanitizar y garantizar nombre único de hoja (máx. 31 caracteres)
    const nombreLimpio = sup.supervisorNombre.replace(/[:\\/?*\[\]]/g, "_").trim();
    let tituloHoja = (nombreLimpio || "Supervisor").slice(0, 31);
    if (nombresHojasSet.has(tituloHoja.toUpperCase())) {
      let sufijo = 2;
      while (nombresHojasSet.has(tituloHoja.toUpperCase())) {
        const ext = ` (${sufijo})`;
        tituloHoja = `${nombreLimpio.slice(0, 31 - ext.length)}${ext}`;
        sufijo++;
      }
    }
    nombresHojasSet.add(tituloHoja.toUpperCase());

    const ws = workbook.addWorksheet(tituloHoja);
    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
    };

    if (ws.headerFooter) {
      ws.headerFooter.oddFooter = `&CPágina &P de &N — ${sup.supervisorNombre} • EP-EMA`;
    }

    if (logoId !== null) {
      ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 56, height: 56 } });
    }

    // Encabezado institucional
    ws.mergeCells("B1:H1");
    const h1 = ws.getCell("B1");
    h1.value = "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO";
    h1.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF212529" } };
    h1.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 20;

    ws.mergeCells("B2:H2");
    const h2 = ws.getCell("B2");
    h2.value = "DETALLE CRONOLÓGICO OPERATIVO POR SUPERVISOR — EP-EMA";
    h2.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF212529" } };
    h2.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(2).height = 16;

    ws.getRow(3).height = 8;

    // Cuadro izquierdo de datos
    const datosSup = [
      { label: "Supervisor:", val: sup.supervisorNombre, bold: true },
      { label: "Naves Asignadas:", val: sup.navesAsignadas, bold: false },
      { label: "Período:", val: periodoUnificado, bold: false },
    ];

    datosSup.forEach((d, idx) => {
      const fNum = 4 + idx;
      const cL = ws.getCell(`B${fNum}`);
      const cV = ws.getCell(`C${fNum}`);

      cL.value = d.label;
      cL.font = { name: "Arial", size: 9, bold: true };
      cL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
      cL.alignment = { vertical: "middle", horizontal: "left" };
      cL.border = bordeFino;

      cV.value = d.val;
      cV.font = { name: "Arial", size: 9, bold: d.bold };
      cV.alignment = { vertical: "middle", horizontal: "left" };
      cV.border = bordeFino;
      ws.getRow(fNum).height = 17;
    });

    // Cuadro derecho resumen de contadores
    ws.mergeCells("E4:H4");
    ws.getCell("E4").value = "Resumen de Novedades del Supervisor en el Período:";
    ws.getCell("E4").font = { name: "Arial", size: 9, bold: true, color: { argb: "FF212529" } };
    ws.getCell("E4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ws.getCell("E4").border = bordeFino;

    ws.mergeCells("E5:H5");
    ws.getCell("E5").value = `Justificaciones: ${sup.metricas.justificaciones}  |  Permisos Comerciantes: ${sup.metricas.permisos}  |  Obs. Generales: ${sup.metricas.observacionesGenerales}`;
    ws.getCell("E5").font = { name: "Arial", size: 8.5 };
    ws.getCell("E5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    ws.getCell("E5").border = bordeFino;

    ws.mergeCells("E6:H6");
    ws.getCell("E6").value = `Citaciones: ${sup.metricas.citaciones}  |  Notificaciones: ${sup.metricas.notificaciones}  |  Días sin ingreso al sistema: ${sup.metricas.diasSinIngreso}`;
    ws.getCell("E6").font = { name: "Arial", size: 8.5, bold: sup.metricas.diasSinIngreso > 0 };
    ws.getCell("E6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    ws.getCell("E6").border = bordeFino;

    ws.getRow(7).height = 12;

    // Tabla de Detalle Cronológico
    const headersDetalle = [
      "FECHA",
      "NAVE",
      "PUESTO",
      "CONTRIBUYENTE",
      "TIPO DE NOVEDAD / EVENTO",
      "MOTIVO / DETALLE",
      "N° DOC / REF.",
      "TIEMPO / VIGENCIA / COBERTURA",
    ];

    const filaCabDet = ws.getRow(8);
    headersDetalle.forEach((h, idx) => {
      const cell = filaCabDet.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF45743B" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: idx === 0 || idx === 2 || idx === 6 ? "center" : "left",
      };
      cell.border = bordeFino;
    });
    filaCabDet.height = 22;

    let rowNum = 9;
    if (sup.eventos.length > 0) {
      sup.eventos.forEach((ev: EventoDetalladoSupervisor) => {
        const r = ws.getRow(rowNum);
        r.getCell(1).value = format(parseISO(ev.fecha), "dd/MM/yyyy");
        r.getCell(2).value = ev.naveNombre;
        r.getCell(3).value = ev.puestoCodigo;
        r.getCell(4).value = ev.comercianteNombre;
        r.getCell(5).value = ev.tipoEvento;
        r.getCell(6).value = ev.motivo;
        r.getCell(7).value = ev.documentoRef;
        r.getCell(8).value = ev.vigenciaTexto;

        for (let c = 1; c <= 8; c++) {
          const cell = r.getCell(c);
          cell.font = { name: "Arial", size: 8.5, bold: c === 5, color: { argb: "FF212529" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: c === 1 || c === 3 || c === 7 ? "center" : "left",
          };
          cell.border = bordeFino;
        }
        r.height = 18;
        rowNum++;
      });
    } else {
      const r = ws.getRow(rowNum);
      ws.mergeCells(`A${rowNum}:H${rowNum}`);
      r.getCell(1).value = "Sin novedades registradas en el período";
      r.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF777777" } };
      r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(1).border = bordeFino;
      r.height = 18;
    }

    // Anchos de columna en hoja detallada
    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 30;
    ws.getColumn(5).width = 26;
    ws.getColumn(6).width = 45;
    ws.getColumn(7).width = 16;
    ws.getColumn(8).width = 32;
  });

  // Generar Buffer y Disparar Descarga
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reporte-supervisores-${fechaDesde}-a-${fechaHasta}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
