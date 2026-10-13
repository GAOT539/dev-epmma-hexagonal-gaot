// ── Capa de Aplicación: Servicio de Autenticación y Autorización ─────────────
export {
  MENU_POR_ROL,
  validatePassword,
  validatePassword as validarPassword,
} from "@/infrastructure/mocks/auth.mock";

export { useAuth, AuthProvider } from "@/infrastructure/auth/auth-context";
