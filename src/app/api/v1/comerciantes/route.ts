// ── API Route: /api/v1/comerciantes ──────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoComerciante, Prisma } from "@prisma/client";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";
import { generarSlugNave } from "@/infrastructure/database/catastro-reconciliacion.service";
import { getAccessibleNaveIds } from "@/infrastructure/auth/authorization";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const puestoId = searchParams.get("puestoId");
    const puestosNave = searchParams.get("puestosNave");
    const naveParam = searchParams.get("nave");
    const accessibleNaveIds = await getAccessibleNaveIds(request);
    if (accessibleNaveIds?.length === 0) return NextResponse.json([]);

    // Consulta de puestos por nave
    if (puestosNave) {
      const puestos = await prisma.puesto.findMany({
        where: {
          naveId: puestosNave,
          ...(accessibleNaveIds ? { naveId: { in: accessibleNaveIds } } : {}),
        },
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
        const paramNorm = naveParam.normalize("NFC").trim();
        const paramSlug = generarSlugNave(paramNorm);
        const candidatos = await prisma.nave.findMany({
          where: {
            OR: [
              { id: paramNorm },
              { nombre: paramNorm },
              { id: paramSlug },
              { nombre: paramNorm.toUpperCase() },
            ],
          },
        });
        const paramUpper = paramNorm.toUpperCase();
        naveObj = candidatos.find(
          (n) =>
            n.nombre.normalize("NFC").trim().toUpperCase() === paramUpper ||
            n.id === paramNorm ||
            n.id === paramSlug
        ) || null;
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
    let whereGeneral: Prisma.ComercianteWhereInput = {
      estadoRegistro: { not: "Deshabilitado" },
    };

    if (accessibleNaveIds) {
      const navesAutorizadas = await prisma.nave.findMany({
        where: { id: { in: accessibleNaveIds } },
        select: { id: true, nombre: true },
      });
      const nombresNavesAutorizadas = navesAutorizadas.flatMap((n) => [n.id, n.nombre]);

      whereGeneral = {
        ...whereGeneral,
        OR: [
          { puesto: { naveId: { in: accessibleNaveIds } } },
          { nave: { in: nombresNavesAutorizadas } },
        ],
      };
    }

    const comerciantes = await prisma.comerciante.findMany({
      where: whereGeneral,
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

    // 1. Resolver la entidad Nave por ID o Nombre con validación exacta NFC
    let naveObj = null;
    if (nave) {
      const naveLimpia = String(nave).normalize("NFC").trim();
      const naveSlug = generarSlugNave(naveLimpia);
      const candidatos = await prisma.nave.findMany({
        where: {
          OR: [
            { id: naveLimpia },
            { nombre: naveLimpia },
            { id: naveSlug },
            { nombre: naveLimpia.toUpperCase() },
          ],
        },
      });
      const naveUpper = naveLimpia.toUpperCase();
      naveObj = candidatos.find(
        (n) =>
          n.nombre.normalize("NFC").trim().toUpperCase() === naveUpper ||
          n.id === naveLimpia ||
          n.id === naveSlug
      ) || null;
    }

    const nombreNaveFinal = naveObj ? naveObj.nombre : (nave ? String(nave).trim() : null);

    // 2. Si viene puestoId, verificar que no esté ya ocupado en esta nave por otro comerciante activo
    if (puestoId) {
      const codigoBuscado = String(puestoId).trim();

      const puestoExistente = await prisma.puesto.findFirst({
        where: {
          ...(naveObj ? { naveId: naveObj.id } : {}),
          OR: [{ id: codigoBuscado }, { codigo: codigoBuscado }],
        },
        include: { comerciante: true },
      });

      if (
        puestoExistente &&
        puestoExistente.estado === "Ocupado" &&
        puestoExistente.comerciante &&
        puestoExistente.comerciante.estadoRegistro === "Habilitado"
      ) {
        return NextResponse.json(
          {
            error: `El puesto ${puestoExistente.codigo} ya se encuentra ocupado en esta nave por ${puestoExistente.comerciante.contribuyente}.`,
          },
          { status: 400 }
        );
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el comerciante
      const nuevo = await tx.comerciante.create({
        data: {
          ciu: ciu ? String(ciu).trim() : "-",
          cedula: cleanCedula,
          contribuyente: String(contribuyente).trim(),
          actividad: actividad ? String(actividad).trim() : "General",
          puestoId: puestoId ? String(puestoId).trim() : null,
          nave: nombreNaveFinal,
          estadoRegistro: (estadoRegistro as EstadoComerciante) || "Habilitado",
          creadoPor: creadoPor ? String(creadoPor).trim() : null,
        },
      });

      // 2. Si trae puesto asignado, vincular y ocupar puesto en la nave correspondiente
      if (puestoId) {
        const codigoBuscado = String(puestoId).trim();

        const puestoObj = await tx.puesto.findFirst({
          where: {
            ...(naveObj ? { naveId: naveObj.id } : {}),
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

          // Sincronizar cantidadPuestos y limitePuestos de la nave si el nuevo puesto excede el límite
          const totalPuestosNave = await tx.puesto.count({
            where: { naveId: naveObj.id },
          });

          if (totalPuestosNave > naveObj.cantidadPuestos) {
            await tx.nave.update({
              where: { id: naveObj.id },
              data: {
                cantidadPuestos: totalPuestosNave,
                limitePuestos: Math.max(naveObj.limitePuestos, totalPuestosNave),
              },
            });
          }
        }
      }

      return nuevo;
    });

    if (puestoId) {
      await asegurarAsistenciaInicialDelDia(undefined, true);
    }

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/comerciantes:", error);
    const mensaje = error instanceof Error ? error.message : "Error interno al crear comerciante.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
