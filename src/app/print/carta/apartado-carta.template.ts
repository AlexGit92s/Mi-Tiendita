import { PrintRenderRequest } from '../models/print.types';
import { escapeHtml, money, qrMarkup } from '../templates/print-template-utils';

export function renderApartadoCarta(request: PrintRenderRequest): string {
  const { data, settings } = request;
  const rows = data.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.sku || data.documentNumber)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${money(item.unitPrice)}</td>
      <td class="num">${money(item.total)}</td>
    </tr>
  `).join('');
  const totals = data.totals.map((row) => `
    <div class="total-row ${row.strong ? 'strong' : ''}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${money(row.amount)}</strong>
    </div>
  `).join('');
  const timeline = (data.timeline ?? []).map((item) => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.date ? new Date(item.date).toLocaleString() : '-')}</td>
      <td>${escapeHtml(item.detail || '-')}</td>
    </tr>
  `).join('');

  return `
    <style>
      .doc-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        border-bottom: 2px solid var(--print-line);
        padding-bottom: 16px;
        margin-bottom: 18px;
      }
      .brand-mark {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-logo {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border: 1px solid var(--print-accent);
        color: var(--print-accent);
        font-family: Georgia, serif;
        font-size: 22px;
      }
      .brand-name {
        margin: 0;
        font-family: Georgia, serif;
        font-size: 22px;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .brand-subtitle,
      .muted-label {
        color: var(--print-muted);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .doc-meta {
        text-align: right;
        min-width: 160px;
      }
      .doc-number {
        font-size: 17px;
        font-weight: 900;
        letter-spacing: .12em;
      }
      .status-pill {
        display: inline-block;
        margin-top: 8px;
        border: 1px solid var(--print-accent);
        padding: 3px 8px;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      .box {
        border: 1px solid var(--print-line);
        padding: 10px;
        background: var(--print-soft);
      }
      .box-title {
        margin-bottom: 6px;
        color: var(--print-accent);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .value {
        font-size: 14px;
        font-weight: 800;
      }
      .items th {
        border-bottom: 1px solid var(--print-line);
        color: var(--print-muted);
        font-size: 8px;
        letter-spacing: .12em;
        padding: 7px 6px;
        text-align: left;
        text-transform: uppercase;
      }
      .items td {
        border-bottom: 1px solid #ece7e2;
        padding: 8px 6px;
      }
      .num {
        text-align: right;
        white-space: nowrap;
      }
      .totals {
        margin-left: auto;
        margin-top: 12px;
        width: 240px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #ece7e2;
        padding: 6px 0;
      }
      .total-row.strong {
        border-top: 2px solid var(--print-accent);
        color: var(--print-accent);
        font-size: 15px;
      }
      .timeline {
        margin-top: 18px;
      }
      .timeline th,
      .timeline td {
        border: 1px solid var(--print-line);
        padding: 7px;
        font-size: 10px;
      }
      .qr-signature {
        display: grid;
        grid-template-columns: ${settings.showQr ? '96px ' : ''}1fr ${settings.showSignature ? '180px' : ''};
        gap: 18px;
        align-items: end;
        margin-top: 22px;
      }
      .qr-box {
        width: 96px;
        display: grid;
        gap: 4px;
        text-align: center;
      }
      .qr-box .qr-image {
        width: 96px;
        height: 96px;
        display: block;
        border: 1px solid var(--print-line);
        padding: 4px;
        background: #fff;
      }
      .qr-box .qr-fallback {
        display: block;
        padding: 8px;
        font-size: 8px;
        word-break: break-all;
        border: 1px solid var(--print-line);
      }
      .qr-box .qr-caption {
        font-size: 7.5px;
        letter-spacing: .12em;
        text-transform: uppercase;
        color: var(--print-muted);
      }
      .signature-line {
        border-top: 1px solid var(--print-ink);
        padding-top: 7px;
        text-align: center;
        color: var(--print-muted);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: .12em;
      }
      .doc-footer {
        margin-top: 18px;
        border-top: 1px solid var(--print-line);
        padding-top: 10px;
        color: var(--print-muted);
        font-size: 9px;
      }
    </style>

    <section class="print-sheet">
      <header class="doc-header avoid-break">
        <div class="brand-mark">
          ${settings.showLogo ? `<div class="brand-logo">L</div>` : ''}
          <div>
            <h1 class="brand-name">${escapeHtml(data.brand.name)}</h1>
            <div class="brand-subtitle">${escapeHtml(data.brand.subtitle || data.title)}</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="muted-label">${escapeHtml(data.title)}</div>
          <div class="doc-number">${escapeHtml(data.documentNumber)}</div>
          <div>${escapeHtml(new Date(data.issueDate).toLocaleString())}</div>
          ${data.statusLabel ? `<div class="status-pill">${escapeHtml(data.statusLabel)}</div>` : ''}
        </div>
      </header>

      <div class="info-grid avoid-break">
        <div class="box">
          <div class="box-title">Cliente</div>
          <div class="value">${escapeHtml(data.customer?.name || 'Consumidor final')}</div>
          <div>${escapeHtml(data.customer?.phone || '-')}</div>
          <div>${escapeHtml(data.customer?.email || '-')}</div>
        </div>
        <div class="box">
          <div class="box-title">Resumen</div>
          <div class="value">${escapeHtml(data.summary || data.documentType)}</div>
          <div>Referencia: ${escapeHtml(data.payment?.reference || '-')}</div>
          <div>Transfiere: ${escapeHtml(data.payment?.transferredBy || '-')}</div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Descripcion</th>
            <th class="num">Cant.</th>
            <th class="num">Precio</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals avoid-break">${totals}</div>

      <div class="timeline avoid-break">
        <div class="box-title">Historial reciente</div>
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Fecha</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>${timeline || '<tr><td colspan="3">Sin eventos registrados</td></tr>'}</tbody>
        </table>
      </div>

      <div class="qr-signature avoid-break">
        ${settings.showQr ? `<div class="qr-box">${qrMarkup(data)}<span class="qr-caption">Escanea para seguimiento</span></div>` : ''}
        <div class="doc-footer">${escapeHtml(data.notes || 'Documento generado por el sistema. Valido para seguimiento administrativo y respaldo del cliente.')}</div>
        ${settings.showSignature ? `<div class="signature-line">${escapeHtml(data.signatureLabel || 'Firma autorizada')}</div>` : ''}
      </div>
    </section>
  `;
}
