// ── API Route: /api/v1/auditoria/dias-no-laborables ─────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getAuthenticatedUser } from "@/infrastructure/auth/authorization";
import { verifyPasswordHash } from "@/infrastructure/auth/password.utils";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { expandirFechasDeRegla } from "@/infrastructure/database/calendario-operativo.service";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

const ROLES_GESTION = ["SUPERADMIN", "TIC", "DIRECTOR", "JEFE_OPERATIVO"];

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.estado !== "Habilitado") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const reglas = await prisma.reglaDiaNoLaborable.findMany({
      orderBy: { creadoEn: "desc" },
    });

    return NextResponse.json({ reglas });
  } catch (error) {
    logError("API", "Error en GET /api/v1/auditoria/dias-no-laborables", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al obtener las reglas de días no laborables." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.estado !== "Habilitado") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (!ROLES_GESTION.includes(user.rol)) {
      return NextResponse.json(
        { error: "No cuenta con permisos para configurar días no laborables." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      motivo,
      tipoRegla,
      fechaInicio,
      fechaFin,
      diasSemana = [],
      aplicaTodasNaves = true,
      navesIds = [],
      passwordConfirmacion,
    } = body as {
      motivo: string;
      tipoRegla: "DIA_UNICO" | "RANGO_CONTINUO" | "RECURRENTE_SEMANAL";
      fechaInicio: string;
      fechaFin: string;
      diasSemana?: number[];
      aplicaTodasNaves?: boolean;
      navesIds?: string[];
      passwordConfirmacion?: string;
    };

    if (!motivo?.trim() || !tipoRegla || !fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: "Los campos motivo, tipo de regla, fecha de inicio y fecha de fin son obligatorios." },
        { status: 400 }
      );
    }

    if (fechaInicio > fechaFin) {
      return NextResponse.json(
        { error: "La fecha de inicio no puede ser posterior a la fecha de fin." },
        { status: 400 }
      );
    }

    if (!aplicaTodasNaves && (!Array.isArray(navesIds) || navesIds.length === 0)) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos una nave o indicar que aplica a todas las naves." },
        { status: 400 }
      );
    }

    const fechasExpandidas = expandirFechasDeRegla({
      tipoRegla,
      fechaInicio,
      fechaFin,
      diasSemana,
    });

    if (fechasExpandidas.length === 0) {
      return NextResponse.json(
        { error: "El rango y días de la semana seleccionados no generan ninguna fecha válida." },
        { status: 400 }
      );
    }

    // Resolver nombres de las naves afectadas
    let navesNombres: string[] = ["TODAS"];
    let navesAfectadasIds: string[] = [];

    if (!aplicaTodasNaves) {
      const navesEnBD = await prisma.nave.findMany({
        where: { id: { in: navesIds } },
        select: { id: true, nombre: true },
      });
      navesNombres = navesEnBD.map((n) => n.nombre);
      navesAfectadasIds = navesEnBD.map((n) => n.id);
    } else {
      const todasLasNaves = await prisma.nave.findMany({
        select: { id: true },
      });
      navesAfectadasIds = todasLasNaves.map((n) => n.id);
    }

    // ── Verificación de Colisión con Registros de Asistencia Existentes (fechas <= hoyStr) ──
    const hoyStr = obtenerFechaHoyEcuador();
    const fechasPasadasOHoy = fechasExpandidas.filter((f) => f <= hoyStr);

    let requiereBorrado = false;
    let puestosAfectadosIds: string[] = [];
    let fechasConRegistros: string[] = [];
    let totalRegistros = 0;
    let totalSesiones = 0;

    if (fechasPasadasOHoy.length > 0) {
      const puestosAfectados = await prisma.puesto.findMany({
        where: { naveId: { in: navesAfectadasIds } },
        select: { id: true },
      });
      puestosAfectadosIds = puestosAfectados.map((p) => p.id);

      if (puestosAfectadosIds.length > 0) {
        const [registrosExistentes, sesionesExistentes] = await Promise.all([
          prisma.registroAsistencia.findMany({
            where: {
              fecha: { in: fechasPasadasOHoy },
              puestoId: { in: puestosAfectadosIds },
            },
            select: { fecha: true },
          }),
          prisma.sesionControlSupervisor.findMany({
            where: {
              fechaJornada: { in: fechasPasadasOHoy },
              naveId: { in: navesAfectadasIds },
            },
            select: { fechaJornada: true },
          }),
        ]);

        totalRegistros = registrosExistentes.length;
        totalSesiones = sesionesExistentes.length;

        if (totalRegistros > 0 || totalSesiones > 0) {
          requiereBorrado = true;
          const fechasSet = new Set<string>([
            ...registrosExistentes.map((r) => r.fecha),
            ...sesionesExistentes.map((s) => s.fechaJornada),
          ]);
          fechasConRegistros = Array.from(fechasSet).sort();
        }
      }
    }

    // Si existen registros tomados en esas fechas:
    if (requiereBorrado) {
      if (!passwordConfirmacion) {
        return NextResponse.json(
          {
            requiereConfirmacionPassword: true,
            fechasConRegistros,
            totalRegistrosAfectados: totalRegistros + totalSesiones,
            mensaje:
              "Atención: Existen registros de asistencia y/o sesiones tomados en las fechas seleccionadas. Si continúa, se eliminarán los registros de esos días para las naves seleccionadas. Ingrese su contraseña para confirmar.",
          },
          { status: 409 }
        );
      }

      // Validar contraseña
      const usuarioBD = await prisma.usuario.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      if (!usuarioBD?.passwordHash) {
        return NextResponse.json(
          { error: "No se pudo verificar la contraseña del usuario." },
          { status: 400 }
        );
      }

      const passValida = await verifyPasswordHash(passwordConfirmacion, usuarioBD.passwordHash);
      if (!passValida) {
        return NextResponse.json(
          {
            error:
              "Contraseña incorrecta. Por seguridad, no se eliminaron los registros ni se guardó la regla.",
          },
          { status: 403 }
        );
      }
    }

    const actorNombre = `${user.nombres} ${user.apellidos}`.replace(/\s+/g, " ").trim();

    // Guardar regla (y opcionalmente eliminar registros en transacción si hubo colisión)
    const nuevaRegla = await prisma.$transaction(async (tx) => {
      if (requiereBorrado) {
        await tx.registroAsistencia.deleteMany({
          where: {
            fecha: { in: fechasPasadasOHoy },
            puestoId: { in: puestosAfectadosIds },
          },
        });

        await tx.sesionControlSupervisor.deleteMany({
          where: {
            fechaJornada: { in: fechasPasadasOHoy },
            naveId: { in: navesAfectadasIds },
          },
        });
      }

      return tx.reglaDiaNoLaborable.create({
        data: {
          motivo: motivo.trim(),
          tipoRegla,
          fechaInicio,
          fechaFin,
          diasSemana: tipoRegla === "RECURRENTE_SEMANAL" ? diasSemana : undefined,
          aplicaTodasNaves,
          navesIds: aplicaTodasNaves ? undefined : navesIds,
          navesNombres: aplicaTodasNaves ? undefined : navesNombres,
          fechasExpandidas,
          creadoPorId: user.id,
          creadoPorNombre: actorNombre,
        },
      });
    });

    return NextResponse.json({ success: true, regla: nuevaRegla }, { status: 201 });
  } catch (error) {
    logError("API", "Error en POST /api/v1/auditoria/dias-no-laborables", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al registrar la regla de día no laborable." },
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
        { error: "No cuenta con permisos para eliminar reglas de días no laborables." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la regla es obligatorio." },
        { status: 400 }
      );
    }

    await prisma.reglaDiaNoLaborable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, mensaje: "Regla eliminada exitosamente." });
  } catch (error) {
    logError("API", "Error en DELETE /api/v1/auditoria/dias-no-laborables", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        { error: "Error de conexión con la base de datos." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al eliminar la regla de día no laborable." },
      { status: 500 }
    );
  }
}
