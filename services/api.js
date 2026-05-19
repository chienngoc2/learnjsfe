import axios from "axios";

// THAY CÁI NÀY BẰNG IP SẾP VỪA TÌM ĐƯỢC
const BASE_URL = "http://192.168.132.1:5000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
