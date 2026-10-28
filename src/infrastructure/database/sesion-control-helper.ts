// ── Helper de Asistencia e Infraestructura: Aseguramiento de Sesión de Control ──

import { prisma } from "@/infrastructure/database/prisma";
import type { Prisma } from "@prisma/client";
import type {
  DetalleComercianteControl,
  EtiquetaControlSupervisor,
  ResumenSesionControl,
} from "@/domain/models/auditoria.model";
import type { EstadoAsistencia } from "@/domain/models/asistencia.model";

export async function asegurarSesionControlActivaDia(params: {
  naveId: string;
  fechaJornada: string;
  usuarioActor?: { id: string; nombres: string; apellidos: string; rol?: string } | null;
  accion?: string;
}): Promise<void> {
  const { naveId, fechaJornada, usuarioActor, accion = "Ingreso y gestión operativa" } = params;

  try {
    const sesionExistente = await prisma.sesionControlSupervisor.findFirst({
      where: { naveId, fechaJornada },
    });
    if (sesionExistente) return;

    const nave = await prisma.nave.findUnique({
      where: { id: naveId },
      include: {
        puestos: {
          where: { estado: "Ocupado" },
          include: { comerciante: true },
        },
      },
    });
    if (!nave) return;

    let supervisorId = usuarioActor?.id;
    let supervisorNombre = usuarioActor
      ? `${usuarioActor.nombres} ${usuarioActor.apellidos}`.trim()
      : "";

    if (!supervisorId) {
      const supervisoresAsignados = Array.isArray(nave.supervisores)
        ? (nave.supervisores as string[])
        : [];
      const todosSupervisores = await prisma.usuario.findMany({
        where: { rol: "SUPERVISOR", estado: "Habilitado" },
      });

      const supUser = todosSupervisores.find((s) => {
        const nombreCompleto = `${s.nombres} ${s.apellidos}`.trim().toLowerCase();
        const navesStr =
          typeof s.navesAsignadas === "string"
            ? s.navesAsignadas
            : Array.isArray(s.navesAsignadas)
            ? (s.navesAsignadas as string[]).join(", ")
            : JSON.stringify(s.navesAsignadas || "");

        return (
          supervisoresAsignados.some((nom) =>
            nombreCompleto.includes(String(nom).toLowerCase())
          ) || navesStr.toLowerCase().includes(nave.nombre.toLowerCase())
        );
      }) || todosSupervisores[0];

      if (supUser) {
        supervisorId = supUser.id;
        supervisorNombre = `${supUser.nombres} ${supUser.apellidos}`.trim();
      } else {
        supervisorId = "supervisor-sistema";
        supervisorNombre = "Supervisor Asignado";
      }
    }

    const comIds = nave.puestos
      .map((p) => p.comercianteId)
      .filter((id): id is string => Boolean(id));

    const registrosDia = await prisma.registroAsistencia.findMany({
      where: {
        fecha: fechaJornada,
        comercianteId: { in: comIds },
      },
    });
    const regMap = new Map(registrosDia.map((r) => [r.comercianteId, r]));
    const horaRegistro = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    const detallesComerciantes: DetalleComercianteControl[] = nave.puestos
      .filter((p) => p.comerciante && p.comerciante.estadoRegistro === "Habilitado")
      .map((p) => {
        const com = p.comerciante!;
        const r = regMap.get(com.idInterno);
        return {
          comercianteId: com.idInterno,
          ciu: com.ciu,
          cedula: com.cedula,
          contribuyente: com.contribuyente,
          puesto: p.codigo,
          estado: (r?.estado ?? "Presente") as EstadoAsistencia,
          metodo: "MANUAL" as const,
          horaRegistro,
        };
      });

    const presentes = detallesComerciantes.filter((d) => d.estado === "Presente").length;
    const ausentes = detallesComerciantes.filter((d) => d.estado === "Ausente").length;
    const permisos = detallesComerciantes.filter((d) => d.estado === "Permiso").length;

    const resumen: ResumenSesionControl = {
      totalOcupados: detallesComerciantes.length,
      tomados: detallesComerciantes.length,
      presentes,
      ausentes,
      permisos,
    };

    const etiquetas: EtiquetaControlSupervisor[] = ["EN_FECHA"];

    await prisma.sesionControlSupervisor.create({
      data: {
        supervisorId,
        supervisorNombre,
        naveId: nave.id,
        naveNombre: nave.nombre,
        fechaJornada,
        accion,
        esPersistencia: false,
        etiquetas: etiquetas as unknown as Prisma.InputJsonValue,
        resumen: resumen as unknown as Prisma.InputJsonValue,
        detallesComerciantes: detallesComerciantes as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("Error al asegurar sesión de control activa:", err);
  }
}
