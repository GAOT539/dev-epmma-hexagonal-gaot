// ── Adaptador de Infraestructura: ComercianteRepository (API REST + Respaldo Mock) 

import type { IComercianteRepository } from "@/domain/ports/comerciante.repository";
import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";
import {
  getComerciantes as mockGetComerciantes,
  getComerciantePorId as mockGetComerciantePorId,
  getComerciantePorPuesto as mockGetComerciantePorPuesto,
  getPuestosPorNave as mockGetPuestosPorNave,
  agregarComerciante as mockAgregarComerciante,
  editarComerciante as mockEditarComerciante,
  eliminarComerciante as mockEliminarComerciante,
} from "@/infrastructure/mocks/mercado.mock";

export class ComercianteRepositoryImpl implements IComercianteRepository {
  async obtenerComerciantes(): Promise<Comerciante[]> {
    try {
      const res = await fetch("/api/v1/comerciantes");
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockGetComerciantes()]);
  }

  async obtenerComerciantePorId(id: string): Promise<Comerciante | null> {
    try {
      const res = await fetch(`/api/v1/comerciantes/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const com = mockGetComerciantePorId(id);
    return Promise.resolve(com ? { ...com } : null);
  }

  async obtenerComerciantePorPuesto(puestoId: string): Promise<Comerciante | null> {
    try {
      const res = await fetch(`/api/v1/comerciantes?puestoId=${encodeURIComponent(puestoId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const com = mockGetComerciantePorPuesto(puestoId);
    return Promise.resolve(com ? { ...com } : null);
  }

  async obtenerPuestosPorNave(naveId: string): Promise<Puesto[]> {
    try {
      const res = await fetch(`/api/v1/comerciantes?puestosNave=${encodeURIComponent(naveId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return Promise.resolve([...mockGetPuestosPorNave(naveId)]);
  }

  async crearComerciante(
    comerciante: Omit<Comerciante, "idInterno">
  ): Promise<Comerciante> {
    try {
      const res = await fetch("/api/v1/comerciantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comerciante),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const creado = mockAgregarComerciante(comerciante);
    return Promise.resolve({ ...creado });
  }

  async actualizarComerciante(
    id: string,
    datos: Partial<Omit<Comerciante, "idInterno">>
  ): Promise<Comerciante | null> {
    try {
      const res = await fetch(`/api/v1/comerciantes/${id}`, {
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
    const actualizado = mockEditarComerciante(id, datos);
    return Promise.resolve(actualizado ? { ...actualizado } : null);
  }

  async eliminarComerciante(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/comerciantes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // Fallback
    }
    const eliminado = mockEliminarComerciante(id);
    return Promise.resolve(eliminado);
  }
}

export const comercianteRepository = new ComercianteRepositoryImpl();
