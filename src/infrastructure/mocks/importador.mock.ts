// ── Infraestructura: Mock del Importador XML/CSV/XLS/XLSX ───────────────────────

import * as XLSX from "xlsx";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import {
  getNaves,
  analizarReconciliacion,
  ejecutarReconciliacionImportacion,
} from "./mercado.mock";

// ── Datos de ejemplo para simular un archivo XML/CSV ─────────────────────────

export const XML_EJEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<Importacion>
  <Registro>
    <Nave>Nave A</Nave>
    <Contribuyente>Juan Pérez Morales</Contribuyente>
    <NumBodega>B-001</NumBodega>
    <Gen01Codi>GC-00001</Gen01Codi>
  </Registro>
  <Registro>
    <Nave>Nave A</Nave>
    <Contribuyente>María Torres Guzmán</Contribuyente>
    <NumBodega>B-002</NumBodega>
    <Gen01Codi>GC-00002</Gen01Codi>
  </Registro>
  <Registro>
    <Nave>Nave B</Nave>
    <Contribuyente>Carlos Medina Ruiz</Contribuyente>
    <NumBodega>B-003</NumBodega>
    <Gen01Codi>GC-00003</Gen01Codi>
  </Registro>
</Importacion>`;

export const CSV_EJEMPLO = `Nave,Contribuyente,NumBodega,Gen01Codi
Nave A,Juan Pérez Morales,B-001,GC-00001
Nave A,María Torres Guzmán,B-002,GC-00002
Nave B,Carlos Medina Ruiz,B-003,GC-00003
Nave C,Pedro Vargas López,B-004,GC-00004
Nave D,Ana Salcedo Vera,B-005,GC-00005`;

// ── Generación de registros de ejemplo ───────────────────────────────────────

const CONTRIBUYENTES_EJEMPLO = [
  "Juan Pérez Morales",
  "María Torres Guzmán",
  "Carlos Medina Ruiz",
  "Pedro Vargas López",
  "Ana Salcedo Vera",
  "Roberto Herrera Naranjo",
  "Lucía Flores Paredes",
  "Diego Cevallos Quishpe",
  "Verónica Chávez Bonilla",
  "Fernando Acosta Córdova",
  "Adriana Villacís Altamirano",
  "Gustavo Barrionuevo Velasteguí",
];

export function generarRegistrosEjemplo(cantidad: number = 10): ImportacionRegistro[] {
  const naves = getNaves();
  const registros: ImportacionRegistro[] = [];

  for (let i = 0; i < cantidad; i++) {
    const nave = naves[i % naves.length];
    const nombre = CONTRIBUYENTES_EJEMPLO[i % CONTRIBUYENTES_EJEMPLO.length];
    const puesto = `B-${String(i + 1).padStart(3, "0")}`;
    registros.push({
      ciu: "-",
      cedula: `18${String(10000000 + i).padStart(8, "0")}`,
      nombre,
      contribuyente: nombre,
      actividad: "General",
      nave: nave.nombre,
      puesto,
      numBodega: puesto,
      gen01Codi: `GC-${String(i + 1).padStart(5, "0")}`,
    });
  }

  return registros;
}

// ── Validadores Auxiliares del Parser Heurístico ────────────────────────────

function esSinNumero(strVal: string): boolean {
  const norm = strVal.toUpperCase().replace(/\s+/g, "");
  return (
    norm === "S/N" ||
    norm === "SN" ||
    norm === "S-N" ||
    norm === "S/N." ||
    norm === "SN."
  );
}

function normalizarYCedula(rawVal: unknown): string | null {
  if (rawVal === null || rawVal === undefined) return null;
  let str = String(rawVal).trim();
  if (!str) return null;

  // 1. Si hace match con /^\d{9}-\d$/ (ej. "180199329-4"), quítale el guion
  if (/^\d{9}-\d$/.test(str)) {
    str = str.replace("-", "");
  }

  // 2. Si tiene exactamente 9 dígitos puros (ej. "603115411"), antepón un "0"
  if (/^\d{9}$/.test(str)) {
    str = "0" + str;
  }

  // 3. Acepta como llave de comerciante cualquier celda que normalizada tenga 10 o 13 dígitos
  if (/^\d{10}(\d{3})?$/.test(str)) {
    return str;
  }

  return null;
}

function limpiarNombreNave(str: string): string {
  let limpio = str.replace(/"/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (limpio === "(NAVE)") {
    return "PUESTOS AMBULANTES";
  }
  // Colapsar palabra "NAVE" duplicada (ej. "NAVE NAVE ROPA" o "NAVE NAVE AUTO-")
  while (limpio.includes("NAVE NAVE")) {
    limpio = limpio.replace(/\bNAVE\s+NAVE\b/g, "NAVE");
  }
  // Quitar guiones y espacios sueltos al final (ej. "NAVE AUTO-" -> "NAVE AUTO")
  limpio = limpio.replace(/[-\s]+$/, "");
  return limpio;
}

function esFechaOBasura(rawVal: unknown, strVal: string): boolean {
  // "S/N" es un código de puesto legítimo ("Sin Número"), nunca es fecha ni basura
  if (esSinNumero(strVal)) return false;

  if (rawVal instanceof Date) return true;

  const upper = strVal.toUpperCase().trim();

  // 1. Filtro Anti-Basura: Palabras de control y metadatos
  const palabrasBasura = [
    "PAG",
    "PÁG",
    "PAGINA",
    "PÁGINA",
    "TOTAL",
    "NRO",
    "NRO.",
    "N°",
    "FECHA",
    "HORA",
    "REPORTE",
    "EMISION",
    "EMISIÓN",
    "IMPRESO",
    "SISTEMA",
    "SUBTOTAL",
  ];
  if (palabrasBasura.some((p) => upper.includes(p))) {
    return true;
  }

  // 2. Formato de fecha u hora: detección estricta (ej. barra '/' y dos puntos ':' juntos)
  if (strVal.includes("/") && strVal.includes(":")) {
    return true;
  }
  if (strVal.includes("-") && strVal.includes(":") && /\d/.test(strVal)) {
    return true;
  }

  // Expresión regular de fechas (dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd, dd.mm.aaaa)
  if (/\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/.test(strVal)) {
    return true;
  }
  if (/^\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(strVal)) {
    return true;
  }

  // Expresión regular de marcas de hora (hh:mm, hh:mm:ss, am/pm)
  if (/\b\d{1,2}:\d{2}(:\d{2})?\b/.test(strVal)) {
    return true;
  }
  if (/\b(am|pm)\b/i.test(strVal)) {
    return true;
  }

  // Combinaciones con barra '/' y dígitos de fecha (ej. 12/10)
  if (/\d{1,2}\/\d{1,2}/.test(strVal)) {
    return true;
  }

  // Horas residuales con ':' y dígitos
  if (strVal.includes(":") && /\d/.test(strVal)) {
    return true;
  }

  return false;
}

function esCodigoEstandarizado(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (
    upper.includes("BODEGA") ||
    upper.includes("CUBICULO") ||
    upper.includes("CUBÍCULO") ||
    upper.includes("NUCLEO") ||
    upper.includes("NÚCLEO")
  ) {
    return false;
  }
  return /^(N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(upper);
}

function seleccionarMejorPuesto(candidatos: string[]): string {
  if (candidatos.length === 0) return "-";
  if (candidatos.length === 1) return candidatos[0];

  // Si tienes dos candidatos a puesto (ej. "BODEGA N-E-001" en Puesto y "N-E-01" en Descripción,
  // o "ZCF-CUBICULO-15" y "ZCF-15", o "NUCLEO N-03B-D" y "N-D-02"),
  // prefiere siempre el código corto estandarizado (el que hace match con /^(N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+)$/i
  // sin las palabras "BODEGA", "CUBICULO" ni "NUCLEO").
  const estandarizado = candidatos.find((c) => esCodigoEstandarizado(c));
  if (estandarizado) {
    return estandarizado;
  }

  // Descartar candidatos con palabras técnicas si hay otros
  const sinTecnicas = candidatos.filter(
    (c) =>
      !c.includes("BODEGA") &&
      !c.includes("CUBICULO") &&
      !c.includes("CUBÍCULO") &&
      !c.includes("NUCLEO") &&
      !c.includes("NÚCLEO")
  );
  if (sinTecnicas.length > 0) {
    sinTecnicas.sort((a, b) => a.length - b.length);
    return sinTecnicas[0];
  }

  const ordenados = [...candidatos].sort((a, b) => a.length - b.length);
  return ordenados[0];
}

// ── Parser Heurístico Inteligente para Excel (.xls / .xlsx) ─────────────────

export function parsearExcel(data: ArrayBuffer | Uint8Array): ImportacionRegistro[] {
  const wb = XLSX.read(data, { type: "array" });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return [];
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const registros: ImportacionRegistro[] = [];
  let naveActual = "NO DEFINIDA";
  let actividadActual = "GENERAL";

  // Mapeo dinámico de columnas desde la cabecera
  let colNombre = -1;
  let colArticulo = -1;
  let colPuesto = -1;
  let colMts = -1;
  let colDescripcion = -1;

  // Lista ampliada de palabras ignoradas para actividadActual
  const palabrasCabecera = [
    "EMPRESA",
    "MUNICIPAL",
    "MERCADO",
    "MAYORISTA",
    "AMBATO",
    "LOCALES",
    "POR EL MES",
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
    "FUNCIONARIO",
    "RESPONSABLE",
    "CEDULA",
    "CÉDULA",
    "NOMBRES",
    "OCUPANTE",
    "ARTICULO",
    "ARTÍCULO",
    "PUESTO",
    "DESCRIPCION",
    "DESCRIPCIÓN",
    "MTR",
    "MTS",
    "PAG",
    "DE ",
    "EMITIDO",
    "RECIBIDO",
    "NRO",
    "REGISTROS",
  ];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    // Obtener celdas con contenido real estandarizadas
    const celdasValidas = row
      .map((c) => String(c ?? "").trim())
      .filter((s) => s.length > 0);

    if (celdasValidas.length === 0) continue;

    // 1. Detección y Normalización de Cédula (La Llave)
    let cedulaEncontrada = "";
    let cedulaIndex = -1;

    for (let i = 0; i < row.length; i++) {
      const norm = normalizarYCedula(row[i]);
      if (norm) {
        cedulaEncontrada = norm;
        cedulaIndex = i;
        break;
      }
    }

    if (!cedulaEncontrada) {
      // ── Fila de contexto (no es comerciante) ──
      const celdasUpper = celdasValidas.map((s) => s.toUpperCase());

      // A. Detección de fila de encabezados y mapeo de columnas
      const tieneCedulaHeader = celdasUpper.some(
        (s) => s.includes("CEDULA") || s.includes("CÉDULA")
      );
      const tieneNombreHeader = celdasUpper.some(
        (s) => s.includes("NOMBRES") || s.includes("OCUPANTE") || s.includes("NOMBRE")
      );

      if (tieneCedulaHeader && tieneNombreHeader) {
        for (let i = 0; i < row.length; i++) {
          const val = String(row[i] ?? "").trim().toUpperCase();
          if (!val) continue;
          if (val.includes("NOMBRES") || val.includes("OCUPANTE") || val.includes("NOMBRE")) {
            if (colNombre === -1) colNombre = i;
          } else if (val.includes("ARTICULO") || val.includes("ARTÍCULO")) {
            colArticulo = i;
          } else if (val.includes("PUESTO")) {
            colPuesto = i;
          } else if (val.includes("MTR") || val.includes("MTS")) {
            colMts = i;
          } else if (val.includes("DESCRIPCION") || val.includes("DESCRIPCIÓN")) {
            colDescripcion = i;
          }
        }
        continue;
      }

      // B. Detección y Limpieza del Nombre de la Nave:
      const cellNave = celdasUpper.find((s) => {
        if (!s.includes("NAVE") && !s.includes("(NAVE)")) return false;
        if (
          s.includes("EMPRESA") ||
          s.includes("MUNICIPAL") ||
          s.includes("MERCADO") ||
          s.includes("MAYORISTA")
        ) {
          return false;
        }
        return true;
      });

      if (cellNave) {
        naveActual = limpiarNombreNave(cellNave);
        continue;
      }

      // C. Subtítulo de Actividad
      const textosActividadCandidatos = celdasUpper.filter((s) => {
        if (!isNaN(Number(s)) || /^\d+([.,]\d+)?$/.test(s)) return false;
        if (/^\d{4}$/.test(s) || /\/20\d{2}/.test(s) || /20\d{2}/.test(s)) return false;
        if (esFechaOBasura(null, s)) return false;
        if (palabrasCabecera.some((p) => s.includes(p))) return false;
        if (s.includes("NAVE")) return false;
        return s.length > 1;
      });

      if (textosActividadCandidatos.length > 0) {
        textosActividadCandidatos.sort((a, b) => b.length - a.length);
        actividadActual = textosActividadCandidatos[0]
          .replace(/"/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();
        continue;
      }

      continue;
    }

    // ── Fila del Comerciante: Extracción Quirúrgica ──

    // 1. Extracción del Nombre
    let nombre = "";
    let nombreIndex = -1;

    if (colNombre !== -1 && row[colNombre]) {
      const candidate = String(row[colNombre] ?? "").trim();
      if (
        candidate &&
        !esFechaOBasura(row[colNombre], candidate) &&
        !/^\d+(\.\d+)?$/.test(candidate) &&
        !/^(N-[A-Z0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(candidate)
      ) {
        nombre = candidate.toUpperCase().replace(/\s+/g, " ");
        nombreIndex = colNombre;
      }
    }

    if (!nombre) {
      const startSearch = Math.max(cedulaIndex + 1, 3);
      const endSearch = Math.min(row.length, Math.max(startSearch + 4, 7));

      let mejorCandidate = "";
      let mejorIdx = -1;

      for (let c = startSearch; c < endSearch; c++) {
        const val = row[c];
        if (val === null || val === undefined) continue;
        const strVal = String(val).trim();
        if (!strVal) continue;
        if (esFechaOBasura(val, strVal)) continue;
        if (/^\d+(\.\d+)?$/.test(strVal)) continue;
        if (/^(N-[A-Z0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(strVal)) continue;
        if (strVal.toUpperCase().startsWith("BODEGA")) continue;
        if (strVal.toUpperCase().startsWith("CUBICULO")) continue;
        if (strVal.toUpperCase().startsWith("NUCLEO")) continue;

        if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(strVal) && strVal.length > mejorCandidate.length) {
          mejorCandidate = strVal;
          mejorIdx = c;
        }
      }

      if (!mejorCandidate) {
        for (let c = cedulaIndex + 1; c < Math.min(row.length, cedulaIndex + 6); c++) {
          const val = row[c];
          if (val === null || val === undefined) continue;
          const strVal = String(val).trim();
          if (!strVal) continue;
          if (esFechaOBasura(val, strVal)) continue;
          if (/^\d+(\.\d+)?$/.test(strVal)) continue;
          if (/^(N-[A-Z0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(strVal)) continue;
          if (strVal.toUpperCase().startsWith("BODEGA")) continue;
          if (strVal.toUpperCase().startsWith("CUBICULO")) continue;
          if (strVal.toUpperCase().startsWith("NUCLEO")) continue;

          if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(strVal) && strVal.length > mejorCandidate.length) {
            mejorCandidate = strVal;
            mejorIdx = c;
          }
        }
      }

      if (mejorCandidate) {
        nombre = mejorCandidate.toUpperCase().replace(/\s+/g, " ");
        nombreIndex = mejorIdx;
      }
    }

    if (!nombre) {
      nombre = "SIN NOMBRE";
      nombreIndex = cedulaIndex;
    }

    // 2. Extracción de Actividad vs Puesto/Descripción
    let actividadFila = "";
    const candidatosPuesto: {
      col: number;
      val: string;
      esNumero: boolean;
      prioridad: number;
    }[] = [];

    for (let c = nombreIndex + 1; c < row.length; c++) {
      if (c === cedulaIndex) continue;

      const rawVal = row[c];
      if (rawVal === null || rawVal === undefined) continue;

      let strVal = String(rawVal).trim();
      if (!strVal) continue;

      // Limpieza inteligente ANTES de pasar por esFechaOBasura:
      // Si una celda empieza con un código de bodega seguido de una nota o asterisco
      // (ej. "N-H-01 COBRO DE VALOR PENDIENTE DIC/2018" o "N-D-01*AGOSTO"),
      // extrae únicamente el código inicial antes del espacio o asterisco ("N-H-01", "N-D-01").
      const bodegaMatch = strVal.match(/^(N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+)(?:[\s*].*)?$/i);
      if (bodegaMatch) {
        strVal = bodegaMatch[1].toUpperCase();
      }

      // Quitar sufijo ".0" (ej. "1.0", "13.0" -> "1", "13")
      if (/^\d+\.0$/.test(strVal)) {
        strVal = strVal.replace(/\.0$/, "");
      }

      // Descartar fechas y basura
      if (!esSinNumero(strVal) && esFechaOBasura(rawVal, strVal)) {
        continue;
      }

      const upper = strVal.toUpperCase();

      // Descarte explícito de Metros por unidad
      if (/\b(mts?|m2|metros)\b/i.test(upper)) {
        continue;
      }

      // Descarte de columna Metros identificada por cabecera
      if (colMts !== -1 && c === colMts) {
        continue;
      }

      // Caso 1 (Formato Puestos - ren04278):
      // Zona central (columnas 12 a 15, columna Artículo) con texto descriptivo
      const esZonaArticulo = (colArticulo !== -1 && Math.abs(c - colArticulo) <= 2) || (c >= 12 && c <= 15);
      if (
        esZonaArticulo &&
        !actividadFila &&
        !esSinNumero(upper) &&
        !/^\d+(\.\d+)?$/.test(upper) &&
        !/^(N-[A-Z0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(upper) &&
        !upper.startsWith("BODEGA") &&
        !upper.startsWith("CUBICULO") &&
        !upper.startsWith("NUCLEO") &&
        /[A-Z]/.test(upper) &&
        upper.length >= 3
      ) {
        actividadFila = upper;
        actividadActual = upper;
        continue;
      }

      const esNum = !esSinNumero(upper) && /^\d+(\.\d+)?$/.test(upper);
      const esColDescripcion = colDescripcion !== -1 && Math.abs(c - colDescripcion) <= 1;
      const esColPuesto = colPuesto !== -1 && Math.abs(c - colPuesto) <= 1;

      candidatosPuesto.push({
        col: c,
        val: upper,
        esNumero: esNum,
        prioridad: esColDescripcion ? 2 : esColPuesto ? 1 : 0,
      });
    }

    // 3. Descarte de la columna Mts/MTR por posición:
    const candidatosFiltrados: string[] = [];

    if (candidatosPuesto.length === 1) {
      // NUNCA descartes el primer número corto si es el único candidato a Puesto
      candidatosFiltrados.push(candidatosPuesto[0].val);
    } else if (candidatosPuesto.length > 1) {
      const tieneNoNumericos = candidatosPuesto.some((c) => !c.esNumero);
      if (tieneNoNumericos) {
        // En Bodegas (col 10 Puesto, col 15 Metros, col 16 Descripción):
        // Se descartan los valores puramente numéricos de Metros y se conservan los códigos de puesto.
        // Si hay un candidato de la columna de Descripción, se prioriza.
        const noNumericos = candidatosPuesto.filter((c) => !c.esNumero);
        noNumericos.sort((a, b) => b.prioridad - a.prioridad);
        for (const cand of noNumericos) {
          candidatosFiltrados.push(cand.val);
        }
      } else {
        // Todos numéricos (ej. puesto "13" y metros "4"):
        // La columna de Metros siempre está ubicada a la derecha del Puesto.
        // Descartar el último número y tomar el anterior.
        candidatosPuesto.sort((a, b) => a.col - b.col);
        candidatosFiltrados.push(candidatosPuesto[0].val);
      }
    }

    let puesto = seleccionarMejorPuesto(candidatosFiltrados);
    if (!puesto || puesto.trim() === "") {
      puesto = "-";
    }

    // Caso 2 (Formato Bodegas - REN04_950):
    // La zona de ARTICULO viene vacía, por lo que la actividad se toma de actividadActual
    const actividad = actividadFila || actividadActual || "GENERAL";

    registros.push({
      ciu: "-",
      cedula: cedulaEncontrada.trim(),
      nombre,
      contribuyente: nombre,
      actividad,
      nave: naveActual,
      puesto,
      numBodega: puesto,
      gen01Codi: "-",
    });
  }

  return registros;
}

// ── Persistencia real / simulación de importación ───────────────────────────

export function simularImportacion(
  registros: ImportacionRegistro[]
): ImportacionResultado {
  const errores: { fila: number; mensaje: string }[] = [];
  let exitosos = 0;

  for (let i = 0; i < registros.length; i++) {
    const reg = registros[i];

    // Validar nombre / contribuyente
    const nombre = (reg.nombre || reg.contribuyente || "").trim();
    if (!nombre || nombre.toUpperCase() === "SIN NOMBRE") {
      errores.push({
        fila: i + 1,
        mensaje: "El campo Nombre / Contribuyente es obligatorio.",
      });
      continue;
    }

    // Validar cédula
    if (!reg.cedula || reg.cedula === "-") {
      errores.push({
        fila: i + 1,
        mensaje: "Cédula inválida o vacía.",
      });
      continue;
    }

    exitosos++;
  }

  const reconciliacion = exitosos > 0 ? analizarReconciliacion(registros) : undefined;
  return { exitosos, errores, reconciliacion };
}

export function guardarImportacion(
  registros: ImportacionRegistro[]
): ImportacionResultado {
  return ejecutarReconciliacionImportacion(registros);
}

// ── Parseo de XML y CSV ─────────────────────────────────────────────────────

export function parsearXML(contenido: string): ImportacionRegistro[] {
  const registros: ImportacionRegistro[] = [];
  const regex =
    /<Registro>[\s\S]*?<Nave>([\s\S]*?)<\/Nave>[\s\S]*?<Contribuyente>([\s\S]*?)<\/Contribuyente>[\s\S]*?<NumBodega>([\s\S]*?)<\/NumBodega>[\s\S]*?<Gen01Codi>([\s\S]*?)<\/Gen01Codi>[\s\S]*?<\/Registro>/g;

  let match;
  let i = 1;
  while ((match = regex.exec(contenido)) !== null) {
    const nombre = match[2].trim();
    const puesto = match[3].trim();
    registros.push({
      ciu: "-",
      cedula: `18${String(10000000 + i).padStart(8, "0")}`,
      nombre,
      contribuyente: nombre,
      actividad: "General",
      nave: match[1].trim(),
      puesto,
      numBodega: puesto,
      gen01Codi: match[4].trim(),
    });
    i++;
  }

  return registros;
}

export function parsearCSV(contenido: string): ImportacionRegistro[] {
  const lineas = contenido.trim().split("\n");
  if (lineas.length < 2) return [];

  return lineas.slice(1).map((linea, idx) => {
    const [nave, contribuyente, numBodega, gen01Codi] = linea
      .split(",")
      .map((s) => s.trim());
    const nombre = contribuyente ?? "Comerciante";
    const puesto = numBodega ?? "-";
    return {
      ciu: "-",
      cedula: `18${String(10000000 + idx).padStart(8, "0")}`,
      nombre,
      contribuyente: nombre,
      actividad: "General",
      nave: nave ?? "No definida",
      puesto,
      numBodega: puesto,
      gen01Codi: gen01Codi ?? "-",
    };
  });
}
