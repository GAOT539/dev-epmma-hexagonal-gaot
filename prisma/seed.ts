// ── Script de Sembrado Inicial (Prisma Seed) ──────────────────────────────────
// Solo SUPERADMIN y Datos Reales de NAVE A (33 puestos y 33 comerciantes)

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { CeldaPlanoNave } from "../src/domain/models/nave.model";

const prisma = new PrismaClient();

interface ComercianteSeedData {
  ciu: string;
  cedula: string;
  contribuyente: string;
  actividad: string;
  puestoCodigo: string;
}

const COMERCIANTES_NAVE_A: ComercianteSeedData[] = [
  { ciu: "392305", cedula: "1891761038001", contribuyente: "FRUEXPORVALLE CIA. LTDA.", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-01" },
  { ciu: "78277", cedula: "1802891281", contribuyente: "FUENTES QUISPE SILVIA EDITH", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-02" },
  { ciu: "103243", cedula: "1800773176", contribuyente: "JEREZ NUÑEZ MARIA CARMELINA", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-03" },
  { ciu: "229642", cedula: "1801411313", contribuyente: "ULLOA LASCANO CARMEN AMELIA", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-04" },
  { ciu: "392077", cedula: "0603237868", contribuyente: "NARANJO PAZMIÑO RITA MONSERRATH", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-05" },
  { ciu: "228899", cedula: "1802910875", contribuyente: "TUCTA MANTILLA MONICA DEL PILAR", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-06" },
  { ciu: "90462", cedula: "0601243645", contribuyente: "GUATO CHIPANTIZA AIDA PIEDAD", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-07" },
  { ciu: "3885", cedula: "1600117707", contribuyente: "AGUAGUIÑA LINDO CARLOS ALONSO", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-07A" },
  { ciu: "392215", cedula: "1803111523", contribuyente: "AGUAGUIÑA CONSTANTE FREDDY PATRICIO", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-08" },
  { ciu: "392190", cedula: "1804730107", contribuyente: "VALLEJO GUEVARA KEVIN ALEXANDER", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-09" },
  { ciu: "182563", cedula: "1801302199", contribuyente: "QUILLIGANA MORALES EMILIA BRANDO", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-10" },
  { ciu: "111254", cedula: "1802078624", contribuyente: "LINDO CHUGCHO LUIS ANIBAL", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-11" },
  { ciu: "92542", cedula: "0603217555", contribuyente: "GUERRERO GUATO MARCO VINICIO", actividad: "FRUTA IMPORTADA", puestoCodigo: "BODEGA N-A-12" },
  { ciu: "165134", cedula: "1802198711", contribuyente: "PAREDES SANCHEZ MARIANA DE JESUS", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-01" },
  { ciu: "31524", cedula: "1801588508", contribuyente: "CABUCO ZOILA VICTORIA", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-02" },
  { ciu: "S/N", cedula: "0602030314", contribuyente: "MORENO ILLICACHI JUANA", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-03" },
  { ciu: "S/N", cedula: "1805221130001", contribuyente: "ORDOÑEZ BURI LUCIA ISABEL", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-04" },
  { ciu: "149976", cedula: "1802040012", contribuyente: "NAVEDA NUÑEZ HILDA NANCY", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-05" },
  { ciu: "209012", cedula: "1803032620", contribuyente: "SANUNGA SEGARRA JENNY ARACELLY", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-06" },
  { ciu: "46744", cedula: "1802891133", contribuyente: "COBA TOAPANTA BERTHA SUSANA", actividad: "HORNADO", puestoCodigo: "CUBICULO N-A-07" },
  { ciu: "392162", cedula: "1803985512", contribuyente: "GRANIZO CUADRADO TATIANA ISABEL", actividad: "JUGOS", puestoCodigo: "CUBICULO N-A-09" },
  { ciu: "391730", cedula: "1802642908", contribuyente: "MANZANO CARRILLO AURORA DEL ROCIO", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-10" },
  { ciu: "S/N", cedula: "1802082311", contribuyente: "MALATAXI MUYULEMA MARIA HILDA", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-11" },
  { ciu: "365542", cedula: "0602314494", contribuyente: "CUADRADO FLORES ESTELA MARINA", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-12" },
  { ciu: "S/N", cedula: "1759509738001", contribuyente: "CHAVEZ MEJIA YULIXA NASHELY", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-13" },
  { ciu: "381356", cedula: "1802756815", contribuyente: "PEREZ BALLESTEROS CARLOS VINICIO", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-14" },
  { ciu: "391714", cedula: "1803476090", contribuyente: "LEON ARIAS JUANA MAGALI", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "CUBICULO N-A-15" },
  { ciu: "S/N", cedula: "0202491791001", contribuyente: "JOGACHO CHILENO GLADYS ZORAIDA", actividad: "ALIMENTOS PREPARADOS", puestoCodigo: "NUCLEO N-A-0" },
  { ciu: "182474", cedula: "1803785680", contribuyente: "QUILLIGANA CHICAIZA CARMEN CECILIA", actividad: "FRUTA IMPORTADA", puestoCodigo: "NUCLEO N-A-001" },
  { ciu: "124370", cedula: "1802830339", contribuyente: "MANZANO QUILLIGANA FREDY GUILLERMO", actividad: "FRUTA IMPORTADA", puestoCodigo: "NUCLEO N-A-002" },
  { ciu: "S/N", cedula: "1600206641001", contribuyente: "PADILLA CARRILLO EDWIN RAMIRO", actividad: "TOMATE", puestoCodigo: "NUCLEO N-A-003" },
  { ciu: "S/N", cedula: "1805074182001", contribuyente: "CELA VIÑAN LUZ DIANA", actividad: "CARGA DEL NORTE", puestoCodigo: "N-A-04" },
  { ciu: "392327", cedula: "1805275144", contribuyente: "LOOR LEON GINA PAMELA", actividad: "PLASTICOS", puestoCodigo: "NUCLEO N-A-08" },
];

async function main() {
  console.log("Iniciando sembrado inicial de base de datos EP-EMA...");

  // 1. Limpieza en orden de dependencias para garantizar idempotencia
  await prisma.sesionControlSupervisor.deleteMany({});
  await prisma.registroAsistencia.deleteMany({});
  await prisma.puesto.deleteMany({});
  await prisma.planoNave.deleteMany({});
  await prisma.comerciante.deleteMany({});
  await prisma.nave.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log("Tablas limpiadas satisfactoriamente.");

  // 2. Crear ÚNICAMENTE el SUPERADMIN
  const passwordHash = await bcrypt.hash("1500888985*admin", 10);
  const superadmin = await prisma.usuario.create({
    data: {
      id: "u-super",
      cedula: "admin",
      nombres: "Administrador",
      apellidos: "Sistema",
      correo: "admin@ep-ema.gob.ec",
      rol: "SUPERADMIN",
      mustChangePassword: false,
      passwordHash,
      estado: "Habilitado",
      navesAsignadas: [],
    },
  });
  console.log(`Usuario SUPERADMIN creado: ${superadmin.nombres} (${superadmin.cedula})`);

  // 3. Crear NAVE A
  const naveA = await prisma.nave.create({
    data: {
      id: "nave-a",
      nombre: "NAVE A",
      cantidadPuestos: 33,
      limitePuestos: 33,
      supervisores: [],
      estadoRegistro: "Habilitado",
    },
  });
  console.log(`Nave creada: ${naveA.nombre} con capacidad de ${naveA.cantidadPuestos} puestos.`);

  // 4. Crear los 33 Puestos y Comerciantes Reales
  for (const c of COMERCIANTES_NAVE_A) {
    // Crear Comerciante
    const comerciante = await prisma.comerciante.create({
      data: {
        ciu: c.ciu,
        cedula: c.cedula,
        contribuyente: c.contribuyente,
        actividad: c.actividad,
        puestoId: c.puestoCodigo,
        nave: "NAVE A",
        estadoRegistro: "Habilitado",
        creadoPor: "admin",
      },
    });

    // Crear Puesto vinculado al Comerciante
    await prisma.puesto.create({
      data: {
        codigo: c.puestoCodigo,
        naveId: naveA.id,
        estado: "Ocupado",
        comercianteId: comerciante.idInterno,
      },
    });
  }
  console.log(`33 Puestos y Comerciantes reales registrados y vinculados en NAVE A.`);

  // 5. Crear PlanoNave para NAVE A estructurado con los 33 códigos de puesto al 100%
  // Cuadrícula de 12 filas × 12 columnas (144 celdas)
  const filas = 12;
  const columnas = 12;
  const celdas: CeldaPlanoNave[] = [];
  let puestoIndex = 0;

  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < columnas; c++) {
      // Delimitación Norte (Fila 0)
      if (r === 0) {
        if (c >= 0 && c <= 2) {
          celdas.push({ fila: r, columna: c, tipo: "DELIMITACION", texto: "NORTE", subtexto: "ACCESO VEHICULAR", colorZona: "azul", rowSpan: 1, colSpan: 1 });
        } else if (c >= 3 && c <= 8) {
          celdas.push({ fila: r, columna: c, tipo: "DELIMITACION", texto: "SECCIÓN A", subtexto: "BODEGAS Y CUBÍCULOS", colorZona: "azul", rowSpan: 1, colSpan: 1 });
        } else {
          celdas.push({ fila: r, columna: c, tipo: "DELIMITACION", texto: "SUR", subtexto: "SALIDA", colorZona: "azul", rowSpan: 1, colSpan: 1 });
        }
        continue;
      }

      // Delimitación Inferior (Fila 11)
      if (r === filas - 1) {
        if (c >= 0 && c <= 2) {
          celdas.push({ fila: r, columna: c, tipo: "PARQUEADERO", texto: "PARQUEADERO", subtexto: "ZONA CARGA", colorZona: "rosado", rowSpan: 1, colSpan: 1 });
        } else if (c >= 9 && c <= 11) {
          celdas.push({ fila: r, columna: c, tipo: "BANO", texto: "SERVICIOS", subtexto: "HIGIÉNICOS", colorZona: "gris", rowSpan: 1, colSpan: 1 });
        } else {
          celdas.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
        }
        continue;
      }

      // Pasillos horizontales
      if (r === 3 || r === 6 || r === 9) {
        celdas.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
        continue;
      }

      // Pasillo vertical central
      if (c === 5 || c === 6) {
        celdas.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
        continue;
      }

      // Ubicación de Puestos (columnas 0-4 y 7-11)
      if (puestoIndex < COMERCIANTES_NAVE_A.length) {
        const item = COMERCIANTES_NAVE_A[puestoIndex];
        celdas.push({
          fila: r,
          columna: c,
          tipo: "PUESTO",
          codigoPuesto: item.puestoCodigo,
          texto: item.puestoCodigo,
          subtexto: item.actividad,
          colorZona: item.puestoCodigo.startsWith("BODEGA") ? "amarillo" : item.puestoCodigo.startsWith("CUBICULO") ? "naranja" : "verde",
          rowSpan: 1,
          colSpan: 1,
        });
        puestoIndex++;
      } else {
        celdas.push({ fila: r, columna: c, tipo: "VACIO", rowSpan: 1, colSpan: 1 });
      }
    }
  }

  await prisma.planoNave.create({
    data: {
      naveId: naveA.id,
      filas,
      columnas,
      planoJson: celdas as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`Plano espacial de NAVE A generado con ${puestoIndex}/${COMERCIANTES_NAVE_A.length} puestos ubicados (100%).`);
  console.log("Sembrado finalizado exitosamente.");
}

main()
  .catch((e) => {
    console.error("Error durante el sembrado:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
