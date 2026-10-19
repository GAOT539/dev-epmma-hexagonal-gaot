// ── Servicio de Auto-Reconciliación y Sincronización de Puestos de Nave en BD ──

import { prisma } from "./prisma";

/**
 * Reconcilia y garantiza la integridad estricta de la tabla `puestos` de una nave:
 * 1. Asegura que todo comerciante activo de la nave tenga su puesto creado y enlazado ("Ocupado").
 * 2. Limpia estados huérfanos o deshabilitados ("Vacante").
 * 3. Completa los puestos vacantes faltantes hasta alcanzar `nave.cantidadPuestos`.
 * 4. Ajusta la capacidad de la nave si el número de ocupados la supera.
 */
export async function sincronizarPuestosDeNaveEnBD(naveIdONombre: string): Promise<void> {
  if (!naveIdONombre) return;

  const termino = naveIdONombre.trim();

  // 1. Buscar la nave por id o nombre insensible a mayúsculas
  const nave = await prisma.nave.findFirst({
    where: {
      OR: [
        { id: termino },
        { nombre: termino },
        { id: termino.toLowerCase().replace(/\s+/g, "-") },
        { nombre: termino.toUpperCase() },
      ],
    },
    include: {
      puestos: {
        include: { comerciante: true },
      },
    },
  });

  if (!nave) return;

  // 2. Obtener puestos actuales
  const puestos = await prisma.puesto.findMany({
    where: { naveId: nave.id },
    include: { comerciante: true },
  });

  // Prefijo identificador de la nave (ej. N-A-, ZCF-, N-E-)
  const sufijoNave = nave.nombre.replace(/^NAVE\s+/i, "").trim().toUpperCase();
  const prefijoNave = `N-${sufijoNave}-`;

  // 3. Obtener comerciantes activos que pertenecen a la nave por nombre, id o prefijo de puesto
  const comerciantes = await prisma.comerciante.findMany({
    where: {
      estadoRegistro: "Habilitado",
      OR: [
        { nave: nave.nombre },
        { nave: nave.id },
        { puestoId: { contains: prefijoNave } },
        ...(sufijoNave === "CF" ? [{ puestoId: { contains: "ZCF-" } }] : []),
      ],
    },
  });

  // ── Paso A: Garantizar que todo comerciante activo de la nave tenga su registro en puestos ──
  for (const com of comerciantes) {
    const tienePuesto = puestos.some((p) => p.comercianteId === com.idInterno);
    if (!tienePuesto) {
      const codigoComerciante = (com.puestoId || "").trim().toUpperCase();

      // Buscar si hay un puesto en la nave con el mismo código que esté "Vacante" y sin comerciante
      const puestoVacante = puestos.find(
        (p) =>
          p.estado === "Vacante" &&
          !p.comercianteId &&
          p.codigo.trim().toUpperCase() === codigoComerciante
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
