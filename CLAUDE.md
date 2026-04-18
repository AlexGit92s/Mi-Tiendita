# Mi-Tiendita — Guía técnica del proyecto

> Documento de contexto para cualquier IA (Claude, GPT, Gemini, etc.) que trabaje en este repositorio.
> **Cualquier cambio significativo debe registrarse en [CHANGELOG.md](./CHANGELOG.md).**

---

## 1. Resumen del proyecto

**Mi-Tiendita** es una aplicación e-commerce ligera (tienda de ropa con variantes talla/color) construida como SPA Angular + backend-as-a-service Supabase. Incluye un panel de administración para gestionar productos y reservas, y un catálogo público donde los clientes pueden apartar productos.

**Dominio de negocio:**
- Venta de productos con variantes (talla, color), imágenes múltiples y stock.
- Estado del producto: `disponible` | `apartado` | `vendido`.
- Reservas: un cliente puede apartar un producto (nombre + teléfono), el admin gestiona el estado: `pendiente` | `pagado` | `entregado` | `cancelado`.
- Admin protegido por rol autenticado de Supabase (RLS). Público solo lee productos e inserta reservas.

---

## 2. Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework frontend | Angular (standalone components) | 17.3.x |
| Lenguaje | TypeScript | 5.4.x |
| Estilos | Tailwind CSS + DaisyUI | TW 3.4 / Daisy 5.5 |
| Backend / DB / Auth / Storage | Supabase | `@supabase/supabase-js` 2.103 |
| Router | `@angular/router` con `withComponentInputBinding` + `withViewTransitions` | — |
| HTTP | `provideHttpClient(withFetch())` | — |
| Testing | Karma + Jasmine (instalado, sin specs propias aún) | 5.1 / 6.4 |
| Build | Angular CLI (`ng build`) | 17.3 |
| Entorno local | Laragon (Windows) | — |

No hay backend propio — toda la lógica de datos pasa por el cliente Supabase.

---

## 3. Estructura del repositorio

```
Mi-Tiendita/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── supabase.service.ts     # Cliente Supabase singleton
│   │   │   └── types.ts                # Interfaces Product, Reservation
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   ├── product-form/       # Alta/edición de producto
│   │   │   │   ├── products-list/      # Listado admin
│   │   │   │   └── reservations-list/  # Gestión de reservas
│   │   │   ├── catalog/
│   │   │   │   └── product-catalog/    # Catálogo público
│   │   │   └── cart/
│   │   │       └── shopping-cart/      # Carrito / reserva
│   │   ├── app.component.{ts,html,css}
│   │   ├── app.config.ts               # providers raíz
│   │   └── app.routes.ts               # rutas con lazy loading
│   ├── environments/
│   │   └── environment.ts              # ⚠️ contiene claves Supabase (placeholder)
│   ├── assets/
│   ├── index.html
│   ├── main.ts
│   └── styles.css                      # Tailwind directives
├── supabase-schema.sql                 # Schema completo (tablas + RLS + storage)
├── tailwind.config.js
├── angular.json
├── package.json
├── .claude/skills/                     # Skills Claude Code (5, ver §8)
├── .agent/skills/                      # Copia origen de las skills
├── CLAUDE.md                           # ← este archivo
└── CHANGELOG.md                        # histórico de cambios
```

### Convenciones de organización

- **Feature folders** bajo `src/app/features/<área>/<feature>/`. Cada feature = componente standalone + (opcional) servicio local.
- **Core** contiene únicamente singletons compartidos: cliente Supabase y tipos globales.
- **Lazy loading** obligatorio en rutas nuevas (`loadComponent`).
- No existe carpeta `shared/` aún — crearla solo cuando haya ≥2 consumidores reales de un componente.

---

## 4. Modelo de datos (Supabase)

Fuente de verdad: [supabase-schema.sql](./supabase-schema.sql).

### Tablas

**`products`**
- `id` UUID PK, `name`, `category`, `price` NUMERIC(10,2)
- `sizes` JSONB (array de variantes talla/color)
- `images` TEXT[] (URLs del bucket `product-images`)
- `stock` INTEGER, `status` ENUM `product_status`
- `created_at` TIMESTAMPTZ

**`reservations`**
- `id` UUID PK, `product_id` FK → products (ON DELETE RESTRICT)
- `customer_name`, `customer_phone`, `status` ENUM `reservation_status`

**`categories`**
- `id` UUID PK, `name`, `slug` UNIQUE

### Enums
- `product_status`: `disponible | apartado | vendido`
- `reservation_status`: `pendiente | pagado | entregado | cancelado`

### RLS (Row Level Security) — activado en todas las tablas

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| products | público | authenticated | authenticated | authenticated |
| categories | público | authenticated | authenticated | authenticated |
| reservations | authenticated | **público** | authenticated | authenticated |

> El público puede crear reservas pero no leerlas. El admin (usuario autenticado de Supabase) gestiona todo lo demás.

### Storage
Bucket público `product-images`. Lectura pública, escritura solo authenticated.

---

## 5. Rutas actuales

Definidas en [src/app/app.routes.ts](./src/app/app.routes.ts):

| Ruta | Componente (lazy) |
|------|-------------------|
| `/` | redirect → `/admin/products` |
| `/admin/products` | `ProductsListComponent` |
| `/admin/products/new` | `ProductFormComponent` |
| `/admin/products/edit/:id` | `ProductFormComponent` |

Rutas pendientes (componentes existen en `features/` pero no están enrutados):
- Catálogo público (`product-catalog`)
- Carrito (`shopping-cart`)
- Listado de reservas admin (`reservations-list`)

---

## 6. Convenciones de código

**Angular**
- Standalone components siempre. Nada de `NgModule`.
- Preferir **signals** sobre observables para estado local (el stack es Angular 17).
- Reactive Forms para formularios (no template-driven).
- Lazy loading en todas las rutas.
- `withComponentInputBinding()` → los `@Input()` se enlazan automáticamente desde params.

**Supabase**
- Un único cliente singleton en `core/supabase.service.ts`. No instanciar clientes ad-hoc.
- Tipos de tablas en `core/types.ts`. Si se añade una tabla, añadir su interfaz.
- Nunca saltarse RLS desde el cliente. Si hace falta lógica privilegiada → Edge Function.

**UI / estilos**
- Tailwind utilities + DaisyUI components. No CSS custom salvo para casos imposibles con utilities.
- Tokens de diseño en `tailwind.config.js` (extender ahí, no inline).

**TypeScript**
- `strict: true` (ver `tsconfig.json`). Nunca `any` implícito.
- Tipos de dominio en `core/types.ts`.

---

## 7. Desarrollo local

```bash
npm install
npm start              # ng serve — http://localhost:4200
npm run build          # build producción
npm test               # Karma + Jasmine (headless chrome)
```

**Configurar Supabase:** editar `src/environments/environment.ts` con la URL y anon-key reales. Actualmente contiene placeholders — el proyecto **no arrancará con datos reales hasta configurar esto**.

**Aplicar schema:** ejecutar [supabase-schema.sql](./supabase-schema.sql) en el SQL Editor de Supabase (una sola vez, o reejecutarlo tras `DROP`).

---

## 8. Skills Claude Code instaladas

Carpeta [.claude/skills/](./.claude/skills/) — se activan automáticamente al abrir este repo con Claude Code:

| Skill | Propósito |
|-------|-----------|
| `angular-supabase-ecommerce` | Generador específico para este stack (templates de services, components, forms) |
| `tailwindcss-development` | Guía Tailwind v3: utilities, plugins, design tokens |
| `frontend-design` | Interfaces de alta calidad, evita estética genérica de IA |
| `performance-optimization` | Reglas de rendimiento frontend/backend/DB |
| `security-hardening` | OWASP, CSP, auth, protección de datos |

Generadas con [SkillGenerator](https://github.com/AlexGit92s/SkillGenerator) (`skill-gen create ...`).

---

## 9. Reglas para agentes IA trabajando en este repo

1. **Lee este archivo primero.** Contiene el contexto que no está en el código.
2. **Registra cambios en [CHANGELOG.md](./CHANGELOG.md)** siguiendo el formato Keep a Changelog (ver el propio archivo). Cualquier modificación de schema, rutas, dependencias o decisión arquitectónica **debe** quedar registrada.
3. **No toques `environment.ts`** con claves reales, ni las commitees. Usa siempre placeholders en ejemplos.
4. **Respeta RLS.** Si una operación parece requerir bypass, es señal de que la lógica debe moverse a una Edge Function de Supabase, no de desactivar la policy.
5. **No generes tests automáticamente** salvo petición explícita (regla del skill `angular-supabase-ecommerce`).
6. **Lazy loading** en rutas nuevas. No importar componentes directamente en `app.routes.ts`.
7. **Usa los tipos de `core/types.ts`**. Si añades una tabla, añade su interfaz ahí.
8. **Confirma antes de** borrar archivos, correr migraciones destructivas, o modificar `supabase-schema.sql` en producción.

---

## 10. Estado actual conocido

- ✅ Schema Supabase definido y documentado.
- ✅ Estructura de carpetas creada (core + features).
- ✅ Router configurado con lazy loading para admin/products.
- ⚠️ `environment.ts` con placeholders — **no operativo contra Supabase real todavía**.
- ⚠️ Rutas de catálogo público, carrito y reservas admin **no enrutadas aún**.
- ⚠️ Sin autenticación implementada en UI (las rutas admin no están protegidas por guard).
- ⚠️ Sin tests propios escritos.

Consultar [CHANGELOG.md](./CHANGELOG.md) para el histórico detallado.

---

## 11. Autenticación de administradores

**Modelo:** Supabase Auth (`auth.users`), email + password. No hay signup en la UI.

**Cómo crear un admin nuevo:**
1. Ir al dashboard de Supabase → Authentication → Users → **Add user**.
2. Elegir "Create new user", marcar "Auto Confirm User".
3. Email + contraseña fuerte. El usuario ya puede iniciar sesión en `/login`.

**Componentes involucrados:**
- [core/auth.service.ts](./src/app/core/auth.service.ts) — estado de sesión (signals), `signIn`, `signOut`, listener `onAuthStateChange`.
- [core/auth.guard.ts](./src/app/core/auth.guard.ts) — `authGuard` (protege `/admin/*`), `guestGuard` (redirige `/login` → `/admin/dashboard` si ya autenticado).
- [features/auth/login/](./src/app/features/auth/login/) — UI del login.

**Flujo:**
- Visita a `/admin/*` sin sesión → redirige a `/login?returnUrl=...`.
- Login exitoso → redirige a `returnUrl` (validado para evitar open-redirect) o `/admin/dashboard`.
- `signOut()` en navbar (botón "Salir") → vuelve a `/catalog`.

**Reglas de oro:**
- **No implementar signup** en la UI. Si se necesita onboarding público, es otra feature separada con flujo de invitación.
- **No desactivar RLS** aunque el guard proteja la UI. Guards protegen navegación; policies protegen datos.
- **No logar passwords ni tokens**. Errores genéricos al usuario ("Credenciales inválidas"), detalles solo en consola de desarrollo.
- **Persistencia**: el cliente de Supabase guarda la sesión en `localStorage` por defecto; el `AuthService` espera al bootstrap antes de resolver los guards.
