// ── API Route: /api/v1/auditoria/permisos-supervisores ──────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getAuthenticatedUser } from "@/infrastructure/auth/authorization";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { ejecutarPersistenciaAutomaticaSupervisor } from "@/infrastructure/database/calendario-operativo.service";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";
import { eachDayOfInterval, format, parseISO } from "date-fns";

const ROLES_GESTION = ["SUPERADMIN", "TIC", "DIRECTOR", "JEFE_OPERATIVO"];

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.estado !== "Habilitado") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const permisos = await prisma.permisoSupervisor.findMany({
      include: {
        coberturas: true,
      },
      orderBy: { creadoEn: "desc" },
    });

    return NextResponse.json({ permisos });
  } catch (error) {
    logError("API", "Error en GET /api/v1/auditoria/permisos-supervisores", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al obtener permisos de supervisores." },
      { status: 500 }
    );
  }
}

interface CoberturaPayload {
  naveId: string;
  tipoCobertura: "REEMPLAZO_TEMPORAL" | "PERSISTENCIA_AUTOMATICA";
  supervisorReemplazoId?: string;
  motivo?: string;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.estado !== "Habilitado") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (!ROLES_GESTION.includes(user.rol)) {
      return NextResponse.json(
        { error: "No cuenta con permisos para gestionar justificaciones de supervisores." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, fechaInicio, fechaFin, motivo, coberturas } = body as {
      supervisorId: string;
      fechaInicio: string;
      fechaFin: string;
      motivo: string;
      coberturas: CoberturaPayload[];
    };

    if (!supervisorId || !fechaInicio || !fechaFin || !motivo?.trim()) {
      return NextResponse.json(
        { error: "Los campos supervisor, fecha de inicio, fecha de fin y motivo son obligatorios." },
        { status: 400 }
      );
    }

    if (fechaInicio > fechaFin) {
      return NextResponse.json(
        { error: "La fecha de inicio no puede ser posterior a la fecha de fin." },
        { status: 400 }
      );
    }

    if (!Array.isArray(coberturas) || coberturas.length === 0) {
      return NextResponse.json(
        { error: "Debe definir al menos una cobertura de nave para el supervisor." },
        { status: 400 }
      );
    }

    // 1. Obtener supervisor ausente
    const supervisor = await prisma.usuario.findUnique({
      where: { id: supervisorId },
      select: { id: true, nombres: true, apellidos: true },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: "El supervisor seleccionado no existe en el sistema." },
        { status: 404 }
      );
    }

    const supervisorNombre = `${supervisor.nombres} ${supervisor.apellidos}`.replace(/\s+/g, " ").trim();
    const actorNombre = `${user.nombres} ${user.apellidos}`.replace(/\s+/g, " ").trim();

    // 2. Resolver nombres de naves y nombres de supervisores de reemplazo
    const naveIds = Array.from(new Set(coberturas.map((c) => c.naveId)));
    const navesEnBD = await prisma.nave.findMany({
      where: { id: { in: naveIds } },
      select: { id: true, nombre: true },
    });
    const mapaNaves = new Map(navesEnBD.map((n) => [n.id, n.nombre]));

    const reemplazoIds = Array.from(
      new Set(
        coberturas
          .filter((c) => c.tipoCobertura === "REEMPLAZO_TEMPORAL" && c.supervisorReemplazoId)
          .map((c) => c.supervisorReemplazoId!)
      )
    );

    const reemplazosEnBD = await prisma.usuario.findMany({
      where: { id: { in: reemplazoIds } },
      select: { id: true, nombres: true, apellidos: true },
    });
    const mapaReemplazos = new Map(
      reemplazosEnBD.map((u) => [u.id, `${u.nombres} ${u.apellidos}`.replace(/\s+/g, " ").trim()])
    );

    // 3. Crear PermisoSupervisor y CoberturaNaveSupervisor en transacción
    const nuevoPermiso = await prisma.$transaction(async (tx) => {
      const permiso = await tx.permisoSupervisor.create({
        data: {
          supervisorId,
          supervisorNombre,
          fechaInicio,
          fechaFin,
          motivo: motivo.trim(),
          estado: "ACTIVO",
          creadoPorId: user.id,
          creadoPorNombre: actorNombre,
        },
      });

      for (const cob of coberturas) {
        const naveNombre = mapaNaves.get(cob.naveId) || "Nave Desconocida";
        const supReemplazoNombre = cob.supervisorReemplazoId
          ? mapaReemplazos.get(cob.supervisorReemplazoId) ?? null
          : null;

        await tx.coberturaNaveSupervisor.create({
          data: {
            permisoSupervisorId: permiso.id,
            naveId: cob.naveId,
            naveNombre,
            tipoCobertura: cob.tipoCobertura,
            supervisorReemplazoId:
              cob.tipoCobertura === "REEMPLAZO_TEMPORAL" ? cob.supervisorReemplazoId ?? null : null,
            supervisorReemplazoNombre:
              cob.tipoCobertura === "REEMPLAZO_TEMPORAL" ? supReemplazoNombre : null,
            fechaInicio,
            fechaFin,
            motivo: (cob.motivo || motivo).trim(),
            estado: "ACTIVO",
          },
        });
      }

      return tx.permisoSupervisor.findUnique({
        where: { id: permiso.id },
        include: { coberturas: true },
      });
    });

    // 4. Ejecutar inmediatamente Persistencia Automática para fechas pasadas u hoy (<= hoyStr)
    const hoyStr = obtenerFechaHoyEcuador();
    const fechasRango = eachDayOfInterval({
      start: parseISO(fechaInicio),
      end: parseISO(fechaFin),
    })
      .map((d) => format(d, "yyyy-MM-dd"))
      .filter((f) => f <= hoyStr);

    for (const cob of coberturas) {
      if (cob.tipoCobertura === "PERSISTENCIA_AUTOMATICA") {
        for (const f of fechasRango) {
          try {
            await ejecutarPersistenciaAutomaticaSupervisor({
              naveId: cob.naveId,
              fechaStr: f,
              supervisorId,
              supervisorNombre,
              motivoPermiso: motivo.trim(),
            });
          } catch (errPers) {
            logError(
              "API",
              `Error al persistir automáticamente cobertura para nave ${cob.naveId} en fecha ${f}`,
              errPers
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true, permiso: nuevoPermiso }, { status: 201 });
  } catch (error) {
    logError("API", "Error en POST /api/v1/auditoria/permisos-supervisores", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al registrar el permiso de supervisor." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.estado !== "Habilitado") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (!ROLES_GESTION.includes(user.rol)) {
      return NextResponse.json(
        { error: "No cuenta con permisos para revocar justificaciones de supervisores." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "El ID del permiso es obligatorio." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.coberturaNaveSupervisor.updateMany({
        where: { permisoSupervisorId: id },
        data: { estado: "REVOCADO" },
      });

      await tx.permisoSupervisor.update({
        where: { id },
        data: { estado: "REVOCADO" },
      });
    });

    return NextResponse.json({ success: true, mensaje: "Permiso revocado exitosamente." });
  } catch (error) {
    logError("API", "Error en DELETE /api/v1/auditoria/permisos-supervisores", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al revocar el permiso de supervisor." },
      { status: 500 }
    );
  }
}
