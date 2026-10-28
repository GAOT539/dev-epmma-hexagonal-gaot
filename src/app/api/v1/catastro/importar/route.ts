// ── API Route: POST /api/v1/catastro/importar ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";
import {
  sincronizarPuestosDeNaveEnBD,
  asegurarColacionEspanolEnBD,
  invalidarNavesYaVerificadas,
} from "@/infrastructure/database/nave-puestos-sync.service";
import {
  reconciliarCatastroNaveExistente,
  inferirNaveDesdePuesto,
  expandirRegistrosMultiPuesto,
  filtrarDuplicadosExactos100,
  generarSlugNave,
  esNaveAmbulantes,
  aplicarReglaPuestosAmbulantes,
} from "@/infrastructure/database/catastro-reconciliacion.service";
import { getAuthenticatedUser, userCanAccessNave } from "@/infrastructure/auth/authorization";
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
    const actor = await getAuthenticatedUser(request);
    if (!actor) {
      return NextResponse.json({ error: "Usuario autenticado no encontrado." }, { status: 401 });
    }

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

    // 2. Si la nave no fue encontrada y NO se indicó crear nueva nave
    if (!naveExistente && !crearNuevaNave) {
      return NextResponse.json(
        {
          exitosos: 0,
          errores: [
            {
              fila: 0,
              mensaje:
                "Nave no encontrada. Seleccione una nave existente o active la opción de crear nueva nave.",
            },
          ],
        },
        { status: 400 }
      );
    }

    // ── CASO A: Crear Nueva Nave ──────────────────────────────────────────────
    if (crearNuevaNave && !naveExistente) {
      // Asegurar colación en español en BD antes de crear la nave
      await asegurarColacionEspanolEnBD();

      const nombreNueva = (nuevoNombreNave || naveDetectada || "NUEVA NAVE").normalize("NFC").trim().toUpperCase();
      const idSlug = generarSlugNave(nombreNueva) || `nave-${Date.now()}`;

      // Capacidad EXACTA a los registros reales (CERO '100' forzado)
      const capacidad = registros.length;

      const resultadoCreacion = await prisma.$transaction(async (tx) => {
        // 1. Crear Nave
        const nuevaNave = await tx.nave.create({
          data: {
            id: idSlug,
            nombre: nombreNueva,
            cantidadPuestos: capacidad,
            limitePuestos: capacidad,
            supervisores: [],
            estadoRegistro: "Habilitado",
          },
        });

        // 2. Crear plano espacial inicial vacío acorde a la dimensión
        const celdasPlano = [];
        const dim = Math.max(8, Math.ceil(Math.sqrt(capacidad) + 2));
        for (let r = 0; r < dim; r++) {
          for (let c = 0; c < dim; c++) {
            celdasPlano.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
          }
        }
        await tx.planoNave.create({
          data: {
            naveId: nuevaNave.id,
            filas: dim,
            columnas: dim,
            planoJson: celdasPlano,
          },
        });

        // 3. Crear puestos y comerciantes reales por lotes
        let exitosos = 0;
        const errores: { fila: number; mensaje: string }[] = [];
        const comerciantesBatch: Prisma.ComercianteCreateManyInput[] = [];
        const puestosBatch: Prisma.PuestoCreateManyInput[] = [];

        for (let i = 0; i < registros.length; i++) {
          const reg = registros[i];
          const nombre = (reg.nombre || reg.contribuyente || "").trim();
          const cedula = (reg.cedula || "").trim();
          if (!nombre || !cedula) {
            errores.push({ fila: i + 1, mensaje: "Registro incompleto." });
            continue;
          }

          const codigoPuesto = (reg.puesto || `PUESTO-${i + 1}`).trim().toUpperCase();
          const ciuNormalizado =
            reg.ciu && reg.ciu !== "-" && reg.ciu.trim().length > 0 ? reg.ciu.trim() : "S/N";

          const idInterno = crypto.randomUUID();
          const puestoId = crypto.randomUUID();

          comerciantesBatch.push({
            idInterno,
            ciu: ciuNormalizado,
            cedula,
            contribuyente: nombre,
            actividad: reg.actividad || "General",
            puestoId: codigoPuesto,
            nave: nuevaNave.nombre,
            estadoRegistro: "Habilitado",
            creadoPor: "importador-catastro",
          });

          puestosBatch.push({
            id: puestoId,
            codigo: codigoPuesto,
            naveId: nuevaNave.id,
            estado: "Ocupado",
            comercianteId: idInterno,
          });

          exitosos++;
        }

        if (comerciantesBatch.length > 0) {
          await tx.comerciante.createMany({ data: comerciantesBatch });
        }
        if (puestosBatch.length > 0) {
          await tx.puesto.createMany({ data: puestosBatch });
        }

        return { exitosos, errores, naveId: nuevaNave.id, nombreNave: nuevaNave.nombre };
      }, { maxWait: 15000, timeout: 60000 });

      invalidarNavesYaVerificadas();
      await sincronizarPuestosDeNaveEnBD(resultadoCreacion.naveId);
      await asegurarAsistenciaInicialDelDia(undefined, true);

      return NextResponse.json({
        exitosos: resultadoCreacion.exitosos,
        errores: resultadoCreacion.errores,
        mensaje: `Nueva nave ${resultadoCreacion.nombreNave} creada con ${resultadoCreacion.exitosos} puestos y comerciantes vinculados.`,
        reconciliacion: {
          naveDetectada: resultadoCreacion.nombreNave,
          esNaveNueva: true,
          capacidadNave: capacidad,
          totalOcupados: resultadoCreacion.exitosos,
          totalVacantes: 0,
          cambiosDetectados: [],
          modoUnificacion,
        },
      });
    }

    // ── CASO B: Reconciliación con Soporte de Subconjuntos en Nave Existente ───
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

    const resultadoPlan = reconciliarCatastroNaveExistente(
      registros,
      naveExistente!,
      puestosNave,
      comerciantesNave
    );

    const { asignacionesOcupar, puestosAVacante, reconciliacion } = resultadoPlan;

    await prisma.$transaction(async (tx) => {
      // 1. Procesar puestos que pasan a Vacante
      for (const vac of puestosAVacante) {
        if (vac.comercianteSalienteId) {
          await tx.comerciante.updateMany({
            where: { idInterno: vac.comercianteSalienteId },
            data: { puestoId: null },
          });
        }
        await tx.puesto.update({
          where: { id: vac.puestoId },
          data: {
            codigo: vac.puestoCodigo,
            estado: "Vacante",
            comercianteId: null,
          },
        });
      }

      // 2. Limpieza temporal preventiva de colisiones @unique (P2002) en intercambios o mudanzas
      const puestoIdsAfectados = asignacionesOcupar
        .filter((a) => !a.esNuevoPuesto && a.puestoId)
        .map((a) => a.puestoId);
      const comercianteIdsAfectados = asignacionesOcupar
        .filter((a) => a.comercianteId)
        .map((a) => a.comercianteId);

      if (puestoIdsAfectados.length > 0 || comercianteIdsAfectados.length > 0) {
        await tx.puesto.updateMany({
          where: {
            OR: [
              ...(puestoIdsAfectados.length > 0 ? [{ id: { in: puestoIdsAfectados } }] : []),
              ...(comercianteIdsAfectados.length > 0
                ? [{ comercianteId: { in: comercianteIdsAfectados } }]
                : []),
            ],
          },
          data: { comercianteId: null },
        });
      }

      // 3. Agrupar creación de nuevos comerciantes y nuevos puestos por lotes
      const nuevosComerciantesData: Prisma.ComercianteCreateManyInput[] = [];
      const nuevosPuestosData: Prisma.PuestoCreateManyInput[] = [];

      for (const asig of asignacionesOcupar) {
        if (asig.esNuevoComerciante) {
          nuevosComerciantesData.push({
            idInterno: asig.comercianteId,
            ciu: asig.datosComerciante.ciu,
            cedula: asig.datosComerciante.cedula,
            contribuyente: asig.datosComerciante.contribuyente,
            actividad: asig.datosComerciante.actividad,
            puestoId: asig.puestoCodigo,
            nave: asig.datosComerciante.nave,
            estadoRegistro: "Habilitado",
            creadoPor: "importador-reconciliacion",
          });
        }
        if (asig.esNuevoPuesto) {
          nuevosPuestosData.push({
            id: asig.puestoId,
            codigo: asig.puestoCodigo,
            naveId: naveExistente!.id,
            estado: "Ocupado",
            comercianteId: asig.comercianteId,
          });
        }
      }

      if (nuevosComerciantesData.length > 0) {
        await tx.comerciante.createMany({ data: nuevosComerciantesData });
      }
      if (nuevosPuestosData.length > 0) {
        await tx.puesto.createMany({ data: nuevosPuestosData });
      }

      // 4. Actualizar comerciantes y puestos existentes
      for (const asig of asignacionesOcupar) {
        if (!asig.esNuevoComerciante) {
          await tx.comerciante.update({
            where: { idInterno: asig.comercianteId },
            data: {
              ciu: asig.datosComerciante.ciu,
              contribuyente: asig.datosComerciante.contribuyente,
              actividad: asig.datosComerciante.actividad,
              puestoId: asig.puestoCodigo,
              nave: asig.datosComerciante.nave,
              estadoRegistro: "Habilitado",
              modificadoPor: "importador-reconciliacion",
            },
          });
        }

        if (!asig.esNuevoPuesto) {
          await tx.puesto.update({
            where: { id: asig.puestoId },
            data: {
              codigo: asig.puestoCodigo,
              estado: "Ocupado",
              comercianteId: asig.comercianteId,
            },
          });
        }
      }

      // Actualizar la capacidad exacta de la nave al total real de sus puestos
      const totalPuestosEnNave = await tx.puesto.count({
        where: { naveId: naveExistente!.id },
      });
      await tx.nave.update({
        where: { id: naveExistente!.id },
        data: {
          cantidadPuestos: totalPuestosEnNave,
          limitePuestos: totalPuestosEnNave,
        },
      });
    }, { maxWait: 15000, timeout: 60000 });

    invalidarNavesYaVerificadas(naveExistente!.id);
    await sincronizarPuestosDeNaveEnBD(naveExistente!.id);
    await asegurarAsistenciaInicialDelDia(undefined, true);

    return NextResponse.json({
      exitosos: asignacionesOcupar.length,
      errores: [],
      mensaje: `Reconciliación completada para ${naveExistente!.nombre}: ${asignacionesOcupar.length} puestos actualizados e inmutables. Capacidad total: ${reconciliacion.capacidadNave}.`,
      reconciliacion: {
        ...reconciliacion,
        modoUnificacion,
      },
    });
  } catch (error) {
    logError("API", "Error en POST /api/v1/catastro/importar", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al ejecutar la importación en la base de datos." },
      { status: 500 }
    );
  }
}
