// ── Infraestructura: Datos simulados del Mercado ──────────────────────────────

import type {
  Nave,
  Puesto,
  Comerciante,
  RegistroAsistencia,
  EstadoAsistencia,
  ObservacionDetalle,
  PermisoDetalle,
} from "@/domain/models/comerciante.model";
import { format, subDays } from "date-fns";
import {
  obtenerNaves,
  obtenerNavePorId,
  crearNave,
  actualizarNave,
  actualizarPuestosNave,
  eliminarNave,
  cambiarEstadoNave,
  obtenerSupervisoresDisponibles,
  registrarNaveConComerciantes,
  navesConComerciantes,
} from "./naves.mock";

export {
  obtenerNaves,
  obtenerNavePorId,
  crearNave,
  actualizarNave,
  actualizarPuestosNave,
  eliminarNave,
  cambiarEstadoNave,
  obtenerSupervisoresDisponibles,
  registrarNaveConComerciantes,
  navesConComerciantes,
};

// ── Pools de datos ───────────────────────────────────────────────────────────

const ACTIVIDADES = [
  "Frutas", "Legumbres", "Carnes", "Lácteos", "Granos y Cereales",
  "Mariscos", "Tubérculos", "Verduras", "Condimentos", "Abarrotes",
  "Flores", "Artesanías", "Comida Preparada", "Bebidas", "Plásticos",
];

const NOMBRES = [
  "Luis", "María", "Carlos", "Ana", "Pedro", "Rosa", "Jorge", "Elena",
  "Marco", "Sofía", "Ricardo", "Patricia", "Fernando", "Carmen", "Diego",
  "Lucía", "Andrés", "Isabel", "Miguel", "Teresa", "Raúl", "Gloria",
  "Oscar", "Daniela", "Héctor", "Verónica", "Esteban", "Adriana",
  "Gustavo", "Mónica",
];

const APELLIDOS = [
  "Martínez", "Ríos", "Salcedo", "Torres", "Vargas", "Guzmán",
  "Castillo", "Mora", "Pérez", "Mendoza", "Suárez", "López",
  "Medina", "Ruiz", "Sánchez", "Herrera", "Flores", "Paredes",
  "Cevallos", "Naranjo", "Villacís", "Córdova", "Barrionuevo",
  "Altamirano", "Quishpe", "Chávez", "Bonilla", "Acosta",
  "Caicedo", "Velasteguí",
];

// ── Textos de novedad para generación ────────────────────────────────────────

const TEXTOS_NOVEDAD = [
  "Puesto en mal estado, requiere mantenimiento urgente.",
  "Comerciante reporta problema con instalaciones eléctricas.",
  "Acumulación de basura en los alrededores del puesto.",
  "Fuga de agua detectada cerca del puesto.",
  "Comerciante solicitó cambio de puesto por conflicto con vecino.",
  "Producto en mal estado decomisado por inspección sanitaria.",
  "Puesto parcialmente dañado por incidente menor.",
  "Comerciante presenta documentación vencida.",
  "Bloqueo parcial del pasillo por mercadería fuera del puesto.",
  "Ruido excesivo reportado por comerciantes aledaños.",
];

// ── Seed determinístico ──────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function genCedula(index: number): string {
  return `18${String(10000000 + index).padStart(8, "0")}`;
}

function genCIU(index: number): string {
  return `CIU-${String(index + 1).padStart(5, "0")}`;
}

// ── Generación de datos ──────────────────────────────────────────────────────

const NAVES_CONFIG = [
  { id: "nave-a", nombre: "Nave A" },
  { id: "nave-b", nombre: "Nave B" },
  { id: "nave-c", nombre: "Nave C" },
  { id: "nave-d", nombre: "Nave D" },
  { id: "nave-e", nombre: "Nave E" },
];

const LIMITE_PUESTOS = 100;

// Generar puestos y comerciantes
let comercianteIndex = 0;

function generarPuestosYComerciantes(): {
  puestos: Puesto[];
  comerciantes: Comerciante[];
} {
  const puestos: Puesto[] = [];
  const comerciantes: Comerciante[] = [];

  for (const nave of NAVES_CONFIG) {
    for (let j = 0; j < LIMITE_PUESTOS; j++) {
      const globalIndex = puestos.length;
      const puestoId = `P-${nave.nombre.replace("Nave ", "")}${String(globalIndex + 1).padStart(3, "0")}`;

      // ~85% ocupados, ~15% vacantes
      const esVacante = rand() < 0.15;

      if (esVacante) {
        puestos.push({
          id: puestoId,
          codigo: puestoId,
          naveId: nave.id,
          estado: "Vacante",
          comercianteId: null,
        });
      } else {
        const cedula = genCedula(comercianteIndex);
        const ciu = genCIU(comercianteIndex);
        const comId = `com-${String(comercianteIndex + 1).padStart(4, "0")}`;

        const comerciante: Comerciante = {
          idInterno: comId,
          ciu,
          cedula,
          contribuyente: `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
          actividad: pick(ACTIVIDADES),
          puestoId: puestoId,
          nave: nave.nombre.toUpperCase(),
          estadoRegistro: "Habilitado",
          creadoPor: "sistema",
        };

        comerciantes.push(comerciante);

        puestos.push({
          id: puestoId,
          codigo: puestoId,
          naveId: nave.id,
          estado: "Ocupado",
          comercianteId: comId,
        });

        comercianteIndex++;
      }
    }
  }

  return { puestos, comerciantes };
}

const { puestos: allPuestos, comerciantes: allComerciantes } =
  generarPuestosYComerciantes();

// ── Generar asistencia histórica (últimos 30 días) ──────────────────────────
// Regla de transición: Si ayer = Ausente reiterado -> hoy = Observacion

function generarAsistenciaHistorica(): Map<string, RegistroAsistencia[]> {
  const map = new Map<string, RegistroAsistencia[]>();
  const hoy = new Date();

  for (const comerciante of allComerciantes) {
    for (let d = 30; d >= 0; d--) {
      const fecha = format(subDays(hoy, d), "yyyy-MM-dd");
      const key = fecha;

      let estado: EstadoAsistencia;
      let observacionTexto: string | undefined = undefined;
      let observacion: string | undefined = undefined;

      // Distribución aleatoria (sin estado Observacion)
      const r = rand();
      if (r < 0.70) estado = "Presente";
      else if (r < 0.85) estado = "Ausente";
      else if (r < 0.95) estado = "Pendiente";
      else estado = "Permiso";

      // Observaciones como metadatos puros independientes del estado
      const tieneObs = rand() < 0.15;
      if (tieneObs) {
        observacion = "Novedad registrada";
        observacionTexto = pick(TEXTOS_NOVEDAD);
      } else if (estado === "Permiso") {
        observacion = "Permiso concedido";
      }

      const observaciones: ObservacionDetalle[] = [];
      if (observacionTexto) {
        observaciones.push({
          id: `obs-hist-${comerciante.idInterno}-${fecha}-1`,
          texto: observacionTexto,
          fechaHora: "07:30 AM",
        });
      }

      const permisos: PermisoDetalle[] = [];
      if (estado === "Permiso") {
        permisos.push({
          id: `perm-hist-${comerciante.idInterno}-${fecha}-1`,
          motivo: observacion || "Permiso concedido",
          fechaAsignacion: fecha,
          fechaInicio: fecha,
          fechaFin: format(subDays(hoy, Math.max(0, d - 2)), "yyyy-MM-dd"),
          fecha,
        });
      }

      const registro: RegistroAsistencia = {
        id: `asist-${comerciante.idInterno}-${fecha}`,
        comercianteId: comerciante.idInterno,
        puestoId: comerciante.puestoId ?? "",
        fecha,
        estado,
        observacion,
        observacionTexto,
        permisoInicio: estado === "Permiso" ? fecha : undefined,
        permisoFin:
          estado === "Permiso"
            ? format(subDays(hoy, Math.max(0, d - 2)), "yyyy-MM-dd")
            : undefined,
        observaciones,
        permisos,
      };

      const existing = map.get(key) ?? [];
      existing.push(registro);
      map.set(key, existing);
    }
  }

  return map;
}

const asistenciaHistorica = generarAsistenciaHistorica();

// ── API pública ──────────────────────────────────────────────────────────────

export function getNaves(): Nave[] {
  const naves = obtenerNaves();
  return naves.map((nc) => ({
    id: nc.id,
    nombre: nc.nombre,
    cantidadPuestos: nc.cantidadPuestos,
    supervisores: nc.supervisores ?? [],
    estadoRegistro: nc.estadoRegistro,
    limitePuestos: nc.cantidadPuestos ?? LIMITE_PUESTOS,
    puestos: allPuestos.filter((p) => p.naveId === nc.id),
  }));
}

export function getPuestosPorNave(naveId: string): Puesto[] {
  return allPuestos.filter((p) => p.naveId === naveId);
}

export function getComerciantes(): Comerciante[] {
  return allComerciantes.filter(c => c.estadoRegistro !== "Deshabilitado");
}

export const obtenerComerciantes = getComerciantes;

export function getComerciantePorId(id: string): Comerciante | null {
  return allComerciantes.find((c) => c.idInterno === id && c.estadoRegistro !== "Deshabilitado") ?? null;
}

export function getComerciantePorPuesto(puestoId: string): Comerciante | null {
  return allComerciantes.find((c) => c.puestoId === puestoId && c.estadoRegistro !== "Deshabilitado") ?? null;
}

export function getAsistenciaPorFecha(fecha: string): RegistroAsistencia[] {
  return asistenciaHistorica.get(fecha) ?? [];
}

export function getAsistenciaComerciantePorFecha(
  comercianteId: string,
  fecha: string
): RegistroAsistencia | null {
  const registros = asistenciaHistorica.get(fecha) ?? [];
  return registros.find((r) => r.comercianteId === comercianteId) ?? null;
}

export function getAsistenciaComercianteRango(
  comercianteId: string,
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      const reg = registros.find((r) => r.comercianteId === comercianteId);
      if (reg) resultado.push(reg);
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getAsistenciaNaveRango(
  naveId: string,
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const puestosNave = new Set(
    allPuestos.filter((p) => p.naveId === naveId).map((p) => p.id)
  );
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      resultado.push(
        ...registros.filter((r) => puestosNave.has(r.puestoId))
      );
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getAsistenciaRango(
  fechaInicio: string,
  fechaFin: string
): RegistroAsistencia[] {
  const resultado: RegistroAsistencia[] = [];
  asistenciaHistorica.forEach((registros, fecha) => {
    if (fecha >= fechaInicio && fecha <= fechaFin) {
      resultado.push(...registros);
    }
  });
  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getTotalPuestos(): number {
  return allPuestos.length;
}

export function getPuestosOcupados(): number {
  return allPuestos.filter((p) => p.estado === "Ocupado").length;
}

export function getPuestosVacantes(): number {
  return allPuestos.filter((p) => p.estado === "Vacante").length;
}

// ── Estado mutable en memoria (para cambios en la sesión) ───────────────────

const asistenciaOverrides = new Map<string, EstadoAsistencia>();

export function setEstadoAsistencia(
  comercianteId: string,
  fecha: string,
  estado: EstadoAsistencia,
  observacion?: string,
  observacionTexto?: string
) {
  const key = `${comercianteId}:${fecha}`;
  asistenciaOverrides.set(key, estado);

  // También actualizar el histórico
  const registros = asistenciaHistorica.get(fecha) ?? [];
  const idx = registros.findIndex((r) => r.comercianteId === comercianteId);
  if (idx >= 0) {
    const regActual = registros[idx];
    const observaciones = regActual.observaciones ? [...regActual.observaciones] : [];
    if (observacionTexto) {
      observaciones.push({
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        texto: observacionTexto,
        fechaHora: format(new Date(), "hh:mm a"),
      });
    }
    registros[idx] = {
      ...regActual,
      estado,
      observacion: observacion !== undefined ? observacion : regActual.observacion,
      observacionTexto: observacionTexto !== undefined ? observacionTexto : regActual.observacionTexto,
      observaciones,
    };
  } else {
    const comerciante = getComerciantePorId(comercianteId);
    const observaciones: ObservacionDetalle[] = [];
    if (observacionTexto) {
      observaciones.push({
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        texto: observacionTexto,
        fechaHora: format(new Date(), "hh:mm a"),
      });
    }
    registros.push({
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado,
      observacion,
      observacionTexto,
      observaciones,
      permisos: [],
    });
    asistenciaHistorica.set(fecha, registros);
  }
}

export function agregarObservacionMock(
  comercianteId: string,
  fecha: string,
  texto: string,
  fechaHora?: string
): ObservacionDetalle {
  let registros = asistenciaHistorica.get(fecha);
  if (!registros) {
    registros = [];
    asistenciaHistorica.set(fecha, registros);
  }
  let reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg) {
    const comerciante = getComerciantePorId(comercianteId);
    reg = {
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado: "Pendiente",
      observaciones: [],
      permisos: [],
    };
    registros.push(reg);
  }
  if (!reg.observaciones) {
    reg.observaciones = [];
  }
  const nuevaObs: ObservacionDetalle = {
    id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    texto,
    fechaHora: fechaHora || format(new Date(), "hh:mm a"),
  };
  reg.observaciones.push(nuevaObs);
  // Requerimiento 1: "Observación" es un metadato aditivo, NO muta el estado principal
  return nuevaObs;
}

export function eliminarObservacionMock(
  comercianteId: string,
  fecha: string,
  observacionId: string
): void {
  const registros = asistenciaHistorica.get(fecha);
  if (!registros) return;
  const reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg || !reg.observaciones) return;
  reg.observaciones = reg.observaciones.filter((o) => o.id !== observacionId);
  if (reg.observaciones.length > 0) {
    const ultima = reg.observaciones[reg.observaciones.length - 1];
    reg.observacion = ultima.texto;
    reg.observacionTexto = ultima.texto;
  } else {
    reg.observacion = undefined;
    reg.observacionTexto = undefined;
  }
}

export function agregarPermisoMock(
  comercianteId: string,
  fechaAsignacion: string,
  motivo: string,
  fechaInicio: string,
  fechaFin: string
): PermisoDetalle {
  let registros = asistenciaHistorica.get(fechaAsignacion);
  if (!registros) {
    registros = [];
    asistenciaHistorica.set(fechaAsignacion, registros);
  }
  let reg = registros.find((r) => r.comercianteId === comercianteId);
  if (!reg) {
    const comerciante = getComerciantePorId(comercianteId);
    reg = {
      id: `asist-${comercianteId}-${fechaAsignacion}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha: fechaAsignacion,
      estado: "Pendiente",
      observaciones: [],
      permisos: [],
    };
    registros.push(reg);
  }
  if (!reg.permisos) {
    reg.permisos = [];
  }
  const yaExiste = reg.permisos.some(
    (p) => p.fechaInicio === fechaInicio && p.fechaFin === fechaFin
  );
  if (yaExiste) {
    throw new Error("Ya existe un permiso registrado para este rango de fechas.");
  }

  const nuevoPermiso: PermisoDetalle = {
    id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    motivo,
    fechaAsignacion,
    fechaInicio,
    fechaFin,
    fecha: fechaAsignacion,
  };
  reg.permisos.push(nuevoPermiso);

  // Marcar los días dentro del rango como Permiso
  const startDate = new Date(fechaInicio + "T00:00:00");
  const endDate = new Date(fechaFin + "T00:00:00");
  const current = new Date(startDate);

  while (current <= endDate) {
    const dStr = format(current, "yyyy-MM-dd");
    let dRegs = asistenciaHistorica.get(dStr);
    if (!dRegs) {
      dRegs = [];
      asistenciaHistorica.set(dStr, dRegs);
    }
    const dReg = dRegs.find((r) => r.comercianteId === comercianteId);
    if (dReg) {
      dReg.estado = "Permiso";
      dReg.permisoInicio = fechaInicio;
      dReg.permisoFin = fechaFin;
      if (!dReg.permisos) dReg.permisos = [];
      if (!dReg.permisos.some((p) => p.id === nuevoPermiso.id)) {
        dReg.permisos.push(nuevoPermiso);
      }
    } else {
      const com = getComerciantePorId(comercianteId);
      dRegs.push({
        id: `asist-${comercianteId}-${dStr}`,
        comercianteId,
        puestoId: com?.puestoId ?? "",
        fecha: dStr,
        estado: "Permiso",
        observacion: motivo,
        permisoInicio: fechaInicio,
        permisoFin: fechaFin,
        observaciones: [],
        permisos: [nuevoPermiso],
      });
    }
    asistenciaOverrides.set(`${comercianteId}:${dStr}`, "Permiso");
    current.setDate(current.getDate() + 1);
  }

  return nuevoPermiso;
}

export function eliminarPermisoMock(
  comercianteId: string,
  fecha: string,
  permisoId: string
): void {
  asistenciaHistorica.forEach((regs, f) => {
    const reg = regs.find((r) => r.comercianteId === comercianteId);
    if (reg?.permisos) {
      reg.permisos = reg.permisos.filter((p) => p.id !== permisoId);
      if (reg.permisos.length === 0 && reg.estado === "Permiso") {
        reg.estado = "Pendiente";
        reg.permisoInicio = undefined;
        reg.permisoFin = undefined;
        reg.observacion = undefined;
        asistenciaOverrides.delete(`${comercianteId}:${f}`);
      }
    }
  });
}

export function getEstadoOverride(
  comercianteId: string,
  fecha: string
): EstadoAsistencia | null {
  return asistenciaOverrides.get(`${comercianteId}:${fecha}`) ?? null;
}

export function setPermisoComercianteRango(
  comercianteId: string,
  inicio: string,
  fin: string,
  motivo: string = "Permiso concedido"
) {
  // Marcar todos los días del rango como Permiso
  const startDate = new Date(inicio + "T00:00:00");
  const endDate = new Date(fin + "T00:00:00");
  const current = new Date(startDate);

  while (current <= endDate) {
    const fecha = format(current, "yyyy-MM-dd");
    try {
      agregarPermisoMock(comercianteId, fecha, motivo, inicio, fin);
    } catch {
      // Si ya existía un permiso para esa fecha exacta en el bucle, ignorar duplicado de rango
    }
    current.setDate(current.getDate() + 1);
  }
}

// ── CRUD de Comerciantes (para el módulo TIC) ────────────────────────────────

let nextComerciante = allComerciantes.length + 1;

export function agregarComerciante(data: {
  ciu: string;
  contribuyente: string;
  actividad: string;
  naveId?: string;
  puestoId: string | null;
  cedula?: string;
  nave?: string;
  estadoRegistro?: "Habilitado" | "Deshabilitado";
}): Comerciante {
  const comId = `com-${String(nextComerciante++).padStart(4, "0")}`;
  const cedula = data.cedula || genCedula(nextComerciante);

  // 1. Detección o auto-creación de Nave
  let naveEncontrada: Nave | null = null;
  const navesExistentes = obtenerNaves();
  const nombreBuscado = (data.nave || "").trim().toUpperCase();
  const idBuscado = (data.naveId || "").trim();

  if (idBuscado) {
    naveEncontrada = navesExistentes.find((n) => n.id === idBuscado) ?? null;
  }
  if (!naveEncontrada && nombreBuscado) {
    naveEncontrada = navesExistentes.find(
      (n) => n.nombre.trim().toUpperCase() === nombreBuscado
    ) ?? null;
  }

  if (!naveEncontrada && (nombreBuscado || idBuscado)) {
    const nombreCrear = data.nave?.trim() || `NAVE ${idBuscado.toUpperCase()}`;
    naveEncontrada = crearNave(nombreCrear, 100);
  }

  const naveFinalNombre = naveEncontrada?.nombre || data.nave;
  const naveIdFinal = naveEncontrada ? naveEncontrada.id : (data.naveId || "nave-a");

  // 2. Manejo y auto-creación de Puesto
  if (data.puestoId && data.puestoId !== "-") {
    const puestoCodigo = data.puestoId.trim();

    let puesto = allPuestos.find(
      (p) =>
        p.naveId === naveIdFinal &&
        (p.codigo.toUpperCase() === puestoCodigo.toUpperCase() || p.id === puestoCodigo)
    );

    if (!puesto) {
      const puestoUnicoId = `${naveIdFinal}-${puestoCodigo}`;
      puesto = {
        id: puestoUnicoId,
        codigo: puestoCodigo,
        naveId: naveIdFinal,
        estado: "Ocupado",
        comercianteId: comId,
      };
      allPuestos.push(puesto);
    } else {
      puesto.estado = "Ocupado";
      puesto.comercianteId = comId;
    }

    if (naveEncontrada) {
      registrarNaveConComerciantes(naveEncontrada.id);
    }
  }

  const comerciante: Comerciante = {
    idInterno: comId,
    ciu: data.ciu,
    cedula,
    contribuyente: data.contribuyente,
    actividad: data.actividad,
    puestoId: data.puestoId && data.puestoId !== "-" ? data.puestoId : null,
    nave: naveFinalNombre,
    estadoRegistro: data.estadoRegistro ?? "Habilitado",
    creadoPor: "sistema",
  };

  allComerciantes.push(comerciante);

  return comerciante;
}

export function editarComerciante(
  idInterno: string,
  data: {
    ciu?: string;
    contribuyente?: string;
    actividad?: string;
    naveId?: string;
    puestoId?: string | null;
    nave?: string;
    cedula?: string;
    estadoRegistro?: "Habilitado" | "Deshabilitado";
    deshabilitadoPor?: string;
    modificadoPor?: string;
  }
): Comerciante | null {
  const idx = allComerciantes.findIndex((c) => c.idInterno === idInterno);
  if (idx === -1) return null;

  const old = allComerciantes[idx];

  // Si cambió de puesto, liberar el anterior y asignar el nuevo
  if (data.puestoId && data.puestoId !== old.puestoId) {
    const oldPuesto = allPuestos.find((p) => p.id === old.puestoId);
    if (oldPuesto) {
      oldPuesto.estado = "Vacante";
      oldPuesto.comercianteId = null;
    }
    const newPuesto = allPuestos.find((p) => p.id === data.puestoId);
    if (newPuesto) {
      newPuesto.estado = "Ocupado";
      newPuesto.comercianteId = old.idInterno;
    }
  }

  allComerciantes[idx] = {
    ...old,
    ...(data.ciu !== undefined && { ciu: data.ciu }),
    ...(data.contribuyente !== undefined && { contribuyente: data.contribuyente }),
    ...(data.actividad !== undefined && { actividad: data.actividad }),
    ...(data.puestoId !== undefined && { puestoId: data.puestoId }),
    ...(data.estadoRegistro !== undefined && { estadoRegistro: data.estadoRegistro }),
    ...(data.deshabilitadoPor !== undefined && { deshabilitadoPor: data.deshabilitadoPor }),
  };

  return allComerciantes[idx];
}

export function eliminarComerciante(idInterno: string): boolean {
  const idx = allComerciantes.findIndex((c) => c.idInterno === idInterno);
  if (idx === -1) return false;

  const com = allComerciantes[idx];

  // Soft delete en lugar de borrar
  com.estadoRegistro = "Deshabilitado";
  com.deshabilitadoPor = "sistema";

  // Liberar puesto
  if (com.puestoId) {
    const puesto = allPuestos.find((p) => p.id === com.puestoId);
    if (puesto) {
      puesto.estado = "Vacante";
      puesto.comercianteId = null;
    }
    com.puestoId = null;
  }
  
  return true;
}

/** Obtener puestos vacantes para una nave específica */
export function getPuestosVacantesPorNave(naveId: string): Puesto[] {
  return allPuestos.filter(
    (p) => p.naveId === naveId && p.estado === "Vacante"
  );
}
