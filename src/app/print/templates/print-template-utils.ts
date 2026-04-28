import { PrintDocumentData, PrintRenderRequest } from '../models/print.types';

export const PAPER_SIZES: Record<string, string> = {
  letter: '216mm 279mm',
  legal: '216mm 356mm',
  'half-letter': '140mm 216mm',
  'thermal-80mm': '80mm auto',
  'thermal-58mm': '58mm auto'
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function money(value: number): string {
  return `L. ${Number(value || 0).toFixed(2)}`;
}

export function buildMasterPrintCss(request: PrintRenderRequest): string {
  const { settings, format } = request;
  const margins = settings.margins;
  const size = PAPER_SIZES[format] ?? PAPER_SIZES['letter'];
  const isThermal = format.startsWith('thermal');

  return `
    :root {
      --print-ink: #252222;
      --print-muted: #6d6763;
      --print-line: #d9d1cc;
      --print-soft: #f7f4f1;
      --print-accent: #735858;
      --print-font-size: ${settings.fontSize}px;
    }

    @page {
      size: ${size};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }

    * {
      box-sizing: border-box;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background: #ece7e2;
      color: var(--print-ink);
      font-family: "Manrope", "Segoe UI", sans-serif;
      font-size: var(--print-font-size);
      line-height: 1.35;
    }

    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.94);
      border-bottom: 1px solid #ddd4ce;
    }

    .screen-toolbar button {
      border: 1px solid #735858;
      background: #735858;
      color: #fff;
      padding: 9px 14px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .screen-toolbar button.secondary {
      background: #fff;
      color: #735858;
    }

    .print-preview {
      padding: 24px;
    }

    .print-sheet {
      width: ${isThermal ? (format === 'thermal-58mm' ? '58mm' : '80mm') : 'min(100%, 216mm)'};
      min-height: ${isThermal ? 'auto' : format === 'legal' ? '356mm' : format === 'half-letter' ? '140mm' : '279mm'};
      margin: 0 auto;
      background: #fff;
      border: ${isThermal ? '0' : '1px solid #ded6d0'};
      box-shadow: ${isThermal ? 'none' : '0 18px 50px rgba(45, 37, 32, .16)'};
      padding: ${isThermal ? '3mm 2.5mm' : '12mm'};
    }

    .avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .page-break {
      break-before: page;
      page-break-before: always;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      vertical-align: top;
    }

    @media print {
      html,
      body {
        width: auto;
        min-height: auto;
        background: #fff !important;
      }

      .screen-toolbar,
      .no-print,
      nav,
      aside,
      footer,
      button,
      input,
      select,
      textarea,
      dialog {
        display: none !important;
      }

      .print-preview {
        padding: 0 !important;
      }

      .print-sheet {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
      }

      a[href]::after {
        content: "" !important;
      }
    }
  `;
}

export function qrPlaceholder(data: PrintDocumentData): string {
  return escapeHtml(data.documentNumber);
}
