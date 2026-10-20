// ── API Route: /api/v1/naves/[id] ─────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const nave = await prisma.nave.findUnique({
      where: { id },
      include: {
        puestos: true,
      },
    });

    if (!nave) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    return NextResponse.json({
      id: nave.id,
      nombre: nave.nombre,
      cantidadPuestos: nave.cantidadPuestos,
      limitePuestos: nave.limitePuestos,
      supervisores: Array.isArray(nave.supervisores) ? (nave.supervisores as string[]) : [],
      estadoRegistro: nave.estadoRegistro,
      puestos: nave.puestos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        naveId: p.naveId,
        estado: p.estado,
        comercianteId: p.comercianteId ?? undefined,
      })),
    });
  } catch (error) {
    console.error("Error en GET /api/v1/naves/[id]:", error);
    return NextResponse.json({ error: "Error al obtener la nave." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, cantidadPuestos, supervisores } = body;

    const naveActual = await prisma.nave.findUnique({
      where: { id },
      include: { puestos: true },
    });

    if (!naveActual) {
      return NextResponse.json({ error: "Nave no encontrada." }, { status: 404 });
    }

    // Validar cantidad de puestos contra puestos ocupados
    const puestosOcupados = naveActual.puestos.filter((p) => p.estado === "Ocupado");
    if (cantidadPuestos !== undefined && Number(cantidadPuestos) < puestosOcupados.length) {
      return NextResponse.json(
        {
          error: `No es posible reducir la capacidad a ${cantidadPuestos} puestos porque actualmente hay ${puestosOcupados.length} puestos ocupados.`,
        },
        { status: 400 }
      );
    }

    const nuevoNombre = nombre ? String(nombre).trim().toUpperCase() : naveActual.nombre;
    const nuevaCantidad = cantidadPuestos !== undefined ? Number(cantidadPuestos) : naveActual.cantidadPuestos;
    const nuevosSupervisores = Array.isArray(supervisores)
      ? supervisores
      : Array.isArray(naveActual.supervisores)
      ? (naveActual.supervisores as string[])
      : [];

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar datos de la nave
      await tx.nave.update({
        where: { id },
        data: {
          nombre: nuevoNombre,
          cantidadPuestos: nuevaCantidad,
          limitePuestos: nuevaCantidad,
          supervisores: nuevosSupervisores,
        },
      });

      // 2. Si cambió el nombre, actualizarlo en los comerciantes de esta nave
      if (nuevoNombre !== naveActual.nombre) {
        await tx.comerciante.updateMany({
          where: { nave: naveActual.nombre },
          data: { nave: nuevoNombre },
        });
      }

      // 3. Ajustar puestos si la cantidad cambió
      const diferencia = nuevaCantidad - naveActual.puestos.length;
      if (diferencia > 0) {
        // Crear nuevos puestos vacantes calculando el prefijo desde el nombre de la nave
        const prefix = nuevoNombre.replace(/^NAVE\s+/i, "N-").replace(/\s+/g, "-");
        const nuevosPuestos = [];
        for (let i = 1; i <= diferencia; i++) {
          const num = naveActual.puestos.length + i;
          nuevosPuestos.push({
            id: crypto.randomUUID(),
            codigo: `${prefix}-${String(num).padStart(2, "0")}`,
            naveId: id,
            estado: "Vacante" as const,
          });
        }
        await tx.puesto.createMany({ data: nuevosPuestos });
      } else if (diferencia < 0) {
        // Eliminar puestos vacantes sobrantes
        const vacantes = naveActual.puestos
          .filter((p) => p.estado === "Vacante")
          .slice(diferencia); // toma los últimos
        const idsAEliminar = vacantes.map((p) => p.id);
        if (idsAEliminar.length > 0) {
          await tx.puesto.deleteMany({
            where: { id: { in: idsAEliminar } },
          });
        }
      }

      // 4. Sincronizar navesAsignadas en supervisores
      const todosSupervisores = await tx.usuario.findMany({ where: { rol: "SUPERVISOR" } });
      for (const u of todosSupervisores) {
        const nombreCompleto = `${u.nombres} ${u.apellidos}`.trim();
        const asignadas = Array.isArray(u.navesAsignadas) ? (u.navesAsignadas as string[]) : [];

        if (nuevosSupervisores.includes(nombreCompleto)) {
          if (!asignadas.includes(id)) {
            await tx.usuario.update({
              where: { id: u.id },
              data: { navesAsignadas: [...asignadas, id] },
            });
          }
        } else {
          if (asignadas.includes(id)) {
            await tx.usuario.update({
              where: { id: u.id },
              data: { navesAsignadas: asignadas.filter((nId) => nId !== id) },
            });
          }
        }
      }
    });

    const naveActualizada = await prisma.nave.findUnique({
      where: { id },
      include: { puestos: true },
    });

    return NextResponse.json({
      id: naveActualizada!.id,
      nombre: naveActualizada!.nombre,
      cantidadPuestos: naveActualizada!.cantidadPuestos,
      limitePuestos: naveActualizada!.limitePuestos,
      supervisores: Array.isArray(naveActualizada!.supervisores) ? (naveActualizada!.supervisores as string[]) : [],
      estadoRegistro: naveActualizada!.estadoRegistro,
      puestos: naveActualizada!.puestos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        naveId: p.naveId,
        estado: p.estado,
        comercianteId: p.comercianteId ?? undefined,
      })),
    });
  } catch (error) {
    console.error("Error en PUT /api/v1/naves/[id]:", error);
    return NextResponse.json({ error: "Error al actualizar la nave." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const nave = await prisma.nave.findUnique({
      where: { id },
      include: {
        puestos: {
          where: { estado: "Ocupado" },
        },
      },
    });

    if (!nave) {
      return NextResponse.json({ exito: false, mensaje: "Nave no encontrada." }, { status: 404 });
    }

    if (nave.puestos.length > 0) {
      return NextResponse.json({
        exito: false,
        mensaje: "No se puede eliminar la nave porque tiene comerciantes asignados.",
      });
    }

    // Comprobar también comerciantes con nave = nombre
    const comerciantesEnNave = await prisma.comerciante.count({
      where: {
        nave: nave.nombre,
        estadoRegistro: "Habilitado",
      },
    });

    if (comerciantesEnNave > 0) {
      return NextResponse.json({
        exito: false,
        mensaje: "No se puede eliminar la nave porque tiene comerciantes asignados.",
      });
    }

    // Eliminar en cascada
    await prisma.$transaction(async (tx) => {
      await tx.planoNave.deleteMany({ where: { naveId: id } });
      await tx.puesto.deleteMany({ where: { naveId: id } });
      await tx.nave.delete({ where: { id } });

      // Limpiar asignaciones en usuarios
      const supervisores = await tx.usuario.findMany({ where: { rol: "SUPERVISOR" } });
      for (const u of supervisores) {
        const asignadas = Array.isArray(u.navesAsignadas) ? (u.navesAsignadas as string[]) : [];
        if (asignadas.includes(id)) {
          await tx.usuario.update({
            where: { id: u.id },
            data: { navesAsignadas: asignadas.filter((nId) => nId !== id) },
          });
        }
      }
    });

    return NextResponse.json({ exito: true, mensaje: "Nave eliminada correctamente." });
  } catch (error) {
    console.error("Error en DELETE /api/v1/naves/[id]:", error);
    return NextResponse.json({ exito: false, mensaje: "Error al eliminar la nave." }, { status: 500 });
  }
}
