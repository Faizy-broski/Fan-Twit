import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, PlusSquare, Bell, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function BottomNav() {
  const path = usePathname();
  const { user } = useAuth();
  const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
  // See Sidebar.tsx — fall back to the signup-time username in auth
  // metadata while the profiles fetch is in flight (or fails), so this
  // never mistakenly points at /auth while the user is signed in.
  const metadataUsername = (user?.user_metadata as { username?: string } | undefined)?.username;
  const username = user ? (fetchedUsername ?? metadataUsername ?? null) : null;

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore) setFetchedUsername(data?.username ?? null);
      });
    return () => {
      ignore = true;
    };
  }, [user]);

  const item = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  const isMe = path.startsWith("/user/") || path === "/me";

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-2xl -translate-x-1/2 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <Link href="/" className={item(path === "/")}>
        <Home className="size-5" />
        <span>Home</span>
      </Link>
      <Link href="/explore" className={item(path.startsWith("/explore"))}>
        <Compass className="size-5" />
        <span>Explore</span>
      </Link>
      <Link
        href={user ? "/compose" : "/auth"}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <PlusSquare className="size-5" />
        </span>
      </Link>
      <Link href="/alerts" className={item(path.startsWith("/alerts"))}>
        <Bell className="size-5" />
        <span>Alerts</span>
      </Link>
      {username ? (
        <Link href={`/user/${encodeURIComponent(username)}`} className={item(isMe)}>
          <UserIcon className="size-5" />
          <span>Me</span>
        </Link>
      ) : (
        <Link href="/auth" className={item(isMe)}>
          <UserIcon className="size-5" />
          <span>Me</span>
        </Link>
      )}
    </nav>
  );
}