/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 🚀 Quét sạch các file React TypeScript để nhận class Tailwind
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
