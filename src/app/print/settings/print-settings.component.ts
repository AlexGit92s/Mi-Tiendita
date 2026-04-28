import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrintPaperFormat } from '../models/print.types';
import { PrintDocumentService } from '../services/print-document.service';
import { PrintSettingsService } from '../services/print-settings.service';

@Component({
  selector: 'app-print-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './print-settings.component.html',
  styleUrl: './print-settings.component.css'
})
export class PrintSettingsComponent {
  private settingsService = inject(PrintSettingsService);
  private printDocument = inject(PrintDocumentService);

  readonly settings = this.settingsService.settings;
  readonly paperOptions: Array<{ value: PrintPaperFormat; label: string; size: string }> = [
    { value: 'letter', label: 'Carta', size: '216 x 279 mm' },
    { value: 'legal', label: 'Legal', size: '216 x 356 mm' },
    { value: 'half-letter', label: 'Media carta', size: '140 x 216 mm' },
    { value: 'thermal-80mm', label: 'Termica 80mm', size: 'Rollo 80 mm' },
    { value: 'thermal-58mm', label: 'Termica 58mm', size: 'Rollo 58 mm' }
  ];
  readonly currentPaper = computed(() => this.paperOptions.find((item) => item.value === this.settings().defaultPaper));

  updatePaper(value: string): void {
    this.settingsService.patch({
      defaultPaper: value as PrintPaperFormat,
      deviceType: value.startsWith('thermal') ? 'thermal' : 'standard'
    });
  }

  updateMargin(key: 'top' | 'right' | 'bottom' | 'left', value: string): void {
    this.settingsService.patch({
      margins: {
        ...this.settings().margins,
        [key]: Number(value)
      }
    });
  }

  updateBoolean(key: 'showLogo' | 'showQr' | 'showSignature' | 'autoPrint', value: boolean): void {
    this.settingsService.patch({ [key]: value });
  }

  updateFontSize(value: string): void {
    this.settingsService.patch({ fontSize: Number(value) });
  }

  reset(): void {
    this.settingsService.reset();
  }

  previewSample(): void {
    this.printDocument.previewDocument({
      documentType: 'apartado',
      title: 'Ticket de Apartado',
      documentNumber: 'APT-DEMO123',
      issueDate: new Date().toISOString(),
      statusLabel: 'Pendiente',
      brand: {
        name: 'Mi Tiendita L\'Amour',
        subtitle: 'Documento de demostracion'
      },
      customer: {
        name: 'Cliente de muestra',
        phone: '9999-9999',
        email: 'cliente@correo.com'
      },
      summary: 'Vestido reservado para cita de prueba',
      qrValue: `${window.location.origin}/track/APT-DEMO123`,
      payment: {
        reference: 'REF-001',
        transferredBy: 'Cliente de muestra'
      },
      items: [
        {
          sku: 'APT-DEMO123',
          description: 'Vestido formal de muestra',
          quantity: 1,
          unitPrice: 2500,
          total: 2500
        }
      ],
      totals: [
        { label: 'Total', amount: 2500 },
        { label: 'Anticipo', amount: 1250 },
        { label: 'Pendiente', amount: 1250, strong: true }
      ],
      timeline: [
        { label: 'Reserva creada', date: new Date().toISOString(), detail: 'Documento de prueba' }
      ],
      signatureLabel: 'Firma de autorizacion'
    }, this.settings().defaultPaper);
  }
}
