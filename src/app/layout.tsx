import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EPMMA - Sistema de Gestión",
  description: "Sistema institucional de gestión EPMMA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${roboto.variable} h-full antialiased`}
    >
      <body className={`${roboto.variable} font-sans min-h-full flex flex-col`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
