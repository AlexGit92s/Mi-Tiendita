import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase.service';

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './shopping-cart.component.html'
})
export class ShoppingCartComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly bankDetails = {
    bank: 'Banco BacCredomatic',
    accountNumber: '749370871',
    accountHolder: 'Mi Tiendita L\'Amour',
    accountType: 'Cuenta de Ahorros',
    whatsapp: '+504 9624-2967'
  };

  cartProducts = signal<any[]>([]);
  isSaving = signal(false);
  isLoadingProduct = signal(false);
  success = signal(false);
  createdTicketNumbers = signal<string[]>([]);

  checkoutForm: FormGroup = this.fb.group({
    customer_name: ['', [Validators.required, Validators.minLength(3)]],
    customer_email: ['', [Validators.required, Validators.email]],
    customer_phone: ['', [Validators.required]],
    reservation_date: ['', [Validators.required]],
    notes: ['']
  });

  totalPrice = computed(() => {
    return this.cartProducts().reduce((sum, item) => sum + Number(item.price), 0);
  });

  depositAmount = computed(() => Math.round(this.totalPrice() * 50) / 100);

  remainingAmount = computed(() => Math.round((this.totalPrice() - this.depositAmount()) * 100) / 100);

  getTicketNumber(id?: string) {
    return `APT-${(id ?? '').slice(0, 8).toUpperCase() || 'MANUAL'}`;
  }

  async ngOnInit() {
    this.loadCart();
    const productId = this.route.snapshot.queryParamMap.get('productId');
    if (productId) {
      await this.addProductById(productId);
    }
  }

  loadCart() {
    const saved = localStorage.getItem('mi_tiendita_cart');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as any[];
      const seen = new Set<string>();
      const unique = parsed.filter((product) => {
        if (!product?.id || seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
      });

      this.cartProducts.set(unique);
      if (unique.length !== parsed.length) this.persistCart();
    } catch {
      localStorage.removeItem('mi_tiendita_cart');
    }
  }

  async addProductById(productId: string) {
    if (this.cartProducts().some((product) => product.id === productId)) {
      this.clearProductIdFromUrl();
      return;
    }

    this.isLoadingProduct.set(true);
    try {
      const product: any = await this.supabase.getById('products', productId);
      if (!product) return;
      if (this.cartProducts().some((item) => item.id === product.id)) return;

      const updated = [...this.cartProducts(), product];
      this.cartProducts.set(updated);
      this.persistCart();
    } catch (error) {
      console.error('No se pudo cargar el producto:', error);
    } finally {
      this.isLoadingProduct.set(false);
      this.clearProductIdFromUrl();
    }
  }

  private clearProductIdFromUrl() {
    if (!this.route.snapshot.queryParamMap.has('productId')) return;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private persistCart() {
    localStorage.setItem('mi_tiendita_cart', JSON.stringify(this.cartProducts()));
  }

  removeFromCart(index: number) {
    const current = [...this.cartProducts()];
    current.splice(index, 1);
    this.cartProducts.set(current);
    this.persistCart();
  }

  async onSubmit() {
    if (this.checkoutForm.invalid || this.cartProducts().length === 0 || this.isSaving()) return;

    this.isSaving.set(true);
    const formData = this.checkoutForm.value;
    const depositNote = `[Anticipo 50%: L. ${this.depositAmount()} - Restante: L. ${this.remainingAmount()}]`;
    const finalNotes = formData.notes ? `${depositNote} ${formData.notes}` : depositNote;

    try {
      const createdTickets: string[] = [];

      for (const item of this.cartProducts()) {
        const reservation = await this.supabase.create('reservations', {
          product_id: item.id,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone,
          reservation_date: formData.reservation_date,
          status: 'pendiente',
          notes: finalNotes,
          fee_paid: false
        });

        await this.supabase.create('product_tracking_events', {
          product_id: item.id,
          reservation_id: reservation.id,
          source: 'reservation',
          event_key: 'reserva_creada',
          event_label: 'Apartado creado',
          notes: `Apartado registrado para ${formData.customer_name}`,
          metadata: {
            reservation_date: formData.reservation_date,
            deposit_amount: this.depositAmount(),
            remaining_amount: this.remainingAmount()
          }
        });

        createdTickets.push(this.getTicketNumber(reservation.id));
      }

      this.cartProducts.set([]);
      localStorage.removeItem('mi_tiendita_cart');
      this.createdTicketNumbers.set(createdTickets);
      this.success.set(true);
    } catch (error: any) {
      console.error('Reservation failed:', error);
      alert(`Error al procesar el apartado: ${error?.message ?? 'intente nuevamente'}`);
    } finally {
      this.isSaving.set(false);
    }
  }
}
