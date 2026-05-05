(() => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const apiUrl = isLocal
    ? "http://localhost:3001"
    : "https://sigsobse-backend.onrender.com";

  window.__CONFIG__ = { API_URL: apiUrl };
  window.__GIS_CONFIG__ = { API_BASE_URL: apiUrl };
})();
