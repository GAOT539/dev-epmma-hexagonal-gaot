// ── Hook de Arranque del Servidor Next.js (Instrumentation) ───────────────────

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      iniciarCronAsistenciaDiaria2AM,
      asegurarAsistenciaInicialDelDia,
    } = await import("@/infrastructure/database/daily-attendance.service");

    try {
      await asegurarAsistenciaInicialDelDia();
      iniciarCronAsistenciaDiaria2AM();
    } catch (error) {
      console.error("[INSTRUMENTATION] Error al inicializar asistencia en arranque:", error);
    }
  }
}
