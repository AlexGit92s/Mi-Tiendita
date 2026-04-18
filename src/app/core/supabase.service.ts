import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  async getAll(table: string, columns = '*', filters?: { [key: string]: any }) {
    let query = this.supabase.from(table).select(columns);
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getById(table: string, id: string | number, columns = '*') {
    const { data, error } = await this.supabase.from(table).select(columns).eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(table: string, payload: any) {
    const { data, error } = await this.supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async update(table: string, id: string | number, payload: any) {
    const { data, error } = await this.supabase.from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async delete(table: string, id: string | number) {
    const { error } = await this.supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async uploadImage(bucket: string, path: string, file: File): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;
    
    const { data: publicUrlData } = this.supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  }
}
