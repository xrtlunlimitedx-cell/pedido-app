// Generación de reportes de ventas en PDF usando PDFKit.
// Responsabilidad única: recibir los datos del reporte y devolver un stream de PDF.
// No conoce nada de Express ni de la base de datos.

const PDFDocument = require('pdfkit');

// Colores corporativos (alineados con el CSS de la app)
const COLOR_PRIMARIO = '#1e293b';   // slate-800 (encabezados)
const COLOR_ACENTO = '#059669';      // green-600 (totales positivos)
const COLOR_FONDO = '#f8fafc';       // slate-50 (filas alternas)
const COLOR_BORDE = '#e2e8f0';       // slate-200 (bordes de tabla)
const COLOR_GRIS = '#64748b';        // slate-500 (texto secundario)

// Formateadores (igual que el frontend, para que el PDF sea consistente)
function fmtNum(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFechaCorta(fechaISO) {
  // El reporte filtra por mes; mostramos fecha corta legible
  try {
    const d = new Date(fechaISO);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return fechaISO; }
}
function fmtMes(mes) {
  // mes viene como '2026-07' o undefined
  if (!mes) return 'Todas las fechas';
  const [anio, mesNum] = mes.split('-');
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const idx = parseInt(mesNum, 10) - 1;
  return idx >= 0 && idx < 12 ? `${nombres[idx]} ${anio}` : mes;
}

// Etiquetas legibles de estado (iguales a las del frontend)
const ETIQUETAS_ESTADO = {
  'pendiente': 'Pendiente',
  'entregado': 'Entregado',
  'entregado-pagado': 'Entregado (Pagado)',
  'entregado-firmado': 'Entregado (Firmado)',
  'entregado-transferido': 'Entregado (Transferido)',
  'cancelado': 'Cancelado'
};

/**
 * Genera un PDF del reporte de ventas.
 * @param {Object} reporte - { pedidos, totalGeneral, cantidadPedidos, porVendedor }
 * @param {Object} filtros - { mes, vendedor_id }
 * @returns {PDFDocument} documento PDF (stream) listo para pipear a la respuesta
 */
function generarReportePDF(reporte, filtros = {}) {
  const { pedidos, totalGeneral, cantidadPedidos, porVendedor } = reporte;
  const { mes, vendedor_id } = filtros;

  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ==================== ENCABEZADO ====================
  doc.fontSize(20).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
     .text('Reporte de Ventas', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(COLOR_GRIS).font('Helvetica')
     .text(`Período: ${fmtMes(mes)}`, { align: 'center' });
  if (vendedor_id && porVendedor && porVendedor.length > 0) {
    // porVendedor viene ordenado por total; el id del filtro coincide con el único
    // vendedor presente cuando se filtra por uno específico.
    const nombreV = porVendedor.length === 1 ? porVendedor[0].nombre : '';
    if (nombreV) {
      doc.fontSize(10).fillColor(COLOR_GRIS)
         .text(`Vendedor: ${nombreV}`, { align: 'center' });
    }
  }
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLOR_GRIS)
     .text(`Generado el ${new Date().toLocaleString('es-AR')}`, { align: 'center' });

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
     .strokeColor(COLOR_BORDE).lineWidth(1).stroke();
  doc.moveDown(1);

  // ==================== TARJETAS DE TOTALES ====================
  const anchoTarjeta = anchoPagina / 2 - 10;
  const yTarjetas = doc.y;

  // Tarjeta: cantidad de pedidos
  dibujarTarjeta(doc, 50, yTarjetas, anchoTarjeta, 'CANTIDAD DE PEDIDOS', String(cantidadPedidos), COLOR_PRIMARIO);
  // Tarjeta: total ventas
  dibujarTarjeta(doc, 50 + anchoTarjeta + 20, yTarjetas, anchoTarjeta, 'TOTAL VENTAS', `$ ${fmtNum(totalGeneral)}`, COLOR_ACENTO);

  doc.moveDown(4.5);

  // ==================== TABLA POR VENDEDOR (solo si hay datos) ====================
  if (porVendedor && porVendedor.length > 0) {
    doc.fontSize(14).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
       .text('Ventas por Vendedor', 50);
    doc.moveDown(0.5);
    dibujarTabla(doc, {
      headers: ['Vendedor', 'Pedidos', 'Total'],
      columnas: [
        { key: 'nombre', ancho: 0.5, align: 'left' },
        { key: 'cantidad', ancho: 0.2, align: 'right' },
        { key: 'total', ancho: 0.3, align: 'right', fmt: v => `$ ${fmtNum(v)}` }
      ],
      filas: porVendedor
    });
    doc.moveDown(1);
  }

  // ==================== TABLA DETALLADA DE PEDIDOS ====================
  doc.fontSize(14).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
     .text('Detalle de Pedidos', 50);
  doc.moveDown(0.5);
  dibujarTabla(doc, {
    headers: ['Pedido', 'Fecha', 'Cliente', 'Vendedor', 'Total', 'Estado'],
    columnas: [
      { key: 'id', ancho: 0.1, align: 'left', fmt: v => `PED-${String(v).padStart(4, '0')}` },
      { key: 'fecha', ancho: 0.14, align: 'left', fmt: fmtFechaCorta },
      { key: 'cliente_nombre', ancho: 0.26, align: 'left' },
      { key: 'vendedor_nombre', ancho: 0.2, align: 'left' },
      { key: 'total', ancho: 0.14, align: 'right', fmt: v => `$ ${fmtNum(v)}` },
      { key: 'estado', ancho: 0.16, align: 'left', fmt: v => ETIQUETAS_ESTADO[v] || v }
    ],
    filas: pedidos
  });

  // ==================== DESGLOSE DE ITEMS POR PEDIDO ====================
  // Solo si los pedidos traen items (lo pide el endpoint PDF).
  // Cada pedido con su cabecera (PED-XXXX — Cliente) y su sub-lista de productos.
  const pedidosConItems = pedidos.filter(p => Array.isArray(p.items) && p.items.length > 0);
  if (pedidosConItems.length > 0) {
    doc.addPage();
    doc.fontSize(14).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
       .text('Desglose de Productos por Pedido', 50);
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(COLOR_GRIS).font('Helvetica')
       .text('Detalle de qué productos llevó cada pedido', 50);
    doc.moveDown(1);

    pedidosConItems.forEach((p, idx) => {
      // Salto de página si no entra la cabecera del pedido + al menos 1 item
      if (doc.y > doc.page.height - 120) { doc.addPage(); }

      // Cabecera del pedido
      if (idx > 0) doc.moveDown(0.5);
      doc.fontSize(11).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold')
         .text(`PED-${String(p.id).padStart(4, '0')}  —  ${p.cliente_nombre}  —  $ ${fmtNum(p.total)}`, 50);
      doc.moveDown(0.2);

      // Sub-lista de items del pedido
      dibujarTabla(doc, {
        headers: ['Producto', 'Bultos', 'Unid/Bulto', 'Precio/Unid', 'Subtotal'],
        columnas: [
          { key: 'producto_nombre', ancho: 0.40, align: 'left' },
          { key: 'cantidad_bultos', ancho: 0.13, align: 'right' },
          { key: 'unidades_por_bulto', ancho: 0.17, align: 'right' },
          { key: 'precio_unidad', ancho: 0.14, align: 'right', fmt: v => `$ ${fmtNum(v)}` },
          { key: 'total', ancho: 0.16, align: 'right', fmt: v => `$ ${fmtNum(v)}` }
        ],
        filas: p.items
      });
    });
  }

  // ==================== PIE DE PÁGINA (número de página) ====================
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const paginaNum = `Página ${i - rango.start + 1} de ${rango.count}`;
    doc.fontSize(8).fillColor(COLOR_GRIS).font('Helvetica')
       .text(paginaNum, 50, doc.page.height - 40, { align: 'center', width: anchoPagina });
  }

  return doc;
}

// ==================== HELPERS DE DIBUJO ====================

function dibujarTarjeta(doc, x, y, ancho, etiqueta, valor, colorValor) {
  const alto = 70;
  // Fondo
  doc.rect(x, y, ancho, alto).fillColor('#ffffff').fill();
  // Borde
  doc.rect(x, y, ancho, alto).strokeColor(COLOR_BORDE).lineWidth(1).stroke();
  // Etiqueta
  doc.fontSize(9).fillColor(COLOR_GRIS).font('Helvetica-Bold')
     .text(etiqueta, x + 15, y + 14, { width: ancho - 30, align: 'center' });
  // Valor
  doc.fontSize(22).fillColor(colorValor).font('Helvetica-Bold')
     .text(valor, x + 15, y + 32, { width: ancho - 30, align: 'center' });
}

function dibujarTabla(doc, { headers, columnas, filas }) {
  const margenIzq = 50;
  const anchoTotal = doc.page.width - 100;
  const altoFila = 22;
  let y = doc.y;

  // Cabecera
  doc.rect(margenIzq, y, anchoTotal, altoFila).fillColor(COLOR_PRIMARIO).fill();
  let x = margenIzq;
  headers.forEach((h, i) => {
    const w = anchoTotal * columnas[i].ancho;
    doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
       .text(h, x + 4, y + 7, { width: w - 8, align: columnas[i].align });
    x += w;
  });
  y += altoFila;

  // Filas
  filas.forEach((fila, idx) => {
    // Salto de página si no entra
    if (y + altoFila > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
    }
    // Fondo alterno
    if (idx % 2 === 0) {
      doc.rect(margenIzq, y, anchoTotal, altoFila).fillColor(COLOR_FONDO).fill();
    }
    // Borde inferior sutil
    doc.moveTo(margenIzq, y + altoFila).lineTo(margenIzq + anchoTotal, y + altoFila)
       .strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();

    let x = margenIzq;
    columnas.forEach((col) => {
      const w = anchoTotal * col.ancho;
      let val = fila[col.key];
      if (col.fmt) val = col.fmt(val);
      doc.fontSize(8).fillColor(COLOR_PRIMARIO).font('Helvetica')
         .text(String(val ?? ''), x + 4, y + 7, { width: w - 8, align: col.align, ellipsis: true });
      x += w;
    });
    y += altoFila;
  });

  doc.y = y + 5;
}

module.exports = { generarReportePDF };
