// ── API Route: POST /api/v1/catastro/importar ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";
import { sincronizarPuestosDeNaveEnBD } from "@/infrastructure/database/nave-puestos-sync.service";
import {
  reconciliarCatastroNaveExistente,
  inferirNaveDesdePuesto,
} from "@/infrastructure/database/catastro-reconciliacion.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const registros: ImportacionRegistro[] = body.registros || [];
    const naveIdManual: string | undefined = body.naveIdManual?.trim();
    const crearNuevaNave: boolean = Boolean(body.crearNuevaNave);
    const nuevoNombreNave: string | undefined = body.nuevoNombreNave?.trim();

    if (!Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json(
        { exitosos: 0, errores: [{ fila: 0, mensaje: "No se proporcionaron registros válidos." }] },
        { status: 400 }
      );
    }

    // 1. Detección o Selección de Nave
    let naveExistente = null;
    let naveDetectada = "";

    if (naveIdManual) {
      naveExistente = await prisma.nave.findFirst({
        where: {
          OR: [
            { id: naveIdManual },
            { nombre: naveIdManual },
            { id: naveIdManual.toLowerCase().replace(/\s+/g, "-") },
          ],
        },
        include: { puestos: true },
      });
      if (naveExistente) {
        naveDetectada = naveExistente.nombre;
      }
    }

    if (!naveExistente) {
      const regConNave = registros.find((r) => r.nave && r.nave !== "NO DEFINIDA");
      if (regConNave?.nave && regConNave.nave !== "NO DEFINIDA") {
        naveDetectada = regConNave.nave.trim().toUpperCase();
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

      if (naveDetectada) {
        naveExistente = await prisma.nave.findFirst({
          where: {
            OR: [
              { nombre: naveDetectada },
              { id: naveDetectada.toLowerCase().replace(/\s+/g, "-") },
            ],
          },
          include: { puestos: true },
        });
      }
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
      const nombreNueva = (nuevoNombreNave || naveDetectada || "NUEVA NAVE").trim().toUpperCase();
      const idSlug =
        nombreNueva
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `nave-${Date.now()}`;

      const totalRegistros = registros.length;
      const capacidad = Math.max(totalRegistros, 100);

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

        // 2. Crear plano espacial inicial 12x12 vacío
        const celdasPlano = [];
        for (let r = 0; r < 12; r++) {
          for (let c = 0; c < 12; c++) {
            celdasPlano.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
          }
        }
        await tx.planoNave.create({
          data: {
            naveId: nuevaNave.id,
            filas: 12,
            columnas: 12,
            planoJson: celdasPlano,
          },
        });

        // 3. Crear puestos y comerciantes
        let exitosos = 0;
        const errores: { fila: number; mensaje: string }[] = [];

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

          // Crear puesto
          const puestoId = crypto.randomUUID();
          const puestoCreado = await tx.puesto.create({
            data: {
              id: puestoId,
              codigo: codigoPuesto,
              naveId: nuevaNave.id,
              estado: "Ocupado",
            },
          });

          // Crear comerciante
          const comercianteCreado = await tx.comerciante.create({
            data: {
              ciu: ciuNormalizado,
              cedula,
              contribuyente: nombre,
              actividad: reg.actividad || "General",
              puestoId: codigoPuesto,
              nave: nuevaNave.nombre,
              estadoRegistro: "Habilitado",
              creadoPor: "importador-catastro",
            },
          });

          // Enlazar puesto con comerciante
          await tx.puesto.update({
            where: { id: puestoCreado.id },
            data: { comercianteId: comercianteCreado.idInterno },
          });

          exitosos++;
        }

        return { exitosos, errores, naveId: nuevaNave.id, nombreNave: nuevaNave.nombre };
      });

      await sincronizarPuestosDeNaveEnBD(resultadoCreacion.naveId);
      await asegurarAsistenciaInicialDelDia();

      return NextResponse.json({
        exitosos: resultadoCreacion.exitosos,
        errores: resultadoCreacion.errores,
        mensaje: `Nueva nave ${resultadoCreacion.nombreNave} creada con ${resultadoCreacion.exitosos} puestos y comerciantes vinculados.`,
        reconciliacion: {
          naveDetectada: resultadoCreacion.nombreNave,
          esNaveNueva: true,
          capacidadNave: capacidad,
          totalOcupados: resultadoCreacion.exitosos,
          totalVacantes: Math.max(0, capacidad - resultadoCreacion.exitosos),
          cambiosDetectados: [],
        },
      });
    }

    // ── CASO B: Reconciliación en Nave Existente (Puestos Inmutables) ──────────
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
          data: { estado: "Vacante", comercianteId: null },
        });
      }

      // 2. Procesar asignaciones a puestos (Mantiene Puesto.codigo inmutable)
      for (const asig of asignacionesOcupar) {
        let comercianteIdFinal = asig.comercianteId;

        if (asig.esNuevoComerciante) {
          // Crear nuevo comerciante en la base de datos
          const nuevoCom = await tx.comerciante.create({
            data: {
              ciu: asig.datosComerciante.ciu,
              cedula: asig.datosComerciante.cedula,
              contribuyente: asig.datosComerciante.contribuyente,
              actividad: asig.datosComerciante.actividad,
              puestoId: asig.puestoCodigo, // Siempre el código oficial del puesto de la nave
              nave: asig.datosComerciante.nave,
              estadoRegistro: "Habilitado",
              creadoPor: "importador-reconciliacion",
            },
          });
          comercianteIdFinal = nuevoCom.idInterno;
        } else {
          // Actualizar datos del comerciante existente
          await tx.comerciante.update({
            where: { idInterno: asig.comercianteId },
            data: {
              ciu: asig.datosComerciante.ciu,
              contribuyente: asig.datosComerciante.contribuyente,
              actividad: asig.datosComerciante.actividad,
              puestoId: asig.puestoCodigo, // Siempre el código oficial del puesto de la nave
              nave: asig.datosComerciante.nave,
              estadoRegistro: "Habilitado",
              modificadoPor: "importador-reconciliacion",
            },
          });
        }

        // Vincular el puesto sin alterar su código
        await tx.puesto.update({
          where: { id: asig.puestoId },
          data: {
            estado: "Ocupado",
            comercianteId: comercianteIdFinal,
          },
        });
      }
    });

    await sincronizarPuestosDeNaveEnBD(naveExistente!.id);
    await asegurarAsistenciaInicialDelDia();

    return NextResponse.json({
      exitosos: asignacionesOcupar.length,
      errores: [],
      mensaje: `Reconciliación completada para ${naveExistente!.nombre}: ${asignacionesOcupar.length} puestos actualizados e inmutables.`,
      reconciliacion,
    });
  } catch (error) {
    console.error("Error en POST /api/v1/catastro/importar:", error);
    return NextResponse.json(
      { error: "Error al ejecutar la importación en la base de datos." },
      { status: 500 }
    );
  }
}
