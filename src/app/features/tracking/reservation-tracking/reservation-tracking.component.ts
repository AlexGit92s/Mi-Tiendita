import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase.service';

export interface TrackingEvent {
  id: string;
  event_key: string;
  event_label: string;
  created_at: string;
}

export interface TrackingResult {
  id: string;
  status: string;
  created_at: string;
  deposit_confirmed_at: string | null;
  reservation_date: string | null;
  product_name: string;
  product_images: string[];
  events: TrackingEvent[];
}

// Pasos del timeline (orden canónico para la UI)
const TIMELINE_STEPS = [
  { key: 'reserva_creada',      label: 'Reserva recibida',            icon: '📋', description: 'Tu pedido fue registrado con éxito.' },
  { key: 'deposito_confirmado', label: 'Depósito aprobado',           icon: '✅', description: 'Hemos confirmado tu pago.' },
  { key: 'empaquetado',         label: 'En preparación',              icon: '📦', description: 'Tu pedido está siendo preparado.' },
  { key: 'en_camino',           label: 'Tu pedido está en camino',    icon: '🚚', description: 'Pronto llegará a ti.' },
  { key: 'entregado',           label: '¡Entregado!',                 icon: '🎉', description: 'Tu pedido fue entregado. ¡Gracias!' },
  { key: 'cancelado',           label: 'Reserva cancelada',           icon: '❌', description: 'Esta reserva ha sido cancelada.' },
];

// El cliente puede escribir:
//   - Código corto:   "APT-3F5E0B4C"  o  "3f5e0b4c"
//   - UUID completo:  "3f5e0b4c-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
// La normalización real (resolver prefijo a UUID único) vive en la RPC.
function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/^apt-/, '');
}

function isAcceptedCodeFormat(raw: string): boolean {
  const v = normalizeCode(raw);
  return /^[0-9a-f]{8}$/.test(v) ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
}

function formatTicket(uuid: string): string {
  return `APT-${uuid.slice(0, 8).toUpperCase()}`;
}

@Component({
  selector: 'app-reservation-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './reservation-tracking.component.html',
  styleUrls: ['./reservation-tracking.component.css'],
})
export class ReservationTrackingComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);

  inputCode  = signal('');
  loading    = signal(false);
  result     = signal<TrackingResult | null>(null);
  notFound   = signal(false);
  errorMsg   = signal('');

  readonly timelineSteps = TIMELINE_STEPS;

  // Set de event_keys que ya ocurrieron (para marcar pasos completados)
  readonly completedKeys = computed(() => {
    const r = this.result();
    if (!r) return new Set<string>();
    return new Set(r.events.map(e => e.event_key));
  });

  readonly isCancelled = computed(() => this.completedKeys().has('cancelado'));

  readonly ticketLabel = computed(() => {
    const r = this.result();
    return r ? formatTicket(r.id) : '';
  });

  readonly productImage = computed(() => {
    const r = this.result();
    return r?.product_images?.[0] ?? null;
  });

  readonly statusLabel = computed(() => {
    const r = this.result();
    if (!r) return '';
    const map: Record<string, string> = {
      pendiente:  'Pendiente de confirmación',
      pagado:     'Pago confirmado',
      entregado:  'Entregado',
      finalizado: 'Finalizado',
      cancelado:  'Cancelado',
    };
    return map[r.status] ?? r.status;
  });

  ngOnInit() {
    // El :uuid de la ruta es en realidad un "código" (APT-… o UUID completo).
    const codeFromRoute = this.route.snapshot.paramMap.get('uuid') ?? '';
    if (codeFromRoute) {
      this.inputCode.set(codeFromRoute);
      this.search();
    }
  }

  async search() {
    const raw = this.inputCode().trim();
    this.result.set(null);
    this.notFound.set(false);
    this.errorMsg.set('');

    if (!raw) return;

    if (!isAcceptedCodeFormat(raw)) {
      this.errorMsg.set('Código no válido. Escríbelo tal como aparece en tu ticket (ej. APT-3F5E0B4C).');
      return;
    }

    this.loading.set(true);

    // Actualizar URL sin recargar — preservamos lo que el cliente escribió.
    this.router.navigate(['/track', raw], { replaceUrl: true });

    try {
      const { data, error } = await this.supabase.client
        .rpc('get_reservation_tracking', { p_code: raw });

      if (error) throw error;

      if (!data) {
        this.notFound.set(true);
      } else {
        this.result.set(data as TrackingResult);
      }
    } catch (err: any) {
      this.errorMsg.set(`No pudimos contactar el servidor: ${err?.message ?? 'intenta de nuevo'}`);
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-HN', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatDateShort(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // El timeline se apega estrictamente a los eventos recibidos del backend:
  // - hay evento con ese key → done
  // - paso `cancelado` y reserva cancelada → cancelled
  // - cualquier otro caso (incluido "el siguiente esperado") → pending
  stepStatus(key: string): 'done' | 'pending' | 'cancelled' {
    if (key === 'cancelado') {
      return this.isCancelled() ? 'cancelled' : 'pending';
    }
    return this.completedKeys().has(key) ? 'done' : 'pending';
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this.search();
  }

  clear() {
    this.inputCode.set('');
    this.result.set(null);
    this.notFound.set(false);
    this.errorMsg.set('');
    this.router.navigate(['/track'], { replaceUrl: true });
  }
}
