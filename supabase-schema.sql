-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- 1. Tabla de Categorías L'Amour
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Productos
create table products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric not null,
  category_id uuid references categories(id) on delete set null,
  stock_level integer default 0,
  image_url text,
  is_limited_edition boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Reservas (Apartados)
create table reservations (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  reservation_date date not null,
  status text not null default 'pending', -- pending, confirmed, cancelled
  notes text,
  fee_paid boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Eliminar politicas si existen (para reset limpio)
DROP POLICY IF EXISTS "Public can view categories" ON categories;
DROP POLICY IF EXISTS "Public can view products" ON products;
DROP POLICY IF EXISTS "Public can create reservations" ON reservations;
DROP POLICY IF EXISTS "Public can view reservations" ON reservations;

-- Habilitar RLS
alter table categories enable row level security;
alter table products enable row level security;
alter table reservations enable row level security;

-- Políticas ultra-permisivas para desarrollo frontend (Demo Básico L'Amour)
CREATE POLICY "Enable all for categories" ON categories FOR ALL USING (true);
CREATE POLICY "Enable all for products" ON products FOR ALL USING (true);
CREATE POLICY "Enable all for reservations" ON reservations FOR ALL USING (true);

-- Insertar datos de demo (Opcional pero util para previsualizar)
insert into categories (name, slug) values
('High Jewelry', 'high-jewelry'),
('Leather Goods', 'leather-goods'),
('Dresses', 'dresses');
