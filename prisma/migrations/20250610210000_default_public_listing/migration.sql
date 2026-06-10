-- Enable public listing for existing lending organisations (opt-out via Settings)
UPDATE "organisations"
SET "settings" = COALESCE("settings", '{}'::jsonb) || '{"publicListing": true}'::jsonb
WHERE "deleted_at" IS NULL
  AND COALESCE(("settings"->>'publicListing')::boolean, false) = false;
