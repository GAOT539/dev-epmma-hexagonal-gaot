"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, RefreshCw, ServerCrash, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { esErrorConexion } from "@/lib/error-utils";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [timestamp, setTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  useEffect(() => {
    // Registro del error en consola para depuración técnica
    console.error("Error capturado por el Error Boundary de EPMMA:", error);
  }, [error]);

  const esFalloConexion = esErrorConexion(error);

  const handleReintentar = () => {
    setTimestamp(
      new Date().toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    reset();
  };

  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm text-center">
        {esFalloConexion ? (
          <>
            {/* ── Vista Especializada: Fallo de Conexión con el Servidor ── */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/80 shadow-inner">
              <ServerCrash size={32} className="text-amber-600" aria-hidden="true" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Sin conexión con los servicios centrales
            </h1>

            <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              No es posible establecer comunicación con el servidor del Mercado Mayorista.
              Verifique su conexión de red o espere a que el servicio sea reestablecido.
            </p>

            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs text-gray-600 font-mono">
              {timestamp && <span>Último intento: {timestamp}</span>}
              {timestamp && error.digest && <span className="text-gray-300">•</span>}
              {error.digest && (
                <span>
                  Diagnóstico: <span className="font-semibold text-gray-800">{error.digest}</span>
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
              <Link
                href="/catastro"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Volver al inicio</span>
              </Link>

              <button
                type="button"
                onClick={handleReintentar}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-institucional-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-institucional-green/90 focus:outline-none focus:ring-2 focus:ring-institucional-green/40 transition-colors"
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>Reintentar conexión</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Vista General Institucional: Error Inesperado ── */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-200/80 shadow-inner">
              <ShieldAlert size={32} className="text-red-600" aria-hidden="true" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Ha ocurrido un problema inesperado
            </h1>

            <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              Se ha producido un error imprevisto en la aplicación. Si el problema persiste
              tras reintentar, por favor comuníquese con el departamento TIC de EPMMA para
              asistencia técnica.
            </p>

            {error.digest && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs text-gray-600 font-mono">
                <AlertCircle size={14} className="text-gray-400" aria-hidden="true" />
                <span>Código de seguimiento: <strong className="text-gray-800">{error.digest}</strong></span>
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
              <Link
                href="/catastro"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Volver al inicio</span>
              </Link>

              <button
                type="button"
                onClick={handleReintentar}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-institucional-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-institucional-green/90 focus:outline-none focus:ring-2 focus:ring-institucional-green/40 transition-colors"
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>Intentar nuevamente</span>
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
