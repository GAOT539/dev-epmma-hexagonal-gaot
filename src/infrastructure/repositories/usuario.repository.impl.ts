// ── Adaptador de Infraestructura: UsuarioRepository (Mock Asíncrono) ──────────

import type { IUsuarioRepository } from "@/domain/ports/usuario.repository";
import type { Usuario } from "@/domain/models/usuario.model";
import {
  getUsuarios,
  getUsuarioPorId,
  getSupervisores,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  restablecerPasswordUsuario,
} from "@/infrastructure/mocks/auth.mock";

export class UsuarioMockRepository implements IUsuarioRepository {
  async obtenerUsuarios(): Promise<Usuario[]> {
    return Promise.resolve([...getUsuarios()]);
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    const u = getUsuarioPorId(id);
    return Promise.resolve(u ? { ...u } : null);
  }

  async obtenerSupervisores(): Promise<Usuario[]> {
    return Promise.resolve([...getSupervisores()]);
  }

  async crearUsuario(
    usuario: Omit<Usuario, "id" | "mustChangePassword" | "passwordHash">
  ): Promise<Usuario> {
    const nuevo = crearUsuario(usuario);
    return Promise.resolve({ ...nuevo });
  }

  async actualizarUsuario(
    id: string,
    datos: Partial<Omit<Usuario, "id">>
  ): Promise<Usuario | null> {
    const editado = editarUsuario(id, datos);
    return Promise.resolve(editado ? { ...editado } : null);
  }

  async eliminarUsuario(id: string): Promise<boolean> {
    const eliminado = eliminarUsuario(id);
    return Promise.resolve(eliminado);
  }

  async restablecerPasswordUsuario(id: string): Promise<boolean> {
    const res = restablecerPasswordUsuario(id);
    return Promise.resolve(res);
  }
}

export const usuarioRepository = new UsuarioMockRepository();
