"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Search,
  User,
} from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import {
  getNaves,
  getComerciantes,
  getAsistenciaNaveRango,
  getAsistenciaComercianteRango,
  getPuestosPorNave,
} from "@/infrastructure/mocks/mercado.mock";
import type {
  Comerciante,
  RegistroAsistencia,
} from "@/domain/models/comerciante.model";
import { useAuth } from "@/infrastructure/auth/auth-context";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

// ── Colores por estado ───────────────────────────────────────────────────────

const ESTADO_COLORES: Record<string, { bg: string; text: string; hex: string }> = {
  Presente: { bg: "bg-green-700", text: "text-white", hex: "#15803D" },
  Ausente: { bg: "bg-red-700", text: "text-white", hex: "#B91C1C" },
  Observacion: { bg: "bg-blue-600", text: "text-white", hex: "#2563EB" },
  Permiso: { bg: "bg-purple-700", text: "text-white", hex: "#7E22CE" },
  Vacante: { bg: "bg-gray-700", text: "text-white", hex: "#374151" },
  Pendiente: { bg: "bg-slate-600", text: "text-white", hex: "#475569" },
};

const ESTADO_LABELS: Record<string, string> = {
  Presente: "P",
  Ausente: "A",
  Observacion: "O",
  Permiso: "Pm",
  Vacante: "V",
  Pendiente: "—",
};

// ── Normalización de texto (insensible a tildes y mayúsculas) ───────────────

const normalizeText = (text: string) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// ── Página de Reportes ───────────────────────────────────────────────────────

export default function ReportesPage() {
  const { user } = useAuth();
  const allNaves = getNaves();
  const todosLosComerciantes = getComerciantes();

  // RBAC: Supervisores solo ven sus naves asignadas
  const naves = useMemo(() => {
    if (user?.rol === "SUPERVISOR" && user.navesAsignadas) {
      return allNaves.filter((n) => user.navesAsignadas!.includes(n.id));
    }
    // TIC, DIRECTOR, JEFE_OPERATIVO, SUPERADMIN ven todas
    return allNaves;
  }, [allNaves, user]);

  const [modo, setModo] = useState<"nave" | "individual">("nave");
  const [selectedNaveId, setSelectedNaveId] = useState(naves[0]?.id ?? "");
  const [searchComerciante, setSearchComerciante] = useState("");
  const [selectedComercianteId, setSelectedComercianteId] = useState<string | null>(null);
  const [incluirObservaciones, setIncluirObservaciones] = useState(true);

  // DateRangePicker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 14),
    to: new Date(),
  });

  const fechaInicio = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const fechaFin = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  // Rango de fechas
  const fechas = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];
    try {
      return eachDayOfInterval({
        start: new Date(fechaInicio + "T00:00:00"),
        end: new Date(fechaFin + "T00:00:00"),
      }).map((d) => format(d, "yyyy-MM-dd"));
    } catch {
      return [];
    }
  }, [fechaInicio, fechaFin]);

  // Datos para el reporte por nave
  const reporteNave = useMemo(() => {
    if (modo !== "nave" || !selectedNaveId || !fechaInicio || !fechaFin) return [];

    const puestos = getPuestosPorNave(selectedNaveId);
    const comerciantesNave = puestos
      .filter((p) => p.comercianteId)
      .map((p) => {
        const c = todosLosComerciantes.find(
          (c) => c.idInterno === p.comercianteId
        );
        return c ? { ...c, puestoCode: p.codigo } : null;
      })
      .filter(Boolean) as (Comerciante & { puestoCode: string })[];

    const asistencia = getAsistenciaNaveRango(
      selectedNaveId,
      fechaInicio,
      fechaFin
    );

    return comerciantesNave.map((com) => {
      const registros = asistencia.filter(
        (r) => r.comercianteId === com.idInterno
      );
      const registroMap = new Map<string, RegistroAsistencia>();
      registros.forEach((r) => registroMap.set(r.fecha, r));

      const estados = fechas.map(
        (f) => registroMap.get(f)?.estado ?? "Pendiente"
      );
      const todoPresente = estados.every((e) => e === "Presente");
      const observaciones = registros
        .filter((r) => r.observacion)
        .map((r) => `${r.fecha}: ${r.observacion}`)
        .join(" | ");

      return {
        comerciante: com,
        puestoCode: com.puestoCode,
        estados,
        todoPresente,
        observaciones,
      };
    });
  }, [modo, selectedNaveId, fechaInicio, fechaFin, fechas, todosLosComerciantes]);

  // Datos para reporte individual
  const reporteIndividual = useMemo(() => {
    if (modo !== "individual" || !selectedComercianteId || !fechaInicio || !fechaFin) return null;

    const com = todosLosComerciantes.find(
      (c) => c.idInterno === selectedComercianteId
    );
    if (!com) return null;

    const registros = getAsistenciaComercianteRango(
      selectedComercianteId,
      fechaInicio,
      fechaFin
    );
    const registroMap = new Map<string, RegistroAsistencia>();
    registros.forEach((r) => registroMap.set(r.fecha, r));

    const estados = fechas.map(
      (f) => registroMap.get(f)?.estado ?? "Pendiente"
    );
    const todoPresente = estados.every((e) => e === "Presente");
    const observaciones = registros
      .filter((r) => r.observacion)
      .map((r) => `${r.fecha}: ${r.observacion}`)
      .join(" | ");

    let puestoCode = "—";
    let naveNombre = "—";

    for (const n of allNaves) {
      const p = n.puestos.find((p) => p.comercianteId === com.idInterno);
      if (p) {
        puestoCode = p.codigo;
        naveNombre = n.nombre;
        break;
      }
    }

    return { comerciante: com, estados, todoPresente, observaciones, puestoCode, naveNombre };
  }, [modo, selectedComercianteId, fechaInicio, fechaFin, fechas, todosLosComerciantes, allNaves]);

  // Búsqueda de comerciantes (normalizada e insensible a tildes y mayúsculas)
  const comerciantesFiltrados = useMemo(() => {
    if (!searchComerciante.trim()) return [];
    const q = normalizeText(searchComerciante.trim());
    return todosLosComerciantes
      .filter(
        (c) =>
          normalizeText(c.contribuyente).includes(q) ||
          normalizeText(c.ciu).includes(q) ||
          normalizeText(c.cedula).includes(q)
      )
      .slice(0, 8);
  }, [searchComerciante, todosLosComerciantes]);

  // Validación: ¿hay datos para descargar?
  const hayDatos =
    modo === "nave" ? reporteNave.length > 0 : reporteIndividual !== null;

  // ── Exportar PDF ───────────────────────────────────────────────────────────

  async function handleExportPDF() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Encabezado
    try {
      const imgResponse = await fetch("/logopdf.png");
      const imgBlob = await imgResponse.blob();
      const imgBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      doc.addImage(imgBase64, "PNG", 10, 5, 25, 25);
    } catch {
      // Logo no disponible, continuar sin él
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EMPRESA PÚBLICA – EMPRESA MUNICIPAL", 148, 12, {
      align: "center",
    });
    doc.setFontSize(10);
    doc.text("MERCADO MAYORISTA AMBATO", 148, 18, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Reporte de Asistencia — ${format(new Date(fechaInicio + "T00:00:00"), "dd/MM/yyyy")} al ${format(new Date(fechaFin + "T00:00:00"), "dd/MM/yyyy")}`,
      148,
      24,
      { align: "center" }
    );

    if (modo === "nave") {
      const naveNombre = naves.find((n) => n.id === selectedNaveId)?.nombre ?? "";
      doc.text(`Nave: ${naveNombre}`, 148, 28, { align: "center" });
    }

    // Tabla
    const fechaHeaders = fechas.map((f) =>
      format(new Date(f + "T00:00:00"), "dd/MM", { locale: es })
    );

    const baseHeaders = ["#", "CIU", "CÉDULA", "CONTRIBUYENTE", "ACTIVIDAD", "NAVE", "PUESTO"];
    const headers = [
      [...baseHeaders, ...fechaHeaders, ...(incluirObservaciones ? ["Obs."] : [])],
    ];

    const naveNombre = naves.find((n) => n.id === selectedNaveId)?.nombre ?? "";

    const data =
      modo === "nave"
        ? reporteNave.map((row, i) => {
            const baseRow = [
              String(i + 1),
              row.comerciante.ciu,
              row.comerciante.cedula,
              row.comerciante.contribuyente,
              row.comerciante.actividad,
              naveNombre,
              row.puestoCode,
            ];
            const datesRow = row.estados.map((e) => ESTADO_LABELS[e] ?? "—");
            const obsRow = incluirObservaciones ? [row.todoPresente ? "✓ 100%" : row.observaciones || "—"] : [];
            return [...baseRow, ...datesRow, ...obsRow];
          })
        : reporteIndividual
          ? [
              [
                "1",
                reporteIndividual.comerciante.ciu,
                reporteIndividual.comerciante.cedula,
                reporteIndividual.comerciante.contribuyente,
                reporteIndividual.comerciante.actividad,
                reporteIndividual.naveNombre,
                reporteIndividual.puestoCode,
                ...reporteIndividual.estados.map(
                  (e) => ESTADO_LABELS[e] ?? "—"
                ),
                ...(incluirObservaciones ? [reporteIndividual.todoPresente
                  ? "✓ 100%"
                  : reporteIndividual.observaciones || "—"] : []),
              ],
            ]
          : [];

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 32,
      theme: "grid",
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: {
        fillColor: [51, 117, 51], // institucional-green
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6,
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 15 },
        2: { cellWidth: 18 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
      },
      didDrawCell: (cellData: { section: string; column: { index: number }; cell: { x: number; y: number; width: number; height: number; text: string[] } }) => {
        // Colorear celdas de estado
        if (
          cellData.section === "body" &&
          cellData.column.index >= 7 &&
          cellData.column.index < 7 + fechas.length
        ) {
          const value = cellData.cell.text[0];
          const colorMap: Record<string, [number, number, number]> = {
            P: [21, 128, 61],
            A: [185, 28, 28],
            O: [37, 99, 235],
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
            doc.text(
              value,
              cellData.cell.x + cellData.cell.width / 2,
              cellData.cell.y + cellData.cell.height / 2 + 1,
              { align: "center" }
            );
          }
        }
      },
    });

    // Leyenda
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 180;
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(
      "P = Presente | A = Ausente | O = Observación | Pm = Permiso | V = Vacante",
      10,
      finalY + 6
    );

    doc.save(`reporte-asistencia-${fechaInicio}-a-${fechaFin}.pdf`);
  }

  return (
    <div className="min-h-[100dvh] bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-full mx-auto">
        <div className="flex items-center gap-2">
          <BarChart3 size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Reportes Operativos
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-full space-y-6">
        {/* ── Controles ── */}
        <div className="rounded-2xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-4 lg:gap-6 w-full">
            {/* Modo */}
            <div className="flex flex-col gap-1.5 w-full md:w-auto">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Tipo de Reporte
              </label>
              <div className="flex rounded-lg overflow-hidden ring-1 ring-institucional-whiteSmokeBlack/30 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setModo("nave")}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold transition-colors ${
                    modo === "nave"
                      ? "bg-institucional-green text-base-white"
                      : "bg-base-white text-base-eerieBlack hover:bg-institucional-green/5"
                  }`}
                >
                  Por Nave
                </button>
                <button
                  type="button"
                  onClick={() => setModo("individual")}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold transition-colors ${
                    modo === "individual"
                      ? "bg-institucional-green text-base-white"
                      : "bg-base-white text-base-eerieBlack hover:bg-institucional-green/5"
                  }`}
                >
                  Individual
                </button>
              </div>
            </div>

            {/* Selector de nave o comerciante */}
            {modo === "nave" ? (
              <div className="flex flex-col gap-1.5 w-full md:w-auto">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nave
                </label>
                <select
                  value={selectedNaveId}
                  onChange={(e) => setSelectedNaveId(e.target.value)}
                  className="h-9 w-full md:w-auto rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-sm text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                >
                  {naves.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 w-full md:w-auto relative">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Comerciante
                </label>
                <div className="relative w-full md:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, CIU o cédula..."
                    value={searchComerciante}
                    onChange={(e) => {
                      setSearchComerciante(e.target.value);
                      setSelectedComercianteId(null);
                    }}
                    className="h-9 w-full rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white pl-9 pr-3 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
                  />
                </div>
                {/* Dropdown de resultados */}
                {comerciantesFiltrados.length > 0 && !selectedComercianteId && (
                  <div className="absolute top-full left-0 mt-1 w-full md:w-72 rounded-lg bg-base-white shadow-xl ring-1 ring-institucional-whiteSmokeBlack/20 z-10 max-h-48 overflow-y-auto">
                    {comerciantesFiltrados.map((c) => (
                      <button
                        key={c.idInterno}
                        type="button"
                        onClick={() => {
                          setSelectedComercianteId(c.idInterno);
                          setSearchComerciante(
                            `${c.contribuyente} (${c.ciu})`
                          );
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-institucional-green/5 transition-colors"
                      >
                        <User size={14} className="text-institucional-green shrink-0" />
                        <span className="font-medium text-base-eerieBlack truncate">
                          {c.contribuyente}
                        </span>
                        <span className="ml-auto text-gray-700 font-medium shrink-0">
                          {c.ciu}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DateRangePicker */}
            <div className="flex flex-col gap-1.5 w-full md:w-auto">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Rango de Fechas
              </label>
              <DateRangePicker
                date={dateRange}
                setDate={setDateRange}
                placeholder="Seleccionar rango"
                className="w-full md:w-auto min-w-[240px]"
              />
            </div>

            {/* Toggle de observaciones */}
            <div className="flex flex-col justify-end w-full md:w-auto">
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="toggle-obs"
                  checked={incluirObservaciones}
                  onChange={(e) => setIncluirObservaciones(e.target.checked)}
                  className="rounded border-institucional-whiteSmokeBlack/30 text-institucional-green focus:ring-institucional-green w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="toggle-obs"
                  className="text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer select-none"
                >
                  Incluir Observaciones
                </label>
              </div>
            </div>

            {/* Botón PDF */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!hayDatos}
              className={[
                "flex items-center justify-center gap-2 h-9 rounded-lg px-5 text-xs font-semibold shadow-sm transition-colors w-full md:w-auto mt-2 md:mt-0",
                hayDatos
                  ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2"
                  : "bg-institucional-whiteSmokeBlack/30 text-gray-700 cursor-not-allowed",
              ].join(" ")}
            >
              <Download size={14} />
              Descargar PDF
            </button>
          </div>
        </div>

        {/* ── Tabla de resultados ── */}
        {modo === "nave" && reporteNave.length > 0 && (
          <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-x-auto">
            <table className="w-full text-xs" id="tabla-reporte">
              <thead>
                <tr className="bg-institucional-green text-base-white">
                  <th className="sticky left-0 bg-institucional-green px-3 py-2.5 text-left font-semibold z-10">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[80px]">
                    CIU
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[90px]">
                    CÉDULA
                  </th>
                  <th className="sticky left-8 bg-institucional-green px-3 py-2.5 text-left font-semibold min-w-[160px] z-10">
                    CONTRIBUYENTE
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[120px]">
                    ACTIVIDAD
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[100px]">
                    NAVE
                  </th>
                  <th className="px-2 py-2.5 text-center font-semibold min-w-[60px]">
                    PUESTO
                  </th>
                  {fechas.map((f) => (
                    <th
                      key={f}
                      className="px-1 py-2.5 text-center font-semibold min-w-[36px]"
                    >
                      {format(new Date(f + "T00:00:00"), "dd")}
                      <br />
                      <span className="font-normal opacity-75">
                        {format(new Date(f + "T00:00:00"), "MMM", {
                          locale: es,
                        })}
                      </span>
                    </th>
                  ))}
                  {incluirObservaciones && (
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[150px]">
                      Observaciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {reporteNave.map((row, i) => (
                  <tr
                    key={row.comerciante.idInterno}
                    className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                  >
                    <td className="sticky left-0 bg-base-white px-3 py-2 text-gray-700 font-medium z-10">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono font-medium text-acento-azul1">
                      {row.comerciante.ciu}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                      {row.comerciante.cedula}
                    </td>
                    <td className="sticky left-8 bg-base-white px-3 py-2 text-sm font-semibold text-base-eerieBlack z-10">
                      <div className="truncate max-w-[200px]">
                        {row.comerciante.contribuyente}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                      {row.comerciante.actividad}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                      {naves.find((n) => n.id === selectedNaveId)?.nombre}
                    </td>
                    <td className="px-2 py-2 text-center text-sm font-mono font-medium text-base-eerieBlack">
                      {row.puestoCode}
                    </td>
                    {row.estados.map((estado, j) => {
                      const config =
                        ESTADO_COLORES[estado] ?? ESTADO_COLORES["Pendiente"];
                      return (
                        <td key={j} className="px-0.5 py-1 text-center">
                          {row.todoPresente ? (
                            <div className="h-5 bg-green-700 mx-auto" style={{ width: "100%" }} />
                          ) : (
                            <span
                              className={`inline-flex min-h-5 min-w-7 px-1 py-0.5 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                            >
                              {ESTADO_LABELS[estado]}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {incluirObservaciones && (
                      <td className="px-3 py-2 max-w-[200px]">
                        {row.todoPresente ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                            <span className="inline-block h-2 w-2 rounded-full bg-green-700" />
                            100% Asistencia
                          </span>
                        ) : (
                          <span className="line-clamp-2 text-xs font-semibold text-gray-900">
                            {row.observaciones || "—"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reporte individual */}
        {modo === "individual" && reporteIndividual && (
          <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-x-auto">
            <div className="p-5 border-b border-institucional-whiteSmokeBlack/15">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green font-bold">
                  {reporteIndividual.comerciante.contribuyente.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-base-eerieBlack">
                    {reporteIndividual.comerciante.contribuyente}
                  </p>
                  <p className="text-sm text-gray-700 font-medium">
                    CIU: {reporteIndividual.comerciante.ciu} · Cédula:{" "}
                    {reporteIndividual.comerciante.cedula}
                  </p>
                </div>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-institucional-green/10">
                  {fechas.map((f) => (
                    <th key={f} className="px-1.5 py-2 text-center font-semibold text-base-eerieBlack min-w-[40px]">
                      {format(new Date(f + "T00:00:00"), "dd/MM")}
                    </th>
                  ))}
                  {incluirObservaciones && (
                    <th className="px-3 py-2 text-left font-semibold text-base-eerieBlack min-w-[120px]">
                      Obs.
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {reporteIndividual.estados.map((estado, j) => {
                    const config =
                      ESTADO_COLORES[estado] ?? ESTADO_COLORES["Pendiente"];
                    return (
                      <td key={j} className="px-0.5 py-2 text-center">
                        {reporteIndividual.todoPresente ? (
                          <div className="h-5 bg-green-700 mx-auto" style={{ width: "100%" }} />
                        ) : (
                          <span
                            className={`inline-flex min-h-6 min-w-8 px-1.5 py-0.5 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                          >
                            {ESTADO_LABELS[estado]}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {incluirObservaciones && (
                    <td className="px-3 py-2">
                      {reporteIndividual.todoPresente ? (
                        <span className="text-green-700 font-semibold text-xs">
                          ✓ 100% Asistencia
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-900">
                          {reporteIndividual.observaciones || "—"}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Estado vacío */}
        {modo === "individual" && !selectedComercianteId && (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-institucional-whiteSmokeBlack/30 bg-base-white p-8">
            <div className="text-center">
              <Search size={32} className="mx-auto mb-2 text-gray-700/40" />
              <p className="text-sm text-gray-700">
                Busque y seleccione un comerciante para generar su reporte.
              </p>
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700 px-1">
          <span className="font-semibold text-base-eerieBlack">Leyenda:</span>
          {Object.entries(ESTADO_LABELS).map(([estado, label]) => {
            const config = ESTADO_COLORES[estado];
            if (!config) return null;
            return (
              <div key={estado} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-6 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                >
                  {label}
                </span>
                <span>{estado === "Observacion" ? "Observación" : estado}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
