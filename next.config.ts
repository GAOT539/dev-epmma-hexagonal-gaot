import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite requests HMR/dev desde otros dispositivos en la red local.
  // Agrega cualquier IP/hostname adicional que necesites aquí.
  allowedDevOrigins: ["192.168.100.220"],
};

export default nextConfig;
