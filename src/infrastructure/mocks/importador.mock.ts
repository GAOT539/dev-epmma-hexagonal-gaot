// ── Infraestructura: Mock del Importador XML/CSV/XLS/XLSX ───────────────────────

import * as XLSX from "xlsx";
import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import { getNaves, agregarComerciante } from "./mercado.mock";

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

function esMetros(strVal: string): boolean {
  if (esSinNumero(strVal)) return false;

  const upper = strVal.toUpperCase().trim();

  // Unidad explícita de metros (ej. "6.0 MTS", "6 M2", "6 MTS")
  if (/\b(mts?|m2|metros)\b/i.test(upper)) {
    return true;
  }

  // Detección de metros y números < 100 (ej. 6.0, 8.5, 12, 1)
  const normalizado = strVal.trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(normalizado)) {
    const numFloat = parseFloat(normalizado);
    if (!isNaN(numFloat) && numFloat < 100) {
      return true;
    }
  }

  return false;
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

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    // Obtener celdas con contenido real estandarizadas a mayúsculas
    const celdasValidas = row
      .map((c) => String(c ?? "").trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (celdasValidas.length === 0) continue;

    // 1. Detección de Comerciante (La Llave):
    // Busca en la fila un string de 10 o 13 dígitos numéricos puros (Cédula / RUC)
    let cedulaEncontrada = "";
    let cedulaIndex = -1;

    for (let i = 0; i < row.length; i++) {
      const valStr = String(row[i] ?? "").trim();
      if (/^\d{10}(\d{3})?$/.test(valStr)) {
        cedulaEncontrada = valStr;
        cedulaIndex = i;
        break;
      }
    }

    if (!cedulaEncontrada) {
      // ── Fila de contexto (no es comerciante) ──

      // Detección de Nave:
      // Si en la fila encuentras un string que incluya la palabra "NAVE" o "(NAVE)", actualiza naveActual eliminando comillas dobles
      const cellNave = celdasValidas.find((s) => {
        return s.includes("NAVE") || s.includes("(NAVE)");
      });

      if (cellNave) {
        naveActual = cellNave
          .replace(/"/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();
        continue;
      }

      // Captura Inteligente de "Actividad" en Memoria:
      // Si no tiene cédula pero sí texto válido, verificar que no contenga palabras clave de cabecera
      const palabrasCabecera = [
        "CEDULA",
        "CÉDULA",
        "NOMBRES",
        "NOMBRE",
        "PAG",
        "PÁGINA",
        "PAGINA",
        "PÁG",
        "EMITIDO",
        "EMISION",
        "EMISIÓN",
        "RECIBIDO",
        "NAVE",
        "TOTAL",
        "SUBTOTAL",
        "FECHA",
        "HORA",
        "REPORTE",
      ];

      const textosActividadCandidatos = celdasValidas.filter((s) => {
        // Descartar si es numérico
        if (!isNaN(Number(s)) || /^\d+([.,]\d+)?$/.test(s)) return false;
        // Descartar fechas u horas o basura
        if (esFechaOBasura(null, s)) return false;
        // Descartar palabras clave de cabecera
        if (palabrasCabecera.some((p) => s.includes(p))) return false;
        return s.length > 1;
      });

      if (textosActividadCandidatos.length > 0) {
        // Asume que ese texto (el más largo de esa fila) es el subtítulo de la actividad
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
    const itemsRestantes: string[] = [];

    for (let i = 0; i < row.length; i++) {
      if (i === cedulaIndex) continue; // Descartar cédula

      const rawVal = row[i];
      if (rawVal === null || rawVal === undefined) continue;

      const strVal = String(rawVal).trim().toUpperCase();
      if (!strVal) continue;

      // 1. Elimina fechas y metadatos
      if (esFechaOBasura(rawVal, strVal)) {
        continue;
      }

      // 2. Elimina los Mts (números < 100)
      if (esMetros(strVal)) {
        continue;
      }

      itemsRestantes.push(strVal);
    }

    // Si la fila contiene explícitamente "S/N", cualquier valor numérico menor a 100
    // que haya quedado corresponde a los metros y se elimina
    const tieneSinNumero = itemsRestantes.some((s) => esSinNumero(s));
    const itemsLimpios = tieneSinNumero
      ? itemsRestantes.filter((s) => {
          if (esSinNumero(s)) return true;
          const num = parseFloat(s.replace(",", "."));
          return isNaN(num) || num <= 0 || num >= 100;
        })
      : itemsRestantes;

    // Ordenar los textos restantes por longitud de mayor a menor
    const stringsOrdenados = [...itemsLimpios].sort(
      (a, b) => b.length - a.length
    );

    // 1. Nombre: Será el texto más largo
    let nombre = "SIN NOMBRE";
    if (stringsOrdenados.length > 0) {
      // Priorizar texto descriptivo del nombre que no sea prefijo técnico de bodega
      let idxNombre = stringsOrdenados.findIndex(
        (s) => !s.startsWith("BODEGA ") && !s.startsWith("BOD.")
      );
      if (idxNombre === -1) idxNombre = 0;

      nombre = stringsOrdenados[idxNombre].trim().toUpperCase();
      stringsOrdenados.splice(idxNombre, 1);
    }

    // 2. Actividad: ¡CRÍTICO! NUNCA intentar sacar la actividad de los textos de esta misma fila.
    // Utilizar SIEMPRE la variable actividadActual en memoria.
    const actividad = actividadActual.trim().toUpperCase() || "GENERAL";

    // 3. Puesto: De los textos que sobren en la fila (después de sacar el Nombre),
    // elegir el MÁS CORTO (ej. entre "BODEGA N-E-001" y "N-E-01", el más corto es "N-E-01").
    // Si no sobra ningún texto, asignar "-".
    let puesto = "-";
    if (stringsOrdenados.length > 0) {
      stringsOrdenados.sort((a, b) => a.length - b.length);
      puesto = stringsOrdenados[0].trim().toUpperCase() || "-";
    }

    if (!puesto || !puesto.trim()) {
      puesto = "-";
    }

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

  return { exitosos, errores };
}

export function guardarImportacion(
  registros: ImportacionRegistro[]
): ImportacionResultado {
  const errores: { fila: number; mensaje: string }[] = [];
  let exitosos = 0;

  for (let i = 0; i < registros.length; i++) {
    const reg = registros[i];
    const nombre = (reg.nombre || reg.contribuyente || "").trim();

    if (!nombre || nombre.toUpperCase() === "SIN NOMBRE") {
      errores.push({
        fila: i + 1,
        mensaje: "Registro omitido: Nombre no especificado.",
      });
      continue;
    }

    try {
      agregarComerciante({
        ciu: reg.ciu && reg.ciu !== "-" ? reg.ciu : `CIU-IMP-${String(i + 1).padStart(4, "0")}`,
        cedula: reg.cedula,
        contribuyente: nombre,
        actividad: reg.actividad || "GENERAL",
        nave: reg.nave || "NO DEFINIDA",
        puestoId: reg.puesto && reg.puesto !== "-" ? reg.puesto : null,
        estadoRegistro: "Habilitado",
      });
      exitosos++;
    } catch {
      errores.push({
        fila: i + 1,
        mensaje: `Error al persistir comerciante "${nombre}"`,
      });
    }
  }

  return { exitosos, errores };
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
