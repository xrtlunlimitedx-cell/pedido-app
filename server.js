const express = require('express');
const path = require('path');
const db = require('./database');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'pedido-app-secret-2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== AUTH MIDDLEWARE ====================
const sessions = {};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.user = sessions[token];
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Admin.' });
  }
  next();
}

// ==================== AUTH ====================

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Ingrese usuario y contraseña' });
    
    const user = await db.get('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password]);
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    
    const token = generateToken();
    sessions[token] = { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
    
    res.json({ token, user: sessions[token] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) delete sessions[token];
  res.json({ success: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ==================== CLIENTES ====================

app.get('/api/clientes', authMiddleware, async (req, res) => {
  try {
    const clientes = await db.all('SELECT * FROM clientes ORDER BY nombre');
    res.json(clientes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', authMiddleware, async (req, res) => {
  try {
    const { nombre, direccion, horario_atencion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await db.run('INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES (?, ?, ?)', [nombre, direccion || '', horario_atencion || '']);
    res.json({ id: result.lastInsertRowid, nombre, direccion, horario_atencion });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clientes/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, direccion, horario_atencion } = req.body;
    await db.run('UPDATE clientes SET nombre = ?, direccion = ?, horario_atencion = ? WHERE id = ?', [nombre, direccion, horario_atencion, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', authMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== PRODUCTOS ====================

app.get('/api/productos', authMiddleware, async (req, res) => {
  try {
    const productos = await db.all('SELECT * FROM productos ORDER BY nombre');
    res.json(productos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/productos', authMiddleware, async (req, res) => {
  try {
    const { nombre, cantidad_por_bulto } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await db.run('INSERT INTO productos (nombre, cantidad_por_bulto) VALUES (?, ?)', [nombre, cantidad_por_bulto || 1]);
    res.json({ id: result.lastInsertRowid, nombre, cantidad_por_bulto });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    const { nombre, cantidad_por_bulto } = req.body;
    await db.run('UPDATE productos SET nombre = ?, cantidad_por_bulto = ? WHERE id = ?', [nombre, cantidad_por_bulto, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/productos/:id', authMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== PEDIDOS ====================

app.get('/api/pedidos', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.horario_atencion as cliente_horario,
             u.nombre as vendedor_nombre
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN usuarios u ON p.vendedor_id = u.id
    `;
    let params = [];
    
    // Vendedores solo ven sus pedidos
    if (req.user.rol !== 'admin') {
      query += ' WHERE p.vendedor_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY p.fecha DESC, p.id DESC';
    const pedidos = await db.all(query, params);
    res.json(pedidos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pedidos/:id', authMiddleware, async (req, res) => {
  try {
    const pedido = await db.get(`
      SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.horario_atencion as cliente_horario,
             u.nombre as vendedor_nombre
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN usuarios u ON p.vendedor_id = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    
    // Vendedor solo puede ver sus propios pedidos
    if (req.user.rol !== 'admin' && pedido.vendedor_id !== req.user.id) {
      return res.status(403).json({ error: 'No tiene permiso para ver este pedido' });
    }

    const items = await db.all(`
      SELECT pi.*, pr.nombre as producto_nombre
      FROM pedido_items pi
      JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = ?
    `, [req.params.id]);

    pedido.items = items;
    res.json(pedido);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pedidos', authMiddleware, async (req, res) => {
  try {
    const { cliente_id, items } = req.body;
    if (!cliente_id) return res.status(400).json({ error: 'Seleccione un cliente' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'Agregue al menos un item' });

    const fecha = new Date().toISOString();
    let total = 0;
    items.forEach(item => {
      item.total = item.cantidad_bultos * item.unidades_por_bulto * item.precio_unidad;
      total += item.total;
    });

    const pedidoId = await db.withTransaction(async (tx) => {
      const result = await tx.run(
        'INSERT INTO pedidos (cliente_id, vendedor_id, fecha, total, estado) VALUES (?, ?, ?, ?, ?)',
        [cliente_id, req.user.id, fecha, total, 'pendiente']
      );
      const id = result.lastInsertRowid;
      for (const item of items) {
        await tx.run(
          'INSERT INTO pedido_items (pedido_id, producto_id, cantidad_bultos, unidades_por_bulto, precio_unidad, total) VALUES (?, ?, ?, ?, ?, ?)',
          [id, item.producto_id, item.cantidad_bultos, item.unidades_por_bulto, item.precio_unidad, item.total]
        );
      }
      return id;
    });

    res.json({ id: pedidoId, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pedidos/:id/estado', authMiddleware, async (req, res) => {
  try {
    await db.run('UPDATE pedidos SET estado = ? WHERE id = ?', [req.body.estado, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/pedidos/:id', authMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM pedido_items WHERE pedido_id = ?', [req.params.id]);
    await db.run('DELETE FROM pedidos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== REPORTES ====================

app.get('/api/reportes/ventas', authMiddleware, async (req, res) => {
  try {
    const { mes, vendedor_id } = req.query;
    let query = `
      SELECT p.id, p.fecha, p.total, p.estado,
             c.nombre as cliente_nombre,
             u.nombre as vendedor_nombre, u.id as vendedor_id
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN usuarios u ON p.vendedor_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (mes) {
      query += ' AND p.fecha LIKE ?';
      params.push(mes + '%');
    }

    if (vendedor_id) {
      query += ' AND p.vendedor_id = ?';
      params.push(vendedor_id);
    } else if (req.user.rol !== 'admin') {
      query += ' AND p.vendedor_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY p.fecha DESC';
    const pedidos = await db.all(query, params);

    const totalGeneral = pedidos.reduce((sum, p) => sum + Number(p.total), 0);
    const cantidadPedidos = pedidos.length;

    // Totales por vendedor
    let porVendedor = [];
    if (req.user.rol === 'admin') {
      const vendedorMap = {};
      pedidos.forEach(p => {
        if (!vendedorMap[p.vendedor_nombre]) vendedorMap[p.vendedor_nombre] = { nombre: p.vendedor_nombre, total: 0, cantidad: 0 };
        vendedorMap[p.vendedor_nombre].total += Number(p.total);
        vendedorMap[p.vendedor_nombre].cantidad++;
      });
      porVendedor = Object.values(vendedorMap).sort((a, b) => b.total - a.total);
    }

    res.json({ pedidos, totalGeneral, cantidadPedidos, porVendedor });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== USUARIOS (solo admin) ====================

app.get('/api/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const usuarios = await db.all('SELECT id, username, nombre, rol FROM usuarios ORDER BY nombre');
    res.json(usuarios);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, nombre, rol } = req.body;
    if (!username || !password || !nombre) return res.status(400).json({ error: 'Complete todos los campos' });
    const result = await db.run('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)', [username, password, nombre, rol || 'vendedor']);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, nombre, rol } = req.body;
    if (password) {
      await db.run('UPDATE usuarios SET username = ?, password = ?, nombre = ?, rol = ? WHERE id = ?', [username, password, nombre, rol, req.params.id]);
    } else {
      await db.run('UPDATE usuarios SET username = ?, nombre = ?, rol = ? WHERE id = ?', [username, nombre, rol, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});