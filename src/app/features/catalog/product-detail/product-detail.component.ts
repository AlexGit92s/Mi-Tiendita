import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { Product } from '../../../core/types';

interface ProductWithCategory extends Product {
  categories?: { name: string; slug: string };
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html'
})
export class ProductDetailComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  product = signal<ProductWithCategory | null>(null);
  loading = signal<boolean>(true);
  notFound = signal<boolean>(false);
  activeImageIndex = signal<number>(0);
  addedToCart = signal(false);
  stockLimitReached = signal(false);

  activeImage = computed(() => {
    const p = this.product();
    const idx = this.activeImageIndex();
    return p?.images?.[idx] ?? null;
  });

  isAvailable = computed(() => (this.product()?.stock ?? 0) > 0);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    await this.loadProduct(id);
  }

  async loadProduct(id: string) {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('products')
        .select('*, categories(name, slug)')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        this.notFound.set(true);
        return;
      }
      this.product.set(data as ProductWithCategory);
    } catch (e) {
      console.error('Error cargando producto:', e);
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  selectImage(index: number) {
    this.activeImageIndex.set(index);
  }

  reserve() {
    const p = this.product();
    if (!p?.id) return;

    const saved = localStorage.getItem('mi_tiendita_cart');
    const current = saved ? JSON.parse(saved) as ProductWithCategory[] : [];
    const currentCount = current.filter((item) => item.id === p.id).length;
    if (currentCount >= (p.stock ?? 0)) {
      this.stockLimitReached.set(true);
      setTimeout(() => this.stockLimitReached.set(false), 2000);
      return;
    }

    localStorage.setItem('mi_tiendita_cart', JSON.stringify([...current, p]));
    window.dispatchEvent(new Event('mi_tiendita_cart_updated'));

    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}
