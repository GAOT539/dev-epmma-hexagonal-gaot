// ── API Route: /api/v1/asistencia/observaciones ───────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type { ObservacionDetalle } from "@/domain/models/asistencia.model";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { verificarDiaNoLaborableNave } from "@/infrastructure/database/calendario-operativo.service";
import { userCanAccessComerciante, getAuthenticatedUser } from "@/infrastructure/auth/authorization";
import { asegurarSesionControlActivaDia } from "@/infrastructure/database/sesion-control-helper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      comercianteId,
      fecha,
      texto,
      tipo = "ObservacionesGeneral",
      numeroDocumento,
      fechaHora,
    } = body;

    const hoyStr = obtenerFechaHoyEcuador();
    if (fecha !== hoyStr) {
      return NextResponse.json(
        { error: "Solo se permite registrar o modificar asistencia en la fecha actual." },
        { status: 400 }
      );
    }

    if (!comercianteId || !fecha || !texto?.trim()) {
      return NextResponse.json(
        { error: "comercianteId, fecha y texto son requeridos." },
        { status: 400 }
      );
    }

    // Regla de negocio: Si es Citaciones o Notificación, numeroDocumento es obligatorio
    const tipoNorm = String(tipo);
    if (
      (tipoNorm === "Citaciones" || tipoNorm === "Notificacion" || tipoNorm === "Notificación") &&
      (!numeroDocumento || !String(numeroDocumento).trim())
    ) {
      return NextResponse.json(
        { error: "Para Citaciones o Notificaciones se requiere ingresar el número de documento." },
        { status: 400 }
      );
    }

    const comerciante = await prisma.comerciante.findUnique({
      where: { idInterno: comercianteId },
    });

    if (!comerciante) {
      return NextResponse.json({ error: "Comerciante no encontrado." }, { status: 404 });
    }
    if (!(await userCanAccessComerciante(request, comercianteId))) {
      return NextResponse.json({ error: "El comerciante no pertenece a una nave asignada." }, { status: 403 });
    }

    // Buscar puesto
    let puesto = await prisma.puesto.findFirst({ where: { comercianteId: comerciante.idInterno } });
    if (!puesto && comerciante.puestoId && comerciante.nave) {
      puesto = await prisma.puesto.findFirst({
        where: {
          codigo: comerciante.puestoId,
          nave: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
        },
      });
    }

    if (!puesto) {
      const nave = comerciante.nave
        ? await prisma.nave.findFirst({
            where: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
          })
        : null;
      if (!nave) {
        return NextResponse.json({ error: "No hay naves en el sistema." }, { status: 400 });
      }
      puesto = await prisma.puesto.create({
        data: {
          codigo: comerciante.puestoId || "S/N",
          naveId: nave.id,
          estado: "Ocupado",
          comercianteId: comerciante.idInterno,
        },
      });
    }

    const checkNoLab = await verificarDiaNoLaborableNave(puesto.naveId, fecha);
    if (checkNoLab.esNoLaborable) {
      return NextResponse.json(
        {
          error: `No se permite registrar asistencia ni observaciones porque la fecha ${fecha} está configurada como Día No Laborable en esta nave (${checkNoLab.motivo}).`,
        },
        { status: 400 }
      );
    }

    const nuevaObservacion: ObservacionDetalle = {
      id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tipo: (tipoNorm.includes("Notifica") ? "Notificación" : tipoNorm) as ObservacionDetalle["tipo"],
      numeroDocumento: numeroDocumento ? String(numeroDocumento).trim() : undefined,
      texto: String(texto).trim(),
      fechaHora:
        fechaHora ||
        new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    };

    const registro = await prisma.registroAsistencia.findUnique({
      where: { comercianteId_fecha: { comercianteId, fecha } },
    });

    if (registro) {
      const observaciones = Array.isArray(registro.observaciones)
        ? (registro.observaciones as unknown as ObservacionDetalle[])
        : [];
      observaciones.push(nuevaObservacion);

      await prisma.registroAsistencia.update({
        where: { id: registro.id },
        data: { observaciones: observaciones as unknown as Prisma.InputJsonValue },
      });
    } else {
      await prisma.registroAsistencia.create({
        data: {
          comercianteId,
          puestoId: puesto.id,
          fecha,
          estado: "Presente", // No muta a ausente, por defecto Presente
          observaciones: [nuevaObservacion] as unknown as Prisma.InputJsonValue,
          permisos: [],
        },
      });
    }

    const actor = await getAuthenticatedUser(request);
    await asegurarSesionControlActivaDia({
      naveId: puesto.naveId,
      fechaJornada: hoyStr,
      usuarioActor: actor,
      accion: `Registro de observación (${nuevaObservacion.tipo})`,
    });

    return NextResponse.json(nuevaObservacion, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/asistencia/observaciones:", error);
    return NextResponse.json({ error: "Error al registrar la observación." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const comercianteId = searchParams.get("comercianteId");
    const fecha = searchParams.get("fecha");
    const observacionId = searchParams.get("observacionId");

    const hoyStr = obtenerFechaHoyEcuador();
    if (fecha !== hoyStr) {
      return NextResponse.json(
        { error: "Solo se permite registrar o modificar asistencia en la fecha actual." },
        { status: 400 }
      );
    }

    if (!comercianteId || !fecha || !observacionId) {
      return NextResponse.json(
        { error: "comercianteId, fecha y observacionId son requeridos." },
        { status: 400 }
      );
    }
    if (!(await userCanAccessComerciante(request, comercianteId))) {
      return NextResponse.json({ error: "El comerciante no pertenece a una nave asignada." }, { status: 403 });
    }

    const registro = await prisma.registroAsistencia.findUnique({
      where: { comercianteId_fecha: { comercianteId, fecha } },
    });

    if (!registro) {
      return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
    }

    const observaciones = Array.isArray(registro.observaciones)
      ? (registro.observaciones as unknown as ObservacionDetalle[])
      : [];

    const filtradas = observaciones.filter((o) => o.id !== observacionId);

    await prisma.registroAsistencia.update({
      where: { id: registro.id },
      data: { observaciones: filtradas as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, message: "Observación eliminada." });
  } catch (error) {
    console.error("Error en DELETE /api/v1/asistencia/observaciones:", error);
    return NextResponse.json({ error: "Error al eliminar la observación." }, { status: 500 });
  }
}
