import axios from "axios";

const CSRF_COOKIE_NAME = "ucs_csrf_token";

function readCookie(name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  const requiresCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (requiresCsrf) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as { _retry?: boolean; url?: string; headers?: Record<string, string> };
    const isRefreshRequest = (original?.url || "").includes("/auth/refresh");

    if (error.response?.status === 401 && !original?._retry && !isRefreshRequest) {
      original._retry = true;

      try {
        await api.post("/auth/refresh", {});
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
