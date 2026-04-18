import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { Category } from '../../../core/types';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html'
})
export class ProductFormComponent implements OnInit {
  @Input() id?: string;

  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    category_id: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    is_limited_edition: [false]
  });

  images = signal<string[]>([]);
  isSaving = signal(false);
  isUploading = signal(false);
  isLoading = signal(true);
  categories = signal<Category[]>([]);
  loadError = signal<string>('');

  async ngOnInit() {
    await this.loadCategories();
    if (this.id) {
      await this.loadProduct(this.id);
    }
  }

  async loadCategories() {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const { data, error } = await this.supabase.client
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      this.categories.set((data as Category[]) || []);
    } catch (e: any) {
      console.error('Error loading categories:', e);
      this.loadError.set(`Error: ${e.message || 'No se pudieron cargar categorías'}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadProduct(productId: string) {
    try {
      const data: any = await this.supabase.getById('products', productId);
      this.productForm.patchValue({
        name: data.name,
        description: data.description ?? '',
        category_id: data.category_id ?? '',
        price: data.price,
        stock: data.stock,
        is_limited_edition: !!data.is_limited_edition
      });
      this.images.set(Array.isArray(data.images) ? data.images : []);
    } catch (e) {
      console.error(e);
    }
  }

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    this.isUploading.set(true);
    try {
      const uploads: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${Date.now()}_${i}_${safeName}`;
        uploads.push(this.supabase.uploadImage('product-images', path, file));
      }
      const urls = await Promise.all(uploads);
      this.images.update((arr) => [...arr, ...urls]);
    } catch (error) {
      console.error('Upload failed', error);
      alert('Error subiendo una o más imágenes.');
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }

  removeImageAt(index: number) {
    this.images.update((arr) => arr.filter((_, i) => i !== index));
  }

  moveImage(index: number, direction: -1 | 1) {
    const arr = [...this.images()];
    const target = index + direction;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    this.images.set(arr);
  }

  async onSubmit() {
    if (this.productForm.invalid || this.isSaving()) return;
    this.isSaving.set(true);

    const raw = this.productForm.value;
    const selectedCategory = this.categories().find((c) => c.id === raw.category_id);

    const payload: Record<string, any> = {
      name: raw.name,
      description: raw.description || null,
      category_id: raw.category_id || null,
      category: selectedCategory?.name ?? 'Sin categoría',
      price: Number(raw.price) || 0,
      stock: Number(raw.stock) || 0,
      images: this.images(),
      is_limited_edition: !!raw.is_limited_edition,
      sizes: [],
      status: 'disponible'
    };

    try {
      if (this.id) {
        delete payload['status'];
        await this.supabase.update('products', this.id, payload);
      } else {
        await this.supabase.create('products', payload);
      }
      this.router.navigate(['/admin/inventory']);
    } catch (error: any) {
      console.error('Save product failed:', error);
      alert(`Error: ${error?.message ?? 'No se pudo guardar el producto.'}`);
    } finally {
      this.isSaving.set(false);
    }
  }
}
