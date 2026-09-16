// ── Infraestructura: Mock del Importador XML/CSV ─────────────────────────────

import type {
  ImportacionRegistro,
  ImportacionResultado,
} from "@/domain/models/comerciante.model";
import { getPuestosPorNave, getNaves } from "./mercado.mock";

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
    registros.push({
      nave: nave.nombre,
      contribuyente: CONTRIBUYENTES_EJEMPLO[i % CONTRIBUYENTES_EJEMPLO.length],
      numBodega: `B-${String(i + 1).padStart(3, "0")}`,
      gen01Codi: `GC-${String(i + 1).padStart(5, "0")}`,
    });
  }

  return registros;
}

// ── Simulación de importación ────────────────────────────────────────────────

export function simularImportacion(
  registros: ImportacionRegistro[]
): ImportacionResultado {
  const naves = getNaves();
  const errores: { fila: number; mensaje: string }[] = [];
  let exitosos = 0;

  for (let i = 0; i < registros.length; i++) {
    const reg = registros[i];

    // Validar que la nave existe
    const nave = naves.find(
      (n) => n.nombre.toLowerCase() === reg.nave.toLowerCase()
    );
    if (!nave) {
      errores.push({
        fila: i + 1,
        mensaje: `Nave "${reg.nave}" no encontrada en el sistema.`,
      });
      continue;
    }

    // Validar límite de puestos
    const puestosActuales = getPuestosPorNave(nave.id).length;
    if (puestosActuales >= nave.limitePuestos) {
      errores.push({
        fila: i + 1,
        mensaje: `Nave "${reg.nave}" ha alcanzado el límite de ${nave.limitePuestos} puestos. No se puede agregar el puesto ${puestosActuales + 1}.`,
      });
      continue;
    }

    // Validar campos obligatorios
    if (!reg.contribuyente.trim()) {
      errores.push({
        fila: i + 1,
        mensaje: "El campo Contribuyente es obligatorio.",
      });
      continue;
    }

    if (!reg.numBodega.trim()) {
      errores.push({
        fila: i + 1,
        mensaje: "El campo NumBodega es obligatorio.",
      });
      continue;
    }

    exitosos++;
  }

  return { exitosos, errores };
}

// ── Parseo simulado de XML ───────────────────────────────────────────────────

export function parsearXML(contenido: string): ImportacionRegistro[] {
  // Simulación simplificada del parseo XML
  const registros: ImportacionRegistro[] = [];
  const regex =
    /<Registro>[\s\S]*?<Nave>([\s\S]*?)<\/Nave>[\s\S]*?<Contribuyente>([\s\S]*?)<\/Contribuyente>[\s\S]*?<NumBodega>([\s\S]*?)<\/NumBodega>[\s\S]*?<Gen01Codi>([\s\S]*?)<\/Gen01Codi>[\s\S]*?<\/Registro>/g;

  let match;
  while ((match = regex.exec(contenido)) !== null) {
    registros.push({
      nave: match[1].trim(),
      contribuyente: match[2].trim(),
      numBodega: match[3].trim(),
      gen01Codi: match[4].trim(),
    });
  }

  return registros;
}

// ── Parseo simulado de CSV ───────────────────────────────────────────────────

export function parsearCSV(contenido: string): ImportacionRegistro[] {
  const lineas = contenido.trim().split("\n");
  if (lineas.length < 2) return [];

  // Saltar header
  return lineas.slice(1).map((linea) => {
    const [nave, contribuyente, numBodega, gen01Codi] = linea
      .split(",")
      .map((s) => s.trim());
    return {
      nave: nave ?? "",
      contribuyente: contribuyente ?? "",
      numBodega: numBodega ?? "",
      gen01Codi: gen01Codi ?? "",
    };
  });
}
