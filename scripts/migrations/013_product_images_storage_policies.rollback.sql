-- Rollback de migration 013: quita las policies de Storage para product-images.
-- No elimina el bucket ni los archivos existentes.

BEGIN;

DROP POLICY IF EXISTS "product_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "product_images_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_auth" ON storage.objects;

COMMIT;
