// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render necesita esto
});

// =================== RUTAS =================== //

// Obtener todos los reportes
app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reportes ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener reportes:", err);
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

// Agregar un nuevo reporte
app.post("/api/reports", async (req, res) => {
  try {
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;

    if (!reporte || !fecha || !solicitud || !proyecto) {
      return res
        .status(400)
        .json({ error: "Campos obligatorios faltantes" });
    }

    const query = `
      INSERT INTO reportes (reporte, fecha, solicitud, proyecto, resultado, estado)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      reporte,
      fecha,
      solicitud,
      proyecto,
      resultado || "",
      estado || "Pendiente",
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al agregar reporte:", err);
    res.status(500).json({ error: "Error al agregar reporte" });
  }
});

// Editar un reporte
app.put("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;

    const query = `
      UPDATE reportes
      SET reporte=$1, fecha=$2, solicitud=$3, proyecto=$4, resultado=$5, estado=$6
      WHERE id=$7
      RETURNING *;
    `;
    const values = [reporte, fecha, solicitud, proyecto, resultado, estado, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al actualizar reporte:", err);
    res.status(500).json({ error: "Error al actualizar reporte" });
  }
});

// Eliminar un reporte
app.delete("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM reportes WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error al eliminar reporte:", err);
    res.status(500).json({ error: "Error al eliminar reporte" });
  }
});

// =================== SERVIDOR =================== //
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
