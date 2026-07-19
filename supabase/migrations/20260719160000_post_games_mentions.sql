
-- POST_GAMES: tags a post with a live game (Highlightly id, e.g. "football:12345").
-- Not FK'd to public.games (that table is unused dead storage from an earlier
-- design; real game data is fetched live from the Highlightly API at request
-- time via /api/games/*), so game_id is a free-form text id, not a UUID.
CREATE TABLE public.post_games (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  PRIMARY KEY (post_id, game_id)
);
CREATE INDEX post_games_game_idx ON public.post_games(game_id);
GRANT SELECT ON public.post_games TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_games TO authenticated;
GRANT ALL ON public.post_games TO service_role;
ALTER TABLE public.post_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post game tags viewable by everyone" ON public.post_games FOR SELECT USING (true);
CREATE POLICY "Users can tag games on own posts" ON public.post_games FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "Users can untag games on own posts" ON public.post_games FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);

-- POST_MENTIONS: tags a real user (@username) in a post body.
CREATE TABLE public.post_mentions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, mentioned_user_id)
);
CREATE INDEX post_mentions_user_idx ON public.post_mentions(mentioned_user_id);
GRANT SELECT ON public.post_mentions TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_mentions TO authenticated;
GRANT ALL ON public.post_mentions TO service_role;
ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post mentions viewable by everyone" ON public.post_mentions FOR SELECT USING (true);
CREATE POLICY "Users can mention on own posts" ON public.post_mentions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "Users can remove mentions on own posts" ON public.post_mentions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);

-- Allow a 'mention' notification alongside the existing like/repost/comment types.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'repost', 'comment', 'mention'));

CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO actor FROM public.posts WHERE id = NEW.post_id;
    IF actor IS NOT NULL AND actor <> NEW.mentioned_user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
      VALUES (NEW.mentioned_user_id, actor, 'mention', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'mention' AND post_id = OLD.post_id AND recipient_id = OLD.mentioned_user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_mentions_notify ON public.post_mentions;
CREATE TRIGGER post_mentions_notify
AFTER INSERT OR DELETE ON public.post_mentions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();
