export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
}

export interface Product {
  id?: string;
  name: string;
  description?: string | null;
  category: string;
  category_id?: string | null;
  price: number;
  sizes: string[];
  images: string[];
  stock: number;
  status: 'disponible' | 'apartado' | 'vendido';
  is_limited_edition?: boolean;
  created_at?: string;
}

export interface Reservation {
  id?: string;
  product_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  reservation_date?: string | null;
  notes?: string | null;
  fee_paid?: boolean;
  deposit_amount?: number | null;
  deposit_reference?: string | null;
  deposit_transferred_by?: string | null;
  deposit_confirmed_at?: string | null;
  stock_committed?: boolean;
  stock_committed_at?: string | null;
  status: 'pendiente' | 'pagado' | 'entregado' | 'finalizado' | 'cancelado';
  created_at?: string;
}

export interface ProductTrackingEvent {
  id?: string;
  product_id: string;
  reservation_id?: string | null;
  source?: 'reservation' | 'sale' | 'manual';
  event_key: string;
  event_label: string;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  is_correction?: boolean;
  correction_reason?: string | null;
  corrected_event_id?: string | null;
  actor_email?: string | null;
  created_at?: string;
}
