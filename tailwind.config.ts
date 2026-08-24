import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        institucional: {
          green: "#337533",
          whiteSmoke: "#F0F0F0",
          whiteSmokeBlack: "#C4C4C4",
        },
        base: {
          white: "#FFFFFF",
          black: "#000000",
          eerieBlack: "#181818",
          red: "#FF0000",
        },
        acento: {
          verdeOliva1: "#45743B",
          verdeOliva2: "#3A6032",
          naranjaSalmon1: "#C95D52",
          naranjaSalmon2: "#A54E45",
          azul1: "#2E78CC",
          azul2: "#1F518B",
          morado: "#6A1B9A",
        }
      },
    },
  },
  plugins: [],
};
export default config;