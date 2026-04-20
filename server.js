const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== CLIENTES ====================

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await db.all('SELECT * FROM clientes ORDER BY nombre');
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, direccion, horario_atencion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await db.run('INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES (?, ?, ?)', [nombre, direccion || '', horario_atencion || '']);
    res.json({ id: result.lastInsertRowid, nombre, direccion, horario_atencion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nombre, direccion, horario_atencion } = req.body;
    const { id } = req.params;
    await db.run('UPDATE clientes SET nombre = ?, direccion = ?, horario_atencion = ? WHERE id = ?', [nombre, direccion, horario_atencion, id]);
    res.json({ id, nombre, direccion, horario_atencion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PRODUCTOS ====================

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await db.all('SELECT * FROM productos ORDER BY nombre');
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { nombre, cantidad_por_bulto } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const result = await db.run('INSERT INTO productos (nombre, cantidad_por_bulto) VALUES (?, ?)', [nombre, cantidad_por_bulto || 1]);
    res.json({ id: result.lastInsertRowid, nombre, cantidad_por_bulto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const { nombre, cantidad_por_bulto } = req.body;
    const { id } = req.params;
    await db.run('UPDATE productos SET nombre = ?, cantidad_por_bulto = ? WHERE id = ?', [nombre, cantidad_por_bulto, id]);
    res.json({ id, nombre, cantidad_por_bulto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PEDIDOS ====================

app.get('/api/pedidos', async (req, res) => {
  try {
    const pedidos = await db.all(`
      SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.horario_atencion as cliente_horario
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.fecha DESC, p.id DESC
    `);
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pedidos/:id', async (req, res) => {
  try {
    const pedido = await db.get(`
      SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.horario_atencion as cliente_horario
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = await db.all(`
      SELECT pi.*, pr.nombre as producto_nombre, pr.cantidad_por_bulto
      FROM pedido_items pi
      JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = ?
    `, [req.params.id]);

    pedido.items = items;
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente_id, items } = req.body;
    if (!cliente_id) return res.status(400).json({ error: 'Seleccione un cliente' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'Agregue al menos un item' });

    const fecha = new Date().toISOString();
    let total = 0;
    items.forEach(item => {
      item.total = item.cantidad_bultos * item.precio_venta;
      total += item.total;
    });

    const pedidoId = await db.withTransaction(async (tx) => {
      const result = await tx.run('INSERT INTO pedidos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)', [cliente_id, fecha, total, 'pendiente']);
      const id = result.lastInsertRowid;
      for (const item of items) {
        await tx.run('INSERT INTO pedido_items (pedido_id, producto_id, cantidad_bultos, precio_venta, total) VALUES (?, ?, ?, ?, ?)', [id, item.producto_id, item.cantidad_bultos, item.precio_venta, item.total]);
      }
      return id;
    });

    res.json({ id: pedidoId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    await db.run('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/pedidos/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM pedido_items WHERE pedido_id = ?', [req.params.id]);
    await db.run('DELETE FROM pedidos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});