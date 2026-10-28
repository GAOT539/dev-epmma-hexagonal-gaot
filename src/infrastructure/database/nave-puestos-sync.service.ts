// ── Servicio de Auto-Reconciliación y Sincronización de Puestos de Nave en BD ──

import { prisma } from "./prisma";
import { logInfo, logWarn } from "@/infrastructure/logger/system-logger";
export {
  descomponerCodigoPuesto,
  sonCodigosPuestosEquivalentes,
  normalizarNombreCompleto,
  sonMismoContribuyente,
  inferirNaveDesdePuesto,
  generarSlugNave,
  desglosarCodigosPuestoMultiples,
  expandirRegistrosMultiPuesto,
} from "./catastro-reconciliacion.service";
import {
  sonCodigosPuestosEquivalentes,
  generarSlugNave,
} from "./catastro-reconciliacion.service";

let colacionEspanolVerificada = false;

/**
 * Asegura automáticamente en MySQL que las columnas de nombres de nave
 * (`naves.nombre` y `comerciantes.nave`) utilicen colación en español (`utf8mb4_spanish_ci`),
 * permitiendo diferenciar nativamente 'N' de 'Ñ' tanto en índices únicos como en consultas SQL.
 */
export async function asegurarColacionEspanolEnBD(forzar: boolean = false): Promise<void> {
  if (colacionEspanolVerificada && !forzar) {
    return;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        tableName?: string;
        columnName?: string;
        collationName?: string;
        TABLE_NAME?: string;
        COLUMN_NAME?: string;
        COLLATION_NAME?: string;
      }[]
    >(`
      SELECT TABLE_NAME as tableName, COLUMN_NAME as columnName, COLLATION_NAME as collationName
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND ((TABLE_NAME = 'naves' AND COLUMN_NAME = 'nombre')
          OR (TABLE_NAME = 'comerciantes' AND COLUMN_NAME = 'nave'))
    `);

    let navesCollation = "";
    let comerciantesCollation = "";

    for (const r of rows) {
      const tbl = (r.tableName || r.TABLE_NAME || "").toLowerCase();
      const col = (r.columnName || r.COLUMN_NAME || "").toLowerCase();
      const coll = (r.collationName || r.COLLATION_NAME || "").toLowerCase();

      if (tbl === "naves" && col === "nombre") {
        navesCollation = coll;
      } else if (tbl === "comerciantes" && col === "nave") {
        comerciantesCollation = coll;
      }
    }

    const esValida = (c: string) =>
      c === "utf8mb4_spanish_ci" || c === "utf8mb4_es_0900_ai_ci";

    if (navesCollation && (!esValida(navesCollation) || (forzar && navesCollation !== "utf8mb4_spanish_ci"))) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `naves` MODIFY `nombre` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci NOT NULL;"
      );
      logInfo("DB-COLLATION", "Colación de `naves.nombre` actualizada a utf8mb4_spanish_ci.");
    }

    if (comerciantesCollation && (!esValida(comerciantesCollation) || (forzar && comerciantesCollation !== "utf8mb4_spanish_ci"))) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `comerciantes` MODIFY `nave` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci NULL;"
      );
      logInfo("DB-COLLATION", "Colación de `comerciantes.nave` actualizada a utf8mb4_spanish_ci.");
    }

    colacionEspanolVerificada = true;
  } catch (error) {
    logWarn(
      "DB-COLLATION",
      "No se pudo verificar/actualizar colación en español en este momento",
      error
    );
  }
}

/**
 * Reconcilia y garantiza la integridad estricta de la tabla `puestos` de una nave:
 * 1. Asegura que todo comerciante activo de la nave tenga su puesto creado y enlazado ("Ocupado").
 * 2. Limpia estados huérfanos o deshabilitados ("Vacante").
 * 3. Completa los puestos vacantes faltantes hasta alcanzar `nave.cantidadPuestos`.
 * 4. Ajusta la capacidad de la nave si el número de ocupados la supera.
 */
const syncEnVueloPorNave = new Map<string, Promise<unknown>>();
const navesYaVerificadasEnSesion = new Set<string>();

/**
 * Invalida el caché de naves verificadas en memoria cuando se modifica o crea una nave,
 * o cuando se importa un nuevo catastro.
 */
export function invalidarNavesYaVerificadas(naveId?: string): void {
  if (naveId) {
    navesYaVerificadasEnSesion.delete(naveId);
    navesYaVerificadasEnSesion.delete(generarSlugNave(naveId));
  } else {
    navesYaVerificadasEnSesion.clear();
  }
}

/**
 * Entrada pública con deduplicación de promesas en vuelo y memoria de naves verificadas.
 */
export async function sincronizarPuestosDeNaveEnBD(naveIdONombre: string): Promise<void> {
  if (!naveIdONombre) return;

  const termino = naveIdONombre.normalize("NFC").trim();
  const slug = generarSlugNave(termino);
  const cacheKey = slug || termino.toLowerCase();

  if (navesYaVerificadasEnSesion.has(cacheKey) || navesYaVerificadasEnSesion.has(termino)) {
    return;
  }

  const enVuelo = syncEnVueloPorNave.get(cacheKey);
  if (enVuelo) {
    await enVuelo;
    return;
  }

  const ejecucion = (async () => {
    await ejecutarSincronizacionPuestosDeNaveEnBD(naveIdONombre);
  })();

  syncEnVueloPorNave.set(cacheKey, ejecucion);
  try {
    await ejecucion;
    navesYaVerificadasEnSesion.add(cacheKey);
    navesYaVerificadasEnSesion.add(termino);
  } finally {
    syncEnVueloPorNave.delete(cacheKey);
  }
}

async function ejecutarSincronizacionPuestosDeNaveEnBD(naveIdONombre: string): Promise<void> {
  if (!naveIdONombre) return;

  const termino = naveIdONombre.normalize("NFC").trim();
  const slug = generarSlugNave(termino);

  // 1. Buscar la nave por id o nombre con validación TypeScript exacta
  const candidatos = await prisma.nave.findMany({
    where: {
      OR: [
        { id: termino },
        { nombre: termino },
        { id: slug },
        { nombre: termino.toUpperCase() },
      ],
    },
    include: {
      puestos: {
        include: { comerciante: true },
      },
    },
  });

  const targetUpper = termino.toUpperCase();
  const nave = candidatos.find(
    (n) =>
      n.nombre.normalize("NFC").trim().toUpperCase() === targetUpper ||
      n.id === termino ||
      n.id === slug
  );

  if (!nave) return;

  // 2. Obtener puestos actuales
  const puestos = await prisma.puesto.findMany({
    where: { naveId: nave.id },
    include: { comerciante: true },
  });

  // 3. Obtener comerciantes activos que pertenecen estrictamente a la nave por nombre o id
  const todosComerciantes = await prisma.comerciante.findMany({
    where: {
      estadoRegistro: "Habilitado",
      OR: [{ nave: nave.nombre }, { nave: nave.id }],
    },
  });

  const targetNaveNombre = nave.nombre.normalize("NFC").trim().toUpperCase();
  const comerciantes = todosComerciantes.filter(
    (c) =>
      c.nave?.normalize("NFC").trim().toUpperCase() === targetNaveNombre ||
      c.nave === nave.id
  );

  // ── Paso A: Garantizar que todo comerciante activo de la nave tenga su registro en puestos ──
  const candidatosIds = comerciantes
    .filter((c) => c.puestoId && c.puestoId !== "S/N" && c.puestoId.trim().length > 0)
    .map((c) => c.idInterno);

  const puestosOcupadosEnBD = candidatosIds.length > 0
    ? await prisma.puesto.findMany({
        where: { comercianteId: { in: candidatosIds } },
        select: { comercianteId: true },
      })
    : [];

  const setComerciantesOcupadosEnBD = new Set(
    puestosOcupadosEnBD.map((p) => p.comercianteId).filter(Boolean) as string[]
  );

  for (const com of comerciantes) {
    if (!com.puestoId || com.puestoId === "S/N" || com.puestoId.trim().length === 0) {
      continue;
    }
    const tienePuesto = puestos.some((p) => p.comercianteId === com.idInterno);
    if (!tienePuesto) {
      // Verificar si ya está ocupado en la BD sin hacer consultas individuales repetitivas
      if (setComerciantesOcupadosEnBD.has(com.idInterno)) {
        continue;
      }

      const codigoComerciante = com.puestoId.trim().toUpperCase();

      // Buscar si hay un puesto en la nave con el mismo código que esté "Vacante" y sin comerciante
      const puestoVacante = puestos.find(
        (p) =>
          p.estado === "Vacante" &&
          !p.comercianteId &&
          (p.codigo.trim().toUpperCase() === codigoComerciante ||
            sonCodigosPuestosEquivalentes(p.codigo, codigoComerciante))
      );

      if (puestoVacante) {
        await prisma.puesto.update({
          where: { id: puestoVacante.id },
          data: {
            estado: "Ocupado",
            comercianteId: com.idInterno,
          },
        });
        puestoVacante.estado = "Ocupado";
        puestoVacante.comercianteId = com.idInterno;
      } else {
        // Crear inmediatamente el registro en prisma.puesto
        const nuevoPuesto = await prisma.puesto.create({
          data: {
            id: crypto.randomUUID(),
            naveId: nave.id,
            codigo: codigoComerciante || "S/N",
            estado: "Ocupado",
            comercianteId: com.idInterno,
          },
          include: { comerciante: true },
        });
        puestos.push(nuevoPuesto);
      }
    }
  }

  // ── Paso B: Corregir estados inconsistentes ──
  const puestosActualizados = await prisma.puesto.findMany({
    where: { naveId: nave.id },
    include: { comerciante: true },
  });

  for (const p of puestosActualizados) {
    if (p.comercianteId) {
      if (p.comerciante && p.comerciante.estadoRegistro === "Habilitado") {
        if (p.estado !== "Ocupado") {
          await prisma.puesto.update({
            where: { id: p.id },
            data: { estado: "Ocupado" },
          });
        }
        if (p.comerciante.puestoId !== p.codigo) {
          await prisma.comerciante.update({
            where: { idInterno: p.comerciante.idInterno },
            data: { puestoId: p.codigo },
          });
        }
      } else {
        // Comerciante inexistente o Deshabilitado -> liberar puesto a Vacante
        await prisma.puesto.update({
          where: { id: p.id },
          data: { estado: "Vacante", comercianteId: null },
        });
      }
    } else if (p.estado === "Ocupado") {
      // Estado Ocupado sin comercianteId -> liberar puesto a Vacante
      await prisma.puesto.update({
        where: { id: p.id },
        data: { estado: "Vacante", comercianteId: null },
      });
    }
  }

  // ── Paso C: Completar o podar puestos vacantes hasta nave.cantidadPuestos ──
  const puestosActuales = await prisma.puesto.findMany({
    where: { naveId: nave.id },
  });

  // Limpiar vacantes duplicados con el mismo código (conservando prioritariamente el ocupado si existe)
  const codigosVistos = new Set<string>();
  const vacantesDuplicadosAEliminar: string[] = [];

  for (const p of puestosActuales) {
    const codNorm = p.codigo.trim().toUpperCase();
    if (p.estado === "Ocupado" || p.comercianteId) {
      codigosVistos.add(codNorm);
    }
  }

  for (const p of puestosActuales) {
    if (p.estado === "Vacante" && !p.comercianteId) {
      const codNorm = p.codigo.trim().toUpperCase();
      if (codigosVistos.has(codNorm)) {
        vacantesDuplicadosAEliminar.push(p.id);
      } else {
        codigosVistos.add(codNorm);
      }
    }
  }

  if (vacantesDuplicadosAEliminar.length > 0) {
    await prisma.puesto.deleteMany({
      where: { id: { in: vacantesDuplicadosAEliminar } },
    });
  }

  // Refrescar puestos tras eliminar duplicados
  let puestosFinales = await prisma.puesto.findMany({
    where: { naveId: nave.id },
  });

  const totalOcupados = puestosFinales.filter((p) => p.estado === "Ocupado").length;
  let capacidadObjetivo = nave.cantidadPuestos;

  if (totalOcupados > capacidadObjetivo) {
    capacidadObjetivo = totalOcupados;
    await prisma.nave.update({
      where: { id: nave.id },
      data: {
        cantidadPuestos: totalOcupados,
        limitePuestos: totalOcupados,
      },
    });
  }

  // Si tras la limpieza los puestos aún exceden la capacidad objetivo y hay vacantes sobrantes
  if (puestosFinales.length > capacidadObjetivo) {
    const exceso = puestosFinales.length - capacidadObjetivo;
    const vacantesSobrantes = puestosFinales
      .filter((p) => p.estado === "Vacante" && !p.comercianteId)
      .sort((a, b) => {
        const numA = parseInt(a.codigo, 10);
        const numB = parseInt(b.codigo, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.codigo.localeCompare(b.codigo);
      })
      .slice(-exceso);

    if (vacantesSobrantes.length > 0) {
      await prisma.puesto.deleteMany({
        where: { id: { in: vacantesSobrantes.map((p) => p.id) } },
      });
      puestosFinales = await prisma.puesto.findMany({
        where: { naveId: nave.id },
      });
    }
  }

  const totalPuestos = puestosFinales.length;
  if (totalPuestos < capacidadObjetivo) {
    const faltantes = capacidadObjetivo - totalPuestos;
    const codigosExistentes = new Set(puestosFinales.map((p) => p.codigo.trim().toUpperCase()));
    const numerosExistentes = new Set(
      puestosFinales
        .map((p) => {
          const num = parseInt(p.codigo.trim(), 10);
          return isNaN(num) ? null : num;
        })
        .filter((n): n is number => n !== null)
    );

    const nuevosVacantes = [];
    let num = 1;

    for (let i = 0; i < faltantes; i++) {
      while (codigosExistentes.has(String(num)) || numerosExistentes.has(num)) {
        num++;
      }
      const candidate = String(num);
      codigosExistentes.add(candidate);
      numerosExistentes.add(num);
      num++;

      nuevosVacantes.push({
        id: crypto.randomUUID(),
        naveId: nave.id,
        codigo: candidate,
        estado: "Vacante" as const,
        comercianteId: null,
      });
    }

    if (nuevosVacantes.length > 0) {
      await prisma.puesto.createMany({ data: nuevosVacantes });
    }
  }
}
