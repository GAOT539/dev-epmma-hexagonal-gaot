// ── Capa de Aplicación: Servicio de Autenticación y Autorización ─────────────

import { solicitarRestablecimientoPassword as mockSolicitar } from "@/infrastructure/mocks/auth.mock";

export {
  MENU_POR_ROL,
  validatePassword,
  validatePassword as validarPassword,
} from "@/infrastructure/mocks/auth.mock";

export { useAuth, AuthProvider } from "@/infrastructure/auth/auth-context";

/**
 * Solicita el restablecimiento de contraseña llamando a la API del backend
 * e invocando el servicio de correo institucional Resend.
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
    console.warn("Fallo en llamada a /api/v1/auth/forgot-password, usando respaldo mock:", err);
    return mockSolicitar(identificador);
  }
}
