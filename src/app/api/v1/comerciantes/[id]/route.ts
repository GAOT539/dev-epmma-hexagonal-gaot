// ── API Route: /api/v1/comerciantes/[id] ──────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante, Prisma } from "@prisma/client";
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

      // 2. Sincronización bidireccional de puesto entre /catastro y /naves
      const puestoNuevoNormalizado = puestoNuevo ? String(puestoNuevo).trim().toUpperCase() : null;

      if (puestoNuevoNormalizado !== puestoAnterior || naveNueva !== actual.nave) {
        // Buscar el puesto que actualmente ocupa este comerciante
        const puestoActual = await tx.puesto.findFirst({
          where: { comercianteId: id },
        });

        // Determinar nave destino
        let naveObj = null;
        if (naveNueva) {
          naveObj = await tx.nave.findFirst({
            where: {
              OR: [{ id: naveNueva }, { nombre: naveNueva }],
            },
          });
        }
        if (!naveObj && actual.nave) {
          naveObj = await tx.nave.findFirst({
            where: {
              OR: [{ id: actual.nave }, { nombre: actual.nave }],
            },
          });
        }

        if (puestoActual && naveObj && puestoActual.naveId === naveObj.id && puestoNuevoNormalizado) {
          // Permanece en la misma nave
          // Verificar si existe OTRO puesto en esa nave en estado Vacante con el nuevo código
          const otroPuestoVacante = await tx.puesto.findFirst({
            where: {
              naveId: naveObj.id,
              id: { not: puestoActual.id },
              estado: "Vacante",
              codigo: puestoNuevoNormalizado,
            },
          });

          if (otroPuestoVacante) {
            // Caso A: Cambio a un puesto vacante existente en la misma nave
            await tx.puesto.update({
              where: { id: puestoActual.id },
              data: { estado: "Vacante", comercianteId: null },
            });
            await tx.puesto.update({
              where: { id: otroPuestoVacante.id },
              data: { estado: "Ocupado", comercianteId: id },
            });
          } else {
            // Caso B: Renombrado/Corrección del código de su propio puesto
            const codigoAnteriorPuesto = puestoActual.codigo;
            await tx.puesto.update({
              where: { id: puestoActual.id },
              data: { codigo: puestoNuevoNormalizado, estado: "Ocupado", comercianteId: id },
            });

            // Sincronizar en planos_naves si estaba ubicado en el croquis
            const plano = await tx.planoNave.findFirst({
              where: { naveId: naveObj.id },
            });
            if (plano && Array.isArray(plano.planoJson)) {
              let huboCambioPlano = false;
              const celdas = (plano.planoJson as unknown as Record<string, unknown>[]).map((c) => {
                if (c.tipo === "PUESTO" && (c.codigoPuesto === codigoAnteriorPuesto || c.codigoPuesto === `#${codigoAnteriorPuesto}`)) {
                  huboCambioPlano = true;
                  return { ...c, codigoPuesto: puestoNuevoNormalizado };
                }
                return c;
              });
              if (huboCambioPlano) {
                await tx.planoNave.update({
                  where: { id: plano.id },
                  data: { planoJson: celdas as unknown as Prisma.InputJsonValue },
                });
              }
            }
          }
        } else {
          // El comerciante cambió de nave o no tenía puesto previo o se le quitó el puesto
          if (puestoActual) {
            await tx.puesto.update({
              where: { id: puestoActual.id },
              data: { estado: "Vacante", comercianteId: null },
            });
          }

          if (puestoNuevoNormalizado && naveObj) {
            const puestoEnNuevaNave = await tx.puesto.findFirst({
              where: {
                naveId: naveObj.id,
                codigo: puestoNuevoNormalizado,
                estado: "Vacante",
              },
            });

            if (puestoEnNuevaNave) {
              await tx.puesto.update({
                where: { id: puestoEnNuevaNave.id },
                data: { estado: "Ocupado", comercianteId: id },
              });
            } else {
              await tx.puesto.create({
                data: {
                  codigo: puestoNuevoNormalizado,
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
