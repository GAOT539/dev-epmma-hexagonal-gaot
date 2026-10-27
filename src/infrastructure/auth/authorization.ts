import { prisma } from "@/infrastructure/database/prisma";
import { AUTH_COOKIE_NAME, verificarTokenJwt } from "@/infrastructure/auth/jwt.utils";
import { obtenerFechaHoyEcuador } from "@/infrastructure/database/daily-attendance.service";

export async function getAuthenticatedUser(request: Request) {
  let userId = request.headers.get("x-user-id");

  if (!userId) {
    const authHeader = request.headers.get("Authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`));
      token = match ? decodeURIComponent(match[1]) : null;
    }
    if (token) {
      const payload = await verificarTokenJwt(token);
      if (payload?.sub) {
        userId = payload.sub;
      }
    }
  }

  if (!userId) return null;

  return prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      rol: true,
      estado: true,
      navesAsignadas: true,
      nombres: true,
      apellidos: true,
    },
  });
}

export async function userCanAccessNave(request: Request, naveId: string): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  if (!user || user.estado !== "Habilitado") return false;
  if (user.rol !== "SUPERVISOR") return true;

  const nave = await prisma.nave.findUnique({
    where: { id: naveId },
    select: { id: true, nombre: true, supervisores: true },
  });
  if (!nave) return false;

  const asignadas = Array.isArray(user.navesAsignadas)
    ? (user.navesAsignadas as string[]).map((s) => String(s).normalize("NFC").trim().toLowerCase())
    : [];

  const idNorm = nave.id.normalize("NFC").trim().toLowerCase();
  const nombreNorm = nave.nombre.normalize("NFC").trim().toLowerCase();
  const matchAsignadas = asignadas.includes(idNorm) || asignadas.includes(nombreNorm);

  const nombreCompleto = `${user.nombres} ${user.apellidos}`.trim().toLowerCase();
  const supervisoresNave = Array.isArray(nave.supervisores)
    ? (nave.supervisores as string[]).map((s) => String(s).trim().toLowerCase())
    : [];
  const matchSupervisores = supervisoresNave.includes(nombreCompleto);

  if (matchAsignadas || matchSupervisores) return true;

  // Comprobar reemplazo temporal vigente hoy
  const hoyStr = obtenerFechaHoyEcuador();
  const reemplazoActivo = await prisma.coberturaNaveSupervisor.findFirst({
    where: {
      naveId,
      supervisorReemplazoId: user.id,
      tipoCobertura: "REEMPLAZO_TEMPORAL",
      estado: "ACTIVO",
      fechaInicio: { lte: hoyStr },
      fechaFin: { gte: hoyStr },
      permiso: { estado: "ACTIVO" },
    },
  });

  return Boolean(reemplazoActivo);
}

export async function userCanAccessComerciante(
  request: Request,
  comercianteId: string
): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  if (!user || user.estado !== "Habilitado") return false;
  if (user.rol !== "SUPERVISOR") return true;

  const puesto = await prisma.puesto.findFirst({
    where: { comercianteId },
    select: { naveId: true },
  });
  if (puesto) return userCanAccessNave(request, puesto.naveId);

  const comerciante = await prisma.comerciante.findUnique({
    where: { idInterno: comercianteId },
    select: { nave: true },
  });
  if (!comerciante?.nave) return false;

  const nave = await prisma.nave.findFirst({
    where: { OR: [{ id: comerciante.nave }, { nombre: comerciante.nave }] },
    select: { id: true },
  });
  return nave ? userCanAccessNave(request, nave.id) : false;
}

export async function getAccessibleNaveIds(request: Request): Promise<string[] | null> {
  const user = await getAuthenticatedUser(request);
  if (!user || user.estado !== "Habilitado") return [];
  if (user.rol !== "SUPERVISOR") return null;

  const asignadas = Array.isArray(user.navesAsignadas)
    ? (user.navesAsignadas as string[]).map((s) => String(s).normalize("NFC").trim().toLowerCase())
    : [];

  const nombreCompleto = `${user.nombres} ${user.apellidos}`.trim().toLowerCase();

  const hoyStr = obtenerFechaHoyEcuador();
  const [todasNaves, coberturasTemporales] = await Promise.all([
    prisma.nave.findMany({
      where: { estadoRegistro: { not: "Deshabilitado" } },
      select: { id: true, nombre: true, supervisores: true },
    }),
    prisma.coberturaNaveSupervisor.findMany({
      where: {
        supervisorReemplazoId: user.id,
        tipoCobertura: "REEMPLAZO_TEMPORAL",
        estado: "ACTIVO",
        fechaInicio: { lte: hoyStr },
        fechaFin: { gte: hoyStr },
        permiso: { estado: "ACTIVO" },
      },
      select: { naveId: true },
    }),
  ]);

  const naveIdsTemporales = new Set(coberturasTemporales.map((c) => c.naveId));

  return todasNaves
    .filter((nave) => {
      if (naveIdsTemporales.has(nave.id)) return true;

      const idNorm = nave.id.normalize("NFC").trim().toLowerCase();
      const nombreNorm = nave.nombre.normalize("NFC").trim().toLowerCase();
      const matchAsignadas = asignadas.includes(idNorm) || asignadas.includes(nombreNorm);

      const supervisoresNave = Array.isArray(nave.supervisores)
        ? (nave.supervisores as string[]).map((s) => String(s).trim().toLowerCase())
        : [];
      const matchSupervisores = supervisoresNave.includes(nombreCompleto);

      return matchAsignadas || matchSupervisores;
    })
    .map((nave) => nave.id);
}
