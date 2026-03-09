/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#0e1116",
        panel: "#171c24",
        ink: "#eff3f8",
        lime: "#a3ff6f",
        alert: "#ff6c5f",
        sand: "#f4e5b3"
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      },
      boxShadow: {
        card: "0 16px 40px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};
