// ── API Route: /api/v1/asistencia ─────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { EstadoAsistencia, Prisma } from "@prisma/client";
import type { ObservacionDetalle } from "@/domain/models/asistencia.model";
import type { DetalleComercianteControl, EtiquetaControlSupervisor } from "@/domain/models/auditoria.model";
import {
  obtenerFechaHoyEcuador,
  asegurarAsistenciaInicialDelDia,
  iniciarCronAsistenciaDiaria2AM,
} from "@/infrastructure/database/daily-attendance.service";
import { getAccessibleNaveIds, userCanAccessComerciante, userCanAccessNave } from "@/infrastructure/auth/authorization";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export async function GET(request: Request) {
  try {
    iniciarCronAsistenciaDiaria2AM();
    const hoyStr = obtenerFechaHoyEcuador();
    await asegurarAsistenciaInicialDelDia(hoyStr);

    const { searchParams } = new URL(request.url);

    // Caso Especial: Metadatos de límites para frontend
    if (searchParams.get("meta") === "limites") {
      const agg = await prisma.registroAsistencia.aggregate({
        _min: { fecha: true },
        _max: { fecha: true },
      });
      const minFecha = agg._min.fecha || hoyStr;
      return NextResponse.json({
        minFecha,
        maxFecha: hoyStr,
        hoy: hoyStr,
      });
    }

    const fecha = searchParams.get("fecha");
    const comercianteId = searchParams.get("comercianteId");
    const naveId = searchParams.get("naveId");
    const fechaInicio = searchParams.get("fechaInicio");
    let fechaFin = searchParams.get("fechaFin");
    const accessibleNaveIds = await getAccessibleNaveIds(request);
    if (accessibleNaveIds?.length === 0) {
      return NextResponse.json([]);
    }
    if (naveId && !(await userCanAccessNave(request, naveId))) {
      return NextResponse.json({ error: "La nave no pertenece al ámbito autorizado." }, { status: 403 });
    }
    if (comercianteId && !(await userCanAccessComerciante(request, comercianteId))) {
      return NextResponse.json({ error: "El comerciante no pertenece al ámbito autorizado." }, { status: 403 });
    }

    // Recortar fechaFin a hoyStr para jamás consultar días futuros
    if (fechaFin && fechaFin > hoyStr) {
      fechaFin = hoyStr;
    }

    // Caso 1: Comerciante específico en una fecha
    if (comercianteId && fecha) {
      if (fecha > hoyStr) {
        return NextResponse.json(null);
      }

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
      const puestosNave = await prisma.puesto.findMany({
        where: { naveId: naveId! },
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
      if (accessibleNaveIds) {
        const puestos = await prisma.puesto.findMany({
          where: { naveId: { in: accessibleNaveIds } },
          select: { comercianteId: true },
        });
        const ids = puestos.map((puesto) => puesto.comercianteId).filter((id): id is string => Boolean(id));
        const registros = await prisma.registroAsistencia.findMany({
          where: { comercianteId: { in: ids }, fecha: { gte: fechaInicio, lte: fechaFin } },
          orderBy: { fecha: "asc" },
        });
        return NextResponse.json(registros);
      }
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
      if (fecha > hoyStr) {
        return NextResponse.json([]);
      }

      const registros = await prisma.registroAsistencia.findMany({
        where: accessibleNaveIds
          ? {
              fecha,
              comercianteId: {
                in: (
                  await prisma.puesto.findMany({
                    where: { naveId: { in: accessibleNaveIds } },
                    select: { comercianteId: true },
                  })
                )
                  .map((puesto) => puesto.comercianteId)
                  .filter((id): id is string => Boolean(id)),
              },
            }
          : { fecha },
      });

      return NextResponse.json(registros);
    }

    return NextResponse.json(
      { error: "Parámetros insuficientes. Se requiere fecha o rango de fechas." },
      { status: 400 }
    );
  } catch (error) {
    logError("API", "Error en GET /api/v1/asistencia", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
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
      supervisorNombre,
    } = body;

    if (!comercianteId || !fecha || !estado) {
      return NextResponse.json(
        { error: "comercianteId, fecha y estado son requeridos." },
        { status: 400 }
      );
    }

    const hoyStr = obtenerFechaHoyEcuador();
    if (fecha !== hoyStr) {
      return NextResponse.json(
        { error: "Solo se permite registrar o modificar asistencia en la fecha actual." },
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

    // Buscar el puesto del comerciante
    let puestoObj = await prisma.puesto.findFirst({ where: { comercianteId: comerciante.idInterno } });
    if (!puestoObj && comerciante.puestoId && comerciante.nave) {
      puestoObj = await prisma.puesto.findFirst({
        where: {
          codigo: comerciante.puestoId,
          nave: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
        },
      });
    }

    if (!puestoObj) {
      const naveDefecto = comerciante.nave
        ? await prisma.nave.findFirst({
            where: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
          })
        : null;
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

      // Sincronizar en sesiones_control_supervisor con fidelidad de auditoría
      const nave = await tx.nave.findUnique({ where: { id: puestoObj!.naveId } });

      if (nave) {
        // 1. Determinar supervisor sin depender exclusivamente de rol SUPERVISOR
        const headerUserId = request.headers.get("x-user-id");
        const headerUserCedula = request.headers.get("x-user-cedula");

        let userEjecutor = null;
        if (headerUserId) {
          userEjecutor = await tx.usuario.findUnique({ where: { id: headerUserId } });
        }
        if (!userEjecutor && headerUserCedula) {
          userEjecutor = await tx.usuario.findUnique({ where: { cedula: headerUserCedula } });
        }
        if (!userEjecutor) {
          userEjecutor = await tx.usuario.findFirst({
            where: { rol: "SUPERVISOR", estado: "Habilitado" },
          });
        }
        if (!userEjecutor) {
          userEjecutor = await tx.usuario.findFirst({
            where: { rol: "SUPERADMIN", estado: "Habilitado" },
          });
        }

        const supervisorId = userEjecutor ? userEjecutor.id : "u-super";
        const supervisorNombreFinal = userEjecutor
          ? `${userEjecutor.nombres} ${userEjecutor.apellidos}`
          : supervisorNombre || "Supervisor del Sistema";

        const sesionExistente = await tx.sesionControlSupervisor.findFirst({
          where: {
            naveId: nave.id,
            fechaJornada: fecha,
          },
        });

        const detallesPrevios = Array.isArray(sesionExistente?.detallesComerciantes)
          ? (sesionExistente!.detallesComerciantes as unknown as DetalleComercianteControl[])
          : [];

        const metodoModificado = sesionExistente?.esPersistencia
          ? "MODIFICADO_TRAS_PERSISTENCIA"
          : "MANUAL";
        const horaModificado = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

        let detallesFinales: DetalleComercianteControl[] = [];

        if (sesionExistente && detallesPrevios.length > 0) {
          // FAST-PATH: Si la sesión ya existe con nómina, actualizar solo el comerciante en memoria
          let encontrado = false;
          detallesFinales = detallesPrevios.map((d) => {
            if (d.comercianteId === comercianteId) {
              encontrado = true;
              return {
                ...d,
                estado: estado as EstadoAsistencia,
                metodo: metodoModificado,
                horaRegistro: horaModificado,
              };
            }
            return d;
          });

          if (!encontrado) {
            detallesFinales.push({
              comercianteId,
              ciu: comerciante.ciu,
              cedula: comerciante.cedula,
              contribuyente: comerciante.contribuyente,
              puesto: puestoObj.codigo,
              estado: estado as EstadoAsistencia,
              metodo: metodoModificado,
              horaRegistro: horaModificado,
            });
          }
        } else {
          // SLOW-PATH: Cargar la nómina completa únicamente en la primera creación de la sesión del día
          const puestosOcupadosNave = await tx.puesto.findMany({
            where: { naveId: nave.id, estado: "Ocupado" },
            include: { comerciante: true },
          });

          const comIds = puestosOcupadosNave
            .map((p) => p.comercianteId)
            .filter((id): id is string => Boolean(id));

          const registrosDia = await tx.registroAsistencia.findMany({
            where: {
              fecha,
              comercianteId: { in: comIds },
            },
          });
          const regMap = new Map(registrosDia.map((r) => [r.comercianteId, r]));
          const mapaPrevios = new Map(detallesPrevios.map((d) => [d.comercianteId, d]));

          for (const p of puestosOcupadosNave) {
            const com = p.comerciante;
            if (!com || com.estadoRegistro !== "Habilitado") continue;

            if (com.idInterno === comercianteId) {
              detallesFinales.push({
                comercianteId,
                ciu: com.ciu,
                cedula: com.cedula,
                contribuyente: com.contribuyente,
                puesto: p.codigo,
                estado: estado as EstadoAsistencia,
                metodo: metodoModificado,
                horaRegistro: horaModificado,
              });
            } else {
              const previo = mapaPrevios.get(com.idInterno);
              if (previo) {
                detallesFinales.push(previo);
              } else {
                const r = regMap.get(com.idInterno);
                detallesFinales.push({
                  comercianteId: com.idInterno,
                  ciu: com.ciu,
                  cedula: com.cedula,
                  contribuyente: com.contribuyente,
                  puesto: p.codigo,
                  estado: r?.estado ?? "Presente",
                  metodo: sesionExistente?.esPersistencia ? "PERSISTENCIA" : "MANUAL",
                  horaRegistro: horaModificado,
                });
              }
            }
          }
        }

        const presentes = detallesFinales.filter((d) => d.estado === "Presente").length;
        const ausentes = detallesFinales.filter((d) => d.estado === "Ausente").length;
        const permisos = detallesFinales.filter((d) => d.estado === "Permiso").length;

        const resumen = {
          totalOcupados: detallesFinales.length,
          tomados: detallesFinales.length,
          presentes,
          ausentes,
          permisos,
        };

        const etiquetas: EtiquetaControlSupervisor[] = Array.isArray(sesionExistente?.etiquetas)
          ? [...(sesionExistente!.etiquetas as unknown as EtiquetaControlSupervisor[])]
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
              detallesComerciantes: detallesFinales as unknown as Prisma.InputJsonValue,
              etiquetas,
              modificadoTrasPersistencia,
            },
          });
        } else {
          await tx.sesionControlSupervisor.create({
            data: {
              supervisorId,
              supervisorNombre: supervisorNombreFinal,
              naveId: nave.id,
              naveNombre: nave.nombre,
              fechaJornada: fecha,
              accion: "Control de asistencia",
              esPersistencia: false,
              etiquetas,
              resumen,
              detallesComerciantes: detallesFinales as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      return reg;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({ success: true, registro: registroActualizado });
  } catch (error) {
    logError("API", "Error en POST /api/v1/asistencia", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al registrar asistencia." }, { status: 500 });
  }
}
