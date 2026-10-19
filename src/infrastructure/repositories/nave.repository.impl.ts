// ── Adaptador de Infraestructura: NaveRepository (Consumo Directo API REST / MySQL) ──

import type { INaveRepository } from "@/domain/ports/nave.repository";
import type { Nave, PlanoEspacialNave } from "@/domain/models/nave.model";
import { generarPlanoAutomatico as mockGenerarPlanoAutomatico } from "@/infrastructure/mocks/naves.mock";

export class NaveRepositoryImpl implements INaveRepository {
  async obtenerNaves(): Promise<Nave[]> {
    const res = await fetch("/api/v1/naves");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener naves");
    }
    const data = await res.json();
    return Array.isArray(data.naves) ? data.naves : [];
  }

  async obtenerNavePorId(id: string): Promise<Nave | null> {
    const res = await fetch(`/api/v1/naves/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener nave");
    }
    return await res.json();
  }

  async crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores: string[] = []
  ): Promise<Nave> {
    const res = await fetch("/api/v1/naves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, cantidadPuestos, supervisores }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al crear nave");
    }
    return await res.json();
  }

  async actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null> {
    const res = await fetch(`/api/v1/naves/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const respData = await res.json().catch(() => ({}));
      throw new Error(respData.error || respData.mensaje || "Error al actualizar nave");
    }
    return await res.json();
  }

  async eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }> {
    const res = await fetch(`/api/v1/naves/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        exito: false,
        mensaje: data.error || data.mensaje || "Error al eliminar la nave",
      };
    }
    return await res.json();
  }

  async obtenerSupervisoresDisponibles(): Promise<string[]> {
    const res = await fetch("/api/v1/naves");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener supervisores disponibles");
    }
    const data = await res.json();
    return Array.isArray(data.supervisoresDisponibles) ? data.supervisoresDisponibles : [];
  }

  async obtenerPlanoNave(naveId: string): Promise<PlanoEspacialNave> {
    const res = await fetch(`/api/v1/naves/${naveId}/plano`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener plano de nave");
    }
    return await res.json();
  }

  async guardarPlanoNave(
    naveId: string,
    plano: PlanoEspacialNave
  ): Promise<PlanoEspacialNave> {
    const res = await fetch(`/api/v1/naves/${naveId}/plano`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plano),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al guardar plano de nave");
    }
    return await res.json();
  }

  async generarPlanoAutomatico(naveId: string): Promise<PlanoEspacialNave> {
    // Generación espacial heurística asistida
    return Promise.resolve(mockGenerarPlanoAutomatico(naveId));
  }
}

export const naveRepository = new NaveRepositoryImpl();
