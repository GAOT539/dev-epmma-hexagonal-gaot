// ── Adaptador de Infraestructura: UsuarioRepository (Consumo Directo API REST / MySQL) ──

import type { IUsuarioRepository } from "@/domain/ports/usuario.repository";
import type { Usuario } from "@/domain/models/usuario.model";

export class UsuarioRepositoryImpl implements IUsuarioRepository {
  async obtenerUsuarios(): Promise<Usuario[]> {
    const res = await fetch("/api/v1/usuarios");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener usuarios");
    }
    return await res.json();
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    const res = await fetch(`/api/v1/usuarios/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener usuario");
    }
    return await res.json();
  }

  async obtenerSupervisores(): Promise<Usuario[]> {
    const res = await fetch("/api/v1/usuarios?rol=SUPERVISOR");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener supervisores");
    }
    return await res.json();
  }

  async crearUsuario(
    usuario: Omit<Usuario, "id" | "mustChangePassword" | "passwordHash">
  ): Promise<Usuario> {
    const res = await fetch("/api/v1/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(usuario),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al crear usuario");
    }
    return await res.json();
  }

  async actualizarUsuario(
    id: string,
    datos: Partial<Omit<Usuario, "id">>
  ): Promise<Usuario | null> {
    const res = await fetch(`/api/v1/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al actualizar usuario");
    }
    return await res.json();
  }

  async eliminarUsuario(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/usuarios/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al eliminar usuario");
    }
    return true;
  }

  async restablecerPasswordUsuario(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/usuarios/${id}/reset-password`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al restablecer contraseña");
    }
    return true;
  }
}

export const usuarioRepository = new UsuarioRepositoryImpl();
