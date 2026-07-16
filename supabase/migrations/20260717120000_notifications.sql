
-- NOTIFICATIONS: one row per like/repost/comment a user's post receives.
-- Rows are created by triggers on likes/reposts/posts (not by the client),
-- so every mutation path (including future ones) stays covered automatically
-- and RLS can safely deny direct inserts from authenticated clients.
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'comment')),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_created_idx ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX notifications_recipient_unread_idx ON public.notifications(recipient_id) WHERE read = false;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can mark own notifications read" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- Lets `profiles` be embedded via the actor when selecting notifications
-- (`profiles!notifications_actor_id_profiles_fkey(username, ...)`), same as
-- the likes/reposts profile embeds added in 20260716090000.
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_actor_id_profiles_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id;
    IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (owner_id, NEW.user_id, 'like', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'like' AND post_id = OLD.post_id AND actor_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_notify ON public.likes;
CREATE TRIGGER likes_notify
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id;
    IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (owner_id, NEW.user_id, 'repost', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'repost' AND post_id = OLD.post_id AND actor_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reposts_notify ON public.reposts;
CREATE TRIGGER reposts_notify
AFTER INSERT OR DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_post_id IS NOT NULL THEN
      SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.parent_post_id;
      IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
        VALUES (owner_id, NEW.user_id, 'comment', NEW.parent_post_id, NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_post_id IS NOT NULL THEN
      DELETE FROM public.notifications WHERE type = 'comment' AND comment_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS posts_notify_comment ON public.posts;
CREATE TRIGGER posts_notify_comment
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Realtime: let the bell badge / alerts feed update live without polling.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
