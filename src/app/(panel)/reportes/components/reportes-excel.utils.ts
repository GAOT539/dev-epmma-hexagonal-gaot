import ExcelJS from "exceljs";
import {
  type ExportarReportePDFParams,
  type ReporteItem,
  compararCodigosPuesto,
  calcularTextosPeriodo,
  obtenerInicialDiaSemana,
  ESTADO_LABELS,
} from "./reportes-pdf.utils";

// ── Bordes y Estilos Comunes de Excel ───────────────────────────────────────

const bordeFino: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0BEC5" } },
  left: { style: "thin", color: { argb: "FFB0BEC5" } },
  bottom: { style: "thin", color: { argb: "FFB0BEC5" } },
  right: { style: "thin", color: { argb: "FFB0BEC5" } },
};

const estiloFondoHeader: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF337533" }, // Verde institucional
};

const estiloFuenteHeader: Partial<ExcelJS.Font> = {
  name: "Arial",
  size: 9,
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const colorEstadoExcel: Record<
  string,
  { bg: string; text: string }
> = {
  P:   { bg: "FFDCFCE7", text: "FF15803D" },
  A:   { bg: "FFFEE2E2", text: "FFB91C1C" },
  Pm:  { bg: "FFF3E8FF", text: "FF7E22CE" },
  J:   { bg: "FFDBEAFE", text: "FF1D4ED8" },
  V:   { bg: "FFFEF3C7", text: "FFD97706" },
  "—": { bg: "FFFFFBEB", text: "FF92400E" },
};

// ── Exportador Excel Principal ──────────────────────────────────────────────

export async function exportarReporteAsistenciaExcel({
  reporteFiltrado,
  fechas,
  fechaInicio,
  fechaFin,
  soloObservaciones,
  incluirObservaciones,
  navesDisponibles = [],
}: ExportarReportePDFParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EP-EMA Mercado Mayorista de Ambato";
  workbook.created = new Date();

  // Cargar logo institucional una sola vez para todas las hojas
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

  let logoId: number | null = null;
  if (logoBase64) {
    try {
      logoId = workbook.addImage({ base64: logoBase64, extension: "png" });
    } catch {
      // Continuar si falla el registro de la imagen
    }
  }

  // Agrupar filas por Nave usando clave normalizada en mayúsculas
  const navesMap = new Map<string, { id: string; nombre: string; items: ReporteItem[] }>();
  reporteFiltrado.forEach((item) => {
    const keyNave = (item.naveNombre || item.naveId || "NAVE").trim().toUpperCase();
    const existing = navesMap.get(keyNave);
    if (existing) {
      existing.items.push(item);
    } else {
      navesMap.set(keyNave, {
        id: item.naveId || keyNave.toLowerCase(),
        nombre: item.naveNombre || "Nave",
        items: [item],
      });
    }
  });

  const gruposNaves = Array.from(navesMap.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: "base" })
  );

  const { periodoUnificado } = calcularTextosPeriodo(fechaInicio, fechaFin);
  const nombresHojaUsados = new Set<string>();

  gruposNaves.forEach((grupo) => {
    // Nombre de la hoja sanitizado, truncado a 31 caracteres y con garantía 100% de unicidad
    const nombreLimpio = grupo.nombre.replace(/[:\\/?*\[\]]/g, "_").trim();
    let tituloHoja = (nombreLimpio || "Nave").slice(0, 31);
    if (nombresHojaUsados.has(tituloHoja.toUpperCase())) {
      let sufijoNum = 2;
      while (nombresHojaUsados.has(tituloHoja.toUpperCase())) {
        const sufijo = ` (${sufijoNum})`;
        tituloHoja = `${nombreLimpio.slice(0, 31 - sufijo.length)}${sufijo}`;
        sufijoNum++;
      }
    }
    nombresHojaUsados.add(tituloHoja.toUpperCase());
    const ws = workbook.addWorksheet(tituloHoja);

    // 1. Configuración de Página para Impresión en 1 Sola Hoja Horizontal
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,  // Ancho ajustado a 1 página
      fitToHeight: 0, // Altura libre
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
    };

    if (ws.headerFooter) {
      ws.headerFooter.oddFooter = "&CPágina &P de &N — Control de Asistencia EP-EMA";
    }

    // Incrustar Logo en la esquina superior izquierda (filas 1 a 3)
    if (logoId !== null) {
      ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 58, height: 58 } });
    }

    const naveObj = navesDisponibles.find((n) => n.id === grupo.id || n.nombre === grupo.nombre);
    const supervisoresList = Array.isArray(naveObj?.supervisores)
      ? naveObj.supervisores.filter(Boolean)
      : [];
    const textoSupervisor =
      supervisoresList.length > 0 ? supervisoresList.join(", ") : "No existe supervisor a cargo";

    // Cálculo dinámico de ancho de columna Puesto
    const maxLenPuesto = grupo.items.reduce(
      (max, item) => Math.max(max, (item.puestoCode || "").length),
      0
    );
    const anchoPuesto = Math.max(16, maxLenPuesto + 4);

    const totalCols = soloObservaciones
      ? 6
      : 5 + fechas.length + (incluirObservaciones ? 1 : 0);
    const maxColHeader = Math.max(totalCols, 9);

    // 2. Encabezado Institucional
    // Fila 1: B1 combinada hasta la última columna de la tabla
    ws.mergeCells(1, 2, 1, maxColHeader);
    const celdaTitulo = ws.getCell("B1");
    celdaTitulo.value = "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO";
    celdaTitulo.font = { name: "Arial", size: 13, bold: true, color: { argb: "FF212529" } };
    celdaTitulo.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 20;

    // Fila 2: B2 combinada hasta la última columna de la tabla
    ws.mergeCells(2, 2, 2, maxColHeader);
    const celdaSubtitulo = ws.getCell("B2");
    celdaSubtitulo.value = soloObservaciones
      ? "REPORTE DE OBSERVACIONES Y NOVEDADES POR NAVE"
      : "CONTROL DE ASISTENCIA EP-EMA";
    celdaSubtitulo.font = { name: "Arial", size: 10.5, bold: true, color: { argb: "FF212529" } };
    celdaSubtitulo.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(2).height = 16;

    // Fila 3: Fila separadora limpia
    ws.getRow(3).height = 8;

    // 3. Cuadro Izquierdo Unificado (Columnas B y C, Filas 4 a 6)
    const datosIzq = [
      { label: "Nave:", val: grupo.nombre, boldVal: true },
      { label: "Período:", val: periodoUnificado, boldVal: false },
      { label: "Supervisor:", val: textoSupervisor, boldVal: false },
    ];

    datosIzq.forEach((d, idx) => {
      const filaNum = 4 + idx;
      const cLabel = ws.getCell(`B${filaNum}`);
      const cVal = ws.getCell(`C${filaNum}`);

      cLabel.value = d.label;
      cLabel.font = { name: "Arial", size: 9, bold: true };
      cLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
      cLabel.alignment = { vertical: "middle", horizontal: "left" };
      cLabel.border = bordeFino;

      cVal.value = d.val;
      cVal.font = { name: "Arial", size: 9, bold: d.boldVal };
      cVal.alignment = { vertical: "middle", horizontal: "left" };
      cVal.border = bordeFino;

      ws.getRow(filaNum).height = 17;
    });
    ws.getRow(7).height = 16;

    // 4. Cuadro Derecho de Descripción (2 columnas dobles en Filas 4 a 7)
    let b1Col: number;
    let d1StartCol: number;
    let d1EndCol: number;
    let b2Col: number;
    let d2StartCol: number;
    let d2EndCol: number;

    if (!soloObservaciones && fechas.length >= 6) {
      const baseDateEnd = 5 + fechas.length;
      const cStart = baseDateEnd - 5;
      b1Col = cStart;
      d1StartCol = cStart + 1;
      d1EndCol = cStart + 2;
      b2Col = cStart + 3;
      d2StartCol = cStart + 4;
      d2EndCol = cStart + 5;
    } else {
      const cStart = soloObservaciones ? 6 : Math.max(6, totalCols - 3);
      b1Col = cStart;
      d1StartCol = cStart + 1;
      d1EndCol = cStart + 1;
      b2Col = cStart + 2;
      d2StartCol = cStart + 3;
      d2EndCol = cStart + 3;
      ws.getColumn(b1Col).width = 4.8;
      ws.getColumn(d1StartCol).width = 11;
      ws.getColumn(b2Col).width = 4.8;
      ws.getColumn(d2StartCol).width = 11;
    }

    // Cabecera combinada "Descripción" en Fila 4
    ws.mergeCells(4, b1Col, 4, d2EndCol);
    const cDescTitulo = ws.getRow(4).getCell(b1Col);
    cDescTitulo.value = "Descripción";
    cDescTitulo.font = { name: "Arial", size: 9, bold: true };
    cDescTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
    cDescTitulo.alignment = { vertical: "middle", horizontal: "center" };
    for (let col = b1Col; col <= d2EndCol; col++) {
      ws.getRow(4).getCell(col).border = bordeFino;
    }

    const itemsFila5 = [
      { colBadge: b1Col, dStart: d1StartCol, dEnd: d1EndCol, code: "P", desc: "Presente", bg: "FF15803D" },
      { colBadge: b2Col, dStart: d2StartCol, dEnd: d2EndCol, code: "J", desc: "Justifica", bg: "FF1D4ED8" },
    ];
    const itemsFila6 = [
      { colBadge: b1Col, dStart: d1StartCol, dEnd: d1EndCol, code: "A", desc: "Ausente", bg: "FFB91C1C" },
      { colBadge: b2Col, dStart: d2StartCol, dEnd: d2EndCol, code: "V", desc: "Vacante", bg: "FFD97706" },
    ];
    const itemsFila7 = [
      { colBadge: b1Col, dStart: d1StartCol, dEnd: d1EndCol, code: "Pm", desc: "Permiso", bg: "FF7E22CE" },
    ];

    const renderFilaDesc = (
      filaNum: number,
      items: Array<{ colBadge: number; dStart: number; dEnd: number; code: string; desc: string; bg: string }>
    ) => {
      items.forEach((it) => {
        const cBadge = ws.getRow(filaNum).getCell(it.colBadge);
        cBadge.value = it.code;
        cBadge.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
        cBadge.fill = { type: "pattern", pattern: "solid", fgColor: { argb: it.bg } };
        cBadge.alignment = { vertical: "middle", horizontal: "center" };
        cBadge.border = bordeFino;

        if (it.dStart !== it.dEnd) {
          ws.mergeCells(filaNum, it.dStart, filaNum, it.dEnd);
        }
        const cDesc = ws.getRow(filaNum).getCell(it.dStart);
        cDesc.value = it.desc;
        cDesc.font = { name: "Arial", size: 8.5 };
        cDesc.alignment = { vertical: "middle", horizontal: "left" };
        for (let col = it.dStart; col <= it.dEnd; col++) {
          ws.getRow(filaNum).getCell(col).border = bordeFino;
        }
      });
    };

    renderFilaDesc(5, itemsFila5);
    renderFilaDesc(6, itemsFila6);
    renderFilaDesc(7, itemsFila7);

    // En Fila 7, celda derecha vacía con bordes finos
    if (b2Col !== d2EndCol) {
      ws.mergeCells(7, b2Col, 7, d2EndCol);
    }
    for (let col = b2Col; col <= d2EndCol; col++) {
      ws.getRow(7).getCell(col).border = bordeFino;
    }

    // Fila 8 separadora
    ws.getRow(8).height = 8;

    // 5. Encabezado de la Tabla Principal (Filas 9 y 10)
    ws.getRow(9).height = 18;
    ws.getRow(10).height = 18;

    const columnasBase = [
      { col: 1, letra: "A", titulo: "#", width: 6, align: "center" as const },
      { col: 2, letra: "B", titulo: "CÉDULA", width: 15, align: "center" as const },
      { col: 3, letra: "C", titulo: "CONTRIBUYENTE", width: 35, align: "left" as const },
      { col: 4, letra: "D", titulo: "PRODUCTO", width: 24, align: "left" as const },
      { col: 5, letra: "E", titulo: "PUESTO", width: anchoPuesto, align: "center" as const },
    ];

    columnasBase.forEach((cb) => {
      ws.mergeCells(`${cb.letra}9:${cb.letra}10`);
      const c = ws.getCell(`${cb.letra}9`);
      c.value = cb.titulo;
      c.font = estiloFuenteHeader;
      c.fill = estiloFondoHeader;
      c.alignment = { vertical: "middle", horizontal: cb.align };
      c.border = bordeFino;
      ws.getCell(`${cb.letra}10`).border = bordeFino;
      ws.getColumn(cb.col).width = cb.width;
    });

    let colActual = 6;
    let colObs = 6;

    if (soloObservaciones) {
      ws.mergeCells("F9:F10");
      const cObs = ws.getCell("F9");
      cObs.value = "OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS";
      cObs.font = estiloFuenteHeader;
      cObs.fill = estiloFondoHeader;
      cObs.alignment = { vertical: "middle", horizontal: "left" };
      cObs.border = bordeFino;
      ws.getCell("F10").border = bordeFino;
      ws.getColumn(6).width = 65;
      colObs = 6;
    } else {
      fechas.forEach((f) => {
        const celdaDiaLetra = ws.getRow(9).getCell(colActual);
        celdaDiaLetra.value = obtenerInicialDiaSemana(f);
        celdaDiaLetra.font = estiloFuenteHeader;
        celdaDiaLetra.fill = estiloFondoHeader;
        celdaDiaLetra.alignment = { vertical: "middle", horizontal: "center" };
        celdaDiaLetra.border = bordeFino;

        const celdaDiaNum = ws.getRow(10).getCell(colActual);
        celdaDiaNum.value = parseInt(f.split("-")[2], 10);
        celdaDiaNum.font = estiloFuenteHeader;
        celdaDiaNum.fill = estiloFondoHeader;
        celdaDiaNum.alignment = { vertical: "middle", horizontal: "center" };
        celdaDiaNum.border = bordeFino;

        ws.getColumn(colActual).width = 4.8;
        colActual++;
      });

      // SIN columnas resumen Tot
      if (incluirObservaciones) {
        colObs = colActual;
        ws.mergeCells(9, colObs, 10, colObs);
        const cObs = ws.getRow(9).getCell(colObs);
        cObs.value = "OBSERVACIONES";
        cObs.font = estiloFuenteHeader;
        cObs.fill = estiloFondoHeader;
        cObs.alignment = { vertical: "middle", horizontal: "left" };
        cObs.border = bordeFino;
        ws.getRow(10).getCell(colObs).border = bordeFino;
        ws.getColumn(colObs).width = 48;
      }
    }

    // 6. Filas de Datos (Desde fila 11 en adelante con Crecimiento Dinámico Multi-Fila)
    const vacantes = grupo.items
      .filter((i) => i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const ocupados = grupo.items
      .filter((i) => !i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const filasNave = [...vacantes, ...ocupados];

    let numFila = 11;

    filasNave.forEach((row, i) => {
      const lineasObs =
        !row.esVacante && (soloObservaciones || incluirObservaciones) && row.observaciones
          ? row.observaciones
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const cantFilas = Math.max(1, lineasObs.length);
      const filaInicio = numFila;
      const filaFin = numFila + cantFilas - 1;

      // 1. Columnas Fijas (1 a 5)
      const colValores: Array<{ val: string | number; align: "center" | "left"; fontBold: boolean }> = [
        { val: i + 1, align: "center", fontBold: false },
        { val: row.esVacante ? "-" : row.comerciante.cedula || "-", align: "center", fontBold: false },
        {
          val: row.esVacante ? "-" : row.comerciante.contribuyente || "-",
          align: "left",
          fontBold: !row.esVacante,
        },
        { val: row.esVacante ? "-" : row.comerciante.actividad || "-", align: "left", fontBold: false },
        { val: row.puestoCode, align: "center", fontBold: true },
      ];

      colValores.forEach((cv, idx) => {
        const colIdx = idx + 1;
        if (cantFilas > 1) {
          ws.mergeCells(filaInicio, colIdx, filaFin, colIdx);
        }
        const cell = ws.getRow(filaInicio).getCell(colIdx);
        cell.value = cv.val;
        cell.alignment = { vertical: "middle", horizontal: cv.align };
        cell.font = { name: "Arial", size: 8.5, bold: cv.fontBold };
        for (let f = filaInicio; f <= filaFin; f++) {
          ws.getRow(f).getCell(colIdx).border = bordeFino;
        }
      });

      // 2. Columnas de Fechas (si !soloObservaciones)
      if (!soloObservaciones) {
        fechas.forEach((_, idxFecha) => {
          const colIdx = 6 + idxFecha;
          if (cantFilas > 1) {
            ws.mergeCells(filaInicio, colIdx, filaFin, colIdx);
          }

          const estado = row.estados[idxFecha] ?? "—";
          const label = ESTADO_LABELS[estado] ?? estado;
          const cfg = colorEstadoExcel[label];

          const cell = ws.getRow(filaInicio).getCell(colIdx);
          cell.value = label;
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (cfg) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: cfg.bg },
            };
            cell.font = {
              name: "Arial",
              size: 8.5,
              bold: true,
              color: { argb: cfg.text },
            };
          } else {
            cell.font = { name: "Arial", size: 8.5 };
          }

          for (let f = filaInicio; f <= filaFin; f++) {
            ws.getRow(f).getCell(colIdx).border = bordeFino;
          }
        });
      }

      // 3. Columna de Observaciones (1 celda individual por cada observación)
      if (soloObservaciones || incluirObservaciones) {
        if (cantFilas > 1) {
          for (let k = 0; k < cantFilas; k++) {
            const fActual = filaInicio + k;
            const rActual = ws.getRow(fActual);
            const celdaObs = rActual.getCell(colObs);
            celdaObs.value = lineasObs[k];
            celdaObs.font = { name: "Arial", size: 8 };
            celdaObs.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
            celdaObs.border = bordeFino;
            rActual.height = Math.max(19, Math.ceil(lineasObs[k].length / 55) * 14);
          }
        } else {
          const rActual = ws.getRow(filaInicio);
          const celdaObs = rActual.getCell(colObs);
          const texto = row.esVacante ? "—" : lineasObs[0] || "—";
          celdaObs.value = texto;
          celdaObs.font = { name: "Arial", size: 8 };
          celdaObs.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          celdaObs.border = bordeFino;
          rActual.height =
            texto && texto !== "—" ? Math.max(19, Math.ceil(texto.length / 55) * 14) : 19;
        }
      } else {
        ws.getRow(filaInicio).height = 19;
      }

      numFila = filaFin + 1;
    });
  });

  // Generar Buffer y Disparar Descarga en el Navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    soloObservaciones ? "reporte-observaciones-novedades" : "reporte-asistencia"
  }-${fechaInicio}-a-${fechaFin}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
