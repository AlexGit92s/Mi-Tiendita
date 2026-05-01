import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { Category, Product } from '../../../core/types';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  products = signal<ProductWithCategory[]>([]);
  categories = signal<Category[]>([]);
  filter = signal<string>('all');
  searchQuery = signal<string>('');
  categoryFilter = signal<string>('all');
  deletingProductId = signal<string | null>(null);
  productPendingDelete = signal<ProductWithCategory | null>(null);
  notice = signal<InventoryNotice | null>(null);
  currentPage = signal(1);
  readonly pageSize = 8;
  private noticeTimerId: ReturnType<typeof setTimeout> | null = null;

  filteredProducts = computed(() => {
    const stockFilter = this.filter();
    const categoryId = this.categoryFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const prods = this.products();

    return prods.filter(p => {
      const level = p.stock ?? 0;

      if (stockFilter === 'low' && !(level > 0 && level < 5)) return false;
      if (stockFilter === 'out' && level !== 0) return false;
      if (stockFilter === 'limited' && !p.is_limited_edition) return false;

      if (categoryId !== 'all' && p.category_id !== categoryId) return false;

      if (query) {
        const haystack = [
          p.name,
          p.category,
          p.categories?.name,
          p.id,
          p.id ? `LMA-${p.id.slice(-4)}` : ''
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  });

  hasActiveFilters = computed(() =>
    this.filter() !== 'all' ||
    this.categoryFilter() !== 'all' ||
    this.searchQuery().trim().length > 0
  );

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize)));

  paginatedProducts = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredProducts().slice(start, start + this.pageSize);
  });

  pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  paginationLabel = computed(() => {
    const total = this.filteredProducts().length;
    if (total === 0) return '0 piezas';
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `${start}-${end} de ${total} piezas`;
  });

  async ngOnInit() {
    await Promise.all([this.loadProducts(), this.loadCategories()]);
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

  async loadCategories() {
    try {
      const { data, error } = await this.supabase.client
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      if (data) this.categories.set(data as Category[]);
    } catch (e) {
      console.error(e);
    }
  }

  setFilter(f: string) {
    this.filter.set(f);
    this.currentPage.set(1);
  }

  setCategoryFilter(value: string) {
    this.categoryFilter.set(value || 'all');
    this.currentPage.set(1);
  }

  setSearchQuery(value: string) {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.filter.set('all');
    this.categoryFilter.set('all');
    this.searchQuery.set('');
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
