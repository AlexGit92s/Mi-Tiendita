import { computed, Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed<boolean>(() => this._session() !== null);

  constructor(private supabase: SupabaseService) {
    this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this._session.set(data.session);
    this._loading.set(false);

    this.supabase.client.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      this._session.set(session);
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
}
