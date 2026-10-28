// ── Endpoint Receptor de Logs del Cliente ────────────────────────────────────
// Recibe eventos de advertencia y error del navegador y los centraliza en disco.

import { NextResponse } from "next/server";
import { logError, logWarn, logInfo } from "@/infrastructure/logger/system-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const nivel = body?.nivel || "ERROR";
    const contexto = `CLIENT:${body?.contexto || "UI"}`;
    const mensaje = body?.mensaje || "Evento reportado por cliente";
    const detalle = body?.detalle;

    if (nivel === "WARN") {
      logWarn(contexto, mensaje, detalle);
    } else if (nivel === "INFO") {
      logInfo(contexto, mensaje);
    } else {
      logError(contexto, mensaje, detalle);
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Retornar siempre { ok: true } con status 200 para jamás generar errores en cascada
    return NextResponse.json({ ok: true });
  }
}

