const isProduction = !!process.env.DATABASE_URL;

function convertPlaceholders(sql) {
  if (!isProduction) return sql;
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

let db;

if (isProduction) {
  // ==================== POSTGRESQL (Cloud) ====================
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Crear tablas
  pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      direccion TEXT NOT NULL DEFAULT '',
      horario_atencion TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      cantidad_por_bulto INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      fecha TEXT NOT NULL,
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente'
    );
    CREATE TABLE IF NOT EXISTS pedido_items (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad_bultos INTEGER NOT NULL,
      precio_venta DOUBLE PRECISION NOT NULL,
      total DOUBLE PRECISION NOT NULL
    );
  `).then(() => {
    // Datos de ejemplo
    pool.query('SELECT COUNT(*) as count FROM clientes').then(res => {
      if (parseInt(res.rows[0].count) === 0) {
        pool.query(`INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES
          ('Cliente Ejemplo 1', 'Av. Siempre Viva 742', 'Lun-Vie 9:00-18:00'),
          ('Almacén Don Pedro', 'Calle San Martín 235', 'Lun-Sáb 8:00-20:00'),
          ('Super Mercado López', 'Ruta 5 Km 12', 'Lun-Dom 7:00-22:00')
        `).catch(() => {});
      }
    });
    pool.query('SELECT COUNT(*) as count FROM productos').then(res => {
      if (parseInt(res.rows[0].count) === 0) {
        pool.query(`INSERT INTO productos (nombre, cantidad_por_bulto) VALUES
          ('Coca Cola 500ml', 24), ('Pepsi 500ml', 24), ('Agua Mineral 500ml', 24),
          ('Fanta 500ml', 24), ('Sprite 500ml', 24), ('Cerveza Quilmes 1L', 12),
          ('Galletitas Oreo', 20), ('Alfajores Havanna', 12), ('Yerba Mate 500g', 12),
          ('Azúcar 1kg', 10)
        `).catch(() => {});
      }
    });
  }).catch(err => console.error('Error creating tables:', err));

  db = {
    async all(sql, params = []) {
      const { rows } = await pool.query(convertPlaceholders(sql), params);
      return rows;
    },
    async get(sql, params = []) {
      const { rows } = await pool.query(convertPlaceholders(sql), params);
      return rows[0] || null;
    },
    async run(sql, params = []) {
      const converted = convertPlaceholders(sql);
      if (converted.trim().toUpperCase().startsWith('INSERT')) {
        const returning = converted.replace(/;?\s*$/, ' RETURNING id');
        const { rows } = await pool.query(returning, params);
        return { lastInsertRowid: rows[0]?.id, changes: 1 };
      }
      const result = await pool.query(converted, params);
      return { lastInsertRowid: null, changes: result.rowCount };
    },
    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async run(sql, params = []) {
            const converted = convertPlaceholders(sql);
            if (converted.trim().toUpperCase().startsWith('INSERT')) {
              const returning = converted.replace(/;?\s*$/, ' RETURNING id');
              const { rows } = await client.query(returning, params);
              return { lastInsertRowid: rows[0]?.id };
            }
            await client.query(converted, params);
            return {};
          }
        });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  };

} else {
  // ==================== SQLITE (Local) ====================
  const Database = require('better-sqlite3');
  const path = require('path');
  const sqlite = new Database(path.join(__dirname, 'pedidos.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
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

  const clienteCount = sqlite.prepare('SELECT COUNT(*) as count FROM clientes').get();
  if (clienteCount.count === 0) {
    const insertCliente = sqlite.prepare('INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES (?, ?, ?)');
    insertCliente.run('Cliente Ejemplo 1', 'Av. Siempre Viva 742', 'Lun-Vie 9:00-18:00');
    insertCliente.run('Almacén Don Pedro', 'Calle San Martín 235', 'Lun-Sáb 8:00-20:00');
    insertCliente.run('Super Mercado López', 'Ruta 5 Km 12', 'Lun-Dom 7:00-22:00');
  }

  const productoCount = sqlite.prepare('SELECT COUNT(*) as count FROM productos').get();
  if (productoCount.count === 0) {
    const insertProducto = sqlite.prepare('INSERT INTO productos (nombre, cantidad_por_bulto) VALUES (?, ?)');
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

  db = {
    async all(sql, params = []) {
      return sqlite.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return sqlite.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      return sqlite.prepare(sql).run(...params);
    },
    async withTransaction(fn) {
      return fn({
        async run(sql, params = []) {
          return sqlite.prepare(sql).run(...params);
        }
      });
    }
  };
}

module.exports = db;