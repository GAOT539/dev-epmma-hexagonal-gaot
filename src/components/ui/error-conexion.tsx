"use client";

import React from "react";
import { WifiOff, RefreshCw, ArrowLeft, ServerCrash } from "lucide-react";
import Link from "next/link";

export interface ErrorConexionProps {
  onRetry?: () => void;
  digest?: string;
  timestamp?: Date | string;
  onVolver?: () => void;
  rutaVolver?: string;
  tamano?: "sm" | "md" | "lg";
  className?: string;
}

export function ErrorConexion({
  onRetry,
  digest,
  timestamp,
  onVolver,
  rutaVolver = "/catastro",
  tamano = "md",
  className = "",
}: ErrorConexionProps) {
  const formatoHora = (ts?: Date | string) => {
    if (!ts) return null;
    try {
      const d = typeof ts === "string" ? new Date(ts) : ts;
      return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return null;
    }
  };

  const horaStr = formatoHora(timestamp || new Date());

  if (tamano === "sm") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`w-full rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left transition-all ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-lg bg-amber-100 p-1.5 text-amber-700">
              <WifiOff size={18} aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                Sin conexión con los servicios centrales
              </h4>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                No es posible establecer comunicación con el servidor del Mercado Mayorista. Verifique su conexión de red o espere a que el servicio sea reestablecido.
              </p>
              {(digest || horaStr) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-mono">
                  {horaStr && <span>Intento: {horaStr}</span>}
                  {digest && (
                    <span className="rounded bg-gray-200/80 px-1.5 py-0.5">ID: {digest}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center shrink-0 rounded-lg bg-institucional-green px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-institucional-green/90 focus:outline-none focus:ring-2 focus:ring-institucional-green/40 transition-colors"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Reintentar conexión</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const isLg = tamano === "lg";

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`w-full max-w-xl mx-auto rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm text-center transition-all ${
        isLg ? "py-10 sm:py-12" : ""
      } ${className}`}
    >
      {/* Ícono de Servidor Desconectado */}
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/80 shadow-inner">
        <ServerCrash size={32} className="text-amber-600" aria-hidden="true" />
      </div>

      {/* Título y Mensaje Específico */}
      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
        Sin conexión con los servicios centrales
      </h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
        No es posible establecer comunicación con el servidor del Mercado Mayorista. Verifique su conexión de red o espere a que el servicio sea reestablecido.
      </p>

      {/* Indicador de Hora del Último Intento y Código de Diagnóstico */}
      <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-slate-50 border border-slate-200/60 px-3 py-1.5 text-xs text-gray-600 font-mono">
        {horaStr && <span>Último intento: {horaStr}</span>}
        {digest && (
          <>
            <span className="text-gray-300">•</span>
            <span>
              Código: <span className="font-semibold text-gray-800">{digest}</span>
            </span>
          </>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
        {onVolver ? (
          <button
            type="button"
            onClick={onVolver}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Volver al inicio</span>
          </button>
        ) : rutaVolver ? (
          <Link
            href={rutaVolver}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Volver al inicio</span>
          </Link>
        ) : null}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-institucional-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-institucional-green/90 focus:outline-none focus:ring-2 focus:ring-institucional-green/40 transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Reintentar conexión</span>
          </button>
        )}
      </div>
    </section>
  );
}
