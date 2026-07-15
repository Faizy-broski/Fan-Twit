
-- Allow media-only posts (empty body when media_url is set).
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_body_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_body_check
  CHECK (char_length(body) <= 500 AND (char_length(body) > 0 OR media_url IS NOT NULL));
