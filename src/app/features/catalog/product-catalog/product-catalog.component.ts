import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/supabase.service';
import { Product } from '../../../core/types';
import { Router } from '@angular/router';

interface ProductWithCategory extends Product {
  categories?: { name: string, slug: string };
}

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-catalog.component.html'
})
export class ProductCatalogComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  
  products = signal<ProductWithCategory[]>([]);
  activeCategory = signal<string>('Todas');
  categories = signal<string[]>([]);
  addedProductId = signal<string | null>(null);
  limitProductId = signal<string | null>(null);
  currentPage = signal(1);
  readonly pageSize = 6;

  filteredProducts = computed(() => {
    const cat = this.activeCategory();
    const available = this.products().filter(p => (p.stock ?? 0) > 0);
    if (cat === 'Todas') return available;
    return available.filter(p => p.categories?.name === cat);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize)));

  paginatedProducts = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredProducts().slice(start, start + this.pageSize);
  });

  paginationLabel = computed(() => {
    const total = this.filteredProducts().length;
    if (total === 0) return '0 productos';
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `${start}-${end} de ${total} productos`;
  });

  async ngOnInit() {
    await this.loadProducts();
  }

  async loadProducts() {
    try {
      const { data, error } = await this.supabase.client.from('products').select("*, categories(name, slug)");
      if (!error && data) {
        const prodList = data as ProductWithCategory[];
        this.products.set(prodList);
        
        const uniqueCats = Array.from(new Set(prodList.map(p => p.categories?.name).filter((n): n is string => !!n)));
        this.categories.set(uniqueCats);
      }
    } catch (e) {
      console.error(e);
    }
  }

  filterByCategory(cat: string) {
    this.activeCategory.set(cat);
    this.currentPage.set(1);
  }

  nextPage() {
    this.currentPage.set(Math.min(this.currentPage() + 1, this.totalPages()));
  }

  previousPage() {
    this.currentPage.set(Math.max(this.currentPage() - 1, 1));
  }

  goToPage(page: number) {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  reserveProduct(productId: string) {
    const product = this.products().find((item) => item.id === productId);
    if (!product) return;

    const saved = localStorage.getItem('mi_tiendita_cart');
    const current = saved ? JSON.parse(saved) as ProductWithCategory[] : [];
    const currentCount = current.filter((item) => item.id === productId).length;
    if (currentCount >= (product.stock ?? 0)) {
      this.limitProductId.set(productId);
      setTimeout(() => {
        if (this.limitProductId() === productId) this.limitProductId.set(null);
      }, 2000);
      return;
    }

    localStorage.setItem('mi_tiendita_cart', JSON.stringify([...current, product]));
    window.dispatchEvent(new Event('mi_tiendita_cart_updated'));

    this.addedProductId.set(productId);
    setTimeout(() => {
      if (this.addedProductId() === productId) this.addedProductId.set(null);
    }, 2000);
  }

  viewDetail(productId: string) {
    this.router.navigate(['/product', productId]);
  }
}
