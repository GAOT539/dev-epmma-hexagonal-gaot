"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Settings,
  BarChart3,
  Monitor,
  Building2,
  ScrollText,
  FileSpreadsheet,
  LogOut,
  User,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth, MENU_POR_ROL } from "@/application/services/auth.service";
import { useEffect } from "react";

// ── Definición completa de todos los enlaces ─────────────────────────────────

interface NavLinkItem {
  href: string;
  label: string;
  shortLabel?: string;
  Icon: React.ElementType;
}

const allLinks: readonly NavLinkItem[] = [
  { href: "/listas",           label: "Listas",                  shortLabel: "Listas",        Icon: ClipboardList   },
  { href: "/reportes",         label: "Reportes",                shortLabel: "Reportes",      Icon: BarChart3       },
  { href: "/catastro",         label: "Catastro",                shortLabel: "Catastro",      Icon: Monitor         },
  { href: "/naves",            label: "Naves",                   shortLabel: "Naves",         Icon: Building2       },
  { href: "/controlsupervisores", label: "Control de Supervisores", shortLabel: "Control",       Icon: ScrollText      },
  { href: "/ingreso-catastro", label: "Ingreso de Catastro",     shortLabel: "Ingreso Cat.",  Icon: FileSpreadsheet },
  { href: "/configuracion",    label: "Config",                  shortLabel: "Config",        Icon: Settings        },
];

// ── Subcomponente: ítem de navegación ─────────────────────────────────────────

function NavItem({
  href,
  label,
  shortLabel,
  Icon,
  isActive,
  variant,
  isStatic = false,
}: {
  href: string;
  label: string;
  shortLabel?: string;
  Icon: React.ElementType;
  isActive: boolean;
  variant: "bottom" | "sidebar";
  isStatic?: boolean;
}) {
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        className={clsx(
          "flex flex-col items-center justify-center transition-colors",
          isStatic
            ? "w-full min-w-0 flex-1 px-0.5 py-2 text-center"
            : "shrink-0 min-w-[72px] flex-1 px-1 py-2",
          isActive
            ? "text-institucional-green font-semibold"
            : "text-gray-700 hover:text-institucional-green font-medium"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon
          size={isStatic ? 20 : 22}
          strokeWidth={isActive ? 2.2 : 1.75}
          aria-hidden="true"
          className="shrink-0"
        />
        <span
          className={clsx(
            "leading-tight text-center truncate w-full max-w-full block mt-0.5",
            isStatic ? "text-[10px] sm:text-xs" : "text-xs"
          )}
        >
          {shortLabel || label}
        </span>
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

  // Protección de ruta: redirigir a login si no hay sesión o si la ruta no está permitida
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    const allowedPaths = MENU_POR_ROL[user.rol] ?? [];
    const isAllowedBase = allowedPaths.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!isAllowedBase) {
      router.replace(allowedPaths[0] || "/login");
      return;
    }

    if (
      pathname.startsWith("/configuracion/usuarios") &&
      user.rol !== "SUPERADMIN" &&
      user.rol !== "TIC"
    ) {
      router.replace("/configuracion");
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  // Mientras carga o no autenticado, mostrar skeleton
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-[100dvh] bg-institucional-whiteSmoke flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-institucional-green/30 border-t-institucional-green animate-spin" />
          <p className="text-sm text-gray-700 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // Filtrar ítems según rol del usuario
  const allowedPaths = MENU_POR_ROL[user.rol] ?? [];
  const filteredLinks = allLinks.filter((link) =>
    allowedPaths.includes(link.href)
  );
  const isStaticBottom = filteredLinks.length <= 5;
  const gridColsClass =
    filteredLinks.length === 5
      ? "grid-cols-5"
      : filteredLinks.length === 4
      ? "grid-cols-4"
      : filteredLinks.length === 3
      ? "grid-cols-3"
      : filteredLinks.length === 2
      ? "grid-cols-2"
      : "grid-cols-1";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-[100dvh] bg-institucional-whiteSmoke">
      {/* ── SIDEBAR DESKTOP (md+) ─────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-institucional-whiteSmokeBlack/30 bg-gray-50 shadow-sm md:flex"
        aria-label="Menú de navegación principal"
      >
        {/* Logo corporativo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-institucional-whiteSmokeBlack/20 px-5">
          <Image
            src="/icon.png"
            alt="Logo EP-EMA"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-base-eerieBlack">
              EP-EMA
            </p>
            <p className="truncate text-xs leading-tight text-gray-700 font-medium">
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
              <p className="truncate text-xs text-gray-700 font-medium">
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

          <p className="text-xs text-gray-700 font-medium">
            © {new Date().getFullYear()} EP-EMA
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
        className={clsx(
          "fixed bottom-0 left-0 z-30 border-t border-institucional-whiteSmokeBlack/30 bg-gray-50 shadow-[0_-1px_6px_rgba(0,0,0,0.07)] md:hidden",
          isStaticBottom
            ? clsx("grid w-full overflow-hidden px-1 py-1 gap-0", gridColsClass)
            : "flex w-full items-stretch overflow-x-auto flex-nowrap gap-2 scrollbar-hide px-2 py-1"
        )}
        style={
          isStaticBottom
            ? { gridTemplateColumns: `repeat(${filteredLinks.length}, minmax(0, 1fr))` }
            : undefined
        }
        aria-label="Navegación inferior"
      >
        {filteredLinks.map(({ href, label, shortLabel, Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            shortLabel={shortLabel}
            Icon={Icon}
            isActive={pathname === href || pathname.startsWith(href + "/")}
            variant="bottom"
            isStatic={isStaticBottom}
          />
        ))}
      </nav>
    </div>
  );
}
