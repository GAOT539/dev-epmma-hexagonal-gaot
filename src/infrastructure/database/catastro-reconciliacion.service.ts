// ── Servicio de Reconciliación Mensual de Catastro y Comparación de Puestos ──

import type {
  ImportacionRegistro,
  ReconciliacionResumen,
  CambioReconciliacion,
} from "@/domain/models/comerciante.model";

export interface ComponentesCodigoPuesto {
  categoria: "BODEGA" | "CUBICULO" | "NUCLEO" | "";
  tokenFinal: string;
  numeroBase: string;
  sufijoAlfanumerico: string;
}

/**
 * Infiere el nombre estándar de la nave (ej. "NAVE A", "NAVE CF", "NAVE E") a partir de un código de puesto
 */
export function inferirNaveDesdePuesto(codigoPuesto: string): string | null {
  if (!codigoPuesto) return null;
  const upper = codigoPuesto.trim().toUpperCase();
  if (upper.startsWith("ZCF-") || upper.includes("ZCF-")) {
    return "NAVE CF";
  }
  const matchN = upper.match(/\bN-([A-ZÑ0-9]+)-/);
  if (matchN && matchN[1]) {
    return `NAVE ${matchN[1]}`;
  }
  const matchNave = upper.match(/\bNAVE\s+([A-ZÑ0-9]+)\b/);
  if (matchNave && matchNave[1]) {
    return `NAVE ${matchNave[1]}`;
  }
  return null;
}

/**
 * Normaliza y descompone cualquier código de puesto del mercado EP-EMA:
 * - Detecta categoría ("BODEGA", "CUBICULO", "NUCLEO")
 * - Limpia prefijos espaciales y descriptivos
 * - Separa estrictamente el número base del sufijo alfanumérico (ej. "01" vs "01A", "07" vs "07A")
 */
export function descomponerCodigoPuesto(codigo: string): ComponentesCodigoPuesto {
  if (!codigo) {
    return { categoria: "", tokenFinal: "", numeroBase: "", sufijoAlfanumerico: "" };
  }

  const upper = codigo.trim().toUpperCase().replace(/#/g, "").trim();

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

  // Limpiar prefijo de nave (ej. "N-A-01" -> "01", "N-E-04A" -> "04A", "ZCF-04" -> "04")
  token = token.replace(/^(?:N-[A-ZÑ0-9]+-|ZCF-)/i, "").trim();

  // Limpiar guiones o espacios iniciales/finales
  token = token.replace(/^[-_\s]+|[-_\s]+$/g, "").trim();

  // 3. Extraer número base y sufijo alfanumérico estricto
  // Coincide con número seguido opcionalmente de letras (ej. "01", "001", "01A", "7B")
  const matchNum = token.match(/^(\d+)([A-ZÑ]*)$/i) || token.match(/(\d+)([A-ZÑ]*)$/i);

  let numeroBase = "";
  let sufijoAlfanumerico = "";

  if (matchNum) {
    const rawNum = matchNum[1];
    numeroBase = String(parseInt(rawNum, 10)); // sin ceros a la izquierda
    sufijoAlfanumerico = (matchNum[2] || "").toUpperCase().trim();
  } else {
    // Si no contiene dígitos, el token completo es el sufijo
    sufijoAlfanumerico = token.toUpperCase();
  }

  return {
    categoria,
    tokenFinal: token,
    numeroBase,
    sufijoAlfanumerico,
  };
}

/**
 * Regla de Oro de Comparación de Puestos:
 * - Dos códigos son equivalentes si tienen el mismo numeroBase Y exactamente el mismo sufijoAlfanumerico.
 * - "N-A-01" ("1", "") y "N-A-01A" ("1", "A") son ESTRICTAMENTE DIFERENTES.
 * - Si ambos especifican categoría y difieren ("BODEGA" !== "CUBICULO"), no son equivalentes.
 */
export function sonCodigosPuestosEquivalentes(cod1: string, cod2?: string | null): boolean {
  if (!cod1 || !cod2) return false;

  const c1 = cod1.trim().toUpperCase();
  const c2 = cod2.trim().toUpperCase();

  // Igualdad exacta
  if (c1 === c2) return true;

  const d1 = descomponerCodigoPuesto(c1);
  const d2 = descomponerCodigoPuesto(c2);

  // Si ambos tienen número base
  if (d1.numeroBase && d2.numeroBase) {
    // Deben tener el mismo número base
    if (d1.numeroBase !== d2.numeroBase) return false;

    // Y EXACTAMENTE el mismo sufijo ("01" !== "01A", "07" !== "07A")
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
 * - Mismo nombre completo normalizado exacto, o
 * - Misma cédula válida
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
  // Plan de acciones para persistencia en BD
  asignacionesOcupar: Array<{
    puestoId: string;
    puestoCodigo: string;
    comercianteId: string;
    esNuevoComerciante: boolean;
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
 * Algoritmo de Reconciliación Mensual en 4 Pasos para Naves Existentes:
 * Paso 1: Comparar contribuyentes existentes (mismo puesto -> ACTUALIZACION, distinto puesto -> CAMBIO_PUESTO)
 * Paso 2: Contribuyentes nuevos que reemplazan a salientes (Subpaso 2A por código, Subpaso 2B por deducción)
 * Paso 3: Puestos donde el contribuyente salió y nadie lo reemplazó (VACANTE)
 * Paso 4: Inmutabilidad de los códigos de puestos de la nave
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

  // ── PASO 1: Comparar Contribuyentes Existentes ─────────────────────────────
  for (let idx = 0; idx < registros.length; idx++) {
    const reg = registros[idx];
    const comExistente = comerciantesNave.find((c) =>
      sonMismoContribuyente(c, { contribuyente: reg.nombre, cedula: reg.cedula })
    );

    if (comExistente) {
      // Puesto que ocupa actualmente este comerciante en la nave
      const puestoActual = puestosNave.find((p) => p.comercianteId === comExistente.idInterno);
      // Puesto al que viene asignado en el nuevo archivo
      const puestoNuevoArchivo = puestosNave.find((p) =>
        sonCodigosPuestosEquivalentes(p.codigo, reg.puesto)
      );

      const puestoDestino = puestoNuevoArchivo || puestoActual;

      if (puestoDestino) {
        // ¿Es el mismo puesto o cambió de puesto?
        const esMismoPuesto =
          puestoActual &&
          (puestoActual.id === puestoDestino.id ||
            sonCodigosPuestosEquivalentes(puestoActual.codigo, reg.puesto));

        if (esMismoPuesto) {
          // Caso 1.1: Mismo puesto
          const cambioAct =
            comExistente.actividad.toUpperCase() !== (reg.actividad || "General").toUpperCase();
          const cambioCiu = comExistente.ciu !== reg.ciu && reg.ciu !== "S/N";

          if (cambioAct || cambioCiu) {
            cambiosDetectados.push({
              tipo: "ACTUALIZACION",
              puesto: puestoDestino.codigo,
              anterior: `${comExistente.contribuyente} (${comExistente.actividad})`,
              nuevo: `${reg.nombre} (${reg.actividad || "General"})`,
              detalle: `Datos actualizados para ${reg.nombre} (${reg.actividad || "General"}) en puesto ${puestoDestino.codigo}`,
            });
          }

          puestosAsignadosIds.add(puestoDestino.id);
          comerciantesProcesadosIds.add(comExistente.idInterno);
          registrosProcesadosIndices.add(idx);

          asignacionesOcupar.push({
            puestoId: puestoDestino.id,
            puestoCodigo: puestoDestino.codigo,
            comercianteId: comExistente.idInterno,
            esNuevoComerciante: false,
            datosComerciante: {
              ciu: reg.ciu || comExistente.ciu || "S/N",
              cedula: reg.cedula || comExistente.cedula,
              contribuyente: reg.nombre || comExistente.contribuyente,
              actividad: reg.actividad || comExistente.actividad || "General",
              puestoId: puestoDestino.codigo,
              nave: nave.nombre,
            },
          });
        } else if (puestoActual && puestoDestino && puestoActual.id !== puestoDestino.id) {
          // Caso 1.2: Cambio de puesto
          cambiosDetectados.push({
            tipo: "CAMBIO_PUESTO",
            puesto: puestoDestino.codigo,
            anterior: puestoActual.codigo,
            nuevo: puestoDestino.codigo,
            detalle: `${comExistente.contribuyente} pasó del puesto ${puestoActual.codigo} al puesto ${puestoDestino.codigo}`,
          });

          puestosAsignadosIds.add(puestoDestino.id);
          comerciantesProcesadosIds.add(comExistente.idInterno);
          registrosProcesadosIndices.add(idx);

          asignacionesOcupar.push({
            puestoId: puestoDestino.id,
            puestoCodigo: puestoDestino.codigo,
            comercianteId: comExistente.idInterno,
            esNuevoComerciante: false,
            datosComerciante: {
              ciu: reg.ciu || comExistente.ciu || "S/N",
              cedula: reg.cedula || comExistente.cedula,
              contribuyente: reg.nombre || comExistente.contribuyente,
              actividad: reg.actividad || comExistente.actividad || "General",
              puestoId: puestoDestino.codigo,
              nave: nave.nombre,
            },
          });
        }
      }
    }
  }

  // ── PASO 2: Contribuyentes Nuevos que Reemplazan a Salientes ───────────────
  // Puestos libres en la nave (no asignados en Paso 1)
  const puestosLibres = puestosNave.filter((p) => !puestosAsignadosIds.has(p.id));

  // Subpaso 2A: Coincidencia por código de puesto equivalente
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    const regNuevo = registros[idx];

    const idxPuestoMatch = puestosLibres.findIndex((p) =>
      sonCodigosPuestosEquivalentes(p.codigo, regNuevo.puesto)
    );

    if (idxPuestoMatch !== -1) {
      const puestoMatch = puestosLibres[idxPuestoMatch];
      puestosLibres.splice(idxPuestoMatch, 1);
      puestosAsignadosIds.add(puestoMatch.id);
      registrosProcesadosIndices.add(idx);

      // Comprobar si este puesto tenía un comerciante previo en la nave
      const comSaliente = puestoMatch.comercianteId
        ? comerciantesNave.find((c) => c.idInterno === puestoMatch.comercianteId)
        : null;

      if (comSaliente && !sonMismoContribuyente(comSaliente, { contribuyente: regNuevo.nombre, cedula: regNuevo.cedula })) {
        cambiosDetectados.push({
          tipo: "REEMPLAZO_OCUPANTE",
          puesto: puestoMatch.codigo,
          anterior: comSaliente.contribuyente,
          nuevo: regNuevo.nombre,
          detalle: `Puesto ${puestoMatch.codigo}: Se reemplazó a ${comSaliente.contribuyente} por ${regNuevo.nombre}`,
        });
      } else {
        cambiosDetectados.push({
          tipo: "NUEVO",
          puesto: puestoMatch.codigo,
          nuevo: regNuevo.nombre,
          detalle: `Nuevo comerciante ${regNuevo.nombre} asignado al puesto ${puestoMatch.codigo}`,
        });
      }

      asignacionesOcupar.push({
        puestoId: puestoMatch.id,
        puestoCodigo: puestoMatch.codigo,
        comercianteId: crypto.randomUUID(),
        esNuevoComerciante: true,
        datosComerciante: {
          ciu: regNuevo.ciu || "S/N",
          cedula: regNuevo.cedula,
          contribuyente: regNuevo.nombre,
          actividad: regNuevo.actividad || "General",
          puestoId: puestoMatch.codigo,
          nave: nave.nombre,
        },
      });
    }
  }

  // Subpaso 2B: Deducción directa para nuevos comerciantes restantes en puestos que quedaron vacantes
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    if (puestosLibres.length === 0) break;

    const regNuevo = registros[idx];
    // Preferir puestos que tenían ocupante saliente
    let idxPuestoDeduccion = puestosLibres.findIndex((p) => p.comercianteId !== null);
    if (idxPuestoDeduccion === -1) {
      idxPuestoDeduccion = 0; // o el primer puesto vacante disponible
    }

    const puestoDeducido = puestosLibres[idxPuestoDeduccion];
    puestosLibres.splice(idxPuestoDeduccion, 1);
    puestosAsignadosIds.add(puestoDeducido.id);
    registrosProcesadosIndices.add(idx);

    const comSaliente = puestoDeducido.comercianteId
      ? comerciantesNave.find((c) => c.idInterno === puestoDeducido.comercianteId)
      : null;

    if (comSaliente) {
      cambiosDetectados.push({
        tipo: "REEMPLAZO_OCUPANTE",
        puesto: puestoDeducido.codigo,
        anterior: comSaliente.contribuyente,
        nuevo: regNuevo.nombre,
        detalle: `Puesto ${puestoDeducido.codigo}: Se asigna a ${regNuevo.nombre} (anterior ocupante: ${comSaliente.contribuyente})`,
      });
    } else {
      cambiosDetectados.push({
        tipo: "NUEVO",
        puesto: puestoDeducido.codigo,
        nuevo: regNuevo.nombre,
        detalle: `Nuevo comerciante ${regNuevo.nombre} asignado al puesto vacante ${puestoDeducido.codigo}`,
      });
    }

    asignacionesOcupar.push({
      puestoId: puestoDeducido.id,
      puestoCodigo: puestoDeducido.codigo,
      comercianteId: crypto.randomUUID(),
      esNuevoComerciante: true,
      datosComerciante: {
        ciu: regNuevo.ciu || "S/N",
        cedula: regNuevo.cedula,
        contribuyente: regNuevo.nombre,
        actividad: regNuevo.actividad || "General",
        puestoId: puestoDeducido.codigo,
        nave: nave.nombre,
      },
    });
  }

  // ── PASO 3: Puestos donde el Contribuyente Salió y Nadie lo Reemplazó ──────
  for (const puestoRestante of puestosLibres) {
    // Si tenía comerciante asignado o estaba ocupado, pasa a Vacante
    if (puestoRestante.comercianteId || puestoRestante.estado === "Ocupado") {
      const comSaliente = puestoRestante.comercianteId
        ? comerciantesNave.find((c) => c.idInterno === puestoRestante.comercianteId)
        : null;

      cambiosDetectados.push({
        tipo: "VACANTE",
        puesto: puestoRestante.codigo,
        anterior: comSaliente ? comSaliente.contribuyente : "Ocupante anterior",
        detalle: `Puesto ${puestoRestante.codigo} queda Vacante (anterior ocupante: ${
          comSaliente ? comSaliente.contribuyente : "No identificado"
        })`,
      });

      puestosAVacante.push({
        puestoId: puestoRestante.id,
        puestoCodigo: puestoRestante.codigo,
        comercianteSalienteId:
          puestoRestante.comercianteId &&
          !comerciantesProcesadosIds.has(puestoRestante.comercianteId)
            ? puestoRestante.comercianteId
            : null,
      });
    }
  }

  // ── PASO 4: Inmutabilidad de Puestos y Resumen Final ───────────────────────
  const totalOcupados = puestosAsignadosIds.size;
  const capacidadNave = Math.max(nave.cantidadPuestos, totalOcupados);
  const totalVacantes = Math.max(0, capacidadNave - totalOcupados);

  return {
    reconciliacion: {
      naveDetectada: nave.nombre,
      esNaveNueva: false,
      capacidadNave,
      totalOcupados,
      totalVacantes,
      cambiosDetectados,
    },
    asignacionesOcupar,
    puestosAVacante,
  };
}
