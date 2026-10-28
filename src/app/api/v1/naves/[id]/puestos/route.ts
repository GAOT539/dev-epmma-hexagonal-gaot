import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import {
  sincronizarPuestosDeNaveEnBD,
  generarSlugNave,
  invalidarVerificacionNave,
} from "@/infrastructure/database/nave-puestos-sync.service";
import { ordenarPuestos } from "@/infrastructure/database/catastro-reconciliacion.service";
import { logError } from "@/infrastructure/logger/system-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idNorm = id.normalize("NFC").trim();
    const slug = generarSlugNave(idNorm);

    // Auto-reconciliación de puestos de la nave en base de datos
    await sincronizarPuestosDeNaveEnBD(idNorm);

    const candidatos = await prisma.nave.findMany({
      where: {
        OR: [
          { id: idNorm },
          { nombre: idNorm },
          { id: slug },
          { nombre: idNorm.toUpperCase() },
        ],
      },
    });

    const targetUpper = idNorm.toUpperCase();
    const nave = candidatos.find(
      (n) =>
        n.nombre.normalize("NFC").trim().toUpperCase() === targetUpper ||
        n.id === idNorm ||
        n.id === slug
    );

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const puestos = await prisma.puesto.findMany({
      where: { naveId: nave.id },
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

    const listaFormateada = puestosOrdenados.map((p) => ({
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
    }));

    return NextResponse.json({
      exito: true,
      puestos: listaFormateada,
    });
  } catch (error) {
    logError("NAVES:PUESTOS:GET", "Error en GET /api/v1/naves/[id]/puestos", error);
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

    invalidarVerificacionNave(id);

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
    logError("NAVES:PUESTOS:PUT", "Error en PUT /api/v1/naves/[id]/puestos", error);
    return NextResponse.json(
      { error: "Error al actualizar puestos de la nave." },
      { status: 500 }
    );
  }
}
