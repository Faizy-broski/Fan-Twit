"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Repeat2, Tag } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { UNREAD_NOTIFICATIONS_QUERY_KEY } from "@/hooks/useUnreadNotifications";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/team-index";

type Alert =
  | {
      kind: "like" | "repost" | "comment";
      when: string;
      from: string;
      postId: string;
      postBody: string;
    }
  | {
      kind: "team";
      when: string;
      from: string;
      postId: string;
      postBody: string;
      symbol: string;
    };

type NotificationRow = {
  id: string;
  type: "like" | "repost" | "comment";
  created_at: string;
  post: { id: string; body: string } | null;
  comment: { id: string; body: string } | null;
  actor: { username: string } | null;
};

type TeamAlertRow = {
  team_symbol: string;
  posts: {
    id: string;
    body: string;
    created_at: string;
    user_id: string;
    profiles: {
      username: string;
    } | null;
  };
};

export default function AlertsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  const {
    data: alerts = [],
    isLoading: alertsLoading,
    isError,
    error,
  } = useQuery<Alert[]>({
    queryKey: ["alerts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) {
        return [];
      }

      const output: Alert[] = [];

      const { data: notifications, error: notificationsError } =
        await supabase
          .from("notifications")
          .select(
            `
              id,
              type,
              created_at,
              post:posts!notifications_post_id_fkey ( id, body ),
              comment:posts!notifications_comment_id_fkey ( id, body ),
              actor:profiles!notifications_actor_id_profiles_fkey ( username )
            `,
          )
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

      if (notificationsError) {
        throw new Error(notificationsError.message);
      }

      for (const row of (notifications ?? []) as unknown as NotificationRow[]) {
        if (!row.post) {
          continue;
        }

        output.push({
          kind: row.type,
          when: row.created_at,
          from: row.actor?.username ?? "someone",
          postId: row.post.id,
          postBody: row.type === "comment" ? (row.comment?.body ?? row.post.body) : row.post.body,
        });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("favorite_team")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.favorite_team) {
        const { data: taggedPosts, error: taggedPostsError } =
          await supabase
            .from("post_teams")
            .select(
              `
                team_symbol,
                posts!inner (
                  id,
                  body,
                  created_at,
                  user_id,
                  parent_post_id,
                  profiles!posts_user_id_profiles_fkey (
                    username
                  )
                )
              `,
            )
            .eq("team_symbol", profile.favorite_team)
            .is("posts.parent_post_id", null)
            .order("post_id", { ascending: false })
            .limit(20);

        if (taggedPostsError) {
          throw new Error(taggedPostsError.message);
        }

        for (const tagged of (taggedPosts ??
          []) as unknown as TeamAlertRow[]) {
          if (tagged.posts.user_id === user.id) {
            continue;
          }

          output.push({
            kind: "team",
            when: tagged.posts.created_at,
            from: tagged.posts.profiles?.username ?? "fan",
            postId: tagged.posts.id,
            postBody: tagged.posts.body,
            symbol: tagged.team_symbol,
          });
        }
      }

      output.sort(
        (a, b) =>
          new Date(b.when).getTime() - new Date(a.when).getTime(),
      );

      return output.slice(0, 50);
    },
    staleTime: 30_000,
  });

  // Visiting the page clears the unread badge — everything shown here is,
  // by definition, now "seen".
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const markRead = async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", user.id)
        .eq("read", false);

      queryClient.invalidateQueries({
        queryKey: [...UNREAD_NOTIFICATIONS_QUERY_KEY, user.id],
      });
    };

    void markRead();
  }, [user?.id, queryClient]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <AppShell>
        <header className="border-b border-border px-4 py-4">
          <h1 className="text-xl font-black tracking-tight">Alerts</h1>
          <p className="text-xs text-muted-foreground">
            Likes, reposts, comments, and mentions of your favorite team.
          </p>
        </header>
        <AlertsListSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="border-b border-border px-4 py-4">
        <h1 className="text-xl font-black tracking-tight">
          Alerts
        </h1>

        <p className="text-xs text-muted-foreground">
          Likes, reposts, comments, and mentions of your favorite team.
        </p>
      </header>

      {alertsLoading && <AlertsListSkeleton />}

      {isError && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Alerts could not be loaded.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {!alertsLoading && !isError && alerts.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Post something and set a favorite team in
          your profile.
        </div>
      )}

      {!alertsLoading && !isError && alerts.length > 0 && (
        <ul className="divide-y divide-border">
          {alerts.map((alert) => (
            <li
              key={`${alert.kind}-${alert.postId}-${alert.when}`}
              className="flex gap-3 px-4 py-3"
            >
              <div className="mt-0.5 shrink-0">
                {alert.kind === "like" && (
                  <Heart className="size-4 text-destructive" />
                )}
                {alert.kind === "repost" && (
                  <Repeat2 className="size-4 text-emerald-500" />
                )}
                {alert.kind === "comment" && (
                  <MessageCircle className="size-4 text-primary" />
                )}
                {alert.kind === "team" && (
                  <Tag className="size-4 text-primary" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link
                    href={`/user/${encodeURIComponent(alert.from)}`}
                    className="font-semibold hover:underline"
                  >
                    @{alert.from}
                  </Link>{" "}
                  {alert.kind === "like" && "liked your post"}
                  {alert.kind === "repost" && "reposted your post"}
                  {alert.kind === "comment" && "commented on your post"}
                  {alert.kind === "team" && `tagged $${alert.symbol}`}

                  <span className="text-muted-foreground">
                    {" "}
                    · {formatRelative(alert.when)}
                  </span>
                </p>

                <Link
                  href={`/post/${encodeURIComponent(alert.postId)}`}
                  className="mt-0.5 block truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {alert.postBody}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function AlertsListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="flex gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-full max-w-xs" />
          </div>
        </li>
      ))}
    </ul>
  );
}
