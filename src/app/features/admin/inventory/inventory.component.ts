import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { Product } from '../../../core/types';

interface ProductWithCategory extends Product {
  categories?: { name: string };
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

  async deleteProduct(id: string) {
    if (confirm('¿Desea eliminar esta pieza permanentemente?')) {
      try {
        await this.supabase.delete('products', id);
        await this.loadProducts();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
