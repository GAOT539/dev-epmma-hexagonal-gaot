"use client";

import { useState } from "react";
import {
  UserCog,
  LogOut,
  Shield,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  ListChecks,
  LayoutGrid,
  RefreshCw,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Users,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/infrastructure/auth/auth-context";
import {
  getSupervisores,
  getUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
} from "@/infrastructure/mocks/auth.mock";
import { getNaves } from "@/infrastructure/mocks/mercado.mock";
import type { Rol } from "@/domain/models/comerciante.model";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Tipos ────────────────────────────────────────────────────────────────────

type ActiveView = "main" | "permisos" | "usuarios";

interface SupervisorConfig {
  persistencia: boolean;
  vistaDefault: "lista" | "treemap";
}

// ── Modal de Cambio de Contraseña ────────────────────────────────────────────

function ChangePasswordDialog({
  open,
  onClose,
  onChangePassword,
}: {
  open: boolean;
  onClose: () => void;
  onChangePassword: (current: string, newPass: string) => { success: boolean; error?: string };
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    const result = onChangePassword(currentPassword, newPassword);
    if (!result.success) {
      setError(result.error ?? "Error al cambiar la contraseña.");
      return;
    }

    toast.success("Contraseña actualizada", {
      description: "Tu contraseña ha sido cambiada exitosamente.",
    });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  }

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock size={18} className="text-acento-azul1" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription>
            Ingresa tu contraseña actual y la nueva contraseña.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Contraseña Actual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nueva Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres, mayúscula, número y especial"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita la nueva contraseña"
            />
          </div>
          {error && (
            <p className="text-xs text-base-red font-medium">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-acento-azul1 text-base-white hover:bg-acento-azul2"
          >
            Cambiar Contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal CRUD de Usuarios ───────────────────────────────────────────────────

function UserFormDialog({
  open,
  user,
  onClose,
  onSave,
}: {
  open: boolean;
  user: { id: string; nombres: string; apellidos: string; cedula: string; rol: Rol; navesAsignadas?: string[] } | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const naves = getNaves();
  const isEdit = !!user;

  const [nombres, setNombres] = useState(user?.nombres ?? "");
  const [apellidos, setApellidos] = useState(user?.apellidos ?? "");
  const [cedula, setCedula] = useState(user?.cedula ?? "");
  const [rol, setRol] = useState<Rol>(user?.rol ?? "SUPERVISOR");
  const [navesAsignadas, setNavesAsignadas] = useState<string[]>(
    user?.navesAsignadas ?? []
  );
  const [error, setError] = useState("");

  function toggleNave(naveId: string) {
    setNavesAsignadas((prev) =>
      prev.includes(naveId)
        ? prev.filter((id) => id !== naveId)
        : [...prev, naveId]
    );
  }

  function handleSubmit() {
    setError("");

    if (!nombres.trim() || !cedula.trim()) {
      setError("Nombres y Cédula son obligatorios.");
      return;
    }

    if (rol === "SUPERVISOR" && navesAsignadas.length === 0) {
      setError("Un supervisor debe tener al menos una nave asignada.");
      return;
    }

    if (isEdit && user) {
      editarUsuario(user.id, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        cedula: cedula.trim(),
        rol,
        navesAsignadas: rol === "SUPERVISOR" ? navesAsignadas : undefined,
      });
      toast.success("Usuario actualizado", {
        description: `${nombres} ${apellidos} editado correctamente.`,
      });
    } else {
      crearUsuario({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        cedula: cedula.trim(),
        rol,
        navesAsignadas: rol === "SUPERVISOR" ? navesAsignadas : undefined,
      });
      toast.success("Usuario creado", {
        description: `${nombres} ${apellidos} creado con contraseña por defecto.`,
      });
    }

    onSave();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                <Pencil size={18} className="text-acento-azul1" />
                Editar Usuario
              </>
            ) : (
              <>
                <Plus size={18} className="text-institucional-green" />
                Nuevo Usuario
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifique los datos del usuario."
              : "Complete los datos para crear un nuevo usuario. La contraseña por defecto será 123456789*."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="user-nombres">Nombres</Label>
              <Input
                id="user-nombres"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan Carlos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-apellidos">Apellidos</Label>
              <Input
                id="user-apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Pérez López"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="user-cedula">Cédula</Label>
              <Input
                id="user-cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="1801234567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-rol">Rol</Label>
              <select
                id="user-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
              >
                <option value="DIRECTOR">Director</option>
                <option value="JEFE_OPERATIVO">Jefe Operativo</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </div>
          </div>

          {/* Selector múltiple de naves (solo para supervisor) */}
          {rol === "SUPERVISOR" && (
            <div className="space-y-2">
              <Label>Naves Asignadas</Label>
              <div className="flex flex-wrap gap-2">
                {naves.map((n) => {
                  const isSelected = navesAsignadas.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNave(n.id)}
                      className={[
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ring-1",
                        isSelected
                          ? "bg-institucional-green text-base-white ring-institucional-green"
                          : "bg-base-white text-base-eerieBlack ring-institucional-whiteSmokeBlack/30 hover:ring-institucional-green/50",
                      ].join(" ")}
                    >
                      {n.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-base-red font-medium">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
          >
            {isEdit ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página de Configuración ──────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, logout, changePassword } = useAuth();
  const supervisores = getSupervisores();
  const allUsuarios = getUsuarios();
  const naves = getNaves();

  const isSupervisor = user?.rol === "SUPERVISOR";
  const isAdmin = user?.rol === "TIC" || user?.rol === "SUPERADMIN";

  // ── Estado de navegación interna ──
  const [activeView, setActiveView] = useState<ActiveView>("main");

  // Estado de configuración por supervisor (en memoria)
  const [configs, setConfigs] = useState<Record<string, SupervisorConfig>>(() => {
    const initial: Record<string, SupervisorConfig> = {};
    for (const sup of supervisores) {
      initial[sup.id] = { persistencia: false, vistaDefault: "lista" };
    }
    return initial;
  });

  // Dialogs
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    nombres: string;
    apellidos: string;
    cedula: string;
    rol: Rol;
    navesAsignadas?: string[];
  } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  function handleDeleteUser() {
    if (!deleteUserId) return;
    const u = allUsuarios.find((u) => u.id === deleteUserId);
    eliminarUsuario(deleteUserId);
    toast.success("Usuario eliminado", {
      description: `${u?.nombres ?? ""} ${u?.apellidos ?? ""} eliminado correctamente.`,
    });
    setDeleteUserId(null);
    setRefreshKey((k) => k + 1);
  }

  // Usuarios gestionables (no admin, no TIC actual)
  const usuariosGestionables = allUsuarios.filter(
    (u) => u.rol !== "SUPERADMIN" && u.rol !== "TIC"
  );

  // ── Botón "Volver" reutilizable ───────────────────────────────────────────
  const backButton = (
    <button
      type="button"
      onClick={() => setActiveView("main")}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10"
    >
      <ArrowLeft size={16} strokeWidth={2} />
      Volver
    </button>
  );

  // ── Vista: Permisos y Roles ───────────────────────────────────────────────
  if (activeView === "permisos") {
    return (
      <div className="min-h-screen bg-institucional-whiteSmoke">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
          {backButton}

          <header>
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Permisos y Roles
            </h1>
            <p className="mt-1 text-sm text-institucional-whiteSmokeBlack">
              {isSupervisor
                ? "Ajustes de persistencia y vista por defecto para tu cuenta."
                : "Configuración de supervisores del sistema."}
            </p>
          </header>

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
                <p className="text-xs text-institucional-whiteSmokeBlack mt-0.5">
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
                      <ToggleLeft size={20} className="text-institucional-whiteSmokeBlack" />
                    )}
                    <span
                      className={`font-medium ${
                        configs[user.id]?.persistencia
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
                  <p className="text-[10px] text-acento-verdeOliva1">
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
                    <li key={sup.id} className="px-5 py-4 space-y-3">
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
                            {sup.navesAsignadas && sup.navesAsignadas.length > 0 && (
                              <span className="ml-2 text-acento-azul1">
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

  // ── Vista: Gestión de Usuarios ────────────────────────────────────────────
  if (activeView === "usuarios") {
    return (
      <div className="min-h-screen bg-institucional-whiteSmoke">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
          {backButton}

          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
                Gestión de Usuarios
              </h1>
              <p className="mt-1 text-sm text-institucional-whiteSmokeBlack">
                Crea, edita y elimina usuarios del sistema.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingUser(null);
                setUserFormOpen(true);
              }}
              className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 self-start sm:self-auto"
            >
              <Plus size={14} className="mr-2" />
              Nuevo Usuario
            </Button>
          </header>

          <div className="rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-institucional-green/10">
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Nombre
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Cédula
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Rol
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">
                      Naves
                    </th>
                    <th className="px-4 py-2.5 text-center font-semibold text-base-eerieBlack">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosGestionables.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-semibold text-base-eerieBlack">
                        {u.nombres} {u.apellidos}
                      </td>
                      <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack font-mono">
                        {u.cedula}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-institucional-green/10 text-institucional-green">
                          {u.rol.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-institucional-whiteSmokeBlack text-[10px]">
                        {u.navesAsignadas && u.navesAsignadas.length > 0
                          ? u.navesAsignadas
                              .map((id) => naves.find((n) => n.id === id)?.nombre ?? id)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser({
                                id: u.id,
                                nombres: u.nombres,
                                apellidos: u.apellidos,
                                cedula: u.cedula,
                                rol: u.rol,
                                navesAsignadas: u.navesAsignadas,
                              });
                              setUserFormOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteUserId(u.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-base-red hover:bg-base-red/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Modales (usuarios) ── */}
        <UserFormDialog
          key={editingUser?.id ?? "new-user"}
          open={userFormOpen}
          user={editingUser}
          onClose={() => {
            setUserFormOpen(false);
            setEditingUser(null);
          }}
          onSave={() => setRefreshKey((k) => k + 1)}
        />

        <Dialog open={!!deleteUserId} onOpenChange={(o) => !o && setDeleteUserId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-red">
                <Trash2 size={18} />
                Eliminar Usuario
              </DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserId(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteUser}
                className="bg-base-red text-base-white hover:bg-base-red/90"
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Vista Principal (main) ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Encabezado ── */}
        <header>
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Configuración del Sistema
          </h1>
          <p className="mt-1 text-sm text-institucional-whiteSmokeBlack">
            Administra tu cuenta y las preferencias de la aplicación.
          </p>
        </header>

        {/* ── Opciones de configuración ── */}
        <section aria-label="Opciones de configuración">
          <ul className="flex flex-col gap-3" role="list">
            {/* 1. Editar Perfil */}
            <li>
              <button
                type="button"
                id="editar-perfil"
                onClick={() => setPasswordDialogOpen(true)}
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-acento-azul1/10">
                  <UserCog size={20} strokeWidth={1.75} className="text-acento-azul1" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Editar Perfil</p>
                  <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Cambia tu contraseña de acceso.</p>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-institucional-whiteSmokeBlack transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>

            {/* 2. Permisos y Roles */}
            <li>
              <button
                type="button"
                id="permisos"
                onClick={() => setActiveView("permisos")}
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-acento-morado/10">
                  <Shield size={20} strokeWidth={1.75} className="text-acento-morado" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Permisos y Roles</p>
                  <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">
                    Tu rol actual: {user?.rol?.replace("_", " ") ?? "—"}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-institucional-whiteSmokeBlack transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>

            {/* 3. Gestión de Usuarios (solo TIC / SUPERADMIN) */}
            {isAdmin && (
              <li>
                <button
                  type="button"
                  id="gestion-usuarios"
                  onClick={() => setActiveView("usuarios")}
                  className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-institucional-green/10">
                    <Users size={20} strokeWidth={1.75} className="text-institucional-green" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Gestión de Usuarios</p>
                    <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Crea, edita y elimina usuarios del sistema.</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-institucional-whiteSmokeBlack transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            )}

            {/* 4. Cerrar Sesión */}
            <li>
              <button
                type="button"
                id="cerrar-sesion"
                onClick={handleLogout}
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-base-red/40 hover:bg-base-red/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-base-red/10">
                  <LogOut size={20} strokeWidth={1.75} className="text-base-red" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm leading-tight text-base-red">Cerrar Sesión</p>
                  <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Finaliza tu sesión actual de forma segura.</p>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-base-red/50 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </div>

      {/* ── Modal de cambio de contraseña ── */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onChangePassword={changePassword}
      />
    </div>
  );
}

