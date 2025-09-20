const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

const DATA_PATH = path.join(__dirname, 'data.json');
const DATA_JS_PATH = path.join(__dirname, 'public', 'data.js'); // espejo opcional

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Utilidades ----------
async function readData() {
  try {
    const content = await fs.readFile(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('El archivo no es un array.');
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return []; // si no existe, devolvemos array vacío
    throw err;
  }
}

async function persistData(data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(DATA_PATH, json, 'utf-8');

  const jsContent = 'let DATA = ' + json + ';\n';
  await fs.writeFile(DATA_JS_PATH, jsContent, 'utf-8');
}

function genId() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function validateRecord(r) {
  const required = ["Reporte (Error)", "Fecha", "Solicitud", "Proyecto"];
  return required.every(k => r[k] && String(r[k]).trim() !== "");
}

// ---------- API ----------
app.get('/api/reports', async (_req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo leer data.json' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const body = req.body || {};
    const record = {
      id: genId(),
      "Reporte (Error)": body["Reporte (Error)"] ?? body.reporte ?? "",
      "Fecha": body["Fecha"] ?? body.fecha ?? "",
      "Solicitud": body["Solicitud"] ?? body.solicitud ?? "",
      "Proyecto": body["Proyecto"] ?? body.proyecto ?? "",
      "Resultado": body["Resultado"] ?? body.resultado ?? "",
      "Estado": body["Estado"] ?? body.estado ?? "Pendiente"
    };

    if (!validateRecord(record)) {
      return res.status(400).json({ error: "Campos obligatorios vacíos" });
    }

    const data = await readData();
    data.push(record);
    await persistData(data);
    res.status(201).json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo guardar el reporte' });
  }
});

app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    const data = await readData();
    const idx = data.findIndex(r => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

    const updated = { ...data[idx], ...patch };
    if (!validateRecord(updated)) {
      return res.status(400).json({ error: "Campos obligatorios vacíos" });
    }

    data[idx] = updated;
    await persistData(data);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar el reporte' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();
    const next = data.filter(r => r.id !== id);
    if (next.length === data.length) return res.status(404).json({ error: 'No encontrado' });

    await persistData(next);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo eliminar el reporte' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor arriba en http://localhost:${PORT}`);
});
