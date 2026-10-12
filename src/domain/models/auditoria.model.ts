// ── Dominio: Modelo de Logs y Auditoría ───────────────────────────────────────

export interface LogAuditoria {
  id: string;
  timestamp: string; // ISO
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  detalle: string;
}
