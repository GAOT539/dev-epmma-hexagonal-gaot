// ── Script Maestro de Sembrado Inicial (Prisma Seed) ─────────────────────────
// Siembra SUPERADMIN, las 27 Naves, los 27 Planos Espaciales (Croquis Reales),
// todos los Puestos Físicos y los Comerciantes (desde SQL si está presente o base).

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { CeldaPlanoNave } from "../src/domain/models/nave.model";
import {
  asegurarAsistenciaInicialDelDia,
  obtenerFechaHoyEcuador,
} from "../src/infrastructure/database/daily-attendance.service";
import { asegurarColacionEspanolEnBD } from "../src/infrastructure/database/nave-puestos-sync.service";
import { aplicarSufijoVehiculoPorActividad } from "../src/infrastructure/database/catastro-reconciliacion.service";

const prisma = new PrismaClient();

// ── 1. Catálogo Maestro de las 27 Naves Institucionales ──────────────────────

interface NaveMasterSeed {
  id: string;
  nombre: string;
  cantidadPuestos: number;
  filasPlano: number;
  columnasPlano: number;
}

const NAVES_MAESTRAS: NaveMasterSeed[] = [
  { id: "ambulantes",    nombre: "AMBULANTES",    cantidadPuestos: 44,  filasPlano: 9,  columnasPlano: 9  },
  { id: "nave-a",        nombre: "NAVE A",        cantidadPuestos: 33,  filasPlano: 7,  columnasPlano: 9  },
  { id: "nave-auto",     nombre: "NAVE AUTO",     cantidadPuestos: 6,   filasPlano: 8,  columnasPlano: 8  },
  { id: "nave-b",        nombre: "NAVE B",        cantidadPuestos: 206, filasPlano: 15, columnasPlano: 26 },
  { id: "nave-baterias", nombre: "NAVE BATERIAS", cantidadPuestos: 10,  filasPlano: 8,  columnasPlano: 8  },
  { id: "nave-c",        nombre: "NAVE C",        cantidadPuestos: 127, filasPlano: 14, columnasPlano: 14 },
  { id: "nave-cf",       nombre: "NAVE CF",       cantidadPuestos: 19,  filasPlano: 8,  columnasPlano: 8  },
  { id: "nave-d",        nombre: "NAVE D",        cantidadPuestos: 132, filasPlano: 15, columnasPlano: 15 },
  { id: "nave-e",        nombre: "NAVE E",        cantidadPuestos: 14,  filasPlano: 4,  columnasPlano: 7  },
  { id: "nave-f",        nombre: "NAVE F",        cantidadPuestos: 127, filasPlano: 14, columnasPlano: 14 },
  { id: "nave-g",        nombre: "NAVE G",        cantidadPuestos: 29,  filasPlano: 8,  columnasPlano: 9  },
  { id: "nave-h",        nombre: "NAVE H",        cantidadPuestos: 129, filasPlano: 15, columnasPlano: 16 },
  { id: "nave-i",        nombre: "NAVE I",        cantidadPuestos: 14,  filasPlano: 5,  columnasPlano: 6  },
  { id: "nave-j",        nombre: "NAVE J",        cantidadPuestos: 51,  filasPlano: 10, columnasPlano: 14 },
  { id: "nave-k",        nombre: "NAVE K",        cantidadPuestos: 131, filasPlano: 14, columnasPlano: 15 },
  { id: "nave-l",        nombre: "NAVE L",        cantidadPuestos: 128, filasPlano: 14, columnasPlano: 14 },
  { id: "nave-ll",       nombre: "NAVE LL",       cantidadPuestos: 112, filasPlano: 14, columnasPlano: 14 },
  { id: "nave-m",        nombre: "NAVE M",        cantidadPuestos: 140, filasPlano: 16, columnasPlano: 14 },
  { id: "nave-n",        nombre: "NAVE N",        cantidadPuestos: 133, filasPlano: 16, columnasPlano: 14 },
  { id: "nave-nh",       nombre: "NAVE Ñ",        cantidadPuestos: 40,  filasPlano: 14, columnasPlano: 9  },
  { id: "nave-o",        nombre: "NAVE O",        cantidadPuestos: 108, filasPlano: 14, columnasPlano: 12 },
  { id: "nave-p",        nombre: "NAVE P",        cantidadPuestos: 146, filasPlano: 15, columnasPlano: 16 },
  { id: "nave-q",        nombre: "NAVE Q",        cantidadPuestos: 113, filasPlano: 15, columnasPlano: 13 },
  { id: "nave-qcp",      nombre: "NAVE QCP",      cantidadPuestos: 190, filasPlano: 16, columnasPlano: 16 },
  { id: "nave-ropa",     nombre: "NAVE ROPA",     cantidadPuestos: 3,   filasPlano: 8,  columnasPlano: 8  },
  { id: "nave-trici",    nombre: "NAVE TRICI",    cantidadPuestos: 54,  filasPlano: 10, columnasPlano: 10 },
  { id: "nave-z",        nombre: "NAVE Z",        cantidadPuestos: 32,  filasPlano: 8,  columnasPlano: 8  },
];

// ── 2. Planos Reales de Naves (Fallback embebido para NAVE A, E, G, I, J) ────
// Nota: Si existe prisma/seed-planos.json o viejo_2.sql, se cargan las 27 cuadrículas completas.

const PLANO_NAVE_A_REAL: CeldaPlanoNave[] = [
  { fila: 0, columna: 7, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 2, columna: 6, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 2, columna: 7, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 3, columna: 6, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 0, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 1, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 2, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 3, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 4, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 5, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 4, columna: 6, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 5, columna: 7, tipo: "VACIO", rowSpan: 1, colSpan: 1 },
  { fila: 5, columna: 8, tipo: "VACIO" },
  { fila: 6, columna: 8, tipo: "VACIO" },
  { fila: 2, columna: 8, tipo: "VACIO" },
  { fila: 3, columna: 8, tipo: "VACIO" },
  { fila: 0, columna: 0, tipo: "PUESTO", texto: "BODEGA N-A-05", codigoPuesto: "BODEGA N-A-05" },
  { fila: 0, columna: 1, tipo: "PUESTO", texto: "BODEGA N-A-04", codigoPuesto: "BODEGA N-A-04" },
  { fila: 0, columna: 2, tipo: "PUESTO", texto: "BODEGA N-A-03", codigoPuesto: "BODEGA N-A-03" },
  { fila: 0, columna: 3, tipo: "PUESTO", texto: "BODEGA N-A-02", rowSpan: 2, codigoPuesto: "BODEGA N-A-02" },
  { fila: 1, columna: 0, tipo: "PUESTO", texto: "BODEGA N-A-06", colSpan: 3, codigoPuesto: "BODEGA N-A-06" },
  { fila: 3, columna: 3, tipo: "PUESTO", texto: "BODEGA N-A-09", codigoPuesto: "BODEGA N-A-09" },
  { fila: 3, columna: 4, tipo: "PUESTO", texto: "BODEGA N-A-10", codigoPuesto: "BODEGA N-A-10" },
  { fila: 3, columna: 5, tipo: "PUESTO", texto: "BODEGA N-A-11", codigoPuesto: "BODEGA N-A-11" },
  { fila: 2, columna: 3, tipo: "PUESTO", texto: "BODEGA N-A-12", colSpan: 3, codigoPuesto: "BODEGA N-A-12" },
  { fila: 2, columna: 0, tipo: "PUESTO", texto: "BODEGA N-A-07", rowSpan: 2, codigoPuesto: "BODEGA N-A-07" },
  { fila: 2, columna: 1, tipo: "PUESTO", texto: "BODEGA N-A-07A", rowSpan: 2, codigoPuesto: "BODEGA N-A-07A" },
  { fila: 2, columna: 2, tipo: "PUESTO", texto: "BODEGA N-A-08", rowSpan: 2, codigoPuesto: "BODEGA N-A-08" },
  { fila: 6, columna: 0, tipo: "PUESTO", texto: "CUBICULO N-A-01", codigoPuesto: "CUBICULO N-A-01" },
  { fila: 6, columna: 1, tipo: "PUESTO", texto: "CUBICULO N-A-02", codigoPuesto: "CUBICULO N-A-02" },
  { fila: 6, columna: 2, tipo: "PUESTO", texto: "CUBICULO N-A-03", codigoPuesto: "CUBICULO N-A-03" },
  { fila: 6, columna: 3, tipo: "PUESTO", texto: "CUBICULO N-A-04", codigoPuesto: "CUBICULO N-A-04" },
  { fila: 6, columna: 4, tipo: "PUESTO", texto: "CUBICULO N-A-05", codigoPuesto: "CUBICULO N-A-05" },
  { fila: 6, columna: 5, tipo: "PUESTO", texto: "CUBICULO N-A-06", codigoPuesto: "CUBICULO N-A-06" },
  { fila: 6, columna: 6, tipo: "PUESTO", texto: "CUBICULO N-A-07", codigoPuesto: "CUBICULO N-A-07" },
  { fila: 5, columna: 6, tipo: "PUESTO", texto: "CUBICULO N-A-09", codigoPuesto: "CUBICULO N-A-09" },
  { fila: 5, columna: 5, tipo: "PUESTO", texto: "CUBICULO N-A-10", codigoPuesto: "CUBICULO N-A-10" },
  { fila: 5, columna: 4, tipo: "PUESTO", texto: "CUBICULO N-A-11", codigoPuesto: "CUBICULO N-A-11" },
  { fila: 5, columna: 3, tipo: "PUESTO", texto: "CUBICULO N-A-12", codigoPuesto: "CUBICULO N-A-12" },
  { fila: 5, columna: 2, tipo: "PUESTO", texto: "CUBICULO N-A-13", codigoPuesto: "CUBICULO N-A-13" },
  { fila: 5, columna: 1, tipo: "PUESTO", texto: "CUBICULO N-A-14", codigoPuesto: "CUBICULO N-A-14" },
  { fila: 5, columna: 0, tipo: "PUESTO", texto: "CUBICULO N-A-15", codigoPuesto: "CUBICULO N-A-15" },
  { fila: 4, columna: 8, tipo: "PUESTO", texto: "NUCLEO N-A-003", codigoPuesto: "NUCLEO N-A-003" },
  { fila: 6, columna: 7, tipo: "PUESTO", texto: "NUCLEO N-A-08", codigoPuesto: "NUCLEO N-A-08" },
  { fila: 4, columna: 7, tipo: "PUESTO", texto: "N-A-04", codigoPuesto: "N-A-04" },
  { fila: 3, columna: 7, tipo: "DELIMITACION", texto: "CUARTO DE ALTA TENSIÓN", colorZona: "azul" },
  { fila: 1, columna: 6, tipo: "VACIO" },
  { fila: 0, columna: 6, tipo: "VACIO" },
  { fila: 1, columna: 7, tipo: "PUESTO", texto: "NUCLEO N-A-0", codigoPuesto: "NUCLEO N-A-0" },
  { fila: 1, columna: 8, tipo: "PUESTO", texto: "NUCLEO N-A-001", codigoPuesto: "NUCLEO N-A-001" },
  { fila: 0, columna: 8, tipo: "PUESTO", texto: "NUCLEO N-A-002", codigoPuesto: "NUCLEO N-A-002" },
  { fila: 0, columna: 4, tipo: "PUESTO", texto: "BODEGA N-A-01", rowSpan: 2, colSpan: 2, colorZona: "rosado", codigoPuesto: "BODEGA N-A-01" },
];

// ── 3. Parser Ligero de Tuplas MySQL para Leer Directamente el Dump SQL ──────

function parseMySQLValues(valsStr: string): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  let i = 0;
  const n = valsStr.length;

  while (i < n) {
    while (i < n && valsStr[i] !== "(") i++;
    if (i >= n) break;
    i++; // saltar '('
    const row: (string | number | null)[] = [];

    while (i < n && valsStr[i] !== ")") {
      while (i < n && " \t\r\n,".includes(valsStr[i])) i++;
      if (i >= n || valsStr[i] === ")") break;

      if (valsStr[i] === "'") {
        i++;
        let s = "";
        while (i < n) {
          if (valsStr[i] === "\\") {
            i++;
            if (i < n) {
              const c = valsStr[i];
              if (c === "n") s += "\n";
              else if (c === "r") s += "\r";
              else if (c === "t") s += "\t";
              else if (c === "0") s += "\0";
              else s += c;
              i++;
            }
          } else if (valsStr[i] === "'") {
            if (i + 1 < n && valsStr[i + 1] === "'") {
              s += "'";
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            s += valsStr[i];
            i++;
          }
        }
        row.push(s);
      } else {
        const start = i;
        while (i < n && valsStr[i] !== "," && valsStr[i] !== ")") i++;
        const token = valsStr.slice(start, i).trim();
        if (token.toUpperCase() === "NULL") row.push(null);
        else if (token.includes(".")) row.push( Number(token) );
        else row.push(parseInt(token, 10));
      }
    }
    if (i < n && valsStr[i] === ")") i++;
    rows.push(row);
  }
  return rows;
}

function localizarArchivoDumpSQL(): string | null {
  const posiblesRutas = [
    path.resolve(process.cwd(), "prisma", "seed-data.sql"),
    path.resolve(process.cwd(), "prisma", "viejo_2.sql"),
    path.resolve(process.cwd(), "prisma", "viejo.sql"),
    path.resolve(process.cwd(), "viejo_2.sql"),
    path.resolve(process.cwd(), "viejo.sql"),
  ];
  for (const ruta of posiblesRutas) {
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

function normalizarCodigoPuestoSeed(
  codigoRaw: string,
  naveId: string,
  actividadComerciante?: string
): string {
  let cod = (codigoRaw || "").trim();

  // Regla 2 Exclusiva AMBULANTES: "NULL", vacío o "S/N" -> "0"
  if (naveId === "ambulantes") {
    const u = cod.toUpperCase();
    if (!u || u === "NULL" || u === "S/N" || u === "SN" || u === "-") {
      return "0";
    }
    return cod;
  }

  // Regla NAVE C: vacantes de 2 dígitos ('77', '98', '99') -> 3 dígitos ('077', '098', '099') para coincidir con el croquis
  if (naveId === "nave-c" && /^\d{1,2}$/.test(cod)) {
    cod = cod.padStart(3, "0");
  }

  // Regla 1 Exclusiva NAVE P: limpiar etiquetas descriptivas antiguas a su código N-P-XX
  if (naveId === "nave-p") {
    if (cod.toUpperCase().includes("N-P-119")) cod = "N-P-119";
    else if (cod.toUpperCase().includes("N-P-01")) cod = "N-P-01";
  }

  // Distinción automática -VEHICULO si la actividad contiene VEHICULO
  if (actividadComerciante) {
    cod = aplicarSufijoVehiculoPorActividad(cod, actividadComerciante);
  }

  return cod;
}

function generarPlanoVacio(filas: number, columnas: number): CeldaPlanoNave[] {
  const celdas: CeldaPlanoNave[] = [];
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < columnas; c++) {
      celdas.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
    }
  }
  return celdas;
}

async function main() {
  console.log("Iniciando sembrado maestro de base de datos EP-EMA...");

  // 0. Asegurar colación en español en MySQL (diferenciación estricta N vs Ñ)
  await asegurarColacionEspanolEnBD(true);

  // 1. Limpieza en orden de dependencias para garantizar idempotencia
  await prisma.coberturaNaveSupervisor.deleteMany({});
  await prisma.permisoSupervisor.deleteMany({});
  await prisma.reglaDiaNoLaborable.deleteMany({});
  await prisma.auditoriaRegistro.deleteMany({});
  await prisma.sesionControlSupervisor.deleteMany({});
  await prisma.registroAsistencia.deleteMany({});
  await prisma.puesto.deleteMany({});
  await prisma.planoNave.deleteMany({});
  await prisma.comerciante.deleteMany({});
  await prisma.nave.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log("Tablas limpiadas satisfactoriamente.");

  // 2. Crear SUPERADMIN con la credencial oficial de producción
  const passwordHash = await bcrypt.hash("Ravine.Snooze.Cover9.Defendant", 10);
  const superadmin = await prisma.usuario.create({
    data: {
      id: "u-super",
      cedula: "admin",
      nombres: "Administrador",
      apellidos: "Sistema",
      correo: "sistema.epema@gmail.com",
      rol: "SUPERADMIN",
      mustChangePassword: false,
      passwordHash,
      estado: "Habilitado",
      navesAsignadas: [],
    },
  });
  console.log(`Usuario SUPERADMIN creado: ${superadmin.nombres} (${superadmin.cedula})`);

  // 3. Verificar si existe archivo JSON de planos o el archivo SQL maestro
  const rutaJsonPlanos = path.resolve(process.cwd(), "prisma", "seed-planos.json");
  const mapaPlanosJson: Record<string, { filas: number; columnas: number; celdas: CeldaPlanoNave[] }> =
    fs.existsSync(rutaJsonPlanos)
      ? JSON.parse(fs.readFileSync(rutaJsonPlanos, "utf-8"))
      : {};

  const rutaDumpSQL = localizarArchivoDumpSQL();
  const tablasSQL: Record<string, (string | number | null)[][]> = {};

  if (rutaDumpSQL) {
    console.log(`Cargando datos maestros desde archivo SQL: ${path.basename(rutaDumpSQL)}...`);
    const sqlContent = fs.readFileSync(rutaDumpSQL, "utf-8");
    const regexInsert = /INSERT INTO `(\w+)`(?:\s*\([^)]+\))?\s*VALUES\s*([\s\S]*?);\r?\n/g;
    let match: RegExpExecArray | null;
    while ((match = regexInsert.exec(sqlContent)) !== null) {
      const table = match[1];
      const valuesBlock = match[2];
      if (!tablasSQL[table]) tablasSQL[table] = [];
      tablasSQL[table].push(...parseMySQLValues(valuesBlock));
    }
  }

  // Mapa de planos extraídos del SQL (si existe)
  const planosDesdeSQL = new Map<string, { filas: number; columnas: number; celdas: CeldaPlanoNave[] }>();
  if (tablasSQL["planos_naves"]) {
    for (const row of tablasSQL["planos_naves"]) {
      const naveId = String(row[1]);
      const filas = Number(row[2]) || 12;
      const columnas = Number(row[3]) || 12;
      const rawJson = String(row[4] || "[]");
      try {
        const celdas: CeldaPlanoNave[] = JSON.parse(rawJson);
        // Normalizar códigos en el croquis de NAVE P si provienen del dump antiguo
        if (naveId === "nave-p") {
          for (const celda of celdas) {
            if (celda.tipo === "PUESTO" && celda.codigoPuesto) {
              const norm = normalizarCodigoPuestoSeed(celda.codigoPuesto, "nave-p");
              celda.codigoPuesto = norm;
              celda.texto = norm;
            }
          }
        }
        planosDesdeSQL.set(naveId, { filas, columnas, celdas });
      } catch {
        // Ignorar JSON malformado
      }
    }
  }

  // 4. Crear las 27 Naves y sus 27 Planos Espaciales (Croquis)
  for (const naveDef of NAVES_MAESTRAS) {
    const planoSQL = planosDesdeSQL.get(naveDef.id) || mapaPlanosJson[naveDef.id];
    const filas = planoSQL ? planoSQL.filas : naveDef.filasPlano;
    const columnas = planoSQL ? planoSQL.columnas : naveDef.columnasPlano;
    const celdas: CeldaPlanoNave[] = planoSQL
      ? planoSQL.celdas
      : naveDef.id === "nave-a"
      ? PLANO_NAVE_A_REAL
      : generarPlanoVacio(filas, columnas);

    await prisma.nave.create({
      data: {
        id: naveDef.id,
        nombre: naveDef.nombre,
        cantidadPuestos: naveDef.cantidadPuestos,
        limitePuestos: naveDef.cantidadPuestos,
        supervisores: [],
        estadoRegistro: "Habilitado",
      },
    });

    await prisma.planoNave.create({
      data: {
        naveId: naveDef.id,
        filas,
        columnas,
        planoJson: celdas as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`27 Naves y 27 Planos Espaciales (croquis) registrados correctamente.`);

  // 5. Sembrar Comerciantes y Puestos (desde SQL si está disponible, o desde los croquis)
  if (tablasSQL["puestos"] && tablasSQL["comerciantes"]) {
    const comerciantesMap = new Map<string, (string | number | null)[]>();
    for (const cRow of tablasSQL["comerciantes"]) {
      comerciantesMap.set(String(cRow[0]), cRow);
    }

    const comerciantesBatch: Prisma.ComercianteCreateManyInput[] = [];
    const puestosBatch: Prisma.PuestoCreateManyInput[] = [];
    const comerciantesInsertados = new Set<string>();

    for (const pRow of tablasSQL["puestos"]) {
      const puestoId = String(pRow[0]);
      const codigoOriginal = String(pRow[1] ?? "");
      const naveId = String(pRow[2]);
      const estadoRaw = String(pRow[3]) as "Ocupado" | "Vacante";
      const comercianteId = pRow[4] ? String(pRow[4]) : null;

      // Omitir el puesto vacante huérfano '1' de NAVE G que desfasaba su croquis 29/29
      if (naveId === "nave-g" && codigoOriginal === "1" && !comercianteId) {
        continue;
      }

      const comRow = comercianteId ? comerciantesMap.get(comercianteId) : undefined;
      const actividadCom = comRow ? String(comRow[4] || "General") : undefined;
      const codigoNormalizado = normalizarCodigoPuestoSeed(codigoOriginal, naveId, actividadCom);

      if (comRow && comercianteId && !comerciantesInsertados.has(comercianteId)) {
        comerciantesInsertados.add(comercianteId);
        const ciuRaw = String(comRow[1] || "S/N").trim();
        comerciantesBatch.push({
          idInterno: comercianteId,
          ciu: !ciuRaw || ciuRaw === "-" ? "S/N" : ciuRaw,
          cedula: String(comRow[2] || ""),
          contribuyente: String(comRow[3] || "SIN NOMBRE"),
          actividad: actividadCom || "General",
          puestoId: codigoNormalizado,
          nave: String(comRow[6] || ""),
          estadoRegistro: (String(comRow[7]) === "Deshabilitado" ? "Deshabilitado" : "Habilitado"),
          creadoPor: comRow[8] ? String(comRow[8]) : "seed-maestro",
        });
      }

      puestosBatch.push({
        id: puestoId,
        codigo: codigoNormalizado,
        naveId,
        estado: comRow ? "Ocupado" : estadoRaw === "Ocupado" ? "Vacante" : estadoRaw,
        comercianteId: comRow ? comercianteId : null,
      });
    }

    if (comerciantesBatch.length > 0) {
      await prisma.comerciante.createMany({ data: comerciantesBatch });
    }
    if (puestosBatch.length > 0) {
      await prisma.puesto.createMany({ data: puestosBatch });
    }

    // Sincronizar capacidad real por nave tras normalización
    for (const naveDef of NAVES_MAESTRAS) {
      const totalReal = await prisma.puesto.count({ where: { naveId: naveDef.id } });
      if (totalReal > 0 && totalReal !== naveDef.cantidadPuestos) {
        await prisma.nave.update({
          where: { id: naveDef.id },
          data: { cantidadPuestos: totalReal, limitePuestos: totalReal },
        });
      }
    }

    console.log(
      `${comerciantesBatch.length} Comerciantes y ${puestosBatch.length} Puestos sembrados desde el respaldo SQL.`
    );
  } else {
    // Si no hay SQL adjunto, crear automáticamente todos los puestos físicos definidos en los croquis como 'Vacante'
    const todosPlanos = await prisma.planoNave.findMany();
    const puestosDesdeCroquis: Prisma.PuestoCreateManyInput[] = [];

    for (const pl of todosPlanos) {
      const celdas = (pl.planoJson as unknown as CeldaPlanoNave[]) || [];
      const vistos = new Set<string>();
      for (const c of celdas) {
        if (c.tipo === "PUESTO" && c.codigoPuesto) {
          const cod = c.codigoPuesto.trim();
          if (cod && !vistos.has(cod)) {
            vistos.add(cod);
            puestosDesdeCroquis.push({
              id: crypto.randomUUID(),
              codigo: cod,
              naveId: pl.naveId,
              estado: "Vacante",
              comercianteId: null,
            });
          }
        }
      }
    }

    if (puestosDesdeCroquis.length > 0) {
      await prisma.puesto.createMany({ data: puestosDesdeCroquis });
    }
    console.log(
      `${puestosDesdeCroquis.length} Puestos físicos inicializados desde los croquis de las naves.`
    );
  }

  // 6. Asegurar asistencia inicial del día en "Presente" para los puestos ocupados de hoy
  const fechaHoy = obtenerFechaHoyEcuador();
  const resAsistencia = await asegurarAsistenciaInicialDelDia(fechaHoy);
  console.log(
    `Asistencia inicial del día (${fechaHoy}) sembrada: ${resAsistencia.totalInicializados} registros en 'Presente'.`
  );

  console.log("Sembrado maestro finalizado exitosamente.");
}

main()
  .catch((e) => {
    console.error("Error durante el sembrado:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });