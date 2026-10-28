// ── Endpoint Receptor de Logs del Cliente ────────────────────────────────────
// Recibe eventos de advertencia y error del navegador y los centraliza en disco.

import { NextResponse } from "next/server";
import { logError, logWarn, logInfo } from "@/infrastructure/logger/system-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const nivel = body?.nivel || "ERROR";
    const contexto = `CLIENT:${body?.contexto || "UI"}`;
    let mensaje = String(body?.mensaje || "Evento reportado por cliente");
    if (mensaje.length > 500) {
      mensaje = mensaje.slice(0, 500) + "... [truncado]";
    }

    let detalle = body?.detalle;
    if (typeof detalle === "string" && detalle.length > 2000) {
      detalle = detalle.slice(0, 2000) + "... [truncado]";
    } else if (typeof detalle === "object" && detalle !== null) {
      try {
        const serializado = JSON.stringify(detalle);
        if (serializado.length > 2000) {
          detalle = { truncado: serializado.slice(0, 2000) + "..." };
        }
      } catch {
        detalle = "[Detalle no serializable]";
      }
    }

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

