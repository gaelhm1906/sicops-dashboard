const API_BASE_URL =
  (typeof window !== "undefined" && window.__CONFIG__?.API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

export default API_BASE_URL;
