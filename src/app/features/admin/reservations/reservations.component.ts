import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { ProductTrackingEvent, Reservation } from '../../../core/types';
import { SupabaseService } from '../../../core/supabase.service';

type ReservationStatus = Reservation['status'];

interface ReservationWithProduct extends Reservation {
  products?: { name: string; price: number; images: string[] };
}

interface DepositDraft {
  reference: string;
  transferredBy: string;
  amount: string;
}

interface EventDraft {
  eventKey: string;
  notes: string;
}

interface CorrectionDraft {
  reason: string;
}

interface TrackingEventEffect {
  nextStatus?: ReservationStatus;
  message: string;
  stockAction?: 'commit' | 'release';
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.css'
})
export class ReservationsComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  reservations = signal<ReservationWithProduct[]>([]);
  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');
  readonly trackingEventOptions = [
    { value: 'reserva_creada', label: 'Reserva creada' },
    { value: 'vendido', label: 'Ya vendido' },
    { value: 'empaquetado', label: 'Empaquetado' },
    { value: 'en_camino', label: 'En camino' },
    { value: 'recibido', label: 'Recibido' },
    { value: 'cerrado_pagado', label: 'Cerrado y pagado' },
    { value: 'cerrado_devuelto', label: 'Cerrado devuelto' },
    { value: 'otro', label: 'Otro caso' },
    { value: 'correccion_administrativa', label: 'Correccion administrativa' }
  ] as const;
  readonly eventEffects: Record<string, TrackingEventEffect> = {
    reserva_creada: { nextStatus: 'pendiente', message: 'Reserva creada y pendiente de deposito.' },
    deposito_confirmado: { message: 'Pago registrado.', stockAction: 'commit' },
    deposito_revertido: { nextStatus: 'pendiente', message: 'Deposito revertido.', stockAction: 'release' },
    empaquetado: { message: 'Producto empaquetado.' },
    en_camino: { message: 'Producto en camino.' },
    recibido: { nextStatus: 'entregado', message: 'Producto recibido por cliente.', stockAction: 'commit' },
    cerrado_pagado: { nextStatus: 'finalizado', message: 'Caso cerrado y pagado.', stockAction: 'commit' },
    cerrado_devuelto: { nextStatus: 'cancelado', message: 'Caso cerrado como devuelto.', stockAction: 'release' },
    vendido: { nextStatus: 'finalizado', message: 'Producto vendido.', stockAction: 'commit' },
    otro: { message: 'Evento administrativo agregado.' },
    correccion_administrativa: { message: 'Correccion administrativa registrada.' }
  };

  activeDepositReservationId = signal<string | null>(null);
  activeTimelineReservationId = signal<string | null>(null);
  activeCorrectionReservationId = signal<string | null>(null);
  depositDrafts = signal<Record<string, DepositDraft>>({});
  eventDrafts = signal<Record<string, EventDraft>>({});
  correctionDrafts = signal<Record<string, CorrectionDraft>>({});
  trackingHistory = signal<Record<string, ProductTrackingEvent[]>>({});
  feedback = signal<Record<string, string>>({});

  filteredReservations = computed(() => {
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.reservations();
    if (status !== 'all') list = list.filter((r) => r.status === status);
    if (query) list = list.filter((r) => this.matchesSearch(r, query));
    return list;
  });

  private matchesSearch(r: ReservationWithProduct, q: string): boolean {
    const haystacks = [
      this.getTicketNumber(r),
      r.id ?? '',
      r.customer_name ?? '',
      r.customer_phone ?? '',
      r.customer_email ?? '',
      r.products?.name ?? '',
      r.deposit_reference ?? '',
      r.deposit_transferred_by ?? ''
    ];
    return haystacks.some((h) => h.toString().toLowerCase().includes(q));
  }

  setSearchQuery(value: string) {
    this.searchQuery.set(value);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  counts = computed(() => {
    const all = this.reservations();
    return {
      all: all.length,
      pendiente: all.filter((reservation) => reservation.status === 'pendiente').length,
      pagado: all.filter((reservation) => reservation.status === 'pagado').length,
      entregado: all.filter((reservation) => reservation.status === 'entregado').length,
      finalizado: all.filter((reservation) => reservation.status === 'finalizado').length,
      cancelado: all.filter((reservation) => reservation.status === 'cancelado').length
    };
  });

  async ngOnInit() {
    await this.loadReservations();
  }

  async loadReservations() {
    try {
      const { data } = await this.supabase.client
        .from('reservations')
        .select('*, products(name, price, images)')
        .order('created_at', { ascending: false });

      if (!data) return;

      const reservations = data as ReservationWithProduct[];
      this.reservations.set(reservations);
      await this.loadTrackingHistory(reservations);
    } catch (error) {
      console.error(error);
    }
  }

  async loadTrackingHistory(reservations: ReservationWithProduct[]) {
    const reservationIds = reservations.map((reservation) => reservation.id).filter(Boolean) as string[];
    if (reservationIds.length === 0) {
      this.trackingHistory.set({});
      return;
    }

    try {
      const { data } = await this.supabase.client
        .from('product_tracking_events')
        .select('*')
        .in('reservation_id', reservationIds)
        .order('created_at', { ascending: false });

      const grouped = (data as ProductTrackingEvent[] | null)?.reduce<Record<string, ProductTrackingEvent[]>>((acc, item) => {
        const reservationId = item.reservation_id;
        if (!reservationId) return acc;
        acc[reservationId] = [...(acc[reservationId] ?? []), item];
        return acc;
      }, {}) ?? {};

      this.trackingHistory.set(grouped);
    } catch (error) {
      console.error('Error loading tracking history:', error);
    }
  }

  async confirmDeposit(id: string) {
    const reservation = this.reservations().find((item) => item.id === id);
    if (!reservation) return;

    const draft = this.getDepositDraft(id, reservation);
    const transferredAmount = this.parseDepositAmount(draft.amount);
    if (!draft.reference.trim() || !draft.transferredBy.trim() || transferredAmount <= 0) {
      this.setFeedback(id, 'Ingresa referencia, monto transferido y quien transfiere.');
      return;
    }

    const needsCorrection = this.isLockedReservation(reservation) || !!reservation.fee_paid;
    const correctionReason = this.requireCorrectionReason(
      id,
      reservation,
      needsCorrection ? 'Este deposito ya forma parte del historial. Registra motivo de correccion.' : ''
    );
    if (correctionReason === null) return;

    try {
      const totalAmount = this.getTotalAmount(reservation);
      const isFullPayment = totalAmount > 0 && transferredAmount >= totalAmount;
      const updatePayload: Partial<Reservation> = {
        fee_paid: isFullPayment,
        deposit_amount: transferredAmount,
        deposit_reference: draft.reference.trim() || null,
        deposit_transferred_by: draft.transferredBy.trim(),
        deposit_confirmed_at: new Date().toISOString()
      };

      const nextStatus =
        reservation.status === 'pendiente' || reservation.status === 'pagado'
          ? (isFullPayment ? 'pagado' : 'pendiente')
          : reservation.status;

      await this.supabase.update('reservations', id, {
        ...updatePayload,
        status: nextStatus
      });

      await this.applyStockAction(reservation, 'commit');

      this.reservations.update((list) =>
        list.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updatePayload,
                stock_committed: true,
                stock_committed_at: item.stock_committed_at ?? new Date().toISOString(),
                status: nextStatus as ReservationStatus
              }
            : item
        )
      );

      await this.logTrackingEvent(
        reservation,
        reservation.fee_paid ? 'deposito_corregido' : 'deposito_confirmado',
        reservation.fee_paid ? 'Pago corregido' : (isFullPayment ? 'Pago completo registrado' : 'Pago parcial registrado'),
        {
          amount: updatePayload.deposit_amount,
          pending_amount: Math.max(0, totalAmount - transferredAmount),
          reference: updatePayload.deposit_reference,
          transferred_by: updatePayload.deposit_transferred_by
        },
        null,
        correctionReason
      );

      if (nextStatus !== reservation.status) {
        await this.recordDerivedStatusChange(reservation, nextStatus as ReservationStatus, 'deposito_confirmado', correctionReason);
      }

      this.activeDepositReservationId.set(null);
      this.finishCorrection(
        id,
        correctionReason
          ? 'Correccion de pago registrada.'
          : (isFullPayment
            ? 'Pago completo registrado y marcado como pagado.'
            : `Pago parcial registrado. Pendiente L. ${Math.max(0, totalAmount - transferredAmount).toFixed(2)}.`)
      );
    } catch (error) {
      console.error(error);
      alert('Error al guardar el pago.');
    }
  }

  async clearDepositConfirmation(id: string) {
    const reservation = this.reservations().find((item) => item.id === id);
    if (!reservation) return;

    const correctionReason = this.requireCorrectionReason(id, reservation, 'Revertir un deposito requiere motivo de correccion.');
    if (correctionReason === null) return;

    try {
      const nextStatus = reservation.status === 'pagado' ? 'pendiente' : reservation.status;
      await this.supabase.update('reservations', id, {
        status: nextStatus,
        fee_paid: false,
        deposit_amount: 0,
        deposit_reference: null,
        deposit_transferred_by: null,
        deposit_confirmed_at: null
      });

      await this.applyStockAction(reservation, 'release');

      this.reservations.update((list) =>
        list.map((item) =>
          item.id === id
            ? {
                ...item,
                fee_paid: false,
                deposit_amount: 0,
                deposit_reference: null,
                deposit_transferred_by: null,
                deposit_confirmed_at: null,
                stock_committed: false,
                stock_committed_at: null,
                status: nextStatus as ReservationStatus
              }
            : item
        )
      );

      await this.logTrackingEvent(
        reservation,
        'deposito_revertido',
        'Pago revertido',
        null,
        null,
        correctionReason
      );

      if (nextStatus !== reservation.status) {
        await this.recordDerivedStatusChange(reservation, nextStatus as ReservationStatus, 'deposito_revertido', correctionReason);
      }

      this.finishCorrection(id, 'Correccion de pago registrada.');
    } catch (error) {
      console.error(error);
      alert('Error al revertir el pago.');
    }
  }

  async addTrackingEvent(id: string) {
    const reservation = this.reservations().find((item) => item.id === id);
    if (!reservation) return;

    const draft = this.getEventDraft(id);
    const event = this.trackingEventOptions.find((option) => option.value === draft.eventKey);
    if (!event) {
      this.setFeedback(id, 'Selecciona un evento de seguimiento.');
      return;
    }

    const correctionReason = this.requireCorrectionReason(id, reservation, 'Para registrar cambios sobre un caso cerrado, indica motivo de correccion.');
    if (correctionReason === null) return;

    try {
      const effect = this.getEventEffect(draft.eventKey);

      if (effect.stockAction) {
        await this.applyStockAction(reservation, effect.stockAction);
      }

      if (effect.nextStatus && effect.nextStatus !== reservation.status) {
        await this.applyDerivedStatus(reservation, effect.nextStatus, draft.eventKey);
      }

      await this.logTrackingEvent(
        reservation,
        draft.eventKey,
        event.label,
        {
          note: draft.notes.trim() || null,
          effect_message: effect.message,
          auto_status: effect.nextStatus ?? null
        },
        draft.notes.trim() || null,
        correctionReason
      );

      if (effect.nextStatus && effect.nextStatus !== reservation.status) {
        await this.recordDerivedStatusChange(reservation, effect.nextStatus, draft.eventKey, correctionReason);
      }

      this.eventDrafts.update((current) => ({
        ...current,
        [id]: {
          eventKey: 'empaquetado',
          notes: ''
        }
      }));

      this.activeTimelineReservationId.set(id);
      this.finishCorrection(id, correctionReason ? 'Correccion administrativa agregada al historial.' : effect.message);
    } catch (error) {
      console.error(error);
      alert('Error al guardar evento de seguimiento.');
    }
  }

  async logTrackingEvent(
    reservation: ReservationWithProduct,
    eventKey: string,
    eventLabel: string,
    metadata?: Record<string, any> | null,
    notes?: string | null,
    correctionReason?: string | false
  ) {
    if (!reservation.id) return;

    const actorEmail = this.auth.user()?.email ?? null;
    const isCorrection = typeof correctionReason === 'string' && correctionReason.trim().length > 0;

    const event = await this.supabase.create('product_tracking_events', {
      product_id: reservation.product_id,
      reservation_id: reservation.id,
      source: 'reservation',
      event_key: eventKey,
      event_label: eventLabel,
      notes: notes ?? null,
      metadata: metadata ?? null,
      is_correction: isCorrection,
      correction_reason: isCorrection ? correctionReason.trim() : null,
      actor_email: actorEmail
    });

    this.trackingHistory.update((current) => ({
      ...current,
      [reservation.id!]: [event as ProductTrackingEvent, ...(current[reservation.id!] ?? [])]
    }));
  }

  private async adjustStock(productId: string, amount: number) {
    try {
      const { data: product } = await this.supabase.client
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();

      if (product) {
        const newStock = Math.max(0, (product.stock || 0) + amount);
        await this.supabase.update('products', productId, { stock: newStock });
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  }

  private async applyStockAction(
    reservation: ReservationWithProduct,
    action: 'commit' | 'release'
  ) {
    if (!reservation.id || !reservation.product_id) return;

    const shouldCommit = action === 'commit';
    const shouldRelease = action === 'release';

    if (shouldCommit && reservation.stock_committed) return;
    if (shouldRelease && !reservation.stock_committed) return;

    await this.adjustStock(reservation.product_id, shouldCommit ? -1 : 1);

    const stockPayload = {
      stock_committed: shouldCommit,
      stock_committed_at: shouldCommit ? new Date().toISOString() : null
    };

    await this.supabase.update('reservations', reservation.id, stockPayload);

    this.reservations.update((list) =>
      list.map((item) =>
        item.id === reservation.id
          ? {
              ...item,
              ...stockPayload
            }
          : item
      )
    );
  }

  private async applyDerivedStatus(
    reservation: ReservationWithProduct,
    nextStatus: ReservationStatus,
    originEvent: string
  ) {
    await this.supabase.update('reservations', reservation.id!, { status: nextStatus });

    if (reservation.fee_paid && reservation.product_id) {
      if (nextStatus === 'cancelado' && reservation.status !== 'cancelado') {
        await this.adjustStock(reservation.product_id, 1);
      } else if (reservation.status === 'cancelado' && nextStatus !== 'cancelado') {
        await this.adjustStock(reservation.product_id, -1);
      }
    }

    this.reservations.update((list) =>
      list.map((item) => item.id === reservation.id ? { ...item, status: nextStatus } : item)
    );
  }

  private async recordDerivedStatusChange(
    reservation: ReservationWithProduct,
    nextStatus: ReservationStatus,
    originEvent: string,
    correctionReason?: string | false
  ) {
    await this.logTrackingEvent(
      reservation,
      'estado_reserva',
      `Estado: ${this.getStatusConfig(nextStatus).label}`,
      { from: reservation.status, to: nextStatus, origin_event: originEvent },
      null,
      correctionReason
    );
  }

  isLockedReservation(reservation: ReservationWithProduct) {
    return reservation.status === 'finalizado' || reservation.status === 'cancelado';
  }

  isCorrectionActive(id: string) {
    return this.activeCorrectionReservationId() === id;
  }

  requiresCorrectionMode(reservation: ReservationWithProduct) {
    return this.isLockedReservation(reservation) || this.hasPaymentRecord(reservation);
  }

  beginCorrection(id: string) {
    this.activeCorrectionReservationId.set(id);
    this.setFeedback(id, 'Modo correccion activo. Todo cambio quedara marcado como correccion administrativa.');
  }

  cancelCorrection() {
    this.activeCorrectionReservationId.set(null);
  }

  requireCorrectionReason(id: string, reservation: ReservationWithProduct, lockedMessage: string) {
    const requiresCorrection = this.isLockedReservation(reservation) || this.isCorrectionActive(id);
    if (!requiresCorrection) return false;

    const reason = this.getCorrectionDraft(id).reason.trim();
    if (!reason) {
      this.setFeedback(id, lockedMessage || 'Registra motivo de correccion antes de editar.');
      return null;
    }

    return reason;
  }

  finishCorrection(id: string, message: string) {
    this.correctionDrafts.update((current) => ({
      ...current,
      [id]: { reason: '' }
    }));
    this.activeCorrectionReservationId.set(null);
    this.setFeedback(id, message);
  }

  getStatusConfig(status: string) {
    const configs: Record<string, { label: string; class: string; dot: string; rowAccent: string }> = {
      pendiente: {
        label: 'Pendiente',
        class: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        rowAccent: 'border-l-amber-400'
      },
      pagado: {
        label: 'Pagado',
        class: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500',
        rowAccent: 'border-l-sky-400'
      },
      entregado: {
        label: 'Entregado',
        class: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        rowAccent: 'border-l-emerald-400'
      },
      finalizado: {
        label: 'Finalizado',
        class: 'bg-violet-50 text-violet-700 border-violet-200',
        dot: 'bg-violet-500',
        rowAccent: 'border-l-violet-400'
      },
      cancelado: {
        label: 'Cancelado',
        class: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
        rowAccent: 'border-l-red-400'
      }
    };

    return configs[status] || configs['pendiente'];
  }

  getEventEffect(eventKey: string): TrackingEventEffect {
    return this.eventEffects[eventKey] ?? { message: 'Evento agregado.' };
  }

  getReservationSummary(reservation: ReservationWithProduct) {
    const history = reservation.id ? this.getHistory(reservation.id) : [];
    const latestEffect = history.find((item) => item.metadata?.['effect_message'])?.metadata?.['effect_message'];

    if (this.isFullyPaid(reservation)) {
      return 'Pagado completo, pendiente de entrega o envio';
    }

    if (this.getTransferredAmount(reservation) > 0) {
      return `Pago parcial registrado. Pendiente L. ${this.getPendingAmount(reservation).toFixed(2)}`;
    }

    if (reservation.stock_committed) {
      return 'Stock comprometido';
    }

    return latestEffect ?? 'Pendiente de deposito';
  }

  getDepositAmount(reservation: ReservationWithProduct) {
    return Math.round(((reservation.products?.price ?? 0) * 0.5) * 100) / 100;
  }

  getTotalAmount(reservation: ReservationWithProduct) {
    return Math.round((reservation.products?.price ?? 0) * 100) / 100;
  }

  getTransferredAmount(reservation: ReservationWithProduct) {
    return Math.round((Number(reservation.deposit_amount ?? 0)) * 100) / 100;
  }

  getPendingAmount(reservation: ReservationWithProduct) {
    return Math.max(0, Math.round((this.getTotalAmount(reservation) - this.getTransferredAmount(reservation)) * 100) / 100);
  }

  getRemainingAmount(reservation: ReservationWithProduct) {
    return this.getPendingAmount(reservation);
  }

  getTicketNumber(reservation: ReservationWithProduct) {
    return `APT-${(reservation.id ?? '').slice(0, 8).toUpperCase() || 'MANUAL'}`;
  }

  generateClientTicket(reservation: ReservationWithProduct) {
    const ticketWindow = window.open('', '_blank', 'width=900,height=700');
    if (!ticketWindow) {
      alert('No se pudo abrir la ventana del ticket.');
      return;
    }

    const history = reservation.id ? this.getHistory(reservation.id).slice(0, 5) : [];
    const productName = reservation.products?.name ?? 'Producto';
    const total = reservation.products?.price ?? 0;
    const transferred = this.getTransferredAmount(reservation);
    const remaining = this.getPendingAmount(reservation);
    const reference = reservation.deposit_reference || '-';
    const transferredBy = reservation.deposit_transferred_by || '-';
    const issueDate = new Date().toLocaleString();
    const ticketNumber = this.getTicketNumber(reservation);
    const depositLabel = transferred > 0 ? 'Monto transferido' : 'Anticipo requerido';
    const remainingLabel = transferred > 0 ? 'Monto pendiente' : 'Saldo total pendiente';
    const paymentSectionTitle = transferred > 0 ? 'Confirmacion de pago' : 'Pago pendiente';
    const timelineHtml = history.length
      ? history.map((item) => `
          <tr>
            <td>${item.event_label}</td>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
            <td>${item.notes ?? item.metadata?.['effect_message'] ?? '-'}</td>
          </tr>
        `).join('')
      : `
        <tr>
          <td colspan="3">Sin eventos registrados</td>
        </tr>
      `;

    ticketWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ticket de Apartado</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #2f2b2b;
            margin: 0;
            background: #f6f3f1;
          }
          .sheet {
            width: 820px;
            margin: 24px auto;
            background: #ffffff;
            border: 1px solid #eadfda;
            padding: 32px;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            border-bottom: 2px solid #efe2dc;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          .brand {
            font-size: 28px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #6d5853;
            margin: 0;
          }
          .subtitle {
            margin: 8px 0 0;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            color: #8b7d78;
          }
          .ticket-meta {
            text-align: right;
            font-size: 12px;
            color: #7f7571;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 22px;
          }
          .card {
            border: 1px solid #efe2dc;
            padding: 16px;
            background: #fcfaf8;
          }
          .label {
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #8b7d78;
            margin-bottom: 6px;
          }
          .value {
            font-size: 16px;
            color: #312d2d;
            margin-bottom: 10px;
          }
          .totals {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 22px;
          }
          .total-box {
            border: 1px solid #efe2dc;
            padding: 14px;
            text-align: center;
            background: #ffffff;
          }
          .total-box strong {
            display: block;
            font-size: 22px;
            margin-top: 6px;
            color: #6d5853;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #efe2dc;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #fcfaf8;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 10px;
            color: #8b7d78;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #efe2dc;
            font-size: 11px;
            color: #7f7571;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .sheet {
              width: 100%;
              margin: 0;
              border: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <h1 class="brand">Mi Tiendita L'Amour</h1>
              <p class="subtitle">Ticket de Apartado para Cliente</p>
            </div>
            <div class="ticket-meta">
              <div><strong>${ticketNumber}</strong></div>
              <div>Emitido: ${issueDate}</div>
              <div>Estado: ${this.getStatusConfig(reservation.status).label}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="label">Cliente</div>
              <div class="value">${reservation.customer_name}</div>
              <div>${reservation.customer_phone}</div>
              <div>${reservation.customer_email ?? '-'}</div>
            </div>
            <div class="card">
              <div class="label">Apartado</div>
              <div class="value">${productName}</div>
              <div>Fecha cita: ${reservation.reservation_date ? new Date(reservation.reservation_date).toLocaleDateString() : '-'}</div>
              <div>Seguimiento: ${this.getReservationSummary(reservation)}</div>
            </div>
          </div>

          <div class="totals">
            <div class="total-box">
              Total
              <strong>L. ${total}</strong>
            </div>
            <div class="total-box">
              ${depositLabel}
              <strong>L. ${transferred > 0 ? transferred : this.getDepositAmount(reservation)}</strong>
            </div>
            <div class="total-box">
              ${remainingLabel}
              <strong>L. ${remaining}</strong>
            </div>
          </div>

          <div class="card">
            <div class="label">${paymentSectionTitle}</div>
            <table>
              <tr>
                <th>Referencia</th>
                <th>Transfiere</th>
                <th>Monto</th>
                <th>Confirmado</th>
              </tr>
              <tr>
                <td>${reference}</td>
                <td>${transferredBy}</td>
                <td>L. ${transferred}</td>
                <td>${reservation.deposit_confirmed_at ? new Date(reservation.deposit_confirmed_at).toLocaleString() : '-'}</td>
              </tr>
            </table>
          </div>

          <div class="card" style="margin-top: 18px;">
            <div class="label">Seguimiento reciente</div>
            <table>
              <tr>
                <th>Evento</th>
                <th>Fecha</th>
                <th>Detalle</th>
              </tr>
              ${timelineHtml}
            </table>
          </div>

          <div class="footer">
            Gracias por su preferencia. Este ticket resume su apartado y puede guardarse como PDF desde la opcion de impresion del navegador.
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    ticketWindow.document.close();
  }

  getDepositDraft(id: string, reservation?: ReservationWithProduct): DepositDraft {
    return this.depositDrafts()[id] ?? {
      reference: reservation?.deposit_reference ?? '',
      transferredBy: reservation?.deposit_transferred_by ?? '',
      amount: reservation?.deposit_amount ? String(reservation.deposit_amount) : String(this.getDepositAmount(reservation ?? {} as ReservationWithProduct))
    };
  }

  updateDepositDraft(id: string, field: keyof DepositDraft, value: string) {
    const draft = this.getDepositDraft(id);
    this.depositDrafts.update((state) => ({
      ...state,
      [id]: {
        ...draft,
        [field]: value
      }
    }));
  }

  getEventDraft(id: string): EventDraft {
    return this.eventDrafts()[id] ?? {
      eventKey: 'empaquetado',
      notes: ''
    };
  }

  updateEventDraft(id: string, field: keyof EventDraft, value: string) {
    const draft = this.getEventDraft(id);
    this.eventDrafts.update((state) => ({
      ...state,
      [id]: {
        ...draft,
        [field]: value
      }
    }));
  }

  getCorrectionDraft(id: string): CorrectionDraft {
    return this.correctionDrafts()[id] ?? { reason: '' };
  }

  updateCorrectionDraft(id: string, value: string) {
    this.correctionDrafts.update((state) => ({
      ...state,
      [id]: { reason: value }
    }));
  }

  openDepositForm(id: string, reservation: ReservationWithProduct) {
    const draft = this.getDepositDraft(id, reservation);
    this.depositDrafts.update((state) => ({ ...state, [id]: draft }));
    this.activeDepositReservationId.set(id);
    this.setFeedback(id, '');
  }

  closeDepositForm() {
    this.activeDepositReservationId.set(null);
  }

  toggleTimeline(id: string) {
    this.activeTimelineReservationId.set(this.activeTimelineReservationId() === id ? null : id);
    this.setFeedback(id, '');
  }

  getHistory(id?: string) {
    if (!id) return [];
    return this.trackingHistory()[id] ?? [];
  }

  setFilter(status: string) {
    this.statusFilter.set(status);
  }

  setFeedback(id: string, message: string) {
    this.feedback.update((current) => ({ ...current, [id]: message }));
  }

  private parseDepositAmount(value: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 0;
    return Math.round(parsed * 100) / 100;
  }

  private isFullyPaid(reservation: ReservationWithProduct) {
    return this.getTransferredAmount(reservation) >= this.getTotalAmount(reservation) && this.getTotalAmount(reservation) > 0;
  }

  private hasPaymentRecord(reservation: ReservationWithProduct) {
    return this.getTransferredAmount(reservation) > 0 || !!reservation.deposit_confirmed_at;
  }
}
