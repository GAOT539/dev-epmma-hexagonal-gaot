// ── Infraestructura: Servicio Centralizado de Logs del Sistema en Disco ───────
// Registra eventos críticos, errores de aplicación y salud de base de datos
// con rotación automática a 5 MB y marcas de tiempo en America/Guayaquil.

import fs from "node:fs";
import path from "node:path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const LOG_FILE_PATH = path.join(LOGS_DIR, "ep-ema-system.log");
const OLD_LOG_FILE_PATH = path.join(LOGS_DIR, "ep-ema-system.old.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

let ultimoAvisoConsolaBD = 0;
const THROTTLE_BD_MS = 30_000; // 30 segundos de throttle en consola

/**
 * Obtiene la marca de tiempo actual en formato exacto "YYYY-MM-DD HH:mm:ss"
 * en la zona horaria oficial de Ecuador (America/Guayaquil).
 */
export function obtenerTimestampEcuador(): string {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    return `${getVal("year")}-${getVal("month")}-${getVal("day")} ${getVal("hour")}:${getVal("minute")}:${getVal("second")}`;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Asegura la existencia del directorio logs/ y realiza la rotación automática
 * renombrando a ep-ema-system.old.log si el archivo supera los 5 MB.
 */
function asegurarDirectorioYRotacion(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    if (fs.existsSync(LOG_FILE_PATH)) {
      const stats = fs.statSync(LOG_FILE_PATH);
      if (stats.size >= MAX_LOG_SIZE) {
        if (fs.existsSync(OLD_LOG_FILE_PATH)) {
          fs.unlinkSync(OLD_LOG_FILE_PATH);
        }
        fs.renameSync(LOG_FILE_PATH, OLD_LOG_FILE_PATH);
      }
    }
  } catch {
    // Tolerancia ante restricciones de permisos del sistema de archivos
  }
}

/**
 * Escribe de forma síncrona y segura la entrada formateada en el archivo de log.
 */
function escribirEnDisco(contenido: string): void {
  try {
    asegurarDirectorioYRotacion();
    fs.appendFileSync(LOG_FILE_PATH, contenido, { encoding: "utf8" });
  } catch {
    // Si el disco estuviera protegido contra escritura, evitar abortar el proceso Node
  }
}

/**
 * Formatea una línea de log con fecha/hora, nivel, contexto, mensaje y detalles/stack.
 */
function formatearEntrada(
  nivel: "INFO" | "WARN" | "ERROR" | "DB",
  contexto: string,
  mensaje: string,
  errorODetalle?: unknown
): string {
  const timestamp = obtenerTimestampEcuador();
  let entrada = `[${timestamp}] [${nivel}] [${contexto}] ${mensaje}`;

  if (errorODetalle !== undefined) {
    if (errorODetalle instanceof Error) {
      entrada += `\n  Error: ${errorODetalle.message}`;
      if (errorODetalle.stack) {
        entrada += `\n  Stack: ${errorODetalle.stack}`;
      }
    } else if (typeof errorODetalle === "object" && errorODetalle !== null) {
      try {
        entrada += `\n  Detalle: ${JSON.stringify(errorODetalle, null, 2)}`;
      } catch {
        entrada += `\n  Detalle: [Objeto no serializable]`;
      }
    } else {
      entrada += `\n  Detalle: ${String(errorODetalle)}`;
    }
  }
  return entrada + "\n";
}

/**
 * Emite una sola línea limpia en consola con throttle de 30 segundos
 * cuando la base de datos está inalcanzable.
 */
function imprimirAvisoConsolaBD(): void {
  const ahora = Date.now();
  if (ahora - ultimoAvisoConsolaBD > THROTTLE_BD_MS) {
    ultimoAvisoConsolaBD = ahora;
    console.warn(
      "[EP-EMA DB] Servidor MySQL no disponible temporalmente. El evento fue registrado en logs/ep-ema-system.log."
    );
  }
}

/**
 * Detecta si un error corresponde a una desconexión o fallo de servidor de base de datos MySQL/Prisma.
 */
export function esErrorConexionBD(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    const name = String(err.name || "");
    const code = String(err.code || "");
    const message = String(err.message || "");

    if (name === "PrismaClientInitializationError") return true;
    if (code === "P1001" || code === "P1002" || code === "P1003" || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
      return true;
    }
    if (
      message.includes("P1001") ||
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("PrismaClientInitializationError")
    ) {
      return true;
    }
  } else if (typeof error === "string") {
    if (
      error.includes("P1001") ||
      error.includes("Can't reach database server") ||
      error.includes("ECONNREFUSED") ||
      error.includes("ETIMEDOUT") ||
      error.includes("PrismaClientInitializationError")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Registra un evento de nivel informativo.
 */
export function logInfo(contexto: string, mensaje: string): void {
  const texto = formatearEntrada("INFO", contexto, mensaje);
  escribirEnDisco(texto);
  console.log(`[${contexto}] ${mensaje}`);
}

/**
 * Registra una advertencia del sistema.
 */
export function logWarn(contexto: string, mensaje: string, detalle?: unknown): void {
  const esBD = esErrorConexionBD(detalle);
  const nivel = esBD ? "DB" : "WARN";
  const texto = formatearEntrada(nivel, contexto, mensaje, detalle);
  escribirEnDisco(texto);

  if (esBD) {
    imprimirAvisoConsolaBD();
  } else {
    console.warn(`[${contexto}] ${mensaje}`, detalle !== undefined ? detalle : "");
  }
}

/**
 * Registra un error crítico o de base de datos.
 */
export function logError(contexto: string, mensaje: string, error?: unknown): void {
  const esBD = esErrorConexionBD(error);
  const nivel = esBD ? "DB" : "ERROR";
  const texto = formatearEntrada(nivel, contexto, mensaje, error);
  escribirEnDisco(texto);

  if (esBD) {
    imprimirAvisoConsolaBD();
  } else {
    console.error(`[${contexto}] ${mensaje}`, error !== undefined ? error : "");
  }
}
