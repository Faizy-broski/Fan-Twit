
-- ADMIN ROLE + SUSPENSION
-- "suspended" is enforced entirely through RLS (soft suspend, not an auth-level
-- ban): a suspended user keeps their session and can still browse, but every
-- write policy below refuses inserts on their behalf. No service-role key or
-- Supabase Admin API involved.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_suspended_idx ON public.profiles(suspended) WHERE suspended = true;

-- Admins can update any profile (role/suspension); everyone else keeps the
-- existing "own profile only" policy from 20260707211744_...sql.
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Suspended users can't write: posts, likes, reposts. (Reads stay public —
-- this is a soft suspend, not a takedown of their existing content.)
DROP POLICY IF EXISTS "Users can create own posts" ON public.posts;
CREATE POLICY "Users can create own posts" ON public.posts FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.suspended = true)
);

DROP POLICY IF EXISTS "Users can like" ON public.likes;
CREATE POLICY "Users can like" ON public.likes FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.suspended = true)
);

DROP POLICY IF EXISTS "Users can repost" ON public.reposts;
CREATE POLICY "Users can repost" ON public.reposts FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.suspended = true)
);

-- ADMIN ACTIVITY LOG
-- Read-only feed for admins: account signups, suspend/reactivate actions, and
-- top-level posts. Populated only by triggers (SECURITY DEFINER) — there is
-- no INSERT policy for authenticated clients, so admins can view but never
-- fabricate entries.
CREATE TABLE public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('signup', 'suspended', 'activated', 'post')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_log_created_idx ON public.admin_activity_log(created_at DESC);

ALTER TABLE public.admin_activity_log
  ADD CONSTRAINT admin_activity_log_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view activity log" ON public.admin_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

CREATE OR REPLACE FUNCTION public.log_profile_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_activity_log (type, user_id) VALUES ('signup', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_log_signup ON public.profiles;
CREATE TRIGGER profiles_log_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_signup();

CREATE OR REPLACE FUNCTION public.log_profile_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.suspended IS DISTINCT FROM OLD.suspended THEN
    INSERT INTO public.admin_activity_log (type, user_id)
    VALUES (CASE WHEN NEW.suspended THEN 'suspended' ELSE 'activated' END, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_log_suspension ON public.profiles;
CREATE TRIGGER profiles_log_suspension
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_suspension();

CREATE OR REPLACE FUNCTION public.log_post_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_post_id IS NULL THEN
    INSERT INTO public.admin_activity_log (type, user_id, post_id)
    VALUES ('post', NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_log_created ON public.posts;
CREATE TRIGGER posts_log_created
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.log_post_created();
