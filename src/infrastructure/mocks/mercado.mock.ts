import type { Nave } from "@/domain/models/comerciante.model";

// ── Infraestructura: Datos estáticos de prueba ────────────────────────────────

/**
 * Retorna un listado de naves con sus sectores y comerciantes para pruebas.
 * En una arquitectura hexagonal real, esto sería reemplazado por un
 * adaptador que llame a la API o base de datos correspondiente.
 */
export function getNavesMock(): Nave[] {
  return [
    {
      id: "nave-a",
      nombre: "Nave A",
      sectores: [
        {
          id: "nave-a-sector-carnes",
          nombre: "Carnes",
          comerciantes: [
            { id: "c-001", nombre: "Luis Martínez", estado: "pendiente" },
            { id: "c-002", nombre: "Marco Ríos",    estado: "pendiente" },
            { id: "c-003", nombre: "María Salcedo",  estado: "pendiente" },
          ],
        },
        {
          id: "nave-a-sector-lacteos",
          nombre: "Lácteos",
          comerciantes: [
            { id: "c-004", nombre: "Ana Torres",    estado: "pendiente" },
            { id: "c-005", nombre: "Pedro Vargas",  estado: "pendiente" },
            { id: "c-006", nombre: "Rosa Guzmán",   estado: "pendiente" },
          ],
        },
      ],
    },
    {
      id: "nave-b",
      nombre: "Nave B",
      sectores: [
        {
          id: "nave-b-sector-carnes",
          nombre: "Carnes",
          comerciantes: [
            { id: "c-007", nombre: "Carlos Pérez",    estado: "pendiente" },
            { id: "c-008", nombre: "Sofía Mendoza",   estado: "pendiente" },
          ],
        },
        {
          id: "nave-b-sector-lacteos",
          nombre: "Lácteos",
          comerciantes: [
            { id: "c-009", nombre: "Jorge Castillo",  estado: "pendiente" },
            { id: "c-010", nombre: "Elena Mora",      estado: "pendiente" },
            { id: "c-011", nombre: "Ricardo Suárez",  estado: "pendiente" },
          ],
        },
      ],
    },
  ];
}
