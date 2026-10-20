// ── API Route: POST /api/v1/catastro/simular ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
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
      // Intentar inferir nave desde la columna nave o desde los códigos de puesto
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

    // 2. Si la nave no fue encontrada y no se solicitó crear nueva nave
    if (!naveExistente && !crearNuevaNave) {
      const navesDisponibles = await prisma.nave.findMany({
        where: { estadoRegistro: { not: "Deshabilitado" } },
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
          cambiosDetectados: registros.map((r) => ({
            tipo: "NUEVO" as const,
            puesto: r.puesto || "-",
            nuevo: r.nombre,
            detalle: `Nuevo comerciante ${r.nombre} asignado al puesto ${r.puesto || "-"}`,
          })),
        },
      });
    }

    // 4. Reconciliación estricta para Nave Existente
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
      reconciliacion: resultadoReconciliacion.reconciliacion,
    });
  } catch (error) {
    console.error("Error en POST /api/v1/catastro/simular:", error);
    return NextResponse.json({ error: "Error al simular la importación." }, { status: 500 });
  }
}
