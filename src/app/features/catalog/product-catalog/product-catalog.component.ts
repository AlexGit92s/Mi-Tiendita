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

  filteredProducts = computed(() => {
    const cat = this.activeCategory();
    const available = this.products().filter(p => (p.stock ?? 0) > 0);
    if (cat === 'Todas') return available;
    return available.filter(p => p.categories?.name === cat);
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
  }

  reserveProduct(productId: string) {
    this.router.navigate(['/cart'], { queryParams: { productId } });
  }

  viewDetail(productId: string) {
    this.router.navigate(['/product', productId]);
  }
}
