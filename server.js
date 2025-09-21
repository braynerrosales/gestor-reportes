const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 10000;
const SECRET_KEY = process.env.JWT_SECRET || 'clave_super_secreta';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== BITÁCORA ==================
async function logAction(usuario, accion, endpoint) {
  try {
    await pool.query(
      'INSERT INTO bitacora (usuario, accion, endpoint) VALUES ($1, $2, $3)',
      [usuario || 'Anónimo', accion, endpoint]
    );
  } catch (err) {
    console.error('Error al registrar bitácora:', err);
  }
}

// ================== MIDDLEWARE ==================
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // Guardamos datos del usuario
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

// ================== AUTH ==================
// Registro de usuarios
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.status(400).send('Faltan datos');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, password_hash]
    );

    await logAction(username, 'Registro de usuario', '/api/register');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al registrar:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login de usuarios
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      await logAction(null, 'Intento fallido de login', '/api/login');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logAction(user.username, 'Contraseña incorrecta', '/api/login');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '2h' });

    await logAction(user.username, 'Ingreso exitoso', '/api/login');
    res.json({ token });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en login' });
  }
});

// ================== REPORTES ==================
// Obtener reportes
app.get('/api/reportes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    await logAction(req.user.username, 'Consulta de reportes', '/api/reportes');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reportes:', err);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// Agregar reporte
app.post('/api/reportes', authMiddleware, async (req, res) => {
  try {
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;
    const result = await pool.query(
      `INSERT INTO reportes (reporte, fecha, solicitud, proyecto, resultado, estado)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [reporte, fecha, solicitud, proyecto, resultado, estado]
    );
    await logAction(req.user.username, `Agregó nuevo reporte (${reporte})`, '/api/reportes');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al agregar reporte:', err);
    res.status(500).json({ error: 'Error al agregar reporte' });
  }
});

// Actualizar reporte
app.put('/api/reportes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reporte, fecha, solicitud, proyecto, resultado, estado } = req.body;
    const result = await pool.query(
      `UPDATE reportes
       SET reporte=$1, fecha=$2, solicitud=$3, proyecto=$4, resultado=$5, estado=$6
       WHERE id=$7 RETURNING *`,
      [reporte, fecha, solicitud, proyecto, resultado, estado, id]
    );
    if (result.rows.length === 0) return res.status(404).send('Reporte no encontrado');

    await logAction(req.user.username, `Actualizó reporte ${id}`, '/api/reportes');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar reporte:', err);
    res.status(500).json({ error: 'Error al actualizar reporte' });
  }
});

// Eliminar reporte
app.delete('/api/reportes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reportes WHERE id=$1', [id]);
    await logAction(req.user.username, `Eliminó reporte ${id}`, '/api/reportes');
    res.sendStatus(204);
  } catch (err) {
    console.error('Error al eliminar reporte:', err);
    res.status(500).json({ error: 'Error al eliminar reporte' });
  }
});

// ================== EXPORTAR A EXCEL ==================
app.get('/api/export-excel', authMiddleware, async (req, res) => {
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
    await logAction(req.user.username, 'Exportó reportes a Excel', '/api/export-excel');
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    res.status(500).json({ error: 'Error al exportar Excel' });
  }
});

// ================== BITÁCORA ==================
app.get('/api/bitacora', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bitacora ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener bitácora:', err);
    res.status(500).json({ error: 'Error al obtener bitácora' });
  }
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
