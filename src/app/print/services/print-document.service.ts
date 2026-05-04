import { Injectable, inject } from '@angular/core';
import QRCode from 'qrcode';
import { renderApartadoCarta } from '../carta/apartado-carta.template';
import { renderApartado58mm } from '../thermal-58mm/apartado-58mm.template';
import { renderApartado80mm } from '../thermal-80mm/apartado-80mm.template';
import { PrintDocumentData, PrintPaperFormat, PrintRenderRequest } from '../models/print.types';
import { buildMasterPrintCss, escapeHtml } from '../templates/print-template-utils';
import { PrintSettingsService } from './print-settings.service';

@Injectable({ providedIn: 'root' })
export class PrintDocumentService {
  private settingsService = inject(PrintSettingsService);

  printDocument(data: PrintDocumentData, format?: PrintPaperFormat): void {
    void this.openDocument(data, format, 'print');
  }

  savePdf(data: PrintDocumentData, format?: PrintPaperFormat): void {
    void this.openDocument(data, format, 'pdf');
  }

  previewDocument(data: PrintDocumentData, format?: PrintPaperFormat): void {
    void this.openDocument(data, format, 'preview');
  }

  render(request: PrintRenderRequest): string {
    const body = this.renderTemplate(request);
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(request.data.title)} ${escapeHtml(request.data.documentNumber)}</title>
        <style>${buildMasterPrintCss(request)}</style>
      </head>
      <body>
        <div class="screen-toolbar no-print">
          <button type="button" onclick="window.print()">Imprimir</button>
          <button type="button" class="secondary" onclick="window.print()">Guardar PDF</button>
          <button type="button" class="secondary" onclick="window.close()">Cerrar</button>
        </div>
        <main class="print-preview">${body}</main>
        ${request.settings.autoPrint && request.mode !== 'preview' ? '<script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 250); });</script>' : ''}
      </body>
      </html>
    `;
  }

  private async openDocument(data: PrintDocumentData, format: PrintPaperFormat | undefined, mode: 'print' | 'pdf' | 'preview'): Promise<void> {
    const resolvedFormat = this.settingsService.resolveFormat(format);
    const settings = this.settingsService.settings();
    const popup = window.open('', '_blank', 'width=980,height=760');
    if (!popup) {
      alert('No se pudo abrir la vista de impresion. Revisa el bloqueador de ventanas emergentes.');
      return;
    }

    popup.document.open();
    popup.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(data.title)}</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;color:#735858;}</style></head><body>Generando ticket...</body></html>`);
    popup.document.close();

    const enrichedData: PrintDocumentData = {
      ...data,
      qrDataUrl: settings.showQr ? await this.generateQrDataUrl(data.qrValue) : undefined
    };

    popup.document.open();
    popup.document.write(this.render({
      data: enrichedData,
      format: resolvedFormat,
      settings,
      mode
    }));
    popup.document.close();
  }

  private async generateQrDataUrl(value: string | undefined): Promise<string | undefined> {
    if (!value) return undefined;
    try {
      return await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: { dark: '#252222', light: '#ffffff' }
      });
    } catch (error) {
      console.error('No se pudo generar el QR de seguimiento:', error);
      return undefined;
    }
  }

  private renderTemplate(request: PrintRenderRequest): string {
    if (request.data.documentType === 'apartado') {
      if (request.format === 'thermal-58mm') return renderApartado58mm(request);
      if (request.format === 'thermal-80mm') return renderApartado80mm(request);
      return renderApartadoCarta(request);
    }

    return renderApartadoCarta(request);
  }
}
