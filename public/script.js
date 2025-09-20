let rawData = [];
let viewData = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ------- API helpers -------
async function apiGet() {
  const r = await fetch('/api/reports');
  if (!r.ok) throw new Error('No se pudo leer los reportes');
  return await r.json();
}

async function apiPost(record) {
  const r = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });
  if (!r.ok) throw new Error('No se pudo guardar el reporte');
  return await r.json();
}

async function apiPut(id, patch) {
  const r = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error('No se pudo actualizar el reporte');
  return await r.json();
}

async function apiDelete(id) {
  const r = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
      <td>${escapeHtml(r["Reporte (Error)"])}</td>
      <td>${escapeHtml(r["Fecha"])}</td>
      <td>${escapeHtml(r["Solicitud"])}</td>
      <td>${escapeHtml(r["Proyecto"])}</td>
      <td><div class="editable" contenteditable="true">${escapeHtml(r["Resultado"] || "")}</div></td>
      <td>
        <select class="form-select form-select-sm estado-select">
          <option value="Pendiente" ${r.Estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="Reportado" ${r.Estado === "Reportado" ? "selected" : ""}>Reportado</option>
          <option value="Resuelto" ${r.Estado === "Resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td>
        <button class="btn btn-sm btn-danger btn-delete">Eliminar</button>
      </td>
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
        const updated = await apiPut(id, { "Resultado": value });
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
        const updated = await apiPut(id, { "Estado": value });
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
        rawData = rawData.filter(r => r.id !== id);
        viewData = viewData.filter(r => r.id !== id);
        renderTable();
        populateFilters();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function updateLocalData(id, updated) {
  const idxR = rawData.findIndex(x => x.id === id);
  if (idxR >= 0) rawData[idxR] = updated;
  const idxV = viewData.findIndex(x => x.id === id);
  if (idxV >= 0) viewData[idxV] = updated;
}

function populateFilters() {
  const proyectos = uniqueSorted(rawData.map(r => r.Proyecto));
  const solicitudes = uniqueSorted(rawData.map(r => r.Solicitud));
  $('#filterProyecto').innerHTML = `<option value="">Todos</option>` + proyectos.map(p => `<option>${escapeHtml(p)}</option>`).join('');
  $('#filterSolicitud').innerHTML = `<option value="">Todas</option>` + solicitudes.map(s => `<option>${escapeHtml(s)}</option>`).join('');
}

function applyFilters() {
  const p = $('#filterProyecto').value.trim();
  const s = $('#filterSolicitud').value.trim();
  viewData = rawData.filter(r => (!p || r.Proyecto === p) && (!s || r.Solicitud === s));
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

// ------- Exportar a Excel -------
function exportExcel() {
  if (!rawData.length) return alert('No hay datos para exportar.');
  const ws = XLSX.utils.json_to_sheet(rawData.map(({id, ...r}) => r)); // quitar id en Excel
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reportes");
  XLSX.writeFile(wb, "reportes_QA.xlsx");
}

// ------- Agregar -------
async function addReport(e) {
  e.preventDefault();
  const nuevo = {
    "Reporte (Error)": $('#addReporte').value.trim(),
    "Fecha": $('#addFecha').value,
    "Solicitud": $('#addSolicitud').value.trim(),
    "Proyecto": $('#addProyecto').value.trim(),
    "Resultado": $('#addResultado').value.trim(),
    "Estado": $('#addEstado').value
  };

  if (!nuevo["Reporte (Error)"] || !nuevo["Fecha"] || !nuevo["Solicitud"] || !nuevo["Proyecto"]) {
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

// ------- Tema oscuro/claro con animación radial -------
function applyTheme(theme, x = null, y = null) {
  if (x && y) {
    document.body.style.setProperty('--click-x', `${x}px`);
    document.body.style.setProperty('--click-y', `${y}px`);
    document.body.classList.add('animating');
  }

  setTimeout(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
      $('#themeToggle').textContent = '🌙';
    } else {
      document.body.classList.remove('dark');
      $('#themeToggle').textContent = '🌞';
    }
    localStorage.setItem('theme', theme);
    document.body.classList.remove('animating');
  }, 300);
}

function toggleTheme(e) {
  const isDark = document.body.classList.contains('dark');
  const theme = isDark ? 'light' : 'dark';
  const rect = e.currentTarget.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  applyTheme(theme, x, y);
}

window.addEventListener('DOMContentLoaded', () => {
  boot();

  $('#filterForm').addEventListener('submit', e => { e.preventDefault(); applyFilters(); });
  $('#btnResetFilters').addEventListener('click', resetFilters);
  $('#btnExport').addEventListener('click', exportExcel);
  $('#addForm').addEventListener('submit', addReport);

  // aplicar tema guardado o sistema
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  $('#themeToggle').addEventListener('click', toggleTheme);
});
