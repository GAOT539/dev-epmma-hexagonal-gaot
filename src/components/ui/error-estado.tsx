"use client";

import React from "react";
import { AlertTriangle, WifiOff, RefreshCw, ArrowLeft, ShieldAlert } from "lucide-react";
import { esErrorConexion } from "@/lib/error-utils";
import Link from "next/link";

export interface ErrorEstadoProps {
  error?: Error | { digest?: string; message?: string } | string | null;
  tipo?: "general" | "conexion" | "auto";
  titulo?: string;
  mensaje?: string;
  onRetry?: () => void;
  textoRetry?: string;
  secundarioAccion?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  digest?: string;
  timestamp?: Date | string;
  tamano?: "sm" | "md" | "lg";
  className?: string;
}

export function ErrorEstado({
  error,
  tipo = "auto",
  titulo,
  mensaje,
  onRetry,
  textoRetry,
  secundarioAccion,
  digest,
  timestamp,
  tamano = "md",
  className = "",
}: ErrorEstadoProps) {
  const esConexion =
    tipo === "conexion" || (tipo === "auto" && error ? esErrorConexion(error) : false);

  const digestCode =
    digest || (typeof error === "object" && error !== null && "digest" in error ? error.digest : undefined);

  // Textos y configuraciones predeterminadas según tipo
  const tituloFinal =
    titulo ||
    (esConexion
      ? "Sin conexión con los servicios centrales"
      : "Ha ocurrido un problema inesperado");

  const mensajeFinal =
    mensaje ||
    (esConexion
      ? "No es posible establecer comunicación con el servidor del Mercado Mayorista. Verifique su conexión de red o espere a que el servicio sea reestablecido."
      : "Se ha producido un error imprevisto al procesar la solicitud. Si el problema persiste tras reintentar, por favor comuníquese con el departamento TIC de EP-EMA.");

  const textoRetryFinal = textoRetry || (esConexion ? "Reintentar conexión" : "Intentar nuevamente");

  const formatoHora = (ts?: Date | string) => {
    if (!ts) return null;
    try {
      const d = typeof ts === "string" ? new Date(ts) : ts;
      return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return null;
    }
  };

  const horaStr = formatoHora(timestamp);

  // Variante Compacta (sm): ideal para tablas, widgets o contenedores pequeños
  if (tamano === "sm") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`w-full rounded-xl border border-red-200 bg-red-50/60 p-4 text-left transition-all ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-lg bg-red-100 p-1.5 text-red-700">
              {esConexion ? <WifiOff size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 leading-tight">{tituloFinal}</h4>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">{mensajeFinal}</p>
              {(digestCode || horaStr) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-mono">
                  {horaStr && <span>Hora: {horaStr}</span>}
                  {digestCode && (
                    <span className="rounded bg-gray-200/80 px-1.5 py-0.5">ID: {digestCode}</span>
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
              <span>{textoRetryFinal}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Variante Mediana (md) o Grande (lg)
  const isLg = tamano === "lg";

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`w-full max-w-xl mx-auto rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm text-center transition-all ${
        isLg ? "py-10 sm:py-12" : ""
      } ${className}`}
    >
      {/* Ícono Ilustrativo */}
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200/60 shadow-inner">
        {esConexion ? (
          <WifiOff size={32} className="text-amber-600" aria-hidden="true" />
        ) : (
          <ShieldAlert size={32} className="text-red-600" aria-hidden="true" />
        )}
      </div>

      {/* Títulos y Descripciones */}
      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
        {tituloFinal}
      </h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
        {mensajeFinal}
      </p>

      {/* Metadatos de Diagnóstico */}
      {(digestCode || horaStr) && (
        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-slate-50 border border-slate-200/60 px-3 py-1.5 text-xs text-gray-600 font-mono">
          {horaStr && <span>Último intento: {horaStr}</span>}
          {horaStr && digestCode && <span className="text-gray-300">•</span>}
          {digestCode && (
            <span>
              Código: <span className="font-semibold text-gray-800">{digestCode}</span>
            </span>
          )}
        </div>
      )}

      {/* Botones de Acción */}
      <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
        {secundarioAccion && (
          secundarioAccion.href ? (
            <Link
              href={secundarioAccion.href}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{secundarioAccion.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={secundarioAccion.onClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-slate-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{secundarioAccion.label}</span>
            </button>
          )
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-institucional-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-institucional-green/90 focus:outline-none focus:ring-2 focus:ring-institucional-green/40 transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{textoRetryFinal}</span>
          </button>
        )}
      </div>
    </section>
  );
}
