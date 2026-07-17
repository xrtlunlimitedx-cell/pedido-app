# Design: Exportar Reportes de Ventas a PDF

**Fecha:** 2026-07-16
**Estado:** Pendiente de aprobación
**Autor:** Revisión colaborativa

## Resumen

Permitir al usuario **admin** descargar el reporte de ventas mensual como archivo **PDF**, para usarlo como backup guardado fuera del sistema. El PDF refleja exactamente lo que el admin ve en la sección Reportes (mes y filtro de vendedor seleccionados).

## Objetivos

- ✅ Generar un PDF profesional con el reporte de ventas del período elegido.
- ✅ Restringir la función **solo a admins**.
- ✅ Que funcione igual en local (SQLite) y producción (PostgreSQL en Render).
- ✅ Sin romper nada existente (el endpoint JSON de reportes queda intacto).

## No objetivos (YAGNI)

- ❌ No se genera DOCX (solo PDF).
- ❌ No se hace envío por email del PDF.
- ❌ No se agrega carátula/logo corporativo (el PDF refleja 1:1 el reporte en pantalla).
- ❌ No se agrega autenticación diferente: usa el mismo token Bearer que el resto del sistema.
- ❌ No se reemplaza el endpoint JSON existente: convive con el nuevo endpoint PDF.

## Decisiones de diseño (acordadas con el usuario)

| Aspecto | Decisión |
|---|---|
| Formato de archivo | PDF |
| Dónde se genera | En el servidor (Node.js) |
| Librería | **PDFKit** |
| Contenido | Igual que el reporte en pantalla (tarjetas de totales + tabla por vendedor + tabla detallada) |
| Acceso | Botón "⬇️ Descargar PDF" en la sección Reportes (solo visible para admin) |
| Nombre del archivo | `ventas-AAAA-MM.pdf` (ej: `ventas-2026-07.pdf`) |
| Permiso | Solo admin |
| Filtros reflejados | El mes y el vendedor que el admin tenga seleccionados al hacer click |

## Por qué PDFKit y no Puppeteer

| Criterio | PDFKit | Puppeteer |
|---|------|---|
| Tamaño de dependencia | Liviano | Instala Chromium (~300 MB) |
| Funciona en Render free | ✅ Sí, sin config | ⚠️ Problemático (memoria/build) |
| Cold start | Rápido | Pesado |
| Calidad del PDF para tablas | Suficiente (dibujado a mano) | Idéntico al HTML |
| Mantenimiento | Maduro y estable | También, pero overkill acá |

Decisión: **PDFKit**, porque el target es Render free tier y Puppeteer tiene riesgo de problemas de memoria/build. Las tablas se dibujan con una función helper reutilizable para no duplicar lógica.

## Arquitectura

### Flujo de datos

```
[Navegador · sección Reportes]
   │  Admin genera reporte (mes + vendedor), hace click en "⬇️ Descargar PDF"
   ↓
[GET /api/reportes/ventas/pdf?mes=2026-07&vendedor_id=2]
   │  Header: Authorization: Bearer <token>
   ↓
[server.js · nuevo endpoint]
   │  adminMiddleware verifica rol
   │  1. Reutiliza getReporteVentas(mes, vendedor_id, user) [función compartida]
   │  2. Genera PDF con PDFKit
   │  3. Responde: Content-Type: application/pdf
   │               Content-Disposition: attachment; filename="ventas-2026-07.pdf"
   ↓
[Navegador descarga el archivo]
```

### Refactor previo: extraer la consulta de reportes

Hoy la consulta del reporte vive dentro del handler `GET /api/reportes/ventas`. Para no duplicar SQL entre el endpoint JSON y el PDF, se extrae a una función compartida:

```js
// En server.js (o database.js)
async function getReporteVentas({ mes, vendedor_id, user }) {
  // ... consulta SQL existente ...
  return { pedidos, totalGeneral, cantidadPedidos, porVendedor };
}
```

Tanto el endpoint JSON (`/api/reportes/ventas`) como el nuevo endpoint PDF (`/api/reportes/ventas/pdf`) llaman a esta función. **Cero duplicación de SQL.**

## Componentes

### 1. Dependencia nueva
- Agregar `pdfkit` a `package.json` (dependencia estándar).

### 2. Backend — `server.js`
- **Función `getReporteVentas()`**: extrae la lógica de consulta existente. Sin cambios de comportamiento.
- **Endpoint nuevo** `GET /api/reportes/ventas/pdf`:
  - Protegido por `authMiddleware` + `adminMiddleware`.
  - Lee `mes` y `vendedor_id` de los query params.
  - Llama a `getReporteVentas()`.
  - Si no hay pedidos → responde 404 con JSON `{ error: 'No hay pedidos para exportar' }`.
  - Si hay pedidos → genera el PDF y lo devuelve como `application/pdf`.

### 3. Generador PDF — `pdfGenerator.js` (archivo nuevo)
Módulo aislado con una sola responsabilidad: **recibir los datos del reporte y devolver un stream de PDF**.

```js
// pdfGenerator.js
const PDFDocument = require('pdfkit');
function generarReportePDF(datos) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  // 1. Título: "Reporte de Ventas — Mes: 2026-07"
  // 2. Tarjetas de totales: Cantidad de pedidos + Total ventas
  // 3. (si hay) Tabla "Ventas por Vendedor": vendedor, pedidos, total
  // 4. Tabla detallada de pedidos: #, fecha, cliente, vendedor, total, estado
  return doc; // es un stream
}
```

Separarlo en su propio archivo porque:
- `server.js` ya tiene 450 líneas; sumar la generación del PDF lo haría muy grande.
- Aislarlo permite testearlo por separado (le paso datos falsos y verifico que no rompe).
- Cumple el principio de "un archivo, una responsabilidad".

### 4. Frontend — `public/js/app.js` + `public/index.html`
- **HTML**: agregar botón "⬇️ Descargar PDF" en la sección Reportes, abajo de los resultados. Solo se muestra si el usuario es admin.
- **JS**: función `descargarReportePDF()` que:
  - Lee el mes y vendedor seleccionados en el form de reportes.
  - Hace `fetch` al endpoint PDF con el token.
  - Recibe el `Blob` (archivo binario).
  - Dispara la descarga con el nombre `ventas-AAAA-MM.pdf`.

## Manejo de errores

| Caso | Comportamiento |
|---|---|
| No hay pedidos para el período | Endpoint responde 404 JSON `{ error }`. Frontend muestra toast "No hay pedidos para exportar en este período". |
| Error generando el PDF | Endpoint responde 500 JSON. Frontend muestra toast "Error al generar el PDF". |
| Vendedor intenta acceder al endpoint | `adminMiddleware` bloquea con 403 (igual que en reportes JSON). |
| Token inválido/expirado | `authMiddleware` bloquea con 401 (igual que el resto del sistema). |
| Error de red (Render hibernando) | El fetch falla → toast "Error de conexión". |

## Testing

Cómo se verificará (en local, con curl):

1. **Endpoint bloquea a no-admin:** login como vendedor → `GET /api/reportes/ventas/pdf` → espera 403.
2. **Endpoint genera PDF válido:** login como admin → crear pedidos de prueba → `GET /api/reportes/ventas/pdf?mes=...` → espera HTTP 200, `Content-Type: application/pdf`, y que el cuerpo empiece con `%PDF` (magic bytes de PDF).
3. **Nombre de archivo correcto:** verificar header `Content-Disposition: attachment; filename="ventas-2026-07.pdf"`.
4. **Período sin pedidos:** `GET /api/reportes/ventas/pdf?mes=1999-01` → espera 404 con JSON de error.
5. **Reutilización de consulta:** verificar que el endpoint JSON sigue funcionando igual (regresión).

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `package.json` | Agregar `pdfkit` como dependencia |
| `server.js` | Extraer `getReporteVentas()`, agregar endpoint `/api/reportes/ventas/pdf` |
| `pdfGenerator.js` | **Nuevo** — genera el PDF desde los datos del reporte |
| `public/index.html` | Agregar botón "Descargar PDF" en sección Reportes |
| `public/js/app.js` | Agregar `descargarReportePDF()` |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El PDF podría ser muy grande con muchos pedidos | PDFKit usa streaming (no carga todo en RAM). Aceptable para reportes mensuales. |
| `pdfkit` podría fallar en build de Render | Es librería pura de JS (sin compilar como better-sqlite3). Bajo riesgo. |
| Duplicar la lógica de consulta SQL | Se extrae a `getReporteVentas()` compartida. |
| El botón aparezca para vendedores | Se oculta por JS según rol (igual que las otras secciones admin). |
