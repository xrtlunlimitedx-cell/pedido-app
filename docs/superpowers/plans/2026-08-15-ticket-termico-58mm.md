# Ticket Térmico 58mm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar impresión de pedidos en formato ticket térmico 58mm (diseño B con barras negras invertidas) que se imprime al 100% sin ajustes manuales y con negro puro.

**Architecture:** Todo client-side, siguiendo el patrón existente de `printPedido()`: una función nueva `printPedidoTermico(pedido)` abre una ventana `window.open` con HTML autosuficiente (CSS inline), genera la página a 58mm exactos (`@page`) y llama a `win.print()`. Sin cambios en el servidor. La impresión A4 queda intacta y convive con dos botones en el modal de detalle.

**Tech Stack:** HTML/CSS/JS vanilla (frontend existente), Express solo para servir (sin tocar).

**Spec:** `docs/superpowers/specs/2026-08-15-ticket-termico-58mm-design.md`

## Global Constraints

- Solo colores `#000` y `#fff` en el ticket — ningún gris (las térmicas traman los grises).
- `@page { size: 58mm auto; margin: 0; }` — página exacta, impresión a escala 100% sin ajustes.
- `-webkit-print-color-adjust: exact; print-color-adjust: exact;` para las barras invertidas.
- Tipografía monoespaciada: `'Consolas', 'Courier New', monospace`; cuerpo base `9px`.
- La función `printPedido()` A4 y su flujo NO se modifican (solo su binding a otro botón).
- Sin cambios en `server.js`, `styles.css` ni nuevas dependencias npm.
- Guiones `-` (no em-dash `—`) en el texto de ítems: más seguro para fuentes monoespaciadas al imprimir.
- Trabajar en branch `feature/ticket-termico-58mm`, merge a master al final.
- Mensajes de commit estilo historia existente: `Feat: ...`.

## Nota sobre verificación

El proyecto **no tiene infraestructura de tests** (cero tests, `package.json` solo tiene `start`). Esta feature es visual/de impresión: cada tarea incluye (a) chequeos automáticos de humo con `node -e` (sin crear archivos de test) y (b) verificación en navegador. La prueba física en la térmica es el gate final del usuario (Task 3).

Servidor local: `npm start` → `http://localhost:3000` (o `iniciar-servidor.bat`). La app requiere login para ver pedidos, pero las funciones son globales: se pueden verificar desde la página de login con un pedido sintético (no hace falta credenciales para Tasks 1-2).

---

### Task 1: Función `printPedidoTermico()` en app.js

**Files:**
- Modify: `public/js/app.js` (insertar la función justo después del cierre de `printPedido()`, alrededor de la línea 292)

**Interfaces:**
- Consumes: helpers globales existentes en `app.js`: `esc(t)`, `fmtNum(n)` (formato es-AR "1.140,00"), `fmtDate(d)` (fecha+hora "15/08/2026, 14:32"), y el objeto `pedido` con shape `{ id, fecha, cliente_nombre, cliente_direccion, vendedor_nombre, total, items: [{ producto_nombre, cantidad_bultos, unidades_por_bulto, precio_unidad, total }] }`.
- Produces: función global `printPedidoTermico(pedido)` — Task 2 la conecta al botón `btn-imprimir-ticket` como `onclick = () => printPedidoTermico(pedido)`. Sin valor de retorno.

- [ ] **Step 1: Crear branch**

```bash
cd "/c/Users/Educacion/OneDrive/Desktop/Nueva carpeta/Pedido-APP/pedido-app-master"
git checkout -b feature/ticket-termico-58mm
```

Expected: `Switched to a new branch 'feature/ticket-termico-58mm'`

- [ ] **Step 2: Agregar la función completa después de `printPedido()`**

Insertar inmediatamente después de la línea `win.document.close(); setTimeout(() => win.print(), 300); }` (cierre de `printPedido()`, línea ~292):

```javascript
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
```

- [ ] **Step 3: Chequeo automático de humo (CSS clave presente, sin grises)**

```bash
cd "/c/Users/Educacion/OneDrive/Desktop/Nueva carpeta/Pedido-APP/pedido-app-master"
node -e "
const s = require('fs').readFileSync('public/js/app.js','utf8');
const m = s.match(/function printPedidoTermico[\s\S]*?\n}/);
if (!m) { console.error('FALTA printPedidoTermico'); process.exit(1); }
const f = m[0];
for (const k of ['@page { size: 58mm auto; margin: 0; }','print-color-adjust: exact','barra-pedido','barra-total','Firma del Cliente','monospace'])
  if (!f.includes(k)) { console.error('FALTA: ' + k); process.exit(1); }
const colores = (f.match(/#[0-9a-fA-F]{3,6}\b/g) || []).map(c => c.toLowerCase());
const malos = colores.filter(c => !['#000','#fff'].includes(c));
if (malos.length) { console.error('COLORES NO PERMITIDOS: ' + malos.join(' ')); process.exit(1); }
console.log('OK: CSS clave presente, solo #000 y #fff');
"
```

Expected: `OK: CSS clave presente, solo #000 y #fff`

- [ ] **Step 4: Verificación visual en navegador (sin login)**

Levantar el servidor (`npm start` en una terminal aparte o `iniciar-servidor.bat`), abrir `http://localhost:3000` y en la consola del devtools (F12) ejecutar:

```javascript
const testPedido = { id: 42, fecha: '2026-08-15T14:32:00', cliente_nombre: 'ALMACEN DON JOSE', cliente_direccion: 'AV. SAN MARTIN 1235', vendedor_nombre: 'MARTIN', total: 27680, items: [
  { producto_nombre: 'COCA-COLA 2.25L', cantidad_bultos: 2, unidades_por_bulto: 6, precio_unidad: 950, total: 11400 },
  { producto_nombre: 'SPRITE 2L', cantidad_bultos: 1, unidades_por_bulto: 8, precio_unidad: 820, total: 6560 },
  { producto_nombre: 'FANTA 1.5L', cantidad_bultos: 3, unidades_por_bulto: 6, precio_unidad: 540, total: 9720 }
] };
printPedidoTermico(testPedido);
```

Se abre ventana nueva + diálogo de impresión. Verificar en la vista previa (idealmente con "Microsoft Print to PDF" para no gastar papel):
1. Página angosta (58mm), NO A4 horizontal ni vertical
2. Escala 100% y márgenes "Ninguno" por defecto
3. Barra negra "PEDIDO #0042" arriba y barra negra "TOTAL" con letra blanca
4. Todo el texto negro sólido, cero grises
5. Montos alineados a la derecha; línea "Firma del Cliente" al final

Cancelar el diálogo. Alternativa automatizable (Playwright): capturar el HTML con stub de `window.open` y renderizarlo en una pestaña blob/data URL para screenshot:

```javascript
window.__captured = '';
const stub = { document: { write: h => { window.__captured = h; }, close: () => {} } };
window.open = () => stub;
printPedidoTermico(testPedido);
delete window.open; // restaura
window.__captured; // HTML del ticket para inspección
```

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js
git commit -m "Feat: función printPedidoTermico para ticket térmico 58mm"
```

Expected: commit creado en `feature/ticket-termico-58mm`

---

### Task 2: Botones "Ticket 58mm" + "A4" en el modal de detalle

**Files:**
- Modify: `public/index.html:354` (reemplazar el botón único)
- Modify: `public/js/app.js` (wiring en `showPedidoDetail()`, línea ~283)

**Interfaces:**
- Consumes: función global `printPedidoTermico(pedido)` de Task 1; `printPedido()` existente (lee del DOM `#pedido-print-content`); `pedido` ya está en scope en `showPedidoDetail(pedido)`.
- Produces: dos botones con ids `btn-imprimir-ticket` (primario, ticket térmico) y `btn-imprimir-a4` (secundario `btn-info`, A4). Ninguna otra tarea depende de esto.

- [ ] **Step 1: Reemplazar el botón en index.html**

En `public/index.html` línea 354, reemplazar:

```html
          <button class="btn btn-primary" id="btn-imprimir-pedido">🖨️ Imprimir</button>
```

por:

```html
          <button class="btn btn-primary" id="btn-imprimir-ticket">🖨️ Ticket 58mm</button>
          <button class="btn btn-info" id="btn-imprimir-a4">🖨️ A4</button>
```

(`btn-info` ya existe en `styles.css:476`.)

- [ ] **Step 2: Actualizar el wiring en app.js**

En `showPedidoDetail()` (~línea 283), reemplazar:

```javascript
  document.getElementById('btn-imprimir-pedido').onclick = () => printPedido();
```

por:

```javascript
  document.getElementById('btn-imprimir-ticket').onclick = () => printPedidoTermico(pedido);
  document.getElementById('btn-imprimir-a4').onclick = () => printPedido();
```

- [ ] **Step 3: Chequeo automático (ids consistentes HTML ↔ JS, botón viejo sin rastro)**

```bash
cd "/c/Users/Educacion/OneDrive/Desktop/Nueva carpeta/Pedido-APP/pedido-app-master"
node -e "
const fs = require('fs');
const html = fs.readFileSync('public/index.html','utf8');
const js = fs.readFileSync('public/js/app.js','utf8');
if (js.includes('btn-imprimir-pedido')) { console.error('Queda referencia al id viejo btn-imprimir-pedido'); process.exit(1); }
for (const id of ['btn-imprimir-ticket','btn-imprimir-a4']) {
  if (!html.includes('id=\"' + id + '\"')) { console.error('FALTA boton ' + id + ' en index.html'); process.exit(1); }
  if (!js.includes(\"getElementById('\" + id + "')\")) { console.error('FALTA wiring de ' + id + ' en app.js'); process.exit(1); }
}
if (!js.includes('printPedidoTermico(pedido)')) { console.error('FALTA llamada printPedidoTermico(pedido)'); process.exit(1); }
console.log('OK: botones y wiring consistentes');
"
```

Expected: `OK: botones y wiring consistentes`

- [ ] **Step 4: Verificación visual en navegador**

Con el servidor corriendo, recargar `http://localhost:3000`. Desde la consola del devtools (sirve en login, el modal existe oculto en el DOM):

```javascript
// Muestra el modal de detalle con un pedido sintético
showPedidoDetail({ id: 42, fecha: '2026-08-15T14:32:00', cliente_nombre: 'ALMACEN DON JOSE', cliente_direccion: 'AV. SAN MARTIN 1235', cliente_horario: 'Mañana', vendedor_nombre: 'MARTIN', total: 27680, items: [
  { producto_nombre: 'COCA-COLA 2.25L', cantidad_bultos: 2, unidades_por_bulto: 6, precio_unidad: 950, total: 11400 },
  { producto_nombre: 'SPRITE 2L', cantidad_bultos: 1, unidades_por_bulto: 8, precio_unidad: 820, total: 6560 }
] });
```

Verificar:
1. El header del modal muestra DOS botones: "🖨️ Ticket 58mm" (celeste/primary) y "🖨️ A4"
2. Clic en "🖨️ A4" → abre el formato A4 actual (página blanca ancha, tabla) — sin cambios
3. Clic en "🖨️ Ticket 58mm" → abre el ticket angosto con barras negras (Task 1)
4. Sin errores en consola

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/app.js
git commit -m "Feat: botones Ticket 58mm y A4 en detalle de pedido"
```

Expected: commit creado

---

### Task 3: Merge, deploy a Render y prueba física del usuario

**Files:**
- Sin archivos nuevos. Merge del branch + push + verificación en producción.

**Interfaces:**
- Consumes: Tasks 1 y 2 completos en `feature/ticket-termico-58mm`.
- Produces: feature publicada en producción (Render auto-deploy) y validación física del usuario.

- [ ] **Step 1: Merge a master y push**

```bash
cd "/c/Users/Educacion/OneDrive/Desktop/Nueva carpeta/Pedido-APP/pedido-app-master"
git checkout master
git merge feature/ticket-termico-58mm
git push origin master
```

Expected: merge sin conflictos, push OK (Render auto-deploy arranca solo).

- [ ] **Step 2: Esperar deploy de Render y verificar en producción**

Esperar 2-5 minutos (dashboard.render.com → servicio → Events: "Live"). Abrir la app en producción (URL onrender.com), login, abrir un pedido real → "🖨️ Ticket 58mm" → vista previa: página 58mm, escala 100%, sin grises.

- [ ] **Step 3: Prueba física del usuario (GATE FINAL — requiere al usuario)**

El usuario imprime un pedido real en la térmica 58mm. Criterio de éxito:
- Negro fuerte uniforme, comparable a la página de prueba de la impresora
- Sin desbordes ni texto cortado en los bordes
- Barras negras sólidas arriba (PEDIDO #) y abajo (TOTAL)
- Largo del ticket acorde a los ítems, firma al final

Si la letra sale chica/grande: ajustar `font-size: 9px` de `body` en `printPedidoTermico()` (una línea), commit + push (Task repite Steps 1-2).

- [ ] **Step 4: Confirmación final**

El usuario confirma que imprime bien → feature terminada. El branch local puede quedarse (histórico, como los otros feature branches).
