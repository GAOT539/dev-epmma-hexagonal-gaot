// ── Cliente: Logger Liviano para el Navegador ────────────────────────────────
// Centraliza logs de error y advertencia en el servidor sin ensuciar la consola cliente.

function enviarLogAlServidor(
  nivel: "WARN" | "ERROR",
  contexto: string,
  mensaje: string,
  errorODetalle?: unknown
): void {
  if (typeof window === "undefined") return;

  try {
    let detalle: unknown = null;
    if (errorODetalle instanceof Error) {
      detalle = {
        name: errorODetalle.name,
        message: errorODetalle.message,
        stack: errorODetalle.stack,
      };
    } else if (typeof errorODetalle === "object" && errorODetalle !== null) {
      try {
        detalle = JSON.parse(JSON.stringify(errorODetalle));
      } catch {
        detalle = String(errorODetalle);
      }
    } else if (errorODetalle !== undefined) {
      detalle = String(errorODetalle);
    }

    fetch("/api/v1/system-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nivel,
        contexto,
        mensaje,
        detalle,
      }),
      keepalive: true,
    }).catch(() => {
      // Ignorar de forma silenciosa ante cierres abruptos de pestaña
    });
  } catch {
    // Evitar cualquier lanzamiento de excepciones en el cliente
  }
}

/**
 * Registra un error de cliente y lo envía silenciosamente al servidor.
 */
export function logClientError(contexto: string, mensaje: string, error?: unknown): void {
  enviarLogAlServidor("ERROR", contexto, mensaje, error);
}

/**
 * Registra una advertencia de cliente y la envía silenciosamente al servidor.
 */
export function logClientWarn(contexto: string, mensaje: string, detalle?: unknown): void {
  enviarLogAlServidor("WARN", contexto, mensaje, detalle);
}

