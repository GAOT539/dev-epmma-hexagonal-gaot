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
  name: "Calibri",
  size: 9,
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const colorEstadoExcel: Record<
  string,
  { bg: string; text: string }
> = {
  P:  { bg: "FFDCFCE7", text: "FF15803D" },
  A:  { bg: "FFFEE2E2", text: "FFB91C1C" },
  Pm: { bg: "FFF3E8FF", text: "FF7E22CE" },
  J:  { bg: "FFDBEAFE", text: "FF1D4ED8" },
  V:  { bg: "FFFEF3C7", text: "FFD97706" },
  "—":{ bg: "FFFFFBEB", text: "FF92400E" },
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

  const { periodoTexto, textoMes, anio } = calcularTextosPeriodo(fechaInicio, fechaFin);

  gruposNaves.forEach((grupo) => {
    // Nombre de la hoja sanitizado y truncado a 31 caracteres
    const nombreLimpio = grupo.nombre.replace(/[:\\/?*\[\]]/g, "_").trim();
    const tituloHoja = `${nombreLimpio} - ${textoMes}`.slice(0, 31);
    const ws = workbook.addWorksheet(tituloHoja);

    // 1. Configuración de Página para 1 Sola Hoja Horizontal
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,  // Ajustar ancho a 1 página
      fitToHeight: 0, // Altura libre según comerciantes
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
    };

    if (ws.headerFooter) {
      ws.headerFooter.oddFooter = "&CPágina &P de &N — Control de Asistencia EP-EMA";
    }

    const naveObj = navesDisponibles.find((n) => n.id === grupo.id || n.nombre === grupo.nombre);
    const supervisoresList = Array.isArray(naveObj?.supervisores)
      ? naveObj.supervisores.filter(Boolean)
      : [];
    const textoSupervisor =
      supervisoresList.length > 0 ? supervisoresList.join(", ") : "No existe supervisor a cargo";

    // 2. Fila 1: Título Central
    ws.mergeCells("B1:G1");
    const celdaTitulo = ws.getCell("B1");
    celdaTitulo.value = "EMPRESA PÚBLICA MUNICIPAL DEL MERCADO MAYORISTA DE AMBATO — CONTROL DE ASISTENCIA EP-EMA";
    celdaTitulo.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1B5E20" } };
    celdaTitulo.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 24;

    // 3. Cuadro Izquierdo (Datos de la Nave: Columnas B y C, Filas 2 a 6)
    const datosNave = [
      { label: "Nave", val: grupo.nombre },
      { label: "Periodo:", val: periodoTexto },
      { label: "Mes:", val: textoMes },
      { label: "Año:", val: anio },
      { label: "Supervisor:", val: textoSupervisor },
    ];

    datosNave.forEach((d, idx) => {
      const filaNum = 2 + idx;
      const celdaB = ws.getCell(`B${filaNum}`);
      const celdaC = ws.getCell(`C${filaNum}`);

      celdaB.value = d.label;
      celdaB.font = { name: "Calibri", size: 9, bold: true };
      celdaB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
      celdaB.alignment = { vertical: "middle", horizontal: "left" };
      celdaB.border = bordeFino;

      celdaC.value = d.val;
      celdaC.font = { name: "Calibri", size: 9, bold: idx === 0 };
      celdaC.alignment = { vertical: "middle", horizontal: "left" };
      celdaC.border = bordeFino;

      ws.getRow(filaNum).height = 18;
    });

    // 4. Cuadro Derecho de Descripción (Columnas H e I, Filas 1 a 6)
    ws.mergeCells("H1:I1");
    const celdaDescTitulo = ws.getCell("H1");
    celdaDescTitulo.value = "Descripción";
    celdaDescTitulo.font = { name: "Calibri", size: 10, bold: true };
    celdaDescTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFE9" } };
    celdaDescTitulo.alignment = { vertical: "middle", horizontal: "center" };
    celdaDescTitulo.border = bordeFino;
    ws.getCell("I1").border = bordeFino;

    const itemsDesc = [
      { code: "P", desc: "Presente", bg: "FF15803D" },
      { code: "A", desc: "Ausente", bg: "FFB91C1C" },
      { code: "Pm", desc: "Permiso", bg: "FF7E22CE" },
      { code: "J", desc: "Justifica", bg: "FF1D4ED8" },
      { code: "V", desc: "Vacante", bg: "FFD97706" },
    ];

    itemsDesc.forEach((it, idx) => {
      const filaNum = 2 + idx;
      const celdaH = ws.getCell(`H${filaNum}`);
      const celdaI = ws.getCell(`I${filaNum}`);

      celdaH.value = it.code;
      celdaH.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      celdaH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: it.bg } };
      celdaH.alignment = { vertical: "middle", horizontal: "center" };
      celdaH.border = bordeFino;

      celdaI.value = it.desc;
      celdaI.font = { name: "Calibri", size: 9 };
      celdaI.alignment = { vertical: "middle", horizontal: "left" };
      celdaI.border = bordeFino;
    });

    // 5. Encabezado de la Tabla de 2 Filas (Filas 8 y 9)
    ws.getRow(8).height = 18;
    ws.getRow(9).height = 18;

    // Columnas base combinadas verticalmente
    const columnasBase = [
      { col: 1, letra: "A", titulo: "#", width: 6 },
      { col: 2, letra: "B", titulo: "CÉDULA", width: 14 },
      { col: 3, letra: "C", titulo: "CONTRIBUYENTE", width: 34 },
      { col: 4, letra: "D", titulo: "PRODUCTO", width: 22 },
      { col: 5, letra: "E", titulo: "PUESTO", width: 10 },
    ];

    columnasBase.forEach((cb) => {
      ws.mergeCells(`${cb.letra}8:${cb.letra}9`);
      const c = ws.getCell(`${cb.letra}8`);
      c.value = cb.titulo;
      c.font = estiloFuenteHeader;
      c.fill = estiloFondoHeader;
      c.alignment = { vertical: "middle", horizontal: cb.col === 3 || cb.col === 4 ? "left" : "center" };
      c.border = bordeFino;
      ws.getCell(`${cb.letra}9`).border = bordeFino;
      ws.getColumn(cb.col).width = cb.width;
    });

    let colActual = 6;

    if (soloObservaciones) {
      ws.mergeCells("F8:F9");
      const cObs = ws.getCell("F8");
      cObs.value = "OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS";
      cObs.font = estiloFuenteHeader;
      cObs.fill = estiloFondoHeader;
      cObs.alignment = { vertical: "middle", horizontal: "left" };
      cObs.border = bordeFino;
      ws.getCell("F9").border = bordeFino;
      ws.getColumn(6).width = 50;
    } else {
      // Días (Fila 8 = Letra día, Fila 9 = Número día)
      fechas.forEach((f) => {
        const celdaDiaLetra = ws.getRow(8).getCell(colActual);
        celdaDiaLetra.value = obtenerInicialDiaSemana(f);
        celdaDiaLetra.font = estiloFuenteHeader;
        celdaDiaLetra.fill = estiloFondoHeader;
        celdaDiaLetra.alignment = { vertical: "middle", horizontal: "center" };
        celdaDiaLetra.border = bordeFino;

        const celdaDiaNum = ws.getRow(9).getCell(colActual);
        celdaDiaNum.value = parseInt(f.split("-")[2], 10);
        celdaDiaNum.font = estiloFuenteHeader;
        celdaDiaNum.fill = estiloFondoHeader;
        celdaDiaNum.alignment = { vertical: "middle", horizontal: "center" };
        celdaDiaNum.border = bordeFino;

        ws.getColumn(colActual).width = 4.8;
        colActual++;
      });

      // Columnas Resumen: P, A, Pm, J, V
      const resumenCols = ["P", "A", "Pm", "J", "V"];
      resumenCols.forEach((rc) => {
        const c8 = ws.getRow(8).getCell(colActual);
        c8.value = rc;
        c8.font = estiloFuenteHeader;
        c8.fill = estiloFondoHeader;
        c8.alignment = { vertical: "middle", horizontal: "center" };
        c8.border = bordeFino;

        const c9 = ws.getRow(9).getCell(colActual);
        c9.value = "Tot";
        c9.font = { name: "Calibri", size: 7.5, color: { argb: "FFFFFFFF" } };
        c9.fill = estiloFondoHeader;
        c9.alignment = { vertical: "middle", horizontal: "center" };
        c9.border = bordeFino;

        ws.getColumn(colActual).width = 5.2;
        colActual++;
      });

      if (incluirObservaciones) {
        const cObs8 = ws.getRow(8).getCell(colActual);
        const cObs9 = ws.getRow(9).getCell(colActual);
        cObs8.value = "OBSERVACIONES";
        cObs8.font = estiloFuenteHeader;
        cObs8.fill = estiloFondoHeader;
        cObs8.alignment = { vertical: "middle", horizontal: "left" };
        cObs8.border = bordeFino;
        cObs9.border = bordeFino;
        ws.getColumn(colActual).width = 36;
        colActual++;
      }
    }

    // 6. Filas de Datos (Desde fila 10 en adelante)
    const vacantes = grupo.items
      .filter((i) => i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const ocupados = grupo.items
      .filter((i) => !i.esVacante)
      .sort((a, b) => compararCodigosPuesto(a.puestoCode, b.puestoCode));
    const filasNave = [...vacantes, ...ocupados];

    let numFila = 10;

    filasNave.forEach((row, i) => {
      const fila = ws.getRow(numFila);
      fila.height = 18;

      // Columnas 1 a 5
      fila.getCell(1).value = i + 1;
      fila.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
      fila.getCell(1).border = bordeFino;

      fila.getCell(2).value = row.esVacante ? "-" : row.comerciante.cedula || "-";
      fila.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      fila.getCell(2).border = bordeFino;

      fila.getCell(3).value = row.esVacante ? "-" : row.comerciante.contribuyente || "-";
      fila.getCell(3).alignment = { vertical: "middle", horizontal: "left" };
      fila.getCell(3).font = { name: "Calibri", size: 8.5, bold: !row.esVacante };
      fila.getCell(3).border = bordeFino;

      fila.getCell(4).value = row.esVacante ? "-" : row.comerciante.actividad || "-";
      fila.getCell(4).alignment = { vertical: "middle", horizontal: "left" };
      fila.getCell(4).font = { name: "Calibri", size: 8.5 };
      fila.getCell(4).border = bordeFino;

      fila.getCell(5).value = row.puestoCode;
      fila.getCell(5).alignment = { vertical: "middle", horizontal: "center" };
      fila.getCell(5).font = { name: "Calibri", size: 9, bold: true };
      fila.getCell(5).border = bordeFino;

      if (soloObservaciones) {
        const celdaObs = fila.getCell(6);
        celdaObs.value = row.esVacante ? "—" : row.observaciones || "—";
        celdaObs.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        celdaObs.border = bordeFino;
        celdaObs.font = { name: "Calibri", size: 8 };
      } else {
        let col = 6;
        const conteos = { P: 0, A: 0, Pm: 0, J: 0, V: 0 };

        fechas.forEach((_, idxFecha) => {
          const estado = row.estados[idxFecha] ?? "—";
          const label = ESTADO_LABELS[estado] ?? estado;
          const celdaFecha = fila.getCell(col);
          celdaFecha.value = label;
          celdaFecha.border = bordeFino;
          celdaFecha.alignment = { vertical: "middle", horizontal: "center" };

          const cfg = colorEstadoExcel[label];
          if (cfg) {
            celdaFecha.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: cfg.bg },
            };
            celdaFecha.font = {
              name: "Calibri",
              size: 8.5,
              bold: true,
              color: { argb: cfg.text },
            };
          } else {
            celdaFecha.font = { name: "Calibri", size: 8.5 };
          }

          if (label === "P") conteos.P++;
          else if (label === "A") conteos.A++;
          else if (label === "Pm") conteos.Pm++;
          else if (label === "J") conteos.J++;
          else if (label === "V") conteos.V++;

          col++;
        });

        // Totales resumen P, A, Pm, J, V
        [conteos.P, conteos.A, conteos.Pm, conteos.J, conteos.V].forEach((cnt) => {
          const cRes = fila.getCell(col);
          cRes.value = cnt;
          cRes.alignment = { vertical: "middle", horizontal: "center" };
          cRes.font = { name: "Calibri", size: 8.5, bold: cnt > 0 };
          cRes.border = bordeFino;
          col++;
        });

        if (incluirObservaciones) {
          const cObs = fila.getCell(col);
          cObs.value = row.esVacante ? "—" : row.observaciones || "—";
          cObs.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          cObs.font = { name: "Calibri", size: 8 };
          cObs.border = bordeFino;
          col++;
        }
      }

      numFila++;
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
