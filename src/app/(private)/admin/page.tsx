"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Search,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/team-index";

const PAGE_SIZE = 25;

type AdminProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
};

type Stats = {
  totalUsers: number;
  suspendedUsers: number;
  totalPosts: number;
};

type ActivityType = "signup" | "suspended" | "activated" | "post";

type ActivityRow = {
  id: string;
  type: ActivityType;
  created_at: string;
  actor: { username: string; display_name: string | null } | null;
  post: { id: string; body: string } | null;
};

async function fetchStats(): Promise<Stats> {
  const [{ count: totalUsers }, { count: suspendedUsers }, { count: totalPosts }] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("suspended", true),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .is("parent_post_id", null),
    ]);

  return {
    totalUsers: totalUsers ?? 0,
    suspendedUsers: suspendedUsers ?? 0,
    totalPosts: totalPosts ?? 0,
  };
}

async function fetchUsers(search: string): Promise<AdminProfile[]> {
  let query = supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, role, suspended, suspended_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (search.trim()) {
    query = query.ilike("username", `%${search.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

type ActivityJoinRow = {
  id: string;
  type: ActivityType;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
  posts: { id: string; body: string } | null;
};

async function fetchActivity(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("admin_activity_log")
    .select(
      `
        id,
        type,
        created_at,
        profiles!admin_activity_log_user_id_profiles_fkey ( username, display_name ),
        posts!admin_activity_log_post_id_fkey ( id, body )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ActivityJoinRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    created_at: row.created_at,
    actor: row.profiles,
    post: row.posts,
  }));
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, profile, profileLoading: roleLoading } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<AdminProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  const myRole = profile?.role ?? null;
  const isAdmin = myRole === "admin";

  useEffect(() => {
    if (!authLoading && !roleLoading && user && myRole !== null && !isAdmin) {
      router.replace("/");
    }
  }, [authLoading, roleLoading, user, myRole, isAdmin, router]);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: fetchStats,
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersFailed,
  } = useQuery<AdminProfile[]>({
    queryKey: ["admin-users", search],
    queryFn: () => fetchUsers(search),
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const {
    data: activity = [],
    isLoading: activityLoading,
    isError: activityFailed,
  } = useQuery<ActivityRow[]>({
    queryKey: ["admin-activity"],
    queryFn: fetchActivity,
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-activity"] });
  };

  const suspendMutation = useMutation({
    mutationFn: async ({
      profile,
      reason,
    }: {
      profile: AdminProfile;
      reason: string;
    }) => {
      const nextSuspended = !profile.suspended;

      const { error } = await supabase
        .from("profiles")
        .update({
          suspended: nextSuspended,
          suspended_reason: nextSuspended ? reason.trim() || null : null,
          suspended_at: nextSuspended ? new Date().toISOString() : null,
        })
        .eq("id", profile.id);

      if (error) {
        throw new Error(error.message);
      }

      return nextSuspended;
    },
    onSuccess: (nextSuspended, { profile }) => {
      toast.success(
        nextSuspended
          ? `@${profile.username} suspended`
          : `@${profile.username} reactivated`,
      );
      setSuspendTarget(null);
      setSuspendReason("");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async (profile: AdminProfile) => {
      const nextRole = profile.role === "admin" ? "user" : "admin";

      const { error } = await supabase
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", profile.id);

      if (error) {
        throw new Error(error.message);
      }

      return nextRole;
    },
    onSuccess: (nextRole, profile) => {
      toast.success(
        nextRole === "admin"
          ? `@${profile.username} is now an admin`
          : `@${profile.username} is no longer an admin`,
      );
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || roleLoading || !user) {
    return (
      <AppShell>
        <AdminSkeleton />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          Redirecting…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="border-b border-border px-4 py-4">
        <h1 className="text-xl font-black tracking-tight">Admin</h1>
        <p className="text-xs text-muted-foreground">
          Manage users, suspensions, and account activity.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 py-4 sm:gap-3">
        <StatCard label="Users" value={stats?.totalUsers} loading={statsLoading} />
        <StatCard
          label="Suspended"
          value={stats?.suspendedUsers}
          loading={statsLoading}
          tone="destructive"
        />
        <StatCard label="Posts" value={stats?.totalPosts} loading={statsLoading} />
      </div>

      <Tabs defaultValue="users" className="px-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="flex-1 sm:flex-none">
            Users
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 sm:flex-none">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="relative mb-3 mt-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username…"
              className="pl-9"
            />
          </div>

          {usersLoading && <RowListSkeleton />}

          {usersFailed && (
            <div className="p-8 text-center text-sm text-destructive">
              Users could not be loaded.
            </div>
          )}

          {!usersLoading && !usersFailed && users.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          )}

          {!usersLoading && !usersFailed && users.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {users.map((profile) => (
                <li
                  key={profile.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="size-9 shrink-0 rounded-full bg-muted object-cover"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                      {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/user/${encodeURIComponent(profile.username)}`}
                        className="truncate text-sm font-semibold hover:underline"
                      >
                        @{profile.username}
                      </Link>

                      {profile.role === "admin" && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Admin
                        </Badge>
                      )}

                      {profile.suspended && (
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          Suspended
                        </Badge>
                      )}
                    </div>

                    <p className="truncate text-xs text-muted-foreground">
                      Joined {formatRelative(profile.created_at)}
                      {profile.suspended && profile.suspended_reason
                        ? ` · ${profile.suspended_reason}`
                        : ""}
                    </p>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => roleMutation.mutate(profile)}
                      disabled={roleMutation.isPending && roleMutation.variables?.id === profile.id}
                      title={profile.role === "admin" ? "Remove admin" : "Make admin"}
                    >
                      <ShieldPlus className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={profile.suspended ? "outline" : "destructive"}
                      onClick={() => {
                        if (profile.suspended) {
                          suspendMutation.mutate({ profile, reason: "" });
                        } else {
                          setSuspendTarget(profile);
                          setSuspendReason("");
                        }
                      }}
                      disabled={
                        suspendMutation.isPending &&
                        suspendMutation.variables?.profile.id === profile.id
                      }
                    >
                      {profile.suspended ? (
                        <>
                          <ShieldCheck className="size-3.5" />
                          <span className="hidden sm:inline">Reactivate</span>
                        </>
                      ) : (
                        <>
                          <ShieldOff className="size-3.5" />
                          <span className="hidden sm:inline">Suspend</span>
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {activityLoading && <RowListSkeleton />}

          {activityFailed && (
            <div className="p-8 text-center text-sm text-destructive">
              Activity could not be loaded.
            </div>
          )}

          {!activityLoading && !activityFailed && activity.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No activity yet.
            </div>
          )}

          {!activityLoading && !activityFailed && activity.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {activity.map((row) => (
                <li key={row.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {row.type === "signup" && <UserPlus className="size-4 text-primary" />}
                    {row.type === "suspended" && <ShieldOff className="size-4 text-destructive" />}
                    {row.type === "activated" && <ShieldCheck className="size-4 text-emerald-500" />}
                    {row.type === "post" && <FileText className="size-4 text-muted-foreground" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link
                        href={`/user/${encodeURIComponent(row.actor?.username ?? "")}`}
                        className="font-semibold hover:underline"
                      >
                        @{row.actor?.username ?? "unknown"}
                      </Link>{" "}
                      {row.type === "signup" && "signed up"}
                      {row.type === "suspended" && "was suspended"}
                      {row.type === "activated" && "was reactivated"}
                      {row.type === "post" && "made a post"}

                      <span className="text-muted-foreground">
                        {" "}
                        · {formatRelative(row.created_at)}
                      </span>
                    </p>

                    {row.post && (
                      <Link
                        href={`/post/${encodeURIComponent(row.post.id)}`}
                        className="mt-0.5 block truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {row.post.body}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Suspend @{suspendTarget?.username}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            They&apos;ll keep their account and stay visible, but won&apos;t be able to
            post, like, or repost until reactivated.
          </p>

          <Textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Reason (optional, visible to other admins)"
            rows={3}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuspendTarget(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={suspendMutation.isPending}
              onClick={() => {
                if (suspendTarget) {
                  suspendMutation.mutate({ profile: suspendTarget, reason: suspendReason });
                }
              }}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  tone?: "destructive";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 sm:p-3">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </p>

      {loading ? (
        <Skeleton className="mt-1.5 h-6 w-10" />
      ) : (
        <p
          className={`mt-1 text-lg font-black sm:text-xl ${tone === "destructive" && (value ?? 0) > 0 ? "text-destructive" : ""}`}
        >
          {value ?? 0}
        </p>
      )}
    </div>
  );
}

function RowListSkeleton() {
  return (
    <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AdminSkeleton() {
  return (
    <>
      <header className="border-b border-border px-4 py-4">
        <Skeleton className="h-6 w-24" />
      </header>
      <div className="grid grid-cols-3 gap-2 px-4 py-4 sm:gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="px-4">
        <RowListSkeleton />
      </div>
    </>
  );
}
