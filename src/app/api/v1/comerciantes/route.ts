// ── API Route: /api/v1/comerciantes ──────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante } from "@prisma/client";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const puestoId = searchParams.get("puestoId");
    const puestosNave = searchParams.get("puestosNave");

    // Consulta de puestos por nave
    if (puestosNave) {
      const puestos = await prisma.puesto.findMany({
        where: { naveId: puestosNave },
        orderBy: { codigo: "asc" },
      });

      return NextResponse.json(
        puestos.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          naveId: p.naveId,
          estado: p.estado,
          comercianteId: p.comercianteId ?? undefined,
        }))
      );
    }

    // Consulta de comerciante por puesto
    if (puestoId) {
      const puesto = await prisma.puesto.findFirst({
        where: {
          OR: [{ id: puestoId }, { codigo: puestoId }],
        },
        include: { comerciante: true },
      });

      if (puesto?.comerciante && puesto.comerciante.estadoRegistro !== "Deshabilitado") {
        return NextResponse.json(puesto.comerciante);
      }

      // Si no encontró por puesto.comercianteId, buscar en comerciante.puestoId
      const com = await prisma.comerciante.findFirst({
        where: {
          puestoId,
          estadoRegistro: { not: "Deshabilitado" },
        },
      });

      return NextResponse.json(com ?? null);
    }

    // Consulta general de comerciantes activos
    const comerciantes = await prisma.comerciante.findMany({
      where: {
        estadoRegistro: { not: "Deshabilitado" },
      },
      orderBy: { creadoEn: "desc" },
    });

    return NextResponse.json(comerciantes);
  } catch (error) {
    console.error("Error en GET /api/v1/comerciantes:", error);
    return NextResponse.json({ error: "Error al obtener comerciantes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      ciu,
      cedula,
      contribuyente,
      actividad,
      puestoId,
      nave,
      estadoRegistro,
      creadoPor,
    } = body;

    if (!cedula || !contribuyente) {
      return NextResponse.json(
        { error: "Cédula y contribuyente son requeridos." },
        { status: 400 }
      );
    }

    const cleanCedula = String(cedula).trim();

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el comerciante
      const nuevo = await tx.comerciante.create({
        data: {
          ciu: ciu ? String(ciu).trim() : "-",
          cedula: cleanCedula,
          contribuyente: String(contribuyente).trim(),
          actividad: actividad ? String(actividad).trim() : "General",
          puestoId: puestoId ? String(puestoId).trim() : null,
          nave: nave ? String(nave).trim() : null,
          estadoRegistro: (estadoRegistro as EstadoComerciante) || "Habilitado",
          creadoPor: creadoPor ? String(creadoPor).trim() : null,
        },
      });

      // 2. Si trae puesto asignado, vincular y ocupar puesto
      if (puestoId) {
        const codigoBuscado = String(puestoId).trim();

        // Buscar si ya existe el puesto
        const puestoObj = await tx.puesto.findFirst({
          where: {
            OR: [{ id: codigoBuscado }, { codigo: codigoBuscado }],
          },
        });

        if (puestoObj) {
          // Ocupar puesto existente
          await tx.puesto.update({
            where: { id: puestoObj.id },
            data: {
              estado: "Ocupado",
              comercianteId: nuevo.idInterno,
            },
          });
        } else if (nave) {
          // Si el puesto no existe pero viene la nave, buscar la nave
          const naveObj = await tx.nave.findFirst({
            where: {
              OR: [{ id: nave }, { nombre: nave }],
            },
          });

          if (naveObj) {
            await tx.puesto.create({
              data: {
                codigo: codigoBuscado,
                naveId: naveObj.id,
                estado: "Ocupado",
                comercianteId: nuevo.idInterno,
              },
            });
          }
        }
      }

      return nuevo;
    });

    if (puestoId) {
      await asegurarAsistenciaInicialDelDia();
    }

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/comerciantes:", error);
    return NextResponse.json({ error: "Error interno al crear comerciante." }, { status: 500 });
  }
}
