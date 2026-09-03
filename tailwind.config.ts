import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        denticon: "#0F6CBD",
        cloud9: "#2E9E5B",
        internal: "#6B5CA5",
        brand: {
          blue: "#0069DC",
          darkBlue: "#000F60",
          blueWater: "#D3E6F5",
          orange: "#FA4616",
          purple: "#833177",
          green: "#257226",
        },
      },
    },
  },
  plugins: [],
};

export default config;
