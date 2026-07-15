
-- Denormalized like/repost/reply counters on posts, maintained by triggers.
-- These let every page show accurate counts with a cheap column read
-- instead of embedding+counting the likes/reposts/replies tables, and let
-- Supabase Realtime broadcast count changes via plain `posts` UPDATE events.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repost_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;

UPDATE public.posts p
SET like_count = (SELECT count(*) FROM public.likes l WHERE l.post_id = p.id);

UPDATE public.posts p
SET repost_count = (SELECT count(*) FROM public.reposts r WHERE r.post_id = p.id);

UPDATE public.posts p
SET reply_count = (SELECT count(*) FROM public.posts c WHERE c.parent_post_id = p.id);

CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_sync_post_count ON public.likes;
CREATE TRIGGER likes_sync_post_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

CREATE OR REPLACE FUNCTION public.sync_post_repost_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reposts_sync_post_count ON public.reposts;
CREATE TRIGGER reposts_sync_post_count
AFTER INSERT OR DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_repost_count();

CREATE OR REPLACE FUNCTION public.sync_post_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_post_id IS NOT NULL THEN
      UPDATE public.posts SET reply_count = reply_count + 1 WHERE id = NEW.parent_post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_post_id IS NOT NULL THEN
      UPDATE public.posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_post_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS posts_sync_reply_count ON public.posts;
CREATE TRIGGER posts_sync_reply_count
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_reply_count();

-- Realtime: broadcast post row changes (counts, edits, deletes) to clients.
ALTER TABLE public.posts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
END $$;
