// ── Infraestructura: Parser de Archivos Catastrales (Excel / CSV / XML) ────────
// Módulo puro e independiente para lectura heurística de archivos institucionales

import * as XLSX from "xlsx";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import {
  generarSlugNave,
  desglosarCodigosPuestoMultiples,
  expandirRegistrosMultiPuesto,
  expandPuestosHeuristic,
  simplificarCodigoPuesto,
} from "../database/catastro-reconciliacion.service";

export {
  generarSlugNave,
  desglosarCodigosPuestoMultiples,
  expandirRegistrosMultiPuesto,
  expandPuestosHeuristic,
  simplificarCodigoPuesto,
};

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

const NAVES_DEFAULT = [
  "NAVE A",
  "NAVE B",
  "NAVE C",
  "NAVE D",
  "NAVE E",
  "NAVE F",
  "NAVE G",
  "NAVE H",
];

export function generarRegistrosEjemplo(cantidad: number = 10): ImportacionRegistro[] {
  const registros: ImportacionRegistro[] = [];

  for (let i = 0; i < cantidad; i++) {
    const nave = NAVES_DEFAULT[i % NAVES_DEFAULT.length];
    const nombre = CONTRIBUYENTES_EJEMPLO[i % CONTRIBUYENTES_EJEMPLO.length];
    const puesto = `B-${String(i + 1).padStart(3, "0")}`;
    registros.push({
      ciu: "-",
      cedula: `18${String(10000000 + i).padStart(8, "0")}`,
      nombre,
      contribuyente: nombre,
      actividad: "General",
      nave,
      puesto,
      numBodega: puesto,
      gen01Codi: `GC-${String(i + 1).padStart(5, "0")}`,
    });
  }

  return registros;
}

// ── Validadores Auxiliares del Parser Heurístico ────────────────────────────

export function esSinNumero(strVal: string): boolean {
  const norm = strVal.toUpperCase().replace(/\s+/g, "");
  return (
    norm === "S/N" ||
    norm === "SN" ||
    norm === "S-N" ||
    norm === "S/N." ||
    norm === "SN."
  );
}

export function normalizeCedulaRuc(rawVal: unknown): string | null {
  if (rawVal === null || rawVal === undefined) return null;
  let str = String(rawVal).trim();
  if (!str) return null;

  // 1. Elimina sufijos decimales .0 generados por Excel (1802686715.0 -> 1802686715)
  str = str.replace(/\.0+$/, "");

  // 2. Quita guiones intermedios (180199329-4 -> 1801993294)
  str = str.replace(/-/g, "");

  // 3. Si quedan 9 dígitos numéricos (603115411 de provincias 01-09), antepone '0' -> 10 dígitos (0603115411)
  if (/^\d{9}$/.test(str)) {
    str = "0" + str;
  }

  // 4. Si quedan 12 dígitos numéricos (RUC de provincias 01-09 sin cero inicial, ej. 202491791001), antepone '0' -> 13 dígitos
  if (/^\d{12}$/.test(str)) {
    str = "0" + str;
  }

  // 5. Valida 10 dígitos (cédula) o 13 dígitos (RUC)
  if (/^\d{10}(\d{3})?$/.test(str)) {
    return str;
  }

  return null;
}

export const normalizarYCedula = normalizeCedulaRuc;

export function normalizeNave(rawHeaderNave: unknown, fileName?: string): string {
  let str = String(rawHeaderNave ?? "").normalize("NFC").replace(/"/g, "").replace(/\s+/g, " ").trim().toUpperCase();

  while (/(?:^|[^A-ZÑ0-9])NAVE\s+NAVE(?=$|[^A-ZÑ0-9])/i.test(str)) {
    str = str.replace(/(?:^|[^A-ZÑ0-9])NAVE\s+NAVE(?=$|[^A-ZÑ0-9])/gi, "NAVE");
  }
  str = str.replace(/[-\s]+$/, "").trim();

  if (!str || str === "(NAVE)" || str === "NO DEFINIDA" || str === "NO IDENTIFICADA") {
    if (fileName) {
      const fnUpper = fileName.normalize("NFC").toUpperCase();
      if (fnUpper.includes("AMBULANTES")) return "PUESTOS AMBULANTES";
      if (fnUpper.includes("AUTO LUJOS") || fnUpper.includes("AUTOLUJOS")) return "NAVE AUTO LUJOS";
      if (fnUpper.includes("ROPA")) return "NAVE ROPA";
      if (fnUpper.includes("FLORES")) return "NAVE FLORES";
      if (fnUpper.includes("CF")) return "NAVE CF";
      const m = fnUpper.match(/(?:^|[^A-ZÑ0-9])NAVE[_\s"-]*([A-ZÑ0-9]+)(?=$|[^A-ZÑ0-9])/i);
      if (m && m[1]) return `NAVE ${m[1]}`;
    }
    return str === "(NAVE)" ? "PUESTOS AMBULANTES" : "NO DEFINIDA";
  }

  return str;
}

export const limpiarNombreNave = normalizeNave;

export function esFechaOBasura(rawVal: unknown, strVal: string): boolean {
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

export function esCodigoEstandarizado(code: string): boolean {
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
  return /^(N-(?:[A-ZÑ0-9]+-[A-Z0-9-]+|[A-Z0-9]+-[A-ZÑ])|ZCF-[A-Z0-9-]+)$/i.test(upper);
}

export function seleccionarMejorPuesto(candidatos: string[]): string {
  if (candidatos.length === 0) return "-";
  if (candidatos.length === 1) return candidatos[0];

  // Si algún candidato empieza por "BODEGA ", "CUBICULO " o "NUCLEO ", consérvalo íntegro sin recortarlo ni descartarlo
  const conPrefijoCompleto = candidatos.find(
    (c) =>
      c.toUpperCase().startsWith("BODEGA ") ||
      c.toUpperCase().startsWith("CUBICULO ") ||
      c.toUpperCase().startsWith("CUBÍCULO ") ||
      c.toUpperCase().startsWith("NUCLEO ") ||
      c.toUpperCase().startsWith("NÚCLEO ")
  );
  if (conPrefijoCompleto) {
    return conPrefijoCompleto;
  }

  const estandarizado = candidatos.find((c) => esCodigoEstandarizado(c));
  if (estandarizado) {
    return estandarizado;
  }

  const ordenados = [...candidatos].sort((a, b) => a.length - b.length);
  return ordenados[0];
}

export function inferirNaveDesdePuesto(codigoPuesto: string): string | null {
  if (!codigoPuesto) return null;
  const upper = codigoPuesto.normalize("NFC").trim().toUpperCase();
  if (upper.startsWith("ZCF-") || upper.includes("ZCF-")) {
    return "NAVE CF";
  }

  // 1. Caso N-[Stall]-[Nave] (ej. N-02A-H, N-01-A, N-01-Ñ) donde la nave es letra al final y el puesto empieza por dígito
  const matchNaveFin =
    upper.match(/^N-([0-9]+[A-Z0-9]*)-([A-ZÑ])(?:[\s*].*)?$/i) ||
    upper.match(/(?:^|[^A-ZÑ0-9])N-([0-9]+[A-Z0-9]*)-([A-ZÑ])(?=$|[^A-ZÑ0-9])/i);
  if (matchNaveFin) {
    return `NAVE ${matchNaveFin[2].toUpperCase()}`;
  }

  // 2. Caso N-[Nave]-[Stall] (ej. N-H-01, N-A-01, N-Ñ-01, N-E-04, N-CF-01)
  const matchNaveIni =
    upper.match(/^N-([A-ZÑ]+)-([A-Z0-9-]+)(?:[\s*].*)?$/i) ||
    upper.match(/(?:^|[^A-ZÑ0-9])N-([A-ZÑ]+)-([A-Z0-9-]+)(?=$|[^A-ZÑ0-9])/i);
  if (matchNaveIni) {
    return `NAVE ${matchNaveIni[1].toUpperCase()}`;
  }

  const matchNave = upper.match(/(?:^|[^A-ZÑ0-9])NAVE[_\s"-]*([A-ZÑ0-9]+)(?=$|[^A-ZÑ0-9])/i);
  if (matchNave && matchNave[1]) {
    return `NAVE ${matchNave[1].toUpperCase()}`;
  }
  return null;
}

// ── Parser Heurístico Inteligente para Excel (.xls / .xlsx) ─────────────────

export function parsearExcel(
  data: ArrayBuffer | Uint8Array,
  fileName?: string
): ImportacionRegistro[] {
  const wb = XLSX.read(data, { type: "array" });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return [];
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // 1. Lectura de la matriz desde SheetJS con valores crudos para preservar coordenadas exactas
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (!rows || rows.length === 0) return [];

  const sheetNameUpper = (wb.SheetNames[0] || "").toUpperCase();

  // ── Etapa 1: Detección automática de plantilla (BODEGA vs PUESTOS) e Inferencia de Nave ──
  const primerasFilas = rows.slice(0, 8);
  let templateType: "BODEGA" | "PUESTOS" | "GENERICO" = "GENERICO";
  let rawNaveHeader = "";

  // Detección BODEGA (REN04_950) vs PUESTOS (ren04278)
  const esHojaBodega = sheetNameUpper.includes("950") || (fileName ? fileName.toUpperCase().includes("950") : false);
  const esHojaPuestos = sheetNameUpper.includes("278") || (fileName ? fileName.toUpperCase().includes("278") : false);

  const tieneTituloLocales = primerasFilas.some(
    (r) =>
      Array.isArray(r) &&
      r.some((c) => String(c ?? "").toUpperCase().includes("LOCALES MERCADO MAYORISTA"))
  );

  const filaCedulaCol1 = primerasFilas.find(
    (r) =>
      Array.isArray(r) &&
      r[1] !== null &&
      r[1] !== undefined &&
      /CEDULA|CÉDULA/i.test(String(r[1]))
  );

  const filaCedulaCol0 = primerasFilas.find(
    (r) =>
      Array.isArray(r) &&
      r[0] !== null &&
      r[0] !== undefined &&
      /CEDULA|CÉDULA/i.test(String(r[0]))
  );

  const tieneHeaderPuestos = primerasFilas.some(
    (r) =>
      Array.isArray(r) &&
      r.some((c) => /OCUPANTE/i.test(String(c ?? ""))) &&
      r.some((c) => /MTR/i.test(String(c ?? "")))
  );

  if (esHojaBodega || tieneTituloLocales || (filaCedulaCol0 && !filaCedulaCol1 && !esHojaPuestos && !tieneHeaderPuestos)) {
    templateType = "BODEGA";
    // Extrae el texto de la nave de row[10] o de cualquier celda de las primeras 5 filas con "NAVE"
    for (let rIdx = 0; rIdx < Math.min(5, rows.length); rIdx++) {
      const row = rows[rIdx];
      if (!Array.isArray(row)) continue;
      if (row[10] && String(row[10]).toUpperCase().includes("NAVE")) {
        rawNaveHeader = String(row[10]);
        break;
      }
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const val = String(row[cIdx] ?? "").trim();
        const upper = val.toUpperCase();
        if (
          upper.includes("NAVE") &&
          !upper.includes("EMPRESA") &&
          !upper.includes("MUNICIPAL") &&
          !upper.includes("MERCADO") &&
          !upper.includes("MAYORISTA")
        ) {
          rawNaveHeader = val;
          break;
        }
      }
      if (rawNaveHeader) break;
    }
  } else if (esHojaPuestos || filaCedulaCol1 || tieneHeaderPuestos) {
    templateType = "PUESTOS";
    // Extrae el texto de la nave de la fila 3 columna 12 (row[12]) o celda con "NAVE" en primeras 5 filas
    if (rows[3] && Array.isArray(rows[3]) && rows[3][12]) {
      rawNaveHeader = String(rows[3][12]);
    }
    if (!rawNaveHeader) {
      for (let rIdx = 0; rIdx < Math.min(5, rows.length); rIdx++) {
        const row = rows[rIdx];
        if (!Array.isArray(row)) continue;
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const val = String(row[cIdx] ?? "").trim();
          const upper = val.toUpperCase();
          if (
            (upper.includes("NAVE") || upper === "(NAVE)") &&
            !upper.includes("EMPRESA") &&
            !upper.includes("MUNICIPAL") &&
            !upper.includes("MERCADO") &&
            !upper.includes("MAYORISTA")
          ) {
            rawNaveHeader = val;
            break;
          }
        }
        if (rawNaveHeader) break;
      }
    }
  }

  let naveDetectada = normalizeNave(rawNaveHeader, fileName);
  const registros: ImportacionRegistro[] = [];

  if (templateType === "BODEGA") {
    // ── LECTURA EXACTA PLANTILLA BODEGA (REN04_950) ──
    // Coordenadas: col 0 = CEDULA, col 3 = NOMBRES, col 8 = ARTICULO (arrastre vertical), col 10 = PUESTO, col 15 = Mts, col 16 = DESCRIPCION
    let currentArticulo = "BODEGAS / LOCALES";

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawCedula = row[0];
      const cedulaNorm = normalizeCedulaRuc(rawCedula);

      // Si la fila no tiene cédula, podría ser subtítulo de artículo en col 8
      if (!cedulaNorm) {
        if (row[8] !== null && row[8] !== undefined) {
          const artCandidate = String(row[8]).trim();
          if (
            artCandidate &&
            !esFechaOBasura(row[8], artCandidate) &&
            !/^\d+(\.\d+)?$/.test(artCandidate) &&
            !artCandidate.toUpperCase().includes("ARTICULO") &&
            !artCandidate.toUpperCase().includes("EMPRESA") &&
            !artCandidate.toUpperCase().includes("MERCADO")
          ) {
            currentArticulo = artCandidate.toUpperCase();
          }
        }
        continue;
      }

      // Nombres en col 3
      const rawNombre = row[3] !== null && row[3] !== undefined ? String(row[3]).trim() : "";
      const nombreNorm = rawNombre ? rawNombre.toUpperCase().replace(/\s+/g, " ") : "SIN NOMBRE";

      // Puesto y Descripción
      let rawPuesto = row[10] !== null && row[10] !== undefined ? String(row[10]).trim() : "";
      let rawDesc = row[16] !== null && row[16] !== undefined ? String(row[16]).trim() : "";

      // Limpiar sufijos *AGOSTO (/\*[A-Z]+$/i) y glosas COBRO DE VALOR... (/\s+COBRO DE VALOR.*$/i)
      rawPuesto = rawPuesto.replace(/\*[A-Z]+$/i, "").replace(/\s+COBRO DE VALOR.*$/i, "").trim();
      rawDesc = rawDesc.replace(/\*[A-Z]+$/i, "").replace(/\s+COBRO DE VALOR.*$/i, "").trim();

      let puestoFinal = "";
      let actividadFila = currentArticulo;

      const esEstructuralDesc = /^(?:N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(rawDesc);
      const iniciaPrefijoEstructural =
        /^(?:BODEGA|CUBICULO|CUBÍCULO|NUCLEO|NÚCLEO|NUCLEOS|COCINA|LOCAL|N-|ZCF-)/i.test(rawPuesto);

      // Regla B (Prioridad semántica): Si en PUESTO escribieron el giro o empresa
      // (ej. "MOROCHO", "PAN" en Bodega Nave N; "CHOCHOS", "PLASTICOS" en Nave K)
      // y en DESCRIPCION está el código estructural, tomar DESCRIPCION como código de puesto y rawPuesto como actividad.
      if (!iniciaPrefijoEstructural && rawPuesto && esEstructuralDesc) {
        puestoFinal = rawDesc.toUpperCase();
        actividadFila = rawPuesto.toUpperCase();
      } else if (!rawPuesto && rawDesc) {
        // Regla A (Fallback por celda vacía): Si col 10 está vacío y col 16 tiene valor
        puestoFinal = rawDesc.toUpperCase();
      } else {
        puestoFinal = rawPuesto.toUpperCase() || rawDesc.toUpperCase() || "-";
      }

      // Truncar .0
      if (/^\d+\.0$/.test(puestoFinal)) {
        puestoFinal = puestoFinal.replace(/\.0$/, "");
      }

      // CIU en col 2 si existiera
      let ciu = "S/N";
      if (row[2] !== null && row[2] !== undefined) {
        const cVal = String(row[2]).trim();
        if (/^\d{3,8}$/.test(cVal)) ciu = cVal;
      }

      // Inferencia de nave desde puesto si aún no se definió
      if (!naveDetectada || naveDetectada === "NO DEFINIDA") {
        const inf = inferirNaveDesdePuesto(puestoFinal);
        if (inf) naveDetectada = inf;
      }

      // Etapa 4: Separación vs Preservación de puestos múltiples
      const puestosDesglosados = expandPuestosHeuristic(puestoFinal);
      for (const p of puestosDesglosados) {
        registros.push({
          ciu,
          cedula: cedulaNorm,
          nombre: nombreNorm,
          contribuyente: nombreNorm,
          actividad: actividadFila,
          nave: naveDetectada,
          puesto: p,
          numBodega: p,
          gen01Codi: "-",
        });
      }
    }
  } else if (templateType === "PUESTOS") {
    // ── LECTURA EXACTA PLANTILLA PUESTOS (ren04278) ──
    // Coordenadas con desfase izquierdo: col 0 = Cédula, col 5 = OCUPANTE, col 13 = Artículo, col 19 = Puesto, col 24 = MTR, col 27/28 = Descripción
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      // Buscar cédula en col 0 o col 1
      let cedulaNorm = normalizeCedulaRuc(row[0]);
      let colOffset = 0;
      if (!cedulaNorm && row[1]) {
        cedulaNorm = normalizeCedulaRuc(row[1]);
        if (cedulaNorm) colOffset = 1;
      }

      if (!cedulaNorm) continue;

      // OCUPANTE en col 5 + colOffset
      const rawNombre =
        row[5 + colOffset] !== null && row[5 + colOffset] !== undefined
          ? String(row[5 + colOffset]).trim()
          : "";
      const nombreNorm = rawNombre ? rawNombre.toUpperCase().replace(/\s+/g, " ") : "SIN NOMBRE";

      // Artículo en col 13 + colOffset
      const rawArt =
        row[13 + colOffset] !== null && row[13 + colOffset] !== undefined
          ? String(row[13 + colOffset]).trim()
          : "";
      const actividadFila = rawArt ? rawArt.toUpperCase() : "GENERAL";

      // Puesto en col 19 + colOffset
      let rawPuesto =
        row[19 + colOffset] !== null && row[19 + colOffset] !== undefined
          ? String(row[19 + colOffset]).trim()
          : "";

      // Si col 19 está vacío, asignar "S/N" sin tomar jamás MTR (col 24) como puesto
      if (!rawPuesto || rawPuesto === "-" || esSinNumero(rawPuesto)) {
        rawPuesto = "S/N";
      } else {
        // Truncar .0 en puestos enteros (ej. "1.0" -> "1")
        if (/^\d+\.0$/.test(rawPuesto)) {
          rawPuesto = rawPuesto.replace(/\.0$/, "");
        }
        // Corrección '0.35' -> '035' (Nave O)
        if (rawPuesto === "0.35") {
          rawPuesto = "035";
        }
        // Corrección 'Ñ-Ñ-' -> 'N-Ñ-' (Nave Ñ)
        if (rawPuesto.startsWith("Ñ-Ñ-") || rawPuesto.startsWith("ñ-ñ-")) {
          rawPuesto = rawPuesto.replace(/^[Ññ]-[Ññ]-/, "N-Ñ-");
        }
      }

      // CIU
      let ciu = "S/N";
      if (colOffset > 0 && row[0] !== null && row[0] !== undefined) {
        const cVal = String(row[0]).trim();
        if (/^\d{3,8}$/.test(cVal)) ciu = cVal;
      }

      if (!naveDetectada || naveDetectada === "NO DEFINIDA") {
        const inf = inferirNaveDesdePuesto(rawPuesto);
        if (inf) naveDetectada = inf;
      }

      // Etapa 4: Desglose de puestos múltiples
      const puestosDesglosados = expandPuestosHeuristic(rawPuesto);
      for (const p of puestosDesglosados) {
        registros.push({
          ciu,
          cedula: cedulaNorm,
          nombre: nombreNorm,
          contribuyente: nombreNorm,
          actividad: actividadFila,
          nave: naveDetectada,
          puesto: p,
          numBodega: p,
          gen01Codi: "-",
        });
      }
    }
  } else {
    // ── FALLBACK DINÁMICO PARA REPORTES EXCEL PERSONALIZADOS O GENÉRICOS ──
    let colCiu = -1;
    let colNombre = -1;
    let colArticulo = -1;
    let colPuesto = -1;
    let colMts = -1;
    let colDescripcion = -1;

    const actividadActual = "GENERAL";

    for (const row of rows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const celdasValidas = row
        .map((c) => String(c ?? "").normalize("NFC").trim())
        .filter((s) => s.length > 0);

      if (celdasValidas.length === 0) continue;

      // 1. Detección y Normalización de Cédula
      let cedulaEncontrada = "";
      let cedulaIndex = -1;

      for (let i = 0; i < row.length; i++) {
        const norm = normalizeCedulaRuc(row[i]);
        if (norm) {
          cedulaEncontrada = norm;
          cedulaIndex = i;
          break;
        }
      }

      if (!cedulaEncontrada) {
        const celdasUpper = celdasValidas.map((s) => s.toUpperCase());

        const tieneCedulaHeader = celdasUpper.some(
          (s) => s.includes("CEDULA") || s.includes("CÉDULA") || s.includes("RUC")
        );
        const tieneNombreHeader = celdasUpper.some(
          (s) =>
            s.includes("NOMBRES") ||
            s.includes("OCUPANTE") ||
            s.includes("NOMBRE") ||
            s.includes("CONTRIBUYENTE")
        );

        if (tieneCedulaHeader && tieneNombreHeader) {
          for (let i = 0; i < row.length; i++) {
            const val = String(row[i] ?? "").trim().toUpperCase();
            if (!val) continue;
            if (val.includes("CIU") || val.includes("CUI")) colCiu = i;
            else if (
              val.includes("NOMBRES") ||
              val.includes("OCUPANTE") ||
              val.includes("NOMBRE") ||
              val.includes("CONTRIBUYENTE")
            ) {
              if (colNombre === -1) colNombre = i;
            } else if (val.includes("ARTICULO") || val.includes("ARTÍCULO") || val.includes("ACTIVIDAD")) {
              colArticulo = i;
            } else if (val.includes("PUESTO") || val.includes("BODEGA") || val.includes("NUMBODEGA")) {
              colPuesto = i;
            } else if (val.includes("MTR") || val.includes("MTS")) {
              colMts = i;
            } else if (val.includes("DESCRIPCION") || val.includes("DESCRIPCIÓN")) {
              colDescripcion = i;
            }
          }
          continue;
        }

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
          naveDetectada = normalizeNave(cellNave, fileName);
          continue;
        }

        continue;
      }

      // Nombre
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
        for (let c = cedulaIndex + 1; c < Math.min(row.length, cedulaIndex + 6); c++) {
          const val = row[c];
          if (val === null || val === undefined) continue;
          const strVal = String(val).trim();
          if (!strVal || esFechaOBasura(val, strVal) || /^\d+(\.\d+)?$/.test(strVal)) continue;
          if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(strVal) && strVal.length > nombre.length) {
            nombre = strVal.toUpperCase().replace(/\s+/g, " ");
            nombreIndex = c;
          }
        }
      }

      if (!nombre) {
        nombre = "SIN NOMBRE";
        nombreIndex = cedulaIndex;
      }

      // Actividad y Puesto
      let actividadFila = "";
      let puesto = "-";

      if (colArticulo !== -1 && row[colArticulo]) {
        const artStr = String(row[colArticulo]).trim().toUpperCase();
        if (artStr && !esFechaOBasura(row[colArticulo], artStr)) {
          actividadFila = artStr;
        }
      }

      if (colPuesto !== -1 && row[colPuesto]) {
        const pStr = String(row[colPuesto]).trim();
        if (pStr && !esFechaOBasura(row[colPuesto], pStr)) {
          puesto = pStr;
        }
      } else if (colDescripcion !== -1 && row[colDescripcion]) {
        const dStr = String(row[colDescripcion]).trim();
        if (dStr && !esFechaOBasura(row[colDescripcion], dStr)) {
          puesto = dStr;
        }
      }

      if (puesto === "-" || !puesto) {
        for (let c = nombreIndex + 1; c < row.length; c++) {
          if (c === colMts) continue;
          const val = row[c];
          if (val === null || val === undefined) continue;
          const strVal = String(val).trim();
          if (!strVal || esFechaOBasura(val, strVal)) continue;
          if (/\b(mts?|m2|metros)\b/i.test(strVal)) continue;
          puesto = strVal;
          break;
        }
      }

      if (/^\d+\.0$/.test(puesto)) {
        puesto = puesto.replace(/\.0$/, "");
      }

      let ciu = "S/N";
      if (colCiu !== -1 && row[colCiu]) {
        ciu = String(row[colCiu]).trim();
      }

      if (!naveDetectada || naveDetectada === "NO DEFINIDA") {
        const inf = inferirNaveDesdePuesto(puesto);
        if (inf) naveDetectada = inf;
      }

      const desglosados = expandPuestosHeuristic(puesto);
      for (const p of desglosados) {
        registros.push({
          ciu,
          cedula: cedulaEncontrada,
          nombre,
          contribuyente: nombre,
          actividad: actividadFila || actividadActual,
          nave: naveDetectada,
          puesto: p,
          numBodega: p,
          gen01Codi: "-",
        });
      }
    }
  }

  // Si se detectó nave al final o por inferencia, asegurar que todos los registros la tengan
  if (naveDetectada && naveDetectada !== "NO DEFINIDA") {
    for (const r of registros) {
      if (!r.nave || r.nave === "NO DEFINIDA") {
        r.nave = naveDetectada;
      }
    }
  }

  return registros;
}

// ── Parseo de XML y CSV ─────────────────────────────────────────────────────

export function parsearXML(contenido: string): ImportacionRegistro[] {
  const registros: ImportacionRegistro[] = [];
  const contenidoNorm = contenido.normalize("NFC");
  const regex =
    /<Registro>[\s\S]*?<Nave>([\s\S]*?)<\/Nave>[\s\S]*?<Contribuyente>([\s\S]*?)<\/Contribuyente>[\s\S]*?<NumBodega>([\s\S]*?)<\/NumBodega>[\s\S]*?<Gen01Codi>([\s\S]*?)<\/Gen01Codi>[\s\S]*?<\/Registro>/g;

  let match;
  let i = 1;
  while ((match = regex.exec(contenidoNorm)) !== null) {
    const nombre = match[2].trim();
    const puesto = match[3].trim();
    const nave = match[1].trim();
    const desglosados = desglosarCodigosPuestoMultiples(puesto);
    for (const p of desglosados) {
      registros.push({
        ciu: "-",
        cedula: `18${String(10000000 + i).padStart(8, "0")}`,
        nombre,
        contribuyente: nombre,
        actividad: "General",
        nave,
        puesto: p,
        numBodega: p,
        gen01Codi: match[4].trim(),
      });
    }
    i++;
  }

  return registros;
}

export function parsearCSV(contenido: string): ImportacionRegistro[] {
  const lineas = contenido
    .normalize("NFC")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length === 0) return [];

  // 1. Detectar delimitador (coma o punto y coma)
  const primerLinea = lineas[0];
  const cantComas = (primerLinea.match(/,/g) || []).length;
  const cantPuntosComas = (primerLinea.match(/;/g) || []).length;
  const sep = cantPuntosComas > cantComas ? ";" : ",";

  const splitLinea = (linea: string): string[] => {
    if (linea.includes('"')) {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < linea.length; i++) {
        const char = linea[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === sep && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, "").trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, "").trim());
      return result;
    }
    return linea.split(sep).map((s) => s.trim().replace(/^"|"$/g, "").trim());
  };

  const colsHeader = splitLinea(lineas[0]).map((c) => c.toUpperCase());
  const primeraLineaUpper = lineas[0].toUpperCase();
  const tieneCabecera =
    primeraLineaUpper.includes("CEDULA") ||
    primeraLineaUpper.includes("CÉDULA") ||
    primeraLineaUpper.includes("CONTRIBUYENTE") ||
    primeraLineaUpper.includes("NOMBRE") ||
    primeraLineaUpper.includes("OCUPANTE") ||
    primeraLineaUpper.includes("PUESTO") ||
    primeraLineaUpper.includes("NAVE") ||
    primeraLineaUpper.includes("CIU") ||
    primeraLineaUpper.includes("CUI");

  let idxCiu = -1;
  let idxCedula = -1;
  let idxNombre = -1;
  let idxActividad = -1;
  let idxPuesto = -1;
  let idxNave = -1;

  if (tieneCabecera) {
    colsHeader.forEach((col, idx) => {
      if (col.includes("CIU") || col.includes("CUI")) idxCiu = idx;
      else if (col.includes("CEDULA") || col.includes("CÉDULA") || col.includes("RUC")) idxCedula = idx;
      else if (
        col.includes("CONTRIBUYENTE") ||
        col.includes("NOMBRE") ||
        col.includes("OCUPANTE") ||
        col.includes("NOMBRES")
      ) {
        idxNombre = idx;
      } else if (
        col.includes("ACTIVIDAD") ||
        col.includes("ARTICULO") ||
        col.includes("ARTÍCULO")
      ) {
        idxActividad = idx;
      } else if (
        col.includes("PUESTO") ||
        col.includes("BODEGA") ||
        col.includes("NUMBODEGA")
      ) {
        idxPuesto = idx;
      } else if (col.includes("NAVE")) {
        idxNave = idx;
      }
    });
  }

  const lineasDatos = tieneCabecera ? lineas.slice(1) : lineas;
  const registros: ImportacionRegistro[] = [];
  let naveDetectadaEnArchivo = "";

  for (let idx = 0; idx < lineasDatos.length; idx++) {
    const partes = splitLinea(lineasDatos[idx]);
    if (partes.length < 2 || !partes.some((p) => p.length > 0)) continue;

    let ciu = "S/N";
    let cedula = "";
    let nombre = "";
    let actividad = "General";
    let puesto = "-";
    let nave = "";

    if (tieneCabecera && (idxCedula !== -1 || idxNombre !== -1)) {
      if (idxCiu !== -1) {
        const valCiu = (partes[idxCiu] || "").trim();
        ciu = (!valCiu || valCiu === "-" || valCiu === "S/N") ? "S/N" : valCiu;
      }
      if (idxCedula !== -1 && partes[idxCedula]) cedula = partes[idxCedula].trim();
      if (idxNombre !== -1 && partes[idxNombre]) nombre = partes[idxNombre].trim();
      if (idxActividad !== -1 && partes[idxActividad]) actividad = partes[idxActividad].trim() || "General";
      if (idxPuesto !== -1 && partes[idxPuesto]) puesto = partes[idxPuesto].trim() || "-";
      if (idxNave !== -1 && partes[idxNave]) nave = partes[idxNave].trim();
    } else {
      if (partes.length >= 5) {
        const valCiu = (partes[0] || "").trim();
        ciu = (!valCiu || valCiu === "-" || valCiu === "S/N") ? "S/N" : valCiu;
        cedula = (partes[1] || "").trim();
        nombre = (partes[2] || "Comerciante").trim();
        actividad = (partes[3] || "General").trim();
        puesto = (partes[4] || "-").trim();
        nave = (partes[5] || "").trim();
      } else if (partes.length >= 4) {
        nave = (partes[0] || "").trim();
        nombre = (partes[1] || "Comerciante").trim();
        puesto = (partes[2] || "-").trim();
        cedula = (partes[3] || "").trim();
      }
    }

    const normCedula = normalizarYCedula(cedula);
    if (normCedula) {
      cedula = normCedula;
    } else if (!cedula) {
      cedula = `18${String(10000000 + idx).padStart(8, "0")}`;
    }

    if (!ciu || ciu === "-" || ciu.trim() === "") {
      ciu = "S/N";
    }

    let naveFinal = nave;
    if (!naveFinal || naveFinal.toUpperCase() === "NO DEFINIDA") {
      const naveInferida = inferirNaveDesdePuesto(puesto);
      if (naveInferida) {
        naveFinal = naveInferida;
        naveDetectadaEnArchivo = naveInferida;
      } else if (naveDetectadaEnArchivo) {
        naveFinal = naveDetectadaEnArchivo;
      } else {
        naveFinal = "NAVE A";
      }
    }

    const puestosDesglosados = desglosarCodigosPuestoMultiples(puesto);
    for (const p of puestosDesglosados) {
      registros.push({
        ciu: ciu || "S/N",
        cedula,
        nombre: nombre || "Comerciante",
        contribuyente: nombre || "Comerciante",
        actividad: actividad || "General",
        nave: naveFinal,
        puesto: p,
        numBodega: p,
        gen01Codi: "-",
      });
    }
  }

  return registros;
}
