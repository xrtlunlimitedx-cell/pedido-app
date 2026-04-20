const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'pedidos.db'));

// Habilitar foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL DEFAULT '',
    horario_atencion TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cantidad_por_bulto INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS pedido_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad_bultos INTEGER NOT NULL,
    precio_venta REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );
`);

// Datos de ejemplo si las tablas están vacías
const clienteCount = db.prepare('SELECT COUNT(*) as count FROM clientes').get();
if (clienteCount.count === 0) {
  const insertCliente = db.prepare('INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES (?, ?, ?)');
  insertCliente.run('Cliente Ejemplo 1', 'Av. Siempre Viva 742', 'Lun-Vie 9:00-18:00');
  insertCliente.run('Almacén Don Pedro', 'Calle San Martín 235', 'Lun-Sáb 8:00-20:00');
  insertCliente.run('Super Mercado López', 'Ruta 5 Km 12', 'Lun-Dom 7:00-22:00');
}

const productoCount = db.prepare('SELECT COUNT(*) as count FROM productos').get();
if (productoCount.count === 0) {
  const insertProducto = db.prepare('INSERT INTO productos (nombre, cantidad_por_bulto) VALUES (?, ?)');
  insertProducto.run('Coca Cola 500ml', 24);
  insertProducto.run('Pepsi 500ml', 24);
  insertProducto.run('Agua Mineral 500ml', 24);
  insertProducto.run('Fanta 500ml', 24);
  insertProducto.run('Sprite 500ml', 24);
  insertProducto.run('Cerveza Quilmes 1L', 12);
  insertProducto.run('Galletitas Oreo', 20);
  insertProducto.run('Alfajores Havanna', 12);
  insertProducto.run('Yerba Mate 500g', 12);
  insertProducto.run('Azúcar 1kg', 10);
}

module.exports = db;