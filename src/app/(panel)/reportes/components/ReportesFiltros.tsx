"use client";

import React from "react";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  FileSpreadsheet,
  Search,
  X,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import type { Nave } from "@/domain/models/nave.model";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ReportesFiltrosProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedNaveId: string;
  setSelectedNaveId: (naveId: string) => void;
  naves: Nave[];
  fechaInicioDate: Date | undefined;
  setFechaInicioDate: (date: Date | undefined) => void;
  fechaFinDate: Date | undefined;
  setFechaFinDate: (date: Date | undefined) => void;
  openInicio: boolean;
  setOpenInicio: (open: boolean) => void;
  openFin: boolean;
  setOpenFin: (open: boolean) => void;
  limites: { minFecha: string; maxFecha: string; hoy: string };
  incluirObservaciones: boolean;
  setIncluirObservaciones: (incluir: boolean) => void;
  soloObservaciones: boolean;
  setSoloObservaciones: (solo: boolean) => void;
  hayDatos: boolean;
  exportandoPDF: boolean;
  exportandoExcel: boolean;
  onDescargarPDF: () => void;
  onDescargarExcel: () => void;
}

export function ReportesFiltros({
  searchQuery,
  setSearchQuery,
  selectedNaveId,
  setSelectedNaveId,
  naves,
  fechaInicioDate,
  setFechaInicioDate,
  fechaFinDate,
  setFechaFinDate,
  openInicio,
  setOpenInicio,
  openFin,
  setOpenFin,
  limites,
  incluirObservaciones,
  setIncluirObservaciones,
  soloObservaciones,
  setSoloObservaciones,
  hayDatos,
  exportandoPDF,
  exportandoExcel,
  onDescargarPDF,
  onDescargarExcel,
}: ReportesFiltrosProps) {
  return (
    <div className="rounded-2xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 shrink-0">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-4 w-full">
        {/* Buscador de Comerciantes */}
        <div className="flex flex-col gap-1.5 w-full md:flex-1 md:min-w-[220px]">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Buscar Comerciante / Puesto
          </label>
          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <Input
              type="text"
              placeholder="Buscar por apellidos, nombres, cédula o puesto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-8 text-xs bg-base-white border-institucional-whiteSmokeBlack/30 focus-visible:ring-institucional-green"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filtro de Nave */}
        <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Nave
          </label>
          <select
            value={selectedNaveId}
            onChange={(e) => setSelectedNaveId(e.target.value)}
            className="h-9 w-full md:w-auto rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-xs font-medium text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30"
          >
            <option value="todas">Todas las Naves</option>
            {naves.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Selector Fecha Inicio */}
        <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Fecha de Inicio
          </label>
          <Popover open={openInicio} onOpenChange={setOpenInicio}>
            <PopoverTrigger className="h-9 w-full md:w-auto inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-xs text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30 cursor-pointer">
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
              <span>{fechaInicioDate ? format(fechaInicioDate, "dd/MM/yyyy") : "Seleccionar"}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                selected={fechaInicioDate}
                onSelect={(date) => {
                  if (!date) return;
                  setFechaInicioDate(date);
                  if (fechaFinDate && date > fechaFinDate) {
                    setFechaFinDate(date);
                  }
                  setOpenInicio(false);
                }}
                disabled={(date) => {
                  const minD = limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date());
                  return date > endOfDay(new Date()) || date < minD;
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Selector Fecha Fin */}
        <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Fecha de Fin
          </label>
          <Popover open={openFin} onOpenChange={setOpenFin}>
            <PopoverTrigger className="h-9 w-full md:w-auto inline-flex items-center justify-start rounded-lg border border-institucional-whiteSmokeBlack/30 bg-base-white px-3 text-left font-normal text-xs text-base-eerieBlack outline-none focus:border-institucional-green focus:ring-1 focus:ring-institucional-green/30 cursor-pointer">
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-700 shrink-0" />
              <span>{fechaFinDate ? format(fechaFinDate, "dd/MM/yyyy") : "Seleccionar"}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                selected={fechaFinDate}
                onSelect={(date) => {
                  if (!date) return;
                  setFechaFinDate(date);
                  setOpenFin(false);
                }}
                disabled={(date) => {
                  const minD = fechaInicioDate
                    ? startOfDay(fechaInicioDate)
                    : (limites.minFecha ? startOfDay(parseISO(limites.minFecha)) : startOfDay(new Date()));
                  return date > endOfDay(new Date()) || date < minD;
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Toggle de observaciones */}
        <div className="flex flex-col justify-end w-full md:w-auto shrink-0">
          <div className="flex items-center gap-2 h-9">
            <input
              type="checkbox"
              id="toggle-obs"
              checked={incluirObservaciones}
              disabled={soloObservaciones}
              onChange={(e) => setIncluirObservaciones(e.target.checked)}
              className="rounded border-institucional-whiteSmokeBlack/30 text-institucional-green focus:ring-institucional-green w-4 h-4 cursor-pointer disabled:opacity-40"
            />
            <label
              htmlFor="toggle-obs"
              className={`text-xs font-semibold uppercase tracking-wider cursor-pointer select-none ${
                soloObservaciones ? "text-gray-400" : "text-gray-700"
              }`}
            >
              Incluir Observaciones
            </label>
          </div>
        </div>

        {/* Toggle Solo Observaciones */}
        <div className="flex flex-col justify-end w-full md:w-auto shrink-0">
          <div className="flex items-center gap-2 h-9">
            <input
              type="checkbox"
              id="toggle-solo-obs"
              checked={soloObservaciones}
              onChange={(e) => setSoloObservaciones(e.target.checked)}
              className="rounded border-institucional-whiteSmokeBlack/30 text-institucional-green focus:ring-institucional-green w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="toggle-solo-obs"
              className="text-xs font-semibold text-institucional-green uppercase tracking-wider cursor-pointer select-none"
            >
              Solo Observaciones
            </label>
          </div>
        </div>

        {/* Botones de Descarga: PDF y Excel */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 mt-2 md:mt-0">
          <button
            type="button"
            onClick={onDescargarPDF}
            disabled={!hayDatos || exportandoPDF}
            className={[
              "flex items-center justify-center gap-2 h-9 rounded-lg px-4 text-xs font-semibold shadow-sm transition-colors cursor-pointer",
              hayDatos && !exportandoPDF
                ? "bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 active:bg-acento-verdeOliva2"
                : "bg-institucional-whiteSmokeBlack/30 text-gray-500 cursor-not-allowed",
            ].join(" ")}
          >
            {exportandoPDF ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Descargar PDF
          </button>

          <button
            type="button"
            onClick={onDescargarExcel}
            disabled={!hayDatos || exportandoExcel}
            className={[
              "flex items-center justify-center gap-2 h-9 rounded-lg px-4 text-xs font-semibold shadow-sm transition-colors cursor-pointer",
              hayDatos && !exportandoExcel
                ? "bg-emerald-800 text-base-white hover:bg-emerald-900 active:bg-emerald-950"
                : "bg-institucional-whiteSmokeBlack/30 text-gray-500 cursor-not-allowed",
            ].join(" ")}
          >
            {exportandoExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Descargar Excel
          </button>
        </div>
      </div>
    </div>
  );
}
