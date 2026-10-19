// ── API Route: /api/v1/asistencia/permisos ────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type { PermisoDetalle } from "@/domain/models/asistencia.model";
import { parseISO, format, addDays, isBefore, isEqual } from "date-fns";

function generarRangoFechas(fechaInicio: string, fechaFin: string): string[] {
  const fechas: string[] = [];
  let curr = parseISO(fechaInicio);
  const fin = parseISO(fechaFin);

  while (isBefore(curr, fin) || isEqual(curr, fin)) {
    fechas.push(format(curr, "yyyy-MM-dd"));
    curr = addDays(curr, 1);
  }

  return fechas;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      comercianteId,
      fechaAsignacion = format(new Date(), "yyyy-MM-dd"),
      motivo,
      fechaInicio,
      fechaFin,
    } = body;

    if (!comercianteId || !motivo || !fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: "comercianteId, motivo, fechaInicio y fechaFin son requeridos." },
        { status: 400 }
      );
    }

    const comerciante = await prisma.comerciante.findUnique({
      where: { idInterno: comercianteId },
    });

    if (!comerciante) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    // Buscar puesto
    let puesto = await prisma.puesto.findFirst({
      where: {
        OR: [
          { comercianteId: comerciante.idInterno },
          ...(comerciante.puestoId ? [{ codigo: comerciante.puestoId }] : []),
        ],
      },
    });

    if (!puesto) {
      const nave = await prisma.nave.findFirst();
      if (!nave) return NextResponse.json({ error: "No hay naves en el sistema." }, { status: 400 });
      puesto = await prisma.puesto.create({
        data: {
          codigo: comerciante.puestoId || "S/N",
          naveId: nave.id,
          estado: "Ocupado",
          comercianteId: comerciante.idInterno,
        },
      });
    }

    const nuevoPermiso = {
      id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      motivo: String(motivo).trim(),
      fechaAsignacion,
      fechaInicio,
      fechaFin,
    };

    const diasRango = generarRangoFechas(fechaInicio, fechaFin);

    await prisma.$transaction(async (tx) => {
      for (const d of diasRango) {
        const reg = await tx.registroAsistencia.findUnique({
          where: { comercianteId_fecha: { comercianteId, fecha: d } },
        });

        const permisos = Array.isArray(reg?.permisos)
          ? (reg!.permisos as unknown as PermisoDetalle[])
          : [];
        permisos.push(nuevoPermiso);

        await tx.registroAsistencia.upsert({
          where: { comercianteId_fecha: { comercianteId, fecha: d } },
          update: {
            estado: "Permiso",
            permisoInicio: fechaInicio,
            permisoFin: fechaFin,
            permisos: permisos as unknown as Prisma.InputJsonValue,
          },
          create: {
            comercianteId,
            puestoId: puesto!.id,
            fecha: d,
            estado: "Permiso",
            permisoInicio: fechaInicio,
            permisoFin: fechaFin,
            observaciones: [],
            permisos: [nuevoPermiso] as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    return NextResponse.json(nuevoPermiso, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/asistencia/permisos:", error);
    return NextResponse.json({ error: "Error al registrar el permiso." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const comercianteId = searchParams.get("comercianteId");
    const permisoId = searchParams.get("permisoId");

    if (!comercianteId || !permisoId) {
      return NextResponse.json(
        { error: "comercianteId y permisoId son obligatorios." },
        { status: 400 }
      );
    }

    // Buscar todos los registros del comerciante que contengan este permiso
    const registros = await prisma.registroAsistencia.findMany({
      where: { comercianteId },
    });

    const registrosConPermiso = registros.filter((r) => {
      const perms = Array.isArray(r.permisos)
        ? (r.permisos as unknown as PermisoDetalle[])
        : [];
      return perms.some((p) => p.id === permisoId);
    });

    if (registrosConPermiso.length === 0) {
      return NextResponse.json({ error: "Permiso no encontrado." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const reg of registrosConPermiso) {
        const perms = Array.isArray(reg.permisos)
          ? (reg.permisos as unknown as PermisoDetalle[])
          : [];
        const filtrados = perms.filter((p) => p.id !== permisoId);

        // Si ya no le quedan permisos, revertir estado a Presente
        const nuevoEstado = filtrados.length > 0 ? "Permiso" : "Presente";
        const nuevoInicio = filtrados.length > 0 ? filtrados[0].fechaInicio : null;
        const nuevoFin = filtrados.length > 0 ? filtrados[0].fechaFin : null;

        await tx.registroAsistencia.update({
          where: { id: reg.id },
          data: {
            estado: nuevoEstado,
            permisoInicio: nuevoInicio,
            permisoFin: nuevoFin,
            permisos: filtrados as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Permiso eliminado y jornadas revertidas a Presente." });
  } catch (error) {
    console.error("Error en DELETE /api/v1/asistencia/permisos:", error);
    return NextResponse.json({ error: "Error al eliminar el permiso." }, { status: 500 });
  }
}
