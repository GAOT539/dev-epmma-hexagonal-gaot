import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión | EP-EMA",
  description: "Acceda al sistema institucional EP-EMA con sus credenciales.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
