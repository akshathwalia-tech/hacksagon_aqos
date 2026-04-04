/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F172A",
          foreground: "#F8FAFC"
        },
        secondary: {
          DEFAULT: "#22D3EE",
          foreground: "#0F172A"
        },
        accent: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF"
        },
        background: {
          light: "#F8FAFC",
          dark: "#020617"
        },
        surface: {
          light: "#FFFFFF",
          dark: "#0F172A"
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}