"use client";

import { useState } from "react";
import { getNavesMock } from "@/infrastructure/mocks/mercado.mock";
import type { Comerciante, EstadoComercianteAsistencia, Sector } from "@/domain/models/comerciante.model";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Tag,
  XCircle,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, format, isToday, subDays } from "date-fns";
import { es } from "date-fns/locale";

// ── Metadatos de la página ────────────────────────────────────────────────────

interface AccionBtnProps {
  label: string;
  estado: Comerciante["estado"];
  Icon: React.ElementType;
  colorClasses: string;
  isActive: boolean;
  onClick: () => void;
}

function AccionBtn({ label, Icon, colorClasses, isActive, onClick }: AccionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
        "transition-all duration-150 active:scale-95",
        isActive ? colorClasses.replace(/\/10/g, "") + " text-base-white" : colorClasses,
      ].join(" ")}
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </button>
  );
}

// ── Subcomponente: tarjeta de comerciante ─────────────────────────────────────

function ComercianteCard({
  comerciante,
  estado,
  onEstadoChange,
}: {
  comerciante: Comerciante;
  estado: EstadoComercianteAsistencia;
  onEstadoChange: (estado: EstadoComercianteAsistencia) => void;
}) {
  return (
    <article
      className="flex flex-col gap-3 rounded-xl bg-base-white px-4 py-3.5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`Comerciante: ${comerciante.nombre}`}
    >
      {/* Nombre + indicador de estado pendiente */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-institucional-green/10 text-sm font-bold text-institucional-green">
          {comerciante.nombre.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-base-eerieBlack text-sm leading-tight">
            {comerciante.nombre}
          </p>
          <span className="inline-flex items-center rounded-full bg-institucional-whiteSmokeBlack/20 px-2 py-0.5 text-[10px] font-medium text-institucional-whiteSmokeBlack mt-0.5">
            {estado === "pendiente" ? "Sin registrar" : estado}
          </span>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-2 flex-wrap">
        <AccionBtn
          label="Presente"
          estado="presente"
          Icon={CheckCircle2}
          colorClasses="bg-acento-verdeOliva1/10 text-acento-verdeOliva1 hover:bg-acento-verdeOliva1 hover:text-base-white"
          isActive={estado === "presente"}
          onClick={() => onEstadoChange("presente")}
        />
        <AccionBtn
          label="Ausente"
          estado="ausente"
          Icon={XCircle}
          colorClasses="bg-base-red/10 text-base-red hover:bg-base-red hover:text-base-white"
          isActive={estado === "ausente"}
          onClick={() => onEstadoChange("ausente")}
        />
        <AccionBtn
          label="Novedad"
          estado="novedad"
          Icon={AlertTriangle}
          colorClasses="bg-acento-naranjaSalmon1/10 text-acento-naranjaSalmon1 hover:bg-acento-naranjaSalmon1 hover:text-base-white"
          isActive={estado === "novedad"}
          onClick={() => onEstadoChange("novedad")}
        />
      </div>
    </article>
  );
}

// ── Subcomponente: bloque de sector ──────────────────────────────────────────

function SectorBlock({
  sector,
  isOpen,
  onToggle,
  attendance,
  onEstadoChange,
}: {
  sector: Sector;
  isOpen: boolean;
  onToggle: () => void;
  attendance: Record<string, EstadoComercianteAsistencia>;
  onEstadoChange: (comercianteId: string, estado: EstadoComercianteAsistencia) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`sector-content-${sector.id}`}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-institucional-green/5"
      >
        <Tag size={13} strokeWidth={2} className="text-institucional-whiteSmokeBlack" aria-hidden="true" />
        <h3
          id={`sector-${sector.id}`}
          className="text-sm font-bold text-base-eerieBlack"
        >
          {sector.nombre}
        </h3>
        <span className="ml-auto rounded-full bg-institucional-whiteSmokeBlack/20 px-2 py-0.5 text-[10px] font-medium text-institucional-whiteSmokeBlack">
          {sector.comerciantes.length} comerciantes
        </span>
        <ChevronDown className={`text-institucional-green transition-transform ${isOpen ? "rotate-180" : ""}`} size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <ul id={`sector-content-${sector.id}`} className="flex flex-col gap-2 border-t border-institucional-whiteSmokeBlack/15 bg-institucional-whiteSmoke/50 p-3" role="list">
          {sector.comerciantes.map((comerciante) => (
            <li key={comerciante.id}>
              <ComercianteCard
                comerciante={comerciante}
                estado={attendance[comerciante.id] ?? comerciante.estado}
                onEstadoChange={(estado) => onEstadoChange(comerciante.id, estado)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ListasPage() {
  const naves = getNavesMock();
  const [selectedNave, setSelectedNave] = useState<string | null>(null);
  const [openSector, setOpenSector] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, EstadoComercianteAsistencia>>({});
  const nave = naves.find((item) => item.id === selectedNave);
  // Si selectedDate es hoy → el carrusel termina en hoy (5 días previos + hoy).
  // Si selectedDate es pasado → termina un día después (4 antes + seleccionada + 1 después).
  const endDate = isToday(selectedDate) ? selectedDate : addDays(selectedDate, 1);
  const recentDates = Array.from({ length: 6 }, (_, index) =>
    subDays(endDate, 5 - index),
  );

  function selectNave(naveId: string) {
    const selected = naves.find((item) => item.id === naveId);
    setSelectedNave(naveId);
    setOpenSector(selected?.sectores[0]?.id ?? null);
  }

  function goBackToNaves() {
    setSelectedNave(null);
    setOpenSector(null);
  }

  return (
    <div className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-institucional-green" aria-hidden="true" />
          <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">Toma de Listas</h1>
        </div>
        <div
          className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Seleccionar fecha"
        >
          {recentDates.map((date) => {
            const dateValue = formatDate(date);
            const isSelected = formatDate(selectedDate) === dateValue;
            return (
              <button
                key={dateValue}
                type="button"
                onClick={() => setSelectedDate(date)}
                aria-pressed={isSelected}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${isSelected ? "bg-institucional-green text-base-white shadow-sm" : "bg-base-white text-institucional-whiteSmokeBlack ring-1 ring-institucional-whiteSmokeBlack/20 hover:text-institucional-green"}`}
              >
                {isToday(date)
                  ? "Hoy"
                  : format(date, "EEE, d 'de' MMM", { locale: es })}
              </button>
            );
          })}

          {/* Botón con Popover + Calendar de shadcn/ui */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-white text-institucional-whiteSmokeBlack ring-1 ring-institucional-whiteSmokeBlack/20 transition-colors hover:text-institucional-green hover:ring-institucional-green/40"
              aria-label="Seleccionar otra fecha"
            >
              <CalendarIcon size={16} strokeWidth={2} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
                locale={es}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {!nave ? (
          naves.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNave(item.id)}
              className="flex items-center gap-4 rounded-2xl bg-base-white p-5 text-left shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 transition-all hover:-translate-y-0.5 hover:ring-institucional-green/50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-institucional-green/10 text-institucional-green">
                <Building2 size={24} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-base-eerieBlack">{item.nombre}</span>
                <span className="text-sm text-institucional-whiteSmokeBlack">{item.sectores.length} sectores disponibles</span>
              </span>
              <ChevronDown className="-rotate-90 text-institucional-green" size={20} aria-hidden="true" />
            </button>
          ))
        ) : (
          <section aria-labelledby={`nave-${nave.id}`}>
            <button type="button" onClick={goBackToNaves} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-institucional-green hover:underline">
              <ArrowLeft size={18} aria-hidden="true" />
              Volver a naves
            </button>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-institucional-green/10 text-institucional-green">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <h2 id={`nave-${nave.id}`} className="text-xl font-bold text-base-eerieBlack">{nave.nombre}</h2>
            </div>
            <div className="flex flex-col gap-3">
              {nave.sectores.map((sector) => (
                <SectorBlock
                  key={sector.id}
                  sector={sector}
                  isOpen={openSector === sector.id}
                  onToggle={() => setOpenSector(openSector === sector.id ? null : sector.id)}
                  attendance={attendance}
                  onEstadoChange={(comercianteId, estado) => setAttendance((current) => ({ ...current, [comercianteId]: estado }))}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
