// ── Infraestructura: Datos simulados del Mercado ──────────────────────────────

import type {
  Nave,
  Sector,
  Puesto,
  Comerciante,
  RegistroAsistencia,
  EstadoAsistencia,
} from "@/domain/models/comerciante.model";
import { format, subDays } from "date-fns";

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

// Jerarquía estricta: Nave -> Sector (sin Zonas)
const SECTOR_NOMBRES = ["Sector 1", "Sector 2", "Sector 3", "Sector 4"];

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

// Generar sectores (sin Zonas — directamente Sector 1..4 por nave)
function generarSectores(): Map<string, Sector[]> {
  const map = new Map<string, Sector[]>();
  for (const nave of NAVES_CONFIG) {
    const sectores: Sector[] = SECTOR_NOMBRES.map((nombre, i) => ({
      id: `${nave.id}-sector-${i + 1}`,
      nombre,
      naveId: nave.id,
    }));
    map.set(nave.id, sectores);
  }
  return map;
}

const sectoresMap = generarSectores();

// Generar puestos y comerciantes
let comercianteIndex = 0;

function generarPuestosYComerciantes(): {
  puestos: Puesto[];
  comerciantes: Comerciante[];
} {
  const puestos: Puesto[] = [];
  const comerciantes: Comerciante[] = [];

  for (const nave of NAVES_CONFIG) {
    const sectores = sectoresMap.get(nave.id) ?? [];
    const puestosPorSector = Math.floor(LIMITE_PUESTOS / sectores.length);

    for (const sector of sectores) {
      for (let j = 0; j < puestosPorSector; j++) {
        const globalIndex = puestos.length;
        const puestoId = `P-${nave.nombre.replace("Nave ", "")}${String(globalIndex + 1).padStart(3, "0")}`;

        // ~85% ocupados, ~15% vacantes
        const esVacante = rand() < 0.15;

        if (esVacante) {
          puestos.push({
            id: puestoId,
            codigo: puestoId,
            naveId: nave.id,
            sectorId: sector.id,
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
            nombres: pick(NOMBRES),
            apellidos: `${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
            actividad: pick(ACTIVIDADES),
            puestoId: puestoId,
          };

          comerciantes.push(comerciante);

          puestos.push({
            id: puestoId,
            codigo: puestoId,
            naveId: nave.id,
            sectorId: sector.id,
            estado: "Ocupado",
            comercianteId: comId,
          });

          comercianteIndex++;
        }
      }
    }
  }

  return { puestos, comerciantes };
}

const { puestos: allPuestos, comerciantes: allComerciantes } =
  generarPuestosYComerciantes();

// ── Generar asistencia histórica (últimos 30 días) ──────────────────────────
// Regla de transición: Si ayer = Novedad, hoy = Observacion con observacionTexto heredada

function generarAsistenciaHistorica(): Map<string, RegistroAsistencia[]> {
  const map = new Map<string, RegistroAsistencia[]>();
  const hoy = new Date();

  for (const comerciante of allComerciantes) {
    let estadoAnterior: EstadoAsistencia = "Pendiente";
    let textoNovedadAnterior: string | undefined = undefined;

    for (let d = 30; d >= 0; d--) {
      const fecha = format(subDays(hoy, d), "yyyy-MM-dd");
      const key = fecha;

      let estado: EstadoAsistencia;
      let observacionTexto: string | undefined = undefined;
      let observacion: string | undefined = undefined;

      // Regla de transición: Novedad ayer → Observacion hoy con texto heredado
      if (estadoAnterior === "Novedad") {
        estado = "Observacion";
        observacion = "En observación por novedad previa";
        observacionTexto = textoNovedadAnterior;
      } else {
        // Distribución aleatoria
        const r = rand();
        if (r < 0.70) estado = "Presente";
        else if (r < 0.82) estado = "Ausente";
        else if (r < 0.90) estado = "Novedad";
        else if (r < 0.95) estado = "Observacion";
        else estado = "Permiso";
      }

      // Generar texto de novedad si el estado es Novedad
      if (estado === "Novedad") {
        observacionTexto = pick(TEXTOS_NOVEDAD);
        observacion = "Novedad reportada por supervisor";
      } else if (estado === "Observacion" && !observacion) {
        observacion = "En observación";
      } else if (estado === "Permiso") {
        observacion = "Permiso concedido";
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
      };

      const existing = map.get(key) ?? [];
      existing.push(registro);
      map.set(key, existing);

      // Guardar estado y texto para la transición del día siguiente
      textoNovedadAnterior = estado === "Novedad" ? observacionTexto : undefined;
      estadoAnterior = estado;
    }
  }

  return map;
}

const asistenciaHistorica = generarAsistenciaHistorica();

// ── API pública ──────────────────────────────────────────────────────────────

export function getNaves(): Nave[] {
  return NAVES_CONFIG.map((nc) => ({
    id: nc.id,
    nombre: nc.nombre,
    limitePuestos: LIMITE_PUESTOS,
    sectores: sectoresMap.get(nc.id) ?? [],
  }));
}

export function getSectoresPorNave(naveId: string): Sector[] {
  return sectoresMap.get(naveId) ?? [];
}

export function getPuestosPorSector(sectorId: string): Puesto[] {
  return allPuestos.filter((p) => p.sectorId === sectorId);
}

export function getPuestosPorNave(naveId: string): Puesto[] {
  return allPuestos.filter((p) => p.naveId === naveId);
}

export function getComerciantes(): Comerciante[] {
  return allComerciantes;
}

export function getComerciantePorId(id: string): Comerciante | null {
  return allComerciantes.find((c) => c.idInterno === id) ?? null;
}

export function getComerciantePorPuesto(puestoId: string): Comerciante | null {
  return allComerciantes.find((c) => c.puestoId === puestoId) ?? null;
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
    registros[idx] = { ...registros[idx], estado, observacion, observacionTexto };
  } else {
    const comerciante = getComerciantePorId(comercianteId);
    registros.push({
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado,
      observacion,
      observacionTexto,
    });
    asistenciaHistorica.set(fecha, registros);
  }
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
  fin: string
) {
  // Marcar todos los días del rango como Permiso
  const startDate = new Date(inicio + "T00:00:00");
  const endDate = new Date(fin + "T00:00:00");
  const current = new Date(startDate);

  while (current <= endDate) {
    const fecha = format(current, "yyyy-MM-dd");
    setEstadoAsistencia(comercianteId, fecha, "Permiso", "Permiso concedido");
    current.setDate(current.getDate() + 1);
  }
}

// ── CRUD de Comerciantes (para el módulo TIC) ────────────────────────────────

let nextComerciante = allComerciantes.length + 1;

export function agregarComerciante(data: {
  ciu: string;
  nombres: string;
  apellidos: string;
  actividad: string;
  naveId: string;
  sectorId: string;
  puestoId: string;
}): Comerciante {
  const comId = `com-${String(nextComerciante++).padStart(4, "0")}`;
  const cedula = genCedula(nextComerciante);

  const comerciante: Comerciante = {
    idInterno: comId,
    ciu: data.ciu,
    cedula,
    nombres: data.nombres,
    apellidos: data.apellidos,
    actividad: data.actividad,
    puestoId: data.puestoId,
  };

  allComerciantes.push(comerciante);

  // Marcar puesto como ocupado
  const puesto = allPuestos.find((p) => p.id === data.puestoId);
  if (puesto) {
    puesto.estado = "Ocupado";
    puesto.comercianteId = comId;
  }

  return comerciante;
}

export function editarComerciante(
  idInterno: string,
  data: {
    ciu?: string;
    nombres?: string;
    apellidos?: string;
    actividad?: string;
    naveId?: string;
    sectorId?: string;
    puestoId?: string;
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
    ...(data.nombres !== undefined && { nombres: data.nombres }),
    ...(data.apellidos !== undefined && { apellidos: data.apellidos }),
    ...(data.actividad !== undefined && { actividad: data.actividad }),
    ...(data.puestoId !== undefined && { puestoId: data.puestoId }),
  };

  return allComerciantes[idx];
}

export function eliminarComerciante(idInterno: string): boolean {
  const idx = allComerciantes.findIndex((c) => c.idInterno === idInterno);
  if (idx === -1) return false;

  const com = allComerciantes[idx];

  // Liberar puesto
  if (com.puestoId) {
    const puesto = allPuestos.find((p) => p.id === com.puestoId);
    if (puesto) {
      puesto.estado = "Vacante";
      puesto.comercianteId = null;
    }
  }

  allComerciantes.splice(idx, 1);
  return true;
}

/** Obtener puestos vacantes para un sector específico */
export function getPuestosVacantesPorSector(sectorId: string): Puesto[] {
  return allPuestos.filter(
    (p) => p.sectorId === sectorId && p.estado === "Vacante"
  );
}
