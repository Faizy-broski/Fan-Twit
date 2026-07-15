"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PostCard, type PostRow } from "@/components/PostCard";
import { PostListSkeleton } from "@/components/PostCardSkeleton";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT } from "@/lib/posts";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  favorite_team: string | null;
};

async function fetchProfile(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, cover_url, favorite_team")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function fetchUserPosts(userId: string): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as PostRow[];
}

type RepostRow = {
  created_at: string;
  posts: PostRow;
};

// Reposts made by this profile — shown on their profile alongside their own
// posts, X-style, so a repost surfaces on both the original author's profile
// (it's still their post, unchanged) and the reposting user's profile.
async function fetchUserReposts(userId: string): Promise<RepostRow[]> {
  const { data, error } = await supabase
    .from("reposts")
    .select(`created_at, posts!inner (${POST_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as RepostRow[];
}

type FeedItem = {
  key: string;
  post: PostRow;
  sortAt: string;
  repostedBy?: { username: string; display_name: string | null };
};

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(
    Array.isArray(params.username) ? params.username[0] : params.username,
  );

  const { user: currentUser } = useAuth();

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileFailed,
    error: profileError,
  } = useQuery<Profile | null>({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
    enabled: Boolean(username),
    staleTime: 30_000,
  });

  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsFailed,
  } = useQuery<PostRow[]>({
    queryKey: ["user-posts", profile?.id],
    queryFn: () => fetchUserPosts(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  });

  const {
    data: reposts = [],
    isLoading: repostsLoading,
    isError: repostsFailed,
  } = useQuery<RepostRow[]>({
    queryKey: ["user-reposts", profile?.id],
    queryFn: () => fetchUserReposts(profile!.id),
    enabled: Boolean(profile?.id),
    staleTime: 30_000,
  });

  const feedLoading = postsLoading || repostsLoading;
  const feedFailed = postsFailed || repostsFailed;

  const feedItems = useMemo<FeedItem[]>(() => {
    const ownItems: FeedItem[] = posts.map((post) => ({
      key: `post-${post.id}`,
      post,
      sortAt: post.created_at,
    }));

    const repostItems: FeedItem[] = profile
      ? reposts.map((row) => ({
          key: `repost-${row.posts.id}-${row.created_at}`,
          post: row.posts,
          sortAt: row.created_at,
          repostedBy: { username: profile.username, display_name: profile.display_name },
        }))
      : [];

    return [...ownItems, ...repostItems].sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
    );
  }, [posts, reposts, profile]);

  const isOwnProfile = Boolean(currentUser && profile && currentUser.id === profile.id);
  const name = profile?.display_name || profile?.username || username;

  return (
    <AppShell>
      {profileLoading && <ProfileHeaderSkeleton />}

      {profileFailed && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Profile could not be loaded.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {profileError instanceof Error
              ? profileError.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!profileLoading && !profileFailed && !profile && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          @{username} isn&apos;t on FanTwit.
        </div>
      )}

      {profile && (
        <>
          <div className="relative h-32 w-full bg-gradient-to-br from-primary/20 to-accent/40">
            {profile.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.cover_url}
                alt=""
                className="size-full object-cover"
              />
            )}
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-end justify-between gap-3">
              <div className="z-10 -mt-10 size-20 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary to-accent-foreground text-xl font-bold text-primary-foreground">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              {isOwnProfile && (
                <Link
                  href="/me"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                  Edit profile
                </Link>
              )}
            </div>

            <h1 className="mt-2 text-xl font-black tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>

            {profile.bio && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                {profile.bio}
              </p>
            )}

            {profile.favorite_team && (
              <Link
                href={`/team/${encodeURIComponent(profile.favorite_team)}`}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground"
              >
                ${profile.favorite_team}
              </Link>
            )}
          </div>

          {feedLoading && <PostListSkeleton />}

          {feedFailed && (
            <div className="p-8 text-center text-sm text-destructive">
              Posts could not be loaded.
            </div>
          )}

          {!feedLoading && !feedFailed && feedItems.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No posts yet.
            </div>
          )}

          {!feedLoading &&
            !feedFailed &&
            feedItems.map((item) => (
              <PostCard
                key={item.key}
                post={item.post}
                currentUserId={currentUser?.id ?? null}
                repostedBy={item.repostedBy}
              />
            ))}
        </>
      )}
    </AppShell>
  );
}
