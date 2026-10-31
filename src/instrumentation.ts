// ── Hook de Arranque del Servidor Next.js (Instrumentation) ───────────────────

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verificarConexionBD, prisma } = await import(
      "@/infrastructure/database/prisma"
    );
    const { hashPassword, verifyPasswordHash } = await import(
      "@/infrastructure/auth/password.utils"
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

        // Actualización automática en caliente de la clave de SUPERADMIN si aún tiene la clave anterior
        try {
          const adminUser = await prisma.usuario.findFirst({
            where: {
              OR: [{ id: "u-super" }, { cedula: "admin" }],
            },
          });
          if (adminUser) {
            const tieneClaveAnterior = await verifyPasswordHash(
              "1500888985*admin",
              adminUser.passwordHash
            );
            if (tieneClaveAnterior) {
              const nuevoHash = await hashPassword(
                "Ravine.Snooze.Cover9.Defendant"
              );
              await prisma.usuario.update({
                where: { id: adminUser.id },
                data: {
                  passwordHash: nuevoHash,
                  mustChangePassword: false,
                },
              });
              logInfo(
                "STARTUP",
                "Contraseña oficial de SUPERADMIN actualizada automáticamente en MySQL."
              );
            }
          }
        } catch (adminErr) {
          logError(
            "STARTUP",
            "Error al verificar/actualizar credencial de SUPERADMIN",
            adminErr
          );
        }

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
