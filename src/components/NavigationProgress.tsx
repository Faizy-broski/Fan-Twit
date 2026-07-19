"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A top-of-page loading bar for route navigations. The App Router doesn't
// expose navigation start/end events, so this infers "start" from clicks on
// same-origin links (and back/forward navigation) and infers "done" from the
// pathname/search params actually changing.
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeKeyRef = useRef(routeKey);

  useEffect(() => {
    function finish() {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }

    function start() {
      if (tickRef.current) {
        return;
      }
      setVisible(true);
      setProgress(10);
      tickRef.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(1, (90 - p) / 10)));
      }, 200);
      // Safety net: never leave the bar stuck if the route never changes
      // (e.g. the click was cancelled, or landed on the current page).
      timeoutRef.current = setTimeout(finish, 8_000);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      if (nextKey === routeKeyRef.current) return;

      start();
    }

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", start);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", start);
    };
  }, []);

  useEffect(() => {
    if (routeKeyRef.current === routeKey) {
      return;
    }
    routeKeyRef.current = routeKey;

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setProgress(100);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
    return () => clearTimeout(hide);
  }, [routeKey]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden>
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transition: "width 200ms ease-out, opacity 200ms ease-out",
        }}
      />
    </div>
  );
}
