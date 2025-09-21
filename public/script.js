let rawData = [];
let viewData = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ------- API helpers -------
async function apiGet() {
  const token = localStorage.getItem("token");
  const r = await fetch('/api/reportes', {
    headers: { "Authorization": "Bearer " + token }
  });
  if (!r.ok) throw new Error('No se pudo leer los reportes');
  return await r.json();
}

async function apiPost(record) {
  const token = localStorage.getItem("token");
  const r = await fetch('/api/reportes', {
    method: 'POST',
    headers: { 
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(record)
  });
  if (!r.ok) throw new Error('No se pudo guardar el reporte');
  return await r.json();
}

async function apiPut(id, patch) {
  const token = localStorage.getItem("token");
  const r = await fetch(`/api/reportes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error('No se pudo actualizar el reporte');
  return await r.json();
}

async function apiDelete(id) {
  const token = localStorage.getItem("token");
  const r = await fetch(`/api/reportes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { "Authorization": "Bearer " + token }
  });
  if (!r.ok && r.status !== 204) throw new Error('No se pudo eliminar el reporte');
}

// ------- UI -------
function renderTable() {
  const tbody = $('#reportTable tbody');
  if (!viewData.length) {
    tbody.innerHTML = '';
    $('#emptyState').classList.remove('d-none');
    return;
  }
  $('#emptyState').classList.add('d-none');

  tbody.innerHTML = viewData.map(r => `
    <tr data-id="${r.id}">
      <td>${escapeHtml(r.reporte)}</td>
      <td>${escapeHtml(r.fecha)}</td>
      <td>${escapeHtml(r.solicitud)}</td>
      <td>${escapeHtml(r.proyecto)}</td>
      <td><div class="editable" contenteditable="true">${escapeHtml(r.resultado || "")}</div></td>
      <td>
        <select class="form-select form-select-sm estado-select">
          <option value="Pendiente" ${r.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="Reportado" ${r.estado === "Reportado" ? "selected" : ""}>Reportado</option>
          <option value="Resuelto" ${r.estado === "Resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-danger btn-delete">Eliminar</button></td>
    </tr>
  `).join('');

  // inline edit Resultado
  $$('#reportTable .editable').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
    el.addEventListener('blur', async () => {
      const tr = el.closest('tr');
      const id = tr.getAttribute('data-id');
      const value = el.innerText.trim();
      try {
        const updated = await apiPut(id, { resultado: value });
        updateLocalData(id, updated);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // cambiar estado
  $$('#reportTable .estado-select').forEach((el) => {
    el.addEventListener('change', async () => {
      const tr = el.closest('tr');
      const id = tr.getAttribute('data-id');
      const value = el.value;
      try {
        const updated = await apiPut(id, { estado: value });
        updateLocalData(id, updated);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // eliminar
  $$('#reportTable .btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const id = tr.getAttribute('data-id');
      if (!confirm('¿Seguro que deseas eliminar este reporte?')) return;
      try {
        await apiDelete(id);
        rawData = rawData.filter(r => String(r.id) !== String(id));
        viewData = viewData.filter(r => String(r.id) !== String(id));
        renderTable();
        populateFilters();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function updateLocalData(id, updated) {
  const idxR = rawData.findIndex(x => String(x.id) === String(id));
  if (idxR >= 0) rawData[idxR] = updated;
  const idxV = viewData.findIndex(x => String(x.id) === String(id));
  if (idxV >= 0) viewData[idxV] = updated;
}

function populateFilters() {
  const proyectos = uniqueSorted(rawData.map(r => r.proyecto));
  const solicitudes = uniqueSorted(rawData.map(r => r.solicitud));
  $('#filterProyecto').innerHTML = `<option value="">Todos</option>` + proyectos.map(p => `<option>${escapeHtml(p)}</option>`).join('');
  $('#filterSolicitud').innerHTML = `<option value="">Todas</option>` + solicitudes.map(s => `<option>${escapeHtml(s)}</option>`).join('');
}

function applyFilters() {
  const p = $('#filterProyecto').value.trim();
  const s = $('#filterSolicitud').value.trim();
  viewData = rawData.filter(r => (!p || r.proyecto === p) && (!s || r.solicitud === s));
  renderTable();
}

function resetFilters() {
  $('#filterProyecto').value = '';
  $('#filterSolicitud').value = '';
  viewData = [...rawData];
  renderTable();
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function uniqueSorted(values){
  return [...new Set(values.filter(Boolean))].sort((a,b)=> (''+a).localeCompare((''+b), 'es', {numeric:true, sensitivity:'base'}));
}

// ------- Agregar -------
async function addReport(e) {
  e.preventDefault();
  const nuevo = {
    reporte: $('#addReporte').value.trim(),
    fecha: $('#addFecha').value,
    solicitud: $('#addSolicitud').value.trim(),
    proyecto: $('#addProyecto').value.trim(),
    resultado: $('#addResultado').value.trim(),
    estado: $('#addEstado').value
  };

  if (!nuevo.reporte || !nuevo.fecha || !nuevo.solicitud || !nuevo.proyecto) {
    alert("Todos los campos excepto Resultado son obligatorios.");
    return;
  }

  try {
    const saved = await apiPost(nuevo);
    rawData.push(saved);
    viewData = [...rawData];
    renderTable();
    populateFilters();
    e.target.reset();
    $('#addEstado').value = "Pendiente"; // reset select
  } catch (err) {
    alert(err.message);
  }
}

// ------- Boot -------
async function boot() {
  try {
    rawData = await apiGet();
    viewData = [...rawData];
    populateFilters();
    renderTable();
  } catch (err) {
    alert(err.message);
  }
}

// ------- Tema oscuro/claro -------
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    $('#themeToggle').textContent = '🌙';
  } else {
    document.body.classList.remove('dark');
    $('#themeToggle').textContent = '🌞';
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const theme = isDark ? 'light' : 'dark';
  applyTheme(theme);
}

window.addEventListener('DOMContentLoaded', () => {
  boot();

  $('#filterForm').addEventListener('submit', e => { e.preventDefault(); applyFilters(); });
  $('#btnResetFilters').addEventListener('click', resetFilters);
  $('#addForm').addEventListener('submit', addReport);

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
  $('#themeToggle').addEventListener('click', toggleTheme);

  // Exportar a Excel con token
  $('#btnExport').addEventListener('click', () => {
  if (!rawData.length) {
    alert('No hay datos para exportar.');
    return;
  }
  const token = localStorage.getItem("token");
  window.location.href = `/api/export-excel?token=${token}`;
});

});
