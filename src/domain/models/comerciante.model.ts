// ── Dominio: Modelos de negocio del Mercado ───────────────────────────────────

/**
 * Estado de asistencia de un comerciante en la toma de lista diaria.
 */
export type EstadoComercianteAsistencia =
  | "presente"
  | "ausente"
  | "novedad"
  | "pendiente";

/**
 * Representa a un comerciante registrado en el mercado.
 */
export interface Comerciante {
  /** Identificador único del comerciante */
  id: string;
  /** Nombre completo del comerciante */
  nombre: string;
  /** Estado actual de asistencia en la lista del día */
  estado: EstadoComercianteAsistencia;
}

/**
 * Agrupa comerciantes dentro de una misma zona o categoría dentro de una nave.
 */
export interface Sector {
  /** Identificador único del sector */
  id: string;
  /** Nombre descriptivo del sector (ej: "Frutas", "Legumbres") */
  nombre: string;
  /** Lista de comerciantes asignados a este sector */
  comerciantes: Comerciante[];
}

/**
 * Representa una nave (módulo físico) del mercado, compuesta por sectores.
 */
export interface Nave {
  /** Identificador único de la nave */
  id: string;
  /** Nombre de la nave (ej: "Nave A", "Nave B") */
  nombre: string;
  /** Sectores que conforman esta nave */
  sectores: Sector[];
}
