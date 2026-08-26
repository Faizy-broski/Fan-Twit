"use client";

import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayerDetail as PlayerDetailData } from "@/lib/highlightly.functions";

async function fetchPlayerDetail(id: string): Promise<PlayerDetailData> {
  const res = await fetch(`/api/players/${encodeURIComponent(id)}`, { cache: "no-store" });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Failed to load player");
  }

  return (await res.json()) as PlayerDetailData;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function PlayerDetail({ id }: { id: string }) {
  const {
    data: player,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PlayerDetailData>({
    queryKey: ["player-detail", id],
    queryFn: () => fetchPlayerDetail(id),
    staleTime: 120_000,
  });

  return (
    <AppShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <BackButton fallbackHref="/explore" label="Back to explore" />
        <h1 className="text-base font-bold">Player</h1>
      </header>

      {isLoading && (
        <section className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/40 px-4 py-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          </div>
        </section>
      )}

      {isError && (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            {error instanceof Error ? error.message : "Player could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && player && (
        <>
          <section className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/40 px-4 py-6">
            <div className="flex items-center gap-4">
              {player.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.logo}
                  alt={`${player.name} photo`}
                  className="size-16 shrink-0 rounded-full border border-border bg-background object-cover shadow-sm"
                />
              ) : (
                <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground">
                  {player.name.slice(0, 3).toUpperCase()}
                </span>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight">
                  {player.fullName || player.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {[player.position, player.club].filter(Boolean).join(" · ") || player.sport}
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-background/60 px-3">
              <InfoRow label="Club" value={player.club} />
              <InfoRow label="Position" value={player.position} />
              <InfoRow label="Citizenship" value={player.citizenship} />
              <InfoRow label="Born" value={player.birthDate} />
              <InfoRow label="Birthplace" value={player.birthPlace} />
              <InfoRow label="Height" value={player.height} />
              <InfoRow label="Preferred foot" value={player.foot} />
            </div>
          </section>

          {player.seasonStats.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No season statistics available for this player right now.
            </div>
          )}

          {player.seasonStats.map((stats, index) => (
            <section
              key={`${stats.club}-${stats.league}-${stats.season}-${index}`}
              className="border-b border-border px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{stats.club || "Club"}</h2>
                <span className="text-xs text-muted-foreground">
                  {stats.league}
                  {stats.league && stats.season ? " · " : ""}
                  {stats.season}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums">{stats.gamesPlayed ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Played</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums text-primary">{stats.goals ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums text-primary">{stats.assists ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assists</p>
                </div>
              </div>

              <div className="mt-3 divide-y divide-border rounded-xl border border-border px-3">
                <InfoRow label="Minutes played" value={stats.minutesPlayed != null ? String(stats.minutesPlayed) : null} />
                <InfoRow label="Yellow cards" value={stats.yellowCards != null ? String(stats.yellowCards) : null} />
                <InfoRow label="Red cards" value={stats.redCards != null ? String(stats.redCards) : null} />
              </div>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
