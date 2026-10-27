"use client";

import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search } from "lucide-react";
import {
  ESTADO_COLORES,
  ESTADO_LABELS,
  type ReporteItem,
} from "./reportes-pdf.utils";

interface ReportesTablaProps {
  reporteFiltrado: ReporteItem[];
  fechas: string[];
  soloObservaciones: boolean;
  incluirObservaciones: boolean;
  cargandoReporte: boolean;
}

export function ReportesTabla({
  reporteFiltrado,
  fechas,
  soloObservaciones,
  incluirObservaciones,
  cargandoReporte,
}: ReportesTablaProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        <table className="w-full text-xs" id="tabla-reporte">
          <thead className="sticky top-0 z-20 bg-[#e6efe9] text-base-eerieBlack">
            <tr className="bg-[#e6efe9] text-base-eerieBlack border-b border-institucional-whiteSmokeBlack/15">
              <th className="sticky left-0 top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold z-30">
                #
              </th>
              <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[80px] z-20">
                CIU
              </th>
              <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[90px] z-20">
                CÉDULA
              </th>
              <th className="sticky left-8 top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[260px] lg:min-w-[320px] z-30">
                CONTRIBUYENTE
              </th>
              <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold w-[160px] min-w-[140px] max-w-[180px] z-20">
                PRODUCTO
              </th>
              <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[100px] z-20">
                NAVE
              </th>
              <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-2 py-2.5 text-center font-semibold min-w-[60px] z-20">
                PUESTO
              </th>
              {soloObservaciones ? (
                <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[320px] z-20">
                  OBSERVACIONES / CITACIONES / NOTIFICACIONES / PERMISOS
                </th>
              ) : (
                <>
                  {fechas.map((f) => (
                    <th
                      key={f}
                      className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-1 py-2.5 text-center font-semibold min-w-[36px] z-20"
                    >
                      {format(new Date(f + "T00:00:00"), "dd")}
                      <br />
                      <span className="font-normal text-gray-700">
                        {format(new Date(f + "T00:00:00"), "MMM", {
                          locale: es,
                        })}
                      </span>
                    </th>
                  ))}
                  {incluirObservaciones && (
                    <th className="sticky top-0 bg-[#e6efe9] text-base-eerieBlack px-3 py-2.5 text-left font-semibold min-w-[150px] z-20">
                      Observaciones
                    </th>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {cargandoReporte ? (
              <tr>
                <td
                  colSpan={soloObservaciones ? 8 : 7 + fechas.length + (incluirObservaciones ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-gray-700"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 rounded-full border-2 border-institucional-green/30 border-t-institucional-green animate-spin" />
                    <span>Generando reporte de asistencia...</span>
                  </div>
                </td>
              </tr>
            ) : reporteFiltrado.length === 0 ? (
              <tr>
                <td
                  colSpan={soloObservaciones ? 8 : 7 + fechas.length + (incluirObservaciones ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search size={24} className="text-gray-400" />
                    <span>No se encontraron registros que coincidan con los criterios de búsqueda.</span>
                  </div>
                </td>
              </tr>
            ) : (
              reporteFiltrado.map((row, i) => (
                <tr
                  key={row.comerciante.idInterno || `fila-${i}`}
                  className={`border-t border-institucional-whiteSmokeBlack/10 transition-colors ${
                    row.esVacante ? "bg-amber-50/20 hover:bg-amber-50/40" : "hover:bg-institucional-whiteSmoke/50"
                  }`}
                >
                  <td className="sticky left-0 bg-base-white px-3 py-2 text-gray-700 font-medium z-10">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 text-sm font-mono font-medium text-acento-azul1">
                    {row.esVacante ? "-" : row.comerciante.ciu || "-"}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                    {row.esVacante ? "-" : row.comerciante.cedula || "-"}
                  </td>
                  <td className="sticky left-8 bg-base-white px-3 py-2 text-sm font-semibold text-base-eerieBlack z-10">
                    <div
                      className="truncate max-w-[280px] lg:max-w-[360px]"
                      title={row.esVacante ? "PUESTO VACANTE" : row.comerciante.contribuyente}
                    >
                      {row.esVacante ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          PUESTO VACANTE
                        </span>
                      ) : (
                        row.comerciante.contribuyente
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                    <div className="truncate max-w-[160px]" title={row.comerciante.actividad}>
                      {row.esVacante ? "-" : row.comerciante.actividad || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-base-eerieBlack">
                    {row.naveNombre}
                  </td>
                  <td className="px-2 py-2 text-center text-sm font-mono font-bold text-base-eerieBlack">
                    {row.puestoCode}
                  </td>
                  {soloObservaciones ? (
                    <td className="px-3 py-2 text-xs font-semibold text-gray-900">
                      {row.observaciones ? (
                        <div className="space-y-1.5 whitespace-pre-line leading-relaxed">
                          {row.observaciones.split("\n").map((line, idx) => (
                            <div key={idx} className="border-b border-gray-100 last:border-b-0 pb-1 last:pb-0">
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 font-normal">—</span>
                      )}
                    </td>
                  ) : (
                    <>
                      {row.estados.map((estado, j) => {
                        if (estado === "—") {
                          return (
                            <td key={j} className="px-0.5 py-1 text-center">
                              <span className="inline-flex min-h-5 min-w-7 px-1 py-0.5 items-center justify-center rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                                —
                              </span>
                            </td>
                          );
                        }
                        const config = ESTADO_COLORES[estado] ?? ESTADO_COLORES["Presente"];
                        return (
                          <td key={j} className="px-0.5 py-1 text-center">
                            <span
                              className={`inline-flex min-h-5 min-w-7 px-1 py-0.5 items-center justify-center rounded text-xs font-bold ${config.bg} ${config.text}`}
                            >
                              {ESTADO_LABELS[estado] ?? estado}
                            </span>
                          </td>
                        );
                      })}
                      {incluirObservaciones && (
                        <td className="px-3 py-2 max-w-[200px]">
                          <span className="line-clamp-2 text-xs font-semibold text-gray-900 whitespace-pre-line">
                            {row.observaciones || "—"}
                          </span>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Leyenda en el pie de la tabla con los 5 estados */}
      {!soloObservaciones && (
        <div className="shrink-0 border-t border-institucional-whiteSmokeBlack/15 px-4 py-2.5 bg-base-white flex flex-wrap items-center gap-4 text-xs text-gray-700">
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
                <span>{estado}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
