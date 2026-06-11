-- Phase 6: rename storage key column + private Supabase Storage bucket

ALTER TABLE "documents" RENAME COLUMN "s3_key" TO "storage_path";

-- Private bucket for org-scoped lender documents (access via API signed URLs only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lms-documents',
  'lms-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Deny direct client access; NestJS service role issues signed URLs after org checks
DROP POLICY IF EXISTS "lms_documents_service_only" ON storage.objects;
CREATE POLICY "lms_documents_service_only" ON storage.objects
  FOR ALL
  USING (bucket_id = 'lms-documents' AND false)
  WITH CHECK (bucket_id = 'lms-documents' AND false);
