import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { Product } from '../../../core/types';

interface ProductWithCategory extends Product {
  categories?: { name: string };
}

type NoticeType = 'success' | 'error' | 'warning';

interface InventoryNotice {
  type: NoticeType;
  title: string;
  message: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  products = signal<ProductWithCategory[]>([]);
  filter = signal<string>('all');
  deletingProductId = signal<string | null>(null);
  productPendingDelete = signal<ProductWithCategory | null>(null);
  notice = signal<InventoryNotice | null>(null);
  private noticeTimerId: ReturnType<typeof setTimeout> | null = null;

  filteredProducts = computed(() => {
    const f = this.filter();
    const prods = this.products();
    if (f === 'all') return prods;

    return prods.filter(p => {
      const level = p.stock ?? 0;
      if (f === 'low') return level > 0 && level < 5;
      if (f === 'out') return level === 0;
      if (f === 'limited') return p.is_limited_edition;
      return true;
    });
  });

  async ngOnInit() {
    await this.loadProducts();
  }

  async loadProducts() {
    try {
      const { data, error } = await this.supabase.client
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        this.products.set(data as ProductWithCategory[]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  setFilter(f: string) {
    this.filter.set(f);
  }

  getStockStatus(level: number | undefined): { label: string, color: string } {
    const val = level ?? 0;
    if (val === 0) return { label: 'Agotado', color: 'text-red-400 bg-red-50' };
    if (val < 5) return { label: 'Stock Bajo', color: 'text-amber-500 bg-amber-50' };
    if (val < 20) return { label: 'En Stock', color: 'text-lamour-stone bg-gray-50' };
    return { label: 'Stock Completo', color: 'text-emerald-500 bg-emerald-50' };
  }

  newProduct() {
    this.router.navigate(['/admin/products/new']);
  }

  editProduct(id: string) {
    this.router.navigate(['/admin/products/edit', id]);
  }

  requestDeleteProduct(product: ProductWithCategory) {
    this.productPendingDelete.set(product);
  }

  cancelDeleteProduct() {
    if (this.deletingProductId()) return;
    this.productPendingDelete.set(null);
  }

  async confirmDeleteProduct() {
    const product = this.productPendingDelete();
    if (!product?.id) return;

    await this.deleteProduct(product.id);
  }

  dismissNotice() {
    this.notice.set(null);
    if (this.noticeTimerId !== null) {
      clearTimeout(this.noticeTimerId);
      this.noticeTimerId = null;
    }
  }

  private showNotice(type: NoticeType, title: string, message: string) {
    this.dismissNotice();
    this.notice.set({ type, title, message });
    this.noticeTimerId = setTimeout(() => this.notice.set(null), 5200);
  }

  private async deleteProduct(id: string) {
    this.deletingProductId.set(id);
    try {
      const { count, error: reservationError } = await this.supabase.client
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id)
        .in('status', ['pendiente', 'pagado', 'entregado']);

      if (reservationError) throw reservationError;

      if ((count ?? 0) > 0) {
        this.showNotice(
          'warning',
          'Producto con apartados activos',
          'No se puede eliminar esta pieza porque tiene apartados pendientes, pagados o entregados. Cierre esos apartados como finalizados o cancelados antes de eliminarla.'
        );
        return;
      }

      await this.supabase.delete('products', id);
      await this.loadProducts();
      this.productPendingDelete.set(null);
      this.showNotice('success', 'Producto eliminado', 'La pieza fue eliminada del inventario.');
    } catch (e: any) {
      console.error(e);
      const message = e?.code === '23503'
        ? 'No se puede eliminar esta pieza porque la base de datos aun tiene registros relacionados, como apartados historicos o historial de seguimiento.'
        : e?.message ?? 'No se pudo eliminar el producto.';
      this.showNotice('error', 'Error eliminando producto', message);
    } finally {
      this.deletingProductId.set(null);
    }
  }
}
