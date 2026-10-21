import { prisma } from "@/infrastructure/database/prisma";

export async function getAuthenticatedUser(request: Request) {
  const userId = request.headers.get("x-user-id");
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
    select: { id: true, nombre: true },
  });
  if (!nave) return false;

  const asignadas = Array.isArray(user.navesAsignadas)
    ? (user.navesAsignadas as string[])
    : [];
  return asignadas.includes(nave.id) || asignadas.includes(nave.nombre);
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
    ? (user.navesAsignadas as string[])
    : [];
  const naves = await prisma.nave.findMany({
    where: { OR: [{ id: { in: asignadas } }, { nombre: { in: asignadas } }] },
    select: { id: true },
  });
  return naves.map((nave) => nave.id);
}
