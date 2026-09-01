"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const testUser = process.env.NEXT_PUBLIC_TEST_USER;
    const testPassword = process.env.NEXT_PUBLIC_TEST_PASSWORD;

    if (usuario !== testUser || password !== testPassword) {
      toast.error("Credenciales incorrectas", {
        description: "El usuario o la contraseña ingresados no son válidos. Verifique e intente nuevamente.",
      });
      return;
    }

    setIsLoading(true);
    toast.success("Acceso concedido", {
      description: "Bienvenido al Sistema de Gestión EPMMA.",
    });

    // Pequeño delay para que el toast sea visible antes de redirigir
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-institucional-whiteSmoke p-4 sm:p-6 md:p-8">

      <div className="w-full max-w-sm sm:max-w-md bg-base-white rounded-2xl shadow-xl flex flex-col items-center overflow-hidden border border-institucional-whiteSmokeBlack/30">

        {/* Header con color institucional */}
        <div className="w-full bg-institucional-green px-6 pt-8 pb-10 flex flex-col items-center">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 bg-base-white rounded-full p-2 shadow-md">
            <Image
              src="/images/logo.png"
              alt="Logo Institucional EPMMA"
              fill
              sizes="144px"
              className="object-contain rounded-full"
              priority
            />
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold text-base-white text-center leading-tight">
            EPMMA
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
                Usuario
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="h-12 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 text-base text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
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
                  className="h-12 w-full rounded-lg border border-institucional-whiteSmokeBlack bg-institucional-whiteSmoke px-4 pr-12 text-base text-base-eerieBlack placeholder:text-institucional-whiteSmokeBlack outline-none transition focus:border-institucional-green focus:ring-2 focus:ring-institucional-green/20"
                />
                <button
                  id="toggle-password-visibility"
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-institucional-whiteSmokeBlack hover:text-institucional-green transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-institucional-green/50 rounded"
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={1.8} />
                  ) : (
                    <Eye size={20} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            {/* Olvidé mi contraseña */}
            <div className="flex justify-end">
              <a
                href="#"
                className="text-sm text-acento-azul1 hover:text-acento-azul2 hover:underline transition-colors"
              >
                ¿Olvidó su contraseña?
              </a>
            </div>

            {/* Botón Ingresar */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-1 bg-institucional-green hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-base-white text-lg font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-institucional-green/40"
            >
              {isLoading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-institucional-whiteSmokeBlack">
            © {new Date().getFullYear()} EPMMA · Todos los derechos reservados
          </p>
        </div>

      </div>
    </main>
  );
}