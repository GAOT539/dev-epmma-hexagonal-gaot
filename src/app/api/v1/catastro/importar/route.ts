import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { ImportacionRegistro } from "@/domain/models/comerciante.model";
import { asegurarAsistenciaInicialDelDia } from "@/infrastructure/database/daily-attendance.service";
import { sincronizarPuestosDeNaveEnBD } from "@/infrastructure/database/nave-puestos-sync.service";

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

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener o crear la nave
      let naveObj = await tx.nave.findFirst({
        where: {
          OR: [
            { nombre: naveDetectada },
            { id: naveDetectada.toLowerCase().replace(/\s+/g, "-") },
          ],
        },
        include: { puestos: true },
      });

      const totalOcupados = registros.length;
      const capacidadNecesaria = Math.max(naveObj ? naveObj.cantidadPuestos : 100, totalOcupados);

      if (!naveObj) {
        const idSlug = naveDetectada
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `nave-${Date.now()}`;

        naveObj = await tx.nave.create({
          data: {
            id: idSlug,
            nombre: naveDetectada,
            cantidadPuestos: capacidadNecesaria,
            limitePuestos: capacidadNecesaria,
            supervisores: [],
            estadoRegistro: "Habilitado",
          },
          include: { puestos: true },
        });

        // Crear plano vacío para la nueva nave
        const celdasPlano = [];
        for (let r = 0; r < 12; r++) {
          for (let c = 0; c < 12; c++) {
            celdasPlano.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
          }
        }
        await tx.planoNave.create({
          data: {
            naveId: naveObj.id,
            filas: 12,
            columnas: 12,
            planoJson: celdasPlano,
          },
        });
      } else if (naveObj.cantidadPuestos < capacidadNecesaria) {
        // Ampliar capacidad si el archivo trae más puestos
        await tx.nave.update({
          where: { id: naveObj.id },
          data: {
            cantidadPuestos: capacidadNecesaria,
            limitePuestos: capacidadNecesaria,
          },
        });
      }

      const naveIdFinal = naveObj.id;
      const puestosActuales = await tx.puesto.findMany({ where: { naveId: naveIdFinal } });
      const codigosPuestosEnArchivo = new Set(
        registros.map((r) => (r.puesto || "").trim().toUpperCase()).filter(Boolean)
      );

      // 2. Desvincular puestos de esta nave que ya no están ocupados en el nuevo archivo
      for (const p of puestosActuales) {
        if (p.estado === "Ocupado" && !codigosPuestosEnArchivo.has(p.codigo.toUpperCase())) {
          if (p.comercianteId) {
            await tx.comerciante.updateMany({
              where: { idInterno: p.comercianteId },
              data: { puestoId: null },
            });
          }
          await tx.puesto.update({
            where: { id: p.id },
            data: { estado: "Vacante", comercianteId: null },
          });
          p.estado = "Vacante";
          p.comercianteId = null;
        }
      }

      // 3. Procesar cada registro del archivo soportando múltiples puestos por comerciante
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

        const codigoPuesto = (reg.puesto || "-").trim().toUpperCase();
        const ciuNormalizado = (reg.ciu && reg.ciu !== "-" && reg.ciu.trim().length > 0)
          ? reg.ciu.trim()
          : "S/N";

        // Buscar o crear el puesto en la nave
        let puesto = puestosActuales.find(
          (p) => p.codigo.toUpperCase() === codigoPuesto
        );

        if (!puesto) {
          puesto = await tx.puesto.create({
            data: {
              id: crypto.randomUUID(),
              codigo: codigoPuesto,
              naveId: naveIdFinal,
              estado: "Ocupado",
            },
          });
          puestosActuales.push(puesto);
        }

        // Determinar o actualizar el registro del comerciante para este puesto específico
        let comerciante = null;

        // A. Si el puesto ya tiene un comerciante asignado
        if (puesto.comercianteId) {
          const comAsignado = await tx.comerciante.findUnique({
            where: { idInterno: puesto.comercianteId },
          });
          if (comAsignado) {
            comerciante = await tx.comerciante.update({
              where: { idInterno: comAsignado.idInterno },
              data: {
                ciu: ciuNormalizado,
                cedula,
                contribuyente: nombre,
                actividad: reg.actividad || "General",
                puestoId: codigoPuesto,
                nave: naveObj.nombre,
                estadoRegistro: "Habilitado",
                modificadoPor: "importador-archivo",
              },
            });
          }
        }

        // B. Si no estaba asignado en el puesto, buscar si existe un registro con esta cédula y puesto
        if (!comerciante) {
          const comExistente = await tx.comerciante.findFirst({
            where: {
              cedula,
              puestoId: codigoPuesto,
              nave: naveObj.nombre,
            },
          });
          if (comExistente) {
            comerciante = await tx.comerciante.update({
              where: { idInterno: comExistente.idInterno },
              data: {
                ciu: ciuNormalizado,
                contribuyente: nombre,
                actividad: reg.actividad || "General",
                estadoRegistro: "Habilitado",
                modificadoPor: "importador-archivo",
              },
            });
          }
        }

        // C. Si es un nuevo comerciante o un puesto adicional para la misma persona, crear el registro
        if (!comerciante) {
          comerciante = await tx.comerciante.create({
            data: {
              ciu: ciuNormalizado,
              cedula,
              contribuyente: nombre,
              actividad: reg.actividad || "General",
              puestoId: codigoPuesto,
              nave: naveObj.nombre,
              estadoRegistro: "Habilitado",
              creadoPor: "importador-archivo",
            },
          });
        }

        // Vincular y ocupar el puesto garantizando relación unívoca por puesto
        await tx.puesto.update({
          where: { id: puesto.id },
          data: {
            estado: "Ocupado",
            comercianteId: comerciante.idInterno,
          },
        });
        puesto.comercianteId = comerciante.idInterno;
        puesto.estado = "Ocupado";

        exitosos++;
      }

      // 4. Limpieza de puestos vacantes genéricos sobrantes si superan capacidadNecesaria
      const totalPuestosEnNave = await tx.puesto.count({
        where: { naveId: naveIdFinal },
      });

      if (totalPuestosEnNave > capacidadNecesaria) {
        const puestosVacantes = await tx.puesto.findMany({
          where: {
            naveId: naveIdFinal,
            estado: "Vacante",
            comercianteId: null,
          },
          select: { id: true },
        });

        const cantidadAEliminar = totalPuestosEnNave - capacidadNecesaria;
        const idsAEliminar = puestosVacantes.slice(0, cantidadAEliminar).map((p) => p.id);

        if (idsAEliminar.length > 0) {
          await tx.puesto.deleteMany({
            where: { id: { in: idsAEliminar } },
          });
        }
      }

      return { exitosos, errores, naveId: naveIdFinal };
    });

    await sincronizarPuestosDeNaveEnBD(resultado.naveId);
    if (resultado.exitosos > 0) {
      await asegurarAsistenciaInicialDelDia();
    }

    return NextResponse.json({
      exitosos: resultado.exitosos,
      errores: resultado.errores,
      mensaje: `Importación completada: ${resultado.exitosos} registros procesados correctamente.`,
    });
  } catch (error) {
    console.error("Error en POST /api/v1/catastro/importar:", error);
    return NextResponse.json({ error: "Error al ejecutar la importación en la base de datos." }, { status: 500 });
  }
}
