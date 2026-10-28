"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  importadorService,
  filtrarDuplicadosExactos100,
  aplicarReglaPuestosAmbulantes,
} from "@/application/services/importador.service";
import { naveService, esNavePermitidaParaUsuario } from "@/application/services/nave.service";
import { useAuth } from "@/application/services/auth.service";
import type { Nave } from "@/domain/models/nave.model";
import type {
  ImportacionRegistro,
  ImportacionResultado,
  OpcionesImportacion,
} from "@/domain/models/comerciante.model";
import { toast } from "sonner";
import { logClientError } from "@/lib/client-logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function IngresoCatastroPage() {
  const { user } = useAuth();
  const [naves, setNaves] = useState<Nave[]>([]);
  const [registros, setRegistros] = useState<ImportacionRegistro[]>([]);
  const [duplicadosOmitidos, setDuplicadosOmitidos] = useState<ImportacionRegistro[]>([]);
  const [mostrarDuplicadosOmitidos, setMostrarDuplicadosOmitidos] = useState(false);
  const [modalPreguntaAmbulantesOpen, setModalPreguntaAmbulantesOpen] = useState(false);
  const [registrosPendientesAmbulantes, setRegistrosPendientesAmbulantes] = useState<ImportacionRegistro[]>([]);
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null);
  const [analisis, setAnalisis] = useState<ImportacionResultado | null>(null);
  const [mostrarCambios, setMostrarCambios] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [paso, setPaso] = useState<"cargar" | "preview" | "resultado">("cargar");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [parseando, setParseando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [opcionesImportacion, setOpcionesImportacion] = useState<OpcionesImportacion>({});
  const [naveManualSeleccionada, setNaveManualSeleccionada] = useState<string>("");
  const [nombreNuevaNaveInput, setNombreNuevaNaveInput] = useState<string>("");

  useEffect(() => {
    naveService
      .obtenerNaves()
      .then(setNaves)
      .catch((err) => logClientError("INGRESO-CATASTRO", "Error al obtener naves", err));
  }, []);

  const navesAutorizadas = useMemo(
    () => naves.filter((n) => esNavePermitidaParaUsuario(n, user)),
    [naves, user]
  );

  const naveAmbulantesAutorizada = useMemo(() => {
    if (user?.rol !== "SUPERVISOR") return null;
    return (
      navesAutorizadas.find((n) => {
        const nom = n.nombre.trim().toUpperCase();
        const id = n.id.trim().toLowerCase();
        return nom.includes("AMBULANTE") || id.includes("ambulante");
      }) || null
    );
  }, [user, navesAutorizadas]);

  async function procesarArchivos(files: File[]) {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      setArchivoNombre(files[0].name);
    } else {
      setArchivoNombre(`${files.length} archivos combinados (${files.map((f) => f.name).join(", ")})`);
    }

    setParseando(true);

    try {
      let todosParsed: ImportacionRegistro[] = [];
      let naveInferidaGlobal: string | null = null;

      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        let parsed: ImportacionRegistro[] = [];

        if (extension === "xlsx" || extension === "xls") {
          const buffer = await file.arrayBuffer();
          parsed = await importadorService.parsearExcel(buffer, file.name);
        } else if (extension === "csv" || extension === "txt") {
          const texto = await file.text();
          parsed = await importadorService.parsearCSV(texto);
        } else if (extension === "xml") {
          const texto = await file.text();
          parsed = await importadorService.parsearXML(texto);
        } else {
          toast.error(`Formato no soportado en ${file.name}.`);
          continue;
        }

        // Inferencia de nave: prioridad absoluta a las celdas internas de la hoja (reg.nave)
        const nombreArchivoUpper = file.name.normalize("NFC").toUpperCase();
        let naveDesdeArchivo: string | null = null;
        if (nombreArchivoUpper.includes("ROPA")) naveDesdeArchivo = "NAVE ROPA";
        else if (nombreArchivoUpper.includes("CF")) naveDesdeArchivo = "NAVE CF";
        else if (nombreArchivoUpper.includes("FLORES")) naveDesdeArchivo = "NAVE FLORES";
        else if (/(?:^|[^A-ZÑ0-9])NAVE[_\s"-]*([A-ZÑ0-9]+)(?=$|[^A-ZÑ0-9])/i.test(nombreArchivoUpper)) {
          const m = nombreArchivoUpper.match(/(?:^|[^A-ZÑ0-9])NAVE[_\s"-]*([A-ZÑ0-9]+)(?=$|[^A-ZÑ0-9])/i);
          if (m && m[1]) naveDesdeArchivo = `NAVE ${m[1]}`;
        }

        const naveDetectadaEnHoja = parsed.find((r) => r.nave && r.nave.trim().toUpperCase() !== "NO DEFINIDA")?.nave?.trim().toUpperCase() || null;
        if (naveDetectadaEnHoja && !naveInferidaGlobal) {
          naveInferidaGlobal = naveDetectadaEnHoja;
        } else if (naveDesdeArchivo && !naveInferidaGlobal) {
          naveInferidaGlobal = naveDesdeArchivo;
        }

        const procesados = parsed.map((reg) => {
          let naveReg = reg.nave?.trim().toUpperCase();
          if (!naveReg || naveReg === "NO DEFINIDA") {
            const upperPuesto = (reg.puesto || "").toUpperCase();
            if (upperPuesto.includes("ZCF-")) naveReg = "NAVE CF";
            else {
              const match =
                upperPuesto.match(/^N-(?:([A-ZÑ0-9]+)-([A-Z0-9-]+)|([A-Z0-9-]+)-([A-ZÑ]))(?:[\s*].*)?$/i) ||
                upperPuesto.match(/(?:^|[^A-ZÑ0-9])N-(?:([A-ZÑ0-9]+)-([A-Z0-9-]+)|([A-Z0-9-]+)-([A-ZÑ]))(?=$|[^A-ZÑ0-9])/i);
              if (match) {
                const letra = (match[1] || match[4] || "").toUpperCase();
                if (letra) naveReg = `NAVE ${letra}`;
              } else if (naveDesdeArchivo) {
                naveReg = naveDesdeArchivo;
              } else if (naveInferidaGlobal) {
                naveReg = naveInferidaGlobal;
              } else {
                naveReg = "NO DEFINIDA";
              }
            }
          }
          if (naveReg && naveReg !== "NO DEFINIDA" && !naveInferidaGlobal) {
            naveInferidaGlobal = naveReg;
          }
          return {
            ...reg,
            nave: naveReg,
          };
        });

        todosParsed.push(...procesados);
      }

      if (todosParsed.length === 0) {
        toast.error("No se detectaron comerciantes válidos con cédula en los archivos seleccionados.");
        return;
      }

      // Si se infirió una nave global común para los archivos combinados (ej. NAVE H de Bodega Nave H.xls y Puestos Nave H.xls)
      if (naveInferidaGlobal) {
        todosParsed = todosParsed.map((r) => ({
          ...r,
          nave: (!r.nave || r.nave === "NO DEFINIDA") ? naveInferidaGlobal! : r.nave,
        }));
      }

      // Filtro de duplicados 100% exactos (mismo nombre + misma actividad + mismo puesto)
      const { registrosUnicos, duplicadosOmitidos: omitidos } = filtrarDuplicadosExactos100(todosParsed);
      setDuplicadosOmitidos(omitidos);
      todosParsed = registrosUnicos;

      if (omitidos.length > 0) {
        toast.info(
          `Se omitieron automáticamente ${omitidos.length} registro(s) 100% duplicados (mismo nombre, actividad y puesto).`
        );
      }

      const esNaveGenerica = (n: string) => {
        const u = n.trim().toUpperCase();
        return (
          u === "NAVE" ||
          u === "(NAVE)" ||
          u === "NO DEFINIDA" ||
          u === "NO IDENTIFICADA" ||
          u === "PUESTOS AMBULANTES"
        );
      };

      const navesDetectadas = Array.from(
        new Set(
          todosParsed
            .map((p) => (p.nave || "").trim().toUpperCase())
            .filter(Boolean)
        )
      );

      // Validación estricta para el rol SUPERVISOR
      if (user?.rol === "SUPERVISOR") {
        const tieneNaveEspecificaNoAutorizada = navesDetectadas.some(
          (naveDetectada) =>
            !esNaveGenerica(naveDetectada) &&
            !navesAutorizadas.some(
              (na) =>
                na.nombre.trim().toUpperCase() === naveDetectada ||
                na.id.trim().toLowerCase() === naveDetectada.toLowerCase()
            )
        );

        if (tieneNaveEspecificaNoAutorizada) {
          toast.error(
            "Acceso denegado: No tiene permisos sobre la nave detectada en el archivo. Solo puede ingresar catastro de sus naves asignadas."
          );
          setRegistros([]);
          setArchivoNombre("");
          return;
        }

        const esArchivoGenericoOAmbulantes =
          navesDetectadas.length === 0 || navesDetectadas.every(esNaveGenerica);

        if (esArchivoGenericoOAmbulantes && naveAmbulantesAutorizada) {
          // Caso 1: El supervisor tiene a su cargo Ambulantes -> Preguntar mediante Modal
          setRegistros(todosParsed);
          setRegistrosPendientesAmbulantes(todosParsed);
          setModalPreguntaAmbulantesOpen(true);
          return;
        }
      }

      // Caso 2: Flujo estándar (otros roles o supervisor sin Ambulantes a cargo)
      setRegistros(todosParsed);
      const opcInicial: OpcionesImportacion = { modoUnificacion: "UNIFICAR" };
      setOpcionesImportacion(opcInicial);
      const sim = await importadorService.simularImportacion(todosParsed, opcInicial);
      setAnalisis(sim);
      const navesDisponiblesInicial =
        user?.rol === "SUPERVISOR"
          ? navesAutorizadas
          : sim.reconciliacion?.navesDisponibles || [];
      if (navesDisponiblesInicial.length > 0) {
        setNaveManualSeleccionada(navesDisponiblesInicial[0].id);
      }
      setNombreNuevaNaveInput(
        sim.reconciliacion?.naveDetectada &&
          sim.reconciliacion.naveDetectada !== "NO IDENTIFICADA" &&
          sim.reconciliacion.naveDetectada !== "NAVE"
          ? sim.reconciliacion.naveDetectada
          : ""
      );
      setPaso("preview");
      toast.success(`${todosParsed.length} comerciantes detectados correctamente.`);
    } catch (error) {
      logClientError("INGRESO-CATASTRO", "Error al procesar archivos", error);
      toast.error("Error al interpretar los archivos. Verifique el formato e intente nuevamente.");
    } finally {
      setParseando(false);
    }
  }

  async function handleConfirmarEsAmbulantes() {
    if (!naveAmbulantesAutorizada) return;
    setParseando(true);
    setModalPreguntaAmbulantesOpen(false);
    try {
      const registrosConNave = registrosPendientesAmbulantes.map((r) => ({
        ...r,
        nave: naveAmbulantesAutorizada.nombre,
      }));
      const registrosAmbulantes = aplicarReglaPuestosAmbulantes(
        registrosConNave,
        naveAmbulantesAutorizada.nombre
      );
      setRegistros(registrosAmbulantes);
      const opc: OpcionesImportacion = {
        modoUnificacion: "UNIFICAR",
        naveIdManual: naveAmbulantesAutorizada.id,
      };
      setOpcionesImportacion(opc);
      const sim = await importadorService.simularImportacion(registrosAmbulantes, opc);
      setAnalisis(sim);
      setNaveManualSeleccionada(naveAmbulantesAutorizada.id);
      setPaso("preview");
      toast.success(`Registros asignados a ${naveAmbulantesAutorizada.nombre}.`);
    } catch (err) {
      logClientError("INGRESO-CATASTRO", "Error al reconciliar con la nave de Ambulantes", err);
      toast.error("Error al reconciliar con la nave de Ambulantes.");
    } finally {
      setParseando(false);
    }
  }

  async function handleRechazarEsAmbulantes() {
    setParseando(true);
    setModalPreguntaAmbulantesOpen(false);
    try {
      setRegistros(registrosPendientesAmbulantes);
      const opcInicial: OpcionesImportacion = { modoUnificacion: "UNIFICAR" };
      setOpcionesImportacion(opcInicial);
      const sim = await importadorService.simularImportacion(registrosPendientesAmbulantes, opcInicial);
      setAnalisis(sim);
      const navesDisponiblesInicial =
        user?.rol === "SUPERVISOR"
          ? navesAutorizadas
          : sim.reconciliacion?.navesDisponibles || [];
      if (navesDisponiblesInicial.length > 0) {
        setNaveManualSeleccionada(navesDisponiblesInicial[0].id);
      }
      setPaso("preview");
    } catch (err) {
      logClientError("INGRESO-CATASTRO", "Error al procesar la selección manual", err);
      toast.error("Error al procesar la selección manual.");
    } finally {
      setParseando(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      procesarArchivos(Array.from(files));
    }
  }

  async function handleConfirmarImportacion() {
    setProcesando(true);
    try {
      const res = await importadorService.ejecutarImportacion(registros, opcionesImportacion);
      setResultado(res);
      setPaso("resultado");

      if (res.exitosos > 0) {
        toast.success(`Se importaron ${res.exitosos} comerciantes exitosamente al catastro.`);
      }
      if (res.errores.length > 0) {
        toast.warning(`${res.errores.length} registros no pudieron ser procesados.`);
      }
    } catch (error) {
      logClientError("INGRESO-CATASTRO", "Error al guardar importación", error);
      toast.error("Ocurrió un error al persistir los comerciantes en el sistema.");
    } finally {
      setProcesando(false);
    }
  }

  function handleReiniciar() {
    setRegistros([]);
    setDuplicadosOmitidos([]);
    setMostrarDuplicadosOmitidos(false);
    setModalPreguntaAmbulantesOpen(false);
    setRegistrosPendientesAmbulantes([]);
    setResultado(null);
    setAnalisis(null);
    setOpcionesImportacion({});
    setNaveManualSeleccionada("");
    setNombreNuevaNaveInput("");
    setArchivoNombre("");
    setPaso("cargar");
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[100dvh] md:h-[100dvh] bg-institucional-whiteSmoke">
      <div className="w-full max-w-none flex-1 flex flex-col min-h-0 gap-6 px-4 sm:px-6 lg:px-10 py-6">
        {/* ── Encabezado Institucional ── */}
        <header className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-institucional-green" aria-hidden="true" />
            <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
              Ingreso de Catastro e Importación Masiva
            </h1>
          </div>
          <p className="text-sm font-medium text-gray-700">
            Importación inteligente de reportes (.xlsx, .xls) con celdas combinadas, CSV y XML.
          </p>
        </header>

        {/* ── Formatos y Ayuda Visual ── */}
        {paso === "cargar" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileSpreadsheet size={16} className="text-institucional-green" />
                <span>Reportes Excel (.xls / .xlsx) con Parser Heurístico</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Compatible con exportaciones del sistema anterior. Identifica automáticamente la <strong>Nave</strong>,
                la <strong>Actividad</strong>, la <strong>Cédula</strong> (10 o 13 dígitos), el <strong>Nombre</strong> y el <strong>Puesto</strong>, descartando metros y columnas intermedias.
              </p>
            </div>

            <div className="rounded-xl border border-institucional-whiteSmokeBlack/20 bg-base-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-base-eerieBlack">
                <FileText size={16} className="text-acento-azul1" />
                <span>Archivos Estructurados (CSV / XML)</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-mono">
                Columnas estándar: Nave, Contribuyente, NumBodega, Gen01Codi.
                Reconoce estructuras tabulares delimitadas por comas o etiquetas XML.
              </p>
            </div>
          </div>
        )}

        {/* ── Aviso sutil de Naves Autorizadas para SUPERVISOR ── */}
        {paso === "cargar" && user?.rol === "SUPERVISOR" && (
          <div className="flex items-center gap-2 rounded-xl border border-institucional-green/20 bg-institucional-green/10 px-4 py-2.5 text-xs font-semibold text-institucional-green w-fit">
            <Building2 size={16} />
            <span>
              Naves autorizadas para importación:{" "}
              <strong className="text-base-eerieBlack font-bold">
                {navesAutorizadas.map((n) => n.nombre).join(", ") || "Ninguna asignada"}
              </strong>
            </span>
          </div>
        )}

        {/* ── Paso 1: Carga de Archivo ── */}
        {paso === "cargar" && (
          <div
            className={[
              "flex-1 min-h-[280px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all text-center",
              isDragOver
                ? "border-institucional-green bg-institucional-green/5"
                : "border-institucional-whiteSmokeBlack/30 bg-base-white",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {parseando ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="text-institucional-green animate-spin" />
                <p className="text-sm font-semibold text-gray-800">
                  Analizando estructura de celdas y extrayendo comerciantes...
                </p>
                <p className="text-xs text-gray-500">Por favor espere un momento.</p>
              </div>
            ) : (
              <>
                <Upload size={44} className="text-institucional-whiteSmokeBlack/40" />
                <p className="mt-3 text-base font-semibold text-base-eerieBlack">
                  Arrastre y suelte su archivo Excel (.xlsx, .xls), CSV o XML aquí
                </p>
                <p className="mt-1 text-xs text-gray-600 max-w-md">
                  El sistema analizará el archivo en memoria y le mostrará una vista previa con los datos extraídos antes de aplicar cualquier cambio.
                </p>
                <label className="mt-5 cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-institucional-green px-5 py-2.5 text-xs font-semibold text-base-white shadow-sm transition-colors hover:bg-acento-verdeOliva1">
                    <FileSpreadsheet size={15} /> Seleccionar uno o varios archivos desde el equipo
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,.xml"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        procesarArchivos(Array.from(files));
                      }
                    }}
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* ── Paso 2: Vista Previa y Confirmación ── */}
        {paso === "preview" && (
          <div className="flex-1 rounded-2xl bg-base-white shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-institucional-whiteSmokeBlack/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="font-bold text-base text-base-eerieBlack">
                  Vista Previa de Comerciantes Detectados
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Archivo: <span className="font-medium text-gray-900">{archivoNombre}</span> •{" "}
                  <span className="font-semibold text-institucional-green">{registros.length}</span> registros listos para revisión.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReiniciar}
                className="text-base-red text-xs hover:underline flex items-center gap-1 font-medium self-start sm:self-center"
              >
                <X size={14} /> Cancelar y subir otro archivo
              </button>
            </div>

            {/* Resumen de Reconciliación Mensual o Alerta de Selección Manual */}
            {analisis?.reconciliacion && (
              analisis.reconciliacion.naveNoEncontrada ? (
                <div className="p-5 border-b border-amber-300 bg-amber-50/95 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 shrink-0">
                      <AlertCircle size={22} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-amber-950 uppercase tracking-wide">
                        NAVE NO ENCONTRADA — SELECCIONE MANUAL
                      </h3>
                      <p className="text-xs text-amber-900 mt-1">
                        No se pudo identificar una nave registrada en el sistema que coincida con{" "}
                        <strong>&quot;{analisis.reconciliacion.naveDetectada}&quot;</strong>. Seleccione una nave existente para reconciliar sus puestos o cree una nueva nave para el mercado.
                      </p>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${user?.rol === "SUPERVISOR" ? "" : "md:grid-cols-2"} gap-4 pt-1`}>
                    {/* Opción 1: Seleccionar Nave Existente */}
                    <div className="rounded-xl border border-amber-200 bg-base-white p-4 shadow-2xs flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-base-eerieBlack uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={15} className="text-institucional-green" />
                          Opción 1: Reconciliar en Nave Existente
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Vincula y actualiza los comerciantes en los puestos fijos de una nave registrada:
                        </p>
                        <select
                          value={naveManualSeleccionada}
                          onChange={(e) => setNaveManualSeleccionada(e.target.value)}
                          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-2xs focus:border-institucional-green focus:outline-hidden"
                        >
                          {(user?.rol === "SUPERVISOR"
                            ? navesAutorizadas
                            : analisis.reconciliacion.navesDisponibles || naves
                          ).map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.nombre} ({n.cantidadPuestos} puestos)
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        onClick={async () => {
                          if (!naveManualSeleccionada) return;
                          setParseando(true);
                          try {
                            const opc = { naveIdManual: naveManualSeleccionada };
                            setOpcionesImportacion(opc);
                            const sim = await importadorService.simularImportacion(registros, opc);
                            setAnalisis(sim);
                            toast.success(`Nave seleccionada: ${sim.reconciliacion?.naveDetectada}`);
                          } catch (err) {
                            logClientError("INGRESO-CATASTRO", "Error al reconciliar con la nave seleccionada", err);
                            toast.error("Error al reconciliar con la nave seleccionada.");
                          } finally {
                            setParseando(false);
                          }
                        }}
                        disabled={parseando || !naveManualSeleccionada}
                        className="w-full bg-institucional-green text-white hover:bg-acento-verdeOliva1 text-xs font-semibold"
                      >
                        Seleccionar esta Nave
                      </Button>
                    </div>

                    {/* Opción 2: Crear Nueva Nave (solo si NO es SUPERVISOR) */}
                    {user?.rol !== "SUPERVISOR" && (
                      <div className="rounded-xl border border-amber-200 bg-base-white p-4 shadow-2xs flex flex-col justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-base-eerieBlack uppercase tracking-wider flex items-center gap-1.5">
                            <Plus size={15} className="text-amber-600" />
                            Opción 2: Crear Nueva Nave
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Crea la nave en la base de datos junto con todos los puestos del archivo ({registros.length} puestos):
                          </p>
                          <input
                            type="text"
                            placeholder="Nombre de la nueva nave (ej. NAVE B, NAVE TEXTILES)"
                            value={nombreNuevaNaveInput}
                            onChange={(e) => setNombreNuevaNaveInput(e.target.value)}
                            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-2xs focus:border-institucional-green focus:outline-hidden uppercase"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={async () => {
                            const nombreLimpio = nombreNuevaNaveInput.trim();
                            if (!nombreLimpio) {
                              toast.error("Ingrese el nombre para la nueva nave.");
                              return;
                            }
                            setParseando(true);
                            try {
                              const opc = { crearNuevaNave: true, nuevoNombreNave: nombreLimpio };
                              setOpcionesImportacion(opc);
                              const sim = await importadorService.simularImportacion(registros, opc);
                              setAnalisis(sim);
                              toast.success(`Vista previa para crear la nueva nave: ${nombreLimpio}`);
                            } catch (err) {
                              logClientError("INGRESO-CATASTRO", "Error al preparar la creación de la nueva nave", err);
                              toast.error("Error al preparar la creación de la nueva nave.");
                            } finally {
                              setParseando(false);
                            }
                          }}
                          disabled={parseando || !nombreNuevaNaveInput.trim()}
                          className="w-full bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold"
                        >
                          Crear Nueva Nave
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-5 border-b border-institucional-whiteSmokeBlack/15 bg-slate-50/70 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 size={18} className="text-institucional-green" />
                      <span className="font-bold text-sm text-base-eerieBlack">
                        Reconciliación: {analisis.reconciliacion.naveDetectada}
                      </span>
                      {analisis.reconciliacion.esNaveNueva ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          Se creará como Nueva Nave
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Nave Existente (Actualización Mensual)
                        </span>
                      )}
                    </div>
                    {analisis.reconciliacion.cambiosDetectados.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMostrarCambios(!mostrarCambios)}
                        className="text-xs text-institucional-green hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <span>{mostrarCambios ? "Ocultar detalle de cambios" : "Ver detalle de cambios"}</span>
                        {mostrarCambios ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Aviso informativo limpio para Bodegas / Locales */}
                  {analisis.reconciliacion.esArchivoBodegas && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-gray-700">
                      <span className="font-semibold text-institucional-green uppercase tracking-wide shrink-0">
                        Bodegas / Locales Detectados:
                      </span>
                      <span>
                        Se concilian automáticamente dentro de <strong>{analisis.reconciliacion.naveDetectada}</strong> sin afectar los puestos numéricos existentes.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-base-white p-3 border border-institucional-whiteSmokeBlack/15 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Capacidad Nave</p>
                      <p className="text-lg font-bold text-base-eerieBlack">{analisis.reconciliacion.capacidadNave} puestos</p>
                    </div>
                    <div className="rounded-lg bg-base-white p-3 border border-emerald-200/60 shadow-sm">
                      <p className="text-xs font-medium text-emerald-700">Ocupados en Archivo</p>
                      <p className="text-lg font-bold text-emerald-700">{analisis.reconciliacion.totalOcupados}</p>
                    </div>
                    <div className="rounded-lg bg-base-white p-3 border border-blue-200/60 shadow-sm">
                      <p className="text-xs font-medium text-acento-azul1">Vacantes Resultantes</p>
                      <p className="text-lg font-bold text-acento-azul1">{analisis.reconciliacion.totalVacantes}</p>
                    </div>
                    <div className="rounded-lg bg-base-white p-3 border border-amber-200/60 shadow-sm">
                      <p className="text-xs font-medium text-amber-700">Cambios Detectados</p>
                      <p className="text-lg font-bold text-amber-700">{analisis.reconciliacion.cambiosDetectados.length}</p>
                    </div>
                  </div>

                  {mostrarCambios && analisis.reconciliacion.cambiosDetectados.length > 0 && (
                    <div className="mt-2 rounded-lg bg-base-white border border-institucional-whiteSmokeBlack/20 p-3 max-h-48 overflow-y-auto space-y-2">
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <RefreshCw size={13} className="text-institucional-green" />
                        <span>Modificaciones mensuales detectadas ({analisis.reconciliacion.cambiosDetectados.length}):</span>
                      </div>
                      {analisis.reconciliacion.cambiosDetectados.map((c, idx) => (
                        <div
                          key={idx}
                          className="text-xs flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200/70"
                        >
                          <span
                            className={`font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                              c.tipo === "REEMPLAZO_OCUPANTE"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : c.tipo === "CAMBIO_PUESTO"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : c.tipo === "VACANTE"
                                ? "bg-gray-100 text-gray-700 border border-gray-300"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {c.tipo}
                          </span>
                          <div className="flex-1 text-gray-700">
                            <span className="font-semibold text-gray-900">Puesto {c.puesto}:</span> {c.detalle}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* Apartado Desplegable: Duplicados 100% Exactos Omitidos Automáticamente */}
            {duplicadosOmitidos.length > 0 && (
              <div className="border-b border-institucional-whiteSmokeBlack/15 bg-amber-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-900">
                      Duplicados 100% Exactos Omitidos Automáticamente ({duplicadosOmitidos.length})
                    </span>
                    <span className="text-[11px] text-amber-800 hidden sm:inline">
                      (Mismo nombre, actividad y puesto idénticos)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarDuplicadosOmitidos(!mostrarDuplicadosOmitidos)}
                    className="text-xs text-amber-900 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{mostrarDuplicadosOmitidos ? "Ocultar lista" : "Ver lista"}</span>
                    {mostrarDuplicadosOmitidos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {mostrarDuplicadosOmitidos && (
                  <div className="mt-2.5 max-h-40 overflow-y-auto rounded-lg border border-amber-200/80 bg-white p-2.5 space-y-1.5 text-xs">
                    {duplicadosOmitidos.map((dup, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded bg-amber-50/40 border border-amber-100 text-gray-700"
                      >
                        <div>
                          <strong className="text-gray-900">{dup.nombre || dup.contribuyente}</strong>
                          <span className="text-gray-500 ml-2">C.I.: {dup.cedula || "-"}</span>
                          <span className="text-gray-500 ml-2">Giro: {dup.actividad || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                            Puesto {dup.puesto}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Omitido</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tabla con scroll interno */}
            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-20 shadow-2xs">
                  <tr className="bg-[#e6efe9] border-b border-institucional-whiteSmokeBlack/20">
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-3 py-2.5 text-center font-semibold text-base-eerieBlack w-12">#</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">CIU</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">CÉDULA</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">NOMBRES</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">ACTIVIDAD</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">NAVE</th>
                    <th className="sticky top-0 z-20 bg-[#e6efe9] px-4 py-2.5 text-left font-semibold text-base-eerieBlack">PUESTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-institucional-whiteSmokeBlack/10">
                  {registros.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-institucional-whiteSmoke/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-center text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-gray-500 font-medium">{r.ciu || "-"}</td>
                      <td className="px-4 py-2 font-mono font-medium text-base-eerieBlack">{r.cedula}</td>
                      <td className="px-4 py-2 font-semibold text-base-eerieBlack">{r.nombre}</td>
                      <td className="px-4 py-2 text-gray-700">{r.actividad}</td>
                      <td className="px-4 py-2 font-medium text-acento-azul1">{r.nave}</td>
                      <td className="px-4 py-2 font-mono text-gray-900 font-semibold">{r.puesto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de Acciones Inferior */}
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-institucional-whiteSmokeBlack/15 bg-base-white shrink-0">
              <span className="text-xs text-gray-500 order-2 sm:order-1">
                Revise la correspondencia de puestos y nombres antes de confirmar.
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end order-1 sm:order-2">
                <Button
                  variant="outline"
                  onClick={handleReiniciar}
                  disabled={procesando}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={procesando || Boolean(analisis?.reconciliacion?.naveNoEncontrada)}
                  className="w-full sm:w-auto bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold shadow-sm"
                >
                  {procesando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    "Confirmar e Importar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 3: Resumen de Resultados ── */}
        {paso === "resultado" && resultado && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="rounded-2xl bg-base-white p-6 sm:p-8 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 border border-green-200 shadow-inner">
                <CheckCircle2 size={36} className="text-institucional-green" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-base-eerieBlack">Proceso de Importación Finalizado</h2>
              <p className="mt-1 text-sm text-gray-600">
                Los datos analizados del archivo <span className="font-semibold text-gray-800">{archivoNombre}</span> han sido procesados.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto text-left">
                <div className="rounded-xl bg-green-50/60 p-4 border border-green-200">
                  <p className="text-2xl font-bold text-institucional-green">{resultado.exitosos}</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">Comerciantes registrados con éxito</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-2xl font-bold text-gray-700">{resultado.errores.length}</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">Observaciones o descartes</p>
                </div>
              </div>

              {resultado.reconciliacion && (
                <div className="mt-6 max-w-xl mx-auto text-left rounded-xl bg-slate-50 border border-institucional-whiteSmokeBlack/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-institucional-whiteSmokeBlack/15 pb-2">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-institucional-green" />
                      <span className="font-semibold text-xs text-base-eerieBlack">
                        Nave: {resultado.reconciliacion.naveDetectada}
                      </span>
                      {resultado.reconciliacion.esNaveNueva ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Nueva Nave Registrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Actualización Mensual Aplicada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-base-white p-2 border border-institucional-whiteSmokeBlack/10">
                      <p className="text-[10px] text-gray-500 font-medium">Capacidad</p>
                      <p className="text-sm font-bold text-base-eerieBlack">{resultado.reconciliacion.capacidadNave}</p>
                    </div>
                    <div className="rounded-lg bg-base-white p-2 border border-institucional-whiteSmokeBlack/10">
                      <p className="text-[10px] text-emerald-700 font-medium">Ocupados</p>
                      <p className="text-sm font-bold text-emerald-700">{resultado.reconciliacion.totalOcupados}</p>
                    </div>
                    <div className="rounded-lg bg-base-white p-2 border border-institucional-whiteSmokeBlack/10">
                      <p className="text-[10px] text-acento-azul1 font-medium">Vacantes</p>
                      <p className="text-sm font-bold text-acento-azul1">{resultado.reconciliacion.totalVacantes}</p>
                    </div>
                  </div>

                  {resultado.reconciliacion.cambiosDetectados.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <RefreshCw size={12} className="text-institucional-green" />
                        <span>Resumen de Modificaciones Realizadas ({resultado.reconciliacion.cambiosDetectados.length}):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {resultado.reconciliacion.cambiosDetectados.map((c, idx) => (
                          <div
                            key={idx}
                            className="text-xs flex items-start gap-2 p-2 rounded bg-base-white border border-slate-200"
                          >
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                                c.tipo === "REEMPLAZO_OCUPANTE"
                                  ? "bg-purple-100 text-purple-800"
                                  : c.tipo === "CAMBIO_PUESTO"
                                  ? "bg-blue-100 text-blue-800"
                                  : c.tipo === "VACANTE"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {c.tipo}
                            </span>
                            <div className="flex-1 text-gray-700">
                              <span className="font-semibold text-gray-900">Puesto {c.puesto}:</span> {c.detalle}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={handleReiniciar}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Importar otro archivo
                </Button>
                <Link
                  href="/catastro"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-institucional-green px-5 py-2 text-sm font-semibold text-base-white shadow-sm hover:bg-acento-verdeOliva1 transition-colors"
                >
                  <span>Ver Comerciantes en Catastro</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal de Confirmación de Importación ── */}
        <Dialog
          open={confirmModalOpen}
          disablePointerDismissal={true}
          onOpenChange={(o) => !o && setConfirmModalOpen(false)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base-eerieBlack font-bold">
                <AlertCircle className="text-amber-500" size={20} />
                Confirmar e Importar al Catastro
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-700 pt-1 leading-relaxed">
                ¿Está seguro de ingresar estos <strong>{registros.length} comerciantes</strong> al sistema? Esta operación actualizará el catastro general con la distribución de naves y puestos detectados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end pt-3">
              <Button
                variant="outline"
                onClick={() => setConfirmModalOpen(false)}
                disabled={procesando}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setConfirmModalOpen(false);
                  await handleConfirmarImportacion();
                }}
                disabled={procesando}
                className="bg-institucional-green text-base-white hover:bg-acento-verdeOliva1 font-semibold"
              >
                Aceptar y Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal de Confirmación para Puestos Ambulantes ── */}
        <Dialog
          open={modalPreguntaAmbulantesOpen}
          disablePointerDismissal={true}
          onOpenChange={(open) => {
            if (!open && !parseando) {
              setModalPreguntaAmbulantesOpen(false);
            }
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200"
          >
            <DialogHeader className="text-left space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-institucional-green/10 text-institucional-green">
                  <Building2 size={24} />
                </div>
                <DialogTitle className="text-base font-bold text-gray-900 leading-snug">
                  ¿Este archivo corresponde a Puestos Ambulantes?
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-gray-600 leading-relaxed pt-1">
                El archivo cargado registra por defecto el nombre <strong>&quot;NAVE&quot;</strong>, pero usted tiene a su cargo la nave <strong>&quot;{naveAmbulantesAutorizada?.nombre}&quot;</strong>. ¿Confirma que estos <strong>{registrosPendientesAmbulantes.length}</strong> registros corresponden a puestos ambulantes de <strong>&quot;{naveAmbulantesAutorizada?.nombre}&quot;</strong>?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-5 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={parseando}
                onClick={handleRechazarEsAmbulantes}
                className="w-full sm:w-auto text-xs"
              >
                No, no es Ambulantes (Selección Manual)
              </Button>
              <Button
                type="button"
                disabled={parseando}
                onClick={handleConfirmarEsAmbulantes}
                className="w-full sm:w-auto bg-institucional-green hover:bg-acento-verdeOliva1 text-white text-xs font-bold"
              >
                {parseando ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Asignando...
                  </>
                ) : (
                  `Sí, es ${naveAmbulantesAutorizada?.nombre || "Ambulantes"}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
