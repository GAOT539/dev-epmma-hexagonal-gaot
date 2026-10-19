// ── API Route: /api/v1/asistencia ─────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoAsistencia, Prisma } from "@prisma/client";
import type { ObservacionDetalle } from "@/domain/models/asistencia.model";
import type { DetalleComercianteControl, EtiquetaControlSupervisor } from "@/domain/models/auditoria.model";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");
    const comercianteId = searchParams.get("comercianteId");
    const naveId = searchParams.get("naveId");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    // Caso 1: Comerciante específico en una fecha
    if (comercianteId && fecha) {
      const registro = await prisma.registroAsistencia.findUnique({
        where: {
          comercianteId_fecha: { comercianteId, fecha },
        },
      });

      return NextResponse.json(registro ?? null);
    }

    // Caso 2: Comerciante específico en un rango de fechas
    if (comercianteId && fechaInicio && fechaFin) {
      const registros = await prisma.registroAsistencia.findMany({
        where: {
          comercianteId,
          fecha: { gte: fechaInicio, lte: fechaFin },
        },
        orderBy: { fecha: "asc" },
      });

      return NextResponse.json(registros);
    }

    // Caso 3: Nave específica en un rango de fechas
    if (naveId && fechaInicio && fechaFin) {
      // Buscar comerciantes de esa nave
      const puestosNave = await prisma.puesto.findMany({
        where: { naveId },
        select: { comercianteId: true },
      });
      const comercianteIds = puestosNave
        .map((p) => p.comercianteId)
        .filter((id): id is string => Boolean(id));

      const registros = await prisma.registroAsistencia.findMany({
        where: {
          comercianteId: { in: comercianteIds },
          fecha: { gte: fechaInicio, lte: fechaFin },
        },
        orderBy: { fecha: "asc" },
      });

      return NextResponse.json(registros);
    }

    // Caso 4: Rango global de fechas
    if (fechaInicio && fechaFin) {
      const registros = await prisma.registroAsistencia.findMany({
        where: {
          fecha: { gte: fechaInicio, lte: fechaFin },
        },
        orderBy: { fecha: "asc" },
      });

      return NextResponse.json(registros);
    }

    // Caso 5: Todos los registros de una fecha puntual
    if (fecha) {
      const registros = await prisma.registroAsistencia.findMany({
        where: { fecha },
      });

      return NextResponse.json(registros);
    }

    return NextResponse.json(
      { error: "Parámetros insuficientes. Se requiere fecha o rango de fechas." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en GET /api/v1/asistencia:", error);
    return NextResponse.json({ error: "Error al consultar asistencia." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      comercianteId,
      fecha,
      estado,
      observacion,
      observacionTexto,
      supervisorNombre = "Supervisor del Sistema",
    } = body;

    if (!comercianteId || !fecha || !estado) {
      return NextResponse.json(
        { error: "comercianteId, fecha y estado son requeridos." },
        { status: 400 }
      );
    }

    const comerciante = await prisma.comerciante.findUnique({
      where: { idInterno: comercianteId },
    });

    if (!comerciante) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }

    // Buscar el puesto del comerciante
    let puestoObj = await prisma.puesto.findFirst({
      where: {
        OR: [
          { comercianteId: comerciante.idInterno },
          ...(comerciante.puestoId ? [{ codigo: comerciante.puestoId }] : []),
        ],
      },
    });

    if (!puestoObj) {
      // Si no tiene puesto formal, asignar a la primera nave disponible o NAVE A
      const naveDefecto = await prisma.nave.findFirst();
      if (!naveDefecto) {
        return NextResponse.json({ error: "No existen naves registradas en el sistema." }, { status: 400 });
      }
      puestoObj = await prisma.puesto.create({
        data: {
          codigo: comerciante.puestoId || "S/N",
          naveId: naveDefecto.id,
          estado: "Ocupado",
          comercianteId: comerciante.idInterno,
        },
      });
    }

    // Upsert registro de asistencia
    const registroActualizado = await prisma.$transaction(async (tx) => {
      const existente = await tx.registroAsistencia.findUnique({
        where: {
          comercianteId_fecha: { comercianteId, fecha },
        },
      });

      const observacionesArray: ObservacionDetalle[] = Array.isArray(existente?.observaciones)
        ? (existente!.observaciones as unknown as ObservacionDetalle[])
        : [];

      if (observacionTexto) {
        observacionesArray.push({
          id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tipo: "ObservacionesGeneral",
          texto: observacionTexto,
          fechaHora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        });
      }

      const reg = await tx.registroAsistencia.upsert({
        where: {
          comercianteId_fecha: { comercianteId, fecha },
        },
        update: {
          estado: estado as EstadoAsistencia,
          observacion: observacion !== undefined ? observacion : existente?.observacion,
          observacionTexto: observacionTexto !== undefined ? observacionTexto : existente?.observacionTexto,
          observaciones: observacionesArray as unknown as Prisma.InputJsonValue,
        },
        create: {
          comercianteId,
          puestoId: puestoObj!.id,
          fecha,
          estado: estado as EstadoAsistencia,
          observacion: observacion || null,
          observacionTexto: observacionTexto || null,
          observaciones: observacionesArray as unknown as Prisma.InputJsonValue,
          permisos: [],
        },
      });

      // Sincronizar en sesiones_control_supervisor
      const nave = await tx.nave.findUnique({ where: { id: puestoObj!.naveId } });
      const supervisor = await tx.usuario.findFirst({
        where: { rol: "SUPERVISOR", estado: "Habilitado" },
      });

      if (nave && supervisor) {
        const sesionExistente = await tx.sesionControlSupervisor.findFirst({
          where: {
            naveId: nave.id,
            fechaJornada: fecha,
          },
        });

        const detalles: DetalleComercianteControl[] = Array.isArray(sesionExistente?.detallesComerciantes)
          ? (sesionExistente!.detallesComerciantes as unknown as DetalleComercianteControl[])
          : [];

        const indexExistente = detalles.findIndex((d) => d.comercianteId === comercianteId);
        const nuevoDetalle: DetalleComercianteControl = {
          comercianteId,
          ciu: comerciante.ciu,
          cedula: comerciante.cedula,
          contribuyente: comerciante.contribuyente,
          puesto: puestoObj!.codigo,
          estado: estado as EstadoAsistencia,
          metodo: "MANUAL",
          horaRegistro: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        };

        if (indexExistente >= 0) {
          detalles[indexExistente] = nuevoDetalle;
        } else {
          detalles.push(nuevoDetalle);
        }

        const presentes = detalles.filter((d) => d.estado === "Presente").length;
        const ausentes = detalles.filter((d) => d.estado === "Ausente").length;
        const permisos = detalles.filter((d) => d.estado === "Permiso").length;

        const resumen = {
          totalOcupados: detalles.length,
          tomados: detalles.length,
          presentes,
          ausentes,
          permisos,
        };

        const etiquetas: EtiquetaControlSupervisor[] = Array.isArray(sesionExistente?.etiquetas)
          ? (sesionExistente!.etiquetas as unknown as EtiquetaControlSupervisor[])
          : ["EN_FECHA"];

        let modificadoTrasPersistencia = sesionExistente?.modificadoTrasPersistencia || false;
        if (sesionExistente?.esPersistencia) {
          modificadoTrasPersistencia = true;
          if (!etiquetas.includes("MODIFICADO_TRAS_PERSISTENCIA")) {
            etiquetas.push("MODIFICADO_TRAS_PERSISTENCIA");
          }
        }

        if (sesionExistente) {
          await tx.sesionControlSupervisor.update({
            where: { id: sesionExistente.id },
            data: {
              resumen,
              detallesComerciantes: detalles as unknown as Prisma.InputJsonValue,
              etiquetas,
              modificadoTrasPersistencia,
            },
          });
        } else {
          await tx.sesionControlSupervisor.create({
            data: {
              supervisorId: supervisor.id,
              supervisorNombre: supervisorNombre || `${supervisor.nombres} ${supervisor.apellidos}`,
              naveId: nave.id,
              naveNombre: nave.nombre,
              fechaJornada: fecha,
              accion: "Control de asistencia",
              esPersistencia: false,
              etiquetas,
              resumen,
              detallesComerciantes: detalles as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      return reg;
    });

    return NextResponse.json({ success: true, registro: registroActualizado });
  } catch (error) {
    console.error("Error en POST /api/v1/asistencia:", error);
    return NextResponse.json({ error: "Error al registrar asistencia." }, { status: 500 });
  }
}
