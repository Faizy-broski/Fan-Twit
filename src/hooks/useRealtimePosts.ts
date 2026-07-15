"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { mapPostsIn, removePostFrom, POST_QUERY_KEYS } from "@/lib/post-cache";

type PostRowPatch = {
  id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  body: string;
  media_url: string | null;
  media_type: string | null;
};

// Mounted once (in AppShell) so like/repost/reply counts and deletions
// made by anyone show up live for every viewer, without polling.
export function useRealtimePosts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("posts-counts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>;

          if (typeof row.id !== "string") {
            return;
          }

          const patch: PostRowPatch = {
            id: row.id,
            like_count: Number(row.like_count ?? 0),
            repost_count: Number(row.repost_count ?? 0),
            reply_count: Number(row.reply_count ?? 0),
            body: String(row.body ?? ""),
            media_url: (row.media_url as string | null) ?? null,
            media_type: (row.media_type as string | null) ?? null,
          };

          queryClient.setQueriesData(
            { predicate: (query) => POST_QUERY_KEYS.includes(String(query.queryKey[0])) },
            (old: unknown) =>
              mapPostsIn(old, patch.id, (post) => ({ ...post, ...patch })),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.old as Record<string, unknown>;

          if (typeof row.id !== "string") {
            return;
          }

          const deletedId = row.id;

          queryClient.setQueriesData(
            { predicate: (query) => POST_QUERY_KEYS.includes(String(query.queryKey[0])) },
            (old: unknown) => removePostFrom(old, deletedId),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
