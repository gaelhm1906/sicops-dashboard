(() => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  /* Despliegue de pruebas standalone: sin backend, se alimenta de
     /data/obras.json y del login local embebido en utils/api.js. */
  const isPruebasStandalone = !isLocal && pathname.includes("/pruebas/");

  const apiUrl = isLocal
    ? "http://localhost:3001"
    : "https://srv1574556.hstgr.cloud";

  /* PB/PS_SICOPS_FINAL — API nueva (contratos, motor financiero), todavía
     sin desplegar al VPS. Local mientras tanto: http://localhost:3004.
     Cuando se despliegue, cambiar la rama "else" al prefijo real de Apache
     (ej. https://srv1574556.hstgr.cloud/ps-sicops/). */
  const psApiUrl = isLocal
    ? "http://localhost:3004"
    : "https://srv1574556.hstgr.cloud/ps-sicops";

  window.__CONFIG__ = { API_URL: apiUrl, OFFLINE: isPruebasStandalone, PS_API_URL: psApiUrl };
  window.__GIS_CONFIG__ = { API_BASE_URL: apiUrl };
})();
