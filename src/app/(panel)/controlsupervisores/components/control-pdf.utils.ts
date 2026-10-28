// ── Generación de Reportes PDF: Control de Supervisores (Diseño Institucional EP-EMA) ──

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SesionControlSupervisor } from "@/domain/models/auditoria.model";

export interface ExportarControlSupervisoresGeneralPDFParams {
  sesiones: SesionControlSupervisor[];
  fechaDesdeStr: string;
  fechaHastaStr: string;
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
// 1. GENERACIÓN DE PDF GENERAL CON ESTILO INSTITUCIONAL
// ═════════════════════════════════════════════════════════════════════════════

export async function exportarControlSupervisoresGeneralPDF({
  sesiones,
  fechaDesdeStr,
  fechaHastaStr,
}: ExportarControlSupervisoresGeneralPDFParams): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const logoBase64 = await cargarLogoBase64();
  const { periodoUnificado } = calcularTextosPeriodo(fechaDesdeStr, fechaHastaStr);

  // 1. Logo institucional (x=14, y=6, w=19, h=19)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", 14, 6, 19, 19);
    } catch {
      // Continúa si falla
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
    "REPORTE GENERAL DE CONTROL DE SUPERVISORES — EP-EMA",
    pageWidth / 2,
    18.5,
    { align: "center" }
  );

  // 3. Cuadro superior de información (x=14, y=28, w=110mm)
  const leftX = 14;
  const leftY = 28;
  const leftW = 110;
  const rowH = 5.2;
  const labelW = 28;

  const filasEncabezado = [
    { label: "Reporte:", val: "Control y Monitoreo de Toma de Listas" },
    { label: "Período:", val: periodoUnificado },
    { label: "Sesiones:", val: `${sesiones.length} jornada(s) registradas` },
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

  // 4. Encabezados de tabla (sin Inicio Toma)
  const headers = [
    [
      "Fecha Lista",
      "Supervisor",
      "Nave",
      "Acción",
      "Estado / Anotaciones",
      "Puestos / Asistencia",
    ],
  ];

  const data = sesiones.map((s) => {
    const anotacionesList: string[] = [];

    if (s.sinIngreso || s.etiquetas.includes("SIN_INGRESO")) {
      anotacionesList.push("No ingresó al sistema");
    }

    if (s.permisoSupervisorInfo) {
      const cov =
        s.permisoSupervisorInfo.tipoCobertura === "REEMPLAZO_TEMPORAL"
          ? `A cargo: ${s.permisoSupervisorInfo.supervisorReemplazoNombre || "Reemplazo"}`
          : "Persistencia Automática";
      anotacionesList.push(`Permiso Supervisor (${cov})`);
    }

    s.etiquetas.forEach((e) => {
      if (e === "CON_PERSISTENCIA") anotacionesList.push("Con Persistencia");
      if (e === "MODIFICADO_TRAS_PERSISTENCIA") anotacionesList.push("Modif. tras persistencia");
      if (e === "CON_RETRASO") anotacionesList.push("Con Retraso");
      if (e === "EN_FECHA" && !s.sinIngreso) anotacionesList.push("En Fecha");
    });

    const anotacionesStr = anotacionesList.length > 0 ? anotacionesList.join(" • ") : "—";

    const puestosAsistenciaStr = [
      `Total puestos: ${s.resumen.totalOcupados}`,
      `Asistencias: ${s.resumen.presentes}`,
      `Ausencias: ${s.resumen.ausentes}`,
      `Permisos: ${s.resumen.permisos}`,
      (s.resumen.justificados ?? 0) > 0 ? `Justificados: ${s.resumen.justificados}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return [
      format(new Date(s.fechaJornada + "T00:00:00"), "dd/MM/yyyy"),
      s.supervisorNombre,
      s.naveNombre,
      s.accion,
      anotacionesStr,
      puestosAsistenciaStr,
    ];
  });

  autoTable(doc, {
    head: headers,
    body: data,
    startY: 48,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: [33, 37, 41] },
    headStyles: {
      fillColor: [69, 116, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 50, fontStyle: "bold" },
      2: { cellWidth: 32 },
      3: { cellWidth: 44 },
      4: { cellWidth: 80 },
      5: { cellWidth: 49 },
    },
  });

  // 5. Pie de página numerado
  const totalPages = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${p} de ${totalPages} — Control de Supervisores • EP-EMA`,
      pageWidth / 2,
      204,
      { align: "center" }
    );
  }

  doc.save(`control-supervisores-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. GENERACIÓN DE PDF INDIVIDUAL DE SESIÓN CON DETALLE DE NOVEDADES
// ═════════════════════════════════════════════════════════════════════════════

export async function exportarControlSupervisorIndividualPDF(
  sesion: SesionControlSupervisor
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const logoBase64 = await cargarLogoBase64();

  // 1. Logo institucional
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", 14, 6, 19, 19);
    } catch {
      // Continúa
    }
  }

  // 2. Encabezado institucional
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
    "DETALLE INDIVIDUAL DE CONTROL DE TOMA DE LISTA — EP-EMA",
    pageWidth / 2,
    18.5,
    { align: "center" }
  );

  // 3. Cuadro superior descriptivo
  const leftX = 14;
  const leftY = 28;
  const leftW = 95;
  const rowH = 5.2;
  const labelW = 28;

  const filasIzq = [
    { label: "Nave:", val: sesion.naveNombre },
    {
      label: "Jornada:",
      val: format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy"),
    },
    { label: "Supervisor:", val: sesion.supervisorNombre },
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
    doc.text(f.label, leftX + 2, curY + rowH / 2, { baseline: "middle" });

    doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
    doc.setFontSize(7);
    doc.text(f.val, leftX + labelW + 2, curY + rowH / 2, { baseline: "middle" });
  });

  // Cuadro derecho resumen de asistencia
  const rightX = pageWidth - 95;
  const rightY = 28;
  const rightW = 85;

  doc.setFillColor(248, 250, 252);
  doc.rect(rightX, rightY, rightW, rowH * 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(33, 37, 41);
  doc.text(
    `Total Puestos Ocupados: ${sesion.resumen.totalOcupados}`,
    rightX + 3,
    rightY + 4.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    `Presentes: ${sesion.resumen.presentes}  |  Ausentes: ${sesion.resumen.ausentes}  |  Permisos: ${sesion.resumen.permisos}`,
    rightX + 3,
    rightY + 9.5
  );
  if ((sesion.resumen.justificados ?? 0) > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(29, 78, 216);
    doc.text(`Faltas Justificadas: ${sesion.resumen.justificados}`, rightX + 3, rightY + 13.5);
  }

  let startY = 48;

  if (sesion.esPersistencia) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text(
      `Registro con Persistencia: Arrastrado desde ${sesion.fechaOrigenPersistencia || "jornada previa"}. Justificación: "${sesion.comentarioPersistencia || "Automático"}"`,
      14,
      startY
    );
    startY += 5;
  }

  if (sesion.tieneRetraso) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(194, 65, 12);
    doc.text(
      `Registro con Retraso: ${sesion.detalleRetraso || "Registrado manualmente con posterioridad."}`,
      14,
      startY
    );
    startY += 5;
  }

  // 4. Tabla de Comerciantes con columna "Detalle de Permisos / Justificaciones / Observaciones"
  const headers = [
    [
      "Puesto",
      "CIU",
      "Cédula",
      "Contribuyente",
      "Estado",
      "Detalle de Permisos / Justificaciones / Observaciones",
      "Hora",
    ],
  ];

  const data = sesion.detallesComerciantes.map((d) => {
    let detalleNovedades = "—";
    if (d.novedades && d.novedades.length > 0) {
      detalleNovedades = d.novedades
        .map((nov) => {
          if (nov.categoria === "JUSTIFICACION") {
            return `[Justificación] ${nov.motivo}${
              nov.fechaInicio && nov.fechaFin
                ? ` (Del ${nov.fechaInicio} al ${nov.fechaFin} - ${nov.diasVigencia ?? 1} d.)`
                : ""
            }`;
          }
          if (nov.categoria === "PERMISO") {
            return `[Permiso] ${nov.motivo}${
              nov.fechaInicio && nov.fechaFin
                ? ` (Del ${nov.fechaInicio} al ${nov.fechaFin} - ${nov.diasVigencia ?? 1} d.)`
                : ""
            }`;
          }
          if (nov.categoria === "CITACION" || nov.categoria === "NOTIFICACION") {
            return `[${nov.categoria === "CITACION" ? "Citación" : "Notificación"} Doc: #${
              nov.numeroDocumento || "S/N"
            }] ${nov.motivo}`;
          }
          return `[Observación] ${nov.motivo}`;
        })
        .join("\n");
    }

    return [
      d.puesto,
      d.ciu,
      d.cedula,
      d.contribuyente,
      d.estado,
      detalleNovedades,
      d.horaRegistro || "—",
    ];
  });

  autoTable(doc, {
    head: headers,
    body: data,
    startY,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7, cellPadding: 2, textColor: [33, 37, 41] },
    headStyles: {
      fillColor: [69, 116, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 42 },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 60 },
      6: { cellWidth: 14, halign: "center" },
    },
  });

  // Pie de página numerado
  const totalPages = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${p} de ${totalPages} — Detalle de Control • EP-EMA`,
      pageWidth / 2,
      287,
      { align: "center" }
    );
  }

  doc.save(`control-${sesion.naveNombre.replace(/\s+/g, "_")}-${sesion.fechaJornada}.pdf`);
}
