// ── API Route: /api/v1/usuarios/[id] ──────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import type { Rol, EstadoUsuario, Prisma } from "@prisma/client";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      id: usuario.id,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo ?? undefined,
      rol: usuario.rol,
      mustChangePassword: usuario.mustChangePassword,
      navesAsignadas: Array.isArray(usuario.navesAsignadas) ? (usuario.navesAsignadas as string[]) : [],
      estado: usuario.estado,
    });
  } catch (error) {
    logError("API", "Error en GET /api/v1/usuarios/[id]", error);
    return NextResponse.json({ error: "Error al obtener usuario." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const usuarioPrevio = await prisma.usuario.findUnique({ where: { id } });
    if (!usuarioPrevio) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const updateData: Prisma.UsuarioUpdateInput = {};
    if (body.cedula !== undefined) {
      const cleanCedula = String(body.cedula).trim();
      if (!cleanCedula) {
        return NextResponse.json({ error: "La cédula no puede estar vacía." }, { status: 400 });
      }
      const existenteCedula = await prisma.usuario.findFirst({
        where: {
          cedula: cleanCedula,
          NOT: { id },
        },
      });
      if (existenteCedula) {
        return NextResponse.json(
          { error: "Ya existe un usuario registrado con ese número de cédula." },
          { status: 400 }
        );
      }
      updateData.cedula = cleanCedula;
    }

    if (body.correo !== undefined) {
      const cleanCorreo = String(body.correo).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanCorreo || !emailRegex.test(cleanCorreo)) {
        return NextResponse.json(
          { error: "Debe ingresar un correo electrónico válido." },
          { status: 400 }
        );
      }
      const existenteCorreo = await prisma.usuario.findFirst({
        where: {
          correo: cleanCorreo,
          NOT: { id },
        },
      });
      if (existenteCorreo) {
        return NextResponse.json(
          { error: "Ya existe un usuario registrado con ese correo electrónico." },
          { status: 400 }
        );
      }
      updateData.correo = cleanCorreo;
    }

    if (body.nombres) updateData.nombres = String(body.nombres).trim();
    if (body.apellidos) updateData.apellidos = String(body.apellidos).trim();
    if (body.rol) updateData.rol = body.rol as Rol;
    if (body.estado) updateData.estado = body.estado as EstadoUsuario;
    if (body.navesAsignadas !== undefined) {
      updateData.navesAsignadas = Array.isArray(body.navesAsignadas) ? body.navesAsignadas : [];
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: updateData,
    });

    const nombrePrevio = `${usuarioPrevio.nombres} ${usuarioPrevio.apellidos}`.trim();
    const nombreNuevo = `${actualizado.nombres} ${actualizado.apellidos}`.trim();
    const nuevasNaves = Array.isArray(actualizado.navesAsignadas)
      ? (actualizado.navesAsignadas as string[])
      : [];

    // Sincronización bidireccional en las naves si el usuario es o era supervisor
    if (actualizado.rol === "SUPERVISOR" || usuarioPrevio.rol === "SUPERVISOR") {
      const todasLasNaves = await prisma.nave.findMany();
      for (const nave of todasLasNaves) {
        const supervisoresActuales = Array.isArray(nave.supervisores)
          ? (nave.supervisores as string[])
          : [];

        if (actualizado.rol === "SUPERVISOR" && nuevasNaves.includes(nave.id)) {
          // Asegurar que su nuevo nombre esté presente
          const filtrados = supervisoresActuales.filter((s) => s !== nombrePrevio);
          if (!filtrados.includes(nombreNuevo)) {
            filtrados.push(nombreNuevo);
          }
          await prisma.nave.update({
            where: { id: nave.id },
            data: { supervisores: filtrados },
          });
        } else {
          // Si ya no está asignada o dejó de ser supervisor, remover su nombre
          if (supervisoresActuales.includes(nombrePrevio) || supervisoresActuales.includes(nombreNuevo)) {
            const limpios = supervisoresActuales.filter(
              (s) => s !== nombrePrevio && s !== nombreNuevo
            );
            await prisma.nave.update({
              where: { id: nave.id },
              data: { supervisores: limpios },
            });
          }
        }
      }
    }

    return NextResponse.json({
      id: actualizado.id,
      cedula: actualizado.cedula,
      nombres: actualizado.nombres,
      apellidos: actualizado.apellidos,
      correo: actualizado.correo ?? undefined,
      rol: actualizado.rol,
      mustChangePassword: actualizado.mustChangePassword,
      navesAsignadas: nuevasNaves,
      estado: actualizado.estado,
    });
  } catch (error) {
    logError("API", "Error en PUT /api/v1/usuarios/[id]", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al actualizar usuario." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Proteger al superadmin
    if (id === "u-super" || id === "admin") {
      return NextResponse.json(
        { error: "No es posible deshabilitar o eliminar la cuenta principal de SUPERADMIN." },
        { status: 403 }
      );
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    // Soft delete: marcar como deshabilitado y limpiar naves
    await prisma.usuario.update({
      where: { id },
      data: {
        estado: "Deshabilitado",
        navesAsignadas: [],
      },
    });

    // Remover al supervisor de todas las naves
    const nombreCompleto = `${usuario.nombres} ${usuario.apellidos}`.trim();
    const todasLasNaves = await prisma.nave.findMany();
    for (const nave of todasLasNaves) {
      const supervisores = Array.isArray(nave.supervisores) ? (nave.supervisores as string[]) : [];
      if (supervisores.includes(nombreCompleto)) {
        await prisma.nave.update({
          where: { id: nave.id },
          data: {
            supervisores: supervisores.filter((s) => s !== nombreCompleto),
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Usuario deshabilitado exitosamente." });
  } catch (error) {
    console.error("Error en DELETE /api/v1/usuarios/[id]:", error);
    return NextResponse.json({ error: "Error al deshabilitar usuario." }, { status: 500 });
  }
}
