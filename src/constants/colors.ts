// src/constants/colors.ts

export const themes = {
  light: {
    background: "#F4F6FF",      // Nền chính xanh nhạt/lavender cực sang
    surface: "#FFFFFF",         // Nền thẻ trắng tinh
    text: "#1E1B4B",            // Chữ màu tím than đậm sang trọng
    textMuted: "#64748B",       // Chữ xám mờ
    border: "#E2E8F0",          // Viền nhạt
    
    // Giữ nguyên các màu nhấn của sếp
    amber: "#D97706",
    amberLight: "#FFEDD5",
    indigo: "#4F46E5",
    indigoLight: "#E0E7FF",
    error: "#EF4444",
    errorLight: "#FEF2F2",
  },
  dark: {
    background: "#0F172A",      // Nền chính xanh đen sâu (Slate 900)
    surface: "#1E293B",         // Nền thẻ xám xanh (Slate 800)
    text: "#F8FAFC",            // Chữ trắng gần tinh khiết
    textMuted: "#94A3B8",       // Chữ xám sáng
    border: "#334155",          // Viền tối (Slate 700)
    
    // Tinh chỉnh nhẹ độ sáng các màu nhấn để hiển thị tốt trên nền tối
    amber: "#F59E0B",
    amberLight: "#2D1A05",      // Nền cam cực tối cho Dark Mode
    indigo: "#6366F1",
    indigoLight: "#1E1B4B",     // Nền indigo tối
    error: "#F87171",
    errorLight: "#450A0A",
  }
};