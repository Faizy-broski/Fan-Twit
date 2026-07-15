"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

type UserLite = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type LikeOrRepostRow = {
  user_id: string;
  profiles: UserLite | null;
};

// Named explicitly rather than left as a bare `profiles(...)` embed —
// PostgREST errors with "more than one relationship" if any other FK to
// profiles ever gets added on these columns, so pin the exact constraint.
const PROFILES_FKEY: Record<"likes" | "reposts", string> = {
  likes: "likes_user_id_profiles_fkey",
  reposts: "reposts_user_id_profiles_fkey",
};

async function fetchPage(
  table: "likes" | "reposts",
  postId: string,
  pageParam: number,
): Promise<LikeOrRepostRow[]> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from(table)
    .select(`user_id, profiles!${PROFILES_FKEY[table]} (username, display_name, avatar_url)`)
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as LikeOrRepostRow[];
}

export function UserListDialog({
  open,
  onClose,
  title,
  table,
  postId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  table: "likes" | "reposts";
  postId: string;
}) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [table, "by-post", postId],
    queryFn: ({ pageParam }) => fetchPage(table, postId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    enabled: open,
    staleTime: 15_000,
  });

  const rows = data?.pages.flat() ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[80vh] w-full max-w-sm flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto p-2">
          {isLoading && (
            <div className="space-y-1 p-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Could not load this list.
            </p>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No one yet.
            </p>
          )}

          {!isLoading &&
            !isError &&
            rows.map((row, index) => {
              const profile = row.profiles;
              const name = profile?.display_name || profile?.username || "unknown";

              return (
                <Link
                  key={`${row.user_id}-${index}`}
                  href={`/user/${encodeURIComponent(profile?.username ?? "")}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent-foreground font-bold text-primary-foreground">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt={name} className="size-full object-cover" />
                    ) : (
                      name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{profile?.username}</p>
                  </div>
                </Link>
              );
            })}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-1 w-full rounded-lg py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
