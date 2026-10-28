// ── API Route: /api/v1/auditoria/reporte-supervisores ─────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { parseISO, format, subDays, differenceInCalendarDays, eachDayOfInterval } from "date-fns";
import type { PermisoDetalle, ObservacionDetalle } from "@/domain/models/asistencia.model";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";
import { obtenerMapaDiasNoLaborablesEnRango } from "@/infrastructure/database/calendario-operativo.service";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export interface ResumenGestionSupervisor {
  numero: number;
  supervisorId: string;
  supervisorNombre: string;
  navesACargo: string;
  justificaciones: number;
  permisos: number;
  observacionesGenerales: number;
  citaciones: number;
  notificaciones: number;
  diasSinIngreso: number;
}

export interface PermisoSupervisorPeriodoItem {
  supervisorId: string;
  supervisorNombre: string;
  vigenciaTexto: string;
  motivo: string;
  naveNombre: string;
  accionCobertura: string;
}

export interface EventoDetalladoSupervisor {
  fecha: string;
  naveNombre: string;
  puestoCodigo: string;
  comercianteNombre: string;
  tipoEvento:
    | "Permiso Asignado"
    | "Justificación de Falta"
    | "Citación"
    | "Notificación"
    | "Observación General"
    | "SIN INGRESO AL SISTEMA"
    | "Permiso de Supervisor";
  motivo: string;
  documentoRef: string;
  vigenciaTexto: string;
}

export interface DetalleSupervisorReporte {
  supervisorId: string;
  supervisorNombre: string;
  navesAsignadas: string;
  metricas: {
    justificaciones: number;
    permisos: number;
    observacionesGenerales: number;
    citaciones: number;
    notificaciones: number;
    diasSinIngreso: number;
  };
  eventos: EventoDetalladoSupervisor[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supervisorId = searchParams.get("supervisorId") || undefined;
    const hoyStr = obtenerFechaHoyEcuador();
    const ayerStr = format(subDays(parseISO(hoyStr), 1), "yyyy-MM-dd");

    const fechaDesde = searchParams.get("fechaDesde") || format(parseISO(hoyStr), "yyyy-MM-01");
    const fechaHasta = searchParams.get("fechaHasta") || hoyStr;

    // 1. Consultas a la base de datos
    const [supervisores, naves, registros, sesiones, permisosSupervisores, mapaNoLab] =
      await Promise.all([
        prisma.usuario.findMany({
          where: {
            rol: "SUPERVISOR",
            estado: "Habilitado",
            ...(supervisorId ? { id: supervisorId } : {}),
          },
          orderBy: { apellidos: "asc" },
        }),
        prisma.nave.findMany({
          where: { estadoRegistro: "Habilitado" },
          include: {
            puestos: {
              where: { estado: "Ocupado" },
              include: { comerciante: true },
            },
          },
        }),
        prisma.registroAsistencia.findMany({
          where: {
            fecha: { gte: fechaDesde, lte: fechaHasta },
          },
          include: {
            puesto: true,
            comerciante: true,
          },
        }),
        prisma.sesionControlSupervisor.findMany({
          where: {
            fechaJornada: { gte: fechaDesde, lte: fechaHasta },
            ...(supervisorId ? { supervisorId } : {}),
          },
        }),
        prisma.permisoSupervisor.findMany({
          where: {
            fechaInicio: { lte: fechaHasta },
            fechaFin: { gte: fechaDesde },
            estado: "ACTIVO",
          },
          include: { coberturas: true },
          orderBy: { fechaInicio: "asc" },
        }),
        obtenerMapaDiasNoLaborablesEnRango(fechaDesde, fechaHasta),
      ]);

    // Rango de fechas pasadas para evaluar días sin ingreso (<= ayerStr)
    const fechaHastaPasada = fechaHasta < ayerStr ? fechaHasta : ayerStr;
    const fechasPasadas =
      fechaDesde <= fechaHastaPasada
        ? eachDayOfInterval({
            start: parseISO(fechaDesde),
            end: parseISO(fechaHastaPasada),
          })
            .map((d) => format(d, "yyyy-MM-dd"))
            .filter((f) => f <= ayerStr)
        : [];

    const resumenSupervisores: ResumenGestionSupervisor[] = [];
    const detallesPorSupervisor: DetalleSupervisorReporte[] = [];

    // 2. Procesar cada supervisor
    supervisores.forEach((sup, idx) => {
      const nombreCompleto = `${sup.nombres} ${sup.apellidos}`.trim();

      const supNavesStr =
        typeof sup.navesAsignadas === "string"
          ? sup.navesAsignadas
          : Array.isArray(sup.navesAsignadas)
          ? (sup.navesAsignadas as string[]).join(", ")
          : "";

      // Identificar naves asignadas
      const navesAsignadas = naves.filter((nave) => {
        const supervisoresNave = Array.isArray(nave.supervisores)
          ? (nave.supervisores as string[])
          : [];
        return (
          supervisoresNave.some((nom) =>
            nombreCompleto.toLowerCase().includes(String(nom).toLowerCase())
          ) || (supNavesStr.length > 0 && supNavesStr.toLowerCase().includes(nave.nombre.toLowerCase()))
        );
      });

      const navesTexto: string =
        navesAsignadas.length > 0
          ? navesAsignadas.map((n) => n.nombre).join(", ")
          : supNavesStr || "Sin naves asignadas";

      const naveIds = new Set(navesAsignadas.map((n) => n.id));
      const regsSupervisor = registros.filter(
        (r) => r.puesto && naveIds.has(r.puesto.naveId)
      );

      let justificaciones = 0;
      let permisos = 0;
      let observacionesGenerales = 0;
      let citaciones = 0;
      let notificaciones = 0;
      let diasSinIngreso = 0;

      const eventos: EventoDetalladoSupervisor[] = [];
      const permisosUnicosVistos = new Set<string>();

      // Eventos de asistencia de comerciantes en las naves del supervisor
      for (const reg of regsSupervisor) {
        const naveObj = naves.find((n) => n.id === reg.puesto.naveId);
        const naveNombre = naveObj?.nombre || "Nave";
        const puestoCodigo = reg.puesto.codigo || "—";
        const comercianteNombre = reg.comerciante?.contribuyente || "—";

        // Permisos y justificaciones
        const perms = Array.isArray(reg.permisos)
          ? (reg.permisos as unknown as PermisoDetalle[])
          : [];

        for (const p of perms) {
          const keyPerm = p.id || `${p.motivo}__${p.fechaInicio}__${reg.comercianteId}`;
          if (permisosUnicosVistos.has(keyPerm)) continue;
          permisosUnicosVistos.add(keyPerm);

          const mStr = String(p.motivo || "").trim();
          const esJust =
            mStr.toLowerCase().includes("justificación de falta") ||
            mStr.toLowerCase().includes("falta justificada");
          const dias =
            p.fechaInicio && p.fechaFin
              ? Math.max(
                  1,
                  differenceInCalendarDays(parseISO(p.fechaFin), parseISO(p.fechaInicio)) + 1
                )
              : 1;
          const vigenciaTexto =
            p.fechaInicio && p.fechaFin
              ? `Del ${p.fechaInicio} al ${p.fechaFin} (${dias} día(s))`
              : "1 jornada";

          if (esJust) {
            justificaciones++;
            const motivoLimpio = mStr
              .replace(/^Justificación de falta:\s*/i, "")
              .replace(/^Falta justificada[^:]*:\s*/i, "")
              .trim();
            eventos.push({
              fecha: p.fechaAsignacion || p.fechaInicio || reg.fecha,
              naveNombre,
              puestoCodigo,
              comercianteNombre,
              tipoEvento: "Justificación de Falta",
              motivo: motivoLimpio || mStr,
              documentoRef: "—",
              vigenciaTexto,
            });
          } else {
            permisos++;
            eventos.push({
              fecha: p.fechaAsignacion || p.fechaInicio || reg.fecha,
              naveNombre,
              puestoCodigo,
              comercianteNombre,
              tipoEvento: "Permiso Asignado",
              motivo: mStr,
              documentoRef: "—",
              vigenciaTexto,
            });
          }
        }

        // Observaciones, citaciones y notificaciones
        const obss = Array.isArray(reg.observaciones)
          ? (reg.observaciones as unknown as ObservacionDetalle[])
          : [];

        for (const obs of obss) {
          if (obs.texto?.startsWith("Falta justificada (registrada")) continue;

          const tipoObs = String(obs.tipo || "");
          if (tipoObs === "Citaciones") {
            citaciones++;
            eventos.push({
              fecha: reg.fecha,
              naveNombre,
              puestoCodigo,
              comercianteNombre,
              tipoEvento: "Citación",
              motivo: obs.texto,
              documentoRef: obs.numeroDocumento || "—",
              vigenciaTexto: obs.fechaHora || "Puntual",
            });
          } else if (tipoObs.includes("Notifica")) {
            notificaciones++;
            eventos.push({
              fecha: reg.fecha,
              naveNombre,
              puestoCodigo,
              comercianteNombre,
              tipoEvento: "Notificación",
              motivo: obs.texto,
              documentoRef: obs.numeroDocumento || "—",
              vigenciaTexto: obs.fechaHora || "Puntual",
            });
          } else {
            observacionesGenerales++;
            eventos.push({
              fecha: reg.fecha,
              naveNombre,
              puestoCodigo,
              comercianteNombre,
              tipoEvento: "Observación General",
              motivo: obs.texto,
              documentoRef: obs.numeroDocumento || "—",
              vigenciaTexto: obs.fechaHora || "Puntual",
            });
          }
        }
      }

      // Permisos propios del Supervisor en el período
      const permisosDelSup = permisosSupervisores.filter((p) => p.supervisorId === sup.id);
      for (const permSup of permisosDelSup) {
        for (const cob of permSup.coberturas) {
          if (navesAsignadas.length === 0 || naveIds.has(cob.naveId)) {
            const diasSup = Math.max(
              1,
              differenceInCalendarDays(
                parseISO(permSup.fechaFin),
                parseISO(permSup.fechaInicio)
              ) + 1
            );
            eventos.push({
              fecha: permSup.fechaInicio,
              naveNombre: cob.naveNombre,
              puestoCodigo: "TODA LA NAVE",
              comercianteNombre: "—",
              tipoEvento: "Permiso de Supervisor",
              motivo: permSup.motivo,
              documentoRef: "—",
              vigenciaTexto: `Del ${permSup.fechaInicio} al ${permSup.fechaFin} (${diasSup} d.) — ${
                cob.tipoCobertura === "REEMPLAZO_TEMPORAL"
                  ? "A cargo: " + (cob.supervisorReemplazoNombre || "Reemplazo")
                  : "Activado por Persistencia"
              }`,
            });
          }
        }
      }

      // Días pasados en que el supervisor NO entró al sistema
      for (const f of fechasPasadas) {
        // Filtrar naves asignadas que eran laborables en fecha f
        const navesLaborables = navesAsignadas.filter(
          (n) => !mapaNoLab.globales.has(f) && !mapaNoLab.porNave.get(n.id)?.has(f)
        );

        if (navesLaborables.length === 0) continue;

        // Verificar si tuvo sesión registrada de control en esa fecha
        const tuvoSesion = sesiones.some(
          (s) =>
            s.supervisorId === sup.id &&
            s.fechaJornada === f &&
            !s.accion.toLowerCase().includes("no ingresó")
        );

        // Verificar si tenía permiso activo en esa fecha
        const tuvoPermiso = permisosDelSup.some(
          (p) => p.fechaInicio <= f && f <= p.fechaFin
        );

        if (!tuvoSesion && !tuvoPermiso) {
          diasSinIngreso++;
          for (const nLab of navesLaborables) {
            eventos.push({
              fecha: f,
              naveNombre: nLab.nombre,
              puestoCodigo: "—",
              comercianteNombre: "—",
              tipoEvento: "SIN INGRESO AL SISTEMA",
              motivo: `El supervisor no ingresó al sistema el ${format(parseISO(f), "dd/MM/yyyy")}`,
              documentoRef: "—",
              vigenciaTexto: "1 jornada",
            });
          }
        }
      }

      // Ordenar eventos cronológicamente
      eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

      resumenSupervisores.push({
        numero: idx + 1,
        supervisorId: sup.id,
        supervisorNombre: nombreCompleto,
        navesACargo: navesTexto,
        justificaciones,
        permisos,
        observacionesGenerales,
        citaciones,
        notificaciones,
        diasSinIngreso,
      });

      detallesPorSupervisor.push({
        supervisorId: sup.id,
        supervisorNombre: nombreCompleto,
        navesAsignadas: navesTexto,
        metricas: {
          justificaciones,
          permisos,
          observacionesGenerales,
          citaciones,
          notificaciones,
          diasSinIngreso,
        },
        eventos,
      });
    });

    // 3. Permisos de Supervisores en el período para la Tabla 2
    const permisosSupervisoresPeriodo: PermisoSupervisorPeriodoItem[] = [];
    for (const p of permisosSupervisores) {
      if (supervisorId && p.supervisorId !== supervisorId) continue;
      for (const cob of p.coberturas) {
        permisosSupervisoresPeriodo.push({
          supervisorId: p.supervisorId,
          supervisorNombre: p.supervisorNombre,
          vigenciaTexto: `Del ${p.fechaInicio} al ${p.fechaFin}`,
          motivo: p.motivo,
          naveNombre: cob.naveNombre,
          accionCobertura:
            cob.tipoCobertura === "REEMPLAZO_TEMPORAL"
              ? `Se dejó a cargo a: ${cob.supervisorReemplazoNombre || "Reemplazo"}`
              : "Se activó por Persistencia Automática",
        });
      }
    }

    return NextResponse.json({
      resumenSupervisores,
      permisosSupervisoresPeriodo,
      detallesPorSupervisor,
      fechaDesde,
      fechaHasta,
    });
  } catch (error) {
    logError("API", "Error en GET /api/v1/auditoria/reporte-supervisores", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al generar el reporte detallado de supervisores." },
      { status: 500 }
    );
  }
}
