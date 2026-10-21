// ── API Route: POST /api/v1/catastro/simular ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import {
  reconciliarCatastroNaveExistente,
  inferirNaveDesdePuesto,
  esCodigoTipoBodegaOLocal,
  expandirRegistrosMultiPuesto,
  generarSlugNave,
} from "@/infrastructure/database/catastro-reconciliacion.service";
import { getAuthenticatedUser, userCanAccessNave } from "@/infrastructure/auth/authorization";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const registrosRaw: ImportacionRegistro[] = body.registros || [];
    const registros: ImportacionRegistro[] = expandirRegistrosMultiPuesto(registrosRaw);
    const naveIdManual: string | undefined = body.naveIdManual?.trim();
    const crearNuevaNave: boolean = Boolean(body.crearNuevaNave);
    const nuevoNombreNave: string | undefined = body.nuevoNombreNave?.trim();
    const modoUnificacion: "UNIFICAR" | "SEPARAR" = body.modoUnificacion || "UNIFICAR";

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

      // Si el usuario eligió separar como nave independiente (ej. BODEGA NAVE H vs NAVE H)
      if (modoUnificacion === "SEPARAR" && naveDetectada && contieneBodegas && !naveDetectada.startsWith("BODEGA")) {
        naveDetectada = `BODEGA ${naveDetectada}`;
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

    if (actor.rol === "SUPERVISOR" && (!naveExistente || !(await userCanAccessNave(request, naveExistente.id)))) {
      return NextResponse.json({ error: "La nave no pertenece al supervisor autenticado." }, { status: 403 });
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
          esArchivoBodegas: contieneBodegas,
          modoUnificacion,
          cambiosDetectados: [],
        },
      });
    }

    // 3. Si se solicita crear una nueva nave
    if (crearNuevaNave || (!naveExistente && modoUnificacion === "SEPARAR")) {
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
    console.error("Error en POST /api/v1/catastro/simular:", error);
    return NextResponse.json({ error: "Error al simular la importación." }, { status: 500 });
  }
}
