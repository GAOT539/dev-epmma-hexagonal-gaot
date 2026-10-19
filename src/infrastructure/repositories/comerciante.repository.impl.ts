// ── Adaptador de Infraestructura: ComercianteRepository (Consumo Directo API REST / MySQL) ──

import type { IComercianteRepository } from "@/domain/ports/comerciante.repository";
import type { Comerciante, Puesto } from "@/domain/models/comerciante.model";

export class ComercianteRepositoryImpl implements IComercianteRepository {
  async obtenerComerciantes(): Promise<Comerciante[]> {
    const res = await fetch("/api/v1/comerciantes");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener comerciantes");
    }
    return await res.json();
  }

  async obtenerComerciantePorId(id: string): Promise<Comerciante | null> {
    const res = await fetch(`/api/v1/comerciantes/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener comerciante");
    }
    return await res.json();
  }

  async obtenerComerciantePorPuesto(puestoId: string): Promise<Comerciante | null> {
    const res = await fetch(`/api/v1/comerciantes?puestoId=${encodeURIComponent(puestoId)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener comerciante por puesto");
    }
    return await res.json();
  }

  async obtenerPuestosPorNave(naveId: string): Promise<Puesto[]> {
    const res = await fetch(`/api/v1/comerciantes?puestosNave=${encodeURIComponent(naveId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al obtener puestos por nave");
    }
    return await res.json();
  }

  async crearComerciante(
    comerciante: Omit<Comerciante, "idInterno">
  ): Promise<Comerciante> {
    const res = await fetch("/api/v1/comerciantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(comerciante),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al crear comerciante");
    }
    return await res.json();
  }

  async actualizarComerciante(
    id: string,
    datos: Partial<Omit<Comerciante, "idInterno">>
  ): Promise<Comerciante | null> {
    const res = await fetch(`/api/v1/comerciantes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al actualizar comerciante");
    }
    return await res.json();
  }

  async eliminarComerciante(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/comerciantes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || "Error al eliminar comerciante");
    }
    return true;
  }
}

export const comercianteRepository = new ComercianteRepositoryImpl();
