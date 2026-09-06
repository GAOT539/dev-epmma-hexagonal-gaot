"use client";

import { BarChart3 } from "lucide-react";

export default function ReportesPage() {
  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <BarChart3 size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
            Reportes Operativos
          </h1>
        </div>
        <p className="mt-2 text-sm text-institucional-whiteSmokeBlack">
          Visualiza estadísticas y métricas de gestión del mercado.
        </p>
      </header>

      <div className="mx-auto max-w-3xl">
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-institucional-whiteSmokeBlack/30 bg-base-white p-8">
          <p className="text-sm text-institucional-whiteSmokeBlack">
            Los reportes estarán disponibles próximamente.
          </p>
        </div>
      </div>
    </div>
  );
}
