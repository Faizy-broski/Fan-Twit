"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

// A new reply's INSERT event only carries the raw `posts` row (no joined
// profile/likes/reposts/tags), so rather than hand-assembling a PostRow we
// just invalidate the one replies list it belongs to — a single targeted
// refetch, not a global one, so a new comment shows up live for everyone
// viewing that post.
export function useRepliesRealtime(postId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) {
      return;
    }

    const channel = supabase
      .channel(`post-replies-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `parent_post_id=eq.${postId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["replies", postId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, queryClient]);
}
