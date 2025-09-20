const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 10000;

// Conexión a PostgreSQL desde Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ------- RUTAS -------

// Obtener reportes
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// Agregar reporte
app.post('/api/reports', async (req, res) => {
  try {
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;
    const result = await pool.query(
      `INSERT INTO reports (reporte, fecha, solicitud, proyecto, resultado, estado)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [reporte, fecha, solicitud, proyecto, resultado, estado]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el reporte' });
  }
});

// Actualizar reporte
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;
    const result = await pool.query(
      `UPDATE reports
       SET reporte=$1, fecha=$2, solicitud=$3, proyecto=$4, resultado=$5, estado=$6
       WHERE id=$7 RETURNING *`,
      [reporte, fecha, solicitud, proyecto, resultado, estado, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el reporte' });
  }
});

// Eliminar reporte
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reports WHERE id=$1', [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el reporte' });
  }
});

// Exportar a Excel
app.get('/api/export-excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY fecha DESC');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reportes');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Reporte', key: 'reporte', width: 30 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Solicitud', key: 'solicitud', width: 20 },
      { header: 'Proyecto', key: 'proyecto', width: 25 },
      { header: 'Resultado', key: 'resultado', width: 30 },
      { header: 'Estado', key: 'estado', width: 15 }
    ];

    result.rows.forEach(r => sheet.addRow(r));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=reportes.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar a Excel' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
