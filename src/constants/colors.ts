// src/constants/colors.ts
// Design System — Modern Indigo / Clean Blue (Concept Mockup)

export const themes = {
  light: {
    background: "#F0F2F8",            // Nền chính — xanh bạc nhạt
    surface: "#FFFFFF",                // Nền card — trắng tinh
    surfaceAlt: "#F7F9FC",            // Nền card phụ nhạt hơn
    text: "#0F172A",                   // Chữ chính — xanh đen đậm
    textMuted: "#64748B",              // Chữ phụ — xanh xám
    border: "rgba(15,23,42,0.08)",    // Viền rất nhẹ

    // Accent: Indigo (single accent, saturation < 80%)
    indigo: "#4F46E5",                 // Indigo chính
    indigoLight: "#EEF2FF",            // Indigo tint rất nhạt
    indigoMid: "#818CF8",              // Indigo mid (gradient)

    // Secondary accents
    amber: "#F59E0B",                  // Vàng cam (streak / fire)
    amberLight: "#FEF3C7",
    purple: "#8B5CF6",                 // Tím (grammar)
    purpleLight: "#F5F3FF",
    blue: "#3B82F6",                   // Xanh dương (vocab)
    blueLight: "#EFF6FF",
    emerald: "#10B981",                // Xanh lá (success)
    emeraldLight: "#D1FAE5",

    error: "#EF4444",
    errorLight: "#FEF2F2",

    shadowColor: "#4F46E5",
    shadowNeutral: "#0F172A",
  },
  dark: {
    background: "#080C18",             // Nền OLED — navy đen sâu
    surface: "#111827",                // Nền card — navy tối
    surfaceAlt: "#1A2235",             // Nền card phụ
    text: "#F1F5F9",                   // Chữ chính — trắng kem
    textMuted: "#64748B",              // Chữ phụ — xám trung
    border: "rgba(241,245,249,0.08)", // Viền rất nhẹ

    // Accent: Indigo (sáng hơn cho dark mode readability)
    indigo: "#818CF8",                 // Indigo sáng
    indigoLight: "#1E1B4B",            // Indigo tint tối
    indigoMid: "#4F46E5",              // Indigo mid

    // Secondary accents
    amber: "#FBBF24",
    amberLight: "#1C1508",
    purple: "#A78BFA",
    purpleLight: "#1E1535",
    blue: "#60A5FA",
    blueLight: "#0C1A2E",
    emerald: "#34D399",
    emeraldLight: "#052E16",

    error: "#F87171",
    errorLight: "#450A0A",

    shadowColor: "#818CF8",
    shadowNeutral: "#000000",
  },
};