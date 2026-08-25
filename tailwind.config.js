/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        brand: {
          teal:  "#0F9E7D",
          green: "#4CAF50",
          red:   "#E85D4A",
          coral: "#FF6B6B",
          gray:  "#374151",
        },
        gov: {
          guinda:      "#691C32",
          "guinda-dk": "#4E1425",
          "guinda-lt": "#8B2341",
          verde:       "#006341",
          "verde-dk":  "#004d32",
          dorado:      "#BC955C",
          "dorado-lt": "#DDC9A3",
          fondo:       "#F8F5F2",
          "gris-frio": "#6F7271",
          texto:       "#2C2C2C",
          "texto-sec": "#666666",
          borde:       "#D4C4B0",
        },
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-in-out",
        "slide-in":   "slideIn 0.3s ease-in-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "shake":      "shake 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%":   { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.8" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%":      { transform: "translateX(-4px)" },
          "75%":      { transform: "translateX(4px)" },
        },
      },
    },
  },
  plugins: [],
};
