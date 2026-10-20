// ── Hook de Arranque del Servidor Next.js (Instrumentation) ───────────────────

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      iniciarCronAsistenciaDiaria2AM,
      asegurarAsistenciaInicialDelDia,
    } = await import("@/infrastructure/database/daily-attendance.service");
    const { asegurarColacionEspanolEnBD } = await import(
      "@/infrastructure/database/nave-puestos-sync.service"
    );

    try {
      await asegurarColacionEspanolEnBD();
      await asegurarAsistenciaInicialDelDia();
      iniciarCronAsistenciaDiaria2AM();
    } catch (error) {
      console.error("[INSTRUMENTATION] Error al inicializar servicios en arranque:", error);
    }
  }
}
