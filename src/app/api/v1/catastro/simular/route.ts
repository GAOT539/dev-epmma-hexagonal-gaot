// ── API Route: POST /api/v1/catastro/simular ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  ImportacionRegistro,
  AccionReconciliacionItem,
} from "@/domain/models/comerciante.model";
import {
  reconciliarCatastroNaveExistente,
  inferirNaveDesdePuesto,
  esCodigoTipoBodegaOLocal,
  expandirRegistrosMultiPuesto,
  filtrarDuplicadosExactos100,
  generarSlugNave,
  esNaveAmbulantes,
  aplicarReglaPuestosAmbulantes,
} from "@/infrastructure/database/catastro-reconciliacion.service";
import {
  getAuthenticatedUser,
  userCanAccessNave,
  getAccessibleNaveIds,
} from "@/infrastructure/auth/authorization";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const registrosRaw: ImportacionRegistro[] = body.registros || [];
    const naveIdManual: string | undefined = body.naveIdManual?.trim();
    const crearNuevaNave: boolean = Boolean(body.crearNuevaNave);
    const nuevoNombreNave: string | undefined = body.nuevoNombreNave?.trim();
    const modoUnificacion = "UNIFICAR";

    // REGLA 2: Asignación secuencial de puestos GeneralXX si la nave de destino es Ambulantes
    const esAmbulantesDestino =
      esNaveAmbulantes(naveIdManual) ||
      esNaveAmbulantes(nuevoNombreNave) ||
      registrosRaw.some((r) => esNaveAmbulantes(r.nave));

    const registrosBase = esAmbulantesDestino
      ? aplicarReglaPuestosAmbulantes(registrosRaw, naveIdManual || nuevoNombreNave)
      : registrosRaw;

    const registrosExpandidos = expandirRegistrosMultiPuesto(registrosBase);
    let { registrosUnicos: registros } = filtrarDuplicadosExactos100(registrosExpandidos);

    if (!Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json(
        { exitosos: 0, errores: [{ fila: 0, mensaje: "No se proporcionaron registros válidos." }] },
        { status: 400 }
      );
    }

    const errores: { fila: number; mensaje: string }[] = [];
    let exitosos = 0;

    for (let i = 0; i < registros.length; i++) {
      const reg = registros[i];
      const nombre = (reg.nombre || reg.contribuyente || "").trim();
      if (!nombre || nombre.toUpperCase() === "SIN NOMBRE") {
        errores.push({ fila: i + 1, mensaje: "El campo Nombre / Contribuyente es obligatorio." });
        continue;
      }
      if (!reg.cedula || reg.cedula === "-") {
        errores.push({ fila: i + 1, mensaje: "Cédula inválida o vacía." });
        continue;
      }
      exitosos++;
    }

    if (exitosos === 0) {
      return NextResponse.json({ exitosos: 0, errores });
    }
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: "Usuario autenticado no encontrado." }, { status: 401 });
    }

    // ── MODO MASIVO MULTI-NAVE (2 o más naves distintas en el lote) ───────────
    const navesValidasEnRegistros = Array.from(
      new Set(
        registros
          .map((r) => (r.nave || "").normalize("NFC").trim().toUpperCase())
          .filter((n) => n && n !== "NO DEFINIDA" && n !== "NAVE" && n !== "(NAVE)")
      )
    );

    if (!naveIdManual && !crearNuevaNave && navesValidasEnRegistros.length >= 2) {
      const todasNavesBD = await prisma.nave.findMany({
        where: { estadoRegistro: { not: "Deshabilitado" } },
        include: { puestos: true },
      });

      const gruposPorNave = new Map<string, ImportacionRegistro[]>();
      for (const reg of registros) {
        const nKey = (reg.nave || "").normalize("NFC").trim().toUpperCase() || "NO DEFINIDA";
        if (!gruposPorNave.has(nKey)) {
          gruposPorNave.set(nKey, []);
        }
        gruposPorNave.get(nKey)!.push(reg);
      }

      if (actor.rol === "SUPERVISOR") {
        for (const [nombreNaveGrupo] of gruposPorNave) {
          const slugGrupo = generarSlugNave(nombreNaveGrupo);
          const esAmb = esNaveAmbulantes(nombreNaveGrupo);
          const naveMatch = todasNavesBD.find((n) => {
            const u = n.nombre.normalize("NFC").trim().toUpperCase();
            return u === nombreNaveGrupo || n.id === slugGrupo || (esAmb && esNaveAmbulantes(n.nombre));
          });
          if (!naveMatch || !(await userCanAccessNave(request, naveMatch.id))) {
            return NextResponse.json(
              {
                error: `Acceso denegado: El supervisor no tiene permisos sobre la nave '${nombreNaveGrupo}' incluida en el archivo.`,
              },
              { status: 403 }
            );
          }
        }
      }

      let capacidadTotal = 0;
      let totalOcupados = 0;
      let totalVacantes = 0;
      const cambiosDetectadosConsolidados: AccionReconciliacionItem[] = [];
      const nombresNavesProcesadas: string[] = [];
      let contieneBodegasMulti = false;

      for (const [nombreNaveGrupo, regsRawGrupo] of gruposPorNave) {
        const esAmb = esNaveAmbulantes(nombreNaveGrupo);
        const regsGrupo = esAmb
          ? aplicarReglaPuestosAmbulantes(regsRawGrupo, nombreNaveGrupo)
          : regsRawGrupo;

        if (regsGrupo.some((r) => esCodigoTipoBodegaOLocal(r.puesto || ""))) {
          contieneBodegasMulti = true;
        }

        const slugGrupo = generarSlugNave(nombreNaveGrupo);
        const naveMatch = todasNavesBD.find((n) => {
          const u = n.nombre.normalize("NFC").trim().toUpperCase();
          return u === nombreNaveGrupo || n.id === slugGrupo || (esAmb && esNaveAmbulantes(n.nombre));
        });

        if (naveMatch) {
          nombresNavesProcesadas.push(naveMatch.nombre);
          const puestosNave = naveMatch.puestos;
          const comerciantesNave = await prisma.comerciante.findMany({
            where: {
              estadoRegistro: { not: "Deshabilitado" },
              OR: [
                { nave: naveMatch.nombre },
                { nave: naveMatch.id },
                { puestoId: { in: puestosNave.map((p) => p.codigo) } },
              ],
            },
          });

          const res = reconciliarCatastroNaveExistente(
            regsGrupo,
            naveMatch,
            puestosNave,
            comerciantesNave
          );
          capacidadTotal += res.reconciliacion.capacidadNave;
          totalOcupados += res.reconciliacion.totalOcupados;
          totalVacantes += res.reconciliacion.totalVacantes;

          for (const cambio of res.reconciliacion.cambiosDetectados) {
            cambiosDetectadosConsolidados.push({
              ...cambio,
              puesto: `[${naveMatch.nombre}] ${cambio.puesto}`,
            });
          }
        } else {
          if (actor.rol === "SUPERVISOR") {
            return NextResponse.json(
              { error: `La nave '${nombreNaveGrupo}' no existe en la base de datos.` },
              { status: 403 }
            );
          }
          nombresNavesProcesadas.push(nombreNaveGrupo);
          capacidadTotal += regsGrupo.length;
          totalOcupados += regsGrupo.length;
          for (const r of regsGrupo) {
            cambiosDetectadosConsolidados.push({
              tipo: "NUEVO",
              puesto: `[${nombreNaveGrupo}] ${r.puesto || "-"}`,
              nuevo: r.nombre,
              detalle: `Nuevo comerciante ${r.nombre} asignado a ${r.puesto || "-"} en nueva nave ${nombreNaveGrupo}`,
            });
          }
        }
      }

      return NextResponse.json({
        exitosos,
        errores,
        reconciliacion: {
          naveNoEncontrada: false,
          naveDetectada: `MÚLTIPLES NAVES (${nombresNavesProcesadas.join(", ")})`,
          esNaveNueva: false,
          capacidadNave: capacidadTotal,
          totalOcupados,
          totalVacantes,
          esArchivoBodegas: contieneBodegasMulti,
          modoUnificacion,
          cambiosDetectados: cambiosDetectadosConsolidados,
        },
      });
    }

    const contieneBodegas = registros.some((r) => esCodigoTipoBodegaOLocal(r.puesto || ""));

    // 1. Detección o Selección de Nave con Validación Estricta Unicode NFC
    let naveExistente = null;
    let naveDetectada = "";

    if (naveIdManual) {
      const manualNorm = naveIdManual.normalize("NFC").trim();
      const manualSlug = generarSlugNave(manualNorm);
      const candidatos = await prisma.nave.findMany({
        where: {
          OR: [
            { id: manualNorm },
            { nombre: manualNorm },
            { id: manualSlug },
            { nombre: manualNorm.toUpperCase() },
          ],
        },
        include: { puestos: true },
      });
      const manualUpper = manualNorm.toUpperCase();
      naveExistente = candidatos.find(
        (n) =>
          n.nombre.normalize("NFC").trim().toUpperCase() === manualUpper ||
          n.id === manualNorm ||
          n.id === manualSlug
      ) || null;
      if (naveExistente) {
        naveDetectada = naveExistente.nombre;
      }
    }

    if (!naveExistente) {
      // Intentar inferir nave desde la columna nave o desde los códigos de puesto
      const regConNave = registros.find((r) => r.nave && r.nave !== "NO DEFINIDA");
      if (regConNave?.nave && regConNave.nave !== "NO DEFINIDA") {
        naveDetectada = regConNave.nave.normalize("NFC").trim().toUpperCase();
      }

      if (!naveDetectada || naveDetectada === "NO DEFINIDA") {
        for (const r of registros) {
          const inf = inferirNaveDesdePuesto(r.puesto || "");
          if (inf) {
            naveDetectada = inf;
            break;
          }
        }
      }

      if (naveDetectada && naveDetectada !== "NO DEFINIDA") {
        const detectadaNorm = naveDetectada.normalize("NFC").trim();
        const detectadaSlug = generarSlugNave(detectadaNorm);
        const candidatos = await prisma.nave.findMany({
          where: {
            OR: [
              { nombre: detectadaNorm },
              { id: detectadaSlug },
              { nombre: detectadaNorm.toUpperCase() },
            ],
          },
          include: { puestos: true },
        });
        const detectadaUpper = detectadaNorm.toUpperCase();
        naveExistente = candidatos.find(
          (n) =>
            n.nombre.normalize("NFC").trim().toUpperCase() === detectadaUpper ||
            n.id === detectadaSlug
        ) || null;
      }
    }

    if (actor.rol === "SUPERVISOR") {
      if (crearNuevaNave) {
        return NextResponse.json(
          { error: "Solo SUPERADMIN y TIC pueden crear nuevas naves." },
          { status: 403 }
        );
      }
      if (naveExistente && !(await userCanAccessNave(request, naveExistente.id))) {
        return NextResponse.json(
          { error: "La nave no pertenece al supervisor autenticado." },
          { status: 403 }
        );
      }
    }

    // Si la nave detectada o existente en BD es Ambulantes y aún no se había aplicado la regla:
    if (
      !esAmbulantesDestino &&
      ((naveExistente && esNaveAmbulantes(naveExistente.nombre)) || esNaveAmbulantes(naveDetectada))
    ) {
      registros = aplicarReglaPuestosAmbulantes(registros, naveExistente?.nombre || naveDetectada);
    }

    // 2. Si la nave no fue encontrada y no se solicitó crear nueva nave
    if (!naveExistente && !crearNuevaNave) {
      const accessibleNaveIds = await getAccessibleNaveIds(request);
      const navesDisponibles = await prisma.nave.findMany({
        where: {
          estadoRegistro: { not: "Deshabilitado" },
          ...(accessibleNaveIds ? { id: { in: accessibleNaveIds } } : {}),
        },
        select: { id: true, nombre: true, cantidadPuestos: true },
        orderBy: { nombre: "asc" },
      });

      return NextResponse.json({
        exitosos,
        errores,
        reconciliacion: {
          naveNoEncontrada: true,
          naveDetectada: naveDetectada || "NO IDENTIFICADA",
          esNaveNueva: true,
          navesDisponibles,
          capacidadNave: 0,
          totalOcupados: 0,
          totalVacantes: 0,
          esArchivoBodegas: contieneBodegas,
          modoUnificacion,
          cambiosDetectados: [],
        },
      });
    }

    // 3. Si se solicita crear una nueva nave
    if (crearNuevaNave) {
      const nombreFinal = (nuevoNombreNave || naveDetectada || "NUEVA NAVE").trim().toUpperCase();
      const capacidadNave = registros.length;
      return NextResponse.json({
        exitosos,
        errores,
        reconciliacion: {
          naveNoEncontrada: false,
          naveDetectada: nombreFinal,
          esNaveNueva: true,
          capacidadNave,
          totalOcupados: capacidadNave,
          totalVacantes: 0,
          esArchivoBodegas: contieneBodegas,
          modoUnificacion,
          cambiosDetectados: registros.map((r) => ({
            tipo: "NUEVO" as const,
            puesto: r.puesto || "-",
            nuevo: r.nombre,
            detalle: `Nuevo comerciante ${r.nombre} asignado a ${r.puesto || "-"} en ${nombreFinal}`,
          })),
        },
      });
    }

    // 4. Reconciliación con Soporte de Subconjuntos para Nave Existente
    const puestosNave = naveExistente!.puestos;
    const comerciantesNave = await prisma.comerciante.findMany({
      where: {
        estadoRegistro: { not: "Deshabilitado" },
        OR: [
          { nave: naveExistente!.nombre },
          { nave: naveExistente!.id },
          { puestoId: { in: puestosNave.map((p) => p.codigo) } },
        ],
      },
    });

    const resultadoReconciliacion = reconciliarCatastroNaveExistente(
      registros,
      naveExistente!,
      puestosNave,
      comerciantesNave
    );

    return NextResponse.json({
      exitosos,
      errores,
      reconciliacion: {
        ...resultadoReconciliacion.reconciliacion,
        modoUnificacion,
      },
    });
  } catch (error) {
    logError("API", "Error en POST /api/v1/catastro/simular", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al simular la importación." }, { status: 500 });
  }
}
