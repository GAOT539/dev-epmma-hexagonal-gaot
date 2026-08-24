import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión | EPMMA",
  description: "Acceda al sistema institucional EPMMA con sus credenciales.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
