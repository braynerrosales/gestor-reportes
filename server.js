const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Config DB (Render usa DATABASE_URL en variables de entorno)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== RUTAS API ==================

// ✅ Obtener todos los reportes
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reportes:', err);
    res.status(500).send('Error al obtener reportes');
  }
});

// ✅ Agregar un reporte
app.post('/api/reports', async (req, res) => {
  try {
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;

    const result = await pool.query(
      `INSERT INTO reportes (reporte, fecha, solicitud, proyecto, resultado, estado)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [reporte, fecha, solicitud, proyecto, resultado, estado]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al agregar reporte:', err);
    res.status(500).send('Error al agregar reporte');
  }
});

// ✅ Actualizar un reporte
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { resultado, estado } = req.body;

    const result = await pool.query(
      `UPDATE reportes SET 
         resultado = COALESCE($1, resultado), 
         estado = COALESCE($2, estado)
       WHERE id = $3 RETURNING *`,
      [resultado, estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Reporte no encontrado');
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar reporte:', err);
    res.status(500).send('Error al actualizar reporte');
  }
});

// ✅ Eliminar un reporte
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reportes WHERE id = $1', [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error al eliminar reporte:', err);
    res.status(500).send('Error al eliminar reporte');
  }
});

// ✅ Exportar a Excel
app.get('/api/export-excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reportes');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Reporte', key: 'reporte', width: 30 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Solicitud', key: 'solicitud', width: 20 },
      { header: 'Proyecto', key: 'proyecto', width: 20 },
      { header: 'Resultado', key: 'resultado', width: 30 },
      { header: 'Estado', key: 'estado', width: 15 }
    ];

    worksheet.addRows(result.rows);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=reportes.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    res.status(500).send('Error al exportar Excel');
  }
});

// ================== INICIO ==================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
