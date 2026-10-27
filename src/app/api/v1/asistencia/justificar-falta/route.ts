// ── API Route: POST /api/v1/asistencia/justificar-falta ───────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import { parseISO, eachDayOfInterval, format } from "date-fns";
import type { ObservacionDetalle, PermisoDetalle } from "@/domain/models/asistencia.model";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { userCanAccessComerciante } from "@/infrastructure/auth/authorization";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { comercianteId, fechaInicio, fechaFin, motivo } = body as {
      comercianteId: string;
      fechaInicio: string;
      fechaFin: string;
      motivo: string;
    };

    if (!comercianteId || !fechaInicio || !fechaFin || !motivo?.trim()) {
      return NextResponse.json(
        { error: "comercianteId, fechaInicio, fechaFin y motivo son obligatorios." },
        { status: 400 }
      );
    }

    if (fechaInicio > fechaFin) {
      return NextResponse.json(
        { error: "La fecha de inicio no puede ser posterior a la fecha de fin." },
        { status: 400 }
      );
    }

    const hoyStr = obtenerFechaHoyEcuador();
    if (fechaFin > hoyStr) {
      return NextResponse.json(
        { error: "Solo se permite justificar faltas de días anteriores o hasta la fecha actual." },
        { status: 400 }
      );
    }

    if (!(await userCanAccessComerciante(request, comercianteId))) {
      return NextResponse.json(
        { error: "No tiene autorización para gestionar faltas de este comerciante." },
        { status: 403 }
      );
    }

    const comerciante = await prisma.comerciante.findUnique({
      where: { idInterno: comercianteId },
    });

    if (!comerciante) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    // Buscar puesto del comerciante
    let puesto = await prisma.puesto.findFirst({
      where: { comercianteId: comerciante.idInterno },
    });
    if (!puesto && comerciante.puestoId && comerciante.nave) {
      puesto = await prisma.puesto.findFirst({
        where: {
          codigo: comerciante.puestoId,
          nave: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
        },
      });
    }

    let puestoIdFinal = puesto?.id;
    if (!puestoIdFinal) {
      const ultimaAsistencia = await prisma.registroAsistencia.findFirst({
        where: { comercianteId },
        orderBy: { fecha: "desc" },
      });
      if (ultimaAsistencia?.puestoId) {
        puestoIdFinal = ultimaAsistencia.puestoId;
      }
    }

    if (!puestoIdFinal) {
      return NextResponse.json(
        { error: "No se encontró el puesto asociado al comerciante para registrar su asistencia." },
        { status: 400 }
      );
    }

    // Generar todas las fechas del rango
    const diasRango = eachDayOfInterval({
      start: parseISO(fechaInicio),
      end: parseISO(fechaFin),
    }).map((d) => format(d, "yyyy-MM-dd"));

    const horaActual = new Date().toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await prisma.$transaction(async (tx) => {
      for (const d of diasRango) {
        const existente = await tx.registroAsistencia.findUnique({
          where: {
            comercianteId_fecha: { comercianteId, fecha: d },
          },
        });

        const nuevaJustificacion: PermisoDetalle = {
          id: `just-perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          motivo: `Justificación de falta: ${motivo.trim()}`,
          fechaAsignacion: hoyStr,
          fechaInicio,
          fechaFin,
        };

        const nuevaObservacion: ObservacionDetalle = {
          id: `obs-just-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tipo: "ObservacionesGeneral",
          texto: `Falta justificada (registrada el ${hoyStr}): Motivo / Doc: ${motivo.trim()}`,
          fechaHora: horaActual,
        };

        const permsArray: PermisoDetalle[] = Array.isArray(existente?.permisos)
          ? [...(existente!.permisos as unknown as PermisoDetalle[]), nuevaJustificacion]
          : [nuevaJustificacion];

        const obsArray: ObservacionDetalle[] = Array.isArray(existente?.observaciones)
          ? [...(existente!.observaciones as unknown as ObservacionDetalle[]), nuevaObservacion]
          : [nuevaObservacion];

        await tx.registroAsistencia.upsert({
          where: {
            comercianteId_fecha: { comercianteId, fecha: d },
          },
          update: {
            estado: "Permiso",
            permisos: permsArray as unknown as Prisma.InputJsonValue,
            permisoInicio: fechaInicio,
            permisoFin: fechaFin,
            observaciones: obsArray as unknown as Prisma.InputJsonValue,
            observacion: nuevaObservacion.texto,
            observacionTexto: nuevaObservacion.texto,
          },
          create: {
            comercianteId,
            puestoId: puestoIdFinal,
            fecha: d,
            estado: "Permiso",
            permisos: permsArray as unknown as Prisma.InputJsonValue,
            permisoInicio: fechaInicio,
            permisoFin: fechaFin,
            observaciones: obsArray as unknown as Prisma.InputJsonValue,
            observacion: nuevaObservacion.texto,
            observacionTexto: nuevaObservacion.texto,
          },
        });

        // Actualizar sesión de supervisión de esa fecha si existiera
        if (puesto?.naveId) {
          const sesion = await tx.sesionControlSupervisor.findFirst({
            where: { naveId: puesto.naveId, fechaJornada: d },
          });

          if (sesion && Array.isArray(sesion.detallesComerciantes)) {
            const detalles = sesion.detallesComerciantes as unknown as Array<Record<string, unknown>>;
            const actualizados = detalles.map((det) =>
              det.comercianteId === comercianteId ? { ...det, estado: "Permiso" } : det
            );
            const presentes = actualizados.filter((det) => det.estado === "Presente").length;
            const ausentes = actualizados.filter((det) => det.estado === "Ausente").length;
            const permisos = actualizados.filter((det) => det.estado === "Permiso").length;

            await tx.sesionControlSupervisor.update({
              where: { id: sesion.id },
              data: {
                detallesComerciantes: actualizados as unknown as Prisma.InputJsonValue,
                resumen: {
                  ...(sesion.resumen as object),
                  presentes,
                  ausentes,
                  permisos,
                } as unknown as Prisma.InputJsonValue,
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true, diasJustificados: diasRango.length });
  } catch (error) {
    logError("API", "Error en POST /api/v1/asistencia/justificar-falta", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al justificar la falta del comerciante." },
      { status: 500 }
    );
  }
}
