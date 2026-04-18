import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  // --- AUTH ---
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },

  // --- ATELIER ADMIN ROUTES (protegidas) ---
  {
    path: 'admin',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/admin/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'reservations',
        loadComponent: () => import('./features/admin/reservations/reservations.component').then(m => m.ReservationsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/admin/categories/categories.component').then(m => m.CategoriesComponent)
      },
      // Retro compatibility — antes /admin/products servía el listado
      { path: 'products', redirectTo: 'inventory', pathMatch: 'full' },
      {
        path: 'products/new',
        loadComponent: () => import('./features/admin/product-form/product-form.component').then(m => m.ProductFormComponent)
      },
      {
        path: 'products/edit/:id',
        loadComponent: () => import('./features/admin/product-form/product-form.component').then(m => m.ProductFormComponent)
      }
    ]
  },

  // --- PUBLIC ROUTES ---
  {
    path: 'catalog',
    loadComponent: () => import('./features/catalog/product-catalog/product-catalog.component').then(m => m.ProductCatalogComponent)
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/shopping-cart/shopping-cart.component').then(m => m.ShoppingCartComponent)
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./features/catalog/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  },

  // --- DEFAULTS ---
  { path: '', redirectTo: 'catalog', pathMatch: 'full' },
  { path: '**', redirectTo: 'catalog' }
];
