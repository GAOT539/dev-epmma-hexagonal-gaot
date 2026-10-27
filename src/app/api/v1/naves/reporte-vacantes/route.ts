import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

function esActividadValida(actividad?: string | null): boolean {
  if (!actividad) return false;
  const a = actividad.trim().toLowerCase();
  return a !== "" && a !== "general" && a !== "-";
}

function extraerNumero(codigo: string): number | null {
  const match = codigo.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function sonCodigosPuestosEquivalentes(codA: string, codB: string): boolean {
  const normA = codA.trim().toUpperCase();
  const normB = codB.trim().toUpperCase();
  if (normA === normB) return true;
  const numA = extraerNumero(normA);
  const numB = extraerNumero(normB);
  if (numA !== null && numB !== null && numA === numB) {
    const prefA = normA.replace(/\d+/g, "").trim();
    const prefB = normB.replace(/\d+/g, "").trim();
    return prefA === prefB || !prefA || !prefB;
  }
  return false;
}

function coincideNave(naveCom: string | null | undefined, naveEntry: { id: string; nombre: string }): boolean {
  if (!naveCom) return false;
  const nCom = naveCom.normalize("NFC").trim().toUpperCase();
  const nNombre = naveEntry.nombre.normalize("NFC").trim().toUpperCase();
  const nId = naveEntry.id.normalize("NFC").trim().toUpperCase();
  if (nCom === nNombre || nCom === nId) return true;
  const nComSinPrefijo = nCom.replace(/^NAVE\s+/i, "").trim();
  const nNombreSinPrefijo = nNombre.replace(/^NAVE\s+/i, "").trim();
  return nComSinPrefijo === nNombreSinPrefijo;
}

function clasificarEspacioComercial(codigo: string): string {
  if (/\bBODEGA\b/i.test(codigo)) return "BODEGA";
  if (/\bCUB[IÍ]CULO\b/i.test(codigo)) return "CUBÍCULO";
  if (/\bN[UÚ]CLEO\b/i.test(codigo)) return "NÚCLEO";
  if (/\bLOCAL\b/i.test(codigo)) return "LOCAL";
  if (/\bCOCINA\b/i.test(codigo)) return "COCINA";

  const limpio = codigo.trim();
  if (/^N-[A-ZÑ0-9]+-[A-Z0-9-]+$/i.test(limpio) || /^ZCF-/i.test(limpio)) {
    return "BODEGA";
  }

  return "PUESTO";
}

function formatearNumeroEspacio(codigo: string): string {
  const limpio = codigo
    .replace(/\b(BODEGA|PUESTO|CUB[IÍ]CULO|N[UÚ]CLEO|LOCAL|COCINA)\b/gi, "")
    .trim();
  return limpio || codigo.trim();
}

export async function GET() {
  try {
    const [naves, jefeOperativo, director] = await Promise.all([
      prisma.nave.findMany({
        where: { estadoRegistro: "Habilitado" },
        include: {
          puestos: {
            include: {
              comerciante: true,
            },
          },
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.usuario.findFirst({
        where: { rol: "JEFE_OPERATIVO", estado: "Habilitado" },
        orderBy: { creadoEn: "desc" },
        select: { nombres: true, apellidos: true },
      }),
      prisma.usuario.findFirst({
        where: { rol: "DIRECTOR", estado: "Habilitado" },
        orderBy: { creadoEn: "desc" },
        select: { nombres: true, apellidos: true },
      }),
    ]);

    // Recolectar todos los puestos vacantes
    type PuestoConComerciante = (typeof naves)[0]["puestos"][0];
    type NaveTipo = (typeof naves)[0];

    interface VacanteEntry {
      nave: NaveTipo;
      puesto: PuestoConComerciante;
    }

    const todosVacantes: VacanteEntry[] = [];

    for (const nave of naves) {
      // Ordenar los puestos de la nave naturalmente por código
      const puestosOrdenados = [...nave.puestos].sort((a, b) => {
        const numA = extraerNumero(a.codigo) ?? 0;
        const numB = extraerNumero(b.codigo) ?? 0;
        if (numA !== numB) return numA - numB;
        return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
      });

      for (const puesto of puestosOrdenados) {
        if (puesto.estado === "Vacante" || !puesto.comercianteId) {
          todosVacantes.push({ nave, puesto });
        }
      }
    }

    // Prioridad 1: Historial de Asistencia del Puesto
    const vacantesPuestoIds = todosVacantes.map((v) => v.puesto.id);
    const ultimasAsistencias =
      vacantesPuestoIds.length > 0
        ? await prisma.registroAsistencia.findMany({
            where: { puestoId: { in: vacantesPuestoIds } },
            orderBy: { fecha: "desc" },
            include: { comerciante: true },
          })
        : [];

    const asistenciaPorPuestoId = new Map<string, (typeof ultimasAsistencias)[0]>();
    for (const asis of ultimasAsistencias) {
      if (!asistenciaPorPuestoId.has(asis.puestoId)) {
        asistenciaPorPuestoId.set(asis.puestoId, asis);
      }
    }

    // Identificar puestos que no resolvieron en Parámetro 1A para consultar 1B
    const puestosPendientesP1B: VacanteEntry[] = [];
    const giroPorPuestoId = new Map<string, string>();

    for (const entry of todosVacantes) {
      const asis = asistenciaPorPuestoId.get(entry.puesto.id);
      if (asis && esActividadValida(asis.comerciante?.actividad)) {
        giroPorPuestoId.set(entry.puesto.id, asis.comerciante.actividad.trim().toUpperCase());
      } else {
        puestosPendientesP1B.push(entry);
      }
    }

    // Parámetro 1B: Comerciantes históricos de ese mismo puesto en ESA MISMA NAVE
    // (ELIMINADO el mapa global comMapPorPuesto para evitar cualquier cruce entre naves)
    if (puestosPendientesP1B.length > 0) {
      const comerciantesHistoricos = await prisma.comerciante.findMany({
        where: {
          puestoId: { not: null },
        },
        orderBy: { actualizadoEn: "desc" },
      });

      for (const entry of puestosPendientesP1B) {
        // Filtrar obligatoriamente primero por la misma nave y verificar coincidencia del puesto
        const com = comerciantesHistoricos.find(
          (c) =>
            coincideNave(c.nave, entry.nave) &&
            sonCodigosPuestosEquivalentes(c.puestoId || "", entry.puesto.codigo) &&
            esActividadValida(c.actividad)
        );

        if (com && com.actividad) {
          giroPorPuestoId.set(entry.puesto.id, com.actividad.trim().toUpperCase());
        }
      }
    }

    // Parámetro 2: Búsqueda por Vecindad Alternada en su PROPIA NAVE (primero N - 1, luego N + 1, luego N - 2, N + 2...)
    for (const entry of todosVacantes) {
      if (giroPorPuestoId.has(entry.puesto.id)) continue;

      // Puestos ocupados actuales de ESA MISMA NAVE con comerciante y actividad válida
      const ocupadosNave = (entry.nave.puestos || []).filter(
        (p) =>
          p.estado === "Ocupado" &&
          p.comerciante &&
          esActividadValida(p.comerciante.actividad)
      );

      if (ocupadosNave.length === 0) {
        giroPorPuestoId.set(entry.puesto.id, "POR DEFINIR");
        continue;
      }

      const numVacante = extraerNumero(entry.puesto.codigo);
      if (numVacante !== null) {
        // Filtrar puestos ocupados de la misma nave que tengan número
        const candidatos = ocupadosNave
          .map((p) => ({ puesto: p, num: extraerNumero(p.codigo) }))
          .filter((c): c is { puesto: typeof c.puesto; num: number } => c.num !== null);

        if (candidatos.length > 0) {
          candidatos.sort((a, b) => {
            const distA = Math.abs(numVacante - a.num);
            const distB = Math.abs(numVacante - b.num);
            // 1. Menor distancia absoluta primero
            if (distA !== distB) {
              return distA - distB;
            }
            // 2. Desempate a igual distancia (distA === distB):
            // Gana SIEMPRE el puesto anterior/inferior (numA < numVacante) sobre el puesto siguiente (numB > numVacante)
            return a.num - b.num;
          });

          giroPorPuestoId.set(
            entry.puesto.id,
            candidatos[0].puesto.comerciante!.actividad.trim().toUpperCase()
          );
        } else {
          giroPorPuestoId.set(
            entry.puesto.id,
            ocupadosNave[0].comerciante!.actividad.trim().toUpperCase()
          );
        }
      } else {
        giroPorPuestoId.set(
          entry.puesto.id,
          ocupadosNave[0].comerciante!.actividad.trim().toUpperCase()
        );
      }
    }

    // Transformación final de cada fila vacante
    const items = todosVacantes.map(({ nave, puesto }) => {
      const ubicacionNave = nave.nombre.replace(/^NAVE\s+/i, "").trim();
      const espacioComercializacion = clasificarEspacioComercial(puesto.codigo);
      const numeroEspacioComercial = formatearNumeroEspacio(puesto.codigo);
      const giroNegocio = giroPorPuestoId.get(puesto.id) || "POR DEFINIR";

      return {
        id: puesto.id,
        naveId: nave.id,
        ubicacionNave,
        giroNegocio,
        espacioComercializacion,
        numeroEspacioComercial,
        areaM2: "6",
        enProcesoJudicial: false,
      };
    });

    const elaboradoPorNombre = jefeOperativo
      ? `${jefeOperativo.nombres} ${jefeOperativo.apellidos}`.replace(/\s+/g, " ").trim().toUpperCase()
      : "ING. JEFE OPERATIVO";

    const revisadoPorNombre = director
      ? `${director.nombres} ${director.apellidos}`.replace(/\s+/g, " ").trim().toUpperCase()
      : "DIRECTOR COMERCIAL";

    return NextResponse.json({
      items,
      firmantes: {
        elaboradoPorNombre,
        elaboradoPorCargo: "SUPERVISOR DE OPERACIONES CONTROL Y ORDEN EP-EMA",
        revisadoPorNombre,
        revisadoPorCargo: "DIRECTOR COMERCIAL OPERACIONES Y COMUNICACIÓN SOCIAL EP-EMA",
      },
    });
  } catch (error) {
    logError("API", "Error en GET /api/v1/naves/reporte-vacantes", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al generar los datos del reporte de vacantes." },
      { status: 500 }
    );
  }
}
