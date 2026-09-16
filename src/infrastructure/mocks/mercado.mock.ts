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

const SECTOR_NOMBRES = ["Zona Norte", "Zona Sur", "Zona Este", "Zona Oeste"];

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

// Generar sectores
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

function generarAsistenciaHistorica(): Map<string, RegistroAsistencia[]> {
  const map = new Map<string, RegistroAsistencia[]>();
  const hoy = new Date();

  for (const comerciante of allComerciantes) {
    let estadoAnterior: EstadoAsistencia = "Pendiente";

    for (let d = 30; d >= 0; d--) {
      const fecha = format(subDays(hoy, d), "yyyy-MM-dd");
      const key = fecha;

      let estado: EstadoAsistencia;

      // Regla de transición: Novedad ayer → Observacion hoy
      if (estadoAnterior === "Novedad") {
        estado = "Observacion";
      } else {
        // Distribución aleatoria
        const r = rand();
        if (r < 0.70) estado = "Presente";
        else if (r < 0.82) estado = "Ausente";
        else if (r < 0.90) estado = "Novedad";
        else if (r < 0.95) estado = "Observacion";
        else estado = "Permiso";
      }

      const registro: RegistroAsistencia = {
        id: `asist-${comerciante.idInterno}-${fecha}`,
        comercianteId: comerciante.idInterno,
        puestoId: comerciante.puestoId ?? "",
        fecha,
        estado,
        observacion:
          estado === "Novedad"
            ? "Novedad reportada por supervisor"
            : estado === "Observacion"
              ? "En observación por novedad previa"
              : estado === "Permiso"
                ? "Permiso concedido"
                : undefined,
        permisoInicio: estado === "Permiso" ? fecha : undefined,
        permisoFin:
          estado === "Permiso"
            ? format(subDays(hoy, Math.max(0, d - 2)), "yyyy-MM-dd")
            : undefined,
      };

      const existing = map.get(key) ?? [];
      existing.push(registro);
      map.set(key, existing);

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
  observacion?: string
) {
  const key = `${comercianteId}:${fecha}`;
  asistenciaOverrides.set(key, estado);

  // También actualizar el histórico
  const registros = asistenciaHistorica.get(fecha) ?? [];
  const idx = registros.findIndex((r) => r.comercianteId === comercianteId);
  if (idx >= 0) {
    registros[idx] = { ...registros[idx], estado, observacion };
  } else {
    const comerciante = getComerciantePorId(comercianteId);
    registros.push({
      id: `asist-${comercianteId}-${fecha}`,
      comercianteId,
      puestoId: comerciante?.puestoId ?? "",
      fecha,
      estado,
      observacion,
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
