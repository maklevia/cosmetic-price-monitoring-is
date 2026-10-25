import { getEnvOrThrow } from "@fe/utils/getEnvOrThrow";
import axios from "axios";
import type { AxiosInstance } from "axios";
import { toaster } from "@fe/components/ui/toaster";

export const api: AxiosInstance = axios.create({
  baseURL: getEnvOrThrow('API_ORIGIN'),
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
});

export const authApi: AxiosInstance = axios.create({
  baseURL: getEnvOrThrow('AUTH_ORIGIN'),
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

const refreshSession = (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = authApi
      .post("/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const authEndpointsWithoutRefresh = new Set([
  "/login",
  "/signup",
  "/refresh",
  "/logout",
]);

const handleExpiredSession = async (): Promise<void> => {
  await authApi.post("/logout").catch(() => undefined);
  if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
    window.location.href = "/login";
  }
};

authApi.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const url = error.config?.url;

    if (
      error.response &&
      error.response.status === 401 &&
      url &&
      !authEndpointsWithoutRefresh.has(url)
    ) {
      try {
        await refreshSession();
        return authApi(error.config);
      } catch {
        await handleExpiredSession();
      }
    }

    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response && error.response.status === 401) {
      try {
        await refreshSession();
        return api(error.config);
      } catch {
        await handleExpiredSession();
      }
    }

    if (!error.response) {
      toaster.error({ title: "Network error. Check your connection." });
    } else if (error.response.status >= 500) {
      toaster.error({ title: "Server error. Please try again later." });
    }

    return Promise.reject(error);
  },
);
