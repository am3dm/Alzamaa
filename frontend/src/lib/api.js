import axios from "axios";

export const TOKEN_KEY = "tms_token";

const memory = {};
export const storage = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return memory[k] ?? null; } },
  set: (k, v) => { memory[k] = v; try { window.localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove: (k) => { delete memory[k]; try { window.localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
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
