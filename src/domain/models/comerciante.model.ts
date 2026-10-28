// ── Dominio: Modelo de Comerciante y Puestos ─────────────────────────────────

export type EstadoPuesto = "Ocupado" | "Vacante";

export interface Comerciante {
  idInterno: string;
  ciu: string;
  cedula: string;
  contribuyente: string;
  actividad: string;
  puestoId: string | null;
  nave?: string;
  estadoRegistro: "Habilitado" | "Deshabilitado";
  creadoPor?: string;
  modificadoPor?: string;
  deshabilitadoPor?: string;
}

export interface Puesto {
  id: string;
  codigo: string;
  naveId: string;
  estado: EstadoPuesto;
  comercianteId: string | null;
  comerciante?: {
    idInterno?: string;
    ciu?: string;
    cedula?: string;
    contribuyente?: string;
    actividad?: string;
  } | null;
}

export type {
  Nave,
  EstadoRegistroNave,
  TipoCeldaPlano,
  CeldaPlanoNave,
  PlanoEspacialNave,
} from "./nave.model";

// ── Importación XML/CSV de Catastro ──────────────────────────────────────────

export interface ImportacionRegistro {
  ciu: string;
  cedula: string;
  nombre: string;
  contribuyente: string;
  actividad: string;
  nave: string;
  puesto: string;
  numBodega: string;
  gen01Codi?: string;
}

export type TipoCambioReconciliacion =
  | "NUEVO"
  | "REEMPLAZO_OCUPANTE"
  | "CAMBIO_PUESTO"
  | "ACTUALIZACION"
  | "VACANTE";

export interface CambioReconciliacion {
  tipo: TipoCambioReconciliacion;
  puesto: string;
  detalle: string;
  anterior?: string;
  nuevo?: string;
}

export interface ReconciliacionResumen {
  naveDetectada: string;
  esNaveNueva: boolean;
  capacidadNave: number;
  totalOcupados: number;
  totalVacantes: number;
  cambiosDetectados: CambioReconciliacion[];
  naveNoEncontrada?: boolean;
  navesDisponibles?: Array<{ id: string; nombre: string; cantidadPuestos: number }>;
  esArchivoBodegas?: boolean;
  modoUnificacion?: "UNIFICAR" | "SEPARAR";
}

export interface OpcionesImportacion {
  naveIdManual?: string;
  crearNuevaNave?: boolean;
  nuevoNombreNave?: string;
  modoUnificacion?: "UNIFICAR" | "SEPARAR";
}

export interface ImportacionResultado {
  exitosos: number;
  errores: { fila: number; mensaje: string }[];
  reconciliacion?: ReconciliacionResumen;
}

export type AccionReconciliacionItem = CambioReconciliacion;
export type ResultadoSimulacionCatastro = ImportacionResultado;

// ── Re-exportaciones para compatibilidad retrocompatible ─────────────────────
export type { Rol, Usuario } from "./usuario.model";
export type {
  EstadoAsistencia,
  RegistroAsistencia,
  ConfiguracionSupervisor,
  ObservacionDetalle,
  TipoObservacion,
  PermisoDetalle,
} from "./asistencia.model";
export type { LogAuditoria, SesionControlSupervisor, DetalleComercianteControl, EtiquetaControlSupervisor, ResumenSesionControl } from "./auditoria.model";
