import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
console.log("URL Backend hiện tại là:", process.env.EXPO_PUBLIC_API_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token from AsyncStorage to every outgoing request and apply dynamic apiBase url override
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const savedApiBase = await AsyncStorage.getItem("apiBase");
    if (savedApiBase) {
      config.baseURL = savedApiBase;
    } else {
      config.baseURL = BASE_URL;
    }
  } catch (error) {
    console.error("Lỗi lấy token/cấu hình từ AsyncStorage:", error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
