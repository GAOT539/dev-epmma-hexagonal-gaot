// ── Capa de Aplicación: Servicio de Autenticación y Autorización ─────────────

export {
  MENU_POR_ROL,
  validatePassword,
  validatePassword as validarPassword,
} from "@/infrastructure/auth/password-policy.utils";

export { useAuth, AuthProvider } from "@/infrastructure/auth/auth-context";

/**
 * Solicita el restablecimiento de contraseña llamando a la API del backend
 * e invocando el servicio de correo institucional SMTP.
 */
export async function solicitarRestablecimientoPassword(identificador: string) {
  try {
    const res = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador }),
    });

    if (res.ok) {
      return await res.json();
    }

    const data = await res.json();
    return { success: false, error: data.error || "Error al solicitar restablecimiento." };
  } catch (err) {
    console.error("Error al conectar con /api/v1/auth/forgot-password:", err);
    return {
      success: false,
      error: "Error de conexión con el servidor al solicitar restablecimiento.",
    };
  }
}

