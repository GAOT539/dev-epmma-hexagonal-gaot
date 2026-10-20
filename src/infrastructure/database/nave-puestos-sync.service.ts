// ── Servicio de Auto-Reconciliación y Sincronización de Puestos de Nave en BD ──

import { prisma } from "./prisma";
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
      console.log("[DB] Colación de `naves.nombre` actualizada a utf8mb4_spanish_ci.");
    }

    if (comerciantesCollation && (!esValida(comerciantesCollation) || (forzar && comerciantesCollation !== "utf8mb4_spanish_ci"))) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `comerciantes` MODIFY `nave` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci NULL;"
      );
      console.log("[DB] Colación de `comerciantes.nave` actualizada a utf8mb4_spanish_ci.");
    }

    colacionEspanolVerificada = true;
  } catch (error) {
    console.warn(
      "[DB] Aviso: No se pudo verificar/actualizar colación en español en este momento:",
      error instanceof Error ? error.message : error
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
export async function sincronizarPuestosDeNaveEnBD(naveIdONombre: string): Promise<void> {
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
  for (const com of comerciantes) {
    if (!com.puestoId || com.puestoId === "S/N" || com.puestoId.trim().length === 0) {
      continue;
    }
    const tienePuesto = puestos.some((p) => p.comercianteId === com.idInterno);
    if (!tienePuesto) {
      // Verificar previamente que este comerciante no esté ya asignado a ningún otro puesto en la base de datos
      const puestoOcupadoEnBD = await prisma.puesto.findUnique({
        where: { comercianteId: com.idInterno },
      });
      if (puestoOcupadoEnBD) {
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

  // ── Paso C: Completar puestos vacantes hasta nave.cantidadPuestos ──
  const puestosFinales = await prisma.puesto.findMany({
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

  const totalPuestos = puestosFinales.length;
  if (totalPuestos < capacidadObjetivo) {
    const faltantes = capacidadObjetivo - totalPuestos;
    const codigosExistentes = new Set(puestosFinales.map((p) => p.codigo.trim().toUpperCase()));
    const nuevosVacantes = [];
    let num = 1;

    for (let i = 0; i < faltantes; i++) {
      let candidate = `VACANTE-${String(num).padStart(2, "0")}`;
      while (codigosExistentes.has(candidate)) {
        num++;
        candidate = `VACANTE-${String(num).padStart(2, "0")}`;
      }
      codigosExistentes.add(candidate);
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
