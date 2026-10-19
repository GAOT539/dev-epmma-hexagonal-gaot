// ── Adaptador de Infraestructura: NaveRepository (API REST + Respaldo Mock) ────

import type { INaveRepository } from "@/domain/ports/nave.repository";
import type { Nave, PlanoEspacialNave } from "@/domain/models/nave.model";
import {
  eliminarNave as mockEliminarNave,
  obtenerSupervisoresDisponibles as mockObtenerSupervisores,
  obtenerPlanoNave as mockObtenerPlanoNave,
  guardarPlanoNave as mockGuardarPlanoNave,
  generarPlanoAutomatico as mockGenerarPlanoAutomatico,
} from "@/infrastructure/mocks/naves.mock";
import {
  getNaves as mockGetNaves,
  crearNave as mockCrearNave,
  actualizarNave as mockActualizarNave,
} from "@/infrastructure/mocks/mercado.mock";

export class NaveRepositoryImpl implements INaveRepository {
  async obtenerNaves(): Promise<Nave[]> {
    try {
      const res = await fetch("/api/v1/naves");
      if (res.ok) {
        const data = await res.json();
        if (data.naves && Array.isArray(data.naves)) {
          return data.naves;
        }
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockGetNaves()]);
  }

  async obtenerNavePorId(id: string): Promise<Nave | null> {
    try {
      const res = await fetch(`/api/v1/naves/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const nave = mockGetNaves().find((n) => n.id === id) ?? null;
    return Promise.resolve(nave ? { ...nave } : null);
  }

  async crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores: string[] = []
  ): Promise<Nave> {
    try {
      const res = await fetch("/api/v1/naves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, cantidadPuestos, supervisores }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const nueva = mockCrearNave(nombre, cantidadPuestos, supervisores);
    return Promise.resolve({ ...nueva });
  }

  async actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null> {
    try {
      const res = await fetch(`/api/v1/naves/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const actualizada = mockActualizarNave(id, data);
    return Promise.resolve(actualizada ? { ...actualizada } : null);
  }

  async eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }> {
    try {
      const res = await fetch(`/api/v1/naves/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const resultado = mockEliminarNave(id);
    return Promise.resolve(resultado);
  }

  async obtenerSupervisoresDisponibles(): Promise<string[]> {
    try {
      const res = await fetch("/api/v1/naves");
      if (res.ok) {
        const data = await res.json();
        if (data.supervisoresDisponibles && Array.isArray(data.supervisoresDisponibles)) {
          return data.supervisoresDisponibles;
        }
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockObtenerSupervisores()]);
  }

  async obtenerPlanoNave(naveId: string): Promise<PlanoEspacialNave> {
    try {
      const res = await fetch(`/api/v1/naves/${naveId}/plano`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve(mockObtenerPlanoNave(naveId));
  }

  async guardarPlanoNave(
    naveId: string,
    plano: PlanoEspacialNave
  ): Promise<PlanoEspacialNave> {
    try {
      const res = await fetch(`/api/v1/naves/${naveId}/plano`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plano),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve(mockGuardarPlanoNave(naveId, plano));
  }

  async generarPlanoAutomatico(naveId: string): Promise<PlanoEspacialNave> {
    // Generación heurística arquitectónica
    return Promise.resolve(mockGenerarPlanoAutomatico(naveId));
  }
}

export const naveRepository = new NaveRepositoryImpl();
