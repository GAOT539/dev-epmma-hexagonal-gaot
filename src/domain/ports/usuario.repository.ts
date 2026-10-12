// ── Puerto del Dominio: IUsuarioRepository ───────────────────────────────────

import type { Usuario } from "@/domain/models/usuario.model";

export interface IUsuarioRepository {
  obtenerUsuarios(): Promise<Usuario[]>;
  obtenerUsuarioPorId(id: string): Promise<Usuario | null>;
  obtenerSupervisores(): Promise<Usuario[]>;
  crearUsuario(
    usuario: Omit<Usuario, "id" | "mustChangePassword" | "passwordHash">
  ): Promise<Usuario>;
  actualizarUsuario(
    id: string,
    datos: Partial<Omit<Usuario, "id">>
  ): Promise<Usuario | null>;
  eliminarUsuario(id: string): Promise<boolean>;
  restablecerPasswordUsuario(id: string): Promise<boolean>;
}
