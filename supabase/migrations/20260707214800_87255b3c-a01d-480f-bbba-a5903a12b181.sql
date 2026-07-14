
CREATE TABLE public.players (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team_symbol TEXT REFERENCES public.teams(symbol) ON DELETE SET NULL,
  sport TEXT NOT NULL,
  avatar_url TEXT
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players viewable by everyone" ON public.players FOR SELECT USING (true);

CREATE TABLE public.post_players (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  player_symbol TEXT NOT NULL REFERENCES public.players(symbol) ON DELETE CASCADE,
  PRIMARY KEY (post_id, player_symbol)
);
CREATE INDEX post_players_player_idx ON public.post_players(player_symbol);
GRANT SELECT ON public.post_players TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_players TO authenticated;
GRANT ALL ON public.post_players TO service_role;
ALTER TABLE public.post_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post player tags viewable by everyone" ON public.post_players FOR SELECT USING (true);
CREATE POLICY "Users can tag players on own posts" ON public.post_players FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "Users can untag players on own posts" ON public.post_players FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);

CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_symbol TEXT REFERENCES public.teams(symbol) ON DELETE SET NULL,
  away_symbol TEXT REFERENCES public.teams(symbol) ON DELETE SET NULL,
  home_score INT,
  away_score INT,
  kickoff TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
);
CREATE INDEX games_kickoff_idx ON public.games(kickoff);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
