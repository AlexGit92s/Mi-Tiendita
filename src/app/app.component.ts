import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterModule, Router, NavigationEnd, NavigationError } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/auth.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Mi Tiendita L\'Amour';
  isAdminRoute = false;
  isAuthRoute = false;
  isMobileMenuOpen = false;
  cartCount = signal(0);

  private router = inject(Router);
  protected auth = inject(AuthService);

  ngOnInit() {
    this.syncCartCount();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url: string = event.urlAfterRedirects;
      this.isAdminRoute = url.includes('/admin');
      this.isAuthRoute = url.startsWith('/login');
      this.isMobileMenuOpen = false;
      this.syncCartCount();
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationError)
    ).subscribe((event: any) => this.handleChunkLoadError(event));

    window.addEventListener('storage', this.handleCartSync);
    window.addEventListener('mi_tiendita_cart_updated', this.handleCartSync);
  }

  private handleChunkLoadError(event: NavigationError): void {
    const message = String(event.error?.message ?? event.error ?? '');
    const isChunkError =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Loading chunk [^\s]+ failed/i.test(message) ||
      /error loading dynamically imported module/i.test(message) ||
      /ChunkLoadError/i.test(message);
    if (!isChunkError) return;

    const targetUrl = event.url || window.location.pathname + window.location.search;
    const guardKey = 'mi_tiendita_chunk_reload';
    try {
      if (sessionStorage.getItem(guardKey) === targetUrl) return;
      sessionStorage.setItem(guardKey, targetUrl);
    } catch {
      // sessionStorage puede estar bloqueado en modo privado; seguimos igualmente
    }
    window.location.assign(targetUrl);
  }

  private handleCartSync = () => {
    this.syncCartCount();
  };

  private syncCartCount() {
    try {
      const saved = localStorage.getItem('mi_tiendita_cart');
      const items = saved ? JSON.parse(saved) as Array<{ id?: string }> : [];
      this.cartCount.set(items.filter((item) => !!item?.id).length);
    } catch {
      this.cartCount.set(0);
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/catalog');
  }
}
