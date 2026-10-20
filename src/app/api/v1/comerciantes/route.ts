// ── API Route: /api/v1/comerciantes ──────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante, Prisma } from "@prisma/client";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const puestoId = searchParams.get("puestoId");
    const puestosNave = searchParams.get("puestosNave");
    const naveParam = searchParams.get("nave");

    // Consulta de puestos por nave
    if (puestosNave) {
      const puestos = await prisma.puesto.findMany({
        where: { naveId: puestosNave },
      });

      const getCategoriaPeso = (codigo: string): number => {
        const upper = codigo.trim().toUpperCase();
        if (upper.startsWith("BODEGA")) return 1;
        if (upper.startsWith("CUBICULO") || upper.startsWith("CUBÍCULO")) return 2;
        if (upper.startsWith("NUCLEO") || upper.startsWith("NÚCLEO")) return 3;
        if (upper.startsWith("ZCF") || upper.startsWith("ZONA")) return 4;
        if (upper.startsWith("N-") || upper.startsWith("P-")) return 5;
        return 6;
      };

      puestos.sort((a, b) => {
        const pesoA = getCategoriaPeso(a.codigo);
        const pesoB = getCategoriaPeso(b.codigo);
        if (pesoA !== pesoB) return pesoA - pesoB;
        return a.codigo.trim().localeCompare(b.codigo.trim(), undefined, {
          numeric: true,
          sensitivity: "base",
        });
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
      let naveObj = null;
      if (naveParam) {
        naveObj = await prisma.nave.findFirst({
          where: { OR: [{ id: naveParam }, { nombre: naveParam }] },
        });
      }

      const wherePuesto: Prisma.PuestoWhereInput = {
        OR: [{ id: puestoId }, { codigo: puestoId }],
      };
      if (naveObj) {
        wherePuesto.naveId = naveObj.id;
      }

      const puesto = await prisma.puesto.findFirst({
        where: wherePuesto,
        include: { comerciante: true },
      });

      if (puesto?.comerciante && puesto.comerciante.estadoRegistro !== "Deshabilitado") {
        return NextResponse.json(puesto.comerciante);
      }

      // Si no encontró por puesto.comercianteId, buscar en comerciante.puestoId
      const whereComerciante: Prisma.ComercianteWhereInput = {
        puestoId,
        estadoRegistro: { not: "Deshabilitado" },
      };
      if (naveObj) {
        whereComerciante.OR = [{ nave: naveObj.nombre }, { nave: naveObj.id }];
      }

      const com = await prisma.comerciante.findFirst({
        where: whereComerciante,
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

      // 2. Si trae puesto asignado, vincular y ocupar puesto en la nave correspondiente
      if (puestoId) {
        const codigoBuscado = String(puestoId).trim();

        let naveObj = null;
        if (nave) {
          const naveLimpia = String(nave).trim();
          naveObj = await tx.nave.findFirst({
            where: {
              OR: [{ id: naveLimpia }, { nombre: naveLimpia }],
            },
          });
        }

        let puestoObj = null;
        if (naveObj) {
          puestoObj = await tx.puesto.findFirst({
            where: {
              naveId: naveObj.id,
              OR: [{ id: codigoBuscado }, { codigo: codigoBuscado }],
            },
          });
        } else {
          puestoObj = await tx.puesto.findFirst({
            where: {
              OR: [{ id: codigoBuscado }, { codigo: codigoBuscado }],
            },
          });
        }

        if (puestoObj) {
          // Ocupar puesto existente
          await tx.puesto.update({
            where: { id: puestoObj.id },
            data: {
              estado: "Ocupado",
              comercianteId: nuevo.idInterno,
            },
          });
        } else if (naveObj) {
          // Si el puesto no existe en la nave, crearlo directamente asociado a naveId
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
