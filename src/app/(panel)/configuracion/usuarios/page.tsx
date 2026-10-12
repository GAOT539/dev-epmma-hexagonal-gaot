"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Key,
} from "lucide-react";
import {
  getUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  restablecerPasswordUsuario,
} from "@/infrastructure/mocks/auth.mock";
import { getNaves } from "@/infrastructure/mocks/mercado.mock";
import type { Rol, Usuario } from "@/domain/models/comerciante.model";
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

export default function ConfiguracionUsuariosPage() {
  const allUsuarios = getUsuarios();
  const naves = getNaves();

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
  const [, setRefreshKey] = useState(0);

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

  const usuariosGestionables = allUsuarios
    .filter((u) => u.rol !== "SUPERADMIN" && u.rol !== "TIC" && u.rol !== "TICs")
    .filter((u) => u.estado !== "Deshabilitado");

  return (
    <div className="min-h-[100dvh] bg-institucional-whiteSmoke flex flex-col">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
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
            <Link
              href="/configuracion/permisos"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
            >
              Permisos
            </Link>
            <Link
              href="/configuracion/importacion"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-institucional-green hover:bg-institucional-green/10 transition-colors"
            >
              Importación
            </Link>
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
