import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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

  readonly whatsappLink = `https://wa.me/${this.bankDetails.whatsapp.replace(/\D/g, '')}`;

  cartProducts = signal<any[]>([]);
  isSaving = signal(false);
  isLoadingProduct = signal(false);
  success = signal(false);
  createdTicketNumbers = signal<string[]>([]);
  createdProductDetails = signal<{name: string, price: number, size?: string, color?: string}[]>([]);
  createdTotals = signal<{deposit: number, remaining: number, total: number}>({deposit: 0, remaining: 0, total: 0});
  reservationDate = signal<string>('');

  checkoutForm: FormGroup = this.fb.group({
    customer_name: ['', [Validators.required, Validators.minLength(3)]],
    customer_email: ['', [Validators.email]],
    customer_phone: ['', [Validators.required]],
    reservation_date: ['', [Validators.required, ShoppingCartComponent.futureDateValidator]],
    deposit_amount: [null],
    deposit_reference: [''],
    deposit_transferred_by: [''],
    notes: ['']
  });

  get todayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private static futureDateValidator(control: AbstractControl): ValidationErrors | null {
    const value: string | null = control.value;
    if (!value) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const picked = new Date(`${value}T00:00:00`);
    if (isNaN(picked.getTime())) return { pastDate: true };
    return picked.getTime() < today.getTime() ? { pastDate: true } : null;
  }

  totalPrice = computed(() => {
    return this.cartProducts().reduce((sum, item) => sum + Number(item.price), 0);
  });

  depositAmount = computed(() => Math.round(this.totalPrice() * 50) / 100);

  remainingAmount = computed(() => Math.round((this.totalPrice() - this.depositAmount()) * 100) / 100);

  itemCount = computed(() => this.cartProducts().length);

  isMultipleItems = computed(() => this.itemCount() > 1);

  getSubmitLabel() {
    return this.isMultipleItems() ? 'Enviar a apartados' : 'Enviar a apartado';
  }

  getSuccessTitle() {
    return this.isMultipleItems() ? 'Apartados registrados' : 'Apartado registrado';
  }

  getSelectionTitle() {
    return this.isMultipleItems() ? 'Mi carrito' : 'Mi carrito';
  }

  getTicketNumber(id?: string) {
    return `APT-${(id ?? '').slice(0, 8).toUpperCase() || 'MANUAL'}`;
  }

  printTicket() {
    const ticket = document.getElementById('ticket-print');
    if (!ticket) {
      window.print();
      return;
    }

    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) {
      // Popup bloqueado → fallback: imprime la pagina actual con titulo limpio
      const original = document.title;
      document.title = 'Ticket de apartado';
      window.print();
      document.title = original;
      return;
    }

    const doc = w.document;
    doc.title = 'Ticket de apartado';

    // Copiamos hojas de estilo y <style> globales a la ventana aislada
    for (const node of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))) {
      doc.head.appendChild(node.cloneNode(true));
    }

    const pageStyle = doc.createElement('style');
    pageStyle.textContent = `@page { margin: 10mm; } html, body { background:#fff !important; margin:0; padding:16px; }`;
    doc.head.appendChild(pageStyle);

    doc.body.appendChild(ticket.cloneNode(true));
    w.focus();

    const doPrint = () => {
      w.print();
      w.close();
    };
    if (doc.readyState === 'complete') {
      setTimeout(doPrint, 300);
    } else {
      w.addEventListener('load', () => setTimeout(doPrint, 150));
    }
  }

  shareViaWhatsApp() {
    const lines: string[] = [];
    lines.push(`*Ticket de apartado - Mi Tiendita L'Amour*`);
    lines.push('');
    const tickets = this.createdTicketNumbers();
    if (tickets.length === 1) {
      lines.push(`Ticket: ${tickets[0]}`);
    } else {
      lines.push(`Tickets:`);
      tickets.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    }
    lines.push('');

    const products = this.createdProductDetails();
    if (products.length > 0) {
      lines.push(`*Articulo(s):*`);
      for (const p of products) {
        const variant = [p.size, p.color].filter(Boolean).join(' - ');
        lines.push(`- ${p.name}${variant ? ` (${variant})` : ''}: L. ${p.price}`);
      }
      lines.push('');
    }

    const totals = this.createdTotals();
    if (totals.total > 0) {
      lines.push(`Total: L. ${totals.total}`);
      if (totals.deposit > 0) lines.push(`Sena: L. ${totals.deposit}`);
      if (totals.remaining > 0) lines.push(`Restante: L. ${totals.remaining}`);
      lines.push('');
    }

    const resDate = this.reservationDate();
    if (resDate) lines.push(`Fecha de entrega: ${this.formatDate(resDate)}`);
    lines.push('');
    lines.push('Adjunto el comprobante de la transferencia.');

    const phone = this.bankDetails.whatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' });
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
      const valid = parsed.filter((product) => !!product?.id);
      this.cartProducts.set(valid);
      if (valid.length !== parsed.length) this.persistCart();
    } catch {
      localStorage.removeItem('mi_tiendita_cart');
    }
  }

  async addProductById(productId: string) {
    this.isLoadingProduct.set(true);
    try {
      const product: any = await this.supabase.getById('products', productId);
      if (!product) return;

      const currentCount = this.cartProducts().filter((item) => item.id === product.id).length;
      if (currentCount >= Number(product.stock ?? 0)) return;

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
    window.dispatchEvent(new Event('mi_tiendita_cart_updated'));
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

    const declaredDeposit = Number(formData.deposit_amount) || 0;
    const total = this.totalPrice();
    const items = this.cartProducts();

    try {
      const createdTickets: string[] = [];
      let assignedDeposit = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let proratedDeposit = 0;
        if (declaredDeposit > 0 && total > 0) {
          proratedDeposit = i === items.length - 1
            ? Math.round((declaredDeposit - assignedDeposit) * 100) / 100
            : Math.round(((Number(item.price) / total) * declaredDeposit) * 100) / 100;
          assignedDeposit += proratedDeposit;
        }

        // id generado en cliente: el rol anon no tiene SELECT sobre reservations,
        // así que no podemos leer la fila recién insertada vía RETURNING.
        const reservationId = crypto.randomUUID();

        await this.supabase.insertOnly('reservations', {
          id: reservationId,
          product_id: item.id,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email?.trim() || null,
          customer_phone: formData.customer_phone,
          reservation_date: formData.reservation_date,
          status: 'pendiente',
          notes: finalNotes,
          fee_paid: false,
          deposit_amount: proratedDeposit,
          deposit_reference: formData.deposit_reference?.trim() || null,
          deposit_transferred_by: formData.deposit_transferred_by?.trim() || null
        });

        await this.supabase.insertOnly('product_tracking_events', {
          product_id: item.id,
          reservation_id: reservationId,
          source: 'reservation',
          event_key: 'reserva_creada',
          event_label: 'Apartado creado',
          notes: `Apartado registrado para ${formData.customer_name}`,
          metadata: {
            reservation_date: formData.reservation_date,
            deposit_amount: this.depositAmount(),
            remaining_amount: this.remainingAmount(),
            declared_transfer_amount: declaredDeposit,
            declared_transfer_reference: formData.deposit_reference?.trim() || null,
            declared_transferred_by: formData.deposit_transferred_by?.trim() || null
          }
        });

        createdTickets.push(this.getTicketNumber(reservationId));
      }

      const productDetails = items.map(item => ({
        name: item.name,
        price: Number(item.price),
        size: item.sizes?.[0]?.size,
        color: item.sizes?.[0]?.color
      }));

      this.cartProducts.set([]);
      localStorage.removeItem('mi_tiendita_cart');
      window.dispatchEvent(new Event('mi_tiendita_cart_updated'));
      this.createdTicketNumbers.set(createdTickets);
      this.createdProductDetails.set(productDetails);
      this.createdTotals.set({
        deposit: this.depositAmount(),
        remaining: this.remainingAmount(),
        total: this.totalPrice()
      });
      this.reservationDate.set(formData.reservation_date || new Date().toISOString().split('T')[0]);
      this.success.set(true);
    } catch (error: any) {
      console.error('Reservation failed:', error);
      alert(`Error al procesar el apartado: ${error?.message ?? 'intente nuevamente'}`);
    } finally {
      this.isSaving.set(false);
    }
  }
}
