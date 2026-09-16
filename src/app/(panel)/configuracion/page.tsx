"use client";

import { useState } from "react";
import {
  UserCog,
  LogOut,
  Bell,
  Shield,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/infrastructure/auth/auth-context";
import { getSupervisores } from "@/infrastructure/mocks/auth.mock";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface SupervisorConfig {
  persistencia: boolean;
  vistaDefault: "lista" | "treemap";
}

// ── Página de Configuración ──────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const supervisores = getSupervisores();

  // Estado de configuración por supervisor (en memoria)
  const [configs, setConfigs] = useState<Record<string, SupervisorConfig>>(() => {
    const initial: Record<string, SupervisorConfig> = {};
    for (const sup of supervisores) {
      initial[sup.id] = { persistencia: false, vistaDefault: "lista" };
    }
    return initial;
  });

  function togglePersistencia(supId: string) {
    setConfigs((prev) => ({
      ...prev,
      [supId]: {
        ...prev[supId],
        persistencia: !prev[supId]?.persistencia,
      },
    }));
    toast.success("Configuración actualizada", {
      description: `Persistencia de asistencia ${configs[supId]?.persistencia ? "desactivada" : "activada"}.`,
    });
  }

  function toggleVista(supId: string) {
    setConfigs((prev) => ({
      ...prev,
      [supId]: {
        ...prev[supId],
        vistaDefault:
          prev[supId]?.vistaDefault === "lista" ? "treemap" : "lista",
      },
    }));
    toast.success("Vista actualizada", {
      description: `Vista predeterminada cambiada.`,
    });
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // ── Opciones de menú estáticas ─────────────────────────────────────────────

  const configItems = [
    {
      id: "editar-perfil",
      label: "Editar Perfil",
      description: "Actualiza tu nombre, correo y contraseña.",
      Icon: UserCog,
      iconBg: "bg-acento-azul1/10",
      iconColor: "text-acento-azul1",
      danger: false,
      onClick: () => toast.info("Funcionalidad en desarrollo"),
    },
    {
      id: "notificaciones",
      label: "Notificaciones",
      description: "Gestiona alertas y avisos del sistema.",
      Icon: Bell,
      iconBg: "bg-acento-naranjaSalmon1/10",
      iconColor: "text-acento-naranjaSalmon1",
      danger: false,
      onClick: () => toast.info("Funcionalidad en desarrollo"),
    },
    {
      id: "permisos",
      label: "Permisos y Roles",
      description: `Tu rol actual: ${user?.rol?.replace("_", " ") ?? "—"}`,
      Icon: Shield,
      iconBg: "bg-acento-morado/10",
      iconColor: "text-acento-morado",
      danger: false,
      onClick: () => toast.info("Funcionalidad en desarrollo"),
    },
    {
      id: "cerrar-sesion",
      label: "Cerrar Sesión",
      description: "Finaliza tu sesión actual de forma segura.",
      Icon: LogOut,
      iconBg: "bg-base-red/10",
      iconColor: "text-base-red",
      danger: true,
      onClick: handleLogout,
    },
  ];

  const showSupervisorConfig =
    user?.rol === "SUPERADMIN" || user?.rol === "TIC" || user?.rol === "SUPERVISOR";

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

      <div className="max-w-2xl space-y-6">
        {/* ── Opciones de configuración ── */}
        <section aria-label="Opciones de configuración">
          <ul className="flex flex-col gap-3" role="list">
            {configItems.map(
              ({ id, label, description, Icon, iconBg, iconColor, danger, onClick }) => (
                <li key={id}>
                  <button
                    type="button"
                    id={id}
                    onClick={onClick}
                    className={[
                      "group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4",
                      "shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20",
                      "transition-all duration-150",
                      danger
                        ? "hover:ring-base-red/40 hover:bg-base-red/5"
                        : "hover:ring-institucional-green/30 hover:bg-institucional-green/5",
                    ].join(" ")}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.75}
                        className={iconColor}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={`font-semibold text-sm leading-tight ${
                          danger ? "text-base-red" : "text-base-eerieBlack"
                        }`}
                      >
                        {label}
                      </p>
                      <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">
                        {description}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      strokeWidth={2}
                      className={`shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 ${
                        danger
                          ? "text-base-red/50"
                          : "text-institucional-whiteSmokeBlack"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              )
            )}
          </ul>
        </section>

        {/* ── Configuración de Supervisores ── */}
        {showSupervisorConfig && (
          <section
            aria-label="Configuración de supervisores"
            className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15">
              <h2 className="text-sm font-bold text-base-eerieBlack flex items-center gap-2">
                <RefreshCw size={16} className="text-institucional-green" />
                Configuración de Supervisores
              </h2>
              <p className="text-xs text-institucional-whiteSmokeBlack mt-0.5">
                Ajustes de persistencia de asistencia y vista por defecto.
              </p>
            </div>

            <ul className="divide-y divide-institucional-whiteSmokeBlack/10">
              {supervisores.map((sup) => {
                const cfg = configs[sup.id] ?? {
                  persistencia: false,
                  vistaDefault: "lista" as const,
                };
                return (
                  <li
                    key={sup.id}
                    className="px-5 py-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green text-xs font-bold">
                        {sup.nombres.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-base-eerieBlack">
                          {sup.nombres} {sup.apellidos}
                        </p>
                        <p className="text-[10px] text-institucional-whiteSmokeBlack">
                          {sup.cedula}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-11">
                      {/* Toggle Persistencia */}
                      <button
                        type="button"
                        onClick={() => togglePersistencia(sup.id)}
                        className="flex items-center gap-2 rounded-lg bg-institucional-whiteSmoke px-3 py-2 text-xs transition-colors hover:bg-institucional-green/5"
                      >
                        {cfg.persistencia ? (
                          <ToggleRight
                            size={20}
                            className="text-acento-verdeOliva1"
                          />
                        ) : (
                          <ToggleLeft
                            size={20}
                            className="text-institucional-whiteSmokeBlack"
                          />
                        )}
                        <span
                          className={`font-medium ${
                            cfg.persistencia
                              ? "text-acento-verdeOliva1"
                              : "text-institucional-whiteSmokeBlack"
                          }`}
                        >
                          Persistencia de Asistencia
                        </span>
                      </button>

                      {/* Toggle Vista */}
                      <button
                        type="button"
                        onClick={() => toggleVista(sup.id)}
                        className="flex items-center gap-2 rounded-lg bg-institucional-whiteSmoke px-3 py-2 text-xs transition-colors hover:bg-institucional-green/5"
                      >
                        {cfg.vistaDefault === "lista" ? (
                          <ListChecks
                            size={16}
                            className="text-institucional-green"
                          />
                        ) : (
                          <LayoutGrid
                            size={16}
                            className="text-institucional-green"
                          />
                        )}
                        <span className="font-medium text-base-eerieBlack">
                          Vista:{" "}
                          {cfg.vistaDefault === "lista"
                            ? "Lista"
                            : "Mapa de Árbol"}
                        </span>
                      </button>
                    </div>

                    {cfg.persistencia && (
                      <p className="text-[10px] text-acento-verdeOliva1 pl-11">
                        ✓ El sistema acarreará automáticamente los estados
                        Presente u Observación del día anterior.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
