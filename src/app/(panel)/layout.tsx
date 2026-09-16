"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ClipboardList,
  Settings,
  BarChart3,
  Monitor,
  ScrollText,
  LogOut,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/infrastructure/auth/auth-context";
import { MENU_POR_ROL } from "@/infrastructure/mocks/auth.mock";
import { useEffect } from "react";

// ── Definición completa de todos los enlaces ─────────────────────────────────

const allLinks = [
  { href: "/dashboard",     label: "Inicio",     Icon: Home          },
  { href: "/listas",        label: "Listas",     Icon: ClipboardList },
  { href: "/reportes",      label: "Reportes",   Icon: BarChart3     },
  { href: "/tic",           label: "Catastro",   Icon: Monitor       },
  { href: "/auditoria",     label: "Auditoría",  Icon: ScrollText    },
  { href: "/configuracion", label: "Config",     Icon: Settings      },
] as const;

// ── Subcomponente: ítem de navegación ─────────────────────────────────────────

function NavItem({
  href,
  label,
  Icon,
  isActive,
  variant,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  isActive: boolean;
  variant: "bottom" | "sidebar";
}) {
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        className={clsx(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors",
          isActive
            ? "text-institucional-green"
            : "text-institucional-whiteSmokeBlack hover:text-institucional-green"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon
          size={22}
          strokeWidth={isActive ? 2.2 : 1.75}
          aria-hidden="true"
        />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-institucional-green text-base-white shadow-sm"
          : "text-base-eerieBlack hover:bg-institucional-green/10 hover:text-institucional-green"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

// ── Layout del Panel ──────────────────────────────────────────────────────────

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Protección de ruta: redirigir a login si no hay sesión
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Mientras carga o no autenticado, mostrar skeleton
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-institucional-whiteSmoke flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-institucional-green/30 border-t-institucional-green animate-spin" />
          <p className="text-sm text-institucional-whiteSmokeBlack">Cargando...</p>
        </div>
      </div>
    );
  }

  // Filtrar ítems según rol del usuario
  const allowedPaths = MENU_POR_ROL[user.rol] ?? [];
  const filteredLinks = allLinks.filter((link) =>
    allowedPaths.includes(link.href)
  );

  // Para bottom nav, tomar los últimos 4 (o menos)
  const bottomLinks = filteredLinks.slice(0, 4);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke">
      {/* ── SIDEBAR DESKTOP (md+) ─────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-institucional-whiteSmokeBlack/30 bg-base-white shadow-sm md:flex"
        aria-label="Menú de navegación principal"
      >
        {/* Logo corporativo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-institucional-whiteSmokeBlack/20 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-institucional-green">
            <span className="text-base font-black leading-none text-base-white">E</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-base-eerieBlack">
              EPMMA
            </p>
            <p className="truncate text-[10px] leading-tight text-institucional-whiteSmokeBlack">
              Sistema de Gestión
            </p>
          </div>
        </div>

        {/* Menú de navegación */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1" role="list">
            {filteredLinks.map(({ href, label, Icon }) => (
              <li key={href}>
                <NavItem
                  href={href}
                  label={label}
                  Icon={Icon}
                  isActive={pathname === href || pathname.startsWith(href + "/")}
                  variant="sidebar"
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* Pie del sidebar con info de usuario */}
        <div className="border-t border-institucional-whiteSmokeBlack/20 p-4 space-y-3">
          {/* Info del usuario */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green">
              <User size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-base-eerieBlack">
                {user.nombres} {user.apellidos}
              </p>
              <p className="truncate text-[10px] text-institucional-whiteSmokeBlack">
                {user.rol.replace("_", " ")}
              </p>
            </div>
          </div>

          {/* Botón cerrar sesión */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-base-red transition-colors hover:bg-base-red/10"
          >
            <LogOut size={14} strokeWidth={2} />
            Cerrar sesión
          </button>

          <p className="text-[10px] text-institucional-whiteSmokeBlack">
            © {new Date().getFullYear()} EPMMA
          </p>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ───────────────────────────────────────── */}
      <main
        className={[
          // Mobile: padding-bottom para no quedar tapado por la bottom nav
          "pb-20",
          // Desktop: padding-left para dejar espacio al sidebar
          "md:ml-64 md:pb-0",
        ].join(" ")}
      >
        {children}
      </main>

      {/* ── BOTTOM NAVIGATION MOBILE (hasta md) ──────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 z-30 flex w-full items-stretch border-t border-institucional-whiteSmokeBlack/30 bg-base-white shadow-[0_-1px_6px_rgba(0,0,0,0.07)] md:hidden"
        aria-label="Navegación inferior"
      >
        {bottomLinks.map(({ href, label, Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            isActive={pathname === href || pathname.startsWith(href + "/")}
            variant="bottom"
          />
        ))}
      </nav>
    </div>
  );
}
