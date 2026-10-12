"use client";

import { useState, useEffect } from "react";
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
  FileText,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  Key,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/infrastructure/auth/auth-context";
import {
  getSupervisores,
  getUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  restablecerPasswordUsuario,
} from "@/infrastructure/mocks/auth.mock";
import { getNaves } from "@/infrastructure/mocks/mercado.mock";
import {
  simularImportacion,
  parsearXML,
  parsearCSV,
} from "@/infrastructure/mocks/importador.mock";
import type { Rol, Usuario, ImportacionRegistro, ImportacionResultado } from "@/domain/models/comerciante.model";
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

type ActiveView = "main" | "permisos" | "usuarios" | "carga-masiva";

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
    <Dialog open={open} disablePointerDismissal={true} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock size={18} className="text-acento-azul1" />
            Cambiar Contraseña
          </DialogTitle>
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
    <Dialog open={open} disablePointerDismissal={true} onOpenChange={(o) => !o && onClose()}>
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
              : "Complete los datos para crear un nuevo usuario. La contraseña por defecto será cedula*."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
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
              <option value="TICs">TICs</option>
              <option value="DIRECTOR">Director</option>
              <option value="JEFE_OPERATIVO">Jefe Operativo</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>

          {/* Selector múltiple de naves (solo para supervisor) */}
          {rol === "SUPERVISOR" && (
            <div className="space-y-2 md:col-span-2">
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
            <p className="text-xs text-base-red font-medium md:col-span-2">{error}</p>
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
  const isAdmin = user?.rol === "TIC" || user?.rol === "TICs" || user?.rol === "SUPERADMIN";

  // ── Estado de navegación interna ──
  const [activeView, setActiveView] = useState<ActiveView>("main");

  // Estado de configuración por supervisor con persistencia en localStorage
  const [configs, setConfigs] = useState<Record<string, SupervisorConfig>>(() => {
    const initial: Record<string, SupervisorConfig> = {};
    for (const sup of supervisores) {
      initial[sup.id] = { persistencia: false, vistaDefault: "lista" };
    }
    return initial;
  });

  // Cargar configuraciones de supervisor desde localStorage al montar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("epmma_supervisor_configs");
      if (guardado) {
        const parsed = JSON.parse(guardado);
        setConfigs((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Error al leer configuraciones de localStorage", e);
    }
  }, []);

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
  const [resetPasswordUser, setResetPasswordUser] = useState<Usuario | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Estado Carga Masiva ──
  const [registros, setRegistros] = useState<ImportacionRegistro[]>([]);
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Funciones de carga masiva
  function handleFileInput(contenido: string, nombre: string) {
    setArchivoNombre(nombre);
    let parsed: ImportacionRegistro[];
    if (nombre.endsWith(".xml")) {
      parsed = parsearXML(contenido);
    } else if (nombre.endsWith(".csv")) {
      parsed = parsearCSV(contenido);
    } else {
      toast.error("Formato no soportado");
      return;
    }
    if (parsed.length === 0) {
      toast.error("Archivo vacío");
      return;
    }
    setRegistros(parsed);
    setPaso("preview");
    toast.success(`${parsed.length} registros cargados`);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleFileInput(ev.target?.result as string, file.name);
    reader.readAsText(file);
  }

  function handleProcesar() {
    const res = simularImportacion(registros);
    setResultado(res);
    setPaso("resultado");
    if (res.errores.length === 0) toast.success("Importación completada");
    else toast.warning("Importación con errores");
  }

  function handleReiniciar() {
    setRegistros([]);
    setResultado(null);
    setArchivoNombre("");
    setPaso("cargar");
  }

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
    toast.success("Usuario deshabilitado", {
      description: `${u?.nombres ?? ""} ${u?.apellidos ?? ""} ha sido deshabilitado correctamente.`,
    });
    setDeleteUserId(null);
    setRefreshKey((k) => k + 1);
  }

  function handleResetPassword() {
    if (!resetPasswordUser) return;
    const ok = restablecerPasswordUsuario(resetPasswordUser.id);
    if (ok) {
      toast.success("Contraseña restablecida", {
        description: `La contraseña de ${resetPasswordUser.nombres} ${resetPasswordUser.apellidos} ha sido restablecida exitosamente.`,
      });
    } else {
      toast.error("Error al restablecer contraseña", {
        description: "No se pudo restablecer la contraseña del usuario.",
      });
    }
    setResetPasswordUser(null);
    setRefreshKey((k) => k + 1);
  }

  // Usuarios gestionables (no admin, no TIC actual) y no deshabilitados (Soft Delete)
  const usuariosGestionables = allUsuarios
    .filter((u) => u.rol !== "SUPERADMIN" && u.rol !== "TIC" && u.rol !== "TICs")
    .filter((u) => u.estado !== "Deshabilitado");

  // ── Vista: Permisos y Roles ───────────────────────────────────────────────
  if (activeView === "permisos") {
    return (
      <div className="w-full h-full flex flex-col min-h-screen bg-institucional-whiteSmoke">
        <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveView("main")}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Volver
            </button>
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Permisos y Roles
            </h1>
            {isSupervisor && (
              <p className="text-sm text-institucional-whiteSmokeBlack">
                Ajustes de persistencia y vista por defecto para tu cuenta.
              </p>
            )}
          </div>

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
      <div className="min-h-screen bg-institucional-whiteSmoke flex flex-col">
        <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveView("main")}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
              >
                <ArrowLeft size={16} strokeWidth={2} />
                Volver
              </button>
              <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
                Gestión de Usuarios
              </h1>
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
          </div>

          <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-base lg:text-lg">
                <thead>
                  <tr className="bg-institucional-green/10">
                    <th className="p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Nombre
                    </th>
                    <th className="p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Cédula
                    </th>
                    <th className="p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Rol
                    </th>
                    <th className="p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Naves
                    </th>
                    <th className="p-3 lg:p-4 text-center font-semibold text-base-eerieBlack">
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
                      <td className="p-3 lg:p-4 font-normal text-gray-900">
                        {u.nombres} {u.apellidos}
                      </td>
                      <td className="p-3 lg:p-4 font-normal text-gray-900 font-mono">
                        {u.cedula}
                      </td>
                      <td className="p-3 lg:p-4">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-institucional-green/10 text-institucional-green">
                          {u.rol.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 lg:p-4 font-normal text-gray-900 text-xs lg:text-sm">
                        {u.navesAsignadas && u.navesAsignadas.length > 0
                          ? u.navesAsignadas
                              .map((id) => naves.find((n) => n.id === id)?.nombre ?? id)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="p-3 lg:p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setResetPasswordUser(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-acento-naranjaSalmon1 hover:bg-acento-naranjaSalmon1/10 transition-colors"
                            title="Restablecer contraseña"
                          >
                            <Key size={15} />
                          </button>
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
                            className="flex h-8 w-8 items-center justify-center rounded-md text-acento-azul1 hover:bg-acento-azul1/10 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteUserId(u.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-base-red hover:bg-base-red/10 transition-colors"
                            title="Deshabilitar"
                          >
                            <Trash2 size={15} />
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

        <Dialog open={!!deleteUserId} disablePointerDismissal={true} onOpenChange={(o) => !o && setDeleteUserId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-red">
                <Trash2 size={18} />
                Deshabilitar Usuario
              </DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea deshabilitar este usuario del sistema?
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
                Deshabilitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!resetPasswordUser}
          disablePointerDismissal={true}
          onOpenChange={(o) => !o && setResetPasswordUser(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-eerieBlack">
                <Key size={18} className="text-acento-naranjaSalmon1" />
                Restablecer Contraseña
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-700 pt-2 leading-relaxed">
                ¿Está seguro de restablecer la contraseña para{" "}
                <span className="font-semibold text-base-eerieBlack">
                  {resetPasswordUser?.nombres} {resetPasswordUser?.apellidos}
                </span>
                ? La nueva contraseña será su número de cédula seguido de un asterisco (*).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end pt-3">
              <Button variant="outline" onClick={() => setResetPasswordUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleResetPassword}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Restablecer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Vista: Carga Masiva (fluye naturalmente dentro del panel) ─────────────
  if (activeView === "carga-masiva") {
    return (
      <div className="w-full h-full flex flex-col min-h-screen bg-institucional-whiteSmoke">
        <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-2 mb-2">
            <button
              type="button"
              onClick={() => setActiveView("main")}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Volver
            </button>
            <h1 className="text-2xl font-bold text-institucional-green sm:text-3xl">
              Ingreso Masivo de Catastro
            </h1>
          </div>

          {/* Formatos de Ejemplo visuales CSV y XML */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileSpreadsheet size={16} className="text-institucional-green" />
                Estructura CSV requerida (.csv)
              </div>
              <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`CIU,CEDULA,CONTRIBUYENTE,ACTIVIDAD,NAVE,PUESTO
CIU-00001,1801234567,Juan Pérez López,Frutas y Verduras,NAVE A,P-A001
CIU-00002,1802345678,María Gómez Mora,Cárnicos y Embutidos,NAVE B,P-B015`}
              </pre>
            </div>

            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileText size={16} className="text-acento-azul1" />
                Estructura XML requerida (.xml)
              </div>
              <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto text-gray-800 leading-relaxed">
{`<comerciantes>
  <comerciante>
    <ciu>CIU-00001</ciu>
    <cedula>1801234567</cedula>
    <contribuyente>Juan Pérez López</contribuyente>
    <actividad>Frutas y Verduras</actividad>
    <nave>NAVE A</nave>
    <puesto>P-A001</puesto>
  </comerciante>
</comerciantes>`}
              </pre>
            </div>
          </div>

          {/* ── Paso 1: Carga ── */}
          {paso === "cargar" && (
            <div
              className={[
                "flex-1 min-h-[260px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all",
                isDragOver ? "border-institucional-green bg-institucional-green/5" : "border-institucional-whiteSmokeBlack/30 bg-base-white",
              ].join(" ")}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={40} className="text-institucional-whiteSmokeBlack/40" />
              <p className="mt-3 text-sm font-medium text-base-eerieBlack">Arrastre un archivo XML o CSV aquí</p>
              <label className="mt-4 cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                  <FileSpreadsheet size={14} /> Seleccionar archivo
                </span>
                <input
                  type="file" accept=".xml,.csv" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => handleFileInput(ev.target?.result as string, file.name);
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          )}

          {/* ── Paso 2: Preview ── */}
          {paso === "preview" && (
            <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-base text-base-eerieBlack">Vista Previa</h2>
                  <p className="text-xs text-institucional-whiteSmokeBlack">{registros.length} registros listos para importar</p>
                </div>
                <button onClick={handleReiniciar} className="text-base-red text-xs hover:underline flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-institucional-green/10 sticky top-0 z-10">
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Nave</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Contribuyente</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-base-eerieBlack">Puesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r, i) => (
                      <tr key={i} className="border-t border-institucional-whiteSmokeBlack/10 hover:bg-institucional-whiteSmoke/50 transition-colors">
                        <td className="px-4 py-2.5 font-normal text-gray-900">{r.nave}</td>
                        <td className="px-4 py-2.5 font-normal text-gray-900">{r.contribuyente}</td>
                        <td className="px-4 py-2.5 font-normal text-gray-900 font-mono">{r.numBodega}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 flex justify-end gap-3 border-t border-institucional-whiteSmokeBlack/15 bg-base-white">
                <Button variant="outline" onClick={handleReiniciar}>Cancelar</Button>
                <Button
                  onClick={() => setConfirmModalOpen(true)}
                  className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
                >
                  Subir Archivo
                </Button>
              </div>
            </div>
          )}

          {/* ── Paso 3: Resultado ── */}
          {paso === "resultado" && resultado && (
            <div className="flex-1 flex flex-col justify-between gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-base-white p-5 ring-1 ring-acento-verdeOliva1/20 shadow-sm">
                  <p className="text-2xl font-bold text-acento-verdeOliva1">{resultado.exitosos}</p>
                  <p className="text-xs text-institucional-whiteSmokeBlack">Exitosos</p>
                </div>
                <div className="rounded-xl bg-base-white p-5 ring-1 ring-base-red/20 shadow-sm">
                  <p className="text-2xl font-bold text-base-red">{resultado.errores.length}</p>
                  <p className="text-xs text-institucional-whiteSmokeBlack">Errores</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleReiniciar} className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold">
                  Nueva Importación
                </Button>
              </div>
            </div>
          )}

          {/* Modal de Confirmación de Carga */}
          <Dialog open={confirmModalOpen} disablePointerDismissal={true} onOpenChange={(o) => !o && setConfirmModalOpen(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base-eerieBlack font-bold">
                  <AlertCircle className="text-acento-amarillo1" size={20} />
                  Confirmar Carga de Datos
                </DialogTitle>
                <DialogDescription className="text-xs text-institucional-whiteSmokeBlack pt-1">
                  ¿Está seguro? Subir este archivo podría modificar y sobrescribir los datos internos del sistema.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end pt-3">
                <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setConfirmModalOpen(false);
                    handleProcesar();
                  }}
                  className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
                >
                  Aceptar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // ── Vista Principal (main) ────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col min-h-screen bg-institucional-whiteSmoke">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
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
                  <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Cambiar Contraseña</p>
                  <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Actualiza tus credenciales de acceso.</p>
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
                    <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Administración de accesos y roles del sistema.</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-institucional-whiteSmokeBlack transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            )}

            {/* 3.5. Ingreso Masivo (solo TIC / SUPERADMIN) */}
            {isAdmin && (
              <li>
                <button
                  type="button"
                  id="ingreso-masivo"
                  onClick={() => setActiveView("carga-masiva")}
                  className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-institucional-green/10">
                    <Upload size={20} strokeWidth={1.75} className="text-institucional-green" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Ingreso Masivo de Catastro</p>
                    <p className="mt-0.5 text-xs text-institucional-whiteSmokeBlack line-clamp-1">Importa comerciantes desde XML o CSV.</p>
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
