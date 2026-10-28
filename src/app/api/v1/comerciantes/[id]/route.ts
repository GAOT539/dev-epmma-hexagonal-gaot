// ── API Route: /api/v1/comerciantes/[id] ──────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante, Prisma } from "@prisma/client";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";
import { generarSlugNave } from "@/infrastructure/database/catastro-reconciliacion.service";
import { logError } from "@/infrastructure/logger/system-logger";

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
    logError("COMERCIANTES:GET", "Error en GET /api/v1/comerciantes/[id]", error);
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
    const rawNave = body.nave !== undefined ? body.nave : (body.naveId !== undefined ? body.naveId : actual.nave);
    let naveObj = null;
    if (rawNave) {
      const naveTermino = String(rawNave).normalize("NFC").trim();
      const naveSlug = generarSlugNave(naveTermino);
      const candidatos = await prisma.nave.findMany({
        where: {
          OR: [
            { id: naveTermino },
            { nombre: naveTermino },
            { id: naveSlug },
            { nombre: naveTermino.toUpperCase() },
          ],
        },
      });
      const naveUpper = naveTermino.toUpperCase();
      naveObj = candidatos.find(
        (n) =>
          n.nombre.normalize("NFC").trim().toUpperCase() === naveUpper ||
          n.id === naveTermino ||
          n.id === naveSlug
      ) || null;
    }
    const nombreNaveFinal = naveObj ? naveObj.nombre : (rawNave ? String(rawNave).normalize("NFC").trim() : actual.nave);

    const esDeshabilitacion =
      (body.deshabilitadoPor !== undefined && body.deshabilitadoPor !== null && String(body.deshabilitadoPor).trim().length > 0) ||
      body.estadoRegistro === "Deshabilitado";

    const esHabilitacion =
      body.deshabilitadoPor === null ||
      body.deshabilitadoPor === "" ||
      body.estadoRegistro === "Habilitado";

    const nuevoEstado: EstadoComerciante = esDeshabilitacion
      ? "Deshabilitado"
      : esHabilitacion
      ? "Habilitado"
      : (body.estadoRegistro as EstadoComerciante) || actual.estadoRegistro;

    const deshabilitadoPorFinal = esDeshabilitacion
      ? (body.deshabilitadoPor ? String(body.deshabilitadoPor).trim() : actual.deshabilitadoPor || "Sistema")
      : (esHabilitacion ? null : actual.deshabilitadoPor);

    const puestoNuevo = esDeshabilitacion
      ? null
      : (body.puestoId !== undefined ? body.puestoId : actual.puestoId);

    const actualizado = await prisma.$transaction(async (tx) => {
      // Si la petición solicita deshabilitar al comerciante
      if (esDeshabilitacion) {
        const com = await tx.comerciante.update({
          where: { idInterno: id },
          data: {
            estadoRegistro: "Deshabilitado",
            deshabilitadoPor: deshabilitadoPorFinal,
            puestoId: null,
            modificadoPor: body.modificadoPor ? String(body.modificadoPor).trim() : actual.modificadoPor,
          },
        });

        // Liberar su puesto en la nave pasando a estado Vacante
        await tx.puesto.updateMany({
          where: { comercianteId: id },
          data: {
            estado: "Vacante",
            comercianteId: null,
          },
        });

        return com;
      }

      // 1. Actualizar datos del comerciante
      const com = await tx.comerciante.update({
        where: { idInterno: id },
        data: {
          ciu: body.ciu !== undefined ? String(body.ciu).trim() : actual.ciu,
          cedula: body.cedula !== undefined ? String(body.cedula).trim() : actual.cedula,
          contribuyente: body.contribuyente !== undefined ? String(body.contribuyente).trim() : actual.contribuyente,
          actividad: body.actividad !== undefined ? String(body.actividad).trim() : actual.actividad,
          puestoId: puestoNuevo,
          nave: nombreNaveFinal,
          estadoRegistro: nuevoEstado,
          deshabilitadoPor: deshabilitadoPorFinal,
          modificadoPor: body.modificadoPor ? String(body.modificadoPor).trim() : actual.modificadoPor,
        },
      });

      // 2. Sincronización bidireccional de puesto entre /catastro y /naves
      const puestoNuevoNormalizado = puestoNuevo ? String(puestoNuevo).trim().toUpperCase() : null;

      if (puestoNuevoNormalizado !== puestoAnterior || nombreNaveFinal !== actual.nave) {
        // Buscar el puesto que actualmente ocupa este comerciante
        const puestoActual = await tx.puesto.findFirst({
          where: { comercianteId: id },
        });

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
      await asegurarAsistenciaInicialDelDia(undefined, true);
    }

    return NextResponse.json(actualizado);
  } catch (error) {
    logError("COMERCIANTES:PUT", "Error en PUT /api/v1/comerciantes/[id]", error);
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

      // 2. Liberar el puesto a Vacante estrictamente por comercianteId
      await tx.puesto.updateMany({
        where: { comercianteId: id },
        data: {
          estado: "Vacante",
          comercianteId: null,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Comerciante deshabilitado exitosamente." });
  } catch (error) {
    logError("COMERCIANTES:DELETE", "Error en DELETE /api/v1/comerciantes/[id]", error);
    return NextResponse.json({ error: "Error al deshabilitar comerciante." }, { status: 500 });
  }
}
