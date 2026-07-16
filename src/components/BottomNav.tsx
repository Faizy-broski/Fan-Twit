// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { Home, Compass, Plus, Bell, User as UserIcon } from "lucide-react";
// import { useEffect, useState } from "react";
// import { useAuth } from "@/hooks/useAuth";
// import { supabase } from "@/integrations/supabase/client";

// export function BottomNav() {
//   const path = usePathname();
//   const { user } = useAuth();
//   const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
//   // See Sidebar.tsx — fall back to the signup-time username in auth
//   // metadata while the profiles fetch is in flight (or fails), so this
//   // never mistakenly points at /auth while the user is signed in.
//   const metadataUsername = (user?.user_metadata as { username?: string } | undefined)?.username;
//   const username = user ? (fetchedUsername ?? metadataUsername ?? null) : null;

//   useEffect(() => {
//     if (!user) return;
//     let ignore = false;
//     supabase
//       .from("profiles")
//       .select("username")
//       .eq("id", user.id)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!ignore) setFetchedUsername(data?.username ?? null);
//       });
//     return () => {
//       ignore = true;
//     };
//   }, [user]);

//   const item = (active: boolean) =>
//     `flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors ${
//       active ? "text-primary" : "text-foreground/70 hover:text-foreground"
//     }`;

//   const isMe = path.startsWith("/user/") || path === "/me";

//   return (
//     <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
//       <div className="mx-auto flex w-full max-w-2xl items-end justify-center gap-2 px-4 pb-4">
//         <div className="flex flex-1 items-stretch justify-around overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur">
//           <Link href="/" className={item(path === "/")}>
//             <Home className="size-5" />
//             <span>Home</span>
//           </Link>
//           <Link href="/explore" className={item(path.startsWith("/explore"))}>
//             <Compass className="size-5" />
//             <span>Explore</span>
//           </Link>
//         </div>

//         <Link
//           href={user ? "/compose" : "/auth"}
//           aria-label="Post"
//           className="mb-2 flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary/80 shadow-lg shadow-primary/30 ring-[6px] ring-background"
//         >
//           <span className="flex size-9 items-center justify-center rounded-xl border-2 border-primary-foreground">
//             <Plus className="size-5 text-primary-foreground" strokeWidth={2.5} />
//           </span>
//         </Link>

//         <div className="flex flex-1 items-stretch justify-around overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur">
//           <Link href="/alerts" className={item(path.startsWith("/alerts"))}>
//             <Bell className="size-5" />
//             <span>Alerts</span>
//           </Link>
//           {username ? (
//             <Link href={`/user/${encodeURIComponent(username)}`} className={item(isMe)}>
//               <UserIcon className="size-5" />
//               <span>Me</span>
//             </Link>
//           ) : (
//             <Link href="/auth" className={item(isMe)}>
//               <UserIcon className="size-5" />
//               <span>Me</span>
//             </Link>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Compass,
  Home,
  Plus,
  ShieldCheck,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  showBadge?: boolean;
};

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  showBadge,
}: NavItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex h-14 min-w-0 flex-1 items-center justify-center"
    >
      <span
        className={cn(
          "flex items-center justify-center transition-all duration-300 ease-out",
          active
            ? [
                "absolute -top-5 size-12 rounded-full",
                "bg-gradient-to-b from-primary to-primary/80",
                "text-primary-foreground",
                // "shadow-xl shadow-primary/30",
                "ring-[6px] ring-background",
                "motion-safe:animate-in motion-safe:zoom-in-90",
              ]
            : [
                "flex-col gap-1 text-foreground/65",
                "hover:text-foreground",
              ],
        )}
      >
        <span className="relative shrink-0">
          <Icon
            className={cn(
              "transition-all duration-300",
              active ? "size-7" : "size-6",
            )}
            strokeWidth={active ? 2 : 1.5}
          />
          {showBadge && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </span>

        {/* <span
          className={cn(
            "text-[11px] font-medium transition-all duration-200",
            active
              ? "pointer-events-none absolute opacity-0"
              : "translate-y-0 opacity-100",
          )}
        >
          {label}
        </span> */}
      </span>
    </Link>
  );
}

export function BottomNav({
  unreadNotifications = 0,
}: {
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const metadataUsername = (
    user?.user_metadata as { username?: string } | undefined
  )?.username;

  const username = user
    ? (fetchedUsername ?? metadataUsername ?? null)
    : null;
  const effectiveRole = user ? role : null;

  useEffect(() => {
    if (!user) {
      return;
    }

    let ignore = false;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!ignore && !error) {
        setFetchedUsername(data?.username ?? null);
        setRole(data?.role ?? null);
      }
    };

    void fetchProfile();

    return () => {
      ignore = true;
    };
  }, [user]);

  const isHome = pathname === "/";
  const isExplore = pathname.startsWith("/explore");
  const isCompose = pathname.startsWith("/compose");
  const isAlerts = pathname.startsWith("/alerts");
  const isMe = pathname.startsWith("/user/") || pathname === "/me";

  const composeHref = username ? "/compose" : "/auth";
  const profileHref = username
    ? `/user/${encodeURIComponent(username)}`
    : "/auth";

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="mx-auto w-full max-w-2xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="relative mt-8 flex h-14 items-center rounded-[30px] border border-border/70 bg-card/95 px-1 shadow-xl shadow-black/10 backdrop-blur-xl">
          <NavItem
            href="/"
            label="Home"
            icon={Home}
            active={isHome}
          />

          <NavItem
            href="/explore"
            label="Explore"
            icon={Compass}
            active={isExplore}
          />

          {/* Permanent center compose button */}
          <NavItem
            href={composeHref}
            label="Compose"
            icon={Plus}
            active={isCompose}
          />
          {/* <div className="relative flex h-[72px] min-w-0 flex-1 items-center justify-center">
            <Link
              href={user ? "/compose" : "/auth"}
              aria-label="Create post"
              className={cn(
                "absolute -top-7 flex size-16 items-center justify-center",
                "rounded-full bg-gradient-to-b from-primary to-primary/80",
                "text-primary-foreground",
                "shadow-xl shadow-primary/30",
                "ring-[6px] ring-background",
                "transition-transform duration-200",
                "hover:scale-105 active:scale-95",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-xl border-2 border-primary-foreground/90">
                <Plus className="size-6" strokeWidth={2.5} />
              </span>
            </Link>
          </div> */}

          <NavItem
            href="/alerts"
            label="Alerts"
            icon={Bell}
            active={isAlerts}
            showBadge={unreadNotifications > 0}
          />

          <NavItem
            href={profileHref}
            label="Me"
            icon={UserIcon}
            active={isMe}
          />

          {effectiveRole === "admin" && (
            <NavItem
              href="/admin"
              label="Admin"
              icon={ShieldCheck}
              active={pathname.startsWith("/admin")}
            />
          )}
        </div>
      </div>
    </nav>
  );
}