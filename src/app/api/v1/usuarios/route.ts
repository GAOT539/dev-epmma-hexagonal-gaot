// ── API Route: /api/v1/usuarios ───────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/infrastructure/auth/password.utils";
import type { Rol, EstadoUsuario, Prisma } from "@prisma/client";
import { logError, esErrorConexionBD } from "@/infrastructure/logger/system-logger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rolFiltro = searchParams.get("rol");

    const where: Prisma.UsuarioWhereInput = {};
    if (rolFiltro) {
      where.rol = rolFiltro as Rol;
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: { creadoEn: "desc" },
    });

    const sanitizados = usuarios.map((u) => ({
      id: u.id,
      cedula: u.cedula,
      nombres: u.nombres,
      apellidos: u.apellidos,
      correo: u.correo ?? undefined,
      rol: u.rol,
      mustChangePassword: u.mustChangePassword,
      navesAsignadas: Array.isArray(u.navesAsignadas) ? (u.navesAsignadas as string[]) : [],
      estado: u.estado,
    }));

    return NextResponse.json(sanitizados);
  } catch (error) {
    logError("API", "Error en GET /api/v1/usuarios", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error al obtener usuarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cedula, nombres, apellidos, correo, rol, navesAsignadas, estado } = body;

    const cleanCedula = String(cedula ?? "").trim();
    const cleanNombres = String(nombres ?? "").trim();
    const cleanApellidos = String(apellidos ?? "").trim();
    const cleanCorreo = String(correo ?? "").trim().toLowerCase();
    const cleanRol = rol as Rol;

    if (!cleanCedula || !cleanNombres || !cleanApellidos || !cleanCorreo || !cleanRol) {
      return NextResponse.json(
        { error: "Cédula, nombres, apellidos, correo electrónico y rol son obligatorios." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanCorreo)) {
      return NextResponse.json(
        { error: "Debe ingresar un correo electrónico válido." },
        { status: 400 }
      );
    }

    // Comprobar cédula duplicada
    const existenteCedula = await prisma.usuario.findFirst({
      where: { cedula: cleanCedula },
    });
    if (existenteCedula) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con ese número de cédula." },
        { status: 400 }
      );
    }

    // Comprobar correo duplicado
    const existenteCorreo = await prisma.usuario.findFirst({
      where: { correo: cleanCorreo },
    });
    if (existenteCorreo) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con ese correo electrónico." },
        { status: 400 }
      );
    }

    // Contraseña inicial: ${cedula}* hasheada
    const rawPass = `${cleanCedula}*`;
    const passwordHash = await hashPassword(rawPass);

    const naves = Array.isArray(navesAsignadas) ? navesAsignadas : [];

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        cedula: cleanCedula,
        nombres: cleanNombres,
        apellidos: cleanApellidos,
        correo: cleanCorreo,
        rol: cleanRol,
        mustChangePassword: true,
        passwordHash,
        navesAsignadas: naves,
        estado: (estado as EstadoUsuario) || "Habilitado",
      },
    });

    // Si es SUPERVISOR y se asignaron naves, sincronizar bidireccionalmente el array supervisores en la tabla naves
    if (nuevoUsuario.rol === "SUPERVISOR" && naves.length > 0) {
      const nombreCompleto = `${nuevoUsuario.nombres} ${nuevoUsuario.apellidos}`.trim();
      for (const naveId of naves) {
        const nave = await prisma.nave.findUnique({ where: { id: naveId } });
        if (nave) {
          const actualSupervisores = Array.isArray(nave.supervisores)
            ? (nave.supervisores as string[])
            : [];
          if (!actualSupervisores.includes(nombreCompleto)) {
            await prisma.nave.update({
              where: { id: naveId },
              data: {
                supervisores: [...actualSupervisores, nombreCompleto],
              },
            });
          }
        }
      }
    }

    return NextResponse.json(
      {
        id: nuevoUsuario.id,
        cedula: nuevoUsuario.cedula,
        nombres: nuevoUsuario.nombres,
        apellidos: nuevoUsuario.apellidos,
        correo: nuevoUsuario.correo ?? undefined,
        rol: nuevoUsuario.rol,
        mustChangePassword: nuevoUsuario.mustChangePassword,
        navesAsignadas: naves,
        estado: nuevoUsuario.estado,
      },
      { status: 201 }
    );
  } catch (error) {
    logError("API", "Error en POST /api/v1/usuarios", error);
    if (esErrorConexionBD(error)) {
      return NextResponse.json(
        {
          error:
            "El servidor de base de datos MySQL no se encuentra disponible en este momento. Verifique que el servicio esté iniciado.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Error interno al crear usuario." }, { status: 500 });
  }
}
