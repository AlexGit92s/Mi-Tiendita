import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="px-6 py-10 mx-auto max-w-7xl min-h-screen bg-[#fcfcfc] text-[#333333]">

      <!-- Quick Access Links -->
      <div class="flex flex-wrap gap-4 mb-10">
        <a routerLink="/admin/dashboard" class="group px-5 py-2.5 bg-white border border-lamour-stone/10 text-gray-500 hover:border-lamour-stone hover:bg-lamour-stone/5 hover:text-lamour-stone transition-all duration-300 text-[11px] uppercase tracking-widest font-bold rounded-sm flex items-center gap-3 shadow-sm active:scale-95">
          <div class="p-1.5 bg-gray-50 rounded-sm group-hover:bg-lamour-stone group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
          </div>
          Dashboard
        </a>
        <a routerLink="/admin/inventory" class="group px-5 py-2.5 bg-white border border-lamour-stone/10 text-gray-500 hover:border-lamour-stone hover:bg-lamour-stone/5 hover:text-lamour-stone transition-all duration-300 text-[11px] uppercase tracking-widest font-bold rounded-sm flex items-center gap-3 shadow-sm active:scale-95">
          <div class="p-1.5 bg-gray-50 rounded-sm group-hover:bg-lamour-stone group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          </div>
          Inventario
        </a>
        <a routerLink="/admin/reservations" class="group px-5 py-2.5 bg-white border border-lamour-blush/10 text-gray-500 hover:border-lamour-blush hover:bg-lamour-blush/5 hover:text-lamour-blush transition-all duration-300 text-[11px] uppercase tracking-widest font-bold rounded-sm flex items-center gap-3 shadow-sm active:scale-95">
          <div class="p-1.5 bg-gray-50 rounded-sm group-hover:bg-lamour-blush group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0020.25 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          </div>
          Apartados
        </a>
      </div>

      <div class="mb-8 border-b border-lamour-blush/30 pb-6">
        <h1 class="text-3xl font-serif text-lamour-stone uppercase tracking-widest">Categorías</h1>
        <p class="mt-2 text-sm text-gray-500 font-sans tracking-wide font-light">Administre las familias de productos disponibles.</p>
      </div>

      <!-- Create Form -->
      <div class="bg-white shadow-sm p-6 md:p-8 border border-lamour-blush/20 rounded-lg mb-8">
        <h2 class="text-xl font-serif text-lamour-stone uppercase tracking-widest mb-5">Nueva Categoría</h2>
        
        <form [formGroup]="categoryForm" (ngSubmit)="onSubmit()" class="flex flex-col md:flex-row gap-4 items-end">
          <div class="form-control flex-1 w-full">
            <label class="label flex flex-col items-start gap-1">
              <span class="label-text uppercase tracking-[0.2em] text-gray-500 font-semibold text-[11px]">Nombre de la Categoría</span>
            </label>
            <input type="text" formControlName="name" 
              class="input w-full rounded-sm bg-white border border-gray-200 text-gray-800 px-4 py-3 
                     focus:border-lamour-blush focus:ring-1 focus:ring-lamour-blush/30 focus:outline-none transition-all duration-300
                     placeholder:text-gray-300 placeholder:text-xs" 
              placeholder="Ej. Vestidos, Complementos, Zapatos..."/>
          </div>
          <button type="submit" 
            class="px-8 py-3 bg-lamour-stone text-white hover:bg-lamour-gold transition-all duration-300 uppercase tracking-[0.15em] text-[11px] font-bold rounded-sm shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" 
            [disabled]="categoryForm.invalid || isSaving()">
            @if(isSaving()) {
              <span class="loading loading-spinner loading-md"></span>
            } @else {
              Crear
            }
          </button>
        </form>
      </div>

      <!-- Categories List -->
      <div class="bg-white shadow-sm border border-lamour-blush/20 rounded-lg overflow-hidden">
        <div class="p-4 border-b border-lamour-blush/10 bg-gray-50">
          <h3 class="text-lg font-serif text-lamour-stone uppercase tracking-widest">Categorías Existentes</h3>
        </div>
        
        @if (isLoading()) {
          <div class="flex items-center justify-center py-12">
            <span class="loading loading-spinner loading-lg text-lamour-blush"></span>
          </div>
        } @else if (categories().length === 0) {
          <div class="text-center py-12 px-4">
            <p class="text-gray-400 font-serif text-lg uppercase tracking-widest opacity-40">No hay categorías todavía</p>
            <p class="text-gray-400 text-sm mt-2">Cree su primera categoría arriba</p>
          </div>
        } @else {
          <div class="divide-y divide-gray-100">
            @for (cat of categories(); track cat.id) {
              <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-center gap-3">
                  <span class="font-serif text-gray-800 tracking-wide">{{ cat.name }}</span>
                  @if(cat.slug) {
                    <span class="text-[10px] text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">{{ cat.slug }}</span>
                  }
                </div>
                <button (click)="deleteCategory(cat.id)" 
                  class="p-2 text-gray-300 hover:text-red-400 transition-colors" 
                  title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.439 0c-1.18.037-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class CategoriesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  categoryForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]]
  });

  categories = signal<any[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);

  async ngOnInit() {
    await this.loadCategories();
  }

  async loadCategories() {
    this.isLoading.set(true);
    try {
      const data = await this.supabase.client.from('categories').select('*').order('name');
      this.categories.set(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSubmit() {
    if (this.categoryForm.invalid) return;
    this.isSaving.set(true);

    const name = this.categoryForm.value.name.trim();
    const slug = this.toSlug(name);

    try {
      await this.supabase.create('categories', { name, slug });
      this.categoryForm.reset();
      await this.loadCategories();
    } catch (e) {
      console.error(e);
      alert('Error creando categoría');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteCategory(id: string) {
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
    
    try {
      await this.supabase.delete('categories', id);
      await this.loadCategories();
    } catch (e) {
      console.error(e);
      alert('Error eliminando categoría. Puede tener productos asociados.');
    }
  }

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
