"use client";

import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { PostComposer } from "@/components/PostComposer";
import { useAuth } from "@/hooks/useAuth";

export default function ComposePage() {
  const { user, loading } = useAuth();
  if (loading || !user)
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">…</div>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <BackButton fallbackHref="/" label="Back" />
        <h1 className="text-base font-bold">New post</h1>
      </div>
      <PostComposer userId={user.id} />
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Tip: tag teams with <span className="font-mono text-primary">$ARS</span> and players with{" "}
        <span className="font-mono text-primary">@LBJ</span>.
      </div>
    </AppShell>
  );
}
