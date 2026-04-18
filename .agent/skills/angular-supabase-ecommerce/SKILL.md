# Angular + Supabase E-commerce Generator

## Trigger
Usa este skill cuando generes código para tiendas Angular + Supabase

## Rules
1. Siempre usa Angular 17+ standalone components
2. Signals en lugar de observables cuando sea posible
3. Supabase client como servicio singleton
4. TailwindCSS + DaisyUI para UI
5. Reactive Forms para formularios
6. NO generes código de testing
7. NO expliques conceptos básicos

## Templates

### Supabase Service
```typescript
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;
  
  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }
  
  // CRUD methods aquí
}
```

### Product Interface
```typescript
export interface Product {
  id?: string;
  name: string;
  category: string;
  price: number;
  sizes: string[];
  images: string[];
  stock: number;
  status: 'disponible' | 'apartado' | 'vendido';
  created_at?: string;
}
```
