// ── Hook de Arranque del Servidor Next.js (Instrumentation) ───────────────────

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verificarConexionBD } = await import(
      "@/infrastructure/database/prisma"
    );
    const {
      iniciarCronAsistenciaDiaria2AM,
      asegurarAsistenciaInicialDelDia,
    } = await import("@/infrastructure/database/daily-attendance.service");
    const { asegurarColacionEspanolEnBD } = await import(
      "@/infrastructure/database/nave-puestos-sync.service"
    );
    const { logInfo, logError } = await import(
      "@/infrastructure/logger/system-logger"
    );

    try {
      const dbActiva = await verificarConexionBD();
      if (dbActiva) {
        await asegurarColacionEspanolEnBD();
        await asegurarAsistenciaInicialDelDia();
        logInfo(
          "STARTUP",
          "Servicios iniciales y colación verificados correctamente en MySQL."
        );
      }
      iniciarCronAsistenciaDiaria2AM();
    } catch (error) {
      logError("STARTUP", "Error al inicializar servicios en arranque", error);
    }
  }
}
