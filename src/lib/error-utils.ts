/**
 * Utilidades para clasificación y diagnóstico de errores en EP-EMA.
 */

export function esErrorConexion(error: unknown): boolean {
  if (!error) return false;

  const textoError = (() => {
    if (typeof error === "string") return error;
    if (error instanceof Error) return `${error.name} ${error.message}`;
    if (typeof error === "object" && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  })().toLowerCase();

  const patronesConexion = [
    "failed to fetch",
    "networkerror",
    "network error",
    "econnrefused",
    "err_connection",
    "err_network",
    "503",
    "504",
    "fetch failed",
    "servidor desconectado",
    "sin conexión",
    "sin conexion",
    "connection refused",
    "gateway timeout",
    "service unavailable",
    "timeout",
  ];

  return patronesConexion.some((patron) => textoError.includes(patron));
}

export function obtenerMensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Error inesperado del sistema";
}
