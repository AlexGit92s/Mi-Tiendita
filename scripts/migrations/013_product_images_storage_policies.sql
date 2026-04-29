-- ============================================================================
-- Migration 013: bucket y policies de Storage para imagenes de productos
-- ----------------------------------------------------------------------------
-- Motivo: el formulario de inventario sube archivos al bucket `product-images`.
-- Supabase Storage bloquea uploads por defecto si `storage.objects` no tiene
-- policies RLS que permitan INSERT al rol autenticado.
--
-- Matriz esperada:
--   product-images -> lectura publica para catalogo
--                  -> INSERT/UPDATE/DELETE solo authenticated
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_auth" ON storage.objects;

CREATE POLICY "product_images_select_public"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_auth"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_update_auth"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_delete_auth"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'product-images';

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'product_images_%'
ORDER BY policyname;

COMMIT;
