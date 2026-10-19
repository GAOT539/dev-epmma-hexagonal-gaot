// ── API Route: /api/v1/naves/[id]/puestos ──────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const getCategoriaPeso = (codigo: string): number => {
  const upper = (codigo || "").trim().toUpperCase();
  if (upper.startsWith("BODEGA")) return 1;
  if (upper.startsWith("CUBICULO") || upper.startsWith("CUBÍCULO")) return 2;
  if (upper.startsWith("NUCLEO") || upper.startsWith("NÚCLEO")) return 3;
  if (upper.startsWith("ZCF") || upper.startsWith("ZONA")) return 4;
  if (upper.startsWith("N-") || upper.startsWith("P-")) return 5;
  return 6;
};

function ordenarPuestos<T extends { codigo: string }>(puestos: T[]): T[] {
  return [...puestos].sort((a, b) => {
    const pesoA = getCategoriaPeso(a.codigo);
    const pesoB = getCategoriaPeso(b.codigo);
    if (pesoA !== pesoB) return pesoA - pesoB;
    return (a.codigo || "").trim().localeCompare((b.codigo || "").trim(), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const nave = await prisma.nave.findUnique({
      where: { id },
    });

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const puestos = await prisma.puesto.findMany({
      where: { naveId: id },
      include: {
        comerciante: {
          select: {
            idInterno: true,
            ciu: true,
            cedula: true,
            contribuyente: true,
            actividad: true,
            estadoRegistro: true,
          },
        },
      },
    });

    const puestosOrdenados = ordenarPuestos(puestos);

    return NextResponse.json(
      puestosOrdenados.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        naveId: p.naveId,
        estado: p.estado,
        comercianteId: p.comercianteId ?? undefined,
        comerciante: p.comerciante
          ? {
              idInterno: p.comerciante.idInterno,
              ciu: p.comerciante.ciu,
              cedula: p.comerciante.cedula,
              contribuyente: p.comerciante.contribuyente,
              actividad: p.comerciante.actividad,
              estadoRegistro: p.comerciante.estadoRegistro,
            }
          : null,
      }))
    );
  } catch (error) {
    console.error("Error en GET /api/v1/naves/[id]/puestos:", error);
    return NextResponse.json(
      { error: "Error al obtener puestos de la nave." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const nave = await prisma.nave.findUnique({
      where: { id },
    });

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const listaCambios: Array<{ puestoId: string; nuevoCodigo: string }> =
      Array.isArray(body.cambios)
        ? body.cambios
        : body.puestoId && body.nuevoCodigo !== undefined
        ? [{ puestoId: body.puestoId, nuevoCodigo: body.nuevoCodigo }]
        : [];

    if (listaCambios.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron cambios válidos de puesto." },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener plano si existe para sincronizar códigos espaciales
      const plano = await tx.planoNave.findFirst({
        where: { naveId: id },
      });
      let celdasPlano: Record<string, unknown>[] =
        plano && Array.isArray(plano.planoJson)
          ? [...(plano.planoJson as unknown as Record<string, unknown>[])]
          : [];
      let huboCambioPlano = false;

      for (const cambio of listaCambios) {
        if (!cambio.puestoId) continue;
        const nuevoCodigoLimpio = String(cambio.nuevoCodigo || "").trim().toUpperCase();
        if (!nuevoCodigoLimpio) continue;

        const puesto = await tx.puesto.findUnique({
          where: { id: cambio.puestoId },
        });

        if (!puesto || puesto.naveId !== id) continue;

        const codigoAnterior = puesto.codigo;
        if (codigoAnterior === nuevoCodigoLimpio) continue;

        // A. Actualizar código del puesto
        await tx.puesto.update({
          where: { id: puesto.id },
          data: { codigo: nuevoCodigoLimpio },
        });

        // B. Regla de Integridad: Si el puesto está ocupado, sincronizar el comerciante asignado
        if (puesto.estado === "Ocupado" && puesto.comercianteId) {
          await tx.comerciante.update({
            where: { idInterno: puesto.comercianteId },
            data: { puestoId: nuevoCodigoLimpio },
          });
        }

        // C. Sincronizar en el croquis (PlanoNave)
        if (celdasPlano.length > 0) {
          celdasPlano = celdasPlano.map((c) => {
            if (c.tipo === "PUESTO" && (c.codigoPuesto === codigoAnterior || c.codigoPuesto === `#${codigoAnterior}`)) {
              huboCambioPlano = true;
              return { ...c, codigoPuesto: nuevoCodigoLimpio };
            }
            return c;
          });
        }
      }

      if (huboCambioPlano && plano) {
        await tx.planoNave.update({
          where: { id: plano.id },
          data: { planoJson: celdasPlano as unknown as Prisma.InputJsonValue },
        });
      }

      // Obtener puestos actualizados
      const puestosActualizados = await tx.puesto.findMany({
        where: { naveId: id },
        include: {
          comerciante: {
            select: {
              idInterno: true,
              ciu: true,
              cedula: true,
              contribuyente: true,
              actividad: true,
              estadoRegistro: true,
            },
          },
        },
      });

      return ordenarPuestos(puestosActualizados);
    });

    return NextResponse.json({
      success: true,
      mensaje: "Puestos actualizados correctamente.",
      puestos: resultado.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        naveId: p.naveId,
        estado: p.estado,
        comercianteId: p.comercianteId ?? undefined,
        comerciante: p.comerciante
          ? {
              idInterno: p.comerciante.idInterno,
              ciu: p.comerciante.ciu,
              cedula: p.comerciante.cedula,
              contribuyente: p.comerciante.contribuyente,
              actividad: p.comerciante.actividad,
              estadoRegistro: p.comerciante.estadoRegistro,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error en PUT /api/v1/naves/[id]/puestos:", error);
    return NextResponse.json(
      { error: "Error al actualizar puestos de la nave." },
      { status: 500 }
    );
  }
}
