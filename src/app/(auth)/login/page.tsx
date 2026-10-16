"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, Check, X, Key, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useAuth,
  validatePassword,
  MENU_POR_ROL,
  solicitarRestablecimientoPassword,
} from "@/application/services/auth.service";
import type { Usuario } from "@/domain/models/comerciante.model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Requisito de contraseña (extraído fuera para evitar re-montajes y cumplir ESLint) ──

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {met ? (
        <Check size={14} className="text-acento-verdeOliva1" />
      ) : (
        <X size={14} className="text-base-red" />
      )}
      <span className={met ? "text-acento-verdeOliva1" : "text-gray-700 font-medium"}>
        {label}
      </span>
    </li>
  );
}

// ── Modal de cambio de contraseña obligatorio (Dialog ineludible con disablePointerDismissal) ──

function PasswordChangeModal({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const { changePassword } = useAuth();
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasUpper = /[A-Z]/.test(newPass);
  const hasNumber = /[0-9]/.test(newPass);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPass);
  const hasLength = newPass.length >= 8;
  const passwordsMatch = newPass === confirmPass && newPass.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const validation = validatePassword(newPass);
    if (!validation.valid) {
      setError(validation.error ?? "Contraseña inválida.");
      return;
    }

    setIsSubmitting(true);
    // For forced password change, use the current password hash as verification
    const result = changePassword(newPass, newPass);
    if (result.success) {
      toast.success("Contraseña actualizada", {
        description: "Su contraseña ha sido cambiada exitosamente.",
      });
      onSuccess();
    } else {
      setError(result.error ?? "Error al cambiar contraseña.");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={true} disablePointerDismissal={true}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0 overflow-hidden rounded-2xl bg-base-white border-0 shadow-2xl">
        {/* Header */}
        <div className="bg-acento-naranjaSalmon1 px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-white/20">
            <Lock size={20} className="text-base-white" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-base-white">
              Cambio de Contraseña Obligatorio
            </DialogTitle>
            <DialogDescription className="text-sm text-base-white/80 mt-0.5">
              Es su primer ingreso. Debe establecer una nueva contraseña.
            </DialogDescription>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nueva contraseña */}
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-base-eerieBlack">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Ingrese nueva contraseña"
                className="h-11 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 pr-11 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-institucional-green transition-colors"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Requisitos */}
          <ul className="space-y-1 bg-institucional-whiteSmoke rounded-lg p-3">
            <Requirement met={hasLength} label="Mínimo 8 caracteres" />
            <Requirement met={hasUpper} label="Al menos una letra mayúscula" />
            <Requirement met={hasNumber} label="Al menos un número" />
            <Requirement met={hasSpecial} label="Al menos un carácter especial (!@#$...)" />
          </ul>

          {/* Confirmar contraseña */}
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium text-base-eerieBlack">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Repita la nueva contraseña"
                className="h-11 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 pr-11 text-sm text-base-eerieBlack placeholder:text-gray-700 outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-institucional-green transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPass && !passwordsMatch && (
              <p className="text-xs text-base-red mt-1">Las contraseñas no coinciden.</p>
            )}
          </div>

          {/* Error global */}
          {error && (
            <div className="rounded-lg bg-base-red/10 border border-base-red/20 px-4 py-2.5 text-xs text-base-red font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !hasLength || !hasUpper || !hasNumber || !hasSpecial || !passwordsMatch}
            className="w-full h-11 bg-institucional-green hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base-white text-sm font-semibold rounded-lg shadow-md"
          >
            {isSubmitting ? "Actualizando..." : "Cambiar Contraseña"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de Restablecer Contraseña (Preparado para Resend) ─────────────────

function RestablecerPasswordModal({
  open,
  initialIdentificador,
  onClose,
}: {
  open: boolean;
  initialIdentificador: string;
  onClose: () => void;
}) {
  const [identificador, setIdentificador] = useState(initialIdentificador);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enviado, setEnviado] = useState<{ correo: string } | null>(null);
  const [error, setError] = useState("");

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!identificador.trim()) {
      setError("Por favor ingrese su usuario, cédula o correo electrónico.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const res = await solicitarRestablecimientoPassword(identificador.trim());
      if (res.success && res.correoEnviado) {
        setEnviado({ correo: res.correoEnviado });
        toast.success("Correo enviado exitosamente", {
          description: `Se han enviado las instrucciones y su contraseña temporal a ${res.correoEnviado}.`,
        });
      } else {
        setError(res.error || "No se encontró un usuario con los datos ingresados.");
      }
    } catch {
      setError("Ocurrió un error al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} disablePointerDismissal={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl bg-base-white border-0 shadow-2xl">
        <div className="bg-institucional-green px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-white/20 text-base-white">
              <Key size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-base-white">
                Restablecer Contraseña
              </DialogTitle>
              <DialogDescription className="text-xs text-base-white/80 mt-0.5">
                Recuperación de credenciales por correo registrado
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-base-white/80 hover:text-base-white hover:bg-base-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {enviado ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Check size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-base-eerieBlack">
                ¡Correo enviado exitosamente!
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                Se ha generado una contraseña temporal de acceso y fue enviada a:{" "}
                <strong className="text-institucional-green font-semibold">{enviado.correo}</strong>.
              </p>
              <p className="text-[11px] text-gray-500 pt-2">
                Revise su bandeja de entrada (y la carpeta de spam). Al ingresar con su contraseña temporal se le solicitará definir una nueva contraseña de su preferencia.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="w-full bg-institucional-green text-base-white hover:bg-acento-verdeOliva1"
              >
                Volver al Inicio de Sesión
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="reset-identificador" className="text-xs font-semibold text-gray-700">
                Usuario, Cédula o Correo Electrónico
              </label>
              <Input
                id="reset-identificador"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ej. admin, 1801234567 o usuario@ep-ema.gob.ec"
                className="text-xs"
                autoFocus
              />
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 leading-relaxed">
              ¿Está de acuerdo con restablecer su contraseña? Se generará una contraseña temporal y será enviada a su correo electrónico registrado.
            </div>

            {error && (
              <p className="text-xs text-base-red font-medium">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !identificador.trim()}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Sí, enviar contraseña temporal"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página de Login ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<Usuario | null>(null);

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const result = login(usuario, password);

    if (!result.success) {
      toast.error("Credenciales incorrectas", {
        description: result.error,
      });
      return;
    }

    if (result.user) {
      setUsuarioAutenticado(result.user);
    }

    setIsLoading(true);

    // Verificar si necesita cambiar contraseña
    if (result.user?.mustChangePassword) {
      setIsLoading(false);
      setShowPasswordChange(true);
      return;
    }

    toast.success("Acceso concedido", {
      description: "Bienvenido al Sistema de Gestión EP-EMA.",
    });

    const rutaDestino = (result.user && MENU_POR_ROL[result.user.rol]?.[0]) || "/listas";

    setTimeout(() => {
      router.push(rutaDestino);
    }, 600);
  }

  function handlePasswordChanged() {
    setShowPasswordChange(false);
    toast.success("Acceso concedido", {
      description: "Bienvenido al Sistema de Gestión EP-EMA.",
    });
    const uActivo = usuarioAutenticado || user;
    const rutaDestino = (uActivo && MENU_POR_ROL[uActivo.rol]?.[0]) || "/listas";
    setTimeout(() => {
      router.push(rutaDestino);
    }, 600);
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-institucional-whiteSmoke p-4 sm:p-6 md:p-8">

      <div className="w-full max-w-sm sm:max-w-md bg-base-white rounded-2xl shadow-xl flex flex-col items-center overflow-hidden border border-institucional-whiteSmokeBlack/30">

        {/* Header con color institucional */}
        <div className="w-full bg-institucional-green px-6 pt-8 pb-10 flex flex-col items-center">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 bg-base-white rounded-full p-2 shadow-md">
            <Image
              src="/images/logo.png"
              alt="Logo Institucional EP-EMA"
              fill
              sizes="144px"
              className="object-contain rounded-full"
              priority
            />
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold text-base-white text-center leading-tight">
            EP-EMA
          </h1>
          <p className="text-base-white/80 text-sm sm:text-base text-center mt-1">
            Sistema de Gestión Institucional
          </p>
        </div>

        {/* Formulario */}
        <div className="w-full px-6 sm:px-8 pt-8 pb-8">
          <h2 className="text-base-eerieBlack text-xl sm:text-2xl font-semibold mb-6 text-center">
            Acceso al Sistema
          </h2>

          <form className="w-full space-y-5" noValidate onSubmit={handleLogin}>

            {/* Campo Usuario */}
            <div className="flex flex-col space-y-2">
              <label
                htmlFor="login-username"
                className="text-base font-medium text-base-eerieBlack"
              >
                Usuario / Cédula
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Ingrese su cédula o usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="h-12 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 text-base text-base-eerieBlack placeholder:text-gray-700 outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
              />
            </div>

            {/* Campo Contraseña con toggle de visibilidad */}
            <div className="flex flex-col space-y-2">
              <label
                htmlFor="login-password"
                className="text-base font-medium text-base-eerieBlack"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 pr-12 text-base text-base-eerieBlack placeholder:text-gray-700 outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
                />
                <button
                  id="toggle-password-visibility"
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-institucional-green transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-institucional-green/50 rounded"
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={1.8} />
                  ) : (
                    <Eye size={20} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            {/* Botón Ingresar */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-1 bg-institucional-green hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-base-white text-lg font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-institucional-green/40 cursor-pointer"
            >
              {isLoading ? "Ingresando..." : "Ingresar"}
            </button>

            {/* Enlace ¿Olvidó su contraseña? */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="text-xs font-semibold text-institucional-green hover:underline cursor-pointer transition-colors"
              >
                ¿Olvidó su contraseña? Restablecer contraseña
              </button>
            </div>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-700 font-medium">
            © {new Date().getFullYear()} EP-EMA · Todos los derechos reservados
          </p>
        </div>

      </div>

      {/* Modal de cambio de contraseña obligatorio */}
      {showPasswordChange && (
        <PasswordChangeModal onSuccess={handlePasswordChanged} />
      )}

      {/* Modal de restablecimiento de contraseña */}
      {resetModalOpen && (
        <RestablecerPasswordModal
          open={resetModalOpen}
          initialIdentificador={usuario}
          onClose={() => setResetModalOpen(false)}
        />
      )}
    </main>
  );
}