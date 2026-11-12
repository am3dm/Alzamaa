import axios from "axios";

export const TOKEN_KEY = "tms_token";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errMsg(e) {
  const detail = e?.response?.data?.detail;
  if (!detail) return "حدث خطأ، حاول مرة أخرى";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "يرجى التحقق من الحقول المدخلة";
  return String(detail);
}
