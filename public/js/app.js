// ==================== STATE ====================
const state = {
  clientes: [],
  productos: [],
  pedidoItems: [],
  clienteSeleccionado: null,
  currentSection: 'nuevo-pedido'
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupAccordion();
  setupPedidoForm();
  setupModal();
  loadAll();
});

// ==================== NAVIGATION ====================
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      navigateTo(section);
    });
  });
}

function navigateTo(section) {
  state.currentSection = section;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-section="${section}"]`).classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  
  if (section === 'clientes') loadClientes();
  if (section === 'productos') loadProductos();
  if (section === 'pedidos') loadPedidos();
  if (section === 'nuevo-pedido') loadProductosSelect();
}

// ==================== ACCORDION ====================
function setupAccordion() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const accordion = header.parentElement;
      accordion.classList.toggle('open');
    });
  });
  // Open first accordion by default
  document.querySelector('.accordion').classList.add('open');
}

// ==================== LOAD ALL DATA ====================
async function loadAll() {
  await Promise.all([loadClientes(), loadProductos()]);
  loadProductosSelect();
}

// ==================== CLIENTES ====================
async function loadClientes() {
  try {
    const res = await fetch('/api/clientes');
    state.clientes = await res.json();
    if (state.currentSection === 'clientes') renderClientes();
  } catch (err) {
    showToast('Error al cargar clientes', 'error');
  }
}

function renderClientes() {
  const tbody = document.getElementById('clientes-body');
  if (!tbody) return;
  tbody.innerHTML = state.clientes.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong>${escapeHtml(c.nombre)}</strong></td>
      <td>${escapeHtml(c.direccion)}</td>
      <td>${escapeHtml(c.horario_atencion)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editCliente(${c.id})">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function setupNuevoCliente() {
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
    openModal('Nuevo Cliente', `
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" id="cliente-nombre" placeholder="Nombre del cliente" required>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input type="text" id="cliente-direccion" placeholder="Dirección">
      </div>
      <div class="form-group">
        <label>Horario de Atención</label>
        <input type="text" id="cliente-horario" placeholder="Ej: Lun-Vie 9:00-18:00">
      </div>
    `, saveNewCliente);
  });
}

async function saveNewCliente() {
  const nombre = document.getElementById('cliente-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  
  const data = {
    nombre,
    direccion: document.getElementById('cliente-direccion').value.trim(),
    horario_atencion: document.getElementById('cliente-horario').value.trim()
  };
  
  try {
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal();
      showToast('Cliente guardado correctamente', 'success');
      await loadClientes();
    } else {
      const err = await res.json();
      showToast(err.error || 'Error al guardar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function editCliente(id) {
  const cliente = state.clientes.find(c => c.id === id);
  if (!cliente) return;
  
  openModal('Editar Cliente', `
    <input type="hidden" id="cliente-edit-id" value="${cliente.id}">
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="cliente-nombre" value="${escapeHtml(cliente.nombre)}" required>
    </div>
    <div class="form-group">
      <label>Dirección</label>
      <input type="text" id="cliente-direccion" value="${escapeHtml(cliente.direccion)}">
    </div>
    <div class="form-group">
      <label>Horario de Atención</label>
      <input type="text" id="cliente-horario" value="${escapeHtml(cliente.horario_atencion)}">
    </div>
  `, saveEditCliente);
}

async function saveEditCliente() {
  const id = document.getElementById('cliente-edit-id').value;
  const nombre = document.getElementById('cliente-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  
  const data = {
    nombre,
    direccion: document.getElementById('cliente-direccion').value.trim(),
    horario_atencion: document.getElementById('cliente-horario').value.trim()
  };
  
  try {
    const res = await fetch(`/api/clientes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal();
      showToast('Cliente actualizado', 'success');
      await loadClientes();
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function deleteCliente(id) {
  if (!confirm('¿Está seguro de eliminar este cliente?')) return;
  try {
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    showToast('Cliente eliminado', 'success');
    await loadClientes();
  } catch (err) {
    showToast('Error al eliminar', 'error');
  }
}

// ==================== PRODUCTOS ====================
async function loadProductos() {
  try {
    const res = await fetch('/api/productos');
    state.productos = await res.json();
    if (state.currentSection === 'productos') renderProductos();
  } catch (err) {
    showToast('Error al cargar productos', 'error');
  }
}

function renderProductos() {
  const tbody = document.getElementById('productos-body');
  if (!tbody) return;
  tbody.innerHTML = state.productos.map(p => `
    <tr>
      <td>${p.id}</td>
      <td><strong>${escapeHtml(p.nombre)}</strong></td>
      <td>${p.cantidad_por_bulto} unidades</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editProducto(${p.id})">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProducto(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function loadProductosSelect() {
  const select = document.getElementById('item-producto');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar producto...</option>' +
    state.productos.map(p => `<option value="${p.id}" data-cant="${p.cantidad_por_bulto}">${escapeHtml(p.nombre)}</option>`).join('');
}

function setupNuevoProducto() {
  document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    openModal('Nuevo Producto', `
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" id="producto-nombre" placeholder="Nombre del producto" required>
      </div>
      <div class="form-group">
        <label>Cantidad por Bulto</label>
        <input type="number" id="producto-cantidad" min="1" value="1" placeholder="Unidades por bulto">
      </div>
    `, saveNewProducto);
  });
}

async function saveNewProducto() {
  const nombre = document.getElementById('producto-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  
  const data = {
    nombre,
    cantidad_por_bulto: parseInt(document.getElementById('producto-cantidad').value) || 1
  };
  
  try {
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal();
      showToast('Producto guardado', 'success');
      await loadProductos();
      loadProductosSelect();
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function editProducto(id) {
  const producto = state.productos.find(p => p.id === id);
  if (!producto) return;
  
  openModal('Editar Producto', `
    <input type="hidden" id="producto-edit-id" value="${producto.id}">
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="producto-nombre" value="${escapeHtml(producto.nombre)}" required>
    </div>
    <div class="form-group">
      <label>Cantidad por Bulto</label>
      <input type="number" id="producto-cantidad" min="1" value="${producto.cantidad_por_bulto}">
    </div>
  `, saveEditProducto);
}

async function saveEditProducto() {
  const id = document.getElementById('producto-edit-id').value;
  const nombre = document.getElementById('producto-nombre').value.trim();
  if (!nombre) { showToast('El nombre es requerido', 'error'); return; }
  
  const data = {
    nombre,
    cantidad_por_bulto: parseInt(document.getElementById('producto-cantidad').value) || 1
  };
  
  try {
    const res = await fetch(`/api/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal();
      showToast('Producto actualizado', 'success');
      await loadProductos();
      loadProductosSelect();
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

async function deleteProducto(id) {
  if (!confirm('¿Está seguro de eliminar este producto?')) return;
  try {
    await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    showToast('Producto eliminado', 'success');
    await loadProductos();
    loadProductosSelect();
  } catch (err) {
    showToast('Error al eliminar', 'error');
  }
}

// ==================== PEDIDOS ====================
async function loadPedidos() {
  try {
    const res = await fetch('/api/pedidos');
    const pedidos = await res.json();
    renderPedidos(pedidos);
  } catch (err) {
    showToast('Error al cargar pedidos', 'error');
  }
}

function renderPedidos(pedidos) {
  const tbody = document.getElementById('pedidos-body');
  if (!tbody) return;
  tbody.innerHTML = pedidos.map(p => `
    <tr>
      <td><strong>PED-${String(p.id).padStart(4, '0')}</strong></td>
      <td>${formatDate(p.fecha)}</td>
      <td>${escapeHtml(p.cliente_nombre)}</td>
      <td>${escapeHtml(p.cliente_direccion)}</td>
      <td><strong>$ ${formatNumber(p.total)}</strong></td>
      <td><span class="badge badge-${p.estado}">${capitalize(p.estado)}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewPedido(${p.id})">👁️ Ver</button>
        <button class="btn btn-sm btn-success" onclick="changeEstado(${p.id}, 'entregado')" title="Marcar Entregado">✅</button>
        <button class="btn btn-sm btn-danger" onclick="deletePedido(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function viewPedido(id) {
  try {
    const res = await fetch(`/api/pedidos/${id}`);
    const pedido = await res.json();
    showPedidoDetail(pedido);
  } catch (err) {
    showToast('Error al cargar pedido', 'error');
  }
}

function showPedidoDetail(pedido) {
  const body = document.getElementById('pedido-detail-body');
  body.innerHTML = `
    <div class="pedido-print" id="pedido-print-content">
      <div class="pedido-print-header">
        <h2>PEDIDO #${String(pedido.id).padStart(4, '0')}</h2>
        <p>Fecha: ${formatDate(pedido.fecha)}</p>
      </div>
      
      <div class="pedido-print-info">
        <div><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nombre)}</div>
        <div><strong>Estado:</strong> ${capitalize(pedido.estado)}</div>
        <div><strong>Dirección:</strong> ${escapeHtml(pedido.cliente_direccion)}</div>
        <div><strong>Horario:</strong> ${escapeHtml(pedido.cliente_horario)}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Producto</th>
            <th>Unid/Bulto</th>
            <th>Bultos</th>
            <th>Precio Vta.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${pedido.items.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(item.producto_nombre)}</td>
              <td>${item.cantidad_por_bulto}</td>
              <td>${item.cantidad_bultos}</td>
              <td>$ ${formatNumber(item.precio_venta)}</td>
              <td>$ ${formatNumber(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5"><strong>TOTAL</strong></td>
            <td><strong>$ ${formatNumber(pedido.total)}</strong></td>
          </tr>
        </tfoot>
      </table>
      
      <div class="pedido-print-footer">
        <div class="firma-line">Firma del Vendedor</div>
        <div class="firma-line">Firma del Cliente</div>
      </div>
    </div>
  `;
  
  document.getElementById('pedido-detail-overlay').classList.remove('hidden');
  
  document.getElementById('btn-imprimir-pedido').onclick = () => {
    printPedido();
  };
  
  document.getElementById('pedido-detail-close').onclick = () => {
    document.getElementById('pedido-detail-overlay').classList.add('hidden');
  };
}

function printPedido() {
  const content = document.getElementById('pedido-print-content').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Pedido</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
        .pedido-print-header { text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px double #1e293b; }
        .pedido-print-header h2 { font-size: 1.4rem; margin-bottom: 4px; }
        .pedido-print-header p { color: #64748b; font-size: 0.9rem; }
        .pedido-print-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; }
        .pedido-print-info div { font-size: 0.9rem; }
        .pedido-print-info strong { color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-size: 0.85rem; }
        table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
        table tfoot td { font-weight: 700; background: #f0fdf4; padding: 12px; font-size: 1rem; }
        .pedido-print-footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .firma-line { border-top: 1px solid #1e293b; padding-top: 8px; text-align: center; font-size: 0.85rem; color: #64748b; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 300);
}

async function changeEstado(id, estado) {
  try {
    await fetch(`/api/pedidos/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    showToast(`Pedido marcado como ${estado}`, 'success');
    loadPedidos();
  } catch (err) {
    showToast('Error al cambiar estado', 'error');
  }
}

async function deletePedido(id) {
  if (!confirm('¿Está seguro de eliminar este pedido?')) return;
  try {
    await fetch(`/api/pedidos/${id}`, { method: 'DELETE' });
    showToast('Pedido eliminado', 'success');
    loadPedidos();
  } catch (err) {
    showToast('Error al eliminar', 'error');
  }
}

// ==================== NUEVO PEDIDO FORM ====================
function setupPedidoForm() {
  setupNuevoCliente();
  setupNuevoProducto();
  
  // Client search
  const buscarInput = document.getElementById('buscar-cliente');
  const resultados = document.getElementById('cliente-resultados');
  
  buscarInput.addEventListener('input', () => {
    const query = buscarInput.value.toLowerCase().trim();
    if (query.length === 0) {
      resultados.classList.add('hidden');
      return;
    }
    const filtered = state.clientes.filter(c => c.nombre.toLowerCase().includes(query));
    if (filtered.length === 0) {
      resultados.innerHTML = '<div class="search-result-item"><span class="result-nombre">No se encontraron clientes</span></div>';
    } else {
      resultados.innerHTML = filtered.map(c => `
        <div class="search-result-item" data-id="${c.id}">
          <div class="result-nombre">${escapeHtml(c.nombre)}</div>
          <div class="result-direccion">${escapeHtml(c.direccion)}</div>
        </div>
      `).join('');
      
      resultados.querySelectorAll('.search-result-item[data-id]').forEach(item => {
        item.addEventListener('click', () => {
          const id = parseInt(item.dataset.id);
          seleccionarCliente(id);
        });
      });
    }
    resultados.classList.remove('hidden');
  });
  
  buscarInput.addEventListener('focus', () => {
    if (buscarInput.value.trim().length > 0) {
      resultados.classList.remove('hidden');
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.client-search')) {
      resultados.classList.add('hidden');
    }
  });
  
  // Deseleccionar cliente
  document.getElementById('btn-deseleccionar-cliente').addEventListener('click', () => {
    state.clienteSeleccionado = null;
    document.getElementById('cliente-seleccionado').classList.add('hidden');
    document.getElementById('buscar-cliente').value = '';
    document.getElementById('buscar-cliente').disabled = false;
  });
  
  // Product select change - show units
  document.getElementById('item-producto').addEventListener('change', updateItemPreview);
  document.getElementById('item-bultos').addEventListener('input', updateItemPreview);
  document.getElementById('item-precio').addEventListener('input', updateItemPreview);
  
  // Add item
  document.getElementById('btn-agregar-item').addEventListener('click', addItem);
  
  // Save order
  document.getElementById('btn-guardar-pedido').addEventListener('click', guardarPedido);
  
  // Cancel
  document.getElementById('btn-cancelar-pedido').addEventListener('click', cancelarPedido);
}

function seleccionarCliente(id) {
  const cliente = state.clientes.find(c => c.id === id);
  if (!cliente) return;
  
  state.clienteSeleccionado = cliente;
  document.getElementById('sel-cliente-nombre').textContent = cliente.nombre;
  document.getElementById('sel-cliente-direccion').textContent = cliente.direccion;
  document.getElementById('sel-cliente-horario').textContent = cliente.horario_atencion;
  document.getElementById('cliente-seleccionado').classList.remove('hidden');
  document.getElementById('cliente-resultados').classList.add('hidden');
  document.getElementById('buscar-cliente').value = cliente.nombre;
  document.getElementById('buscar-cliente').disabled = true;
}

function updateItemPreview() {
  const productoId = parseInt(document.getElementById('item-producto').value);
  const bultos = parseInt(document.getElementById('item-bultos').value) || 0;
  const precio = parseFloat(document.getElementById('item-precio').value) || 0;
  
  if (productoId) {
    const producto = state.productos.find(p => p.id === productoId);
    if (producto) {
      document.getElementById('item-unidades').value = producto.cantidad_por_bulto;
    }
  } else {
    document.getElementById('item-unidades').value = '';
  }
  
  const total = bultos * precio;
  document.getElementById('item-total-preview').value = `$ ${formatNumber(total)}`;
}

function addItem() {
  const productoId = parseInt(document.getElementById('item-producto').value);
  const bultos = parseInt(document.getElementById('item-bultos').value) || 0;
  const precio = parseFloat(document.getElementById('item-precio').value) || 0;
  
  if (!productoId) { showToast('Seleccione un producto', 'error'); return; }
  if (bultos <= 0) { showToast('La cantidad de bultos debe ser mayor a 0', 'error'); return; }
  if (precio <= 0) { showToast('El precio debe ser mayor a 0', 'error'); return; }
  
  const producto = state.productos.find(p => p.id === productoId);
  const total = bultos * precio;
  
  state.pedidoItems.push({
    producto_id: productoId,
    producto_nombre: producto.nombre,
    cantidad_por_bulto: producto.cantidad_por_bulto,
    cantidad_bultos: bultos,
    precio_venta: precio,
    total
  });
  
  renderPedidoItems();
  
  // Reset form
  document.getElementById('item-producto').value = '';
  document.getElementById('item-bultos').value = 1;
  document.getElementById('item-precio').value = '';
  document.getElementById('item-unidades').value = '';
  document.getElementById('item-total-preview').value = '$ 0.00';
}

function removeItem(index) {
  state.pedidoItems.splice(index, 1);
  renderPedidoItems();
}

function renderPedidoItems() {
  const tbody = document.getElementById('items-body');
  const totalEl = document.getElementById('pedido-total');
  
  let granTotal = 0;
  tbody.innerHTML = state.pedidoItems.map((item, i) => {
    granTotal += item.total;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.producto_nombre)}</td>
        <td>${item.cantidad_por_bulto}</td>
        <td>${item.cantidad_bultos}</td>
        <td>$ ${formatNumber(item.precio_venta)}</td>
        <td><strong>$ ${formatNumber(item.total)}</strong></td>
        <td><button class="btn btn-sm btn-danger" onclick="removeItem(${i})">✕</button></td>
      </tr>
    `;
  }).join('');
  
  totalEl.innerHTML = `<strong>$ ${formatNumber(granTotal)}</strong>`;
}

async function guardarPedido() {
  if (!state.clienteSeleccionado) {
    showToast('Seleccione un cliente', 'error');
    return;
  }
  if (state.pedidoItems.length === 0) {
    showToast('Agregue al menos un item', 'error');
    return;
  }
  
  const data = {
    cliente_id: state.clienteSeleccionado.id,
    items: state.pedidoItems.map(item => ({
      producto_id: item.producto_id,
      cantidad_bultos: item.cantidad_bultos,
      precio_venta: item.precio_venta
    }))
  };
  
  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Pedido PED-${String(result.id).padStart(4, '0')} guardado correctamente`, 'success');
      cancelarPedido();
    } else {
      showToast(result.error || 'Error al guardar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

function cancelarPedido() {
  state.pedidoItems = [];
  state.clienteSeleccionado = null;
  document.getElementById('cliente-seleccionado').classList.add('hidden');
  document.getElementById('buscar-cliente').value = '';
  document.getElementById('buscar-cliente').disabled = false;
  document.getElementById('items-body').innerHTML = '';
  document.getElementById('pedido-total').innerHTML = '<strong>$ 0.00</strong>';
  document.getElementById('item-producto').value = '';
  document.getElementById('item-bultos').value = 1;
  document.getElementById('item-precio').value = '';
  document.getElementById('item-unidades').value = '';
  document.getElementById('item-total-preview').value = '$ 0.00';
}

// ==================== MODAL ====================
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    if (state.modalConfirmCallback) state.modalConfirmCallback();
  });
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
}

function openModal(title, bodyHtml, confirmCallback) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  state.modalConfirmCallback = confirmCallback;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  state.modalConfirmCallback = null;
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

// ==================== UTILITIES ====================
function formatNumber(num) {
  return Number(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}