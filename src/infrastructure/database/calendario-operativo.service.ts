// ── Servicio de Calendario Operativo, Acceso Temporal y Persistencia Automática ──

import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import { format, parseISO, eachDayOfInterval, subDays, isAfter, isBefore, isEqual } from "date-fns";
import type { PermisoDetalle } from "@/domain/models/asistencia.model";
import type { DetalleComercianteControl } from "@/domain/models/auditoria.model";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";

/**
 * Expande las fechas cubiertas por una regla de día no laborable según su tipo.
 */
export function expandirFechasDeRegla(params: {
  tipoRegla: "DIA_UNICO" | "RANGO_CONTINUO" | "RECURRENTE_SEMANAL";
  fechaInicio: string;
  fechaFin: string;
  diasSemana?: number[];
}): string[] {
  const { tipoRegla, fechaInicio, fechaFin, diasSemana = [] } = params;

  if (tipoRegla === "DIA_UNICO") {
    return [fechaInicio];
  }

  if (fechaInicio > fechaFin) {
    return [];
  }

  const inicio = parseISO(fechaInicio);
  const fin = parseISO(fechaFin);
  const todosLosDias = eachDayOfInterval({ start: inicio, end: fin });

  if (tipoRegla === "RANGO_CONTINUO") {
    return todosLosDias.map((d) => format(d, "yyyy-MM-dd"));
  }

  if (tipoRegla === "RECURRENTE_SEMANAL") {
    const diasSet = new Set(diasSemana);
    return todosLosDias
      .filter((d) => diasSet.has(d.getDay()))
      .map((d) => format(d, "yyyy-MM-dd"));
  }

  return [];
}

/**
 * Comprueba si una fecha dada está configurada como Día No Laborable para una nave específica.
 */
export async function verificarDiaNoLaborableNave(
  naveId: string,
  fechaStr: string
): Promise<{ esNoLaborable: boolean; motivo?: string; reglaId?: string }> {
  const reglas = await prisma.reglaDiaNoLaborable.findMany({
    where: {
      fechaInicio: { lte: fechaStr },
      fechaFin: { gte: fechaStr },
    },
  });

  for (const regla of reglas) {
    const fechasExp = Array.isArray(regla.fechasExpandidas)
      ? (regla.fechasExpandidas as string[])
      : [];
    if (!fechasExp.includes(fechaStr)) continue;

    if (regla.aplicaTodasNaves) {
      return { esNoLaborable: true, motivo: regla.motivo, reglaId: regla.id };
    }

    const navesIds = Array.isArray(regla.navesIds) ? (regla.navesIds as string[]) : [];
    if (navesIds.includes(naveId)) {
      return { esNoLaborable: true, motivo: regla.motivo, reglaId: regla.id };
    }
  }

  return { esNoLaborable: false };
}

/**
 * Devuelve un mapa consolidado de fechas no laborables dentro de un rango específico.
 */
export async function obtenerMapaDiasNoLaborablesEnRango(
  fechaInicio: string,
  fechaFin: string
): Promise<{
  globales: Set<string>;
  porNave: Map<string, Set<string>>;
  motivosPorNaveFecha: Map<string, string>;
}> {
  const reglas = await prisma.reglaDiaNoLaborable.findMany({
    where: {
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
    },
  });

  const globales = new Set<string>();
  const porNave = new Map<string, Set<string>>();
  const motivosPorNaveFecha = new Map<string, string>();

  for (const regla of reglas) {
    const fechasExp = Array.isArray(regla.fechasExpandidas)
      ? (regla.fechasExpandidas as string[])
      : [];

    for (const f of fechasExp) {
      if (f < fechaInicio || f > fechaFin) continue;

      if (regla.aplicaTodasNaves) {
        globales.add(f);
        motivosPorNaveFecha.set(`global__${f}`, regla.motivo);
      } else {
        const navesIds = Array.isArray(regla.navesIds) ? (regla.navesIds as string[]) : [];
        for (const nId of navesIds) {
          const setNave = porNave.get(nId) || new Set<string>();
          setNave.add(f);
          porNave.set(nId, setNave);
          motivosPorNaveFecha.set(`${nId}__${f}`, regla.motivo);
        }
      }
    }
  }

  return { globales, porNave, motivosPorNaveFecha };
}

/**
 * Ejecuta la persistencia automática de asistencia para una nave y fecha determinada
 * debido a permiso o justificación de su supervisor asignado.
 */
export async function ejecutarPersistenciaAutomaticaSupervisor(params: {
  naveId: string;
  fechaStr: string;
  supervisorId: string;
  supervisorNombre: string;
  motivoPermiso: string;
}): Promise<void> {
  const { naveId, fechaStr, supervisorId, supervisorNombre, motivoPermiso } = params;

  // 1. Si es día no laborable en esa nave, no generar asistencia
  const checkNoLab = await verificarDiaNoLaborableNave(naveId, fechaStr);
  if (checkNoLab.esNoLaborable) return;

  // 2. Solo generar para fechas de hoy o pasadas
  const hoyReal = obtenerFechaHoyEcuador();
  if (fechaStr > hoyReal) return;

  // 3. Buscar nave con sus puestos ocupados y comerciantes habilitados
  const nave = await prisma.nave.findUnique({
    where: { id: naveId },
    include: {
      puestos: {
        where: { estado: "Ocupado" },
        include: { comerciante: true },
      },
    },
  });

  if (!nave || nave.puestos.length === 0) return;

  const comerciantesNave = nave.puestos
    .map((p) => p.comerciante)
    .filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c !== undefined && c.estadoRegistro === "Habilitado"
    );

  if (comerciantesNave.length === 0) return;

  const comercianteIds = comerciantesNave.map((c) => c.idInterno);

  // 4. Buscar fechaOrigen (hasta 30 días atrás)
  const fechaDestinoObj = parseISO(fechaStr);
  const fechaLimiteInferior = format(subDays(fechaDestinoObj, 30), "yyyy-MM-dd");

  const ultimoRegistroPrevio = await prisma.registroAsistencia.findFirst({
    where: {
      comercianteId: { in: comercianteIds },
      fecha: { lt: fechaStr, gte: fechaLimiteInferior },
    },
    orderBy: { fecha: "desc" },
    select: { fecha: true },
  });

  const fechaOrigen = ultimoRegistroPrevio?.fecha ?? null;
  const fechaBase = fechaOrigen || fechaStr;

  // 5. Registros de fechaOrigen para arrastrar ausencias y permisos
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

  // 6. Sesión existente para preservar registros manuales
  const sesionExistente = await prisma.sesionControlSupervisor.findFirst({
    where: {
      naveId: nave.id,
      fechaJornada: fechaStr,
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

  // 7. Ejecutar persistencia en transacción atómica
  await prisma.$transaction(async (tx) => {
    const nuevosDetalles: DetalleComercianteControl[] = [];

    for (const puesto of nave.puestos) {
      const com = puesto.comerciante;
      if (!com || com.estadoRegistro !== "Habilitado") continue;

      if (idsManuales.has(com.idInterno)) {
        const detManual = detallesPrevios.find((d) => d.comercianteId === com.idInterno);
        if (detManual) nuevosDetalles.push(detManual);
        continue;
      }

      const regOrigen = mapaOrigen.get(com.idInterno);
      let estadoFinal: "Presente" | "Ausente" | "Permiso" = "Presente";
      let permisoActivo = false;
      const permisosArray: PermisoDetalle[] = [];

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

      await tx.registroAsistencia.upsert({
        where: {
          comercianteId_fecha: { comercianteId: com.idInterno, fecha: fechaStr },
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
          fecha: fechaStr,
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
        horaRegistro: format(new Date(), "HH:mm"),
      });
    }

    const totalOcupados = comerciantesNave.length;
    const presentes = nuevosDetalles.filter((d) => d.estado === "Presente").length;
    const ausentes = nuevosDetalles.filter((d) => d.estado === "Ausente").length;
    const permisos = nuevosDetalles.filter((d) => d.estado === "Permiso").length;

    const resumenData = {
      totalOcupados,
      tomados: totalOcupados,
      presentes,
      ausentes,
      permisos,
    };

    if (sesionExistente) {
      await tx.sesionControlSupervisor.update({
        where: { id: sesionExistente.id },
        data: {
          supervisorId,
          supervisorNombre,
          accion: "Persistencia automática por permiso/justificación",
          esPersistencia: true,
          fechaOrigenPersistencia: fechaOrigen,
          comentarioPersistencia: "Permiso/Justificación: " + motivoPermiso,
          etiquetas: Array.from(new Set([...((sesionExistente.etiquetas as string[]) || []), "CON_PERSISTENCIA", "EN_FECHA"])),
          resumen: resumenData,
          detallesComerciantes: nuevosDetalles as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      await tx.sesionControlSupervisor.create({
        data: {
          supervisorId,
          supervisorNombre,
          naveId: nave.id,
          naveNombre: nave.nombre,
          fechaJornada: fechaStr,
          accion: "Persistencia automática por permiso/justificación",
          esPersistencia: true,
          fechaOrigenPersistencia: fechaOrigen,
          comentarioPersistencia: "Permiso/Justificación: " + motivoPermiso,
          modificadoTrasPersistencia: false,
          tieneRetraso: false,
          etiquetas: ["CON_PERSISTENCIA", "EN_FECHA"],
          resumen: resumenData,
          detallesComerciantes: nuevosDetalles as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });
}
