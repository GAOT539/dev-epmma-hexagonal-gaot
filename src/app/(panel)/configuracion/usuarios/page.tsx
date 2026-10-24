"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Key,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/application/services/auth.service";
import { usuarioService } from "@/application/services/usuario.service";
import { naveService } from "@/application/services/nave.service";
import type { Rol, Usuario } from "@/domain/models/usuario.model";
import type { Nave } from "@/domain/models/nave.model";
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

// ── Modal CRUD de Usuarios ───────────────────────────────────────────────────

function UserFormDialog({
  open,
  user,
  naves,
  onClose,
  onSave,
}: {
  open: boolean;
  user: {
    id: string;
    nombres: string;
    apellidos: string;
    cedula: string;
    rol: Rol;
    correo?: string;
    navesAsignadas?: string[]
  } | null;
  naves: Nave[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!user;

  const [nombres, setNombres] = useState(user?.nombres ?? "");
  const [apellidos, setApellidos] = useState(user?.apellidos ?? "");
  const [cedula, setCedula] = useState(user?.cedula ?? "");
  const [correo, setCorreo] = useState(user?.correo ?? "");
  const [rol, setRol] = useState<Rol>(user?.rol ?? "SUPERVISOR");
  const [navesAsignadas, setNavesAsignadas] = useState<string[]>(
    user?.navesAsignadas ?? []
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      if (user) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNombres(user.nombres ?? "");
        setApellidos(user.apellidos ?? "");
        setCedula(user.cedula ?? "");
        setCorreo(user.correo ?? "");
        setRol(user.rol ?? "SUPERVISOR");
        setNavesAsignadas(user.navesAsignadas ?? []);
        setError("");
        setGuardando(false);
      } else {
        setNombres("");
        setApellidos("");
        setCedula("");
        setCorreo("");
        setRol("SUPERVISOR");
        setNavesAsignadas([]);
        setError("");
        setGuardando(false);
      }
    }
  }, [open, user]);

  function toggleNave(naveId: string) {
    setNavesAsignadas((prev) =>
      prev.includes(naveId)
        ? prev.filter((id) => id !== naveId)
        : [...prev, naveId]
    );
  }

  async function handleSubmit() {
    setError("");

    if (!nombres.trim() || !apellidos.trim() || !cedula.trim() || !correo.trim()) {
      setError("Nombres, Apellidos, Cédula y Correo Electrónico son campos obligatorios.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo.trim())) {
      setError("Debe ingresar un correo electrónico válido (ej. usuario@ep-ema.gob.ec).");
      return;
    }

    setGuardando(true);
    try {
      if (isEdit && user) {
        await usuarioService.actualizarUsuario(user.id, {
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          cedula: cedula.trim(),
          correo: correo.trim(),
          rol,
          navesAsignadas: rol === "SUPERVISOR" ? navesAsignadas : undefined,
        });
        toast.success("Usuario actualizado", {
          description: `${nombres} ${apellidos} editado correctamente.`,
        });
      } else {
        await usuarioService.crearUsuario({
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          cedula: cedula.trim(),
          correo: correo.trim(),
          rol,
          navesAsignadas: rol === "SUPERVISOR" ? navesAsignadas : undefined,
        });
        toast.success("Usuario creado", {
          description: `${nombres} ${apellidos} creado con contraseña por defecto.`,
        });
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
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
            <Label htmlFor="user-nombres">
              Nombres <span className="text-red-500">*</span>
            </Label>
            <Input
              id="user-nombres"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Juan Carlos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-apellidos">
              Apellidos <span className="text-red-500">*</span>
            </Label>
            <Input
              id="user-apellidos"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="Pérez López"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-cedula">
              Cédula <span className="text-red-500">*</span>
            </Label>
            <Input
              id="user-cedula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="1801234567"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="user-correo">
              Correo Electrónico <span className="text-red-500">*</span>
            </Label>
            <Input
              id="user-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="usuario@ep-ema.gob.ec"
            />
            <p className="text-[11px] text-gray-500">
              A este correo se enviará la contraseña temporal al restablecer credenciales.
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="user-rol">Rol</Label>
            <select
              id="user-rol"
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
            >
              <option value="TIC">TIC</option>
              <option value="DIRECTOR">Director</option>
              <option value="JEFE_OPERATIVO">Jefe Operativo</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>

          {/* Selector múltiple de naves (solo para supervisor) */}
          {rol === "SUPERVISOR" && (
            <div className="space-y-2 md:col-span-2">
              <Label>
                Naves Asignadas{" "}
                <span className="text-gray-500 font-normal text-xs">(Opcional)</span>
              </Label>
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
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={guardando}
            className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
          >
            {guardando ? (
              <>
                <Loader2 size={15} className="mr-2 animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar Cambios"
            ) : (
              "Crear Usuario"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConfiguracionUsuariosPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Protección de ruta: Solo TIC y SUPERADMIN tienen acceso a la gestión de usuarios
  useEffect(() => {
    if (!isLoading && user && user.rol !== "SUPERADMIN" && user.rol !== "TIC") {
      router.replace("/configuracion");
    }
  }, [user, isLoading, router]);

  const [allUsuarios, setAllUsuarios] = useState<Usuario[]>([]);
  const [naves, setNaves] = useState<Nave[]>([]);
  const [cargando, setCargando] = useState(true);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    nombres: string;
    apellidos: string;
    cedula: string;
    rol: Rol;
    correo?: string;
    navesAsignadas?: string[];
  } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<Usuario | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [users, listaNaves] = await Promise.all([
        usuarioService.obtenerUsuarios(),
        naveService.obtenerNaves(),
      ]);
      setAllUsuarios(users);
      setNaves(listaNaves);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    async function init() {
      try {
        const [users, listaNaves] = await Promise.all([
          usuarioService.obtenerUsuarios(),
          naveService.obtenerNaves(),
        ]);
        if (!cancel) {
          setAllUsuarios(users);
          setNaves(listaNaves);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancel) setCargando(false);
      }
    }
    init();
    return () => {
      cancel = true;
    };
  }, []);

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    const u = allUsuarios.find((u) => u.id === deleteUserId);
    await usuarioService.eliminarUsuario(deleteUserId);
    toast.success("Usuario deshabilitado", {
      description: `${u?.nombres ?? ""} ${u?.apellidos ?? ""} ha sido deshabilitado correctamente.`,
    });
    setDeleteUserId(null);
    cargarDatos();
  }

  async function handleResetPassword() {
    if (!resetPasswordUser) return;
    const ok = await usuarioService.restablecerPasswordUsuario(resetPasswordUser.id);
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
    cargarDatos();
  }

  const usuariosGestionables = allUsuarios
    .filter((u) => u.rol !== "SUPERADMIN" && u.rol !== "TIC")
    .filter((u) => u.estado !== "Deshabilitado");

  if (isLoading || (user && user.rol !== "SUPERADMIN" && user.rol !== "TIC")) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] md:h-[100dvh] bg-institucional-whiteSmoke">
      <div className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-6 px-4 sm:px-6 lg:px-10 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2 shrink-0">
          <div className="flex flex-col gap-2">
            <Link
              href="/configuracion"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-institucional-green transition-colors hover:bg-institucional-green/10 w-fit"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Volver
            </Link>
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Gestión de Usuarios
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setEditingUser(null);
                setUserFormOpen(true);
              }}
              className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
            >
              <Plus size={14} className="mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </div>

        <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-institucional-green">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-medium text-gray-600">Cargando usuarios...</span>
              </div>
            ) : (
              <table className="w-full text-base lg:text-lg">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#e6efe9]">
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Nombre
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Cédula
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Correo
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Rol
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-left font-semibold text-base-eerieBlack">
                      Naves
                    </th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] p-3 lg:p-4 text-center font-semibold text-base-eerieBlack">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosGestionables.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        No se encontraron usuarios activos para gestionar.
                      </td>
                    </tr>
                  ) : (
                    usuariosGestionables.map((u) => (
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
                        <td className="p-3 lg:p-4 font-normal text-gray-700 text-xs lg:text-sm font-mono">
                          {u.correo || "—"}
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
                                  correo: u.correo,
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
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Modales (usuarios) ── */}
      <UserFormDialog
        key={editingUser?.id ?? "new-user"}
        open={userFormOpen}
        user={editingUser}
        naves={naves}
        onClose={() => {
          setUserFormOpen(false);
          setEditingUser(null);
        }}
        onSave={cargarDatos}
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
