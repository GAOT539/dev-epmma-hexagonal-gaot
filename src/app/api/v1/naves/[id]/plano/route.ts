// ── API Route: /api/v1/naves/[id]/plano ───────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type { PlanoEspacialNave, CeldaPlanoNave } from "@/domain/models/nave.model";
import { logError } from "@/infrastructure/logger/system-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const plano = await prisma.planoNave.findUnique({
      where: { naveId: id },
    });

    if (plano) {
      return NextResponse.json({
        naveId: plano.naveId,
        filas: plano.filas,
        columnas: plano.columnas,
        celdas: plano.planoJson as unknown as CeldaPlanoNave[],
        actualizadoEn: plano.actualizadoEn.toISOString(),
      });
    }

    // Si no existe plano aún en la BD, generar un lienzo 12x12 vacío
    const filas = 12;
    const columnas = 12;
    const celdas: CeldaPlanoNave[] = [];

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        celdas.push({
          fila: r,
          columna: c,
          tipo: "VACIO",
          rowSpan: 1,
          colSpan: 1,
        });
      }
    }

    return NextResponse.json({
      naveId: id,
      filas,
      columnas,
      celdas,
      actualizadoEn: new Date().toISOString(),
    });
  } catch (error) {
    logError("NAVES:PLANO:GET", "Error en GET /api/v1/naves/[id]/plano", error);
    return NextResponse.json({ error: "Error al obtener el plano de la nave." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body: PlanoEspacialNave = await request.json();

    const nave = await prisma.nave.findUnique({
      where: { id },
      include: { puestos: true },
    });

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const celdas = Array.isArray(body.celdas) ? body.celdas : [];

    // Validar cantidad de puestos únicos
    const puestosEnPlano = new Set(
      celdas
        .filter((c) => c.tipo === "PUESTO" && c.codigoPuesto?.trim())
        .map((c) => c.codigoPuesto!.trim().toUpperCase())
    );

    if (puestosEnPlano.size > nave.cantidadPuestos) {
      return NextResponse.json(
        {
          error: `El plano contiene ${puestosEnPlano.size} puestos comerciales configurados, lo cual excede el límite asignado a esta nave (${nave.cantidadPuestos} puestos).`,
        },
        { status: 400 }
      );
    }

    // Upsert plano en planos_naves
    const planoGuardado = await prisma.planoNave.upsert({
      where: { naveId: id },
      update: {
        filas: body.filas || 12,
        columnas: body.columnas || 12,
        planoJson: celdas as unknown as Prisma.InputJsonValue,
      },
      create: {
        naveId: id,
        filas: body.filas || 12,
        columnas: body.columnas || 12,
        planoJson: celdas as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      naveId: planoGuardado.naveId,
      filas: planoGuardado.filas,
      columnas: planoGuardado.columnas,
      celdas: planoGuardado.planoJson as unknown as CeldaPlanoNave[],
      actualizadoEn: planoGuardado.actualizadoEn.toISOString(),
    });
  } catch (error) {
    logError("NAVES:PLANO:PUT", "Error en PUT /api/v1/naves/[id]/plano", error);
    return NextResponse.json({ error: "Error al guardar el plano de la nave." }, { status: 500 });
  }
}
