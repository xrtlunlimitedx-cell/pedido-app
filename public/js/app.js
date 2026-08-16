const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  clientes: [], productos: [], usuarios: [],
  pedidoItems: [], clienteSeleccionado: null, currentSection: 'nuevo-pedido',
  editandoPedidoId: null  // null = modo creación | ID = modo edición de ese pedido
};

document.addEventListener('DOMContentLoaded', () => {
  // Estado inconsistente: hay token pero no hay datos de usuario.
  // (pasa si se invalidó la sesión en el server, p.ej. cold-start de Render)
  // En lugar de crashear, limpiamos y mandamos a login.
  if (state.token && !state.user) {
    state.token = null;
    localStorage.removeItem('token');
  }
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
  const navLogistica = document.getElementById('nav-logistica');
  const navTareas = document.getElementById('nav-tareas');
  if (state.user.rol !== 'admin') {
    navUsuarios.classList.add('hidden'); navLogistica.classList.add('hidden'); navTareas.classList.add('hidden');
  } else {
    navUsuarios.classList.remove('hidden'); navLogistica.classList.remove('hidden'); navTareas.classList.remove('hidden');
    checkUrgentCount();
  }

  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('mobile-logout-btn')?.addEventListener('click', logout);
  setupNavigation();
  setupAccordion();
  setupPedidoForm();
  setupModal();
}

function setupNavigation() {
  // Hamburger menu
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const closeSidebar = () => { sidebar.classList.remove('sidebar-open'); overlay.classList.remove('active'); };
  hamburger.addEventListener('click', () => { sidebar.classList.toggle('sidebar-open'); overlay.classList.toggle('active'); });
  overlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => { e.preventDefault(); navigateTo(item.dataset.section); closeSidebar(); });
  });
}

function navigateTo(section) {
  state.currentSection = section;
  // Update mobile header title
  const titles = {'nuevo-pedido':'Nuevo Pedido','pedidos':'Pedidos','clientes':'Clientes','productos':'Productos','reportes':'Reportes','usuarios':'Usuarios','logistica':'Logística','tareas':'Planificación'};
  const mobileTitle = document.getElementById('mobile-section-title');
  if (mobileTitle) mobileTitle.textContent = titles[section] || '';
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
  if (section === 'logistica' && state.user.rol === 'admin') loadLogistica();
  if (section === 'tareas' && state.user.rol === 'admin') loadTareas();
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
  const statusBtns = [
    { val: 'pendiente', lbl: '⏳ Pend.' }, { val: 'entregado', lbl: '✅ Entr.' },
    { val: 'entregado-pagado', lbl: '💰 Pagado' }, { val: 'entregado-firmado', lbl: '📝 Firmado' },
    { val: 'entregado-transferido', lbl: '🏦 Transf.' }, { val: 'cancelado', lbl: '❌ Canc.' }
  ];
  tbody.innerHTML = pedidos.map(p => {
    const badgeLabel = {'pendiente':'Pendiente','entregado':'Entregado','entregado-pagado':'Entregado (Pagado)','entregado-firmado':'Entregado (Firmado)','entregado-transferido':'Entregado (Transferido)','cancelado':'Cancelado'};
    return `<tr><td><strong>PED-${String(p.id).padStart(4,'0')}</strong></td><td>${fmtDate(p.fecha)}</td><td>${esc(p.cliente_nombre)}</td><td>${esc(p.cliente_direccion)}</td><td>${esc(p.vendedor_nombre)}</td><td><strong>$ ${fmtNum(p.total)}</strong></td><td><span class="badge badge-${p.estado.replace(/-/g,'-')}">${badgeLabel[p.estado]||cap(p.estado)}</span>${p.comentarios?' <span title="'+esc(p.comentarios)+'">💬</span>':''}</td><td class="actions-cell"><div class="actions-row"><button class="btn btn-sm btn-primary" onclick="viewPedido(${p.id})" title="Ver">👁️</button> <button class="btn btn-sm btn-warning" onclick="editPedido(${p.id})" title="Editar">✏️</button> <button class="btn btn-sm btn-info" onclick="comentariosPedido(${p.id})" title="Comentarios">💬</button> <button class="btn btn-sm btn-success" onclick="statusPedido(${p.id},'${p.estado}')" title="Cambiar Estado">🔄</button> <button class="btn btn-sm btn-danger" onclick="deletePedido(${p.id})" title="Eliminar">🗑️</button></div></td></tr>`;
  }).join('');
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

// ===== Ticket térmico 58mm: página a medida, solo negro puro (sin ajustes al imprimir) =====
function printPedidoTermico(pedido) {
  const num = String(pedido.id).padStart(4, '0');
  const items = pedido.items.map((it, i) => `
    <div class="item">
      <div class="nombre">${i + 1}. ${esc(it.producto_nombre)}</div>
      <div class="linea"><span>${it.cantidad_bultos} bx ${it.unidades_por_bulto}u - $${fmtNum(it.precio_unidad)} c/u</span><span>$${fmtNum(it.total)}</span></div>
    </div>`).join('');
  const css = `
    @page { size: 58mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 58mm; }
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: 9px; line-height: 1.4; color: #000; padding: 3mm 5mm 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .barra { background: #000; color: #fff; font-weight: 700; padding: 4px 6px; text-align: center; }
    .barra-pedido { font-size: 10px; letter-spacing: 1px; }
    .barra-total { font-size: 11px; display: flex; justify-content: space-between; margin-top: 4px; padding: 4px 5px; }
    .fecha { text-align: center; margin: 2px 0; }
    .fila { display: flex; justify-content: space-between; gap: 4px; }
    .fila .etiqueta { font-weight: 700; white-space: nowrap; }
    .fila .valor { text-align: right; word-break: break-word; }
    .sep { border-top: 1px dashed #000; margin: 3px 0; }
    .item { margin: 2px 0; }
    .nombre { font-weight: 700; word-break: break-word; }
    .linea { display: flex; justify-content: space-between; gap: 4px; }
    .firma { margin-top: 28px; text-align: center; }
    .firma-linea { border-top: 1.5px solid #000; padding-top: 3px; }
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pedido #${num}</title><style>${css}</style></head><body>
    <div class="barra barra-pedido">PEDIDO #${num}</div>
    <div class="fecha">${fmtDate(pedido.fecha)}</div>
    <div class="fila"><span class="etiqueta">Cliente:</span><span class="valor">${esc(pedido.cliente_nombre)}</span></div>
    <div class="fila"><span class="etiqueta">Direcc.:</span><span class="valor">${esc(pedido.cliente_direccion)}</span></div>
    <div class="fila"><span class="etiqueta">Vendedor:</span><span class="valor">${esc(pedido.vendedor_nombre)}</span></div>
    <div class="sep"></div>
    ${items}
    <div class="barra barra-total"><span>TOTAL</span><span>$${fmtNum(pedido.total)}</span></div>
    <div class="firma"><div class="firma-linea">Firma del Cliente</div></div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

async function changeEstado(id, estado) { await api('PUT', `/api/pedidos/${id}/estado`, { estado }); showToast('Estado actualizado', 'success'); loadPedidos(); }
async function deletePedido(id) { if (!confirm('¿Eliminar pedido?')) return; await api('DELETE', `/api/pedidos/${id}`); showToast('Eliminado', 'success'); loadPedidos(); }

// Comments modal
async function comentariosPedido(id) {
  try {
    const res = await api('GET', `/api/pedidos/${id}`);
    const pedido = await res.json();
    openModal('💬 Comentarios / Observaciones', `
      <input type="hidden" id="modal-edit-id" value="${pedido.id}">
      <div style="margin-bottom:12px;padding:12px;background:#f8fafc;border-radius:8px;font-size:0.85rem;">
        <strong>PED-${String(pedido.id).padStart(4,'0')}</strong> — ${esc(pedido.cliente_nombre)} — $ ${fmtNum(pedido.total)}
      </div>
      <div class="form-group">
        <label>Comentarios / Observaciones</label>
        <textarea id="modal-comentarios" rows="5" style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:6px;font-size:0.9rem;resize:vertical;" placeholder="Agregar comentarios u observaciones sobre este pedido...">${esc(pedido.comentarios||'')}</textarea>
      </div>
    `, async () => {
      const txt = document.getElementById('modal-comentarios').value;
      await api('PUT', `/api/pedidos/${document.getElementById('modal-edit-id').value}/comentarios`, { comentarios: txt });
      closeModal(); showToast('Comentarios guardados', 'success'); loadPedidos();
    });
  } catch {}
}

// Status change modal
function statusPedido(id, currentStatus) {
  const statuses = [
    { val: 'pendiente', lbl: '⏳ Pendiente', color: '#f59e0b' },
    { val: 'entregado', lbl: '✅ Entregado', color: '#22c55e' },
    { val: 'entregado-pagado', lbl: '💰 Entregado (Pagado)', color: '#3b82f6' },
    { val: 'entregado-firmado', lbl: '📝 Entregado (Firmado)', color: '#8b5cf6' },
    { val: 'entregado-transferido', lbl: '🏦 Entregado (Transferido)', color: '#06b6d4' },
    { val: 'cancelado', lbl: '❌ Cancelado', color: '#ef4444' }
  ];
  const btns = statuses.map(s =>
    `<button class="btn${s.val===currentStatus?' btn-current':''}" style="display:flex;align-items:center;gap:8px;width:100%;padding:12px;margin-bottom:8px;background:${s.val===currentStatus?s.color+'22':'#f8fafc'};border:2px solid ${s.val===currentStatus?s.color:'#e2e8f0'};border-radius:8px;cursor:pointer;font-size:0.95rem;${s.val===currentStatus?'font-weight:700;':''}" onclick="changeEstado(${id},'${s.val}');closeModal();">${s.lbl}</button>`
  ).join('');
  openModal('🔄 Cambiar Estado del Pedido', `
    <div style="margin-bottom:12px;font-size:0.85rem;color:#64748b;">Seleccione el nuevo estado:</div>
    ${btns}
  `, null);
  document.getElementById('modal-footer').classList.add('hidden');
  const restoreFooter = () => { document.getElementById('modal-footer').classList.remove('hidden'); };
  document.getElementById('modal-close').addEventListener('click', restoreFooter, { once: true });
  document.getElementById('modal-cancel').addEventListener('click', restoreFooter, { once: true });
}

// Edit order - loads order into edit mode
async function editPedido(id) {
  try {
    const res = await api('GET', `/api/pedidos/${id}`);
    const pedido = await res.json();
    // Navigate to nuevo-pedido and populate
    navigateTo('nuevo-pedido');
    state.pedidoItems = pedido.items.map(it => ({
      producto_id: it.producto_id, producto_nombre: it.producto_nombre,
      cantidad_bultos: it.cantidad_bultos, unidades_por_bulto: it.unidades_por_bulto,
      precio_unidad: it.precio_unidad, total: it.total
    }));
    seleccionarCliente(pedido.cliente_id);
    renderPedidoItems();
    // Activar modo edición: el flag le dice al handler unificado que haga PUT en vez de POST
    state.editandoPedidoId = id;
    document.getElementById('btn-guardar-pedido').textContent = '💾 Actualizar Pedido';
    showToast(`Editando PED-${String(id).padStart(4,'0')}`, 'info');
  } catch {}
}

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
  const payload = {
    cliente_id: state.clienteSeleccionado.id,
    items: state.pedidoItems.map(it => ({ producto_id: it.producto_id, cantidad_bultos: it.cantidad_bultos, unidades_por_bulto: it.unidades_por_bulto, precio_unidad: it.precio_unidad }))
  };
  try {
    let res, data;
    if (state.editandoPedidoId) {
      // Modo edición: PUT al pedido existente (no crea duplicado)
      res = await api('PUT', `/api/pedidos/${state.editandoPedidoId}`, payload);
      data = await res.json();
      if (data.success) { showToast(`Pedido PED-${String(state.editandoPedidoId).padStart(4,'0')} actualizado`, 'success'); cancelarPedido(); navigateTo('pedidos'); }
      else showToast(data.error || 'Error', 'error');
    } else {
      // Modo creación: POST de un pedido nuevo
      res = await api('POST', '/api/pedidos', payload);
      data = await res.json();
      if (data.success) { showToast(`Pedido PED-${String(data.id).padStart(4,'0')} guardado`, 'success'); cancelarPedido(); }
      else showToast(data.error || 'Error', 'error');
    }
  } catch { showToast('Error de conexión', 'error'); }
}

function cancelarPedido() {
  state.pedidoItems = []; state.clienteSeleccionado = null; state.editandoPedidoId = null;
  document.getElementById('cliente-seleccionado').classList.add('hidden');
  document.getElementById('buscar-cliente').value = ''; document.getElementById('buscar-cliente').disabled = false;
  document.getElementById('items-body').innerHTML = '';
  document.getElementById('pedido-total').innerHTML = '<strong>$ 0.00</strong>';
  document.getElementById('item-producto').value = ''; document.getElementById('item-bultos').value = 1;
  document.getElementById('item-unidades').value = 1; document.getElementById('item-precio').value = '';
  document.getElementById('item-total-preview').value = '$ 0.00';
  // Restaurar botón a modo creación (puede haber quedado en "Actualizar" tras editar)
  document.getElementById('btn-guardar-pedido').textContent = '✅ Guardar Pedido';
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
    // El botón de descarga PDF es exclusivo del admin
    const btnPdf = document.getElementById('btn-descargar-pdf');
    btnPdf.classList.remove('hidden');
    btnPdf.onclick = descargarReportePDF;
  } else {
    document.getElementById('filtro-vendedor-group').classList.add('hidden');
    document.getElementById('btn-descargar-pdf').classList.add('hidden');
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

// Descarga el reporte actual como PDF (solo admin).
// Refleja los mismos filtros (mes + vendedor) que el reporte en pantalla.
async function descargarReportePDF() {
  const mes = document.getElementById('reporte-mes').value;
  const vendedor = document.getElementById('reporte-vendedor')?.value || '';
  let url = `/api/reportes/ventas/pdf?mes=${mes}`;
  if (vendedor) url += `&vendedor_id=${vendedor}`;
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 404) { showToast('No hay pedidos para exportar en este período', 'error'); return; }
    if (res.status === 403) { showToast('Solo el admin puede exportar PDF', 'error'); return; }
    if (!res.ok) { showToast('Error al generar el PDF', 'error'); return; }
    // El navegador recibió un PDF binario (Blob)
    const blob = await res.blob();
    // Disparar la descarga con el nombre del mes
    const nombreArchivo = `ventas-${mes || 'todas'}.pdf`;
    const enlace = document.createElement('a');
    enlace.href = window.URL.createObjectURL(blob);
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    window.URL.revokeObjectURL(enlace.href);
    showToast(`PDF descargado: ${nombreArchivo}`, 'success');
  } catch {
    showToast('Error de conexión al descargar el PDF', 'error');
  }
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

// ==================== LOGISTICA ====================
async function loadLogistica() {
  try {
    const res = await api('GET', '/api/logistica');
    const items = await res.json();
    renderLogistica(items);
  } catch {}
  document.getElementById('btn-nueva-logistica').onclick = nuevaLogistica;
}

function renderLogistica(items) {
  const tbody = document.getElementById('logistica-body');
  const estBadge = {'pendiente':'Pendiente','en-proceso':'En Proceso','finalizado':'Finalizado','cancelado':'Cancelado'};
  tbody.innerHTML = items.map(l => `<tr>
    <td>${l.id}</td><td><strong>${esc(l.cliente)}</strong></td><td>${fmtDate(l.fecha)}</td>
    <td>${l.horas}</td><td>$ ${fmtNum(l.valor_hora)}</td><td>${esc(l.ayudante)}</td>
    <td><strong>$ ${fmtNum(l.total)}</strong></td>
    <td><span class="badge badge-${l.estado}">${estBadge[l.estado]||cap(l.estado)}</span></td>
    <td><button class="btn btn-sm btn-primary" onclick="editLogistica(${l.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteLogistica(${l.id})">🗑️</button></td>
  </tr>`).join('');
}

function nuevaLogistica() {
  openModal('🚛 Nuevo Registro de Logística', `
    <div class="form-group"><label>Cliente</label><input type="text" id="modal-campo1" required placeholder="Nombre del cliente"></div>
    <div class="form-group"><label>Fecha</label><input type="date" id="modal-campo2" value="${new Date().toISOString().split('T')[0]}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label>Horas trabajadas</label><input type="number" id="modal-campo3" min="0" step="0.5" value="0"></div>
      <div class="form-group"><label>Valor por hora ($)</label><input type="number" id="modal-campo4" min="0" step="0.01" value="0"></div>
    </div>
    <div class="form-group"><label>Ayudante</label><input type="text" id="modal-campo5" placeholder="Nombre del ayudante (opcional)"></div>
    <div class="form-group"><label>Observaciones</label><textarea id="modal-campo6" rows="3" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;resize:vertical;" placeholder="Observaciones..."></textarea></div>
  `, async () => {
    const cliente = document.getElementById('modal-campo1').value.trim();
    if (!cliente) { showToast('Cliente requerido', 'error'); return; }
    const res = await api('POST', '/api/logistica', {
      cliente, fecha: document.getElementById('modal-campo2').value,
      horas: parseFloat(document.getElementById('modal-campo3').value) || 0,
      valor_hora: parseFloat(document.getElementById('modal-campo4').value) || 0,
      ayudante: document.getElementById('modal-campo5').value.trim(),
      observaciones: document.getElementById('modal-campo6').value.trim()
    });
    if (res.ok) { closeModal(); showToast('Registro guardado', 'success'); loadLogistica(); }
  });
}

async function editLogistica(id) {
  try {
    const res = await api('GET', '/api/logistica');
    const items = await res.json();
    const l = items.find(x => x.id === id); if (!l) return;
    openModal('✏️ Editar Registro', `
      <input type="hidden" id="modal-edit-id" value="${l.id}">
      <div class="form-group"><label>Cliente</label><input type="text" id="modal-campo1" value="${esc(l.cliente)}"></div>
      <div class="form-group"><label>Fecha</label><input type="date" id="modal-campo2" value="${l.fecha.split('T')[0]}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label>Horas</label><input type="number" id="modal-campo3" min="0" step="0.5" value="${l.horas}"></div>
        <div class="form-group"><label>$/Hora</label><input type="number" id="modal-campo4" min="0" step="0.01" value="${l.valor_hora}"></div>
      </div>
      <div class="form-group"><label>Ayudante</label><input type="text" id="modal-campo5" value="${esc(l.ayudante)}"></div>
      <div class="form-group"><label>Estado</label><select id="modal-campo7">
        <option value="pendiente" ${l.estado==='pendiente'?'selected':''}>Pendiente</option>
        <option value="en-proceso" ${l.estado==='en-proceso'?'selected':''}>En Proceso</option>
        <option value="finalizado" ${l.estado==='finalizado'?'selected':''}>Finalizado</option>
        <option value="cancelado" ${l.estado==='cancelado'?'selected':''}>Cancelado</option>
      </select></div>
      <div class="form-group"><label>Observaciones</label><textarea id="modal-campo6" rows="3" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;resize:vertical;">${esc(l.observaciones)}</textarea></div>
    `, async () => {
      await api('PUT', `/api/logistica/${document.getElementById('modal-edit-id').value}`, {
        cliente: document.getElementById('modal-campo1').value.trim(),
        fecha: document.getElementById('modal-campo2').value,
        horas: parseFloat(document.getElementById('modal-campo3').value) || 0,
        valor_hora: parseFloat(document.getElementById('modal-campo4').value) || 0,
        ayudante: document.getElementById('modal-campo5').value.trim(),
        estado: document.getElementById('modal-campo7').value,
        observaciones: document.getElementById('modal-campo6').value.trim()
      });
      closeModal(); showToast('Actualizado', 'success'); loadLogistica();
    });
  } catch {}
}

async function deleteLogistica(id) { if (!confirm('¿Eliminar registro?')) return; await api('DELETE', `/api/logistica/${id}`); showToast('Eliminado', 'success'); loadLogistica(); }

// ==================== TAREAS / PLANIFICACION ====================
let tareasData = [];

async function checkUrgentCount() {
  try {
    const res = await api('GET', '/api/tareas/urgent-count');
    const data = await res.json();
    const badge = document.getElementById('urgent-badge');
    if (data.count > 0) { badge.textContent = data.count; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  } catch {}
}

async function loadTareas() {
  try {
    const res = await api('GET', '/api/tareas');
    tareasData = await res.json();
    renderTareas();
  } catch {}
  document.getElementById('btn-nueva-tarea').onclick = nuevaTarea;
  document.getElementById('tarea-filter-estado').onchange = renderTareas;
  document.getElementById('tarea-filter-cat').onchange = renderTareas;
}

function renderTareas() {
  const container = document.getElementById('tareas-container');
  const filterEstado = document.getElementById('tarea-filter-estado').value;
  const filterCat = document.getElementById('tarea-filter-cat').value;
  let filtered = tareasData;
  if (filterEstado) filtered = filtered.filter(t => t.estado === filterEstado);
  if (filterCat) filtered = filtered.filter(t => t.categoria === filterCat);

  const estColor = {'pendiente':'#f59e0b','en-proceso':'#3b82f6','finalizado':'#22c55e'};
  const estLabel = {'pendiente':'Pendiente','en-proceso':'En Proceso','finalizado':'Finalizado'};

  container.innerHTML = filtered.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:1.1rem;">No hay tareas</div>' :
    filtered.map(t => `<div class="tarea-card${t.urgente&&t.estado!=='finalizado'?' tarea-urgente':''}" style="border-left:4px solid ${estColor[t.estado]||'#94a3b8'};">
      <div class="tarea-header">
        <div><strong>${esc(t.titulo)}</strong>
          ${t.urgente&&t.estado!=='finalizado'?'<span style="background:#ef4444;color:#fff;border-radius:4px;padding:1px 6px;font-size:0.7rem;margin-left:8px;">URGENTE</span>':''}
          <span style="background:#f1f5f9;border-radius:4px;padding:1px 8px;font-size:0.75rem;margin-left:6px;">${esc(t.categoria)}</span>
        </div>
        <div class="tarea-actions">
          <button class="btn btn-sm btn-primary" onclick="editTarea(${t.id})" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTarea(${t.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
      ${t.descripcion?`<p style="color:#475569;font-size:0.9rem;margin:8px 0;">${esc(t.descripcion)}</p>`:''}
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
        <span class="badge" style="background:${estColor[t.estado]||'#94a3b8'};color:#fff;">${estLabel[t.estado]||cap(t.estado)}</span>
        <span style="font-size:0.8rem;color:#94a3b8;">Creado: ${fmtDate(t.fecha_creacion)}</span>
        ${t.fecha_actualizacion!==t.fecha_creacion?`<span style="font-size:0.8rem;color:#94a3b8;">Actualizado: ${fmtDate(t.fecha_actualizacion)}</span>`:''}
      </div>
      ${t.observaciones?`<div style="margin-top:8px;padding:8px;background:#fffbeb;border-radius:6px;font-size:0.85rem;color:#92400e;">📝 ${esc(t.observaciones)}</div>`:''}
    </div>`).join('');
  checkUrgentCount();
}

function nuevaTarea() {
  openModal('📋 Nueva Tarea', `
    <div class="form-group"><label>Título</label><input type="text" id="modal-campo1" required placeholder="Título de la tarea"></div>
    <div class="form-group"><label>Descripción</label><textarea id="modal-campo2" rows="3" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;resize:vertical;" placeholder="Descripción detallada..."></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label>Categoría</label><select id="modal-campo3">
        <option value="General">General</option><option value="Deposito">Depósito</option><option value="Sprinter">Sprinter</option>
      </select></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:8px;margin-top:24px;">
        <input type="checkbox" id="modal-campo4" style="width:20px;height:20px;"> ⚠️ Marcar como Urgente
      </label></div>
    </div>
  `, async () => {
    const titulo = document.getElementById('modal-campo1').value.trim();
    if (!titulo) { showToast('Título requerido', 'error'); return; }
    const res = await api('POST', '/api/tareas', {
      titulo, descripcion: document.getElementById('modal-campo2').value.trim(),
      categoria: document.getElementById('modal-campo3').value,
      urgente: document.getElementById('modal-campo4').checked
    });
    if (res.ok) { closeModal(); showToast('Tarea creada', 'success'); loadTareas(); }
  });
}

async function editTarea(id) {
  const t = tareasData.find(x => x.id === id); if (!t) return;
  openModal('✏️ Editar Tarea', `
    <input type="hidden" id="modal-edit-id" value="${t.id}">
    <div class="form-group"><label>Título</label><input type="text" id="modal-campo1" value="${esc(t.titulo)}"></div>
    <div class="form-group"><label>Descripción</label><textarea id="modal-campo2" rows="3" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;resize:vertical;">${esc(t.descripcion)}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group"><label>Categoría</label><select id="modal-campo3">
        <option value="General" ${t.categoria==='General'?'selected':''}>General</option>
        <option value="Deposito" ${t.categoria==='Deposito'?'selected':''}>Depósito</option>
        <option value="Sprinter" ${t.categoria==='Sprinter'?'selected':''}>Sprinter</option>
      </select></div>
      <div class="form-group"><label>Estado</label><select id="modal-campo5">
        <option value="pendiente" ${t.estado==='pendiente'?'selected':''}>Pendiente</option>
        <option value="en-proceso" ${t.estado==='en-proceso'?'selected':''}>En Proceso</option>
        <option value="finalizado" ${t.estado==='finalizado'?'selected':''}>Finalizado</option>
      </select></div>
    </div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="modal-campo4" style="width:20px;height:20px;" ${t.urgente?'checked':''}> ⚠️ Urgente
    </label></div>
    <div class="form-group"><label>Observaciones</label><textarea id="modal-campo6" rows="3" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;resize:vertical;">${esc(t.observaciones)}</textarea></div>
  `, async () => {
    await api('PUT', `/api/tareas/${document.getElementById('modal-edit-id').value}`, {
      titulo: document.getElementById('modal-campo1').value.trim(),
      descripcion: document.getElementById('modal-campo2').value.trim(),
      categoria: document.getElementById('modal-campo3').value,
      estado: document.getElementById('modal-campo5').value,
      urgente: document.getElementById('modal-campo4').checked,
      observaciones: document.getElementById('modal-campo6').value.trim()
    });
    closeModal(); showToast('Tarea actualizada', 'success'); loadTareas();
  });
}

async function deleteTarea(id) { if (!confirm('¿Eliminar tarea?')) return; await api('DELETE', `/api/tareas/${id}`); showToast('Eliminada', 'success'); loadTareas(); }

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