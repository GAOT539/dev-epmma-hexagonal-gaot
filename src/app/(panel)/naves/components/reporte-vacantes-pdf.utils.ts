import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export interface ItemReporteVacante {
  id: string;
  naveId: string;
  ubicacionNave: string; // Ej. "G", "B", "C", "N" (sin la palabra NAVE)
  giroNegocio: string; // Ej. "TOMATE DE RIÑON", "CEBOLLA BLANCA"
  espacioComercializacion: string; // Ej. "PUESTO", "BODEGA", "CUBÍCULO", "NÚCLEO"
  numeroEspacioComercial: string; // Ej. "001", "163", "N-G-004A"
  areaM2: string; // Ej. "6", "8", "72", "18,30"
  enProcesoJudicial: boolean; // false = Vacante normal, true = En Proceso Judicial Contencioso Administrativo
}

export interface GenerarCertificacionVacantesPDFParams {
  itemsNormales: ItemReporteVacante[];
  itemsJudiciales: ItemReporteVacante[];
  tituloPeriodo: string; // Ej. "ESPACIOS PÚBLICOS VACANTES OCTUBRE 2026"
  textoIntroductorio?: string; // Default: "Por medio del presente tengo a bien certificar que los puestos detallados a continuación están vacantes:"
  elaboradoPorNombre: string;
  elaboradoPorCargo?: string; // Default: "SUPERVISOR DE OPERACIONES CONTROL Y ORDEN EP-EMA"
  revisadoPorNombre: string;
  revisadoPorCargo?: string; // Default: "DIRECTOR COMERCIAL OPERACIONES Y COMUNICACIÓN SOCIAL EP-EMA"
}

export async function generarCertificacionVacantesPDF({
  itemsNormales,
  itemsJudiciales,
  tituloPeriodo,
  textoIntroductorio = "Por medio del presente tengo a bien certificar que los puestos detallados a continuación están vacantes:",
  elaboradoPorNombre,
  elaboradoPorCargo = "SUPERVISOR DE OPERACIONES CONTROL Y ORDEN EP-EMA",
  revisadoPorNombre,
  revisadoPorCargo = "DIRECTOR COMERCIAL OPERACIONES Y COMUNICACIÓN SOCIAL EP-EMA",
}: GenerarCertificacionVacantesPDFParams): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width; // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm

  // 1. Encabezado Institucional: Carga del Logo
  try {
    const imgRes = await fetch("/logopdf.png");
    if (imgRes.ok) {
      const imgBlob = await imgRes.blob();
      const imgBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      doc.addImage(imgBase64, "PNG", 14, 10, 22, 22);
    }
  } catch {
    // Si no carga la imagen, continúa sin interrumpir la exportación
  }

  // Título principal centrado en negrita (fontSize: 13)
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
    pageWidth / 2,
    16,
    { align: "center" }
  );

  // Subtítulo principal centrado en negrita (fontSize: 12)
  doc.setFontSize(12);
  doc.text(
    "CERTIFICACIÓN DE ESPACIOS PÚBLICOS VACANTES",
    pageWidth / 2,
    28,
    { align: "center" }
  );

  // Párrafo de certificación centrado debajo del título (fontSize: 9.5, normal)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.text(textoIntroductorio, pageWidth / 2, 36, { align: "center" });

  // 2. Estructura de la Tabla con autoTable
  // Cabecera de 2 niveles
  const head: RowInput[] = [
    [
      {
        content: (tituloPeriodo || "ESPACIOS PÚBLICOS VACANTES").toUpperCase(),
        colSpan: 6,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fillColor: [230, 239, 233],
          textColor: [17, 24, 39],
          fontSize: 9.5,
          lineColor: [30, 30, 30],
          lineWidth: 0.25,
        },
      },
    ],
    [
      { content: "#", styles: { halign: "center" } },
      { content: "UBICACIÓN -\nNAVE", styles: { halign: "center" } },
      { content: "SECCIÓN - GIRO DE NEGOCIO", styles: { halign: "center" } },
      { content: "ESPACIOS DE\nCOMERCIALIZACIÓN", styles: { halign: "center" } },
      { content: "NÚMERO DE\nESPACIO\nCOMERCIAL", styles: { halign: "center" } },
      { content: "ÁREA\nM2", styles: { halign: "center" } },
    ],
  ];

  // Cuerpo de la tabla
  const body: RowInput[] = [];

  // Filas normales (1 .. itemsNormales.length)
  itemsNormales.forEach((item, index) => {
    body.push([
      String(index + 1),
      item.ubicacionNave,
      item.giroNegocio,
      item.espacioComercializacion,
      item.numeroEspacioComercial,
      item.areaM2,
    ]);
  });

  // Apartado Condicional "EN PROCESO JUDICIAL CONTENCIOSO ADMINISTRATIVO:"
  if (itemsJudiciales.length > 0) {
    body.push([
      {
        content: "EN PROCESO JUDICIAL CONTENCIOSO ADMINISTRATIVO:",
        colSpan: 6,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fillColor: [243, 244, 246],
          textColor: [17, 24, 39],
          fontSize: 9,
          lineColor: [30, 30, 30],
          lineWidth: 0.25,
        },
      },
    ]);

    itemsJudiciales.forEach((item, index) => {
      const numSecuencial = itemsNormales.length + index + 1;
      body.push([
        String(numSecuencial),
        item.ubicacionNave,
        item.giroNegocio,
        item.espacioComercializacion,
        item.numeroEspacioComercial,
        item.areaM2,
      ]);
    });
  }

  // Generar tabla con autoTable
  autoTable(doc, {
    head,
    body,
    startY: 41,
    theme: "grid",
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      lineColor: [30, 30, 30],
      lineWidth: 0.25,
      fontSize: 8.5,
      cellPadding: 2,
      textColor: [20, 20, 20],
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 242, 245],
      textColor: [17, 24, 39],
      fontStyle: "bold",
      halign: "center",
      lineColor: [30, 30, 30],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 26 },
      2: { halign: "left", cellWidth: 70 }, // SECCIÓN - GIRO DE NEGOCIO alineado limpio a la izquierda
      3: { halign: "center", cellWidth: 38 },
      4: { halign: "center", cellWidth: 24 },
      5: { halign: "center", cellWidth: 14 },
    },
  });

  // 3. Bloque Inferior de Firmas
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  let firmaY = finalY + 28;

  // Si no cabe el bloque de firmas completo en la hoja actual, pasar a una nueva página
  if (firmaY + 25 > pageHeight - 18) {
    doc.addPage();
    firmaY = 40;
  }

  // Configuración de trazo para firmas
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);

  // Columna Izquierda: Elaborado Por (xCenterIzq = 58)
  const xCenterIzq = 58;
  doc.line(20, firmaY, 96, firmaY);

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(elaboradoPorNombre || "SUPERVISOR DE OPERACIONES", xCenterIzq, firmaY + 5, {
    align: "center",
  });

  doc.setFontSize(7.5);
  doc.text(elaboradoPorCargo, xCenterIzq, firmaY + 9.5, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Elaborado Por:", 20, firmaY + 14);

  // Columna Derecha: Revisado Por (xCenterDer = 152)
  const xCenterDer = 152;
  doc.line(112, firmaY, 192, firmaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(revisadoPorNombre || "DIRECTOR COMERCIAL", xCenterDer, firmaY + 5, {
    align: "center",
  });

  doc.setFontSize(7.5);
  doc.text(revisadoPorCargo, xCenterDer, firmaY + 9.5, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Revisado Por:", 112, firmaY + 14);

  // 4. Pie de Página con Numeración de Páginas en Todas las Hojas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Página ${p} de ${totalPages} — Certificación de Espacios Públicos Vacantes • EP-EMA`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  // 5. Descargar el archivo PDF
  const nombreLimpioPeriodo = (tituloPeriodo || "vacantes")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  doc.save(`certificacion-espacios-vacantes-${nombreLimpioPeriodo}.pdf`);
}
