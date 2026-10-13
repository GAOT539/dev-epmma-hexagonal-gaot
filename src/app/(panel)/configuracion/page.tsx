"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserCog,
  LogOut,
  Shield,
  ChevronRight,
  Lock,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/application/services/auth.service";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

// ── Página Principal de Configuración ────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, logout, changePassword } = useAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const isAdmin = user?.rol === "TIC" || user?.rol === "SUPERADMIN";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[100dvh] bg-institucional-whiteSmoke">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Encabezado ── */}
        <header>
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Configuración del Sistema
          </h1>
          <p className="mt-1 text-sm text-gray-700 font-medium">
            Administra tu cuenta y las preferencias de la aplicación.
          </p>
        </header>

        {/* ── Opciones de configuración con Enrutamiento Nativo ── */}
        <section aria-label="Opciones de configuración">
          <ul className="flex flex-col gap-3" role="list">
            {/* 1. Cambiar Contraseña */}
            <li>
              <button
                type="button"
                id="editar-perfil"
                onClick={() => setPasswordDialogOpen(true)}
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-acento-azul1/10">
                  <UserCog size={20} strokeWidth={1.75} className="text-acento-azul1" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Cambiar Contraseña</p>
                  <p className="mt-0.5 text-xs text-gray-700 font-medium line-clamp-1">Actualiza tus credenciales de acceso.</p>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-gray-700 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>

            {/* 2. Permisos y Roles (Sub-ruta nativa) */}
            <li>
              <Link
                href="/configuracion/permisos"
                id="permisos"
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-acento-morado/10">
                  <Shield size={20} strokeWidth={1.75} className="text-acento-morado" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Permisos y Roles</p>
                  <p className="mt-0.5 text-xs text-gray-700 font-medium line-clamp-1">
                    Tu rol actual: {user?.rol?.replace("_", " ") ?? "—"}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-gray-700 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>

            {/* 3. Gestión de Usuarios (solo TIC / SUPERADMIN, Sub-ruta nativa) */}
            {isAdmin && (
              <li>
                <Link
                  href="/configuracion/usuarios"
                  id="gestion-usuarios"
                  className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-institucional-green/30 hover:bg-institucional-green/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-institucional-green/10">
                    <Users size={20} strokeWidth={1.75} className="text-institucional-green" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm leading-tight text-base-eerieBlack">Gestión de Usuarios</p>
                    <p className="mt-0.5 text-xs text-gray-700 font-medium line-clamp-1">Administración de accesos y roles del sistema.</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-gray-700 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            )}

            {/* 4. Cerrar Sesión */}
            <li>
              <button
                type="button"
                id="cerrar-sesion"
                onClick={handleLogout}
                className="group flex w-full items-center gap-4 rounded-xl bg-base-white px-5 py-4 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all duration-150 hover:ring-base-red/40 hover:bg-base-red/5 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-base-red/10">
                  <LogOut size={20} strokeWidth={1.75} className="text-base-red" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight text-base-red">Cerrar Sesión</p>
                  <p className="mt-0.5 text-xs text-gray-700 font-medium line-clamp-1">Finaliza tu sesión actual de forma segura.</p>
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
