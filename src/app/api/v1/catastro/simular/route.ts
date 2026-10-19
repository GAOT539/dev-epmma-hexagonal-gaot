// ── API Route: POST /api/v1/catastro/simular ──────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  ImportacionRegistro,
  ReconciliacionResumen,
  CambioReconciliacion,
} from "@/domain/models/comerciante.model";

function sonEquivalentes(cod1: string, cod2?: string): boolean {
  if (!cod2) return false;
  return cod1.trim().toUpperCase() === cod2.trim().toUpperCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const registros: ImportacionRegistro[] = body.registros || [];

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

function inferirNaveDesdePuesto(codigoPuesto: string): string | null {
  if (!codigoPuesto) return null;
  const upper = codigoPuesto.trim().toUpperCase();
  if (upper.startsWith("ZCF-") || upper.includes("ZCF-")) {
    return "NAVE CF";
  }
  const match = upper.match(/\bN-([A-ZÑ0-9]+)-/);
  if (match && match[1]) {
    return `NAVE ${match[1]}`;
  }
  return null;
}

    // Análisis de Reconciliación contra MySQL
    const regConNave = registros.find((r) => r.nave && r.nave !== "NO DEFINIDA");
    let naveDetectada = (regConNave?.nave || "").trim().toUpperCase();
    if (!naveDetectada || naveDetectada === "NO DEFINIDA") {
      for (const r of registros) {
        const inf = inferirNaveDesdePuesto(r.puesto || "");
        if (inf) {
          naveDetectada = inf;
          break;
        }
      }
    }
    if (!naveDetectada) naveDetectada = "NAVE A";

    const naveExistente = await prisma.nave.findFirst({
      where: {
        OR: [
          { nombre: naveDetectada },
          { id: naveDetectada.toLowerCase().replace(/\s+/g, "-") },
        ],
      },
      include: {
        puestos: true,
      },
    });

    let reconciliacion: ReconciliacionResumen;

    if (!naveExistente) {
      const totalOcupados = registros.length;
      const capacidadNave = Math.max(totalOcupados, 100);
      const totalVacantes = Math.max(0, capacidadNave - totalOcupados);
      const cambiosDetectados: CambioReconciliacion[] = registros.map((r) => ({
        tipo: "NUEVO",
        puesto: r.puesto || "-",
        nuevo: r.nombre,
        detalle: `Nuevo comerciante ${r.nombre} asignado al puesto ${r.puesto || "-"}`,
      }));

      reconciliacion = {
        naveDetectada,
        esNaveNueva: true,
        capacidadNave,
        totalOcupados,
        totalVacantes,
        cambiosDetectados,
      };
    } else {
      const puestosNave = naveExistente.puestos;
      const comerciantesNave = await prisma.comerciante.findMany({
        where: {
          estadoRegistro: { not: "Deshabilitado" },
          OR: [
            { nave: naveExistente.nombre },
            { puestoId: { in: puestosNave.map((p) => p.codigo) } },
          ],
        },
      });

      const totalOcupados = registros.length;
      const capacidadNave = Math.max(naveExistente.cantidadPuestos, totalOcupados);
      const totalVacantes = Math.max(0, capacidadNave - totalOcupados);
      const cambiosDetectados: CambioReconciliacion[] = [];

      const codigosPuestosEnArchivo = new Set(
        registros.map((r) => (r.puesto || "").trim().toUpperCase()).filter(Boolean)
      );

      for (const reg of registros) {
        const codigoPuesto = (reg.puesto || "-").trim().toUpperCase();
        const puestoActual = puestosNave.find(
          (p) => sonEquivalentes(p.codigo, codigoPuesto) || p.id === codigoPuesto
        );
        const ocupanteActualPuesto =
          puestoActual && puestoActual.comercianteId
            ? comerciantesNave.find((c) => c.idInterno === puestoActual.comercianteId)
            : null;

        if (ocupanteActualPuesto) {
          if (ocupanteActualPuesto.cedula === reg.cedula) {
            if (
              ocupanteActualPuesto.contribuyente.trim().toUpperCase() !== reg.nombre.trim().toUpperCase() ||
              ocupanteActualPuesto.actividad.trim().toUpperCase() !== (reg.actividad || "General").trim().toUpperCase()
            ) {
              cambiosDetectados.push({
                tipo: "ACTUALIZACION",
                puesto: codigoPuesto,
                anterior: `${ocupanteActualPuesto.contribuyente} (${ocupanteActualPuesto.actividad})`,
                nuevo: `${reg.nombre} (${reg.actividad || "General"})`,
                detalle: `Datos actualizados para ${reg.nombre} (${reg.actividad || "General"}) en puesto ${codigoPuesto}`,
              });
            }
          } else {
            cambiosDetectados.push({
              tipo: "REEMPLAZO_OCUPANTE",
              puesto: codigoPuesto,
              anterior: ocupanteActualPuesto.contribuyente,
              nuevo: reg.nombre,
              detalle: `Puesto ${codigoPuesto}: Se reemplazó a ${ocupanteActualPuesto.contribuyente} por ${reg.nombre}`,
            });
          }
        } else {
          const mismoComercianteOtrosPuestos = comerciantesNave.filter((c) => c.cedula === reg.cedula);
          if (mismoComercianteOtrosPuestos.length > 0) {
            cambiosDetectados.push({
              tipo: "NUEVO",
              puesto: codigoPuesto,
              nuevo: reg.nombre,
              detalle: `Comerciante ${reg.nombre} (${reg.cedula}) asignado a puesto adicional ${codigoPuesto}`,
            });
          } else {
            cambiosDetectados.push({
              tipo: "NUEVO",
              puesto: codigoPuesto,
              nuevo: reg.nombre,
              detalle: `Nuevo comerciante ${reg.nombre} asignado al puesto ${codigoPuesto}`,
            });
          }
        }
      }

      // Puestos que estaban ocupados y ya no aparecen en el archivo pasan a Vacante
      for (const p of puestosNave) {
        if (p.estado === "Ocupado" && p.comercianteId && !codigosPuestosEnArchivo.has(p.codigo.toUpperCase())) {
          const comSaliente = comerciantesNave.find((c) => c.idInterno === p.comercianteId);
          cambiosDetectados.push({
            tipo: "VACANTE",
            puesto: p.codigo,
            anterior: comSaliente ? comSaliente.contribuyente : "Ocupante anterior",
            detalle: `Puesto ${p.codigo} queda Vacante (anterior ocupante: ${comSaliente ? comSaliente.contribuyente : "No identificado"})`,
          });
        }
      }

      reconciliacion = {
        naveDetectada,
        esNaveNueva: false,
        capacidadNave,
        totalOcupados,
        totalVacantes,
        cambiosDetectados,
      };
    }

    return NextResponse.json({
      exitosos,
      errores,
      reconciliacion,
    });
  } catch (error) {
    console.error("Error en POST /api/v1/catastro/simular:", error);
    return NextResponse.json({ error: "Error al simular la importación." }, { status: 500 });
  }
}
