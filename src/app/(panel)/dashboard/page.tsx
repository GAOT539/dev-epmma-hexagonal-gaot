import { Users, Store, MapPin, LayoutGrid } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}

// ── Componente de tarjeta KPI ────────────────────────────────────────────────

function KpiCard({ icon, label, value, iconBg, iconColor }: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-base-white p-5 shadow-sm ring-1 ring-institucional-whiteSmokeBlack/30">
      {/* Ícono con fondo de color */}
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
      >
        <span className={`${iconColor}`}>{icon}</span>
      </div>

      {/* Texto */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-institucional-whiteSmokeBlack">
          {label}
        </p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight text-base-eerieBlack">
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Datos estáticos de las KPI ───────────────────────────────────────────────

const kpiCards: KpiCardProps[] = [
  {
    icon: <Users size={26} strokeWidth={1.75} />,
    label: "Comerciantes activos",
    value: "1,250",
    iconBg: "bg-institucional-green/10",
    iconColor: "text-institucional-green",
  },
  {
    icon: <Store size={26} strokeWidth={1.75} />,
    label: "Puestos ocupados",
    value: "840",
    iconBg: "bg-acento-azul1/10",
    iconColor: "text-acento-azul1",
  },
  {
    icon: <MapPin size={26} strokeWidth={1.75} />,
    label: "Puestos disponibles",
    value: "120",
    iconBg: "bg-acento-naranjaSalmon1/10",
    iconColor: "text-acento-naranjaSalmon1",
  },
  {
    icon: <LayoutGrid size={26} strokeWidth={1.75} />,
    label: "Sectores / Naves",
    value: "5",
    iconBg: "bg-acento-morado/10",
    iconColor: "text-acento-morado",
  },
];

// ── Página principal del Dashboard ──────────────────────────────────────────

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-institucional-whiteSmoke px-4 py-8 sm:px-6 lg:px-10">
      {/* ── Encabezado ── */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-institucional-green sm:text-3xl">
          Panel operativo del catastro comercial
        </h1>
        <p className="mt-1 text-sm text-institucional-whiteSmokeBlack">
          Resumen general del estado actual del mercado.
        </p>
      </header>

      {/* ── Cuadrícula de tarjetas KPI ── */}
      <section aria-label="Indicadores clave de rendimiento">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>
    </main>
  );
}
