"use client";

import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamDetail as TeamDetailData } from "@/lib/highlightly.functions";

async function fetchTeamDetail(id: string): Promise<TeamDetailData> {
  const res = await fetch(`/api/teams/${encodeURIComponent(id)}`, { cache: "no-store" });

  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "Failed to load team");
  }

  return (await res.json()) as TeamDetailData;
}

function StatRow({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="tabular-nums text-foreground">{home ?? "—"}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{away ?? "—"}</span>
    </div>
  );
}

export function TeamDetail({ id }: { id: string }) {
  const {
    data: team,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TeamDetailData>({
    queryKey: ["team-detail", id],
    queryFn: () => fetchTeamDetail(id),
    staleTime: 120_000,
  });

  return (
    <AppShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <BackButton fallbackHref="/explore" label="Back to explore" />
        <h1 className="text-base font-bold">Team</h1>
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
            {error instanceof Error ? error.message : "Team could not be loaded."}
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

      {!isLoading && !isError && team && (
        <>
          <section className="border-b border-border bg-gradient-to-br from-primary/10 to-accent/40 px-4 py-6">
            <div className="flex items-center gap-4">
              {team.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logo}
                  alt={`${team.name} logo`}
                  className="size-16 shrink-0 rounded-full border border-border bg-background object-contain shadow-sm"
                />
              ) : (
                <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-primary-foreground">
                  {team.name.slice(0, 3).toUpperCase()}
                </span>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight">{team.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {team.sport}
                  {team.type ? ` · ${team.type}` : ""}
                </p>
              </div>
            </div>
          </section>

          {team.seasonStats.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No season statistics available for this team right now.
            </div>
          )}

          {team.seasonStats.map((stats) => (
            <section key={`${stats.leagueId}-${stats.season}`} className="border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{stats.leagueName || "League"}</h2>
                <span className="text-xs text-muted-foreground">{stats.season}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums">{stats.total.played ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Played</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums text-primary">{stats.total.wins ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Wins</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-lg font-black tabular-nums text-destructive">{stats.total.losses ?? "—"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Losses</p>
                </div>
              </div>

              <div className="mt-3 divide-y divide-border rounded-xl border border-border px-3">
                <div className="flex items-center justify-between py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Home</span>
                  <span></span>
                  <span>Away</span>
                </div>
                <StatRow label="Draws" home={stats.home.draws} away={stats.away.draws} />
                <StatRow label="Wins" home={stats.home.wins} away={stats.away.wins} />
                <StatRow label="Losses" home={stats.home.losses} away={stats.away.losses} />
                <StatRow label="Goals for" home={stats.home.goalsFor} away={stats.away.goalsFor} />
                <StatRow label="Goals against" home={stats.home.goalsAgainst} away={stats.away.goalsAgainst} />
              </div>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
