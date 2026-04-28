import { Injectable, signal } from '@angular/core';
import { PrintPaperFormat, PrintSettings } from '../models/print.types';

const STORAGE_KEY = 'mi_tiendita_print_settings';

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  defaultPaper: 'letter',
  deviceType: 'standard',
  margins: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
  },
  showLogo: true,
  showQr: true,
  showSignature: true,
  fontSize: 11,
  autoPrint: true
};

@Injectable({ providedIn: 'root' })
export class PrintSettingsService {
  readonly settings = signal<PrintSettings>(this.load());

  update(settings: PrintSettings): void {
    const normalized = this.normalize(settings);
    this.settings.set(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  patch(partial: Partial<PrintSettings>): void {
    this.update({
      ...this.settings(),
      ...partial,
      margins: {
        ...this.settings().margins,
        ...(partial.margins ?? {})
      }
    });
  }

  reset(): void {
    this.update(DEFAULT_PRINT_SETTINGS);
  }

  resolveFormat(moduleFormat?: PrintPaperFormat): PrintPaperFormat {
    return moduleFormat ?? this.settings().defaultPaper;
  }

  private load(): PrintSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PRINT_SETTINGS;
      return this.normalize(JSON.parse(raw));
    } catch {
      return DEFAULT_PRINT_SETTINGS;
    }
  }

  private normalize(settings: Partial<PrintSettings>): PrintSettings {
    return {
      defaultPaper: settings.defaultPaper ?? DEFAULT_PRINT_SETTINGS.defaultPaper,
      deviceType: settings.deviceType ?? DEFAULT_PRINT_SETTINGS.deviceType,
      margins: {
        top: this.asNumber(settings.margins?.top, DEFAULT_PRINT_SETTINGS.margins.top),
        right: this.asNumber(settings.margins?.right, DEFAULT_PRINT_SETTINGS.margins.right),
        bottom: this.asNumber(settings.margins?.bottom, DEFAULT_PRINT_SETTINGS.margins.bottom),
        left: this.asNumber(settings.margins?.left, DEFAULT_PRINT_SETTINGS.margins.left)
      },
      showLogo: settings.showLogo ?? DEFAULT_PRINT_SETTINGS.showLogo,
      showQr: settings.showQr ?? DEFAULT_PRINT_SETTINGS.showQr,
      showSignature: settings.showSignature ?? DEFAULT_PRINT_SETTINGS.showSignature,
      fontSize: this.asNumber(settings.fontSize, DEFAULT_PRINT_SETTINGS.fontSize),
      autoPrint: settings.autoPrint ?? DEFAULT_PRINT_SETTINGS.autoPrint
    };
  }

  private asNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
