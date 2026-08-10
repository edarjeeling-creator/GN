CREATE TABLE IF NOT EXISTS gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT,
    year TEXT,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE gallery ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE gallery ADD COLUMN IF NOT EXISTS year TEXT;

NOTIFY pgrst, 'reload schema';
