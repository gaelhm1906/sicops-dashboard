const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:
    process.env.DB_SSL === "false"
      ? false
      : {
          rejectUnauthorized: false,
        },
});

app.get("/", (req, res) => {
  res.json({ message: "Servidor activo 🔥" });
});

app.get("/api/dashboard/obras", async (req, res) => {
  try {
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'sig_sobse'
    `;

    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map((row) => row.table_name);
    const allData = [];

    for (const table of tables) {
      try {
        const safeTable = table.replace(/"/g, '""');
        const query = `
          SELECT
            "DIRECCION GENERAL" AS dg,
            "NOMBRE_OBRA" AS nombre,
            "AVANCE REAL" AS avance
          FROM sig_sobse."${safeTable}"
        `;

        const result = await pool.query(query);
        allData.push(...result.rows);
      } catch (error) {
        console.log(`Tabla ${table} ignorada: ${error.message}`);
      }
    }

    const data = allData.map((item) => {
      const avance = Number(item.avance) || 0;
      let estatus = "SIN INICIAR";

      if (avance === 100) {
        estatus = "ENTREGADA";
      } else if (avance > 0) {
        estatus = "EN PROCESO";
      }

      return {
        dg: item.dg || "",
        nombre: item.nombre || "",
        avance,
        estatus,
      };
    });

    res.json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${PORT}`);
});
