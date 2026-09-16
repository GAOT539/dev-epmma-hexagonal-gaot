// ── Infraestructura: Mock de Auditoría ────────────────────────────────────────

import type { LogAuditoria } from "@/domain/models/comerciante.model";
import { format, subDays, subHours, subMinutes } from "date-fns";

// ── Generación de logs mock ──────────────────────────────────────────────────

const ACCIONES = [
  "LOGIN",
  "LOGOUT",
  "CAMBIO_ESTADO",
  "IMPORTACION_XML",
  "CAMBIO_CONTRASEÑA",
  "ASIGNACION_PERMISO",
  "MODIFICACION_PUESTO",
  "CONSULTA_REPORTE",
  "EXPORTACION_PDF",
  "CONFIGURACION_ACTUALIZADA",
];

const USUARIOS_MOCK = [
  { id: "u-super", nombre: "Administrador Sistema" },
  { id: "u-tic-01", nombre: "Carlos Medina Ruiz" },
  { id: "u-dir-01", nombre: "Patricia Sánchez López" },
  { id: "u-jefe-01", nombre: "Roberto Vargas Mendoza" },
  { id: "u-sup-01", nombre: "María Torres Guzmán" },
  { id: "u-sup-02", nombre: "Jorge Castillo Vera" },
  { id: "u-sup-03", nombre: "Elena Mora Salcedo" },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(123);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function generarDetalleParaAccion(accion: string): string {
  switch (accion) {
    case "LOGIN":
      return "Inicio de sesión exitoso desde 192.168.1." + Math.floor(rand() * 255);
    case "LOGOUT":
      return "Sesión finalizada correctamente.";
    case "CAMBIO_ESTADO":
      return `Cambió estado de comerciante COM-${String(Math.floor(rand() * 400) + 1).padStart(4, "0")} a ${pick(["Presente", "Ausente", "Novedad"])}.`;
    case "IMPORTACION_XML":
      return `Importación masiva: ${Math.floor(rand() * 80) + 20} registros procesados.`;
    case "CAMBIO_CONTRASEÑA":
      return "Contraseña actualizada exitosamente.";
    case "ASIGNACION_PERMISO":
      return `Permiso asignado a comerciante COM-${String(Math.floor(rand() * 400) + 1).padStart(4, "0")} del ${format(subDays(new Date(), Math.floor(rand() * 10)), "dd/MM/yyyy")} al ${format(subDays(new Date(), Math.floor(rand() * 5)), "dd/MM/yyyy")}.`;
    case "MODIFICACION_PUESTO":
      return `Puesto P-A${String(Math.floor(rand() * 100) + 1).padStart(3, "0")} actualizado.`;
    case "CONSULTA_REPORTE":
      return `Reporte de Nave ${pick(["A", "B", "C", "D", "E"])} generado.`;
    case "EXPORTACION_PDF":
      return "PDF de reporte exportado exitosamente.";
    case "CONFIGURACION_ACTUALIZADA":
      return "Configuración de supervisor actualizada.";
    default:
      return "Acción registrada.";
  }
}

function generarLogs(): LogAuditoria[] {
  const logs: LogAuditoria[] = [];
  const ahora = new Date();

  for (let i = 0; i < 60; i++) {
    const usuario = pick(USUARIOS_MOCK);
    const accion = pick(ACCIONES);
    const horasAtras = Math.floor(rand() * 720); // hasta 30 días
    const minutosExtra = Math.floor(rand() * 60);
    const timestamp = subMinutes(subHours(ahora, horasAtras), minutosExtra);

    logs.push({
      id: `log-${String(i + 1).padStart(3, "0")}`,
      timestamp: timestamp.toISOString(),
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      accion,
      detalle: generarDetalleParaAccion(accion),
    });
  }

  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const logsGenerados = generarLogs();

// ── API pública ──────────────────────────────────────────────────────────────

export function getLogs(): LogAuditoria[] {
  return logsGenerados;
}

export function getLogsFiltrados(filtros: {
  busqueda?: string;
  usuarioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}): LogAuditoria[] {
  return logsGenerados.filter((log) => {
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      const matchTexto =
        log.accion.toLowerCase().includes(q) ||
        log.detalle.toLowerCase().includes(q) ||
        log.usuarioNombre.toLowerCase().includes(q);
      if (!matchTexto) return false;
    }

    if (filtros.usuarioId && log.usuarioId !== filtros.usuarioId) return false;

    if (filtros.fechaDesde) {
      const fechaLog = format(new Date(log.timestamp), "yyyy-MM-dd");
      if (fechaLog < filtros.fechaDesde) return false;
    }

    if (filtros.fechaHasta) {
      const fechaLog = format(new Date(log.timestamp), "yyyy-MM-dd");
      if (fechaLog > filtros.fechaHasta) return false;
    }

    return true;
  });
}

export function agregarLog(log: Omit<LogAuditoria, "id" | "timestamp">) {
  logsGenerados.unshift({
    ...log,
    id: `log-${String(logsGenerados.length + 1).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
  });
}
