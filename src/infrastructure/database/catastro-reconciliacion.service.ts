// ── Servicio de Reconciliación Mensual de Catastro y Comparación de Puestos ──

import type {
  ImportacionRegistro,
  ReconciliacionResumen,
  CambioReconciliacion,
  AccionReconciliacionItem,
  ResultadoSimulacionCatastro,
} from "@/domain/models/comerciante.model";

export type { AccionReconciliacionItem, ResultadoSimulacionCatastro };

export interface ComponentesCodigoPuesto {
  categoria: "BODEGA" | "CUBICULO" | "NUCLEO" | "";
  tokenFinal: string;
  numeroBase: string;
  sufijoAlfanumerico: string;
  esRangoCompuesto?: boolean;
  rangoNormalizado?: string;
}

/**
 * Genera un slug identificador para la nave preservando la 'Ñ' de forma distintiva:
 * - "NAVE Ñ" genera "nave-nh"
 * - "NAVE N" genera "nave-n"
 * Evita colisiones de IDs y mantiene la unicidad e integridad referencial.
 */
export function generarSlugNave(nombre: string): string {
  if (!nombre) return "";
  return nombre
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/ñ/g, "nh")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Simplifica y limpia cualquier código de puesto eliminando prefijos descriptivos
 * (BODEGA, CUBICULO, NUCLEO, COCINA, LOCAL, PUESTO, BAJO, ALTO) y prefijos/sufijos de nave (N-X-, -N-X),
 * retornando el identificador corto del puesto (ej. "01", "003-A", "062A", "S/N").
 */
export function simplificarCodigoPuesto(rawCodigo: string): string {
  if (!rawCodigo) return "-";
  const norm = rawCodigo.normalize("NFC").trim();
  if (!norm || norm === "-") return "-";
  if (norm.toUpperCase() === "S/N" || norm.toUpperCase() === "SN") return "S/N";

  let token = norm
    .replace(/^(?:BODEGA|CUBICULO|CUBÍCULO|NUCLEO|NÚCLEO|NUCLEOS|COCINA|LOCAL|PUESTO|BAJO|ALTO)\s+/i, "")
    .trim();

  // Limpiar prefijo estructural de nave ej. N-A-01, N-CF-01, N-Ñ-01, ZCF-01
  const matchPrefijo = token.match(/^(?:N-[A-ZÑ0-9]+-|ZCF-)(.+)$/i);
  if (matchPrefijo) {
    token = matchPrefijo[1].trim();
  }

  // Limpiar sufijo estructural de nave ej. N-02A-H o 02A-N-H
  const matchSufijo =
    token.match(/^N-([0-9]+[A-Z0-9]*)-[A-ZÑ]$/i) || token.match(/^([0-9]+[A-Z0-9]*)-N-[A-ZÑ]$/i);
  if (matchSufijo) {
    token = matchSufijo[1].trim();
  }

  // Quitar palabras descriptivas residuales
  token = token
    .replace(/\b(?:BODEGA|CUBICULO|CUBÍCULO|NUCLEO|NÚCLEO|NUCLEOS|COCINA|LOCAL|PUESTO|BAJO|ALTO)\b/gi, "")
    .trim()
    .replace(/^[-_\s]+|[-_\s]+$/g, "");

  return token || norm;
}

/**
 * Motor Heurístico de Separación vs Preservación de Puestos Múltiples (5 Casos Exactos):
 * - Caso 1: Prefijo estructural con numeración múltiple (ej. "CUBICULO N-Z-52-53") -> ["CUBICULO N-Z-52", "CUBICULO N-Z-53"]
 * - Caso 2: Códigos estructurales únicos (BODEGA, CUBICULO, N-, ZCF-, S/N) -> NO separar
 * - Caso 3: Subdivisiones con letra (ej. "003-A", "102-A") -> NO separar
 * - Caso 4: Lista de puestos numéricos con guion (ej. "001-126", "049-073", "008-009-015-016") -> separar por '-'
 * - Caso 5: Puestos numéricos de 6 dígitos concatenados sin guion (ej. "068069") -> ["068", "069"]
 */
export function expandPuestosHeuristic(codigoPuesto: string): string[] {
  if (!codigoPuesto) return ["-"];
  const codigoLimpio = codigoPuesto.normalize("NFC").trim();
  if (!codigoLimpio || codigoLimpio === "-" || codigoLimpio.toUpperCase() === "S/N") {
    return [codigoLimpio || "-"];
  }

  const upper = codigoLimpio.toUpperCase();

  // Caso 1: Prefijo estructural con numeración múltiple al final
  const regexCaso1 = /^((?:CUBICULO|CUBÍCULO|BODEGA|NUCLEO|NÚCLEO|LOCAL|COCINA)\s+N-[A-ZÑ0-9]+-)(\d+(?:-\d+)+)$/i;
  const matchCaso1 = upper.match(regexCaso1);
  if (matchCaso1) {
    const prefijo = matchCaso1[1];
    const numeros = matchCaso1[2].split("-");
    return numeros.map((num) => `${prefijo}${num}`);
  }

  // Caso 2: Códigos estructurales únicos -> NO separar
  if (/^(?:BODEGA|CUBICULO|CUBÍCULO|NUCLEO|NÚCLEO|NUCLEOS|COCINA|LOCAL|N-|ZCF-)/i.test(upper)) {
    return [codigoLimpio];
  }

  // Caso 3: Subdivisiones con letra o sufijo de vehículo (ej. "003-A", "102-A", "001-VEHICULO") -> NO separar
  if (/^\d+-[A-Za-z]+$/i.test(codigoLimpio) || upper.endsWith("-VEHICULO")) {
    return [codigoLimpio];
  }

  // Caso 4: Lista de puestos numéricos separados por guion (ej. "001-126", "049-073")
  if (/^\d+[A-Za-z]?(-(?:\d+[A-Za-z]?))+$/i.test(codigoLimpio)) {
    const partes = codigoLimpio
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length >= 2) {
      return partes;
    }
  }

  // Caso 5: Puestos numéricos de 6 dígitos concatenados sin guion (ej. "068069")
  if (/^\d{6}$/.test(codigoLimpio)) {
    return [codigoLimpio.slice(0, 3), codigoLimpio.slice(3, 6)];
  }

  return [codigoLimpio];
}

/**
 * Desglose inteligente de celdas multi-puesto separadas por guion.
 * Utiliza el motor heurístico exacto expandPuestosHeuristic.
 */
export function desglosarCodigosPuestoMultiples(codigoPuesto: string): string[] {
  return expandPuestosHeuristic(codigoPuesto);
}

/**
 * Añade la distinción automática "-VEHICULO" a puestos de comerciantes cuya actividad
 * contiene la palabra "VEHICULO" o "VEHÍCULO" (ej. en Nave P u otras naves abiertas).
 */
export function aplicarSufijoVehiculoPorActividad(puesto: string, actividad?: string): string {
  if (!puesto) return "";
  const pNorm = puesto.normalize("NFC").trim();
  if (!pNorm || pNorm === "-" || pNorm.toUpperCase() === "S/N" || pNorm.toUpperCase() === "SN") {
    return pNorm;
  }
  if (pNorm.toUpperCase().endsWith("-VEHICULO")) {
    return pNorm;
  }
  if (/\bVEH[IÍ]CULO\b/i.test(actividad || "")) {
    return `${pNorm}-VEHICULO`;
  }
  return pNorm;
}

/**
 * Expande registros con códigos multi-puesto (ej. "024-027") en registros individuales.
 * Aplica además la distinción automática "-VEHICULO" a cada puesto desglosado.
 */
export function expandirRegistrosMultiPuesto(
  registros: ImportacionRegistro[]
): ImportacionRegistro[] {
  const expandidos: ImportacionRegistro[] = [];
  for (const reg of registros) {
    const desglosados = desglosarCodigosPuestoMultiples(reg.puesto || "-");
    if (desglosados.length <= 1) {
      const pOriginal = desglosados[0] || reg.puesto || "-";
      const pConDistincion = aplicarSufijoVehiculoPorActividad(pOriginal, reg.actividad);
      if (pConDistincion !== pOriginal) {
        expandidos.push({
          ...reg,
          puesto: pConDistincion,
          numBodega: pConDistincion,
        });
      } else {
        expandidos.push(reg);
      }
    } else {
      for (const p of desglosados) {
        const pConDistincion = aplicarSufijoVehiculoPorActividad(p, reg.actividad);
        expandidos.push({
          ...reg,
          puesto: pConDistincion,
          numBodega: pConDistincion,
        });
      }
    }
  }
  return expandidos;
}

/**
 * Filtra registros 100% duplicados dentro de un lote (mismo nombre + misma actividad + mismo puesto).
 * Conserva la primera aparición y retorna la lista de duplicados omitidos para auditoría visual.
 */
export function filtrarDuplicadosExactos100(
  registros: ImportacionRegistro[]
): { registrosUnicos: ImportacionRegistro[]; duplicadosOmitidos: ImportacionRegistro[] } {
  const registrosUnicos: ImportacionRegistro[] = [];
  const duplicadosOmitidos: ImportacionRegistro[] = [];
  const clavesVistas = new Set<string>();

  for (const reg of registros) {
    const nombreClave = normalizarNombreCompleto(reg.nombre || reg.contribuyente || "");
    const actividadClave = (reg.actividad || "")
      .normalize("NFC")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    const puestoClave = (reg.puesto || "")
      .normalize("NFC")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    const claveExacta = `${nombreClave}||${actividadClave}||${puestoClave}`;

    if (clavesVistas.has(claveExacta)) {
      duplicadosOmitidos.push(reg);
    } else {
      clavesVistas.add(claveExacta);
      registrosUnicos.push(reg);
    }
  }

  return { registrosUnicos, duplicadosOmitidos };
}

/**
 * Identifica si un identificador o nombre corresponde a la nave de Puestos Ambulantes.
 */
export function esNaveAmbulantes(nave?: string | null): boolean {
  if (!nave) return false;
  const u = nave.normalize("NFC").trim().toUpperCase();
  return (
    u === "AMBULANTES" ||
    u === "PUESTOS AMBULANTES" ||
    u.includes("AMBULANTE")
  );
}

/**
 * REGLA 2: Asignación secuencial General01, General02, ..., GeneralN EXCLUSIVA para AMBULANTES.
 * Solo afecta a la nave AMBULANTES.
 * A puestos nulos, vacíos ("NULL", "S/N", "", "-") o duplicados en el lote de Ambulantes,
 * les asigna secuencialmente un identificador GeneralXX (sin colisionar con puestos existentes).
 */
export function aplicarReglaPuestosAmbulantes(
  registros: ImportacionRegistro[],
  contextoNaveOArchivo?: string
): ImportacionRegistro[] {
  if (!registros || registros.length === 0) return registros;

  const esAmbulantesPorContexto = Boolean(
    contextoNaveOArchivo && (
      esNaveAmbulantes(contextoNaveOArchivo) ||
      contextoNaveOArchivo.toUpperCase().includes("AMBULANTE") ||
      contextoNaveOArchivo.toUpperCase() === "NAVE" ||
      contextoNaveOArchivo.toUpperCase() === "(NAVE)"
    )
  );

  const esAmbulantesPorRegistros = registros.some((r) => esNaveAmbulantes(r.nave));

  if (!esAmbulantesPorContexto && !esAmbulantesPorRegistros) {
    return registros;
  }

  const esPuestoNuloOVacio = (p?: string | null): boolean => {
    if (!p) return true;
    const u = p.normalize("NFC").trim().toUpperCase();
    return (
      u === "" ||
      u === "-" ||
      u === "NULL" ||
      u === "S/N" ||
      u === "SN"
    );
  };

  const puestosVistos = new Set<string>();
  let contadorSecuencial = 1;

  return registros.map((reg) => {
    const puestoRaw = (reg.puesto || "").normalize("NFC").trim();
    const puestoUpper = puestoRaw.toUpperCase();

    if (!esPuestoNuloOVacio(puestoRaw) && !puestosVistos.has(puestoUpper)) {
      puestosVistos.add(puestoUpper);
      return reg;
    }

    // Puesto nulo/vacío o duplicado: generar GeneralXX disponible
    let nuevoCodigo = `General${String(contadorSecuencial).padStart(2, "0")}`;
    while (puestosVistos.has(nuevoCodigo.toUpperCase())) {
      contadorSecuencial++;
      nuevoCodigo = `General${String(contadorSecuencial).padStart(2, "0")}`;
    }

    puestosVistos.add(nuevoCodigo.toUpperCase());
    contadorSecuencial++;

    return {
      ...reg,
      puesto: nuevoCodigo,
      numBodega: nuevoCodigo,
    };
  });
}

/**
 * Distingue de forma inteligente entre Códigos de Bodegas/Locales y Códigos Numéricos de Puestos:
 * - Bodegas/Locales: Inician con BODEGA, CUBICULO, NUCLEO, LOCAL, ZCF o tienen formato con prefijo/sufijo de nave (N-H-01, N-02A-H).
 * - Puestos Numéricos: "001", "058-063", "125", "4A", "7".
 */
export function esCodigoTipoBodegaOLocal(codigo: string): boolean {
  if (!codigo) return false;
  const upper = codigo.normalize("NFC").trim().toUpperCase();

  if (
    upper.startsWith("BODEGA") ||
    upper.startsWith("CUBICULO") ||
    upper.startsWith("CUBÍCULO") ||
    upper.startsWith("NUCLEO") ||
    upper.startsWith("NÚCLEO") ||
    upper.startsWith("LOCAL") ||
    upper.startsWith("ZCF")
  ) {
    return true;
  }

  // Formato con prefijo o sufijo de nave (ej. N-H-01, N-02A-H, N-A-01, N-E-04, N-Ñ-01)
  if (/^N-(?:[A-ZÑ0-9]+-[A-Z0-9-]+|[A-Z0-9]+-[A-ZÑ])(?:[\s*].*)?$/i.test(upper)) {
    return true;
  }

  return false;
}

/**
 * Infiere el nombre estándar de la nave (ej. "NAVE H", "NAVE A", "NAVE Ñ", "NAVE CF") a partir de un código de puesto
 * Reconoce tanto prefijo de nave (N-H-01, N-Ñ-01) como sufijo de nave al final (N-02A-H, N-01-Ñ).
 */
export function inferirNaveDesdePuesto(codigoPuesto: string): string | null {
  if (!codigoPuesto) return null;
  const upper = codigoPuesto.normalize("NFC").trim().toUpperCase();
  if (upper.startsWith("ZCF-") || upper.includes("ZCF-")) {
    return "NAVE CF";
  }

  // 1. Caso N-[Stall]-[Nave] (ej. N-02A-H, N-01-A, N-01-Ñ) donde la nave es letra al final
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

/**
 * Normaliza y descompone cualquier código de puesto del mercado EP-EMA:
 * - Detecta categoría ("BODEGA", "CUBICULO", "NUCLEO")
 * - Conserva íntegros los puestos compuestos de doble plaza (ej. "058-063", "079-095", "082-091")
 * - Limpia prefijos espaciales y descriptivos
 * - Separa estrictamente el número base del sufijo alfanumérico (ej. "01" vs "01A", "07" vs "07A")
 */
export function descomponerCodigoPuesto(codigo: string): ComponentesCodigoPuesto {
  if (!codigo) {
    return {
      categoria: "",
      tokenFinal: "",
      numeroBase: "",
      sufijoAlfanumerico: "",
      esRangoCompuesto: false,
      rangoNormalizado: "",
    };
  }

  const upper = codigo.normalize("NFC").trim().toUpperCase().replace(/#/g, "").trim();

  // Protección contra colisiones para puestos de Ambulantes "GeneralXX" (REGLA 2)
  const matchGeneral = upper.match(/^GENERAL[-_\s]*(\d+)$/i);
  if (matchGeneral) {
    const rawNum = matchGeneral[1];
    const numInt = parseInt(rawNum, 10);
    const numPad = String(numInt).padStart(2, "0");
    return {
      categoria: "",
      tokenFinal: `GENERAL${numPad}`,
      numeroBase: String(numInt),
      sufijoAlfanumerico: "GENERAL",
      esRangoCompuesto: false,
      rangoNormalizado: "",
    };
  }

  // 1. Extraer categoría funcional
  let categoria: "BODEGA" | "CUBICULO" | "NUCLEO" | "" = "";
  if (upper.includes("BODEGA")) {
    categoria = "BODEGA";
  } else if (upper.includes("CUBICULO") || upper.includes("CUBÍCULO")) {
    categoria = "CUBICULO";
  } else if (upper.includes("NUCLEO") || upper.includes("NÚCLEO")) {
    categoria = "NUCLEO";
  }

  // 2. Limpiar palabras descriptivas y prefijos conocidos
  let token = upper
    .replace(/\bBODEGA\b/g, "")
    .replace(/\bCUBICULO\b/g, "")
    .replace(/\bCUBÍCULO\b/g, "")
    .replace(/\bNUCLEO\b/g, "")
    .replace(/\bNÚCLEO\b/g, "")
    .replace(/\bPUESTO\b/g, "")
    .replace(/\bLOCAL\b/g, "")
    .trim();

  // 3. Detectar puesto compuesto por rango (ej. "058-063", "079-095", "082-091", "58-63")
  const matchRango = token.match(/^(\d+)-(\d+)$/);
  if (matchRango) {
    const n1 = parseInt(matchRango[1], 10);
    const n2 = parseInt(matchRango[2], 10);
    return {
      categoria,
      tokenFinal: token,
      numeroBase: `${n1}-${n2}`,
      sufijoAlfanumerico: "",
      esRangoCompuesto: true,
      rangoNormalizado: `${n1}-${n2}`,
    };
  }

  // 4. Limpiar prefijo de nave o sufijo de nave:
  // Formato N-02A-H (nave al final precedida por código que empieza por dígito)
  const matchNaveFin = token.match(/^N-([0-9]+[A-Z0-9]*)-[A-ZÑ]$/i);
  // Formato N-H-01 (nave al inicio seguida por código)
  const matchNaveInicio = token.match(/^N-[A-ZÑ]+-(.+)$/i);
  const matchZcf = token.match(/^ZCF-(.+)$/i);

  if (matchNaveFin) {
    token = matchNaveFin[1].trim();
  } else if (matchNaveInicio) {
    token = matchNaveInicio[1].trim();
  } else if (matchZcf) {
    token = matchZcf[1].trim();
  }

  // Limpiar guiones o espacios iniciales/finales
  token = token.replace(/^[-_\s]+|[-_\s]+$/g, "").trim();

  // 5. Extraer número base y sufijo alfanumérico estricto (ej. "116" vs "116A", "003-A")
  const matchNum = token.match(/^(\d+)[-_]?([A-ZÑ]*)$/i);

  let numeroBase = "";
  let sufijoAlfanumerico = "";

  if (matchNum) {
    const rawNum = matchNum[1];
    numeroBase = String(parseInt(rawNum, 10)); // sin ceros a la izquierda
    sufijoAlfanumerico = (matchNum[2] || "").toUpperCase().trim();
  } else {
    const matchNumEnToken = token.match(/(\d+)[-_]?([A-ZÑ]*)$/i);
    if (matchNumEnToken) {
      numeroBase = String(parseInt(matchNumEnToken[1], 10));
      sufijoAlfanumerico = (matchNumEnToken[2] || "").toUpperCase().trim();
    } else {
      sufijoAlfanumerico = token.toUpperCase();
    }
  }

  return {
    categoria,
    tokenFinal: token,
    numeroBase,
    sufijoAlfanumerico,
    esRangoCompuesto: false,
    rangoNormalizado: "",
  };
}

/**
 * Regla de Oro de Comparación de Puestos:
 * - Dos códigos son equivalentes si tienen el mismo numeroBase Y exactamente el mismo sufijoAlfanumerico.
 * - "116" ("116", "") y "116A" ("116", "A") o "003-A" ("3", "A") son ESTRICTAMENTE DIFERENTES.
 * - Un código de tipo Bodega/Local (esCodigoTipoBodegaOLocal === true, ej. "N-N-01") JAMÁS es equivalente
 *   a un puesto numérico de nave abierta ("001" o "1").
 * - Códigos dobles como "058-063" y "079-095" se conservan íntegros y no colisionan con puestos unitarios.
 * - Si ambos especifican categoría y difieren ("BODEGA" !== "CUBICULO"), no son equivalentes.
 */
export function sonCodigosPuestosEquivalentes(cod1: string, cod2?: string | null): boolean {
  if (!cod1 || !cod2) return false;

  const c1 = cod1.normalize("NFC").trim().toUpperCase();
  const c2 = cod2.normalize("NFC").trim().toUpperCase();

  // Igualdad exacta
  if (c1 === c2) return true;

  // Un código de tipo Bodega/Local JAMÁS es equivalente a un puesto numérico de nave abierta
  if (esCodigoTipoBodegaOLocal(c1) !== esCodigoTipoBodegaOLocal(c2)) {
    return false;
  }

  const d1 = descomponerCodigoPuesto(c1);
  const d2 = descomponerCodigoPuesto(c2);

  // Si uno o ambos son rangos compuestos
  if (d1.esRangoCompuesto || d2.esRangoCompuesto) {
    if (d1.esRangoCompuesto && d2.esRangoCompuesto) {
      return d1.rangoNormalizado === d2.rangoNormalizado;
    }
    return false;
  }

  // Si ambos tienen número base
  if (d1.numeroBase && d2.numeroBase) {
    // Deben tener el mismo número base
    if (d1.numeroBase !== d2.numeroBase) return false;

    // Y EXACTAMENTE el mismo sufijo ("01" !== "01A", "116" !== "116A", "003" !== "003-A")
    if (d1.sufijoAlfanumerico !== d2.sufijoAlfanumerico) return false;

    // Si ambos especificaron categoría, deben coincidir
    if (d1.categoria && d2.categoria && d1.categoria !== d2.categoria) {
      return false;
    }

    return true;
  }

  // Si no tienen número base, comparar token final limpio
  if (d1.tokenFinal && d2.tokenFinal) {
    return d1.tokenFinal === d2.tokenFinal;
  }

  return false;
}

/**
 * Comparador canónico de códigos de puesto según la secuencia real del mercado:
 * 1. Puestos numéricos con o sin sufijo (ej. 001..062, 062A, 063, 063A, 064, 064A..126, 003-A):
 *    Se ordenan por su número base entero (parseInt) primero, y luego por su sufijo ("" antes que "A").
 * 2. Códigos estructurales y de bodegas (N-N-01, N-N-02, BODEGA N-A-01, etc.):
 *    Se ordenan después de los puestos numéricos por categoría y orden alfanumérico natural.
 */
export function compararCodigosPuesto(codigoA: string, codigoB: string): number {
  const a = (codigoA || "").trim();
  const b = (codigoB || "").trim();
  if (a === b) return 0;

  const matchA = a.match(/^(\d+)[-_]?([A-ZÑ]*)$/i);
  const matchB = b.match(/^(\d+)[-_]?([A-ZÑ]*)$/i);

  // Si ambos son puestos numéricos (con o sin sufijo de letra)
  if (matchA && matchB) {
    const numA = parseInt(matchA[1], 10);
    const numB = parseInt(matchB[1], 10);
    if (numA !== numB) {
      return numA - numB;
    }
    const sufA = (matchA[2] || "").toUpperCase();
    const sufB = (matchB[2] || "").toUpperCase();
    return sufA.localeCompare(sufB);
  }

  // Puestos numéricos van antes que códigos de bodegas/estructurales
  if (matchA && !matchB) return -1;
  if (!matchA && matchB) return 1;

  // Entre no-numéricos, ordenar por categoría y orden natural
  const getCategoriaPeso = (c: string): number => {
    const u = c.toUpperCase();
    if (u.startsWith("N-") || u.startsWith("P-")) return 1;
    if (u.startsWith("BODEGA")) return 2;
    if (u.startsWith("CUBICULO") || u.startsWith("CUBÍCULO")) return 3;
    if (u.startsWith("NUCLEO") || u.startsWith("NÚCLEO")) return 4;
    if (u.startsWith("LOCAL")) return 5;
    if (u.startsWith("ZCF") || u.startsWith("ZONA")) return 6;
    return 7;
  };

  const pesoA = getCategoriaPeso(a);
  const pesoB = getCategoriaPeso(b);
  if (pesoA !== pesoB) return pesoA - pesoB;

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function ordenarPuestos<T extends { codigo: string }>(puestos: T[]): T[] {
  return [...puestos].sort((a, b) => compararCodigosPuesto(a.codigo, b.codigo));
}

/**
 * Normaliza nombres de contribuyentes para comparación exacta de personas:
 * - Mayúsculas
 * - Quita tildes diacríticas
 * - Quita signos de puntuación superfluos
 * - Colapsa espacios múltiples
 * NUNCA compara por iniciales ni por una sola palabra.
 */
export function normalizarNombreCompleto(nombre: string): string {
  if (!nombre) return "";
  return nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^A-Z0-9\s]/g, " ")     // quita signos
    .replace(/\s+/g, " ")             // colapsa espacios
    .trim();
}

/**
 * Comprueba si dos contribuyentes son la misma persona:
 * - Misma cédula válida, o
 * - Mismo nombre completo normalizado exacto
 */
export function sonMismoContribuyente(
  com1: { contribuyente?: string; nombre?: string; cedula?: string },
  com2: { contribuyente?: string; nombre?: string; cedula?: string }
): boolean {
  const ced1 = (com1.cedula || "").trim();
  const ced2 = (com2.cedula || "").trim();

  if (ced1 && ced2 && ced1 !== "-" && ced2 !== "-" && ced1 === ced2) {
    return true;
  }

  const nom1 = normalizarNombreCompleto(com1.nombre || com1.contribuyente || "");
  const nom2 = normalizarNombreCompleto(com2.nombre || com2.contribuyente || "");

  if (nom1 && nom2 && nom1 === nom2) {
    return true;
  }

  return false;
}

export interface PuestoNaveBD {
  id: string;
  codigo: string;
  naveId: string;
  estado: string;
  comercianteId: string | null;
}

export interface ComercianteNaveBD {
  idInterno: string;
  ciu: string;
  cedula: string;
  contribuyente: string;
  actividad: string;
  puestoId: string | null;
  nave?: string | null;
  estadoRegistro: string;
}

export interface ResultadoReconciliacionEjecucion {
  reconciliacion: ReconciliacionResumen;
  asignacionesOcupar: Array<{
    puestoId: string;
    puestoCodigo: string;
    comercianteId: string;
    esNuevoComerciante: boolean;
    esNuevoPuesto?: boolean;
    datosComerciante: {
      ciu: string;
      cedula: string;
      contribuyente: string;
      actividad: string;
      puestoId: string;
      nave: string;
    };
  }>;
  puestosAVacante: Array<{
    puestoId: string;
    puestoCodigo: string;
    comercianteSalienteId: string | null;
  }>;
}

/**
 * Algoritmo de Reconciliación Inteligente con Soporte para Subconjuntos (Bodegas vs Puestos):
 * - Si entran solo Puestos Numéricos (ej. 122 puestos), las Bodegas existentes (ej. 4 bodegas) NO se tocan ni pasan a Vacante.
 * - Si entran solo Bodegas, los Puestos Numéricos existentes NO se tocan.
 * - Los nuevos puestos que no existían en la nave se agregan sumando a la capacidad real, NUNCA imponiendo 100 por defecto.
 */
export function reconciliarCatastroNaveExistente(
  registros: ImportacionRegistro[],
  nave: { id: string; nombre: string; cantidadPuestos: number },
  puestosNave: PuestoNaveBD[],
  comerciantesNave: ComercianteNaveBD[]
): ResultadoReconciliacionEjecucion {
  const cambiosDetectados: CambioReconciliacion[] = [];
  const puestosAsignadosIds = new Set<string>();
  const comerciantesProcesadosIds = new Set<string>();
  const registrosProcesadosIndices = new Set<number>();

  const asignacionesOcupar: ResultadoReconciliacionEjecucion["asignacionesOcupar"] = [];
  const puestosAVacante: ResultadoReconciliacionEjecucion["puestosAVacante"] = [];

  // ── Calcular el máximo número base y formato de ceros del Excel entrante ──
  let maxNumeroPuroExcel = 0;
  let padLengthExcel = 1;

  for (const reg of registros) {
    const rawCod = (reg.puesto || "").trim();
    if (/^\d+$/.test(rawCod)) {
      const num = parseInt(rawCod, 10);
      if (num > maxNumeroPuroExcel) {
        maxNumeroPuroExcel = num;
      }
      if (rawCod.length > padLengthExcel) {
        padLengthExcel = rawCod.length;
      }
    }
  }

  // ── Detección de Subconjunto de Registros Entrantes ──
  const todosSonBodegas =
    registros.length > 0 &&
    registros.every((r) => esCodigoTipoBodegaOLocal(r.puesto || ""));
  const todosSonPuestosNumericos =
    registros.length > 0 &&
    registros.every((r) => !esCodigoTipoBodegaOLocal(r.puesto || ""));

  // Filtrar los puestos de la nave que participan en la reconciliación según la categoría entrante:
  const puestosNaveParticipantes = puestosNave.filter((p) => {
    if (todosSonBodegas) {
      // Participan puestos de bodega O puestos vacantes no asignados (para permitir que bodegas ocupen vacantes preexistentes)
      const esBodega = esCodigoTipoBodegaOLocal(p.codigo);
      const com = p.comercianteId ? comerciantesNave.find((c) => c.idInterno === p.comercianteId) : null;
      const comEsBodega = com ? esCodigoTipoBodegaOLocal(com.puestoId || "") : false;
      const esVacanteLibre = p.estado === "Vacante" && !p.comercianteId;
      return esBodega || comEsBodega || esVacanteLibre;
    }
    if (todosSonPuestosNumericos) {
      // Participan puestos numéricos O puestos vacantes no asignados (pero NUNCA bodegas ocupadas)
      const esBodega = esCodigoTipoBodegaOLocal(p.codigo);
      const com = p.comercianteId ? comerciantesNave.find((c) => c.idInterno === p.comercianteId) : null;
      const comEsBodega = com ? esCodigoTipoBodegaOLocal(com.puestoId || "") : false;
      const esVacanteLibre = p.estado === "Vacante" && !p.comercianteId;
      return (!esBodega && !comEsBodega) || esVacanteLibre;
    }
    return true; // mixto: participan todos
  });

  const puestosNaveNoParticipantes = puestosNave.filter((p) => {
    return !puestosNaveParticipantes.some((part) => part.id === p.id);
  });

  // ── PASO 1: Comparar Contribuyentes Existentes en la Sección Participante ─────

  // Subpaso 1A: Mismo Contribuyente que permanece en su MISMO Puesto (o placeholder sobrante)
  for (let idx = 0; idx < registros.length; idx++) {
    const reg = registros[idx];
    const candidatos = comerciantesNave.filter(
      (c) =>
        !comerciantesProcesadosIds.has(c.idInterno) &&
        sonMismoContribuyente(c, { contribuyente: reg.nombre, cedula: reg.cedula })
    );

    if (candidatos.length === 0) continue;

    // Buscar si algún candidato ya ocupa o tiene asignado este mismo puesto
    let comMismoPuesto: ComercianteNaveBD | null = null;
    let puestoActualMatch: PuestoNaveBD | null = null;

    for (const cand of candidatos) {
      const pActual = puestosNaveParticipantes.find((p) => p.comercianteId === cand.idInterno);
      const candStallId = cand.puestoId || "";
      const matchesDirect =
        (pActual && sonCodigosPuestosEquivalentes(pActual.codigo, reg.puesto)) ||
        sonCodigosPuestosEquivalentes(candStallId, reg.puesto);

      // Si el contribuyente ya tiene un puesto en la nave y es el único registro en el archivo para esta persona
      const esUnicoRegistroParaPersona =
        candidatos.length === 1 &&
        !registros.some(
          (r, rIdx) => rIdx !== idx && sonMismoContribuyente({ contribuyente: r.nombre, cedula: r.cedula }, cand)
        );

      if (matchesDirect || (pActual && esUnicoRegistroParaPersona)) {
        comMismoPuesto = cand;
        puestoActualMatch =
          pActual ||
          puestosNaveParticipantes.find((p) => sonCodigosPuestosEquivalentes(p.codigo, reg.puesto)) ||
          null;
        break;
      }
    }

    if (comMismoPuesto && puestoActualMatch) {
      const codigoExcel = (reg.puesto || "").trim().toUpperCase();

      // Buscar si existe en la nave un puesto que coincida exactamente o por equivalencia con el código del Excel
      let puestoDestino = puestosNaveParticipantes.find(
        (p) => !puestosAsignadosIds.has(p.id) && sonCodigosPuestosEquivalentes(p.codigo, codigoExcel)
      );

      // Si no existe pero el puesto que ocupaba antes era un placeholder sobrante (> maxNumeroPuroExcel),
      // o coincide con su puesto actual, o es el único registro para la persona (REGLA 1: actualización de código en sitio):
      if (!puestoDestino) {
        const esPlaceholderSobrante =
          maxNumeroPuroExcel > 0 &&
          /^\d+$/.test(puestoActualMatch.codigo.trim()) &&
          parseInt(puestoActualMatch.codigo.trim(), 10) > maxNumeroPuroExcel;

        const esUnicoRegistroParaPersona =
          candidatos.length === 1 &&
          !registros.some(
            (r, rIdx) =>
              rIdx !== idx &&
              sonMismoContribuyente({ contribuyente: r.nombre, cedula: r.cedula }, comMismoPuesto!)
          );

        if (
          esPlaceholderSobrante ||
          sonCodigosPuestosEquivalentes(puestoActualMatch.codigo, codigoExcel) ||
          esUnicoRegistroParaPersona
        ) {
          puestoDestino = puestoActualMatch;
        }
      }

      if (puestoDestino) {
        // El código ganador SIEMPRE debe ser el código del Excel
        const codigoPuestoFinal = (codigoExcel && codigoExcel !== "-")
          ? codigoExcel
          : puestoDestino.codigo;

        // Solo detectar ACTUALIZACION si los datos cambiaron significativamente (idempotencia estricta)
        const actActual = (comMismoPuesto.actividad || "").trim().toUpperCase();
        const actNueva = (reg.actividad || "General").trim().toUpperCase();
        const cambioAct =
          actActual && actNueva && actActual !== "GENERAL" && actNueva !== "GENERAL" && actActual !== actNueva;

        const ciuActual = (comMismoPuesto.ciu || "").trim();
        const ciuNuevo = (reg.ciu || "").trim();
        const cambioCiu =
          ciuNuevo &&
          ciuNuevo !== "S/N" &&
          ciuNuevo !== "-" &&
          ciuActual &&
          ciuActual !== "S/N" &&
          ciuActual !== "-" &&
          ciuActual !== ciuNuevo;

        if (cambioAct || cambioCiu) {
          cambiosDetectados.push({
            tipo: "ACTUALIZACION",
            puesto: codigoPuestoFinal,
            anterior: `${comMismoPuesto.contribuyente} (${comMismoPuesto.actividad})`,
            nuevo: `${reg.nombre} (${reg.actividad || "General"})`,
            detalle: `Datos actualizados para ${reg.nombre} (${reg.actividad || "General"}) en puesto ${codigoPuestoFinal}`,
          });
        }

        puestosAsignadosIds.add(puestoDestino.id);
        comerciantesProcesadosIds.add(comMismoPuesto.idInterno);
        registrosProcesadosIndices.add(idx);

        asignacionesOcupar.push({
          puestoId: puestoDestino.id,
          puestoCodigo: codigoPuestoFinal,
          comercianteId: comMismoPuesto.idInterno,
          esNuevoComerciante: false,
          datosComerciante: {
            ciu: reg.ciu && reg.ciu !== "-" ? reg.ciu : comMismoPuesto.ciu || "S/N",
            cedula: reg.cedula || comMismoPuesto.cedula,
            contribuyente: reg.nombre || comMismoPuesto.contribuyente,
            actividad: reg.actividad || comMismoPuesto.actividad || "General",
            puestoId: codigoPuestoFinal,
            nave: nave.nombre,
          },
        });
      }
    }
  }

  // Subpaso 1B: Mismo Contribuyente que realmente CAMBIÓ de Puesto
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    const reg = registros[idx];

    const candidatos = comerciantesNave.filter(
      (c) =>
        !comerciantesProcesadosIds.has(c.idInterno) &&
        sonMismoContribuyente(c, { contribuyente: reg.nombre, cedula: reg.cedula })
    );

    if (candidatos.length === 0) continue;

    const comCambio = candidatos[0];
    const puestoActual = puestosNaveParticipantes.find((p) => p.comercianteId === comCambio.idInterno);
    const codigoExcel = (reg.puesto || "").trim().toUpperCase();
    let puestoNuevoArchivo = puestosNaveParticipantes.find((p) =>
      !puestosAsignadosIds.has(p.id) && sonCodigosPuestosEquivalentes(p.codigo, codigoExcel)
    );

    // Si no existe pero su puesto actual era placeholder sobrante (> maxNumeroPuroExcel), reutilizarlo
    if (!puestoNuevoArchivo && puestoActual) {
      const esPlaceholderSobrante =
        maxNumeroPuroExcel > 0 &&
        /^\d+$/.test(puestoActual.codigo.trim()) &&
        parseInt(puestoActual.codigo.trim(), 10) > maxNumeroPuroExcel;

      if (esPlaceholderSobrante) {
        puestoNuevoArchivo = puestoActual;
      }
    }

    if (
      puestoActual &&
      puestoNuevoArchivo &&
      !puestosAsignadosIds.has(puestoNuevoArchivo.id)
    ) {
      const codigoPuestoFinal = (codigoExcel && codigoExcel !== "-")
        ? codigoExcel
        : puestoNuevoArchivo.codigo;

      if (puestoActual.id !== puestoNuevoArchivo.id) {
        cambiosDetectados.push({
          tipo: "CAMBIO_PUESTO",
          puesto: codigoPuestoFinal,
          anterior: puestoActual.codigo,
          nuevo: codigoPuestoFinal,
          detalle: `${comCambio.contribuyente} pasó del puesto ${puestoActual.codigo} al puesto ${codigoPuestoFinal}`,
        });
      }

      puestosAsignadosIds.add(puestoNuevoArchivo.id);
      comerciantesProcesadosIds.add(comCambio.idInterno);
      registrosProcesadosIndices.add(idx);

      asignacionesOcupar.push({
        puestoId: puestoNuevoArchivo.id,
        puestoCodigo: codigoPuestoFinal,
        comercianteId: comCambio.idInterno,
        esNuevoComerciante: false,
        datosComerciante: {
          ciu: reg.ciu || comCambio.ciu || "S/N",
          cedula: reg.cedula || comCambio.cedula,
          contribuyente: reg.nombre || comCambio.contribuyente,
          actividad: reg.actividad || comCambio.actividad || "General",
          puestoId: codigoPuestoFinal,
          nave: nave.nombre,
        },
      });
    }
  }

  // ── PASO 2: Contribuyentes Nuevos y Asignaciones ──────────────────────────
  // Puestos libres en la sección participante
  const puestosLibres = puestosNaveParticipantes.filter((p) => !puestosAsignadosIds.has(p.id));

  // Subpaso 2A: Coincidencia por código de puesto equivalente
  const esRegBodegaGlobal = todosSonBodegas;
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    const regNuevo = registros[idx];
    const esRegBodega = esRegBodegaGlobal || esCodigoTipoBodegaOLocal(regNuevo.puesto || "");

    const idxPuestoMatch = puestosLibres.findIndex((p) => {
      if (!sonCodigosPuestosEquivalentes(p.codigo, regNuevo.puesto)) {
        return false;
      }
      // Regla anti-colisión: Si el puesto está ocupado por alguien de otra categoría, NO tomarlo
      if (p.comercianteId) {
        const comActual = comerciantesNave.find((c) => c.idInterno === p.comercianteId);
        const comEsBodega = comActual ? esCodigoTipoBodegaOLocal(comActual.puestoId || "") : false;
        if (esRegBodega !== comEsBodega) {
          return false;
        }
      }
      return true;
    });

    if (idxPuestoMatch !== -1) {
      const puestoMatch = puestosLibres[idxPuestoMatch];
      puestosLibres.splice(idxPuestoMatch, 1);
      puestosAsignadosIds.add(puestoMatch.id);
      registrosProcesadosIndices.add(idx);

      const codigoExcel = (regNuevo.puesto || "").trim().toUpperCase();
      const codigoPuestoFinal = (codigoExcel && codigoExcel !== "-")
        ? codigoExcel
        : puestoMatch.codigo;

      const comSaliente = puestoMatch.comercianteId
        ? comerciantesNave.find((c) => c.idInterno === puestoMatch.comercianteId)
        : null;

      if (comSaliente && !sonMismoContribuyente(comSaliente, { contribuyente: regNuevo.nombre, cedula: regNuevo.cedula })) {
        cambiosDetectados.push({
          tipo: "REEMPLAZO_OCUPANTE",
          puesto: codigoPuestoFinal,
          anterior: comSaliente.contribuyente,
          nuevo: regNuevo.nombre,
          detalle: `Puesto ${codigoPuestoFinal}: Se reemplazó a ${comSaliente.contribuyente} por ${regNuevo.nombre}`,
        });
      } else {
        cambiosDetectados.push({
          tipo: "NUEVO",
          puesto: codigoPuestoFinal,
          nuevo: regNuevo.nombre,
          detalle: `Nuevo comerciante ${regNuevo.nombre} asignado al puesto ${codigoPuestoFinal}`,
        });
      }

      asignacionesOcupar.push({
        puestoId: puestoMatch.id,
        puestoCodigo: codigoPuestoFinal,
        comercianteId: crypto.randomUUID(),
        esNuevoComerciante: true,
        datosComerciante: {
          ciu: regNuevo.ciu || "S/N",
          cedula: regNuevo.cedula,
          contribuyente: regNuevo.nombre,
          actividad: regNuevo.actividad || "General",
          puestoId: codigoPuestoFinal,
          nave: nave.nombre,
        },
      });
    }
  }

  // Subpaso 2B: Asignar nuevos restantes SIN alterar puestos vacantes internos (<= maxNumeroPuroExcel)
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    const regNuevo = registros[idx];
    const codigoExcel = (regNuevo.puesto || "").trim().toUpperCase();
    const codigoPuestoFinal = (codigoExcel && codigoExcel !== "-")
      ? codigoExcel
      : `PUESTO-${idx + 1}`;

    // Buscar únicamente si existe un puesto placeholder sobrante de cola (> maxNumeroPuroExcel)
    let idxPlaceholderSobrante = -1;
    if (maxNumeroPuroExcel > 0) {
      idxPlaceholderSobrante = puestosLibres.findIndex((p) => {
        if (p.comercianteId !== null) return false;
        const codTrim = p.codigo.trim();
        if (!/^\d+$/.test(codTrim)) return false;
        const numP = parseInt(codTrim, 10);
        return numP > maxNumeroPuroExcel;
      });
    }

    if (idxPlaceholderSobrante !== -1) {
      // Reutilizar el placeholder de cola (> maxNumeroPuroExcel, ej. 127) y renombrarlo al código del Excel
      const puestoPlaceholder = puestosLibres[idxPlaceholderSobrante];
      puestosLibres.splice(idxPlaceholderSobrante, 1);
      puestosAsignadosIds.add(puestoPlaceholder.id);
      registrosProcesadosIndices.add(idx);

      cambiosDetectados.push({
        tipo: "NUEVO",
        puesto: codigoPuestoFinal,
        nuevo: regNuevo.nombre,
        detalle: `Puesto ${codigoPuestoFinal}: Asignado a ${regNuevo.nombre} (reutilizando placeholder ${puestoPlaceholder.codigo})`,
      });

      asignacionesOcupar.push({
        puestoId: puestoPlaceholder.id,
        puestoCodigo: codigoPuestoFinal,
        comercianteId: crypto.randomUUID(),
        esNuevoComerciante: true,
        esNuevoPuesto: false,
        datosComerciante: {
          ciu: regNuevo.ciu || "S/N",
          cedula: regNuevo.cedula,
          contribuyente: regNuevo.nombre,
          actividad: regNuevo.actividad || "General",
          puestoId: codigoPuestoFinal,
          nave: nave.nombre,
        },
      });
    } else {
      // Si no hay placeholders sobrantes de cola (> maxNumeroPuroExcel), crearlo como puesto nuevo
      const nuevoPuestoId = crypto.randomUUID();
      puestosAsignadosIds.add(nuevoPuestoId);
      registrosProcesadosIndices.add(idx);

      cambiosDetectados.push({
        tipo: "NUEVO",
        puesto: codigoPuestoFinal,
        nuevo: regNuevo.nombre,
        detalle: `Puesto ${codigoPuestoFinal}: Nuevo comerciante ${regNuevo.nombre} asignado`,
      });

      asignacionesOcupar.push({
        puestoId: nuevoPuestoId,
        puestoCodigo: codigoPuestoFinal,
        comercianteId: crypto.randomUUID(),
        esNuevoComerciante: true,
        esNuevoPuesto: true,
        datosComerciante: {
          ciu: regNuevo.ciu || "S/N",
          cedula: regNuevo.cedula,
          contribuyente: regNuevo.nombre,
          actividad: regNuevo.actividad || "General",
          puestoId: codigoPuestoFinal,
          nave: nave.nombre,
        },
      });
    }
  }

  // ── PASO 3: Puestos de la Sección Participante que Quedan Vacantes ──────────
  for (const puestoRestante of puestosLibres) {
    let codigoVacante = puestoRestante.codigo;

    // Si es un número entero puro <= maxNumeroPuroExcel (ej. "64") y padLengthExcel > 1 (ej. 3),
    // formatear con el padding del Excel ("064")
    if (maxNumeroPuroExcel > 0 && /^\d+$/.test(puestoRestante.codigo.trim())) {
      const numP = parseInt(puestoRestante.codigo.trim(), 10);
      if (numP <= maxNumeroPuroExcel && padLengthExcel > 1) {
        codigoVacante = String(numP).padStart(padLengthExcel, "0");
      }
    }

    const teniaOcupante = Boolean(puestoRestante.comercianteId || puestoRestante.estado === "Ocupado");
    const comSaliente = puestoRestante.comercianteId
      ? comerciantesNave.find((c) => c.idInterno === puestoRestante.comercianteId)
      : null;

    if (teniaOcupante) {
      cambiosDetectados.push({
        tipo: "VACANTE",
        puesto: codigoVacante,
        anterior: comSaliente ? comSaliente.contribuyente : "Ocupante anterior",
        detalle: `Puesto ${codigoVacante} queda Vacante (anterior ocupante: ${
          comSaliente ? comSaliente.contribuyente : "No identificado"
        })`,
      });
    }

    puestosAVacante.push({
      puestoId: puestoRestante.id,
      puestoCodigo: codigoVacante,
      comercianteSalienteId:
        puestoRestante.comercianteId &&
        !comerciantesProcesadosIds.has(puestoRestante.comercianteId)
          ? puestoRestante.comercianteId
          : null,
    });
  }

  // ── PASO 4: Conteo Real de Capacidad (Suma de Puestos Reales) ──
  const ocupadosParticipantes = puestosAsignadosIds.size;
  const ocupadosNoParticipantes = puestosNaveNoParticipantes.filter(
    (p) => p.estado === "Ocupado" || p.comercianteId !== null
  ).length;

  const totalOcupados = ocupadosParticipantes + ocupadosNoParticipantes;

  const vacantesParticipantes = puestosLibres.length;
  const vacantesNoParticipantes = puestosNaveNoParticipantes.filter(
    (p) => p.estado === "Vacante" && p.comercianteId === null
  ).length;
  const totalVacantes = vacantesParticipantes + vacantesNoParticipantes;
  const capacidadNave = totalOcupados + totalVacantes;

  return {
    reconciliacion: {
      naveDetectada: nave.nombre,
      esNaveNueva: false,
      capacidadNave,
      totalOcupados,
      totalVacantes,
      cambiosDetectados,
      esArchivoBodegas: todosSonBodegas,
    },
    asignacionesOcupar,
    puestosAVacante,
  };
}
