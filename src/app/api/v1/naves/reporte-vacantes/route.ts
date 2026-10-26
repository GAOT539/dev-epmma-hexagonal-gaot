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

    // Identificar puestos que no resolvieron en P1 para consultar P2
    const puestosPendientesP2: VacanteEntry[] = [];
    const giroPorPuestoId = new Map<string, string>();

    for (const entry of todosVacantes) {
      const asis = asistenciaPorPuestoId.get(entry.puesto.id);
      if (asis && esActividadValida(asis.comerciante?.actividad)) {
        giroPorPuestoId.set(entry.puesto.id, asis.comerciante.actividad.trim().toUpperCase());
      } else {
        puestosPendientesP2.push(entry);
      }
    }

    // Prioridad 2: Historial de Comerciantes en esa Nave/Puesto
    if (puestosPendientesP2.length > 0) {
      const codigosBuscados = Array.from(new Set(puestosPendientesP2.map((p) => p.puesto.codigo)));
      const comerciantesHistoricos = await prisma.comerciante.findMany({
        where: {
          puestoId: { in: codigosBuscados },
        },
        orderBy: { actualizadoEn: "desc" },
      });

      // Indexar comerciantes históricos por nave+puestoId y por puestoId
      const comMapPorNaveYPuesto = new Map<string, (typeof comerciantesHistoricos)[0]>();
      const comMapPorPuesto = new Map<string, (typeof comerciantesHistoricos)[0]>();

      for (const com of comerciantesHistoricos) {
        if (com.puestoId) {
          if (!comMapPorPuesto.has(com.puestoId)) {
            comMapPorPuesto.set(com.puestoId, com);
          }
          if (com.nave) {
            const key = `${com.nave.trim().toUpperCase()}__${com.puestoId.trim().toUpperCase()}`;
            if (!comMapPorNaveYPuesto.has(key)) {
              comMapPorNaveYPuesto.set(key, com);
            }
          }
        }
      }

      for (const entry of puestosPendientesP2) {
        const keyExacta = `${entry.nave.nombre.trim().toUpperCase()}__${entry.puesto.codigo.trim().toUpperCase()}`;
        const com = comMapPorNaveYPuesto.get(keyExacta) || comMapPorPuesto.get(entry.puesto.codigo);

        if (com && esActividadValida(com.actividad)) {
          giroPorPuestoId.set(entry.puesto.id, com.actividad.trim().toUpperCase());
        }
      }
    }

    // Prioridad 3: Inferencia por Vecindad en la Misma Sección de la Nave
    for (const entry of todosVacantes) {
      if (giroPorPuestoId.has(entry.puesto.id)) continue;

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
        let mejorPuesto = ocupadosNave[0];
        let menorDistancia = Infinity;

        for (const pOcup of ocupadosNave) {
          const numOcup = extraerNumero(pOcup.codigo);
          if (numOcup !== null) {
            const dist = Math.abs(numVacante - numOcup);
            if (dist < menorDistancia) {
              menorDistancia = dist;
              mejorPuesto = pOcup;
            }
          }
        }

        giroPorPuestoId.set(
          entry.puesto.id,
          mejorPuesto.comerciante!.actividad.trim().toUpperCase()
        );
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
