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
  authorization: string;
  transferredBy: string;
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
    deposito_confirmado: { nextStatus: 'pagado', message: 'Deposito confirmado.', stockAction: 'commit' },
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
    if (status === 'all') return this.reservations();
    return this.reservations().filter((reservation) => reservation.status === status);
  });

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
    const hasTrackingId = draft.reference.trim() || draft.authorization.trim();
    if (!hasTrackingId || !draft.transferredBy.trim()) {
      this.setFeedback(id, 'Ingresa referencia o autorizacion, y quien transfiere.');
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
      const updatePayload: Partial<Reservation> = {
        fee_paid: true,
        deposit_reference: draft.reference.trim() || null,
        deposit_authorization: draft.authorization.trim() || null,
        deposit_transferred_by: draft.transferredBy.trim(),
        deposit_confirmed_at: new Date().toISOString()
      };

      const nextStatus = reservation.status === 'pendiente' ? 'pagado' : reservation.status;

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
        reservation.fee_paid ? 'Deposito corregido' : 'Deposito confirmado',
        {
          reference: updatePayload.deposit_reference,
          authorization: updatePayload.deposit_authorization,
          transferred_by: updatePayload.deposit_transferred_by
        },
        null,
        correctionReason
      );

      if (nextStatus !== reservation.status) {
        await this.recordDerivedStatusChange(reservation, nextStatus as ReservationStatus, 'deposito_confirmado', correctionReason);
      }

      this.activeDepositReservationId.set(null);
      this.finishCorrection(id, correctionReason ? 'Correccion de deposito registrada.' : 'Deposito confirmado y registrado en historial.');
    } catch (error) {
      console.error(error);
      alert('Error al confirmar deposito.');
    }
  }

  async clearDepositConfirmation(id: string) {
    const reservation = this.reservations().find((item) => item.id === id);
    if (!reservation) return;

    const correctionReason = this.requireCorrectionReason(id, reservation, 'Revertir un deposito requiere motivo de correccion.');
    if (correctionReason === null) return;

    try {
      await this.supabase.update('reservations', id, {
        fee_paid: false,
        deposit_reference: null,
        deposit_authorization: null,
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
                deposit_reference: null,
                deposit_authorization: null,
                deposit_transferred_by: null,
                deposit_confirmed_at: null,
                stock_committed: false,
                stock_committed_at: null
              }
            : item
        )
      );

      await this.logTrackingEvent(
        reservation,
        'deposito_revertido',
        'Deposito revertido',
        null,
        null,
        correctionReason
      );

      this.finishCorrection(id, 'Correccion de deposito registrada.');
    } catch (error) {
      console.error(error);
      alert('Error al revertir deposito.');
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
    return this.isLockedReservation(reservation) || !!reservation.fee_paid;
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

    if (reservation.fee_paid) {
      return 'Deposito confirmado';
    }

    if (reservation.stock_committed) {
      return 'Stock comprometido';
    }

    return latestEffect ?? 'Pendiente de deposito';
  }

  getDepositDraft(id: string, reservation?: ReservationWithProduct): DepositDraft {
    return this.depositDrafts()[id] ?? {
      reference: reservation?.deposit_reference ?? '',
      authorization: reservation?.deposit_authorization ?? '',
      transferredBy: reservation?.deposit_transferred_by ?? ''
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
}
