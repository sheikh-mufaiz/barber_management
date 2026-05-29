const DEFAULT_LOCAL_API_URL = "http://localhost:5000/api";

const getRuntimeApiUrl = () => {
  if (typeof window !== "undefined" && window.__QUE_MAN_API_URL__) {
    return window.__QUE_MAN_API_URL__;
  }

  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  return DEFAULT_LOCAL_API_URL;
};

export const API_URL = getRuntimeApiUrl();

export const getStoredSession = () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token") || user?.token || "";

  return { user, token };
};

export const authHeaders = (headers = {}) => {
  const { token } = getStoredSession();

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers)
  });

  if (res.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth:expired"));
  }

  return res;
};
