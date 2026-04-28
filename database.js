const isProduction = !!process.env.DATABASE_URL;

function convertPlaceholders(sql) {
  if (!isProduction) return sql;
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

let db;

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'vendedor'
  );
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
    vendedor_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha TEXT NOT NULL,
    total DOUBLE PRECISION NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    comentarios TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad_bultos INTEGER NOT NULL,
    unidades_por_bulto INTEGER NOT NULL,
    precio_unidad DOUBLE PRECISION NOT NULL,
    total DOUBLE PRECISION NOT NULL
  );
`;

const SEED_USUARIOS = `
  INSERT INTO usuarios (username, password, nombre, rol) VALUES
    ('admin', 'admin123', 'Administrador', 'admin'),
    ('vendedor', 'vendedor123', 'Vendedor Demo', 'vendedor')
  ON CONFLICT (username) DO NOTHING;
`;

const SEED_CLIENTES = `
  INSERT INTO clientes (nombre, direccion, horario_atencion) VALUES
    ('Cliente Ejemplo 1', 'Av. Siempre Viva 742', 'Lun-Vie 9:00-18:00'),
    ('Almacén Don Pedro', 'Calle San Martín 235', 'Lun-Sáb 8:00-20:00'),
    ('Super Mercado López', 'Ruta 5 Km 12', 'Lun-Dom 7:00-22:00');
`;

const SEED_PRODUCTOS = `
  INSERT INTO productos (nombre, cantidad_por_bulto) VALUES
    ('Coca Cola 500ml', 24), ('Pepsi 500ml', 24), ('Agua Mineral 500ml', 24),
    ('Fanta 500ml', 24), ('Sprite 500ml', 24), ('Cerveza Quilmes 1L', 12),
    ('Galletitas Oreo', 20), ('Alfajores Havanna', 12), ('Yerba Mate 500g', 12),
    ('Azúcar 1kg', 10);
`;

if (isProduction) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.query(CREATE_TABLES).then(() => {
    pool.query(SEED_USUARIOS).catch(() => {});
    pool.query('SELECT COUNT(*) as count FROM clientes').then(res => {
      if (parseInt(res.rows[0].count) === 0) pool.query(SEED_CLIENTES).catch(() => {});
    });
    pool.query('SELECT COUNT(*) as count FROM productos').then(res => {
      if (parseInt(res.rows[0].count) === 0) pool.query(SEED_PRODUCTOS).catch(() => {});
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
  const Database = require('better-sqlite3');
  const path = require('path');
  const sqlite = new Database(path.join(__dirname, 'pedidos.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(CREATE_TABLES.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT'));
  sqlite.exec(SEED_USUARIOS.replace(/ON CONFLICT.*DO NOTHING;/g, ';'));
  
  const clienteCount = sqlite.prepare('SELECT COUNT(*) as count FROM clientes').get();
  if (clienteCount.count === 0) sqlite.exec(SEED_CLIENTES);

  const productoCount = sqlite.prepare('SELECT COUNT(*) as count FROM productos').get();
  if (productoCount.count === 0) sqlite.exec(SEED_PRODUCTOS);

  db = {
    async all(sql, params = []) { return sqlite.prepare(sql).all(...params); },
    async get(sql, params = []) { return sqlite.prepare(sql).get(...params); },
    async run(sql, params = []) { return sqlite.prepare(sql).run(...params); },
    async withTransaction(fn) {
      return fn({
        async run(sql, params = []) { return sqlite.prepare(sql).run(...params); }
      });
    }
  };
}

module.exports = db;