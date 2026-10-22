// ── Servicio de Asistencia Diaria Automática (02:00 AM Ecuador + Catch-Up Resiliente) ──

import { prisma, verificarConexionBD } from "@/infrastructure/database/prisma";
import { logInfo, logError } from "@/infrastructure/logger/system-logger";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

declare global {
  var __epmma_cron_2am_initialized: boolean | undefined;
  var __epmma_last_2am_run_date: string | undefined;
  var __epmma_last_occupied_count: number | undefined;
  var __epmma_last_sync_timestamp: number | undefined;
  var __epmma_sync_in_flight: Promise<{ totalInicializados: number; fecha: string }> | undefined;
}

/**
 * Obtiene la fecha actual en la zona horaria oficial de Ecuador (America/Guayaquil)
 * en formato estándar ISO "YYYY-MM-DD".
 */
export function obtenerFechaHoyEcuador(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Obtiene la hora actual (0-23) en la zona horaria oficial de Ecuador (America/Guayaquil).
 */
export function obtenerHoraEcuador(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
}

/**
 * Asegura que todos los comerciantes con puesto ocupado y estado habilitado tengan
 * su registro de asistencia para el día de hoy inicializado en "Presente" (o "Permiso"
 * si tienen un permiso vigente registrado).
 *
 * Esta operación es 100% idempotente, segura contra condiciones de carrera y
 * NUNCA toca registros de fechas pasadas ni futuras, ni sobreescribe modificaciones
 * manuales realizadas en la jornada de hoy.
 */
export async function asegurarAsistenciaInicialDelDia(
  fechaHoyStr?: string,
  forzar: boolean = false
): Promise<{
  totalInicializados: number;
  fecha: string;
}> {
  // Blindaje estricto: solo se generan registros para hoy en Ecuador (nunca días pasados ni futuros)
  const hoyReal = obtenerFechaHoyEcuador();
  const hoyStr = fechaHoyStr && fechaHoyStr === hoyReal ? fechaHoyStr : hoyReal;

  // 1. Fast-Path en memoria: Si no es forzado, la fecha coincide y pasaron < 60s de la última sincronización
  const ahora = Date.now();
  if (
    !forzar &&
    globalThis.__epmma_last_2am_run_date === hoyStr &&
    globalThis.__epmma_last_sync_timestamp &&
    ahora - globalThis.__epmma_last_sync_timestamp < 60_000
  ) {
    return { totalInicializados: 0, fecha: hoyStr };
  }

  // 2. Single-Flight Lock: Si ya hay una sincronización en vuelo y no es forzada, reutilizar la misma Promise
  if (!forzar && globalThis.__epmma_sync_in_flight) {
    return globalThis.__epmma_sync_in_flight;
  }

  const syncPromise = (async () => {
    try {
      return await ejecutarAsegurarAsistencia(hoyStr);
    } finally {
      globalThis.__epmma_sync_in_flight = undefined;
    }
  })();

  globalThis.__epmma_sync_in_flight = syncPromise;
  return syncPromise;
}

async function ejecutarAsegurarAsistencia(hoyStr: string): Promise<{
  totalInicializados: number;
  fecha: string;
}> {
  // 1. Obtener todos los puestos ocupados con comerciantes habilitados
  const puestosOcupados = await prisma.puesto.findMany({
    where: {
      estado: "Ocupado",
      comercianteId: { not: null },
      comerciante: {
        estadoRegistro: "Habilitado",
      },
    },
    include: {
      comerciante: true,
    },
  });

  if (puestosOcupados.length === 0) {
    globalThis.__epmma_last_sync_timestamp = Date.now();
    const hour = obtenerHoraEcuador();
    if (hour >= 2) {
      globalThis.__epmma_last_2am_run_date = hoyStr;
    }
    globalThis.__epmma_last_occupied_count = 0;
    return { totalInicializados: 0, fecha: hoyStr };
  }

  // 2. Comerciantes que ya cuentan con registro en la fecha de hoy
  const existentes = await prisma.registroAsistencia.findMany({
    where: { fecha: hoyStr },
    select: { comercianteId: true },
  });
  const existentesSet = new Set(existentes.map((r) => r.comercianteId));

  // 3. Filtrar comerciantes que aún no tienen registro para hoy
  const faltantes = puestosOcupados.filter(
    (p) => p.comerciante && !existentesSet.has(p.comerciante.idInterno)
  );

  // Si todos los puestos ocupados ya tienen su registro hoy, finalizar en silencio sin escrituras innecesarias
  if (faltantes.length === 0) {
    globalThis.__epmma_last_sync_timestamp = Date.now();
    const hour = obtenerHoraEcuador();
    if (hour >= 2) {
      globalThis.__epmma_last_2am_run_date = hoyStr;
    }
    globalThis.__epmma_last_occupied_count = puestosOcupados.length;
    return { totalInicializados: 0, fecha: hoyStr };
  }

  // 4. Identificar permisos vigentes para los comerciantes faltantes
  const faltantesComercianteIds = faltantes
    .map((p) => p.comerciante?.idInterno)
    .filter((id): id is string => Boolean(id));

  const permisosVigentes = await prisma.registroAsistencia.findMany({
    where: {
      comercianteId: { in: faltantesComercianteIds },
      permisoInicio: { lte: hoyStr },
      permisoFin: { gte: hoyStr },
    },
    orderBy: { creadoEn: "desc" },
  });

  const permisosMap = new Map<string, (typeof permisosVigentes)[0]>();
  for (const reg of permisosVigentes) {
    if (!permisosMap.has(reg.comercianteId)) {
      permisosMap.set(reg.comercianteId, reg);
    }
  }

  // 5. Preparar registros para inserción segura (sin sobrescribir existentes)
  const registrosParaCrear: Prisma.RegistroAsistenciaCreateManyInput[] = [];

  for (const puesto of faltantes) {
    const comerciante = puesto.comerciante;
    if (!comerciante) continue;

    const registroConPermiso = permisosMap.get(comerciante.idInterno);
    const tienePermiso = Boolean(registroConPermiso);

    registrosParaCrear.push({
      id: crypto.randomUUID(),
      comercianteId: comerciante.idInterno,
      puestoId: puesto.id,
      fecha: hoyStr,
      estado: tienePermiso ? "Permiso" : "Presente",
      observacion: null,
      observacionTexto: null,
      observaciones: [],
      permisos: registroConPermiso?.permisos
        ? (registroConPermiso.permisos as Prisma.InputJsonValue)
        : [],
      permisoInicio: registroConPermiso?.permisoInicio ?? null,
      permisoFin: registroConPermiso?.permisoFin ?? null,
    });
  }

  let totalInicializados = 0;

  if (registrosParaCrear.length > 0) {
    try {
      const resultado = await prisma.registroAsistencia.createMany({
        data: registrosParaCrear,
        skipDuplicates: true,
      });
      totalInicializados = resultado.count;
    } catch {
      // Fallback seguro individual por upsert si createMany tuviera algún rechazo de lote
      for (const reg of registrosParaCrear) {
        try {
          await prisma.registroAsistencia.upsert({
            where: {
              comercianteId_fecha: {
                comercianteId: reg.comercianteId,
                fecha: hoyStr,
              },
            },
            update: {
              // Idempotencia absoluta: NUNCA sobreescribir registros existentes
            },
            create: reg,
          });
          totalInicializados++;
        } catch {
          // Registro concurrente creado con éxito
        }
      }
    }
  }

  globalThis.__epmma_last_sync_timestamp = Date.now();
  const hour = obtenerHoraEcuador();
  if (hour >= 2) {
    globalThis.__epmma_last_2am_run_date = hoyStr;
  }
  globalThis.__epmma_last_occupied_count = puestosOcupados.length;

  return { totalInicializados, fecha: hoyStr };
}

/**
 * Inicializa un planificador resiliente en memoria que:
 * 1. Ejecuta inmediatamente la verificación de recuperación (Catch-up) al iniciar el servidor
 *    (sea la 01:00 AM, las 08:00 AM o las 03:00 PM).
 * 2. Cada 60 segundos comprueba si la hora actual es >= 2 (02:00 AM en adelante) en Ecuador
 *    y la fecha de hoy aún no ha sido sincronizada, disparando la generación automática.
 *    Esto garantiza que si el servidor estuvo apagado o en hibernación a las 02:00 AM y
 *    enciende a las 08:00 AM, la asistencia se genere inmediatamente en el primer ciclo.
 */
export function iniciarCronAsistenciaDiaria2AM() {
  if (globalThis.__epmma_cron_2am_initialized) return;
  globalThis.__epmma_cron_2am_initialized = true;

  // Verificación de recuperación (Catch-up) en arranque solo si la BD está activa
  // y la fecha de hoy aún no ha sido sincronizada
  (async () => {
    const hoyStr = obtenerFechaHoyEcuador();
    if (globalThis.__epmma_last_2am_run_date !== hoyStr) {
      const bdActiva = await verificarConexionBD();
      if (!bdActiva) return;
      try {
        await asegurarAsistenciaInicialDelDia(hoyStr);
      } catch (err) {
        logError("ARRANQUE", "Error en verificación inicial de asistencia", err);
      }
    }
  })();

  setInterval(async () => {
    try {
      if (!(await verificarConexionBD())) return;

      const hour = obtenerHoraEcuador();
      const hoyStr = obtenerFechaHoyEcuador();

      // Si la hora es >= 2 (02:00 AM en adelante) y la jornada de hoy no ha sido sincronizada
      if (hour >= 2 && globalThis.__epmma_last_2am_run_date !== hoyStr) {
        logInfo(
          "CRON-ASISTENCIA",
          `Sincronización automática de jornada (${hoyStr}) a las ${hour}h Ecuador...`
        );
        await asegurarAsistenciaInicialDelDia(hoyStr);
      }
    } catch (err) {
      logError("CRON-ASISTENCIA", "Error en ciclo de verificación de asistencia", err);
    }
  }, 60_000);
}
