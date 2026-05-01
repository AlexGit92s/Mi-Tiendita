import { Component, computed, inject, OnInit, TemplateRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Dialog, DialogModule, DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../../core/auth.service';
import { ProductTrackingEvent, Reservation } from '../../../core/types';
import { SupabaseService } from '../../../core/supabase.service';
import { PrintDocumentData } from '../../../print/models/print.types';
import { PrintDocumentService } from '../../../print/services/print-document.service';

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
  detachesProduct?: boolean;
}

type TrackingEventGroup = 'Operación' | 'Cierre' | 'Administración';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DialogModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.css'
})
export class ReservationsComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private printDocument = inject(PrintDocumentService);
  private dialog = inject(Dialog);
  private mobileDialogRef?: DialogRef<void>;

  reservations = signal<ReservationWithProduct[]>([]);
  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');
  currentPage = signal(1);
  readonly pageSize = 10;
  readonly trackingEventGroups: TrackingEventGroup[] = ['Operación', 'Cierre', 'Administración'];
  readonly trackingEventOptions = [
    { value: 'empaquetado', label: 'Preparar pedido', group: 'Operación' },
    { value: 'en_camino', label: 'Enviar / en ruta', group: 'Operación' },
    { value: 'entregado', label: 'Entregar al cliente', group: 'Operación' },
    { value: 'finalizado', label: 'Cerrar venta completada', group: 'Cierre' },
    { value: 'cancelado', label: 'Cancelar / anular apartado', group: 'Cierre' },
    { value: 'vendido', label: 'Venta directa finalizada', group: 'Cierre' },
    { value: 'otro', label: 'Nota interna', group: 'Administración' },
    { value: 'correccion_administrativa', label: 'Corrección administrativa', group: 'Administración' }
  ] as const;
  readonly hiddenManualEventKeys = new Set([
    'entregado',
    'finalizado',
    'vendido',
    'correccion_administrativa'
  ]);
  readonly eventEffects: Record<string, TrackingEventEffect> = {
    reserva_creada: { nextStatus: 'pendiente', message: 'Reserva creada y pendiente de deposito.' },
    deposito_confirmado: { message: 'Registra pago y compromete stock si aun no estaba comprometido.', stockAction: 'commit' },
    deposito_revertido: { nextStatus: 'pendiente', message: 'Deposito revertido.', stockAction: 'release' },
    empaquetado: { message: 'Cliente vera el pedido en preparacion.' },
    en_camino: { message: 'Cliente vera el pedido en camino.' },
    entregado: { nextStatus: 'entregado', message: 'Marca entregado al cliente y mantiene stock comprometido.', stockAction: 'commit' },
    finalizado: { nextStatus: 'finalizado', message: 'Cierra la venta como completada. Ya no queda operacion pendiente.', stockAction: 'commit' },
    cancelado: { nextStatus: 'cancelado', message: 'Cancela/anula el apartado, libera stock y desliga el producto.', stockAction: 'release', detachesProduct: true },
    recibido: { nextStatus: 'entregado', message: 'Alias legado: marca entregado al cliente.', stockAction: 'commit' },
    cerrado_pagado: { nextStatus: 'finalizado', message: 'Alias legado: cierra venta finalizada.', stockAction: 'commit' },
    cerrado_devuelto: { nextStatus: 'cancelado', message: 'Alias legado: cancela/anula el apartado.', stockAction: 'release', detachesProduct: true },
    vendido: { nextStatus: 'finalizado', message: 'Cierra como venta directa finalizada.', stockAction: 'commit' },
    otro: { message: 'Agrega una nota interna sin cambiar estado ni stock.' },
    correccion_administrativa: { message: 'Registra una correccion trazable sin cambiar estado automaticamente.' }
  };

  activeDepositReservationId = signal<string | null>(null);
  activeTimelineReservationId = signal<string | null>(null);
  activeCorrectionReservationId = signal<string | null>(null);
  advancedEventReservationId = signal<string | null>(null);
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

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredReservations().length / this.pageSize)));

  paginatedReservations = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredReservations().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  activeMobileReservation = computed(() => {
    const id =
      this.activeDepositReservationId() ||
      this.activeTimelineReservationId() ||
      this.activeCorrectionReservationId();
    if (!id) return null;
    return this.reservations().find((reservation) => reservation.id === id) ?? null;
  });

  isMobileViewport() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  paginationLabel = computed(() => {
    const total = this.filteredReservations().length;
    if (total === 0) return '0 apartados';
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `${start}-${end} de ${total} apartados`;
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
    this.currentPage.set(1);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.currentPage.set(1);
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

    const needsCorrection = this.isLockedReservation(reservation) || this.hasPaymentRecord(reservation);
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
        if (this.shouldDetachProduct(effect.nextStatus)) {
          await this.detachReservationProduct(reservation);
        }
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

  async addRecommendedTrackingEvent(id: string, reservation: ReservationWithProduct) {
    const eventKey = this.getRecommendedEventKey(reservation);
    if (!eventKey) return;

    this.eventDrafts.update((current) => ({
      ...current,
      [id]: { eventKey, notes: '' }
    }));

    await this.addTrackingEvent(id);
  }

  async markAsDelivered(id: string, reservation: ReservationWithProduct) {
    this.eventDrafts.update((current) => ({
      ...current,
      [id]: { eventKey: 'entregado', notes: '' }
    }));

    await this.addTrackingEvent(id);
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

  private shouldDetachProduct(status: ReservationStatus) {
    return status === 'cancelado';
  }

  private async detachReservationProduct(reservation: ReservationWithProduct) {
    if (!reservation.id || !reservation.product_id) return;

    await this.supabase.update('reservations', reservation.id, { product_id: null });

    this.reservations.update((list) =>
      list.map((item) =>
        item.id === reservation.id
          ? { ...item, product_id: null, products: undefined }
          : item
      )
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

  beginPaymentCorrection(id: string, reservation: ReservationWithProduct) {
    this.beginCorrection(id);
    this.openDepositForm(id, reservation);
    this.setFeedback(id, 'Edita el pago y escribe el motivo de la correccion antes de guardar.');
  }

  cancelCorrection() {
    this.activeCorrectionReservationId.set(null);
  }

  requireCorrectionReason(id: string, reservation: ReservationWithProduct, lockedMessage: string) {
    const requiresCorrection = this.isLockedReservation(reservation) || this.hasPaymentRecord(reservation) || this.isCorrectionActive(id);
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

  getEventsByGroup(group: TrackingEventGroup) {
    return this.trackingEventOptions.filter((event) => event.group === group && !this.hiddenManualEventKeys.has(event.value));
  }

  getEventImpactTags(eventKey: string) {
    const effect = this.getEventEffect(eventKey);
    const tags: string[] = [];
    if (effect.nextStatus) tags.push(`Estado: ${this.getStatusConfig(effect.nextStatus).label}`);
    if (effect.stockAction === 'commit') tags.push('Compromete stock');
    if (effect.stockAction === 'release') tags.push('Libera stock');
    if (effect.detachesProduct) tags.push('Desliga producto');
    if (tags.length === 0) tags.push('Solo historial');
    return tags;
  }

  getRecommendedEventKey(reservation: ReservationWithProduct) {
    if (reservation.status === 'finalizado' || reservation.status === 'cancelado') return null;
    if (!this.hasPaymentRecord(reservation)) return null;

    const keys = new Set(this.getHistory(reservation.id).map((event) => event.event_key));
    if (!keys.has('empaquetado')) return 'empaquetado';
    if (!keys.has('en_camino') && reservation.status !== 'entregado') return 'en_camino';
    if (reservation.status !== 'entregado' && !keys.has('entregado') && !keys.has('recibido')) return 'entregado';
    if (reservation.status === 'entregado') return 'finalizado';
    return null;
  }

  canMarkDelivered(reservation: ReservationWithProduct) {
    if (reservation.status === 'entregado' || reservation.status === 'finalizado' || reservation.status === 'cancelado') return false;

    const keys = new Set(this.getHistory(reservation.id).map((event) => event.event_key));
    return !keys.has('entregado') && !keys.has('recibido');
  }

  getRecommendedEventLabel(reservation: ReservationWithProduct) {
    const eventKey = this.getRecommendedEventKey(reservation);
    return this.trackingEventOptions.find((event) => event.value === eventKey)?.label ?? '';
  }

  getReservationSummary(reservation: ReservationWithProduct) {
    if (!reservation.product_id && (reservation.status === 'cancelado' || reservation.status === 'finalizado')) {
      return 'Caso cerrado; producto desligado del apartado';
    }

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

  getProductName(reservation: ReservationWithProduct) {
    return reservation.products?.name ?? (reservation.product_id ? 'Producto sin datos' : 'Producto desligado');
  }

  generateClientTicket(reservation: ReservationWithProduct) {
    const history = reservation.id ? this.getHistory(reservation.id).slice(0, 5) : [];
    const productName = this.getProductName(reservation);
    const total = reservation.products?.price ?? 0;
    const transferred = this.getTransferredAmount(reservation);
    const remaining = this.getPendingAmount(reservation);
    const ticketNumber = this.getTicketNumber(reservation);

    const data: PrintDocumentData = {
      documentType: 'apartado',
      title: 'Ticket de Apartado',
      documentNumber: ticketNumber,
      issueDate: new Date().toISOString(),
      statusLabel: this.getStatusConfig(reservation.status).label,
      brand: {
        name: 'Mi Tiendita L\'Amour',
        subtitle: 'Comprobante de apartado'
      },
      customer: {
        name: reservation.customer_name,
        phone: reservation.customer_phone,
        email: reservation.customer_email
      },
      summary: `${productName}. ${this.getReservationSummary(reservation)}`,
      qrValue: `${window.location.origin}/track/${reservation.id ?? ticketNumber}`,
      notes: 'Gracias por su preferencia. Conserve este documento para seguimiento y validacion de entrega.',
      payment: {
        reference: reservation.deposit_reference,
        transferredBy: reservation.deposit_transferred_by,
        confirmedAt: reservation.deposit_confirmed_at
      },
      items: [
        {
          sku: ticketNumber,
          description: productName,
          quantity: 1,
          unitPrice: total,
          total
        }
      ],
      totals: [
        { label: 'Total', amount: total },
        { label: transferred > 0 ? 'Monto transferido' : 'Anticipo requerido', amount: transferred > 0 ? transferred : this.getDepositAmount(reservation) },
        { label: transferred > 0 ? 'Monto pendiente' : 'Saldo total pendiente', amount: remaining, strong: true }
      ],
      timeline: history.map((item) => ({
        label: item.event_label,
        date: item.created_at,
        detail: item.notes ?? item.metadata?.['effect_message'] ?? '-'
      })),
      signatureLabel: 'Firma / recibido por cliente'
    };

    this.printDocument.printDocument(data);
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

  openDepositAction(id: string, reservation: ReservationWithProduct, template: TemplateRef<unknown>) {
    this.openDepositForm(id, reservation);
    this.openMobileDialog(template);
  }

  openPaymentAction(id: string, reservation: ReservationWithProduct, template: TemplateRef<unknown>) {
    if (this.requiresCorrectionMode(reservation) && !this.isCorrectionActive(id)) {
      this.beginPaymentCorrection(id, reservation);
    } else {
      this.openDepositForm(id, reservation);
    }
    this.openMobileDialog(template);
  }

  closeDepositForm() {
    this.activeDepositReservationId.set(null);
  }

  toggleTimeline(id: string) {
    this.activeTimelineReservationId.set(this.activeTimelineReservationId() === id ? null : id);
    this.advancedEventReservationId.set(null);
    this.setFeedback(id, '');
  }

  openTimelineAction(id: string, template: TemplateRef<unknown>) {
    this.toggleTimeline(id);
    this.openMobileDialog(template);
  }

  closeMobilePanel() {
    this.activeDepositReservationId.set(null);
    this.activeTimelineReservationId.set(null);
    this.activeCorrectionReservationId.set(null);
    this.advancedEventReservationId.set(null);
    this.mobileDialogRef?.close();
    this.mobileDialogRef = undefined;
  }

  openAdvancedEvents(id: string) {
    this.activeTimelineReservationId.set(id);
    this.advancedEventReservationId.set(id);
    this.setFeedback(id, '');
  }

  openAdvancedEventsAction(id: string, template: TemplateRef<unknown>) {
    this.openAdvancedEvents(id);
    this.openMobileDialog(template);
  }

  closeAdvancedEvents() {
    this.advancedEventReservationId.set(null);
  }

  private openMobileDialog(template: TemplateRef<unknown>) {
    if (!this.isMobileViewport()) return;
    if (this.mobileDialogRef) return;

    this.mobileDialogRef = this.dialog.open(template, {
      ariaLabel: 'Acciones del apartado',
      autoFocus: 'dialog',
      restoreFocus: true,
      hasBackdrop: true,
      closeOnOverlayDetachments: true,
      panelClass: 'reservation-mobile-dialog',
      backdropClass: 'reservation-mobile-backdrop',
    });

    this.mobileDialogRef.closed.subscribe(() => {
      this.activeDepositReservationId.set(null);
      this.activeTimelineReservationId.set(null);
      this.activeCorrectionReservationId.set(null);
      this.advancedEventReservationId.set(null);
      this.mobileDialogRef = undefined;
    });
  }

  getHistory(id?: string) {
    if (!id) return [];
    return this.trackingHistory()[id] ?? [];
  }

  setFilter(status: string) {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  previousPage() {
    this.currentPage.set(Math.max(this.currentPage() - 1, 1));
  }

  nextPage() {
    this.currentPage.set(Math.min(this.currentPage() + 1, this.totalPages()));
  }

  goToPage(page: number) {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
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

  hasPaymentRecord(reservation: ReservationWithProduct) {
    return this.getTransferredAmount(reservation) > 0 || !!reservation.deposit_confirmed_at;
  }
}
