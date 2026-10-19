// ── API Route: /api/v1/auditoria/sesiones ─────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type {
  SesionControlSupervisor,
  EtiquetaControlSupervisor,
  ResumenSesionControl,
  DetalleComercianteControl,
} from "@/domain/models/auditoria.model";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get("busqueda")?.trim().toLowerCase();
    const supervisorId = searchParams.get("supervisorId");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    const where: Prisma.SesionControlSupervisorWhereInput = {};

    if (supervisorId) {
      where.supervisorId = supervisorId;
    }

    if (fechaDesde && fechaHasta) {
      where.fechaJornada = { gte: fechaDesde, lte: fechaHasta };
    } else if (fechaDesde) {
      where.fechaJornada = { gte: fechaDesde };
    } else if (fechaHasta) {
      where.fechaJornada = { lte: fechaHasta };
    }

    const sesiones = await prisma.sesionControlSupervisor.findMany({
      where,
      orderBy: { timestampInicio: "desc" },
    });

    let resultado: SesionControlSupervisor[] = sesiones.map((s) => ({
      id: s.id,
      supervisorId: s.supervisorId,
      supervisorNombre: s.supervisorNombre,
      naveId: s.naveId,
      naveNombre: s.naveNombre,
      fechaJornada: s.fechaJornada,
      timestampInicio: s.timestampInicio.toISOString(),
      timestampUltimaModificacion: s.timestampUltimaModificacion.toISOString(),
      accion: s.accion,
      esPersistencia: s.esPersistencia,
      fechaOrigenPersistencia: s.fechaOrigenPersistencia ?? undefined,
      comentarioPersistencia: s.comentarioPersistencia ?? undefined,
      modificadoTrasPersistencia: s.modificadoTrasPersistencia,
      tieneRetraso: s.tieneRetraso,
      detalleRetraso: s.detalleRetraso ?? undefined,
      etiquetas: Array.isArray(s.etiquetas)
        ? (s.etiquetas as unknown as EtiquetaControlSupervisor[])
        : [],
      resumen: s.resumen as unknown as ResumenSesionControl,
      detallesComerciantes: Array.isArray(s.detallesComerciantes)
        ? (s.detallesComerciantes as unknown as DetalleComercianteControl[])
        : [],
    }));

    if (busqueda) {
      resultado = resultado.filter(
        (s) =>
          s.supervisorNombre.toLowerCase().includes(busqueda) ||
          s.naveNombre.toLowerCase().includes(busqueda) ||
          s.accion.toLowerCase().includes(busqueda)
      );
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error en GET /api/v1/auditoria/sesiones:", error);
    return NextResponse.json({ error: "Error al consultar sesiones de auditoría." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: SesionControlSupervisor = await request.json();

    const created = await prisma.sesionControlSupervisor.create({
      data: {
        id: body.id,
        supervisorId: body.supervisorId,
        supervisorNombre: body.supervisorNombre,
        naveId: body.naveId,
        naveNombre: body.naveNombre,
        fechaJornada: body.fechaJornada,
        timestampInicio: body.timestampInicio ? new Date(body.timestampInicio) : new Date(),
        accion: body.accion,
        esPersistencia: body.esPersistencia ?? false,
        fechaOrigenPersistencia: body.fechaOrigenPersistencia ?? null,
        comentarioPersistencia: body.comentarioPersistencia ?? null,
        modificadoTrasPersistencia: body.modificadoTrasPersistencia ?? false,
        tieneRetraso: body.tieneRetraso ?? false,
        detalleRetraso: body.detalleRetraso ?? null,
        etiquetas: (body.etiquetas || []) as unknown as Prisma.InputJsonValue,
        resumen: body.resumen as unknown as Prisma.InputJsonValue,
        detallesComerciantes: (body.detallesComerciantes || []) as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/auditoria/sesiones:", error);
    return NextResponse.json({ error: "Error al registrar la sesión de control." }, { status: 500 });
  }
}
