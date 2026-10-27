import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { SesionControlSupervisor } from "@/domain/models/auditoria.model";

export interface ExportarControlSupervisoresGeneralPDFParams {
  sesiones: SesionControlSupervisor[];
  fechaDesdeStr: string;
  fechaHastaStr: string;
}

// ── Generación de PDF General ──────────────────────────────────────────────

export function exportarControlSupervisoresGeneralPDF({
  sesiones,
  fechaDesdeStr,
  fechaHastaStr,
}: ExportarControlSupervisoresGeneralPDFParams): void {
  const doc = new jsPDF({ orientation: "landscape" });

  try {
    doc.addImage("/logopdf.png", "PNG", 10, 10, 30, 30);
  } catch {
    // Continúa si no está disponible la imagen en el entorno
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
    doc.internal.pageSize.width / 2,
    18,
    { align: "center" }
  );

  doc.setFontSize(12);
  doc.text("Reporte de Control de Supervisores", doc.internal.pageSize.width / 2, 33, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const periodoStr = `Período: ${fechaDesdeStr || "Inicio"} al ${fechaHastaStr || "Hoy"}  |  Fecha de exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  doc.text(periodoStr, doc.internal.pageSize.width / 2, 40, { align: "center" });

  const headers = [
    ["Fecha Lista", "Inicio Toma", "Supervisor", "Nave", "Acción", "Estado / Anotaciones", "Puestos / Asistencia"],
  ];

  const data = sesiones.map((s) => {
    const anotaciones = s.etiquetas
      .map((e) => {
        if (e === "CON_PERSISTENCIA") return "Con Persistencia";
        if (e === "MODIFICADO_TRAS_PERSISTENCIA") return "Modif. tras persistencia";
        if (e === "CON_RETRASO") return "Con Retraso";
        if (e === "EN_FECHA") return "En Fecha";
        return e;
      })
      .join(" • ");

    return [
      format(new Date(s.fechaJornada + "T00:00:00"), "dd/MM/yyyy"),
      format(new Date(s.timestampInicio), "dd/MM/yyyy HH:mm"),
      s.supervisorNombre,
      s.naveNombre,
      s.accion,
      anotaciones,
      `Total: ${s.resumen.totalOcupados} (P: ${s.resumen.presentes}, A: ${s.resumen.ausentes}, Pm: ${s.resumen.permisos})`,
    ];
  });

  autoTable(doc, {
    head: headers,
    body: data,
    startY: 46,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [69, 116, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 32 },
      2: { cellWidth: 42 },
      3: { cellWidth: 25 },
      4: { cellWidth: 42 },
      5: { cellWidth: 72 },
      6: { cellWidth: 30 },
    },
  });

  doc.save(`control-supervisores-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}

// ── Generación de PDF Individual ───────────────────────────────────────────

export function exportarControlSupervisorIndividualPDF(sesion: SesionControlSupervisor): void {
  const doc = new jsPDF({ orientation: "portrait" });

  try {
    doc.addImage("/logopdf.png", "PNG", 10, 10, 30, 30);
  } catch {
    // Continúa
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "EMPRESA PÚBLICA – EMPRESA MUNICIPAL\nMERCADO MAYORISTA AMBATO",
    doc.internal.pageSize.width / 2,
    18,
    { align: "center" }
  );

  doc.setFontSize(11);
  doc.text("Reporte de Control de Supervisores", doc.internal.pageSize.width / 2, 31, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Detalle Individual de Toma de Lista - Jornada: ${format(new Date(sesion.fechaJornada + "T00:00:00"), "dd/MM/yyyy")}`,
    doc.internal.pageSize.width / 2,
    37,
    { align: "center" }
  );

  // Bloque descriptivo
  doc.setFontSize(8.5);
  doc.text(`Supervisor: ${sesion.supervisorNombre}`, 14, 46);
  doc.text(`Nave: ${sesion.naveNombre}`, 14, 51);
  doc.text(`Inicio de Toma: ${format(new Date(sesion.timestampInicio), "dd/MM/yyyy HH:mm")}`, 14, 56);
  if (sesion.timestampUltimaModificacion) {
    doc.text(`Última Modificación: ${format(new Date(sesion.timestampUltimaModificacion), "dd/MM/yyyy HH:mm")}`, 14, 61);
  }

  doc.text(`Total Puestos Ocupados: ${sesion.resumen.totalOcupados}`, 115, 46);
  doc.text(`Presentes: ${sesion.resumen.presentes}  |  Ausentes: ${sesion.resumen.ausentes}  |  Permisos: ${sesion.resumen.permisos}`, 115, 51);

  let startY = 66;

  if (sesion.esPersistencia) {
    doc.setFont("helvetica", "bold");
    doc.text("Registro con Persistencia:", 14, startY);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Datos arrastrados desde ${sesion.fechaOrigenPersistencia || "jornada previa"}. Justificación: ${sesion.comentarioPersistencia || "Sin justificación registrada"}`,
      14,
      startY + 4
    );
    startY += 10;
  }

  if (sesion.tieneRetraso) {
    doc.setFont("helvetica", "bold");
    doc.text("Registro con Retraso:", 14, startY);
    doc.setFont("helvetica", "normal");
    doc.text(
      sesion.detalleRetraso || "La lista fue registrada manualmente con posterioridad a la jornada.",
      14,
      startY + 4
    );
    startY += 10;
  }

  const headers = [["Puesto", "CIU", "Cédula", "Contribuyente", "Estado", "Método", "Hora"]];
  const data = sesion.detallesComerciantes.map((d) => [
    d.puesto,
    d.ciu,
    d.cedula,
    d.contribuyente,
    d.estado,
    d.metodo === "MODIFICADO_TRAS_PERSISTENCIA"
      ? "Modif. tras persistencia"
      : d.metodo === "PERSISTENCIA"
      ? "Persistencia"
      : "Manual",
    d.horaRegistro || "-",
  ]);

  autoTable(doc, {
    head: headers,
    body: data,
    startY: startY + 2,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [69, 116, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 48 },
      4: { cellWidth: 22 },
      5: { cellWidth: 36 },
      6: { cellWidth: 18 },
    },
  });

  doc.save(`control-${sesion.naveNombre.replace(/\s+/g, "_")}-${sesion.fechaJornada}.pdf`);
}
