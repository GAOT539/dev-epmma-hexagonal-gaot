// ── Capa de Aplicación: Servicio de Usuarios ─────────────────────────────────

import type { IUsuarioRepository } from "@/domain/ports/usuario.repository";
import type { Usuario } from "@/domain/models/usuario.model";
import { usuarioRepository } from "@/infrastructure/repositories/usuario.repository.impl";

export class UsuarioService {
  constructor(private readonly repository: IUsuarioRepository) {}

  async obtenerUsuarios(): Promise<Usuario[]> {
    return this.repository.obtenerUsuarios();
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    return this.repository.obtenerUsuarioPorId(id);
  }

  async obtenerSupervisores(): Promise<Usuario[]> {
    return this.repository.obtenerSupervisores();
  }

  async crearUsuario(
    usuario: Omit<Usuario, "id" | "mustChangePassword" | "passwordHash">
  ): Promise<Usuario> {
    return this.repository.crearUsuario(usuario);
  }

  async actualizarUsuario(
    id: string,
    datos: Partial<Omit<Usuario, "id">>
  ): Promise<Usuario | null> {
    return this.repository.actualizarUsuario(id, datos);
  }

  async eliminarUsuario(id: string): Promise<boolean> {
    return this.repository.eliminarUsuario(id);
  }

  async restablecerPasswordUsuario(id: string): Promise<boolean> {
    return this.repository.restablecerPasswordUsuario(id);
  }
}

export const usuarioService = new UsuarioService(usuarioRepository);
