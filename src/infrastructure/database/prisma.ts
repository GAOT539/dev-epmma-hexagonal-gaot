// ── Infraestructura: Cliente Singleton de Prisma ORM con Eventos Silenciados ──

import { PrismaClient, type Prisma } from "@prisma/client";
import { logError, logWarn } from "@/infrastructure/logger/system-logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

interface PrismaConEventos {
  $on(event: "error" | "warn", callback: (event: Prisma.LogEvent) => void): void;
}

function crearPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
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
