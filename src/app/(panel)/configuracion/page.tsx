import { UserCog, LogOut, Bell, Shield, ChevronRight } from "lucide-react";

// ── Metadatos de la página ────────────────────────────────────────────────────

export const metadata = {
  title: "Configuración | EPMMA",
  description: "Administra tu perfil y preferencias del sistema EPMMA.",
};

// ── Datos de opciones de configuración ───────────────────────────────────────

const configItems = [
  {
    id: "editar-perfil",
    label: "Editar Perfil",
    description: "Actualiza tu nombre, correo y contraseña.",
    Icon: UserCog,
    iconBg: "bg-acento-azul1/10",
    iconColor: "text-acento-azul1",
    danger: false,
  },
  {
    id: "notificaciones",
    label: "Notificaciones",
    description: "Gestiona alertas y avisos del sistema.",
    Icon: Bell,
    iconBg: "bg-acento-naranjaSalmon1/10",
    iconColor: "text-acento-naranjaSalmon1",
    danger: false,
  },
  {
    id: "permisos",
    label: "Permisos y Roles",
    description: "Consulta los accesos asignados a tu cuenta.",
    Icon: Shield,
    iconBg: "bg-acento-morado/10",
    iconColor: "text-acento-morado",
    danger: false,
  },
  {
    id: "cerrar-sesion",
    label: "Cerrar Sesión",
    description: "Finaliza tu sesión actual de forma segura.",
    Icon: LogOut,
    iconBg: "bg-base-red/10",
    iconColor: "text-base-red",
    danger: true,
  },
] as const;

// ── Página de Configuración ───────────────────────────────────────────────────

export default function ConfiguracionPage() {
  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      {/* ── Encabezado ── */}
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
          Configuración del Sistema
        </h1>
        <p className="mt-1 text-sm text-institucional-whiteSmokeBlack">
          Administra tu cuenta y las preferencias de la aplicación.
        </p>
      </header>

      {/* ── Lista de opciones ── */}
      <section aria-label="Opciones de configuración" className="max-w-2xl">
        <ul className="flex flex-col gap-3" role="list">
          {configItems.map(({ id, label, description, Icon, iconBg, iconColor, danger }) => (
            <li key={id}>
              <button
                type="button"
                id={id}
                className={[
                  "group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4",
                  "shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20",
                  "transition-all duration-150",
                  danger
                    ? "hover:ring-base-red/40 hover:bg-base-red/5"
                    : "hover:ring-institucional-green/30 hover:bg-institucional-green/5",
                ].join(" ")}
              >
                {/* Ícono */}
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
                >
                  <Icon size={20} strokeWidth={1.75} className={iconColor} aria-hidden="true" />
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className={`font-semibold text-sm leading-tight ${danger ? "text-base-red" : "text-base-eerieBlack"}`}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">
                    {description}
                  </p>
                </div>

                {/* Flecha */}
                <ChevronRight
                  size={16}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 ${danger ? "text-base-red/50" : "text-institucional-whiteSmokeBlack"}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
