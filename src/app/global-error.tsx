"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { logClientError } from "@/lib/client-logger";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logClientError("GLOBAL-ERROR", "Error crítico a nivel raíz capturado por global-error", error);
  }, [error]);

  return (
    <html lang="es" className="h-full">
      <body className="min-h-full m-0 p-0 font-sans bg-slate-100 text-slate-800 flex items-center justify-center">
        <main className="w-full max-w-lg mx-4 my-8 p-6 sm:p-10 bg-white rounded-2xl border border-slate-200 shadow-md text-center">
          {/* Ícono de Alerta Crítica */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 border border-red-200">
            <AlertOctagon size={36} className="text-red-600" aria-hidden="true" />
          </div>

          {/* Título Institucional */}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Error crítico del sistema
          </h1>

          <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            Se ha producido una interrupción a nivel del núcleo de la aplicación.
            Por favor, intente recargar el sistema o contacte al departamento TIC de EP-EMA si el inconveniente continúa.
          </p>

          {/* Código de Diagnóstico */}
          {error.digest && (
            <div className="mt-4 inline-block rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-gray-600 font-mono">
              Referencia técnica: <strong>{error.digest}</strong>
            </div>
          )}

          {/* Botón de Recarga / Reinicio */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#337533] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#285e28] focus:outline-none focus:ring-2 focus:ring-[#337533]/40 transition-colors"
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span>Recargar aplicación</span>
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
