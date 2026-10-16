// ── Capa de Aplicación: Servicio de Naves ─────────────────────────────────────
import type { INaveRepository } from "@/domain/ports/nave.repository";
import type { Nave, PlanoEspacialNave } from "@/domain/models/nave.model";
import { naveRepository } from "@/infrastructure/repositories/nave.repository.impl";

export class NaveService {
  constructor(private readonly repository: INaveRepository) {}

  async obtenerNaves(): Promise<Nave[]> {
    return this.repository.obtenerNaves();
  }

  async obtenerNavePorId(id: string): Promise<Nave | null> {
    return this.repository.obtenerNavePorId(id);
  }

  async crearNave(
    nombre: string,
    cantidadPuestos: number,
    supervisores: string[] = []
  ): Promise<Nave> {
    return this.repository.crearNave(nombre, cantidadPuestos, supervisores);
  }

  async actualizarNave(
    id: string,
    data: {
      nombre?: string;
      cantidadPuestos?: number;
      supervisores?: string[];
    }
  ): Promise<Nave | null> {
    return this.repository.actualizarNave(id, data);
  }

  async eliminarNave(id: string): Promise<{ exito: boolean; mensaje: string }> {
    return this.repository.eliminarNave(id);
  }

  async obtenerSupervisoresDisponibles(): Promise<string[]> {
    return this.repository.obtenerSupervisoresDisponibles();
  }

  async obtenerPlanoNave(naveId: string): Promise<PlanoEspacialNave> {
    return this.repository.obtenerPlanoNave(naveId);
  }

  async guardarPlanoNave(
    naveId: string,
    plano: PlanoEspacialNave
  ): Promise<PlanoEspacialNave> {
    return this.repository.guardarPlanoNave(naveId, plano);
  }

  async generarPlanoAutomatico(naveId: string): Promise<PlanoEspacialNave> {
    return this.repository.generarPlanoAutomatico(naveId);
  }
}

export const naveService = new NaveService(naveRepository);

/**
 * Determina si una nave está permitida para el usuario en sesión.
 * - Si el usuario no es SUPERVISOR (es decir, SUPERADMIN, DIRECTOR, JEFE_OPERATIVO o TIC), tiene acceso a todas las naves.
 * - Si el usuario es SUPERVISOR:
 *   1. Se comprueba si su nombre completo figura en la lista `supervisores` de la nave.
 *   2. O si el id o nombre de la nave está en su arreglo `navesAsignadas`.
 */
export function esNavePermitidaParaUsuario(
  nave: { id: string; nombre?: string; supervisores?: string[] },
  user: { rol: string; nombres?: string; apellidos?: string; navesAsignadas?: string[] } | null | undefined
): boolean {
  if (!user) return false;
  if (user.rol !== "SUPERVISOR") return true;

  const nombreCompleto = `${user.nombres ?? ""} ${user.apellidos ?? ""}`.trim().toLowerCase();
  const naveId = (nave.id ?? "").trim().toLowerCase();
  const naveNombre = (nave.nombre ?? "").trim().toLowerCase();

  // 1. Coincidencia por supervisores de la nave
  const enSupervisores = (nave.supervisores ?? []).some((s) => {
    const sLimpio = s.trim().toLowerCase();
    return (
      sLimpio === nombreCompleto ||
      sLimpio.includes(nombreCompleto) ||
      nombreCompleto.includes(sLimpio)
    );
  });
  if (enSupervisores) return true;

  // 2. Coincidencia por navesAsignadas del usuario
  const enNavesAsignadas = (user.navesAsignadas ?? []).some((item) => {
    const itemLimpio = item.trim().toLowerCase();
    return (
      itemLimpio === naveId ||
      itemLimpio === naveNombre ||
      `nave-${itemLimpio}` === naveId ||
      naveId === `nave-${itemLimpio.replace(/^nave-/, "")}`
    );
  });

  return enNavesAsignadas;
}
