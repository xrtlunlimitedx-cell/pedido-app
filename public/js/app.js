const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  clientes: [], productos: [], usuarios: [],
  pedidoItems: [], clienteSeleccionado: null, currentSection: 'nuevo-pedido'
};

document.addEventListener('DOMContentLoaded', () => {
  if (state.token) { showApp(); } else { showLogin(); }
});

// ==================== AUTH ====================
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  setupUI();
  loadAll();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      state.token = data.token; state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showApp();
    } else { errEl.textContent = data.error; errEl.classList.remove('hidden'); }
  } catch { errEl.textContent = 'Error de conexión'; errEl.classList.remove('hidden'); }
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` };
}

async function api(method, url, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
  return res;
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  location.reload();
}

// ==================== UI SETUP ====================
function setupUI() {
  document.getElementById('user-display-name').textContent = state.user.nombre;
  const roleBadge = document.getElementById('user-display-role');
  roleBadge.textContent = state.user.rol;
  roleBadge.className = `badge badge-${state.user.rol}`;

  const navUsuarios = document.getElementById('nav-usuarios');
  if (state.user.rol !== 'admin') navUsuarios.classList.add('hidden');
  else navUsuarios.classList.remove('hidden');

  document.getElementById('btn-logout').addEventListener('click', logout);
  setupNavigation();
  setupAccordion();
  setupPedidoForm();
  setupModal();
}

function setupNavigation() {
  document.querySelectorAll('.nav-item:not(.hidden)').forEach(item => {
    item.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.dataset.section); });
  });
}

function navigateTo(section) {
  state.currentSection = section;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.add('active');
  if (section === 'clientes') loadClientes();
  if (section === 'productos') loadProductos();
  if (section === 'pedidos') loadPedidos();
  if (section === 'nuevo-pedido') loadProductosSelect();
  if (section === 'usuarios' && state.user.rol === 'admin') loadUsuarios();
  if (section === 'reportes') loadReportes();
}

function setupAccordion() {
  document.querySelectorAll('.accordion-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
  document.querySelector('.accordion')?.classList.add('open');
}

// ==================== LOAD ALL ====================
async function loadAll() { await Promise.all([loadClientes(), loadProductos()]); loadProductosSelect(); }

async function loadClientes() {
  try { const res = await api('GET', '/api/clientes'); state.clientes = await res.json(); if (state.currentSection === 'clientes') renderClientes(); } catch {}
}

function renderClientes() {
  const tbody = document.getElementById('clientes-body'); if (!tbody) return;
  tbody.innerHTML = state.clientes.map(c => `<tr><td>${c.id}</td><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.direccion)}</td><td>${esc(c.horario_atencion)}</td><td><button class="btn btn-sm btn-primary" onclick="editCliente(${c.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id})">🗑️</button></td></tr>`).join('');
}

async function loadProductos() {
  try { const res = await api('GET', '/api/productos'); state.productos = await res.json(); if (state.currentSection === 'productos') renderProductos(); } catch {}
}

function renderProductos() {
  const tbody = document.getElementById('productos-body'); if (!tbody) return;
  tbody.innerHTML = state.productos.map(p => `<tr><td>${p.id}</td><td><strong>${esc(p.nombre)}</strong></td><td>${p.cantidad_por_bulto} unid.</td><td><button class="btn btn-sm btn-primary" onclick="editProducto(${p.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteProducto(${p.id})">🗑️</button></td></tr>`).join('');
}

function loadProductosSelect() {
  const sel = document.getElementById('item-producto'); if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar producto...</option>' + state.productos.map(p => `<option value="${p.id}" data-cant="${p.cantidad_por_bulto}">${esc(p.nombre)} (${p.cantidad_por_bulto}/bulto)</option>`).join('');
}

async function loadUsuarios() {
  try { const res = await api('GET', '/api/usuarios'); state.usuarios = await res.json(); renderUsuarios(); } catch {}
}

function renderUsuarios() {
  const tbody = document.getElementById('usuarios-body'); if (!tbody) return;
  tbody.innerHTML = state.usuarios.map(u => `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.nombre)}</td><td><span class="badge badge-${u.rol}">${u.rol}</span></td><td><button class="btn btn-sm btn-primary" onclick="editUsuario(${u.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteUsuario(${u.id})">🗑️</button></td></tr>`).join('');
}

// ==================== CRUD CLIENTES ====================
function setupNuevoCliente() {
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
    openModal('Nuevo Cliente', `<div class="form-group"><label>Nombre</label><input type="text" id="modal-campo1" required></div><div class="form-group"><label>Dirección</label><input type="text" id="modal-campo2"></div><div class="form-group"><label>Horario</label><input type="text" id="modal-campo3" placeholder="Ej: Lun-Vie 9:00-18:00"></div>`, saveNewCliente);
  });
}
async function saveNewCliente() {
  const nombre = document.getElementById('modal-campo1').value.trim(); if (!nombre) { showToast('Nombre requerido', 'error'); return; }
  const res = await api('POST', '/api/clientes', { nombre, direccion: document.getElementById('modal-campo2').value.trim(), horario_atencion: document.getElementById('modal-campo3').value.trim() });
  if (res.ok) { closeModal(); showToast('Cliente guardado', 'success'); loadClientes(); }
}
async function editCliente(id) {
  const c = state.clientes.find(x => x.id === id); if (!c) return;
  openModal('Editar Cliente', `<input type="hidden" id="modal-edit-id" value="${c.id}"><div class="form-group"><label>Nombre</label><input type="text" id="modal-campo1" value="${esc(c.nombre)}"></div><div class="form-group"><label>Dirección</label><input type="text" id="modal-campo2" value="${esc(c.direccion)}"></div><div class="form-group"><label>Horario</label><input type="text" id="modal-campo3" value="${esc(c.horario_atencion)}"></div>`, saveEditCliente);
}
async function saveEditCliente() {
  await api('PUT', `/api/clientes/${document.getElementById('modal-edit-id').value}`, { nombre: document.getElementById('modal-campo1').value.trim(), direccion: document.getElementById('modal-campo2').value.trim(), horario_atencion: document.getElementById('modal-campo3').value.trim() });
  closeModal(); showToast('Cliente actualizado', 'success'); loadClientes();
}
async function deleteCliente(id) { if (!confirm('¿Eliminar cliente?')) return; await api('DELETE', `/api/clientes/${id}`); showToast('Eliminado', 'success'); loadClientes(); }

// ==================== CRUD PRODUCTOS ====================
function setupNuevoProducto() {
  document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    openModal('Nuevo Producto', `<div class="form-group"><label>Nombre</label><input type="text" id="modal-campo1" required></div><div class="form-group"><label>Cant. por Bulto</label><input type="number" id="modal-campo2" min="1" value="1"></div>`, saveNewProducto);
  });
}
async function saveNewProducto() {
  const nombre = document.getElementById('modal-campo1').value.trim(); if (!nombre) { showToast('Nombre requerido', 'error'); return; }
  const res = await api('POST', '/api/productos', { nombre, cantidad_por_bulto: parseInt(document.getElementById('modal-campo2').value) || 1 });
  if (res.ok) { closeModal(); showToast('Producto guardado', 'success'); loadProductos(); loadProductosSelect(); }
}
async function editProducto(id) {
  const p = state.productos.find(x => x.id === id); if (!p) return;
  openModal('Editar Producto', `<input type="hidden" id="modal-edit-id" value="${p.id}"><div class="form-group"><label>Nombre</label><input type="text" id="modal-campo1" value="${esc(p.nombre)}"></div><div class="form-group"><label>Cant. por Bulto</label><input type="number" id="modal-campo2" min="1" value="${p.cantidad_por_bulto}"></div>`, saveEditProducto);
}
async function saveEditProducto() {
  await api('PUT', `/api/productos/${document.getElementById('modal-edit-id').value}`, { nombre: document.getElementById('modal-campo1').value.trim(), cantidad_por_bulto: parseInt(document.getElementById('modal-campo2').value) || 1 });
  closeModal(); showToast('Producto actualizado', 'success'); loadProductos(); loadProductosSelect();
}
async function deleteProducto(id) { if (!confirm('¿Eliminar producto?')) return; await api('DELETE', `/api/productos/${id}`); showToast('Eliminado', 'success'); loadProductos(); loadProductosSelect(); }

// ==================== CRUD USUARIOS ====================
function setupNuevoUsuario() {
  document.getElementById('btn-nuevo-usuario').addEventListener('click', () => {
    openModal('Nuevo Usuario', `<div class="form-group"><label>Usuario</label><input type="text" id="modal-campo1" required></div><div class="form-group"><label>Contraseña</label><input type="password" id="modal-campo2" required></div><div class="form-group"><label>Nombre</label><input type="text" id="modal-campo3" required></div><div class="form-group"><label>Rol</label><select id="modal-campo4"><option value="vendedor">Vendedor</option><option value="admin">Admin</option></select></div>`, saveNewUsuario);
  });
}
async function saveNewUsuario() {
  const username = document.getElementById('modal-campo1').value.trim();
  const password = document.getElementById('modal-campo2').value;
  const nombre = document.getElementById('modal-campo3').value.trim();
  if (!username || !password || !nombre) { showToast('Complete todos los campos', 'error'); return; }
  const res = await api('POST', '/api/usuarios', { username, password, nombre, rol: document.getElementById('modal-campo4').value });
  if (res.ok) { closeModal(); showToast('Usuario creado', 'success'); loadUsuarios(); }
}
async function editUsuario(id) {
  const u = state.usuarios.find(x => x.id === id); if (!u) return;
  openModal('Editar Usuario', `<input type="hidden" id="modal-edit-id" value="${u.id}"><div class="form-group"><label>Usuario</label><input type="text" id="modal-campo1" value="${esc(u.username)}"></div><div class="form-group"><label>Nueva Contraseña (dejar vacío para no cambiar)</label><input type="password" id="modal-campo2"></div><div class="form-group"><label>Nombre</label><input type="text" id="modal-campo3" value="${esc(u.nombre)}"></div><div class="form-group"><label>Rol</label><select id="modal-campo4"><option value="vendedor" ${u.rol==='vendedor'?'selected':''}>Vendedor</option><option value="admin" ${u.rol==='admin'?'selected':''}>Admin</option></select></div>`, saveEditUsuario);
}
async function saveEditUsuario() {
  await api('PUT', `/api/usuarios/${document.getElementById('modal-edit-id').value}`, { username: document.getElementById('modal-campo1').value.trim(), password: document.getElementById('modal-campo2').value, nombre: document.getElementById('modal-campo3').value.trim(), rol: document.getElementById('modal-campo4').value });
  closeModal(); showToast('Usuario actualizado', 'success'); loadUsuarios();
}
async function deleteUsuario(id) { if (!confirm('¿Eliminar usuario?')) return; await api('DELETE', `/api/usuarios/${id}`); showToast('Eliminado', 'success'); loadUsuarios(); }

// ==================== PEDIDOS ====================
async function loadPedidos() {
  try { const res = await api('GET', '/api/pedidos'); const pedidos = await res.json(); renderPedidos(pedidos); } catch {}
}

function renderPedidos(pedidos) {
  const tbody = document.getElementById('pedidos-body'); if (!tbody) return;
  tbody.innerHTML = pedidos.map(p => `<tr><td><strong>PED-${String(p.id).padStart(4,'0')}</strong></td><td>${fmtDate(p.fecha)}</td><td>${esc(p.cliente_nombre)}</td><td>${esc(p.cliente_direccion)}</td><td>${esc(p.vendedor_nombre)}</td><td><strong>$ ${fmtNum(p.total)}</strong></td><td><span class="badge badge-${p.estado}">${cap(p.estado)}</span></td><td><button class="btn btn-sm btn-primary" onclick="viewPedido(${p.id})">👁️</button> <button class="btn btn-sm btn-success" onclick="changeEstado(${p.id},'entregado')">✅</button> <button class="btn btn-sm btn-danger" onclick="deletePedido(${p.id})">🗑️</button></td></tr>`).join('');
}

async function viewPedido(id) {
  try {
    const res = await api('GET', `/api/pedidos/${id}`);
    const pedido = await res.json();
    showPedidoDetail(pedido);
  } catch {}
}

function showPedidoDetail(pedido) {
  document.getElementById('pedido-detail-body').innerHTML = `
    <div class="pedido-print" id="pedido-print-content">
      <div class="pedido-print-header"><h2>PEDIDO #${String(pedido.id).padStart(4,'0')}</h2><p>Fecha: ${fmtDate(pedido.fecha)}</p></div>
      <div class="pedido-print-info">
        <div><strong>Cliente:</strong> ${esc(pedido.cliente_nombre)}</div>
        <div><strong>Vendedor:</strong> ${esc(pedido.vendedor_nombre)}</div>
        <div><strong>Dirección:</strong> ${esc(pedido.cliente_direccion)}</div>
        <div><strong>Horario:</strong> ${esc(pedido.cliente_horario)}</div>
      </div>
      <table><thead><tr><th>#</th><th>Producto</th><th>Bultos</th><th>Unid/Bulto</th><th>Precio/Unid</th><th>Total</th></tr></thead>
      <tbody>${pedido.items.map((it,i) => `<tr><td>${i+1}</td><td>${esc(it.producto_nombre)}</td><td>${it.cantidad_bultos}</td><td>${it.unidades_por_bulto}</td><td>$ ${fmtNum(it.precio_unidad)}</td><td>$ ${fmtNum(it.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5"><strong>TOTAL</strong></td><td><strong>$ ${fmtNum(pedido.total)}</strong></td></tr></tfoot></table>
      <div class="pedido-print-footer"><div class="firma-line">Firma del Vendedor</div><div class="firma-line">Firma del Cliente</div></div>
    </div>`;
  document.getElementById('pedido-detail-overlay').classList.remove('hidden');
  document.getElementById('btn-imprimir-pedido').onclick = () => printPedido();
  document.getElementById('pedido-detail-close').onclick = () => document.getElementById('pedido-detail-overlay').classList.add('hidden');
}

function printPedido() {
  const content = document.getElementById('pedido-print-content').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:20px;color:#1e293b}.pedido-print-header{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:3px double #1e293b}.pedido-print-header h2{font-size:1.4rem;margin-bottom:4px}.pedido-print-header p{color:#64748b;font-size:.9rem}.pedido-print-info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;background:#f8fafc;padding:16px;border-radius:8px}.pedido-print-info div{font-size:.9rem}table{width:100%;border-collapse:collapse;margin-bottom:16px}table th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:.85rem}table td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:.9rem}table tfoot td{font-weight:700;background:#f0fdf4;padding:12px;font-size:1rem}.pedido-print-footer{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.firma-line{border-top:1px solid #1e293b;padding-top:8px;text-align:center;font-size:.85rem;color:#64748b}@media print{body{padding:0}}</style></head><body>${content}</body></html>`);
  win.document.close(); setTimeout(() => win.print(), 300);
}

async function changeEstado(id, estado) { await api('PUT', `/api/pedidos/${id}/estado`, { estado }); showToast(`Estado: ${estado}`, 'success'); loadPedidos(); }
async function deletePedido(id) { if (!confirm('¿Eliminar pedido?')) return; await api('DELETE', `/api/pedidos/${id}`); showToast('Eliminado', 'success'); loadPedidos(); }

// ==================== NUEVO PEDIDO FORM ====================
function setupPedidoForm() {
  setupNuevoCliente(); setupNuevoProducto(); setupNuevoUsuario();
  const buscarInput = document.getElementById('buscar-cliente');
  const resultados = document.getElementById('cliente-resultados');
  buscarInput.addEventListener('input', () => {
    const q = buscarInput.value.toLowerCase().trim();
    if (!q) { resultados.classList.add('hidden'); return; }
    const filtered = state.clientes.filter(c => c.nombre.toLowerCase().includes(q));
    resultados.innerHTML = filtered.length === 0 ? '<div class="search-result-item"><span class="result-nombre">Sin resultados</span></div>' :
      filtered.map(c => `<div class="search-result-item" data-id="${c.id}"><div class="result-nombre">${esc(c.nombre)}</div><div class="result-direccion">${esc(c.direccion)}</div></div>`).join('');
    resultados.classList.remove('hidden');
    resultados.querySelectorAll('.search-result-item[data-id]').forEach(item => {
      item.addEventListener('click', () => seleccionarCliente(parseInt(item.dataset.id)));
    });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.client-search')) resultados.classList.add('hidden'); });
  document.getElementById('btn-deseleccionar-cliente').addEventListener('click', () => {
    state.clienteSeleccionado = null;
    document.getElementById('cliente-seleccionado').classList.add('hidden');
    document.getElementById('buscar-cliente').value = ''; document.getElementById('buscar-cliente').disabled = false;
  });
  document.getElementById('item-producto').addEventListener('change', () => {
    const p = state.productos.find(x => x.id === parseInt(document.getElementById('item-producto').value));
    document.getElementById('item-unidades').value = p ? p.cantidad_por_bulto : 1;
    updateItemPreview();
  });
  ['item-bultos', 'item-unidades', 'item-precio'].forEach(id => document.getElementById(id).addEventListener('input', updateItemPreview));
  document.getElementById('btn-agregar-item').addEventListener('click', addItem);
  document.getElementById('btn-guardar-pedido').addEventListener('click', guardarPedido);
  document.getElementById('btn-cancelar-pedido').addEventListener('click', cancelarPedido);
}

function seleccionarCliente(id) {
  const c = state.clientes.find(x => x.id === id); if (!c) return;
  state.clienteSeleccionado = c;
  document.getElementById('sel-cliente-nombre').textContent = c.nombre;
  document.getElementById('sel-cliente-direccion').textContent = c.direccion;
  document.getElementById('sel-cliente-horario').textContent = c.horario_atencion;
  document.getElementById('cliente-seleccionado').classList.remove('hidden');
  document.getElementById('cliente-resultados').classList.add('hidden');
  document.getElementById('buscar-cliente').value = c.nombre;
  document.getElementById('buscar-cliente').disabled = true;
}

function updateItemPreview() {
  const bultos = parseInt(document.getElementById('item-bultos').value) || 0;
  const unidades = parseInt(document.getElementById('item-unidades').value) || 0;
  const precio = parseFloat(document.getElementById('item-precio').value) || 0;
  document.getElementById('item-total-preview').value = `$ ${fmtNum(bultos * unidades * precio)}`;
}

function addItem() {
  const productoId = parseInt(document.getElementById('item-producto').value);
  const bultos = parseInt(document.getElementById('item-bultos').value) || 0;
  const unidades = parseInt(document.getElementById('item-unidades').value) || 0;
  const precio = parseFloat(document.getElementById('item-precio').value) || 0;
  if (!productoId) { showToast('Seleccione producto', 'error'); return; }
  if (bultos <= 0) { showToast('Bultos > 0', 'error'); return; }
  if (unidades <= 0) { showToast('Unidades > 0', 'error'); return; }
  if (precio <= 0) { showToast('Precio > 0', 'error'); return; }
  const producto = state.productos.find(p => p.id === productoId);
  state.pedidoItems.push({ producto_id: productoId, producto_nombre: producto.nombre, cantidad_bultos: bultos, unidades_por_bulto: unidades, precio_unidad: precio, total: bultos * unidades * precio });
  renderPedidoItems();
  document.getElementById('item-producto').value = ''; document.getElementById('item-bultos').value = 1;
  document.getElementById('item-unidades').value = 1; document.getElementById('item-precio').value = '';
  document.getElementById('item-total-preview').value = '$ 0.00';
}

function removeItem(i) { state.pedidoItems.splice(i, 1); renderPedidoItems(); }

function renderPedidoItems() {
  const tbody = document.getElementById('items-body');
  let granTotal = 0;
  tbody.innerHTML = state.pedidoItems.map((it, i) => {
    granTotal += it.total;
    return `<tr><td>${i+1}</td><td>${esc(it.producto_nombre)}</td><td>${it.cantidad_bultos}</td><td>${it.unidades_por_bulto}</td><td>$ ${fmtNum(it.precio_unidad)}</td><td><strong>$ ${fmtNum(it.total)}</strong></td><td><button class="btn btn-sm btn-danger" onclick="removeItem(${i})">✕</button></td></tr>`;
  }).join('');
  document.getElementById('pedido-total').innerHTML = `<strong>$ ${fmtNum(granTotal)}</strong>`;
}

async function guardarPedido() {
  if (!state.clienteSeleccionado) { showToast('Seleccione cliente', 'error'); return; }
  if (!state.pedidoItems.length) { showToast('Agregue items', 'error'); return; }
  try {
    const res = await api('POST', '/api/pedidos', { cliente_id: state.clienteSeleccionado.id, items: state.pedidoItems.map(it => ({ producto_id: it.producto_id, cantidad_bultos: it.cantidad_bultos, unidades_por_bulto: it.unidades_por_bulto, precio_unidad: it.precio_unidad })) });
    const data = await res.json();
    if (data.success) { showToast(`Pedido PED-${String(data.id).padStart(4,'0')} guardado`, 'success'); cancelarPedido(); }
    else showToast(data.error || 'Error', 'error');
  } catch { showToast('Error de conexión', 'error'); }
}

function cancelarPedido() {
  state.pedidoItems = []; state.clienteSeleccionado = null;
  document.getElementById('cliente-seleccionado').classList.add('hidden');
  document.getElementById('buscar-cliente').value = ''; document.getElementById('buscar-cliente').disabled = false;
  document.getElementById('items-body').innerHTML = '';
  document.getElementById('pedido-total').innerHTML = '<strong>$ 0.00</strong>';
  document.getElementById('item-producto').value = ''; document.getElementById('item-bultos').value = 1;
  document.getElementById('item-unidades').value = 1; document.getElementById('item-precio').value = '';
  document.getElementById('item-total-preview').value = '$ 0.00';
}

// ==================== REPORTES ====================
function loadReportes() {
  const now = new Date();
  document.getElementById('reporte-mes').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (state.user.rol === 'admin') {
    loadUsuarios().then(() => {
      const sel = document.getElementById('reporte-vendedor');
      sel.innerHTML = '<option value="">Todos</option>' + state.usuarios.map(u => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('');
    });
    document.getElementById('filtro-vendedor-group').classList.remove('hidden');
  } else {
    document.getElementById('filtro-vendedor-group').classList.add('hidden');
  }
  document.getElementById('btn-generar-reporte').onclick = generarReporte;
  generarReporte();
}

async function generarReporte() {
  const mes = document.getElementById('reporte-mes').value;
  const vendedor = document.getElementById('reporte-vendedor')?.value || '';
  let url = `/api/reportes/ventas?mes=${mes}`;
  if (vendedor) url += `&vendedor_id=${vendedor}`;
  try {
    const res = await api('GET', url);
    const data = await res.json();
    renderReportes(data);
  } catch { showToast('Error al generar reporte', 'error'); }
}

function renderReportes(data) {
  const container = document.getElementById('reportes-resultado');
  let html = '';
  // Summary cards
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">`;
  html += `<div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:0.85rem;color:#64748b;font-weight:600;">CANT. PEDIDOS</div>
    <div style="font-size:2rem;font-weight:700;color:#1e293b;">${data.cantidadPedidos}</div>
  </div>`;
  html += `<div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:0.85rem;color:#64748b;font-weight:600;">TOTAL VENTAS</div>
    <div style="font-size:2rem;font-weight:700;color:#059669;">$ ${fmtNum(data.totalGeneral)}</div>
  </div>`;
  html += `</div>`;

  // Por vendedor (admin only)
  if (data.porVendedor && data.porVendedor.length > 0) {
    html += `<div style="background:#fff;border-radius:10px;padding:20px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h3 style="margin-bottom:16px;color:#1e293b;">🏆 Ventas por Vendedor</h3>
      <table class="data-table"><thead><tr><th>Vendedor</th><th>Pedidos</th><th>Total</th><th>Rendimiento</th></tr></thead><tbody>`;
    const maxTotal = Math.max(...data.porVendedor.map(v => v.total), 1);
    data.porVendedor.forEach(v => {
      const pct = Math.round((v.total / maxTotal) * 100);
      html += `<tr><td><strong>${esc(v.nombre)}</strong></td><td>${v.cantidad}</td><td><strong>$ ${fmtNum(v.total)}</strong></td>
        <td><div style="background:#e2e8f0;border-radius:4px;height:20px;position:relative;min-width:100px;">
          <div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;border-radius:4px;width:${pct}%;"></div>
        </div></td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Pedidos detail
  html += `<div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h3 style="padding:16px 20px 0;color:#1e293b;">Detalle de Pedidos</h3>
    <table class="data-table"><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Estado</th></tr></thead><tbody>`;
  data.pedidos.forEach(p => {
    html += `<tr><td><strong>PED-${String(p.id).padStart(4,'0')}</strong></td><td>${fmtDate(p.fecha)}</td><td>${esc(p.cliente_nombre)}</td><td>${esc(p.vendedor_nombre)}</td><td><strong>$ ${fmtNum(p.total)}</strong></td><td><span class="badge badge-${p.estado}">${cap(p.estado)}</span></td></tr>`;
  });
  if (data.pedidos.length === 0) html += `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No hay pedidos para este período</td></tr>`;
  html += `</tbody></table></div>`;

  container.innerHTML = html;
}

// ==================== MODAL ====================
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-confirm').addEventListener('click', () => { if (state.modalCb) state.modalCb(); });
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
}
function openModal(title, html, cb) { document.getElementById('modal-title').textContent = title; document.getElementById('modal-body').innerHTML = html; state.modalCb = cb; document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); state.modalCb = null; }

// ==================== UTILS ====================
function showToast(msg, type = 'info') { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function fmtNum(n) { return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }