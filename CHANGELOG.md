# Changelog — Mi-Tiendita

> Registro cronológico de cambios, decisiones técnicas y eventos relevantes del proyecto.
> Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).
>
> **Reglas para registrar cambios:**
> 1. Toda modificación a **schema**, **rutas**, **dependencias**, **arquitectura** o **convenciones** se registra aquí.
> 2. Fecha en formato `YYYY-MM-DD`. Autor entre paréntesis (humano o IA).
> 3. Agrupar por tipo: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Docs`.
> 4. Sección `[Unreleased]` al principio para cambios pendientes de release.
> 5. Al liberar versión: mover entradas de `[Unreleased]` a una nueva sección `[X.Y.Z] - YYYY-MM-DD`.

---

## [Unreleased]
### Added
- **Detalle de producto público** — nuevo componente [product-detail](./src/app/features/catalog/product-detail/) con galería (imagen principal + miniaturas navegables), descripción, tallas, estado de stock y botón "Añadir al apartado" que reenvía a `/cart?productId=`. Ruta pública `/product/:id` enrutada en [app.routes.ts](./src/app/app.routes.ts). _(Claude/Alex)_
- **Botón "Ver Detalle"** en cada tarjeta del catálogo ([product-catalog.component.html](./src/app/features/catalog/product-catalog/product-catalog.component.html)) y nombre clicable para navegar al detalle. _(Claude/Alex)_
- **Historial de seguimiento por producto/reserva** — nueva tabla [003_reservation_deposits_and_tracking.sql](./scripts/migrations/003_reservation_deposits_and_tracking.sql) para registrar eventos como `reserva_creada`, `vendido`, `empaquetado`, `en_camino`, `recibido`, `cerrado_pagado`, `cerrado_devuelto` y `otro`. El carrito ahora registra el evento inicial al crear la reserva. _(Codex)_

### Changed
- **Moneda → Lempiras (L.)** en toda la UI. Se reemplazó el símbolo `$` por `L.` en catálogo, detalle, carrito (total, seña, restante), inventario, reservaciones, dashboard (valor confirmado) y label de precio en product-form. La nota `depositNote` del carrito también usa `L.` al guardarse en `reservations.notes`. _(Claude/Alex)_
- **Textos en francés e inglés → español** — se tradujeron literales dispersos: `Console de Gestion` → `Panel de Gestión`, `Valeur Confirmée` → `Valor Confirmado`, `Citations Actives` → `Reservas Activas`, `Stock Vitalité` → `Salud del Stock`, `Bon Status` → `Buen Estado`, `Flux d'Activité` → `Actividad Reciente`, `Silence Éthéré...` → `Sin actividad reciente...`, `Voir tout le flux` → `Ver todas las reservas`, `Ma Sélection` → `Mi Selección`, `Request a Fitting` → `Solicitar Apartado`, `Appointment` → `Cita / Fitting`, `Paid ✓ / Unpaid` → `Pagado ✓ / Pendiente`, `Pas de réservations` → `Sin reservaciones`, `Sold Out / Low Stock / In Stock / Full Stock` → `Agotado / Stock Bajo / En Stock / Stock Completo`, `Limited` → `Limitada`, `Ethereal Focus` → `Sin Imágenes`, `Management` → `Administración`, `Ir a Boutique` → `Ver Catálogo`, `Atelier Or` → `Mi Tiendita L'Amour`, `Ethereal Atelier` (footer) → `Mi Tiendita L'Amour`. _(Claude/Alex)_
- **Admin de reservas** — el depósito dejó de ser un booleano ciego: ahora se confirma con `numero de referencia` o `autorizacion`, `quien transfiere` y fecha de confirmación. El listado agrega estado `finalizado`, panel de depósito y timeline de seguimiento por pieza. _(Codex)_
- **Historial protegido** — reservas `finalizado` y `cancelado` quedan bloqueadas para edición normal. Los cambios posteriores solo entran por `correccion administrativa`, con motivo y usuario registrados en `product_tracking_events`. _(Codex)_
- **Stock derivado por eventos** — las reservas ahora pueden comprometer stock una sola vez (`stock_committed`) en eventos como depósito confirmado/recibido, y devolverlo en eventos de devolución o liberación. _(Codex)_

### Fixed
- **Dashboard contaba estados inexistentes** (`'pending'`, `'confirmed'` en inglés) → `activeReservations` ahora cuenta `'pendiente'` y `totalConfirmedValue` suma `'pagado' | 'entregado'`, alineado al enum `reservation_status` real. _(Claude/Alex)_

### Added
- **Carpeta [scripts/](./scripts/)** con estructura para migraciones SQL y utilidades de mantenimiento. Incluye README con convenciones e índice. _(Claude/Alex)_
- **Migración [001_extend_products.sql](./scripts/migrations/001_extend_products.sql)** ✅ aplicada 2026-04-18 — añade `description`, `category_id` FK → `categories`, `is_limited_edition`, índice y backfill por nombre. Incluye rollback idempotente. _(Claude/Alex)_

### Fixed
- **Form de productos guardaba campos inexistentes** causando "Ocurrió un error guardando el producto". Payload realineado: `stock_level` → `stock`, `image_url` → `images: [urls]` (array), y se derivó `category` TEXT desde el nombre de la categoría seleccionada. _(Claude/Alex)_
- **Errores de build** (`reservation_date`, `fee_paid`, `customer_email` "does not exist") — `Reservation` en [types.ts](./src/app/core/types.ts) ampliado con los campos de la migración 002. _(Claude/Alex)_
- **Status en inglés en [reservations.component.html](./src/app/features/admin/reservations/reservations.component.html)** (`pending | confirmed | cancelled`) corregido al enum español (`pendiente | pagado | entregado | cancelado`) en badges y dropdown. Mismo fix en el payload del carrito ([shopping-cart.component.ts](./src/app/features/cart/shopping-cart/shopping-cart.component.ts)): `'pending'` → `'pendiente'`. _(Claude/Alex)_
- **Warnings NG8107** (optional chain innecesario sobre `images`) — `product.images?.[0]` → `product.images && product.images[0]` en inventory y catalog. _(Claude/Alex)_

### Added (migraciones)
- **[002_extend_reservations.sql](./scripts/migrations/002_extend_reservations.sql)** ✅ aplicada 2026-04-18 — añade `customer_email` TEXT, `reservation_date` DATE, `notes` TEXT, `fee_paid` BOOLEAN a `reservations`. Rollback idempotente incluido. _(Claude/Alex)_

### Added (features)
- **Flujo de seña 50% por transferencia** en el carrito — sidebar muestra `Total`, `Seña 50%` y `Restante al retirar`; la pantalla de éxito ahora exhibe los datos bancarios (banco, cuenta, titular, tipo) y un WhatsApp para enviar el comprobante. El monto de la seña se guarda como prefijo en `notes` para que el admin lo vea en la gestión. _(Claude/Alex)_
- **Carga de producto por query param** — `/cart?productId=<uuid>` ahora hace fetch del producto en Supabase y lo añade al carrito (persistido en `localStorage`, sin duplicados). Antes el link desde el catálogo no cargaba nada. _(Claude/Alex)_

### Fixed
- **Bug del carrito** (`/cart?productId=...` no mostraba el artículo) — el componente solo leía `localStorage` e ignoraba el query param. Corregido en [shopping-cart.component.ts](./src/app/features/cart/shopping-cart/shopping-cart.component.ts) usando `ActivatedRoute` + `supabase.getById`. _(Claude/Alex)_
- **Galería multi-imagen** en [product-form](./src/app/features/admin/product-form/) — se pueden subir varias imágenes a la vez, reordenarlas (flechas) y quitarlas. La primera es la "principal". _(Claude/Alex)_
- **Tipos desalineados con schema** — [core/types.ts](./src/app/core/types.ts) regenerado al shape real (`Product` con `stock`, `images[]`, `sizes[]`, `status`, `category` + `category_id` opcional). Propagado a [inventory](./src/app/features/admin/inventory/), [product-catalog](./src/app/features/catalog/product-catalog/), [shopping-cart](./src/app/features/cart/shopping-cart/) y [reservations](./src/app/features/admin/reservations/). _(Claude/Alex)_
- **Catálogo público** en nueva vista (`product-catalog`) y **Carrito interactivo** usando LocalStorage. _(Antigravity)_
- **Gestión de apartado (client-side)** con la habilidad para reservar productos al array del Carrito. _(Antigravity)_
- **Admin Reservas (`reservations-list`)** con capacidad de filtrar y modificar los estados (`pendiente, pagado, entregado, cancelado`). _(Antigravity)_
- **Autenticación de admin con Supabase Auth** — nuevo [AuthService](./src/app/core/auth.service.ts) con signals (`session`, `user`, `isAuthenticated`) y listener `onAuthStateChange` para mantener la sesión sincronizada entre pestañas. _(Claude/Alex)_
- **Componente login** standalone en [features/auth/login/](./src/app/features/auth/login/) con Reactive Forms, validación email + min 8 chars, toggle mostrar/ocultar contraseña, mensajes de error genéricos, estado `loading`, y soporte de `returnUrl` para volver al intento original tras el login. _(Claude/Alex)_
- **Guards funcionales** en [core/auth.guard.ts](./src/app/core/auth.guard.ts): `authGuard` (protege `/admin/*`) y `guestGuard` (impide acceder a `/login` si ya hay sesión). Ambos esperan al bootstrap del `AuthService` antes de decidir. _(Claude/Alex)_
- **Ruta `**` wildcard** redirige al catálogo para URLs no existentes. _(Claude/Alex)_

### Changed
- **Router** (`app.routes.ts`) completamente configurado con lazily loaded routing para los nuevos módulos administrativos (`reservations`) y públicos (`catalog`, `cart`). _(Antigravity)_
- **Rutas admin reagrupadas** bajo un path padre `/admin` con `canActivate`/`canActivateChild` del `authGuard` — protección unificada en lugar de duplicada por ruta. _(Claude/Alex)_
- **Navbar** ([app.component.html](./src/app/app.component.html)) muestra botón "Salir" cuando hay sesión activa en rutas admin, y enlace "Acceso" (en vez de "Management") para usuarios no autenticados. _(Claude/Alex)_

### Security
- **Registro desactivado en la UI** — el login component no expone signup. Los administradores se crean únicamente desde el panel de Supabase (Auth → Users → Add user). Documentado en [CLAUDE.md](./CLAUDE.md) §11. _(Claude/Alex)_
- **Mensajes de error genéricos** en login ("Credenciales inválidas") para no filtrar si un email existe — prevención de user enumeration. _(Claude/Alex)_
- **Validación de `returnUrl`** — solo se acepta si empieza con `/` y no con `//` (evita open redirect a dominios externos). _(Claude/Alex)_
- **Autocomplete correcto** (`email`, `current-password`) y atributos `maxlength` en inputs para prevenir abuso. _(Claude/Alex)_
- **RLS de Supabase sigue siendo la última línea de defensa** — el guard protege UI; las policies protegen datos. No desactivar ninguna. _(Claude/Alex)_
---

## [0.1.0] - 2026-04-18

### Added
- **Documentación técnica** — nuevo [CLAUDE.md](./CLAUDE.md) con guía completa del proyecto para agentes IA (stack, estructura, modelo de datos, convenciones, reglas). _(Claude/Alex)_
- **Changelog** — este archivo, para trazabilidad de cambios. _(Claude/Alex)_
- **Skills Claude Code** — 5 skills instaladas en [.claude/skills/](./.claude/skills/) generadas con [SkillGenerator](https://github.com/AlexGit92s/SkillGenerator): _(Claude/Alex)_
  - `angular-supabase-ecommerce` (template específico del stack)
  - `tailwindcss-development`
  - `frontend-design` (Anthropic)
  - `performance-optimization`
  - `security-hardening`

### Docs
- Documentado schema Supabase, políticas RLS, rutas actuales y convenciones de código en [CLAUDE.md](./CLAUDE.md).
- Documentado estado actual: rutas pendientes de enrutar, `environment.ts` con placeholders, ausencia de guard de auth.

---

## [0.0.1] - commit inicial (ver `git log`)

### Added
- Proyecto Angular 17.3 inicializado con CLI.
- Dependencias: `@supabase/supabase-js@2.103`, `tailwindcss@3.4`, `daisyui@5.5`, `autoprefixer`, `postcss`.
- Estructura base: `src/app/core/` (supabase service, types) y `src/app/features/` (admin, catalog, cart).
- `supabase-schema.sql` — schema completo con tablas `products`, `reservations`, `categories`, enums, RLS activada en todas, y bucket de storage `product-images`.
- Rutas admin para listado y CRUD de productos (lazy loading).
- Config de router con `withComponentInputBinding()` y `withViewTransitions()`.
- Tailwind + DaisyUI configurados.
- `environment.ts` con placeholders para credenciales Supabase.

---

## Plantilla para nuevas entradas

Copiar al añadir un bloque nuevo en `[Unreleased]`:

```markdown
### Added
- Descripción breve del cambio. _(autor)_

### Changed
- Qué cambió y por qué (1 línea). _(autor)_

### Fixed
- Bug arreglado — referencia a commit/PR si aplica. _(autor)_

### Security
- Cambio relacionado con seguridad (RLS, auth, validación, secretos). _(autor)_

### Docs
- Actualización de documentación. _(autor)_
```
