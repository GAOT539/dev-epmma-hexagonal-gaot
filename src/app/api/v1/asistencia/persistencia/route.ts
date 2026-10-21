// ── API Route: POST /api/v1/asistencia/persistencia ───────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type { PermisoDetalle } from "@/domain/models/asistencia.model";
import type { DetalleComercianteControl } from "@/domain/models/auditoria.model";
import { parseISO, subDays, format, isAfter, isBefore, isEqual } from "date-fns";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { getAuthenticatedUser, userCanAccessNave } from "@/infrastructure/auth/authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      naveId,
      fechaHasta,
      supervisorNombre = "Supervisor Asignado",
      comentario = "Persistencia selectiva de asistencia ejecutada",
    } = body;

    const hoyStr = obtenerFechaHoyEcuador();
    if (fechaHasta !== hoyStr) {
      return NextResponse.json(
        { error: "Solo se permite registrar o modificar asistencia en la fecha actual." },
        { status: 400 }
      );
    }

    if (!naveId || !fechaHasta) {
      return NextResponse.json(
        { error: "naveId y fechaHasta son requeridos." },
        { status: 400 }
      );
    }
    if (!(await userCanAccessNave(request, naveId))) {
      return NextResponse.json({ error: "La nave no pertenece al ámbito autorizado." }, { status: 403 });
    }
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: "Usuario autenticado no encontrado." }, { status: 401 });
    }

    const nave = await prisma.nave.findUnique({
      where: { id: naveId },
      include: {
        puestos: {
          where: { estado: "Ocupado" },
          include: { comerciante: true },
        },
      },
    });

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const comerciantesNave = nave.puestos
      .map((p) => p.comerciante)
      .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined && c.estadoRegistro === "Habilitado");

    const comercianteIds = comerciantesNave.map((c) => c.idInterno);

    // 1. Buscar fechaOrigen (hacia atrás hasta 30 días)
    const fechaDestinoObj = parseISO(fechaHasta);
    // 1. Encontrar la fecha de origen previa más cercana con registros existentes (hasta 30 días atrás) en 1 sola consulta indexada
    const fechaLimiteInferior = format(subDays(fechaDestinoObj, 30), "yyyy-MM-dd");
    const ultimoRegistroPrevio = await prisma.registroAsistencia.findFirst({
      where: {
        comercianteId: { in: comercianteIds },
        fecha: { lt: fechaHasta, gte: fechaLimiteInferior },
      },
      orderBy: { fecha: "desc" },
      select: { fecha: true },
    });
    const fechaOrigen = ultimoRegistroPrevio?.fecha ?? null;

    // Si no hay fecha previa, fechaOrigen es la misma fechaHasta
    const fechaBase = fechaOrigen || fechaHasta;

    // 2. Obtener registros de fechaOrigen para arrastrar ausencias y permisos
    const registrosOrigen = await prisma.registroAsistencia.findMany({
      where: {
        fecha: fechaBase,
        comercianteId: { in: comercianteIds },
      },
    });

    const mapaOrigen = new Map<string, (typeof registrosOrigen)[0]>();
    for (const r of registrosOrigen) {
      mapaOrigen.set(r.comercianteId, r);
    }

    // 3. Obtener sesión de supervisión existente en fechaHasta (para no sobreescribir manuales)
    const sesionExistente = await prisma.sesionControlSupervisor.findFirst({
      where: {
        naveId: nave.id,
        fechaJornada: fechaHasta,
      },
    });

    const detallesPrevios = Array.isArray(sesionExistente?.detallesComerciantes)
      ? (sesionExistente!.detallesComerciantes as unknown as DetalleComercianteControl[])
      : [];

    const idsManuales = new Set(
      detallesPrevios
        .filter((d) => d.metodo === "MANUAL")
        .map((d) => d.comercianteId)
    );

    // 4. Ejecutar la persistencia en transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const nuevosDetalles: DetalleComercianteControl[] = [];

      for (const puesto of nave.puestos) {
        const com = puesto.comerciante;
        if (!com || com.estadoRegistro !== "Habilitado") continue;

        // Si ya tenía registro manual en la fecha destino, respetarlo
        if (idsManuales.has(com.idInterno)) {
          const detManual = detallesPrevios.find((d) => d.comercianteId === com.idInterno);
          if (detManual) nuevosDetalles.push(detManual);
          continue;
        }

        const regOrigen = mapaOrigen.get(com.idInterno);
        let estadoFinal: "Presente" | "Ausente" | "Permiso" = "Presente";
        let permisoActivo = false;
        const permisosArray: PermisoDetalle[] = [];

        // Evaluar permisos vigentes
        if (regOrigen?.permisos && Array.isArray(regOrigen.permisos)) {
          const permsOrigen = regOrigen.permisos as unknown as PermisoDetalle[];
          for (const p of permsOrigen) {
            if (p.fechaInicio && p.fechaFin) {
              const fIni = parseISO(p.fechaInicio);
              const fFin = parseISO(p.fechaFin);
              if (
                (isEqual(fechaDestinoObj, fIni) || isAfter(fechaDestinoObj, fIni)) &&
                (isEqual(fechaDestinoObj, fFin) || isBefore(fechaDestinoObj, fFin))
              ) {
                permisoActivo = true;
                permisosArray.push(p);
              }
            }
          }
        }

        if (permisoActivo) {
          estadoFinal = "Permiso";
        } else if (regOrigen?.estado === "Ausente") {
          estadoFinal = "Ausente";
        } else {
          estadoFinal = "Presente";
        }

        // Upsert en la fecha destino: limpia observaciones y aplica persistencia
        await tx.registroAsistencia.upsert({
          where: {
            comercianteId_fecha: { comercianteId: com.idInterno, fecha: fechaHasta },
          },
          update: {
            estado: estadoFinal,
            observacion: null,
            observacionTexto: null,
            observaciones: [],
            permisos: permisosArray as unknown as Prisma.InputJsonValue,
            permisoInicio: permisoActivo ? permisosArray[0]?.fechaInicio : null,
            permisoFin: permisoActivo ? permisosArray[0]?.fechaFin : null,
          },
          create: {
            comercianteId: com.idInterno,
            puestoId: puesto.id,
            fecha: fechaHasta,
            estado: estadoFinal,
            observaciones: [],
            permisos: permisosArray as unknown as Prisma.InputJsonValue,
            permisoInicio: permisoActivo ? permisosArray[0]?.fechaInicio : null,
            permisoFin: permisoActivo ? permisosArray[0]?.fechaFin : null,
          },
        });

        nuevosDetalles.push({
          comercianteId: com.idInterno,
          ciu: com.ciu,
          cedula: com.cedula,
          contribuyente: com.contribuyente,
          puesto: puesto.codigo,
          estado: estadoFinal,
          metodo: "PERSISTENCIA",
          horaRegistro: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        });
      }

      // Sincronizar SesionControlSupervisor
      const presentes = nuevosDetalles.filter((d) => d.estado === "Presente").length;
      const ausentes = nuevosDetalles.filter((d) => d.estado === "Ausente").length;
      const permisos = nuevosDetalles.filter((d) => d.estado === "Permiso").length;

      const resumen = {
        totalOcupados: nuevosDetalles.length,
        tomados: nuevosDetalles.length,
        presentes,
        ausentes,
        permisos,
      };

      const etiquetas = ["CON_PERSISTENCIA"];
      if (fechaOrigen !== fechaHasta) {
        etiquetas.push("EN_FECHA");
      }

      if (sesionExistente) {
        await tx.sesionControlSupervisor.update({
          where: { id: sesionExistente.id },
          data: {
            esPersistencia: true,
            fechaOrigenPersistencia: fechaBase,
            comentarioPersistencia: comentario,
            resumen,
            detallesComerciantes: nuevosDetalles as unknown as Prisma.InputJsonValue,
            etiquetas,
          },
        });
      } else {
        await tx.sesionControlSupervisor.create({
          data: {
            supervisorId: actor.id,
            supervisorNombre: `${actor.nombres} ${actor.apellidos}`.trim() || supervisorNombre,
            naveId: nave.id,
            naveNombre: nave.nombre,
            fechaJornada: fechaHasta,
            accion: "Persistencia selectiva de asistencia",
            esPersistencia: true,
            fechaOrigenPersistencia: fechaBase,
            comentarioPersistencia: comentario,
            etiquetas,
            resumen,
            detallesComerciantes: nuevosDetalles as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return {
        fechaOrigen: fechaBase,
        diasCubiertos: 1,
        totalPersistidos: nuevosDetalles.length,
      };
    }, { maxWait: 15000, timeout: 60000 });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error en POST /api/v1/asistencia/persistencia:", error);
    return NextResponse.json({ error: "Error al ejecutar la persistencia de asistencia." }, { status: 500 });
  }
}
