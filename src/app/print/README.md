# Print System Architecture

Este modulo separa la UI normal de los documentos imprimibles. Ningun dashboard, tabla administrativa, navbar, formulario o modal debe imprimirse directamente.

## Estructura

- `models/`: contratos estables para datos, formatos, margenes y configuracion.
- `services/print-settings.service.ts`: configuracion dinamica persistida por navegador o estacion.
- `services/print-document.service.ts`: motor que resuelve formato, aplica CSS maestro, abre vista previa e invoca impresion/PDF.
- `templates/`: utilidades compartidas de CSS, escape HTML, dinero y tamanos de papel.
- `carta/`: plantillas Letter/Carta.
- `legal/`: plantillas Legal.
- `media-carta/`: plantillas Media carta.
- `thermal-80mm/`: plantillas POS 80mm.
- `thermal-58mm/`: plantillas POS 58mm.
- `pdf/`: estrategia para exportacion PDF dedicada.
- `settings/`: panel de ajustes para papel, margenes, logo, QR, firma y fuente.

## Como agregar un documento

1. Crear un `PrintDocumentData` desde el modulo de negocio.
2. Agregar una plantilla por formato, por ejemplo `factura-carta.template.ts` y `factura-80mm.template.ts`.
3. Registrar la plantilla en `PrintDocumentService.renderTemplate`.
4. Llamar `printDocument(data)`, `previewDocument(data)` o `savePdf(data)`.

## PDF

En frontend se usa el dialogo nativo de impresion con destino "Guardar como PDF". Para PDF masivo o legalmente controlado, mover el render HTML del motor a backend y generar con Chromium headless/Puppeteer o Playwright:

- usar el mismo HTML/CSS maestro;
- fijar `printBackground: true`;
- pasar `format` o `width/height` segun el papel;
- definir `margin` desde `PrintSettings`;
- almacenar/auditar el PDF generado si aplica.

## Prevencion de errores comunes

- No imprimir la ruta administrativa actual.
- No depender de escalado del navegador para ajustar documentos.
- Usar `@page` por formato.
- Mantener `title` del documento para evitar `about:blank`.
- Ocultar `.no-print`, botones, inputs, navegacion y modales.
- Para quitar encabezado/pie automatico del navegador, desactivar esa opcion en el dialogo de impresion o generar PDF en servidor/headless.
