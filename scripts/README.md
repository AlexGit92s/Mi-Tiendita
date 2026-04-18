# scripts/ — Scripts de corrección y mantenimiento

Carpeta para scripts SQL (migraciones, seeds, fixes) y utilidades de mantenimiento del proyecto.
Todo cambio registrado aquí debe reflejarse en [../CHANGELOG.md](../CHANGELOG.md).

## Estructura

```
scripts/
├── README.md                  # este archivo
└── migrations/                # migraciones SQL (orden numérico)
    ├── 001_<nombre>.sql       # cambio hacia delante
    └── 001_<nombre>.rollback.sql  # reversa (opcional pero recomendado)
```

## Convención de nombres

`NNN_descripcion_corta.sql` con `NNN` incrementado secuencialmente (001, 002, …).
Cada migración debe ser **idempotente** donde sea posible (`IF NOT EXISTS`, `CREATE OR REPLACE`).

## Cómo aplicar una migración

1. Abre el SQL Editor de Supabase del proyecto.
2. Copia el contenido del archivo `.sql` y ejecútalo.
3. Verifica el resultado con las queries de validación al final del script.
4. Registra el cambio en [CHANGELOG.md](../CHANGELOG.md) bajo `Changed` o `Added`.

## Cómo revertir

Ejecutar el archivo `*.rollback.sql` correspondiente en el SQL Editor.
**No ejecutar rollbacks en producción sin backup previo.**

## Índice de migraciones

| # | Archivo | Propósito | Aplicada |
|---|---------|-----------|----------|
| 001 | [migrations/001_extend_products.sql](./migrations/001_extend_products.sql) | Añade `description`, `category_id` FK, `is_limited_edition` a `products` | ✅ 2026-04-18 |
| 002 | [migrations/002_extend_reservations.sql](./migrations/002_extend_reservations.sql) | Añade `customer_email`, `reservation_date`, `notes`, `fee_paid` a `reservations` | ✅ 2026-04-18 |
| 003 | [migrations/003_reservation_deposits_and_tracking.sql](./migrations/003_reservation_deposits_and_tracking.sql) | Añade confirmación de depósito, estado `finalizado` e historial `product_tracking_events` | ⏳ pendiente |
| 004 | [migrations/004_tracking_corrections.sql](./migrations/004_tracking_corrections.sql) | Añade metadata para correcciones administrativas en el historial | ⏳ pendiente |
| 005 | [migrations/005_reservation_stock_commit.sql](./migrations/005_reservation_stock_commit.sql) | Añade estado de stock comprometido por reserva para reglas por evento | ⏳ pendiente |
