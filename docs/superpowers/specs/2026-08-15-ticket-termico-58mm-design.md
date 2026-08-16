# Design: Ticket Térmico 58mm para Pedidos

**Fecha:** 2026-08-15
**Estado:** Pendiente de aprobación
**Autor:** Revisión colaborativa

## Resumen

Agregar una segunda vista de impresión de pedidos diseñada **exclusivamente para impresoras térmicas de 58mm**, que se imprime al 100% sin ajustes manuales (sin escalar, sin tocar márgenes) y con negro puro para máxima nitidez. La impresión A4 existente queda intacta.

## Problema

La impresión actual (`printPedido()` en `public/js/app.js`) genera un layout pensado para A4:

1. No define tamaño de página (`@page`), así que el navegador asume A4 → el usuario debe escalar manualmente al ~65% y quitar márgenes para que entre en el papel de 58mm.
2. Usa grises (`#1e293b`, `#64748b`, `#e2e8f0`). Las térmicas son de 1 bit (punto encendido o apagado): los grises se convierten en tramado y se ven desvanecidos.
3. El escalado al 65% agrega anti-aliasing (píxeles grises en los bordes del texto) → más tramado → impresión borrosa y grisácea.

La página de prueba de la impresora sale perfecta porque la genera el firmware con puntos 100% negros. La solución es que el ticket llegue en las mismas condiciones.

## Objetivos

- ✅ Imprimir tickets de pedidos en térmica 58mm **sin ajustar nada** en el diálogo de impresión (escala 100% por defecto, márgenes ninguno).
- ✅ Negro fuerte y texto nítido (solo negro puro `#000`, sin grises).
- ✅ Convivir con la impresión A4 actual (dos botones en el detalle del pedido).
- ✅ El largo del ticket se estira automáticamente según la cantidad de ítems (papel en rollo).
- ✅ Cero cambios en el servidor (todo client-side, como la impresión A4 actual).

## No objetivos (YAGNI)

- ❌ No se implementa impresión ESC/POS cruda por WebUSB (frágil en Windows con driver instalado, solo Chrome/Edge).
- ❌ No se genera el ticket como PDF en el servidor (no resuelve el escalado y agrega complejidad).
- ❌ No se cambia la vista/impresión A4 existente.
- ❌ No se agregan logos ni imágenes en el ticket (las imágenes introducen grises/tramado).
- ❌ No se agregan cortes automáticos de papel ni comandos de la impresora.

## Decisiones de diseño (acordadas con el usuario)

| Aspecto | Decisión |
|---|---|
| Enfoque | Vista HTML/CSS dedicada a 58mm (opción elegida sobre ESC/POS y PDF) |
| Estilo del ticket | **B — Barras negras invertidas** (elegido visualmente por el usuario) |
| Formato | Botón "Ticket 58mm" junto al botón "A4" en el detalle del pedido |
| Largo | Automático según cantidad de ítems (rollo) |
| Firma | Línea de firma del cliente al final |
| Colores | Solo negro puro `#000` sobre blanco |
| Tipografía | Monoespaciada (Consolas / Courier New), cuerpo ~9px, total más grande |
| Datos incluidos | Nº pedido, fecha/hora, cliente, dirección, vendedor, ítems, subtotales, total |

## Layout del ticket (diseño B aprobado)

```
█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
█      PEDIDO #0042       █   ← barra negra, letra blanca
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
Vie 15/08/26 14:32           ← centrado
Cliente:   ALMACEN DON JOSE
Direcc.:   AV. SAN MARTIN 1235
Vendedor:  MARTIN
- - - - - - - - - - - - - - -
1. COCA-COLA 2.25L            ← negrita (2 líneas si es largo)
   2 bx 6u — $950 c/u  $11.400
2. SPRITE 2L
   1 bx 8u — $820 c/u   $6.560
3. FANTA 1.5L
   3 bx 6u — $540 c/u   $9.720
█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
█ TOTAL            $ 27.680 █   ← barra negra, letra blanca grande
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀

_________________________
     Firma del Cliente      ← espacio de firma encima de la línea
```

## Especificación técnica

### CSS de impresión (la clave de la calidad)

```css
@page { size: 58mm auto; margin: 0; }        /* página exacta: sin escalar */
body { width: 58mm; padding: 3mm 5mm; }      /* contenido en los 48mm útiles */
                                             /* (cabezal de 58mm imprime ~48mm) */
* { color: #000 !important; }                /* solo negro puro */
.barra { background: #000; color: #fff;
         -webkit-print-color-adjust: exact;
         print-color-adjust: exact; }        /* fuerza las barras invertidas */
body { font-family: 'Consolas','Courier New',monospace;
       font-size: 9px; }                     /* monoespaciada = columnas derechas */
```

- `size: 58mm auto` hace que el navegador genere la página a medida → el diálogo se abre en escala 100% y márgenes ninguno por defecto → cero ajustes manuales.
- Sin bordes grises: separadores con líneas negras de 1px (dashed) o de 2px (sólidas).
- Montos alineados a la derecha con flexbox (`display:flex; justify-content:space-between`).

### Cambios en el código

| Archivo | Cambio |
|---|---|
| `public/index.html` | El botón `btn-imprimir-pedido` (línea 354) pasa a ser dos: `btn-imprimir-ticket` ("🖨️ Ticket 58mm", primario) y `btn-imprimir-a4` ("🖨️ A4", secundario) |
| `public/js/app.js` | Nueva función `printPedidoTermico(pedido)` que abre ventana con el layout térmico (mismo patrón de `printPedido()` actual). `showPedidoDetail()` conecta ambos botones. `printPedido()` A4 queda intacto |
| `public/css/styles.css` | Sin cambios (la ventana del ticket lleva sus estilos inline, igual que el A4 actual) |
| Servidor | **Sin cambios** |

### Manejo de casos

- **Producto con nombre largo:** el nombre baja a 2 líneas solo (no se trunca).
- **Muchos ítems:** el ticket se alarga; `size: 58mm auto` genera las páginas que hagan falta (rollo continuo).
- **Ventana emergente bloqueada:** mismo comportamiento/riesgo que la impresión A4 actual (patrón existente, no se agranda el alcance).
- **Montos:** se reutilizan los helpers existentes (`fmtNum`, `fmtDate`, `esc`).

## Verificación

1. Local: abrir un pedido → "Ticket 58mm" → vista previa de impresión debe mostrar página angosta (58mm) a escala 100%, márgenes ninguno, sin grises.
2. Comparar lado a lado: botón "A4" debe seguir abriendo el formato actual sin cambios.
3. Prueba física del usuario en su térmica: imprimir un pedido real y confirmar negro fuerte y nitidez (equivalente a la página de prueba de la impresora).
4. Si el cuerpo de letra resultara chico/grande en el papel, ajustar `font-size` base es un cambio de una línea.
