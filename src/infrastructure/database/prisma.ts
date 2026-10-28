// ── Infraestructura: Cliente Singleton de Prisma ORM con Eventos Silenciados ──

import { PrismaClient, type Prisma } from "@prisma/client";
import { logError, logWarn } from "@/infrastructure/logger/system-logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

interface PrismaConEventos {
  $on(event: "error" | "warn", callback: (event: Prisma.LogEvent) => void): void;
}

/**
 * Optimiza los parámetros del Connection Pool para MySQL/MariaDB en alta concurrencia
 * evitando saturación de sockets y bloqueos por tiempo de espera.
 */
function obtenerDatabaseUrlOptimizada(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "15");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "15");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function crearPrismaClient(): PrismaClient {
  const datasourceUrl = obtenerDatabaseUrlOptimizada();
  const client = new PrismaClient({
    datasourceUrl,
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
    transactionOptions: {
      maxWait: 10000,
      timeout: 30000,
    },
  });

  const clientConEventos = client as unknown as PrismaConEventos;

  // Suscribir eventos al logger centralizado para evitar volcados crudos de Turbopack
  clientConEventos.$on("error", (e: Prisma.LogEvent) => {
    logError("PRISMA", e.message || "Error interno de Prisma", e);
  });

  clientConEventos.$on("warn", (e: Prisma.LogEvent) => {
    logWarn("PRISMA", e.message || "Advertencia de Prisma", e);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? crearPrismaClient();

globalForPrisma.prisma = prisma;

/**
 * Verifica de forma segura y no bloqueante la disponibilidad de la base de datos MySQL.
 * Retorna true si responde exitosamente, o false registrando el evento en ep-ema-system.log.
 */
export async function verificarConexionBD(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logError("DB-HEALTH", "No se pudo conectar al servidor MySQL", err);
    return false;
  }
}
