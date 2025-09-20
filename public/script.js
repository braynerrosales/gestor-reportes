// === Estado en memoria ===
let rawData = [];
let viewData = [];

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === API helpers ===
async function apiGet() {
  const r = await fetch('/api/reports');
  if (!r.ok) throw new Error('No se pudo leer los reportes');
  return await r.json();
}

async function apiPost(record) {
  const r = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!r.ok) throw new Error('No se pudo guardar el reporte');
  return await r.json();
}

async function apiPut(id, record) {
  const r = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!r.ok) throw new Error('No se pudo actualizar el reporte');
  return await r.json();
}

async function apiDelete(id) {
  const r = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 204) throw new Error('No se pudo eliminar el reporte');
}

// === Utilidades ===
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function uniqueSorted(values){
  return [...new Set(values.filter(Boolean))].sort((a,b)=> (''+a).localeCompare((''+b),'es',{numeric:true,sensitivity:'base'}));
}

// Extrae todos los valores necesarios de una fila (para PUT completo)
function getRowPayload(tr) {
  const id        = tr.getAttribute('data-id');
  const reporte   = tr.children[0].textContent.trim();
  const fecha     = tr.children[1].textContent.trim();
  const solicitud = tr.children[2].textContent.trim();
  const proyecto  = tr.children[3].textContent.trim();
  const resultado = tr.querySelector('.editable')?.innerText.trim() ?? '';
  const estado    = tr.querySelector('.estado-select')?.value ?? 'Pendiente';
  return { id, reporte, fecha, solicitud, proyecto, resultado, estado };
}

// Sincroniza el objeto actualizado en los arrays locales
function updateLocalData(id, updated) {
  const i1 = rawData.findIndex(x => String(x.id) === String(id));
  if (i1 >= 0) rawData[i1] = updated;
  const i2 = viewData.findIndex(x => String(x.id) === String(id));
  if (i2 >= 0) viewData[i2] = updated;
}

// === Render de tabla ===
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
          <option value="Resuelto"  ${r.estado === "Resuelto"  ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-danger btn-delete">Eliminar</button></td>
    </tr>
  `).join('');

  // Editar "resultado" (blur o Enter)
  $$('#reportTable .editable').forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); }});
    el.addEventListener('blur', async () => {
      const tr = el.closest('tr');
      const payload = getRowPayload(tr);
      try {
        const updated = await apiPut(payload.id, payload);
        updateLocalData(payload.id, updated);
      } catch (err) { alert(err.message); }
    });
  });

  // Cambiar estado
  $$('#reportTable .estado-select').forEach((el) => {
    el.addEventListener('change', async () => {
      const tr = el.closest('tr');
      const payload = getRowPayload(tr);
      try {
        const updated = await apiPut(payload.id, payload);
        updateLocalData(payload.id, updated);
      } catch (err) { alert(err.message); }
    });
  });

  // Eliminar
  $$('#reportTable .btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr  = btn.closest('tr');
      const id  = tr.getAttribute('data-id');
      if (!confirm('¿Seguro que deseas eliminar este reporte?')) return;
      try {
        await apiDelete(id);
        rawData  = rawData.filter(r => String(r.id) !== String(id));
        viewData = viewData.filter(r => String(r.id) !== String(id));
        renderTable();
        populateFilters();
      } catch (err) { alert(err.message); }
    });
  });
}

// === Filtros ===
function populateFilters() {
  const proyectos  = uniqueSorted(rawData.map(r => r.proyecto));
  const solicitudes= uniqueSorted(rawData.map(r => r.solicitud));
  $('#filterProyecto').innerHTML  = `<option value="">Todos</option>` + proyectos.map(p => `<option>${escapeHtml(p)}</option>`).join('');
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

// === Agregar ===
async function addReport(e) {
  e.preventDefault();
  const nuevo = {
    reporte:   $('#addReporte').value.trim(),
    fecha:     $('#addFecha').value,
    solicitud: $('#addSolicitud').value.trim(),
    proyecto:  $('#addProyecto').value.trim(),
    resultado: $('#addResultado').value.trim(),
    estado:    $('#addEstado').value
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
    $('#addEstado').value = "Pendiente";
  } catch (err) {
    alert(err.message);
  }
}

// === Boot ===
async function boot() {
  try {
    rawData  = await apiGet();
    viewData = [...rawData];
    populateFilters();
    renderTable();
  } catch (err) {
    alert(err.message);
  }
}

// === Tema claro/oscuro con animación radial ===
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
  const theme  = isDark ? 'light' : 'dark';
  const rect   = e.currentTarget.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top  + rect.height/ 2;
  applyTheme(theme, x, y);
}

// === Listeners ===
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

  // Si no hay datos, evitar export vacío
  $('#btnExport')?.addEventListener('click', (e) => {
    if (!rawData.length) {
      e.preventDefault();
      alert('No hay datos para exportar.');
    }
  });
});
