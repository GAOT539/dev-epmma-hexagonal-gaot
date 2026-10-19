// ── API Route: /api/v1/comerciantes/[id] ──────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante } from "@prisma/client";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const comerciante = await prisma.comerciante.findUnique({
      where: { idInterno: id },
    });

    if (!comerciante || comerciante.estadoRegistro === "Deshabilitado") {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    return NextResponse.json(comerciante);
  } catch (error) {
    console.error("Error en GET /api/v1/comerciantes/[id]:", error);
    return NextResponse.json({ error: "Error al obtener comerciante." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const actual = await prisma.comerciante.findUnique({
      where: { idInterno: id },
    });

    if (!actual) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    const puestoAnterior = actual.puestoId;
    const puestoNuevo = body.puestoId !== undefined ? body.puestoId : actual.puestoId;
    const naveNueva = body.nave !== undefined ? body.nave : actual.nave;

    const actualizado = await prisma.$transaction(async (tx) => {
      // 1. Actualizar datos del comerciante
      const com = await tx.comerciante.update({
        where: { idInterno: id },
        data: {
          ciu: body.ciu !== undefined ? String(body.ciu).trim() : actual.ciu,
          cedula: body.cedula !== undefined ? String(body.cedula).trim() : actual.cedula,
          contribuyente: body.contribuyente !== undefined ? String(body.contribuyente).trim() : actual.contribuyente,
          actividad: body.actividad !== undefined ? String(body.actividad).trim() : actual.actividad,
          puestoId: puestoNuevo,
          nave: naveNueva,
          estadoRegistro: body.estadoRegistro ? (body.estadoRegistro as EstadoComerciante) : actual.estadoRegistro,
          modificadoPor: body.modificadoPor ? String(body.modificadoPor).trim() : actual.modificadoPor,
        },
      });

      // 2. Si cambió de puesto, reasignar en la tabla puestos
      if (puestoNuevo !== puestoAnterior) {
        // Liberar puesto anterior
        if (puestoAnterior) {
          await tx.puesto.updateMany({
            where: {
              OR: [{ id: puestoAnterior }, { codigo: puestoAnterior }],
              comercianteId: id,
            },
            data: {
              estado: "Vacante",
              comercianteId: null,
            },
          });
        }

        // Ocupar nuevo puesto si no es nulo
        if (puestoNuevo) {
          const nuevoPuestoObj = await tx.puesto.findFirst({
            where: {
              OR: [{ id: puestoNuevo }, { codigo: puestoNuevo }],
            },
          });

          if (nuevoPuestoObj) {
            await tx.puesto.update({
              where: { id: nuevoPuestoObj.id },
              data: {
                estado: "Ocupado",
                comercianteId: id,
              },
            });
          } else if (naveNueva) {
            const naveObj = await tx.nave.findFirst({
              where: { OR: [{ id: naveNueva }, { nombre: naveNueva }] },
            });
            if (naveObj) {
              await tx.puesto.create({
                data: {
                  codigo: puestoNuevo,
                  naveId: naveObj.id,
                  estado: "Ocupado",
                  comercianteId: id,
                },
              });
            }
          }
        }
      }

      return com;
    });

    if (puestoNuevo) {
      await asegurarAsistenciaInicialDelDia();
    }

    return NextResponse.json(actualizado);
  } catch (error) {
    console.error("Error en PUT /api/v1/comerciantes/[id]:", error);
    return NextResponse.json({ error: "Error al actualizar comerciante." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const actual = await prisma.comerciante.findUnique({
      where: { idInterno: id },
    });

    if (!actual) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft delete del comerciante
      await tx.comerciante.update({
        where: { idInterno: id },
        data: {
          estadoRegistro: "Deshabilitado",
          puestoId: null,
        },
      });

      // 2. Liberar el puesto a Vacante
      if (actual.puestoId) {
        await tx.puesto.updateMany({
          where: {
            OR: [{ id: actual.puestoId }, { codigo: actual.puestoId }],
          },
          data: {
            estado: "Vacante",
            comercianteId: null,
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Comerciante deshabilitado exitosamente." });
  } catch (error) {
    console.error("Error en DELETE /api/v1/comerciantes/[id]:", error);
    return NextResponse.json({ error: "Error al deshabilitar comerciante." }, { status: 500 });
  }
}
