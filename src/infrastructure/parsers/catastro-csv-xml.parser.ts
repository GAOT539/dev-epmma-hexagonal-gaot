// ── Infraestructura: Parser Especializado para Archivos CSV y XML ───────────
// Reconocimiento dinámico de cabeceras, soporte multi-nave y normalización de CIU

import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import {
  limpiarTextoCelda,
  normalizeCedulaRuc,
  normalizeNave,
} from "./catastro-file.parser";
import {
  inferirNaveDesdePuesto,
  expandPuestosHeuristic,
  aplicarSufijoVehiculoPorActividad,
  esNaveAmbulantes,
  aplicarReglaPuestosAmbulantes,
} from "../database/catastro-reconciliacion.service";

// ── Ejemplos Institucionales para Simulación y Descargas de Plantilla ─────────

export const XML_EJEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<Importacion>
  <Registro>
    <CIU>392301</CIU>
    <Cedula>1801234567</Cedula>
    <Contribuyente>Juan Pérez Morales</Contribuyente>
    <Articulo>Frutas y Legumbres</Articulo>
    <Puesto>A-01</Puesto>
    <Nave>Nave A</Nave>
  </Registro>
  <Registro>
    <CIU>392302</CIU>
    <Cedula>1807654321</Cedula>
    <Contribuyente>María Torres Guzmán</Contribuyente>
    <Articulo>Abarrotes</Articulo>
    <Puesto>B-05</Puesto>
    <Nave>Nave B</Nave>
  </Registro>
</Importacion>`;

export const CSV_EJEMPLO = `CIU,Cedula,Contribuyente,Articulo,Puesto,Nave
392301,1801234567,Juan Pérez Morales,Frutas y Legumbres,A-01,Nave A
392302,1807654321,María Torres Guzmán,Abarrotes,B-05,Nave B`;

// ── Tipos y Diccionario de Cabeceras / Etiquetas Dinámicas ───────────────────

type TipoCampo =
  | "ciu"
  | "cedula"
  | "contribuyente"
  | "actividad"
  | "puesto"
  | "nave"
  | "descripcion";

/**
 * Normaliza nombres de columnas (CSV) o etiquetas/atributos (XML) eliminando
 * BOM, comillas, acentos, espacios, guiones y puntos para mapeo insensible a orden.
 * Retorna null si la columna es irrelevante (ej. MTS, M2, VALOR, CANON, etc.).
 */
export function clasificarColumna(nombre: string): TipoCampo | null {
  if (!nombre) return null;
  const norm = nombre
    .replace(/^\uFEFF/, "")
    .replace(/["']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();

  // 1. CIU
  if (
    [
      "CIU",
      "CUI",
      "CODCIU",
      "CODIGOCIU",
      "NROCIU",
      "NUMCIU",
      "IDCIU",
    ].includes(norm) ||
    norm.startsWith("CIU") ||
    norm.startsWith("CODCIU")
  ) {
    return "ciu";
  }

  // 2. Cédula / RUC / Identificación
  if (
    [
      "CEDULA",
      "RUC",
      "CEDULARUC",
      "IDENTIFICACION",
      "CI",
      "DOCUMENTO",
      "NRODOCUMENTO",
      "NUMDOCUMENTO",
      "GEN01CODI",
    ].includes(norm) ||
    norm.includes("CEDULA") ||
    norm.includes("IDENTIFICACION")
  ) {
    return "cedula";
  }

  // 3. Contribuyente / Nombre
  if (
    [
      "CONTRIBUYENTE",
      "NOMBRE",
      "NOMBRES",
      "OCUPANTE",
      "COMERCIANTE",
      "RAZONSOCIAL",
      "NOMBRESYAPELLIDOS",
      "APELLIDOSYNOMBRES",
      "TITULAR",
    ].includes(norm) ||
    norm.includes("CONTRIBUYENTE") ||
    norm.includes("COMERCIANTE") ||
    norm.includes("RAZONSOCIAL") ||
    norm.includes("OCUPANTE")
  ) {
    return "contribuyente";
  }

  // 4. Artículo / Actividad / Giro
  if (
    [
      "ARTICULO",
      "ACTIVIDAD",
      "GIRO",
      "PRODUCTO",
      "RUBRO",
      "GIROCOMERCIAL",
      "ACTIVIDADCOMERCIAL",
    ].includes(norm) ||
    norm.includes("ARTICULO") ||
    norm.includes("ACTIVIDAD") ||
    norm.includes("GIRO") ||
    norm.includes("RUBRO")
  ) {
    return "actividad";
  }

  // 5. Puesto / Bodega / Cubículo
  if (
    [
      "PUESTO",
      "NUMBODEGA",
      "BODEGA",
      "LOCAL",
      "CUBICULO",
      "NUCLEO",
      "CODIGOPUESTO",
      "CODPUESTO",
      "NROPUESTO",
      "NUMPUESTO",
      "UBICACION",
    ].includes(norm) ||
    norm.includes("PUESTO") ||
    norm.includes("BODEGA") ||
    norm.includes("CUBICULO") ||
    norm.includes("NUCLEO")
  ) {
    return "puesto";
  }

  // 6. Nave / Sección / Pabellón
  if (
    [
      "NAVE",
      "NOMBRENAVE",
      "NAVES",
      "SECCION",
      "PABELLON",
      "SECTOR",
      "BLOQUE",
    ].includes(norm) ||
    norm.includes("NAVE") ||
    norm.includes("PABELLON") ||
    norm.includes("SECCION")
  ) {
    return "nave";
  }

  // 7. Descripción / Detalle
  if (
    ["DESCRIPCION", "DESC", "DETALLEPUESTO", "DETALLE"].includes(norm) ||
    norm.startsWith("DESCRIP")
  ) {
    return "descripcion";
  }

  // Columnas ignoradas silenciosamente (MTS, M2, VALOR, CANON, TARIFA, TELEFONO, etc.)
  return null;
}

// ── Normalización de Campos Específicos ──────────────────────────────────────

/**
 * Normaliza el CIU: si viene vacío, "-", "NULL" o "S/N", retorna "S/N".
 * Si trae valor real, quita sufijos decimales .0 y retorna el valor limpio.
 */
export function normalizarCIU(raw: unknown): string {
  if (raw === null || raw === undefined) return "S/N";
  const str = limpiarTextoCelda(raw);
  if (!str) return "S/N";
  const upper = str.toUpperCase();
  if (upper === "-" || upper === "NULL" || upper === "S/N" || upper === "SN") {
    return "S/N";
  }
  const limpio = str.replace(/\.0+$/, "").trim();
  return limpio || "S/N";
}

/**
 * Normaliza el nombre de nave por fila:
 * - Si trae sólo la letra o código corto ("A", "CF", "ROPA"), le antepone "NAVE ".
 * - Si contiene "AMBULANTE", normaliza mediante normalizeNave.
 * - Si está vacía, intenta inferir desde el puesto o fileName.
 * - Si no es posible inferir, deja "NO DEFINIDA" (NUNCA fuerza "NAVE A").
 */
export function normalizarNaveFila(
  rawNave: unknown,
  puestoFinal?: string,
  fileName?: string
): string {
  const str = limpiarTextoCelda(rawNave).toUpperCase();
  if (str) {
    if (str.includes("AMBULANTE")) {
      return normalizeNave(str, fileName);
    }
    if (/^NAVE\s+/i.test(str)) {
      return str.replace(/\s+/g, " ");
    }
    if (
      /^[A-ZÑ0-9]+$/i.test(str) ||
      str === "AUTO LUJOS" ||
      str === "AUTOLUJOS" ||
      str === "ROPA" ||
      str === "FLORES" ||
      str === "CF"
    ) {
      const limpio = str === "AUTOLUJOS" ? "AUTO LUJOS" : str;
      return `NAVE ${limpio}`;
    }
    return str;
  }

  // Inferencia desde código de puesto
  if (puestoFinal && puestoFinal !== "-") {
    const inf = inferirNaveDesdePuesto(puestoFinal);
    if (inf) return inf;
  }

  // Inferencia desde nombre de archivo
  if (fileName) {
    const normFile = normalizeNave("", fileName);
    if (normFile && normFile !== "NO DEFINIDA") {
      return normFile;
    }
  }

  return "NO DEFINIDA";
}

/**
 * Procesa puesto y descripción aplicando las reglas institucionales:
 * - Limpia sufijos *MES (ej. *AGOSTO) y glosas COBRO DE VALOR...
 * - Prioridad de DESCRIPCION en NAVE P con formato N-P-XX.
 * - Fallback de DESCRIPCION si puesto viene vacío.
 * - Trunca .0 en enteros, corrige 0.35 -> 035 y Ñ-Ñ- -> N-Ñ-.
 * - Aplica regla de puesto "0" para AMBULANTES si el puesto es nulo, vacío o SN.
 */
export function procesarPuestoYDescripcion(
  rawPuesto: string,
  rawDesc: string,
  nave: string,
  actividad: string
): { puestoFinal: string; actividadFinal: string } {
  const p = rawPuesto
    .replace(/\*[A-Z]+$/i, "")
    .replace(/\s+COBRO DE VALOR.*$/i, "")
    .trim();
  const d = rawDesc
    .replace(/\*[A-Z]+$/i, "")
    .replace(/\s+COBRO DE VALOR.*$/i, "")
    .trim();

  let puestoFinal = "";
  let actividadFinal = actividad;

  const esEstructuralDesc = /^(?:N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+)$/i.test(d);
  const iniciaPrefijoEstructural =
    /^(?:BODEGA|CUBICULO|CUBÍCULO|NUCLEO|NÚCLEO|NUCLEOS|COCINA|LOCAL|N-|ZCF-)/i.test(p);

  const esCodigoNaveP = /^N-P-\d+[A-Z0-9-]*$/i.test(d);
  const esNaveP = nave === "NAVE P" || esCodigoNaveP;

  if (esNaveP && esCodigoNaveP) {
    puestoFinal = d.toUpperCase();
  } else if (!iniciaPrefijoEstructural && p && esEstructuralDesc) {
    puestoFinal = d.toUpperCase();
    if (!actividadFinal || actividadFinal.toUpperCase() === "GENERAL") {
      actividadFinal = p.toUpperCase();
    }
  } else if (!p && d) {
    puestoFinal = d.toUpperCase();
  } else {
    puestoFinal = p.toUpperCase() || d.toUpperCase() || "-";
  }

  // Truncar .0 en enteros (ej. "1.0" -> "1")
  if (/^\d+\.0+$/.test(puestoFinal)) {
    puestoFinal = puestoFinal.replace(/\.0+$/, "");
  }
  // Corrección 0.35 -> 035
  if (puestoFinal === "0.35") {
    puestoFinal = "035";
  }
  // Corrección Ñ-Ñ- -> N-Ñ-
  if (puestoFinal.startsWith("Ñ-Ñ-") || puestoFinal.startsWith("ñ-ñ-")) {
    puestoFinal = puestoFinal.replace(/^[Ññ]-[Ññ]-/, "N-Ñ-");
  }

  // Regla exclusiva para AMBULANTES: puesto "0" si está vacío, nulo o SN
  if (esNaveAmbulantes(nave)) {
    const u = puestoFinal.trim().toUpperCase();
    if (
      u === "" ||
      u === "-" ||
      u === "NULL" ||
      u === "S/N" ||
      u === "SN" ||
      /^GENERAL\s*\d+$/i.test(u)
    ) {
      puestoFinal = "0";
    }
  }

  return { puestoFinal, actividadFinal };
}

/**
 * Procesa un registro estructurado y genera una o más filas desglosadas por puesto.
 */
function procesarFilaExtraida(
  campos: Partial<Record<TipoCampo, string>>,
  rowIdx: number,
  fileName?: string
): ImportacionRegistro[] | null {
  const rawCedula = campos.cedula || "";
  const rawNombre = campos.contribuyente || "";

  const normCedula = normalizeCedulaRuc(rawCedula);
  const nombreLimpio = limpiarTextoCelda(rawNombre);

  // Omitir fila si no tiene cédula válida ni nombre legítimo (fila vacía, total o basura)
  if (!normCedula && (!nombreLimpio || nombreLimpio.toUpperCase() === "SIN NOMBRE")) {
    return null;
  }

  const cedulaFinal =
    normCedula ||
    (rawCedula.replace(/\D/g, "").length >= 9
      ? normalizeCedulaRuc(rawCedula.replace(/\D/g, ""))
      : null) ||
    `18${String(10000000 + rowIdx).padStart(8, "0")}`;

  const nombreFinal = nombreLimpio
    ? nombreLimpio.toUpperCase().replace(/\s+/g, " ")
    : "COMERCIANTE";

  const ciuFinal = normalizarCIU(campos.ciu);
  const rawActividad = campos.actividad
    ? limpiarTextoCelda(campos.actividad).toUpperCase()
    : "GENERAL";
  const rawPuesto = campos.puesto ? limpiarTextoCelda(campos.puesto) : "";
  const rawDesc = campos.descripcion ? limpiarTextoCelda(campos.descripcion) : "";

  let naveFila = normalizarNaveFila(campos.nave, rawPuesto || rawDesc, fileName);

  const { puestoFinal, actividadFinal } = procesarPuestoYDescripcion(
    rawPuesto,
    rawDesc,
    naveFila,
    rawActividad
  );

  if (naveFila === "NO DEFINIDA" && puestoFinal && puestoFinal !== "-") {
    const inf = inferirNaveDesdePuesto(puestoFinal);
    if (inf) naveFila = inf;
  }

  const desglosados = expandPuestosHeuristic(puestoFinal);
  const resultado: ImportacionRegistro[] = [];

  for (const p of desglosados) {
    const puestoConDistincion = aplicarSufijoVehiculoPorActividad(
      p,
      actividadFinal || "GENERAL"
    );
    resultado.push({
      ciu: ciuFinal,
      cedula: cedulaFinal,
      nombre: nombreFinal,
      contribuyente: nombreFinal,
      actividad: actividadFinal || "GENERAL",
      nave: naveFila,
      puesto: puestoConDistincion,
      numBodega: puestoConDistincion,
      gen01Codi: "-",
    });
  }

  return resultado;
}

// ── Parser CSV Robusto con Delimitador Flexible y Comillas ───────────────────

export function parseCSVLine(linea: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];
    if (char === '"') {
      if (inQuotes && linea[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === sep && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());

  return result.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).replace(/""/g, '"').trim();
    }
    return s;
  });
}

function inferirCamposFilaSinCabecera(
  partes: string[],
  camposMap: Partial<Record<TipoCampo, string>>
) {
  const indicesUsados = new Set<number>();

  // 1. Cédula
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx) && normalizeCedulaRuc(p) !== null) {
      camposMap.cedula = p;
      indicesUsados.add(idx);
    }
  });

  // 2. Nave
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx)) {
      const u = p.trim().toUpperCase();
      if (
        u.startsWith("NAVE ") ||
        u.includes("AMBULANTE") ||
        u === "AUTO LUJOS" ||
        u === "ROPA" ||
        u === "FLORES" ||
        u === "CF"
      ) {
        camposMap.nave = p;
        indicesUsados.add(idx);
      }
    }
  });

  // 3. CIU (numérico de 3 a 8 dígitos)
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx) && !camposMap.ciu) {
      const limpio = p.trim().replace(/\.0+$/, "");
      if (/^\d{3,8}$/.test(limpio)) {
        camposMap.ciu = limpio;
        indicesUsados.add(idx);
      }
    }
  });

  // 4. Puesto
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx) && !camposMap.puesto) {
      const u = p.trim().toUpperCase();
      if (
        /^(?:N-[A-ZÑ0-9-]+|ZCF-[A-Z0-9-]+|[A-Z0-9]+-[A-Z0-9]+|\d{1,4}[A-Z]?)$/i.test(
          u
        ) ||
        u === "0" ||
        u === "S/N"
      ) {
        camposMap.puesto = p;
        indicesUsados.add(idx);
      }
    }
  });

  // 5. Contribuyente (texto alfabético más largo)
  let mejorNombreIdx = -1;
  let maxLen = 0;
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx)) {
      const pLimpio = p.trim();
      if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pLimpio) && pLimpio.length > maxLen) {
        maxLen = pLimpio.length;
        mejorNombreIdx = idx;
      }
    }
  });
  if (mejorNombreIdx !== -1) {
    camposMap.contribuyente = partes[mejorNombreIdx];
    indicesUsados.add(mejorNombreIdx);
  }

  // 6. Actividad (alguna celda restante con texto)
  partes.forEach((p, idx) => {
    if (!indicesUsados.has(idx) && !camposMap.actividad) {
      camposMap.actividad = p;
      indicesUsados.add(idx);
    }
  });
}

/**
 * Parser de archivos CSV con reconocimiento dinámico de cabeceras, soporte
 * de delimitadores automáticos (, ; \t |), filas sin cabecera y multi-nave.
 */
export function parsearCSV(
  contenido: string,
  fileName?: string
): ImportacionRegistro[] {
  if (!contenido || !contenido.trim()) return [];
  const lineas = contenido
    .normalize("NFC")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length === 0) return [];

  // Detección automática del delimitador en la primera línea
  const primeraLinea = lineas[0];
  const counts: Record<string, number> = {
    ",": (primeraLinea.match(/,/g) || []).length,
    ";": (primeraLinea.match(/;/g) || []).length,
    "\t": (primeraLinea.match(/\t/g) || []).length,
    "|": (primeraLinea.match(/\|/g) || []).length,
  };
  let sep = ",";
  let maxCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      sep = delim;
    }
  }

  const colsPrimeraLinea = parseCSVLine(primeraLinea, sep);
  const tieneCedulaEnFila0 = colsPrimeraLinea.some(
    (c) => normalizeCedulaRuc(c) !== null
  );

  let tieneCabecera = false;
  const mapaColumnas: Partial<Record<TipoCampo, number>> = {};

  if (!tieneCedulaEnFila0) {
    colsPrimeraLinea.forEach((col, idx) => {
      const tipo = clasificarColumna(col);
      if (tipo && mapaColumnas[tipo] === undefined) {
        mapaColumnas[tipo] = idx;
        tieneCabecera = true;
      }
    });
  }

  const lineasDatos = tieneCabecera ? lineas.slice(1) : lineas;
  const registros: ImportacionRegistro[] = [];
  let rowIdx = 1;

  for (const linea of lineasDatos) {
    const partes = parseCSVLine(linea, sep);
    if (partes.length === 0 || !partes.some((p) => p.length > 0)) continue;

    const camposMap: Partial<Record<TipoCampo, string>> = {};

    if (tieneCabecera) {
      for (const [tipo, idx] of Object.entries(mapaColumnas)) {
        if (idx !== undefined && partes[idx] !== undefined) {
          camposMap[tipo as TipoCampo] = partes[idx];
        }
      }
    } else {
      inferirCamposFilaSinCabecera(partes, camposMap);
    }

    const regs = procesarFilaExtraida(camposMap, rowIdx, fileName);
    if (regs) {
      registros.push(...regs);
      rowIdx++;
    }
  }

  // Propagar nave si todo el archivo corresponde a 1 sola nave identificada
  const navesDetectadas = Array.from(
    new Set(
      registros
        .map((r) => r.nave)
        .filter((n) => n && n !== "NO DEFINIDA" && n !== "NAVE")
    )
  );
  if (navesDetectadas.length === 1) {
    const naveUnica = navesDetectadas[0];
    for (const r of registros) {
      if (!r.nave || r.nave === "NO DEFINIDA") {
        r.nave = naveUnica;
      }
    }
  } else if (navesDetectadas.length === 0 && fileName) {
    const naveArchivo = normalizeNave("", fileName);
    if (naveArchivo && naveArchivo !== "NO DEFINIDA") {
      for (const r of registros) {
        r.nave = naveArchivo;
      }
    }
  }

  const esAmbulantesArchivo =
    registros.some((r) => esNaveAmbulantes(r.nave)) ||
    esNaveAmbulantes(fileName);

  return esAmbulantesArchivo
    ? aplicarReglaPuestosAmbulantes(registros, fileName)
    : registros;
}

// ── Parser XML Dinámico e Insensible a Etiquetas / Atributos ─────────────────

/**
 * Parser de archivos XML con reconocimiento dinámico de bloques de registro
 * (<Registro>, <Row>, <Item>, <Comerciante>, etc.), etiquetas hijas y atributos.
 */
export function parsearXML(
  contenido: string,
  fileName?: string
): ImportacionRegistro[] {
  if (!contenido || !contenido.trim()) return [];
  const contenidoNorm = contenido.normalize("NFC");

  const tagCandidates = [
    "registro",
    "row",
    "item",
    "comerciante",
    "record",
    "fila",
  ];
  let matchedTag: string | null = null;
  for (const tag of tagCandidates) {
    const r = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "i");
    if (r.test(contenidoNorm)) {
      matchedTag = tag;
      break;
    }
  }

  let bloques: string[] = [];
  if (matchedTag) {
    const regexBloque = new RegExp(
      `<${matchedTag}\\b[^>]*>([\\s\\S]*?)<\\/${matchedTag}>`,
      "gi"
    );
    let match: RegExpExecArray | null;
    while ((match = regexBloque.exec(contenidoNorm)) !== null) {
      bloques.push(match[1]);
    }
  } else {
    // Buscar cualquier etiqueta repetida de segundo nivel
    const rootMatch = contenidoNorm.match(
      /<([a-zA-Z0-9_-]+)[^>]*>([\s\S]*?)<\/\1>/
    );
    if (rootMatch && rootMatch[2]) {
      const inner = rootMatch[2];
      const tags = inner.match(/<([a-zA-Z0-9_-]+)\b[^>]*>[\s\S]*?<\/\1>/gi);
      if (tags && tags.length > 0) {
        bloques = tags.map((t) =>
          t.replace(
            /^<[a-zA-Z0-9_-]+[^>]*>([\s\S]*)<\/[a-zA-Z0-9_-]+>$/i,
            "$1"
          )
        );
      }
    }
  }

  if (bloques.length === 0) return [];

  const registros: ImportacionRegistro[] = [];
  let rowIdx = 1;

  for (const bloque of bloques) {
    const camposMap: Partial<Record<TipoCampo, string>> = {};

    // 1. Extraer elementos hijos <Tag>Valor</Tag>
    const childRegex = /<([a-zA-Z0-9_-]+)\b[^>]*>([\s\S]*?)<\/\1>/g;
    let cm: RegExpExecArray | null;
    while ((cm = childRegex.exec(bloque)) !== null) {
      const rawTag = cm[1];
      const rawVal = cm[2]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
      const tipoCol = clasificarColumna(rawTag);
      if (tipoCol && !camposMap[tipoCol]) {
        camposMap[tipoCol] = limpiarTextoCelda(rawVal);
      }
    }

    // 2. Extraer atributos tag attr="val"
    const attrRegex = /\b([a-zA-Z0-9_-]+)=["']([^"']*)["']/g;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(bloque)) !== null) {
      const rawAttr = am[1];
      const rawVal = am[2].trim();
      const tipoCol = clasificarColumna(rawAttr);
      if (tipoCol && !camposMap[tipoCol]) {
        camposMap[tipoCol] = limpiarTextoCelda(rawVal);
      }
    }

    const regs = procesarFilaExtraida(camposMap, rowIdx, fileName);
    if (regs) {
      registros.push(...regs);
      rowIdx++;
    }
  }

  // Propagar nave si todo el archivo corresponde a 1 sola nave identificada
  const navesDetectadas = Array.from(
    new Set(
      registros
        .map((r) => r.nave)
        .filter((n) => n && n !== "NO DEFINIDA" && n !== "NAVE")
    )
  );
  if (navesDetectadas.length === 1) {
    const naveUnica = navesDetectadas[0];
    for (const r of registros) {
      if (!r.nave || r.nave === "NO DEFINIDA") {
        r.nave = naveUnica;
      }
    }
  } else if (navesDetectadas.length === 0 && fileName) {
    const naveArchivo = normalizeNave("", fileName);
    if (naveArchivo && naveArchivo !== "NO DEFINIDA") {
      for (const r of registros) {
        r.nave = naveArchivo;
      }
    }
  }

  const esAmbulantesArchivo =
    registros.some((r) => esNaveAmbulantes(r.nave)) ||
    esNaveAmbulantes(fileName);

  return esAmbulantesArchivo
    ? aplicarReglaPuestosAmbulantes(registros, fileName)
    : registros;
}
