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

// ================== AUDITORÍA DE ERRORES ==================
async function logError(usuario, error, endpoint) {
  try {
    await pool.query(
      'INSERT INTO auditoria_errores (usuario, error, endpoint) VALUES ($1, $2, $3)',
      [usuario || 'Anónimo', error, endpoint]
    );
  } catch (err) {
    console.error('Error al registrar auditoría de errores:', err);
  }
}

// ================== MIDDLEWARE ==================
function authMiddleware(req, res, next) {
  let token;
  const header = req.headers['authorization'];
  if (header) {
    token = header.split(' ')[1];
  }
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

// ================== AUTH ==================
// Registro
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
    await logError(username, err.message, '/api/register');
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login
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
    await logError(username, err.message, '/api/login');
    res.status(500).json({ error: 'Error en login' });
  }
});

// ================== REPORTES ==================
// Obtener
app.get('/api/reportes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
    await logAction(req.user.username, 'Consulta de reportes', '/api/reportes');
    res.json(result.rows);
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/reportes');
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// Agregar
app.post('/api/reportes', authMiddleware, async (req, res) => {
  try {
    const { error, fecha, solicitud, proyecto, resultado, estado } = req.body;
    const result = await pool.query(
      `INSERT INTO reportes (error, fecha, solicitud, proyecto, resultado, estado, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [error, fecha, solicitud, proyecto, resultado, estado, req.user.id]
    );
    await logAction(req.user.username, `Agregó nuevo reporte (${error})`, '/api/reportes');
    res.json(result.rows[0]);
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/reportes');
    res.status(500).json({ error: 'Error al agregar reporte' });
  }
});

// Actualizar (dinámico)
app.put('/api/reportes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key}=$${idx}`);
      values.push(value);
      idx++;
    }
    values.push(id);
    const query = `UPDATE reportes SET ${setClauses.join(', ')} WHERE id=$${idx} RETURNING *;`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });
    await logAction(req.user.username, `Actualizó reporte ${id}`, '/api/reportes');
    res.json(result.rows[0]);
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/reportes');
    res.status(500).json({ error: 'Error al actualizar reporte' });
  }
});

// Eliminar
app.delete('/api/reportes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reportes WHERE id=$1', [id]);
    await logAction(req.user.username, `Eliminó reporte ${id}`, '/api/reportes');
    res.sendStatus(204);
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/reportes');
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
      { header: 'Error', key: 'error', width: 30 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Solicitud', key: 'solicitud', width: 20 },
      { header: 'Proyecto', key: 'proyecto', width: 20 },
      { header: 'Resultado', key: 'resultado', width: 30 },
      { header: 'Estado', key: 'estado', width: 15 }
    ];
    worksheet.addRows(result.rows);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename=reportes.xlsx');
    await workbook.xlsx.write(res);
    res.end();
    await logAction(req.user.username, 'Exportó reportes a Excel', '/api/export-excel');
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/export-excel');
    res.status(500).json({ error: 'Error al exportar Excel' });
  }
});

// ================== BITÁCORA (paginada) ==================
app.get('/api/bitacora', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const totalRes = await pool.query('SELECT COUNT(*) FROM bitacora');
    const total = parseInt(totalRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    const result = await pool.query(
      'SELECT * FROM bitacora ORDER BY fecha DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ data: result.rows, pagination: { total, page, limit, totalPages } });
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/bitacora');
    res.status(500).json({ error: 'Error al obtener bitácora' });
  }
});

// ================== AUDITORÍA DE ERRORES (paginada) ==================
app.get('/api/auditoria-errores', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const totalRes = await pool.query('SELECT COUNT(*) FROM auditoria_errores');
    const total = parseInt(totalRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    const result = await pool.query(
      'SELECT * FROM auditoria_errores ORDER BY fecha DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ data: result.rows, pagination: { total, page, limit, totalPages } });
  } catch (err) {
    await logError(req.user?.username, err.message, '/api/auditoria-errores');
    res.status(500).json({ error: 'Error al obtener auditoría de errores' });
  }
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
