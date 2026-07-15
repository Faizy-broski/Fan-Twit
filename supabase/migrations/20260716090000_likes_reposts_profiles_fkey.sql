
-- Add FKs from likes.user_id / reposts.user_id to profiles.id, mirroring
-- posts_user_id_profiles_fkey, so PostgREST can embed `profiles(...)` when
-- selecting from `likes` / `reposts` (needed by the "Liked by" / "Reposted
-- by" dialogs). Both columns already reference auth.users(id); this adds a
-- second FK to profiles(id) purely for the embedding relationship — profiles.id
-- is itself 1:1 with auth.users(id), so this doesn't change referential
-- integrity.
ALTER TABLE public.likes
  ADD CONSTRAINT likes_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reposts
  ADD CONSTRAINT reposts_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
