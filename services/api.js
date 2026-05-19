import axios from "axios";


const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
console.log("URL Backend hiện tại là:", process.env.EXPO_PUBLIC_API_URL);
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
