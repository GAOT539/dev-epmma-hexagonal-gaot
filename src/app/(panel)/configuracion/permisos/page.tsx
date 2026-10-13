"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  LayoutGrid,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/application/services/auth.service";
import { usuarioService } from "@/application/services/usuario.service";
import { naveService } from "@/application/services/nave.service";
import type { Usuario } from "@/domain/models/usuario.model";
import type { Nave } from "@/domain/models/nave.model";
import { toast } from "sonner";

interface SupervisorConfig {
  persistencia: boolean;
  vistaDefault: "lista" | "treemap";
}

export default function ConfiguracionPermisosPage() {
  const { user } = useAuth();
  const [supervisores, setSupervisores] = useState<Usuario[]>([]);
  const [naves, setNaves] = useState<Nave[]>([]);
  const [cargando, setCargando] = useState(true);

  const isSupervisor = user?.rol === "SUPERVISOR";
  const isAdmin = user?.rol === "TIC" || user?.rol === "SUPERADMIN";

  const [configs, setConfigs] = useState<Record<string, SupervisorConfig>>({});

  useEffect(() => {
    let cancel = false;
    async function cargarDatos() {
      try {
        const [sups, listaNaves] = await Promise.all([
          usuarioService.obtenerSupervisores(),
          naveService.obtenerNaves(),
        ]);
        if (!cancel) {
          setSupervisores(sups);
          setNaves(listaNaves);

          const initial: Record<string, SupervisorConfig> = {};
          for (const sup of sups) {
            initial[sup.id] = { persistencia: false, vistaDefault: "lista" };
          }
          if (typeof window !== "undefined") {
            try {
              const guardado = localStorage.getItem("epmma_supervisor_configs");
              if (guardado) {
                const parsed = JSON.parse(guardado);
                setConfigs({ ...initial, ...parsed });
                return;
              }
            } catch (e) {
              console.error("Error al leer configuraciones de localStorage", e);
            }
          }
          setConfigs(initial);
        }
      } catch (err) {
        console.error("Error al cargar datos en permisos", err);
      } finally {
        if (!cancel) setCargando(false);
      }
    }
    cargarDatos();
    return () => {
      cancel = true;
    };
  }, []);

  function togglePersistencia(supId: string) {
    setConfigs((prev) => {
      const nuevo = {
        ...prev,
        [supId]: {
          ...prev[supId],
          persistencia: !prev[supId]?.persistencia,
        },
      };
      try {
        localStorage.setItem("epmma_supervisor_configs", JSON.stringify(nuevo));
      } catch (e) {
        console.error("Error al guardar en localStorage", e);
      }
      return nuevo;
    });
    toast.success("Configuración actualizada", {
      description: `Persistencia de asistencia ${configs[supId]?.persistencia ? "desactivada" : "activada"}.`,
    });
  }

  function toggleVista(supId: string) {
    setConfigs((prev) => {
      const nuevo = {
        ...prev,
        [supId]: {
          ...prev[supId],
          vistaDefault:
            prev[supId]?.vistaDefault === "lista" ? ("treemap" as const) : ("lista" as const),
        },
      };
      try {
        localStorage.setItem("epmma_supervisor_configs", JSON.stringify(nuevo));
      } catch (e) {
        console.error("Error al guardar en localStorage", e);
      }
      return nuevo;
    });
    toast.success("Vista actualizada", {
      description: "Vista predeterminada cambiada.",
    });
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[100dvh] bg-institucional-whiteSmoke">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-2 mb-4">
          <Link
            href="/configuracion"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Volver
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
                Permisos y Roles
              </h1>
              {isSupervisor && (
                <p className="text-sm text-gray-700 font-medium mt-1">
                  Ajustes de persistencia y vista por defecto para tu cuenta.
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <Link
                  href="/configuracion/usuarios"
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
                >
                  Usuarios
                </Link>
                <Link
                  href="/configuracion/importacion"
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
                >
                  Importación
                </Link>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium text-gray-600">Cargando permisos y configuraciones...</span>
          </div>
        ) : (
          <>
            {/* Supervisor ve sus propias preferencias */}
            {isSupervisor && user && (
              <section
                aria-label="Preferencias de asistencia"
                className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15">
                  <h2 className="text-sm font-bold text-base-eerieBlack flex items-center gap-2">
                    <RefreshCw size={16} className="text-institucional-green" />
                    Preferencias de Asistencia
                  </h2>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Ajustes de persistencia y vista por defecto para tu cuenta.
                  </p>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Toggle Persistencia */}
                    <button
                      type="button"
                      onClick={() => togglePersistencia(user.id)}
                      className="flex items-center gap-2 rounded-lg bg-institucional-whiteSmoke px-3 py-2 text-xs transition-colors hover:bg-institucional-green/5"
                    >
                      {configs[user.id]?.persistencia ? (
                        <ToggleRight size={20} className="text-acento-verdeOliva1" />
                      ) : (
                        <ToggleLeft size={20} className="text-gray-700" />
                      )}
                      <span
                        className={`font-medium ${
                          configs[user.id]?.persistencia
                            ? "text-acento-verdeOliva1"
                            : "text-gray-700"
                        }`}
                      >
                        Persistencia de Asistencia
                      </span>
                    </button>

                    {/* Toggle Vista */}
                    <button
                      type="button"
                      onClick={() => toggleVista(user.id)}
                      className="flex items-center gap-2 rounded-lg bg-institucional-whiteSmoke px-3 py-2 text-xs transition-colors hover:bg-institucional-green/5"
                    >
                      {configs[user.id]?.vistaDefault === "lista" ? (
                        <ListChecks size={16} className="text-institucional-green" />
                      ) : (
                        <LayoutGrid size={16} className="text-institucional-green" />
                      )}
                      <span className="font-medium text-base-eerieBlack">
                        Vista:{" "}
                        {configs[user.id]?.vistaDefault === "lista"
                          ? "Lista"
                          : "Mapa de Árbol"}
                      </span>
                    </button>
                  </div>

                  {configs[user.id]?.persistencia && (
                    <p className="text-xs text-acento-verdeOliva1 font-medium">
                      ✓ El sistema acarreará automáticamente los estados
                      Presente u Observación del día anterior.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* TIC / Admin ve la lista de todos los supervisores */}
            {isAdmin && (
              <section
                aria-label="Configuración de supervisores"
                className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15">
                  <h2 className="text-sm font-bold text-base-eerieBlack flex items-center gap-2">
                    <RefreshCw size={16} className="text-institucional-green" />
                    Configuración de Supervisores
                  </h2>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
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
                      <li key={sup.id} className="px-5 py-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-institucional-green text-xs font-bold">
                            {sup.nombres.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-base-eerieBlack">
                              {sup.nombres} {sup.apellidos}
                            </p>
                            <p className="text-xs text-gray-700 font-medium">
                              {sup.cedula}
                              {sup.navesAsignadas && sup.navesAsignadas.length > 0 && (
                                <span className="ml-2 text-acento-azul1 font-medium">
                                  Naves: {sup.navesAsignadas.map((id) =>
                                    naves.find((n) => n.id === id)?.nombre ?? id
                                  ).join(", ")}
                                </span>
                              )}
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
                                className="text-gray-700"
                              />
                            )}
                            <span
                              className={`font-medium ${
                                cfg.persistencia
                                  ? "text-acento-verdeOliva1"
                                  : "text-gray-700"
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
                          <p className="text-xs text-acento-verdeOliva1 font-medium pl-11">
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
          </>
        )}
      </div>
    </div>
  );
}
