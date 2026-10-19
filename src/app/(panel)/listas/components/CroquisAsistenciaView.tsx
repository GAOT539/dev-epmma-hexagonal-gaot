"use client";

import React, { useMemo } from "react";
import type {
  Puesto,
  Comerciante,
  EstadoAsistencia,
} from "@/domain/models/comerciante.model";
import type {
  PlanoEspacialNave,
  CeldaPlano as CeldaPlanoNave,
} from "@/domain/models/nave.model";
import { ESTADO_CONFIG } from "./ModalNovedad";
import { ordenarPuestosDeNave } from "@/app/(panel)/naves/components/plano-nave.utils";

const normalizeText = (text: string) => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

interface CroquisAsistenciaViewProps {
  plano: PlanoEspacialNave;
  items: {
    puesto: Puesto;
    comerciante: Comerciante | null;
    estado: EstadoAsistencia | "Vacante";
  }[];
  searchQuery: string;
  onOpenModal: (puesto: Puesto, comerciante: Comerciante, estado: EstadoAsistencia) => void;
}

export function CroquisAsistenciaView({
  plano,
  items,
  searchQuery,
  onOpenModal,
}: CroquisAsistenciaViewProps) {
  // Cálculo de Bounding Box efectivo (recorte espacial de celdas activas)
  const boundingBox = useMemo(() => {
    if (!plano) return { filasEfectivas: 1, columnasEfectivas: 1 };
    const celdasConInfo = plano.celdas.filter(
      (c) =>
        c.tipo !== "VACIO" ||
        Boolean(c.codigoPuesto && c.codigoPuesto.trim()) ||
        Boolean(c.texto && c.texto.trim())
    );
    if (celdasConInfo.length === 0) {
      return {
        filasEfectivas: Math.min(plano.filas, 6),
        columnasEfectivas: Math.min(plano.columnas, 6),
      };
    }
    const maxR = Math.max(
      0,
      ...celdasConInfo.map((c) => c.fila + (c.rowSpan || 1) - 1)
    );
    const maxC = Math.max(
      0,
      ...celdasConInfo.map((c) => c.columna + (c.colSpan || 1) - 1)
    );
    return {
      filasEfectivas: Math.max(1, Math.min(plano.filas, maxR + 1)),
      columnasEfectivas: Math.max(1, Math.min(plano.columnas, maxC + 1)),
    };
  }, [plano]);

  // Celdas absorbidas/cubiertas por expansión de rowSpan o colSpan
  const celdasCubiertas = useMemo(() => {
    const set = new Set<string>();
    if (!plano) return set;
    for (const c of plano.celdas) {
      const rSpan = c.rowSpan || 1;
      const cSpan = c.colSpan || 1;
      if (rSpan > 1 || cSpan > 1) {
        for (let r = 0; r < rSpan; r++) {
          for (let col = 0; col < cSpan; col++) {
            if (r !== 0 || col !== 0) {
              set.add(`${c.fila + r}-${c.columna + col}`);
            }
          }
        }
      }
    }
    return set;
  }, [plano]);

  // Mapa rápido de celdas por clave "fila-columna"
  const celdasMap = useMemo(() => {
    const map = new Map<string, CeldaPlanoNave>();
    if (plano) {
      for (const celda of plano.celdas) {
        map.set(`${celda.fila}-${celda.columna}`, celda);
      }
    }
    return map;
  }, [plano]);

  // Ordenar deterministamente los puestos de la nave para resolución de índices secuenciales 1..N
  const itemsOrdenados = useMemo(() => {
    const puestos = items.map((i) => i.puesto);
    const puestosOrdenados = ordenarPuestosDeNave(puestos);
    const idPosMap = new Map(puestosOrdenados.map((p, idx) => [p.id, idx]));
    return [...items].sort((a, b) => {
      const posA = idPosMap.get(a.puesto.id) ?? 9999;
      const posB = idPosMap.get(b.puesto.id) ?? 9999;
      return posA - posB;
    });
  }, [items]);

  // Índice de búsqueda rápida para vincular códigos de puestos
  const itemsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        puesto: Puesto;
        comerciante: Comerciante | null;
        estado: EstadoAsistencia | "Vacante";
      }
    >();
    for (const item of items) {
      const pCod = item.puesto.codigo.trim().toUpperCase();
      const pId = item.puesto.id.trim().toUpperCase();
      map.set(pCod, item);
      map.set(pId, item);
    }
    return map;
  }, [items]);

  const resolverItemDeCelda = (codigoPuesto: string | undefined) => {
    if (!codigoPuesto) return undefined;
    const codLimpio = codigoPuesto.trim().replace(/^#/, "").trim().toUpperCase();

    // Paso A: Coincidencia exacta por código o ID
    let match = itemsMap.get(codLimpio);

    // Paso B: Coincidencia por índice secuencial 1..N
    if (!match && /^\d+$/.test(codLimpio)) {
      const pIndex = parseInt(codLimpio, 10) - 1;
      if (pIndex >= 0 && pIndex < itemsOrdenados.length) {
        match = itemsOrdenados[pIndex];
      }
    }

    // Paso C: Coincidencia por sufijo numérico sin ambigüedad
    if (!match) {
      const sufijoMatch = codLimpio.match(/(\d+)$/);
      if (sufijoMatch) {
        const numSufijo = parseInt(sufijoMatch[1], 10);
        const candidatos = items.filter((i) => {
          const pMatch = i.puesto.codigo.trim().toUpperCase().match(/(\d+)$/);
          return pMatch && parseInt(pMatch[1], 10) === numSufijo;
        });
        if (candidatos.length === 1) {
          match = candidatos[0];
        }
      }
    }

    return match;
  };

  const q = normalizeText(searchQuery.trim());

  return (
    <div className="space-y-4">
      {/* Contenedor del lienzo con scroll horizontal y soporte responsivo */}
      <div className="rounded-2xl bg-base-white p-3 sm:p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
        <div className="overflow-x-auto pb-2">
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${boundingBox.columnasEfectivas}, minmax(118px, 1fr))`,
              gridAutoRows: "minmax(84px, auto)",
              minWidth: `${boundingBox.columnasEfectivas * 124}px`,
            }}
          >
            {Array.from({ length: boundingBox.filasEfectivas }).map((_, rIdx) =>
              Array.from({ length: boundingBox.columnasEfectivas }).map((_, cIdx) => {
                if (celdasCubiertas.has(`${rIdx}-${cIdx}`)) {
                  return null;
                }

                const celda = celdasMap.get(`${rIdx}-${cIdx}`) ?? {
                  fila: rIdx,
                  columna: cIdx,
                  tipo: "VACIO",
                };

                const rSpan = celda.rowSpan || 1;
                const cSpan = celda.colSpan || 1;

                // 1. Celdas de tipo VACIO (Pasillos limpios e invisibles)
                if (celda.tipo === "VACIO") {
                  return (
                    <div
                      key={`celda-${rIdx}-${cIdx}`}
                      style={{
                        gridColumn: `${cIdx + 1} / span ${cSpan}`,
                        gridRow: `${rIdx + 1} / span ${rSpan}`,
                      }}
                      className="border-transparent bg-transparent pointer-events-none select-none min-h-[84px]"
                    />
                  );
                }

                // 2. Celdas Especiales (PARQUEADERO, DELIMITACION, ANOTACION, BANO)
                if (celda.tipo !== "PUESTO") {
                  return (
                    <div
                      key={`celda-${rIdx}-${cIdx}`}
                      style={{
                        gridColumn: `${cIdx + 1} / span ${cSpan}`,
                        gridRow: `${rIdx + 1} / span ${rSpan}`,
                      }}
                      className="rounded-lg border border-gray-300 bg-gray-100 text-gray-700 shadow-2xs p-2 flex flex-col items-center justify-center text-center cursor-default select-none min-h-[84px]"
                      title={celda.texto || "Área de Referencia"}
                    >
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wide leading-tight">
                        {celda.texto || celda.tipo}
                      </span>
                      {celda.subtexto && (
                        <span className="text-[10px] text-gray-500 font-medium uppercase mt-0.5 leading-tight">
                          {celda.subtexto}
                        </span>
                      )}
                    </div>
                  );
                }

                // 3. Celdas de tipo PUESTO (Asistencia interactiva)
                const codLimpio = (celda.codigoPuesto ?? "").trim().toUpperCase();
                const match = resolverItemDeCelda(celda.codigoPuesto);

                const puesto =
                  match?.puesto ?? {
                    id: codLimpio,
                    codigo: codLimpio,
                    naveId: plano.naveId,
                    estado: "Vacante",
                    comercianteId: null,
                  };
                const comerciante = match?.comerciante ?? null;
                const estado = match?.estado ?? "Vacante";
                const isInteractive = Boolean(comerciante && estado !== "Vacante");

                // Filtro de búsqueda visual: atenuar los que no coincidan para preservar la geometría
                const coincideBusqueda =
                  !q ||
                  normalizeText(puesto.codigo).includes(q) ||
                  (comerciante &&
                    (normalizeText(comerciante.contribuyente).includes(q) ||
                      normalizeText(comerciante.cedula).includes(q) ||
                      normalizeText(comerciante.ciu).includes(q)));

                const bgColorMap: Record<string, string> = {
                  Presente: "bg-green-700 text-white",
                  Ausente: "bg-red-700 text-white",
                  Permiso: "bg-purple-700 text-white",
                  Vacante: "bg-gray-700 text-white",
                };

                const estadoLabel = ESTADO_CONFIG[estado]?.label ?? estado;

                return (
                  <div
                    key={`celda-${rIdx}-${cIdx}`}
                    style={{
                      gridColumn: `${cIdx + 1} / span ${cSpan}`,
                      gridRow: `${rIdx + 1} / span ${rSpan}`,
                    }}
                    onClick={() => {
                      if (isInteractive && comerciante) {
                        onOpenModal(puesto, comerciante, estado as EstadoAsistencia);
                      }
                    }}
                    className={[
                      "p-2.5 rounded-lg flex flex-col justify-between transition-all relative shadow-sm min-h-[84px]",
                      bgColorMap[estado] ?? "bg-gray-700 text-white",
                      coincideBusqueda ? "opacity-100" : "opacity-25",
                      isInteractive
                        ? "cursor-pointer hover:scale-[1.02] hover:shadow-md hover:z-10 active:scale-98"
                        : "cursor-default select-none",
                    ].join(" ")}
                    title={
                      comerciante
                        ? `${puesto.codigo}: ${comerciante.contribuyente} — ${estadoLabel}`
                        : `${puesto.codigo}: Vacante`
                    }
                  >
                    {/* Fila superior: CIU del Comerciante y Badge de estado */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-xs font-mono font-bold tracking-wider text-white/95 truncate">
                        {comerciante ? comerciante.ciu : "—"}
                      </span>
                      <span className="text-[10px] font-bold text-white bg-black/35 rounded px-1.5 py-0.5 shrink-0">
                        {estadoLabel}
                      </span>
                    </div>

                    {/* Fila inferior: Contribuyente y Código de Puesto o Vacante */}
                    {comerciante ? (
                      <div className="mt-auto">
                        <p className="text-xs font-bold text-white leading-tight line-clamp-2">
                          {comerciante.contribuyente}
                        </p>
                        <p className="text-[10px] text-white/90 font-mono font-semibold uppercase mt-0.5">
                          #{puesto.codigo || celda.codigoPuesto || "—"}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-auto">
                        <p className="text-xs text-white/80 font-medium">
                          Vacante
                        </p>
                        <p className="text-[10px] text-white/70 font-mono font-medium uppercase mt-0.5">
                          #{puesto.codigo || celda.codigoPuesto || "—"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Leyenda Inferior */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-xs font-medium text-gray-700">
        {(["Presente", "Ausente", "Permiso", "Vacante"] as const).map((key) => {
          const config = ESTADO_CONFIG[key];
          const bgMap: Record<string, string> = {
            Presente: "bg-green-700",
            Ausente: "bg-red-700",
            Permiso: "bg-purple-700",
            Vacante: "bg-gray-700",
          };
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded-sm ${bgMap[key]}`} />
              <span>{config.label}</span>
            </div>
          );
        })}

        {/* Indicador de áreas no interactivas */}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-gray-100 border border-gray-300" />
          <span>Áreas / Referencias del Croquis (No interactivas)</span>
        </div>
      </div>
    </div>
  );
}
