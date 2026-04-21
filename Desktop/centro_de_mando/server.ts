import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import pg from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Database configuration from user request
const pool = new Pool({
  host: process.env.DB_HOST || "2.24.29.43",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "sicops",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: {
    rejectUnauthorized: false
  },
  // Adding a timeout and max connections for stability
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Route for dashboard data
  app.get("/api/dashboard/obras", async (req, res) => {
    try {
      // 1. Obtener todas las tablas del schema sig_sobse
      const tablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'sig_sobse'
      `;
      const tablesResult = await pool.query(tablesQuery);
      const tables = tablesResult.rows.map(r => r.table_name);

      const allData = [];

      // 2. Para cada tabla, intentar consultar las columnas
      for (const table of tables) {
        try {
          const query = `
            SELECT 
              "DIRECCION GENERAL" as dg,
              "NOMBRE_OBRA" as nombre,
              "AVANCE REAL" as avance
            FROM sig_sobse."${table}"
          `;
          const result = await pool.query(query);
          allData.push(...result.rows);
        } catch (error) {
          // Ignorar tablas que no tengan las columnas
          console.log(`Tabla ${table} ignorada: ${error.message}`);
        }
      }

      // 3. Procesar datos y agregar estatus
      const processedData = allData.map(item => {
        const avance = parseFloat(item.avance) || 0;
        let estatus = "SIN INICIAR";
        if (avance > 0 && avance < 100) estatus = "EN PROCESO";
        else if (avance === 100) estatus = "ENTREGADA";

        return {
          dg: item.dg || "",
          nombre: item.nombre || "",
          avance: avance,
          estatus: estatus
        };
      });

      // 4. Responder
      res.json({
        success: true,
        total: processedData.length,
        data: processedData
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
