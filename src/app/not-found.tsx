import Link from "next/link";
import Image from "next/image";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center bg-gray-50">
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        {/* Logo Institucional */}
        <div className="relative w-32 h-20 mb-6">
          <Image
            src="/images/logo.png"
            alt="Logo EP-EMA"
            fill
            sizes="128px"
            className="object-contain"
            priority
          />
        </div>

        {/* Código de Estado y Título */}
        <p className="text-6xl font-bold text-gray-800 tracking-tight">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">
          Página no encontrada
        </h1>

        {/* Descripción Accesible */}
        <p className="text-sm text-gray-600 max-w-md mt-2 leading-relaxed">
          La página a la que intenta acceder no existe, fue reubicada o el enlace ingresado es incorrecto.
        </p>

        {/* Botón de Retorno Seguro */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <Link
            href="/catastro"
            className="w-full sm:w-auto bg-institucional-green text-white hover:opacity-90 px-6 py-2.5 rounded-lg text-sm font-medium transition shadow-sm inline-flex items-center justify-center gap-2"
          >
            <Home size={16} aria-hidden="true" />
            <span>Ir al panel principal</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
