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
app.get('/api/reportes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reportes:', err);
    res.status(500).send('Error al obtener reportes');
  }
});

// ✅ Agregar un reporte
app.post('/api/reportes', async (req, res) => {
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
app.put('/api/reportes/:id', async (req, res) => {
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
app.delete('/api/reportes/:id', async (req, res) => {
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

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Clave secreta (ponela en Render → Environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro';

// ================== AUTH ==================

// Registrar usuario
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Faltan datos');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, password_hash]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al registrar:', err);
    res.status(500).send('Error al registrar usuario');
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);

    if (result.rows.length === 0) return res.status(401).send('Usuario o contraseña incorrectos');

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) return res.status(401).send('Usuario o contraseña incorrectos');

    // Crear token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });

    res.json({ token });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error en login');
  }
});


function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send('No autorizado');

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).send('No autorizado');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // lo guardamos para usarlo en la ruta
    next();
  } catch (err) {
    return res.status(403).send('Token inválido o expirado');
  }
}

app.get('/api/reportes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reportes:', err);
    res.status(500).send('Error al obtener reportes');
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const result = await pool.query(
    'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2) RETURNING id, username',
    [username, password_hash]
  );

  res.json(result.rows[0]);
});

