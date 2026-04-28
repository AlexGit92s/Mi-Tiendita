import { PrintRenderRequest } from '../models/print.types';
import { escapeHtml, money, qrPlaceholder } from '../templates/print-template-utils';

export function renderApartado80mm(request: PrintRenderRequest): string {
  const { data, settings } = request;
  const rows = data.items.map((item) => `
    <div class="line-item">
      <div>${escapeHtml(item.description)}</div>
      <div class="line-row">
        <span>${item.quantity} x ${money(item.unitPrice)}</span>
        <strong>${money(item.total)}</strong>
      </div>
    </div>
  `).join('');
  const totals = data.totals.map((row) => `
    <div class="line-row ${row.strong ? 'grand' : ''}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${money(row.amount)}</strong>
    </div>
  `).join('');

  return `
    <style>
      .thermal-doc {
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: ${Math.max(9, settings.fontSize - 1)}px;
        color: #111;
      }
      .center { text-align: center; }
      .brand {
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .08em;
      }
      .muted {
        color: #555;
        font-size: 9px;
      }
      .separator {
        border-top: 1px dashed #222;
        margin: 7px 0;
      }
      .line-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .line-item {
        padding: 4px 0;
        border-bottom: 1px dotted #bbb;
      }
      .grand {
        border-top: 1px solid #111;
        margin-top: 5px;
        padding-top: 5px;
        font-size: 13px;
      }
      .ticket-code {
        margin: 6px 0;
        border: 1px solid #111;
        padding: 5px;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: .08em;
      }
      .qr-box {
        margin: 8px auto 0;
        width: 32mm;
        min-height: 22mm;
        border: 1px solid #111;
        padding: 4px;
        display: grid;
        place-items: center;
        word-break: break-all;
        font-size: 8px;
      }
    </style>

    <section class="print-sheet thermal-doc">
      <div class="center">
        ${settings.showLogo ? '<div class="brand">Mi Tiendita L&apos;Amour</div>' : `<div class="brand">${escapeHtml(data.brand.name)}</div>`}
        <div class="muted">${escapeHtml(data.title)}</div>
        <div class="ticket-code">${escapeHtml(data.documentNumber)}</div>
        <div>${escapeHtml(new Date(data.issueDate).toLocaleString())}</div>
        ${data.statusLabel ? `<div><strong>${escapeHtml(data.statusLabel)}</strong></div>` : ''}
      </div>
      <div class="separator"></div>
      <div><strong>Cliente:</strong> ${escapeHtml(data.customer?.name || '-')}</div>
      <div><strong>Telefono:</strong> ${escapeHtml(data.customer?.phone || '-')}</div>
      <div class="separator"></div>
      ${rows}
      <div class="separator"></div>
      ${totals}
      <div class="separator"></div>
      <div><strong>Referencia:</strong> ${escapeHtml(data.payment?.reference || '-')}</div>
      <div><strong>Resumen:</strong> ${escapeHtml(data.summary || '-')}</div>
      ${settings.showQr ? `<div class="qr-box">${qrPlaceholder(data)}</div>` : ''}
      <p class="center muted">${escapeHtml(data.notes || 'Conserve este comprobante para seguimiento.')}</p>
    </section>
  `;
}
