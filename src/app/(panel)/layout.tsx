"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Settings, BarChart3 } from "lucide-react";
import { clsx } from "clsx";

// ── Definición de los enlaces de navegación ───────────────────────────────────

const sidebarLinks = [
  { href: "/dashboard",     label: "Inicio",    Icon: Home          },
  { href: "/listas",        label: "Listas",    Icon: ClipboardList },
  { href: "/reportes",      label: "Reportes",  Icon: BarChart3     },
  { href: "/configuracion", label: "Config",    Icon: Settings      },
] as const;

const bottomLinks = [
  { href: "/configuracion", label: "Config",    Icon: Settings      },
  { href: "/dashboard",     label: "Inicio",    Icon: Home          },
  { href: "/reportes",      label: "Reportes",  Icon: BarChart3     },
  { href: "/listas",        label: "Listas",    Icon: ClipboardList },
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
            {sidebarLinks.map(({ href, label, Icon }) => (
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

        {/* Pie del sidebar */}
        <div className="border-t border-institucional-whiteSmokeBlack/20 p-4">
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
