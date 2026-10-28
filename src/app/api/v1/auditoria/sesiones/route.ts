// ── API Route: /api/v1/auditoria/sesiones ─────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import { parseISO, format, subDays, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import type {
  SesionControlSupervisor,
  EtiquetaControlSupervisor,
  ResumenSesionControl,
  DetalleComercianteControl,
  NovedadPuestoControl,
} from "@/domain/models/auditoria.model";
import type { ObservacionDetalle, PermisoDetalle } from "@/domain/models/asistencia.model";
import { getAuthenticatedUser, userCanAccessNave } from "@/infrastructure/auth/authorization";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { obtenerMapaDiasNoLaborablesEnRango } from "@/infrastructure/database/calendario-operativo.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get("busqueda")?.trim().toLowerCase();
    const supervisorId = searchParams.get("supervisorId");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    const hoyStr = obtenerFechaHoyEcuador();
    const ayerStr = format(subDays(parseISO(hoyStr), 1), "yyyy-MM-dd");

    // 1. Consultar naves, supervisores habilitados y permisos activos de supervisores
    const [naves, supervisores, permisosSupervisores] = await Promise.all([
      prisma.nave.findMany({
        where: { estadoRegistro: "Habilitado" },
        include: {
          puestos: {
            where: { estado: "Ocupado" },
            include: { comerciante: true },
          },
        },
      }),
      prisma.usuario.findMany({
        where: { rol: "SUPERVISOR", estado: "Habilitado" },
      }),
      prisma.permisoSupervisor.findMany({
        where: { estado: "ACTIVO" },
        include: { coberturas: true },
        orderBy: { fechaInicio: "asc" },
      }),
    ]);

    // Rango temporal para no laborables y detección de días pasados sin ingreso
    let minFechaRango = fechaDesde;
    if (!minFechaRango) {
      const primerReg = await prisma.registroAsistencia.findFirst({
        orderBy: { fecha: "asc" },
        select: { fecha: true },
      });
      minFechaRango = primerReg?.fecha || ayerStr;
    }
    const maxFechaRango = fechaHasta && fechaHasta < ayerStr ? fechaHasta : ayerStr;

    const mapaNoLab = await obtenerMapaDiasNoLaborablesEnRango(
      minFechaRango,
      fechaHasta && fechaHasta > hoyStr ? fechaHasta : hoyStr
    );

    // 2. Consulta de sesiones reales en base de datos
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

    // Cargar asistencias reales de las sesiones para enriquecer comerciantes con novedades
    const fechasSesiones = Array.from(new Set(sesiones.map((s) => s.fechaJornada)));
    const registrosAsistencia = fechasSesiones.length > 0
      ? await prisma.registroAsistencia.findMany({
          where: { fecha: { in: fechasSesiones } },
        })
      : [];

    const regMap = new Map<string, typeof registrosAsistencia[0]>();
    for (const r of registrosAsistencia) {
      regMap.set(`${r.comercianteId}__${r.fecha}`, r);
    }

    // 3. Procesamiento y enriquecimiento de sesiones reales
    const resultado: SesionControlSupervisor[] = sesiones.map((s) => {
      const etiquetas = Array.isArray(s.etiquetas)
        ? [...(s.etiquetas as unknown as EtiquetaControlSupervisor[])]
        : [];
      const resumen = { ...(s.resumen as unknown as ResumenSesionControl) };
      const detallesRaw = Array.isArray(s.detallesComerciantes)
        ? (s.detallesComerciantes as unknown as DetalleComercianteControl[])
        : [];

      // Vincular información de cobertura de supervisor si correspondía a esa nave y fecha
      let permisoSupervisorInfo: SesionControlSupervisor["permisoSupervisorInfo"] = undefined;
      for (const perm of permisosSupervisores) {
        const cob = perm.coberturas.find(
          (c) =>
            c.naveId === s.naveId &&
            c.fechaInicio <= s.fechaJornada &&
            s.fechaJornada <= c.fechaFin &&
            c.estado === "ACTIVO"
        );
        if (cob) {
          permisoSupervisorInfo = {
            fechaInicio: cob.fechaInicio,
            fechaFin: cob.fechaFin,
            motivo: cob.motivo,
            tipoCobertura: cob.tipoCobertura as "REEMPLAZO_TEMPORAL" | "PERSISTENCIA_AUTOMATICA",
            supervisorReemplazoNombre: cob.supervisorReemplazoNombre,
          };
          const etqCobertura: EtiquetaControlSupervisor =
            cob.tipoCobertura === "REEMPLAZO_TEMPORAL"
              ? "PERMISO_SUPERVISOR_REEMPLAZO"
              : "PERMISO_SUPERVISOR_PERSISTENCIA";
          if (!etiquetas.includes(etqCobertura)) {
            etiquetas.push(etqCobertura);
          }
          break;
        }
      }

      let conteoJustificados = 0;

      const detallesComerciantes: DetalleComercianteControl[] = detallesRaw.map((com) => {
        const reg = regMap.get(`${com.comercianteId}__${s.fechaJornada}`);
        const novedades: NovedadPuestoControl[] = [];

        if (reg) {
          // Extraer permisos y justificaciones
          const perms = Array.isArray(reg.permisos)
            ? (reg.permisos as unknown as PermisoDetalle[])
            : [];

          for (const p of perms) {
            const motivoStr = String(p.motivo || "").trim();
            const esJustificacion =
              motivoStr.toLowerCase().includes("justificación de falta") ||
              motivoStr.toLowerCase().includes("falta justificada");

            const diasVigencia =
              p.fechaInicio && p.fechaFin
                ? Math.max(
                    1,
                    differenceInCalendarDays(parseISO(p.fechaFin), parseISO(p.fechaInicio)) + 1
                  )
                : 1;

            if (esJustificacion) {
              const motivoLimpio = motivoStr
                .replace(/^Justificación de falta:\s*/i, "")
                .replace(/^Falta justificada[^:]*:\s*/i, "")
                .trim();

              novedades.push({
                categoria: "JUSTIFICACION",
                motivo: motivoLimpio || motivoStr,
                fechaInicio: p.fechaInicio,
                fechaFin: p.fechaFin,
                diasVigencia,
              });
            } else {
              novedades.push({
                categoria: "PERMISO",
                motivo: motivoStr,
                fechaInicio: p.fechaInicio,
                fechaFin: p.fechaFin,
                diasVigencia,
              });
            }
          }

          // Extraer observaciones, citaciones y notificaciones
          const obss = Array.isArray(reg.observaciones)
            ? (reg.observaciones as unknown as ObservacionDetalle[])
            : [];

          for (const obs of obss) {
            // Ignorar observaciones que son eco de justificaciones automáticas
            if (obs.texto?.startsWith("Falta justificada (registrada")) continue;

            let categoria: NovedadPuestoControl["categoria"] = "OBSERVACION";
            const tipoObs = String(obs.tipo || "");
            if (tipoObs === "Citaciones") {
              categoria = "CITACION";
            } else if (tipoObs.includes("Notifica")) {
              categoria = "NOTIFICACION";
            }

            novedades.push({
              categoria,
              motivo: obs.texto,
              numeroDocumento: obs.numeroDocumento,
              fechaHora: obs.fechaHora,
            });
          }
        }

        const tieneJustificacion = novedades.some((n) => n.categoria === "JUSTIFICACION");
        if (tieneJustificacion) {
          conteoJustificados++;
        }

        return {
          ...com,
          novedades: novedades.length > 0 ? novedades : undefined,
        };
      });

      resumen.justificados = conteoJustificados;

      return {
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
        etiquetas,
        resumen,
        detallesComerciantes,
        sinIngreso: false,
        permisoSupervisorInfo,
      };
    });

    // 4. Generar/Sintetizar registros de "SIN_INGRESO" para días pasados (<= ayerStr)
    if (minFechaRango <= maxFechaRango) {
      const fechasPasadas = eachDayOfInterval({
        start: parseISO(minFechaRango),
        end: parseISO(maxFechaRango),
      })
        .map((d) => format(d, "yyyy-MM-dd"))
        .filter((f) => f <= ayerStr);

      // Obtener todas las sesiones existentes para indexar por naveId + fechaJornada
      const todasLasSesionesEnRango = await prisma.sesionControlSupervisor.findMany({
        where: { fechaJornada: { in: fechasPasadas } },
        select: { naveId: true, fechaJornada: true },
      });
      const sesionesExistentesSet = new Set(
        todasLasSesionesEnRango.map((s) => `${s.naveId}__${s.fechaJornada}`)
      );

      for (const nave of naves) {
        // Encontrar supervisor asignado a la nave
        const supervisoresAsignados = Array.isArray(nave.supervisores)
          ? (nave.supervisores as string[])
          : [];

        const supUser = supervisores.find((s) => {
          const nombreCompleto = `${s.nombres} ${s.apellidos}`.trim().toLowerCase();
          const sNavesStr =
            typeof s.navesAsignadas === "string"
              ? s.navesAsignadas
              : Array.isArray(s.navesAsignadas)
              ? (s.navesAsignadas as string[]).join(", ")
              : "";
          return (
            supervisoresAsignados.some((nom) =>
              nombreCompleto.includes(String(nom).toLowerCase())
            ) || (sNavesStr.length > 0 && sNavesStr.toLowerCase().includes(nave.nombre.toLowerCase()))
          );
        }) || supervisores[0];

        if (!supUser) continue;

        // Si se filtró por supervisor y este no coincide, omitir
        if (supervisorId && supUser.id !== supervisorId) {
          continue;
        }

        const supervisorNombre = `${supUser.nombres} ${supUser.apellidos}`.trim();

        for (const f of fechasPasadas) {
          // Verificar si fue día no laborable en la nave
          if (mapaNoLab.globales.has(f)) continue;
          if (mapaNoLab.porNave.get(nave.id)?.has(f)) continue;

          // Verificar si ya existe sesión para esta nave y fecha
          if (sesionesExistentesSet.has(`${nave.id}__${f}`)) continue;

          // Verificar si el supervisor tenía cobertura/permiso en esa fecha
          let permisoSupervisorInfo: SesionControlSupervisor["permisoSupervisorInfo"] = undefined;
          const etiquetas: EtiquetaControlSupervisor[] = ["SIN_INGRESO"];

          for (const perm of permisosSupervisores) {
            const cob = perm.coberturas.find(
              (c) =>
                c.naveId === nave.id &&
                c.fechaInicio <= f &&
                f <= c.fechaFin &&
                c.estado === "ACTIVO"
            );
            if (cob) {
              permisoSupervisorInfo = {
                fechaInicio: cob.fechaInicio,
                fechaFin: cob.fechaFin,
                motivo: cob.motivo,
                tipoCobertura: cob.tipoCobertura as "REEMPLAZO_TEMPORAL" | "PERSISTENCIA_AUTOMATICA",
                supervisorReemplazoNombre: cob.supervisorReemplazoNombre,
              };
              etiquetas.push(
                cob.tipoCobertura === "REEMPLAZO_TEMPORAL"
                  ? "PERMISO_SUPERVISOR_REEMPLAZO"
                  : "PERMISO_SUPERVISOR_PERSISTENCIA"
              );
              break;
            }
          }

          // Consultar registros de asistencia de los comerciantes de la nave en esa fecha
          const comIds = nave.puestos
            .map((p) => p.comercianteId)
            .filter((id): id is string => Boolean(id));

          const regsDia = comIds.length > 0
            ? await prisma.registroAsistencia.findMany({
                where: { fecha: f, comercianteId: { in: comIds } },
              })
            : [];
          const regDiaMap = new Map(regsDia.map((r) => [r.comercianteId, r]));

          let justificados = 0;
          const detallesComerciantes: DetalleComercianteControl[] = nave.puestos
            .filter((p) => p.comerciante && p.comerciante.estadoRegistro === "Habilitado")
            .map((p) => {
              const com = p.comerciante!;
              const r = regDiaMap.get(com.idInterno);
              const novedades: NovedadPuestoControl[] = [];

              if (r) {
                const perms = Array.isArray(r.permisos)
                  ? (r.permisos as unknown as PermisoDetalle[])
                  : [];
                for (const permItem of perms) {
                  const mStr = String(permItem.motivo || "").trim();
                  const esJust =
                    mStr.toLowerCase().includes("justificación de falta") ||
                    mStr.toLowerCase().includes("falta justificada");
                  const dVig =
                    permItem.fechaInicio && permItem.fechaFin
                      ? Math.max(
                          1,
                          differenceInCalendarDays(
                            parseISO(permItem.fechaFin),
                            parseISO(permItem.fechaInicio)
                          ) + 1
                        )
                      : 1;

                  if (esJust) {
                    novedades.push({
                      categoria: "JUSTIFICACION",
                      motivo: mStr.replace(/^Justificación de falta:\s*/i, "").trim() || mStr,
                      fechaInicio: permItem.fechaInicio,
                      fechaFin: permItem.fechaFin,
                      diasVigencia: dVig,
                    });
                  } else {
                    novedades.push({
                      categoria: "PERMISO",
                      motivo: mStr,
                      fechaInicio: permItem.fechaInicio,
                      fechaFin: permItem.fechaFin,
                      diasVigencia: dVig,
                    });
                  }
                }

                const obss = Array.isArray(r.observaciones)
                  ? (r.observaciones as unknown as ObservacionDetalle[])
                  : [];
                for (const obs of obss) {
                  if (obs.texto?.startsWith("Falta justificada (registrada")) continue;
                  let categoria: NovedadPuestoControl["categoria"] = "OBSERVACION";
                  if (obs.tipo === "Citaciones") categoria = "CITACION";
                  else if (obs.tipo?.includes("Notifica")) categoria = "NOTIFICACION";
                  novedades.push({
                    categoria,
                    motivo: obs.texto,
                    numeroDocumento: obs.numeroDocumento,
                    fechaHora: obs.fechaHora,
                  });
                }
              }

              if (novedades.some((n) => n.categoria === "JUSTIFICACION")) {
                justificados++;
              }

              return {
                comercianteId: com.idInterno,
                ciu: com.ciu,
                cedula: com.cedula,
                contribuyente: com.contribuyente,
                puesto: p.codigo,
                estado: r?.estado ?? "Ausente",
                horaRegistro: "—",
                metodo: "MANUAL" as const,
                novedades: novedades.length > 0 ? novedades : undefined,
              };
            });

          const totalOcupados = detallesComerciantes.length;
          const presentes = detallesComerciantes.filter((d) => d.estado === "Presente").length;
          const ausentes = detallesComerciantes.filter((d) => d.estado === "Ausente").length;
          const permisos = detallesComerciantes.filter((d) => d.estado === "Permiso").length;

          resultado.push({
            id: `sin-ingreso-${nave.id}-${f}`,
            supervisorId: supUser.id,
            supervisorNombre,
            naveId: nave.id,
            naveNombre: nave.nombre,
            fechaJornada: f,
            timestampInicio: `${f}T23:59:00.000Z`,
            accion: "No ingresó al sistema",
            esPersistencia: false,
            modificadoTrasPersistencia: false,
            tieneRetraso: false,
            sinIngreso: true,
            etiquetas,
            resumen: {
              totalOcupados,
              tomados: totalOcupados,
              presentes,
              ausentes,
              permisos,
              justificados,
            },
            detallesComerciantes,
            permisoSupervisorInfo,
          });
        }
      }
    }

    // 5. Filtros en memoria y ordenamiento cronológico descendente
    let listadoFinal = resultado;

    if (supervisorId) {
      listadoFinal = listadoFinal.filter((s) => s.supervisorId === supervisorId);
    }

    if (busqueda) {
      listadoFinal = listadoFinal.filter(
        (s) =>
          s.supervisorNombre.toLowerCase().includes(busqueda) ||
          s.naveNombre.toLowerCase().includes(busqueda) ||
          s.accion.toLowerCase().includes(busqueda)
      );
    }

    listadoFinal.sort((a, b) => {
      const cmpFecha = b.fechaJornada.localeCompare(a.fechaJornada);
      if (cmpFecha !== 0) return cmpFecha;
      return b.timestampInicio.localeCompare(a.timestampInicio);
    });

    return NextResponse.json(listadoFinal);
  } catch (error) {
    logError("API", "Error en GET /api/v1/auditoria/sesiones", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al consultar sesiones de auditoría." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: SesionControlSupervisor = await request.json();
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: "Usuario autenticado no encontrado." }, { status: 401 });
    }
    if (!(await userCanAccessNave(request, body.naveId))) {
      return NextResponse.json({ error: "La nave no pertenece al ámbito autorizado." }, { status: 403 });
    }
    const nave = await prisma.nave.findUnique({ where: { id: body.naveId }, select: { nombre: true } });
    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    const created = await prisma.sesionControlSupervisor.create({
      data: {
        id: body.id,
        supervisorId: actor.id,
        supervisorNombre: `${actor.nombres} ${actor.apellidos}`.trim(),
        naveId: body.naveId,
        naveNombre: nave.nombre,
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
    logError("API", "Error en POST /api/v1/auditoria/sesiones", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al registrar la sesión de control." }, { status: 500 });
  }
}
