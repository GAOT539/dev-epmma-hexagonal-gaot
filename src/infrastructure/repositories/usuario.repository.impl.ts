// ── Adaptador de Infraestructura: UsuarioRepository (API REST + Respaldo Mock) ─

import type { IUsuarioRepository } from "@/domain/ports/usuario.repository";
import type { Usuario } from "@/domain/models/usuario.model";
import {
  getUsuarios,
  getUsuarioPorId,
  getSupervisores,
  crearUsuario as mockCrearUsuario,
  editarUsuario as mockEditarUsuario,
  eliminarUsuario as mockEliminarUsuario,
  restablecerPasswordUsuario as mockRestablecerPassword,
} from "@/infrastructure/mocks/auth.mock";

export class UsuarioRepositoryImpl implements IUsuarioRepository {
  async obtenerUsuarios(): Promise<Usuario[]> {
    try {
      const res = await fetch("/api/v1/usuarios");
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Continuar al mock si no está en entorno con servidor activo
    }
    return Promise.resolve([...getUsuarios()]);
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    try {
      const res = await fetch(`/api/v1/usuarios/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const u = getUsuarioPorId(id);
    return Promise.resolve(u ? { ...u } : null);
  }

  async obtenerSupervisores(): Promise<Usuario[]> {
    try {
      const res = await fetch("/api/v1/usuarios?rol=SUPERVISOR");
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...getSupervisores()]);
  }

  async crearUsuario(
    usuario: Omit<Usuario, "id" | "mustChangePassword" | "passwordHash">
  ): Promise<Usuario> {
    try {
      const res = await fetch("/api/v1/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usuario),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const nuevo = mockCrearUsuario(usuario);
    return Promise.resolve({ ...nuevo });
  }

  async actualizarUsuario(
    id: string,
    datos: Partial<Omit<Usuario, "id">>
  ): Promise<Usuario | null> {
    try {
      const res = await fetch(`/api/v1/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const editado = mockEditarUsuario(id, datos);
    return Promise.resolve(editado ? { ...editado } : null);
  }

  async eliminarUsuario(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/usuarios/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // Fallback
    }
    const eliminado = mockEliminarUsuario(id);
    return Promise.resolve(eliminado);
  }

  async restablecerPasswordUsuario(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/usuarios/${id}/reset-password`, {
        method: "POST",
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // Fallback
    }
    const res = mockRestablecerPassword(id);
    return Promise.resolve(res);
  }
}

export const usuarioRepository = new UsuarioRepositoryImpl();
