// ── Infraestructura: Servicio Centralizado de Logs del Sistema en Disco ───────
// Registra eventos críticos, errores de aplicación y salud de base de datos
// con rotación automática a 5 MB y marcas de tiempo en America/Guayaquil.

import fs from "node:fs";
import path from "node:path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const LOG_FILE_PATH = path.join(LOGS_DIR, "ep-ema-system.log");
const OLD_LOG_FILE_PATH = path.join(LOGS_DIR, "ep-ema-system.old.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

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

const colaLogs: string[] = [];
let procesandoCola = false;

/**
 * Worker asíncrono no bloqueante que vuelca la cola de logs a disco de forma
 * secuencial sin congelar el Event Loop de Node.js ni saturar el sistema de archivos.
 */
async function procesarColaLogs(): Promise<void> {
  if (procesandoCola) return;
  procesandoCola = true;

  try {
    while (colaLogs.length > 0) {
      const lote = colaLogs.splice(0, 50).join("");
      if (!lote) continue;

      try {
        if (!fs.existsSync(LOGS_DIR)) {
          await fs.promises.mkdir(LOGS_DIR, { recursive: true });
        }

        try {
          const stats = await fs.promises.stat(LOG_FILE_PATH);
          if (stats.size >= MAX_LOG_SIZE) {
            try {
              if (fs.existsSync(OLD_LOG_FILE_PATH)) {
                await fs.promises.unlink(OLD_LOG_FILE_PATH);
              }
              await fs.promises.rename(LOG_FILE_PATH, OLD_LOG_FILE_PATH);
            } catch {
              // Tolerancia ante rotación concurrente
            }
          }
        } catch {
          // Archivo aún no existe
        }

        await fs.promises.appendFile(LOG_FILE_PATH, lote, { encoding: "utf8" });
      } catch {
        // Tolerancia si el disco está temporalmente protegido o saturado
      }
    }
  } finally {
    procesandoCola = false;
    if (colaLogs.length > 0) {
      setImmediate(() => {
        void procesarColaLogs();
      });
    }
  }
}

/**
 * Encola de forma asíncrona y no bloqueante la entrada formateada para su escritura en disco.
 */
function encolarEnDisco(contenido: string): void {
  colaLogs.push(contenido);
  if (!procesandoCola) {
    void procesarColaLogs();
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
 * cuando la base de datos está inalcanzable (silenciado en consola para centralizar en logs).
 */
export function imprimirAvisoConsolaBD(): void {
  // Silenciado: errores y eventos de BD se almacenan exclusivamente en logs/ep-ema-system.log
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
  encolarEnDisco(texto);
  if (contexto === "STARTUP") {
    console.log(`[${contexto}] ${mensaje}`);
  }
}

/**
 * Registra una advertencia del sistema.
 */
export function logWarn(contexto: string, mensaje: string, detalle?: unknown): void {
  const esBD = esErrorConexionBD(detalle);
  const nivel = esBD ? "DB" : "WARN";
  const texto = formatearEntrada(nivel, contexto, mensaje, detalle);
  encolarEnDisco(texto);
}

/**
 * Registra un error crítico o de base de datos.
 */
export function logError(contexto: string, mensaje: string, error?: unknown): void {
  const esBD = esErrorConexionBD(error);
  const nivel = esBD ? "DB" : "ERROR";
  const texto = formatearEntrada(nivel, contexto, mensaje, error);
  encolarEnDisco(texto);
}
