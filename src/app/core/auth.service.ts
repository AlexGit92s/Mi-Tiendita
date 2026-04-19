import { computed, Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed<boolean>(() => this._session() !== null);

  private static readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  private static readonly ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;
  private idleTimerId: ReturnType<typeof setTimeout> | null = null;
  private activityAttached = false;

  constructor(private supabase: SupabaseService, private router: Router) {
    this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this._session.set(data.session);
    this._loading.set(false);

    if (data.session) this.startIdleWatcher();

    this.supabase.client.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      this._session.set(session);
      if (session) this.startIdleWatcher();
      else this.stopIdleWatcher();
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) {
      throw new Error('Credenciales inválidas');
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  private startIdleWatcher(): void {
    if (typeof window === 'undefined') return;
    if (!this.activityAttached) {
      for (const evt of AuthService.ACTIVITY_EVENTS) {
        window.addEventListener(evt, this.handleActivity, { passive: true });
      }
      this.activityAttached = true;
    }
    this.resetIdleTimer();
  }

  private stopIdleWatcher(): void {
    if (this.idleTimerId !== null) {
      clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (this.activityAttached && typeof window !== 'undefined') {
      for (const evt of AuthService.ACTIVITY_EVENTS) {
        window.removeEventListener(evt, this.handleActivity);
      }
      this.activityAttached = false;
    }
  }

  private handleActivity = (): void => {
    if (this._session() === null) return;
    this.resetIdleTimer();
  };

  private resetIdleTimer(): void {
    if (this.idleTimerId !== null) clearTimeout(this.idleTimerId);
    this.idleTimerId = setTimeout(() => this.handleIdleTimeout(), AuthService.IDLE_TIMEOUT_MS);
  }

  private async handleIdleTimeout(): Promise<void> {
    if (this._session() === null) return;
    await this.signOut();
    await this.router.navigateByUrl('/login');
  }
}
