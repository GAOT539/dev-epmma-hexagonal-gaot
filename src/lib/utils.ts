import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type EstadoAsistenciaKey = "Presente" | "Ausente" | "Permiso" | "Pendiente" | "Vacante";

export const ESTADO_COLORES_SOLIDOS: Record<
  EstadoAsistenciaKey,
  { bg: string; text: string; solidClass: string; hex: string; label: string; ring: string }
> = {
  Presente: {
    bg: "bg-green-700",
    text: "text-white",
    solidClass: "bg-green-700 text-white",
    hex: "#15803D",
    label: "Presente",
    ring: "ring-green-700/30",
  },
  Ausente: {
    bg: "bg-red-700",
    text: "text-white",
    solidClass: "bg-red-700 text-white",
    hex: "#B91C1C",
    label: "Ausente",
    ring: "ring-red-700/30",
  },
  Permiso: {
    bg: "bg-purple-700",
    text: "text-white",
    solidClass: "bg-purple-700 text-white",
    hex: "#7E22CE",
    label: "Permiso",
    ring: "ring-purple-700/30",
  },
  Vacante: {
    bg: "bg-gray-700",
    text: "text-white",
    solidClass: "bg-gray-700 text-white",
    hex: "#374151",
    label: "Vacante",
    ring: "ring-gray-700/30",
  },
  Pendiente: {
    bg: "bg-slate-600",
    text: "text-white",
    solidClass: "bg-slate-600 text-white",
    hex: "#475569",
    label: "Pendiente",
    ring: "ring-slate-600/30",
  },
};

export function getColorEstado(estado: string) {
  const key = (estado in ESTADO_COLORES_SOLIDOS ? estado : "Pendiente") as EstadoAsistenciaKey;
  return ESTADO_COLORES_SOLIDOS[key];
}
