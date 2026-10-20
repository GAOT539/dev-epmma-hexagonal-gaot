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
  esRangoCompuesto?: boolean;
  rangoNormalizado?: string;
}

/**
 * Distingue de forma inteligente entre Códigos de Bodegas/Locales y Códigos Numéricos de Puestos:
 * - Bodegas/Locales: Inician con BODEGA, CUBICULO, NUCLEO, LOCAL, ZCF o tienen formato con prefijo/sufijo de nave (N-H-01, N-02A-H).
 * - Puestos Numéricos: "001", "058-063", "125", "4A", "7".
 */
export function esCodigoTipoBodegaOLocal(codigo: string): boolean {
  if (!codigo) return false;
  const upper = codigo.trim().toUpperCase();

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

  // Formato con prefijo o sufijo de nave (ej. N-H-01, N-02A-H, N-A-01, N-E-04)
  if (/^N-(?:[A-ZÑ0-9]+-[A-Z0-9-]+|[A-Z0-9]+-[A-ZÑ])(?:[\s*].*)?$/i.test(upper)) {
    return true;
  }

  return false;
}

/**
 * Infiere el nombre estándar de la nave (ej. "NAVE H", "NAVE A", "NAVE CF") a partir de un código de puesto
 * Reconoce tanto prefijo de nave (N-H-01) como sufijo de nave al final (N-02A-H).
 */
export function inferirNaveDesdePuesto(codigoPuesto: string): string | null {
  if (!codigoPuesto) return null;
  const upper = codigoPuesto.trim().toUpperCase();
  if (upper.startsWith("ZCF-") || upper.includes("ZCF-")) {
    return "NAVE CF";
  }

  // 1. Caso N-[Stall]-[Nave] (ej. N-02A-H, N-01-A) donde la nave es letra al final y el puesto empieza por dígito
  const matchNaveFin =
    upper.match(/^N-([0-9]+[A-Z0-9]*)-([A-ZÑ])(?:[\s*].*)?$/i) ||
    upper.match(/\bN-([0-9]+[A-Z0-9]*)-([A-ZÑ])\b/i);
  if (matchNaveFin) {
    return `NAVE ${matchNaveFin[2].toUpperCase()}`;
  }

  // 2. Caso N-[Nave]-[Stall] (ej. N-H-01, N-A-01, N-E-04, N-CF-01)
  const matchNaveIni =
    upper.match(/^N-([A-ZÑ]+)-([A-Z0-9-]+)(?:[\s*].*)?$/i) ||
    upper.match(/\bN-([A-ZÑ]+)-([A-Z0-9-]+)\b/i);
  if (matchNaveIni) {
    return `NAVE ${matchNaveIni[1].toUpperCase()}`;
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

  // 5. Extraer número base y sufijo alfanumérico estricto
  const matchNum = token.match(/^(\d+)([A-ZÑ]*)$/i);

  let numeroBase = "";
  let sufijoAlfanumerico = "";

  if (matchNum) {
    const rawNum = matchNum[1];
    numeroBase = String(parseInt(rawNum, 10)); // sin ceros a la izquierda
    sufijoAlfanumerico = (matchNum[2] || "").toUpperCase().trim();
  } else {
    const matchNumEnToken = token.match(/(\d+)([A-ZÑ]*)$/i);
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
 * - "N-A-01" ("1", "") y "N-A-01A" ("1", "A") son ESTRICTAMENTE DIFERENTES.
 * - Códigos dobles como "058-063" y "079-095" se conservan íntegros y no colisionan con puestos unitarios.
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
      return esCodigoTipoBodegaOLocal(p.codigo);
    }
    if (todosSonPuestosNumericos) {
      return !esCodigoTipoBodegaOLocal(p.codigo);
    }
    return true; // mixto: participan todos
  });

  const puestosNaveNoParticipantes = puestosNave.filter((p) => {
    return !puestosNaveParticipantes.some((part) => part.id === p.id);
  });

  // ── PASO 1: Comparar Contribuyentes Existentes en la Sección Participante ─────
  for (let idx = 0; idx < registros.length; idx++) {
    const reg = registros[idx];
    const candidatos = comerciantesNave.filter(
      (c) =>
        !comerciantesProcesadosIds.has(c.idInterno) &&
        sonMismoContribuyente(c, { contribuyente: reg.nombre, cedula: reg.cedula })
    );

    if (candidatos.length > 0) {
      let comExistente = candidatos.find((c) =>
        sonCodigosPuestosEquivalentes(c.puestoId || "", reg.puesto)
      );
      if (!comExistente) {
        comExistente = candidatos[0];
      }
      // Puesto actual del comerciante en la nave
      const puestoActual = puestosNaveParticipantes.find((p) => p.comercianteId === comExistente.idInterno);
      // Puesto al que viene asignado en el nuevo archivo
      const puestoNuevoArchivo = puestosNaveParticipantes.find((p) =>
        sonCodigosPuestosEquivalentes(p.codigo, reg.puesto)
      );

      const puestoDestino = puestoNuevoArchivo || puestoActual;

      if (puestoDestino) {
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

  // ── PASO 2: Contribuyentes Nuevos y Asignaciones ──────────────────────────
  // Puestos libres en la sección participante
  const puestosLibres = puestosNaveParticipantes.filter((p) => !puestosAsignadosIds.has(p.id));

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

  // Subpaso 2B: Asignar nuevos restantes a puestos libres existentes en la sección
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    if (puestosLibres.length === 0) break;

    const regNuevo = registros[idx];
    let idxPuestoDeduccion = puestosLibres.findIndex((p) => p.comercianteId !== null);
    if (idxPuestoDeduccion === -1) {
      idxPuestoDeduccion = 0;
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

  // Subpaso 2C: Si el archivo contiene más puestos de los existentes en esta sección,
  // se agregan como PUESTOS NUEVOS sin descartar ni inventar vacantes artificiales.
  for (let idx = 0; idx < registros.length; idx++) {
    if (registrosProcesadosIndices.has(idx)) continue;
    const regNuevo = registros[idx];
    const nuevoPuestoId = crypto.randomUUID();
    const codigoPuestoFinal = (regNuevo.puesto || `PUESTO-${idx + 1}`).trim().toUpperCase();

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

  // ── PASO 3: Puestos de la Sección Participante que Quedan Vacantes ──────────
  for (const puestoRestante of puestosLibres) {
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

  // ── PASO 4: Conteo Real de Capacidad (Suma de Puestos Reales, Cero '100' Forzado) ──
  const ocupadosParticipantes = puestosAsignadosIds.size;
  const ocupadosNoParticipantes = puestosNaveNoParticipantes.filter(
    (p) => p.estado === "Ocupado" || p.comercianteId !== null
  ).length;

  const totalOcupados = ocupadosParticipantes + ocupadosNoParticipantes;

  // La capacidad total es la suma de los puestos de la sección no participante más los participantes
  const vacantesParticipantes = puestosAVacante.length;
  const vacantesNoParticipantes = puestosNaveNoParticipantes.filter(
    (p) => p.estado === "Vacante" && !p.comercianteId
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
