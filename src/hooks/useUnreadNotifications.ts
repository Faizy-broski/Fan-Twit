"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const UNREAD_NOTIFICATIONS_QUERY_KEY = ["unread-notifications-count"];

async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("read", false);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

// Powers the red dot on the Alerts/Bell nav icon. Kept in its own hook (not
// alerts/page.tsx) so it can be mounted once in AppShell and stay accurate
// even while the user isn't on the alerts page.
export function useUnreadNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery<number>({
    queryKey: [...UNREAD_NOTIFICATIONS_QUERY_KEY, user?.id],
    queryFn: () => fetchUnreadCount(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`notifications-badge-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          queryClient.invalidateQueries({
            queryKey: [...UNREAD_NOTIFICATIONS_QUERY_KEY, user.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return count;
}
