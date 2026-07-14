GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.teams TO anon;
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

GRANT SELECT ON public.players TO anon;
GRANT SELECT ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;

GRANT SELECT ON public.post_teams TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_teams TO authenticated;
GRANT ALL ON public.post_teams TO service_role;

GRANT SELECT ON public.post_players TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_players TO authenticated;
GRANT ALL ON public.post_players TO service_role;

GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;

GRANT SELECT ON public.reposts TO anon;
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT ALL ON public.reposts TO service_role;